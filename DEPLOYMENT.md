# Deployment

Short runbook for staging and production. Configuration background is in the README
([Supabase configuration](README.md#supabase-configuration-required) and
[Deployment](README.md#deployment-vercel--supabase)).

## Environments

| | Staging | Production |
|---|---|---|
| Supabase | its own project (never share the production database or bucket) | production project |
| `DATABASE_URL` | pooler, port 6543, `?pgbouncer=true&connection_limit=1` on Vercel (5 on long-lived Node) | same |
| `DIRECT_URL` | session/direct, port 5432 (migrations only) | same |
| `SUPABASE_DOCUMENTS_BUCKET` | e.g. `staging-documents` | `candidate-documents` |
| `SEED_DEMO_PASSWORD` | optional (demo logins) | **unset** |
| `NEXT_PUBLIC_SITE_URL` | staging URL | production URL |

## Release steps (both environments)

1. `npm ci` (runs `prisma generate`).
2. Quality gates: `npm run typecheck && npm run lint && npm test`, then the Playwright suite
   against staging.
3. Apply migrations **before** the new build takes traffic:
   `DATABASE_URL=... DIRECT_URL=... npm run db:migrate` (`prisma migrate deploy`).
   Migrations are additive. `20261108000000_application_display_id_trgm` needs the `pg_trgm`
   extension, which it creates (Supabase allows this). On a large `applications` table, build the
   index first with `CREATE INDEX CONCURRENTLY` and mark the migration applied with
   `prisma migrate resolve --applied 20261108000000_application_display_id_trgm`.
4. First deploy only: `npm run setup:storage`, `npm run db:seed` (roles and permissions), and
   `npm run create-super-admin -- ...`.
5. Deploy: on Vercel, push the release; otherwise `npm run build && npm start` per instance.
6. Smoke test: `/`, `/jobs`, staff login, candidate login, one apply with a PDF, and one admin
   status change.

## Self-hosted (non-Vercel) topology

Each instance is `next start` behind a reverse proxy. `scripts/lb-proxy.mjs` is a minimal
reference/staging balancer:

```
PORT=3400 UPSTREAMS=http://127.0.0.1:3401,http://127.0.0.1:3402 MAX_INFLIGHT=24 node scripts/lb-proxy.mjs
```

- Overload returns a fast `503` with `Retry-After` instead of letting latency climb without
  bound (`MAX_INFLIGHT` per instance, `MAX_QUEUE`, `QUEUE_TIMEOUT_MS`).
- It **overwrites `X-Forwarded-For`** with the real peer address, so clients cannot spoof the IP
  that the rate limits key on. Whatever proxy runs in production (nginx, ALB, Cloudflare) must do
  the same. Vercel already does. Never set `TRUST_XFF=1` outside load tests.
- Capacity measured on staging: about 50 req/s per instance (CPU bound on server rendering). Add
  instances, and keep `instances × connection_limit` within the pooler limit.

## Production checklist

- [ ] TLS everywhere (HSTS is sent; the session cookie is only `Secure` over https)
- [ ] Proxy overwrites `X-Forwarded-For`
- [ ] Pooler on 6543, migrations through `DIRECT_URL`
- [ ] Custom SMTP, email templates, redirect URLs (see README)
- [ ] Database backups / PITR enabled
- [ ] `CRON_SECRET` set; `SEED_DEMO_PASSWORD` unset
- [ ] Supabase Auth rate limits reviewed (login bursts are bound by GoTrue's bcrypt cost)
- [ ] `npm audit --omit=dev` is clean
