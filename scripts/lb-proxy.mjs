// Minimal self-hosted load balancer for `next start` instances (staging / self-hosting only).
// Round-robins requests across upstreams, caps in-flight requests per upstream and
// sheds excess load with a fast 503 + Retry-After instead of queueing until timeout.
// On Vercel the platform does this; this script is not used there.
//
//   UPSTREAMS=http://127.0.0.1:3401,http://127.0.0.1:3402 PORT=3400 \
//   MAX_INFLIGHT=24 MAX_QUEUE=200 QUEUE_TIMEOUT_MS=3000 node scripts/lb-proxy.mjs
import http from "node:http";

const upstreams = (process.env.UPSTREAMS || "http://127.0.0.1:3401").split(",").map((u) => ({ url: new URL(u), inflight: 0, down: 0 }));
const PORT = Number(process.env.PORT || 3400);
const MAX_INFLIGHT = Number(process.env.MAX_INFLIGHT || 24);
const MAX_QUEUE = Number(process.env.MAX_QUEUE || 200);
const QUEUE_TIMEOUT_MS = Number(process.env.QUEUE_TIMEOUT_MS || 3000);
// Client-supplied X-Forwarded-For is replaced with the socket address unless TRUST_XFF=1
// (only for load tests that simulate many client IPs from one machine).
const TRUST_XFF = process.env.TRUST_XFF === "1";
const agent = new http.Agent({ keepAlive: true, maxSockets: MAX_INFLIGHT * 2 });
const queue = [];
let rr = 0;
const stats = { ok: 0, shed: 0, upstreamErr: 0 };

function pick() {
  const now = Date.now();
  for (let i = 0; i < upstreams.length; i++) {
    const u = upstreams[(rr + i) % upstreams.length];
    if (u.down > now || u.inflight >= MAX_INFLIGHT) continue;
    rr = (rr + i + 1) % upstreams.length;
    return u;
  }
  return null;
}

function shed(res) {
  stats.shed++;
  if (res.headersSent) return;
  res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "5", "Cache-Control": "no-store" });
  res.end("The service is busy. Please try again in a few seconds.");
}

function release(u) {
  u.inflight--;
  while (queue.length) {
    const job = queue.shift();
    if (job.expired) continue;
    clearTimeout(job.timer);
    dispatch(job.req, job.res, job.tried);
    break;
  }
}

function dispatch(req, res, tried = 0) {
  const u = pick();
  if (!u) {
    if (queue.length >= MAX_QUEUE) return shed(res);
    const job = { req, res, tried, expired: false };
    const drop = () => { if (job.expired) return; job.expired = true; clearTimeout(job.timer); const i = queue.indexOf(job); if (i >= 0) queue.splice(i, 1); };
    job.timer = setTimeout(() => { drop(); shed(res); }, QUEUE_TIMEOUT_MS);
    res.on("close", drop); // client gave up while queued: free the slot
    queue.push(job);
    return;
  }
  u.inflight++;
  // Release the slot exactly once, whatever ends the exchange (upstream end/error, or the
  // client disconnecting mid-request). Without this, aborted requests leaked slots until
  // every upstream looked full and the proxy shed all traffic permanently.
  let released = false;
  const done = () => { if (!released) { released = true; release(u); } };
  const headers = { ...req.headers, "x-forwarded-for": (TRUST_XFF && req.headers["x-forwarded-for"]) || req.socket.remoteAddress, "x-forwarded-host": req.headers.host, "x-forwarded-proto": "http" };
  const p = http.request({ host: u.url.hostname, port: u.url.port, method: req.method, path: req.url, headers, agent }, (pr) => {
    res.writeHead(pr.statusCode, pr.headers);
    pr.pipe(res);
    pr.on("end", () => { stats.ok++; done(); });
    pr.on("error", done);
    pr.on("close", done);
  });
  res.on("close", () => { if (!released) { p.destroy(); done(); } });
  p.on("error", () => {
    stats.upstreamErr++;
    if (released) return; // client already gone; nothing left to answer
    u.down = Date.now() + 2000; // take the instance out briefly (e.g. restarting)
    done();
    // Retry idempotent requests once on another instance; otherwise fail fast.
    if ((req.method === "GET" || req.method === "HEAD") && tried < upstreams.length - 1 && !res.headersSent) return dispatch(req, res, tried + 1);
    if (!res.headersSent) { res.writeHead(502, { "Content-Type": "text/plain", "Retry-After": "2" }); res.end("Upstream unavailable."); }
  });
  if (req.method === "GET" || req.method === "HEAD") p.end();
  else req.pipe(p);
}

http.createServer((req, res) => {
  const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
  if (req.url === "/__lb/health" && local) { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ ...stats, queue: queue.length, upstreams: upstreams.map((u) => ({ url: u.url.href, inflight: u.inflight, down: u.down > Date.now() })) })); }
  dispatch(req, res);
}).listen(PORT, () => console.log(`lb-proxy :${PORT} -> ${upstreams.map((u) => u.url.href).join(", ")} (max ${MAX_INFLIGHT}/instance, queue ${MAX_QUEUE}, ${QUEUE_TIMEOUT_MS}ms)`));
