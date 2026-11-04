/**
 * Applies the Supabase Auth settings the app needs (README → "Supabase configuration")
 * through the Supabase Management API, so they don't have to be clicked in the dashboard:
 *
 *   - Site URL and redirect URLs (/auth/confirm, /auth/callback)
 *   - Email sign-up with "Confirm email", 6-digit code valid for 1 hour, min. password length 10
 *   - "Confirm signup" email with the verification code, "Reset password" email with a server-side link
 *   - Custom SMTP (when SMTP_* is set)
 *   - Google sign-in (when GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are set)
 *
 * Secrets are read from the environment and never printed.
 *
 *   npm run setup:auth            # dry run: shows what would change
 *   npm run setup:auth -- --apply # applies the changes
 */

const API = "https://api.supabase.com/v1";
const apply = process.argv.includes("--apply");

const SECRET_KEYS = new Set(["smtp_pass", "external_google_secret"]);

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function need(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`Missing ${name}. Set it in .env or .env.supabase.local.`);
  return value;
}

function projectRef(): string {
  const explicit = env("SUPABASE_PROJECT_REF");
  if (explicit) return explicit;
  const host = new URL(need("NEXT_PUBLIC_SUPABASE_URL")).hostname;
  const match = host.match(/^([a-z0-9]{20})\.supabase\.co$/);
  if (!match) throw new Error(`Cannot read the project ref from NEXT_PUBLIC_SUPABASE_URL (${host}). Set SUPABASE_PROJECT_REF.`);
  return match[1];
}

const CONFIRM_SIGNUP_HTML = `<h2>Verify your email</h2>
<p>Enter this code on the MaverickInnogarage sign-up page to finish creating your account:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
<p>The code expires in 1 hour. If you didn't create an account, you can ignore this email.</p>`;

const RESET_PASSWORD_HTML = `<h2>Reset your password</h2>
<p>We received a request to reset the password for your MaverickInnogarage account.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Choose a new password</a></p>
<p>If you didn't ask for this, you can ignore this email.</p>`;

function desiredConfig(): Record<string, string | number | boolean> {
  const site = need("NEXT_PUBLIC_SITE_URL").replace(/\/$/, "");
  const extraOrigins = (env("AUTH_EXTRA_SITE_URLS") ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const redirects = [site, ...extraOrigins].flatMap((origin) => [`${origin}/auth/confirm`, `${origin}/auth/callback`]);

  const config: Record<string, string | number | boolean> = {
    site_url: site,
    uri_allow_list: redirects.join(","),
    external_email_enabled: true,
    mailer_autoconfirm: false,
    mailer_otp_length: 6,
    mailer_otp_exp: 3600,
    password_min_length: 10,
    mailer_subjects_confirmation: "Your MaverickInnogarage verification code",
    mailer_templates_confirmation_content: CONFIRM_SIGNUP_HTML,
    mailer_subjects_recovery: "Reset your MaverickInnogarage password",
    mailer_templates_recovery_content: RESET_PASSWORD_HTML,
  };

  const smtp = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_SENDER_EMAIL"];
  const smtpSet = smtp.filter((k) => env(k));
  if (smtpSet.length && smtpSet.length < smtp.length) {
    throw new Error(`Incomplete SMTP settings. Set all of: ${smtp.join(", ")} (missing: ${smtp.filter((k) => !env(k)).join(", ")}).`);
  }
  if (smtpSet.length) {
    Object.assign(config, {
      smtp_host: need("SMTP_HOST"),
      smtp_port: need("SMTP_PORT"),
      smtp_user: need("SMTP_USER"),
      smtp_pass: need("SMTP_PASS"),
      smtp_admin_email: need("SMTP_SENDER_EMAIL"),
      smtp_sender_name: env("SMTP_SENDER_NAME") ?? "MaverickInnogarage",
    });
  }

  const googleId = env("GOOGLE_CLIENT_ID");
  const googleSecret = env("GOOGLE_CLIENT_SECRET");
  if (!!googleId !== !!googleSecret) throw new Error("Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither.");
  if (googleId && googleSecret) {
    Object.assign(config, { external_google_enabled: true, external_google_client_id: googleId, external_google_secret: googleSecret });
  }
  return config;
}

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${need("SUPABASE_ACCESS_TOKEN")}`, "Content-Type": "application/json", ...init.headers },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase Management API ${init.method ?? "GET"} ${path} failed: ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

const show = (key: string, value: unknown) =>
  SECRET_KEYS.has(key) ? (value ? "•••• (set)" : "(empty)") : typeof value === "string" && value.length > 70 ? `${value.slice(0, 67)}…` : JSON.stringify(value);

async function main() {
  const ref = projectRef();
  const desired = desiredConfig();
  const current = (await api(`/projects/${ref}/config/auth`)) as Record<string, unknown>;

  const unknown = Object.keys(desired).filter((k) => !(k in current));
  if (unknown.length) throw new Error(`The Management API does not recognise: ${unknown.join(", ")}. Nothing was changed.`);

  // Secrets are always re-sent: the API doesn't reveal stored values, so they can't be compared.
  const changes = Object.entries(desired).filter(([k, v]) => SECRET_KEYS.has(k) || String(current[k] ?? "") !== String(v));
  console.log(`Project ${ref}: ${changes.length} auth setting(s) to update${apply ? "" : " (dry run)"}`);
  for (const [k, v] of changes) console.log(`  ${k}: ${show(k, current[k])} → ${show(k, v)}`);
  if (!("smtp_host" in desired)) console.log("  ! SMTP_* not set: Supabase's built-in sender only emails your project team, so candidates won't get codes.");
  if (!("external_google_enabled" in desired)) console.log("  ! GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set: Google sign-in stays off.");

  if (!apply) {
    console.log("\nNothing changed. Re-run with --apply to update the project.");
    return;
  }
  if (!changes.length) return console.log("Already up to date.");

  await api(`/projects/${ref}/config/auth`, { method: "PATCH", body: JSON.stringify(Object.fromEntries(changes)) });
  const after = (await api(`/projects/${ref}/config/auth`)) as Record<string, unknown>;
  const mismatched = changes.filter(([k, v]) => !SECRET_KEYS.has(k) && String(after[k] ?? "") !== String(v)).map(([k]) => k);
  if (mismatched.length) throw new Error(`Updated, but these did not take effect: ${mismatched.join(", ")}`);
  console.log("✓ Auth settings updated and verified.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
