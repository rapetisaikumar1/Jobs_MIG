# MaverickInnogarage — IT Recruitment Platform

One Next.js application with two portals that share one Supabase PostgreSQL database:

- **Job Portal** (`/`, `/jobs`, `/candidate/*`): candidates register, search jobs, apply with resumes, and track their applications.
- **Admin Portal** (`/admin/*`, opens on Jobs): staff manage jobs, case files, candidates, applications, advanced search, staff users and roles.

Every job automatically gets a **case file**, and every application automatically gets its own **application folder** inside that case file.

---

## Contents

1. [Tech stack](#tech-stack)
2. [Local setup](#local-setup)
3. [Supabase configuration](#supabase-configuration-required)
4. [Testing](#testing)
5. [Deployment (Vercel + Supabase)](#deployment-vercel--supabase)
6. [Architecture](#architecture)
7. [Key design decisions](#key-design-decisions)
8. [Assumptions and scope notes](#assumptions-and-scope-notes)

---

## Tech stack

| Layer | Choice |
|---|---|
| App | Next.js 15 (App Router, Server Components, Server Actions), React 19, TypeScript |
| UI | Tailwind CSS 4 + shadcn/ui-style components (`src/components/ui`), lucide icons |
| Forms | React Hook Form + Zod 4. The same schema validates in the browser and again on the server. |
| Data | Supabase PostgreSQL via Prisma 6 (migrations in `prisma/migrations`) |
| Auth | Supabase Auth (`@supabase/ssr` cookie sessions) |
| Files | Supabase Storage, one private bucket |
| Search | PostgreSQL full-text search (`tsvector` + GIN) and indexed relational filters |
| Tests | Vitest (unit and integration), Playwright (end-to-end) |
| Hosting | Vercel (app and daily cron) plus Supabase (database, auth, storage) |

These are deliberately pinned to stable major versions (Next 15, Prisma 6). Newer majors (Next 16, Prisma 7) change configuration and APIs and can be adopted later as a separate upgrade.

---

## Local setup

**Prerequisites:** Node.js 20.9+ and a Supabase project (the free tier works). You can also use the Supabase CLI (`supabase start`) for a fully local stack.

```bash
npm install
cp .env.example .env          # fill in the Supabase URL/keys and database URLs (see comments in the file)
npm run db:migrate            # applies prisma/migrations (prisma migrate deploy)
npm run setup:storage         # creates the private "candidate-documents" bucket
npm run create-super-admin -- you@company.com "First" "Last" "Initial-Password1"   # creates the first login
npm run db:seed               # optional demo data (see below)
npm run dev                   # http://localhost:3000 — staff sign-in at /admin/login
```

### Demo data

`npm run db:seed` always syncs permissions and the built-in roles, so it is safe to run after every deploy. It only creates demo records when the database has no jobs yet:

- 8 US/Canadian jobs (draft, open, closed), 5 staff, 10 candidates and 11 applications across all statuses.
- With `SEED_DEMO_PASSWORD` set (and the Supabase keys), demo users get real logins and sample PDF resumes:
  - Staff: `admin@`, `ops@`, `emma@`, `marcus@`, `aisha@` + `SEED_EMAIL_DOMAIN` (default `example.com`).
  - Candidates: e.g. `john.smith@`, `priya.patel@`.
- Do not run the demo seed against production.

---

## Supabase configuration (required)

### 1. Authentication settings

**Authentication → URL Configuration**

- Site URL: your app URL (e.g. `https://jobs.maverickinnogarage.com`, or `http://localhost:3000` locally).
- Redirect URLs: add `<site>/auth/confirm` and `<site>/auth/callback` (Google sign-in).

**Authentication → Providers → Email**

- Enable email provider and **Confirm email**.
- Email OTP length: 6 (the default). Email OTP expiration: 3600 seconds or less.

**Authentication → Providers → Google** (job portal "Continue with Google")

1. In Google Cloud Console → APIs & Services → Credentials, create an **OAuth client ID** (type: Web application).
   - Authorized JavaScript origins: your site URL.
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback` (shown on the Supabase Google provider page).
   - OAuth consent screen: app name, support email, the `email` and `profile` scopes, then publish the app.
2. In Supabase, enable the Google provider and paste the client ID and client secret.

**Show your own domain on Google's screens (recommended).** By default Google returns through Supabase, so its account picker and consent screen say "continue to <project>.supabase.co". To show your domain instead:
1. In the same Google OAuth client, add `<site>/auth/google/callback` (and `http://localhost:3000/auth/google/callback` for local use) to **Authorized redirect URIs**.
2. Set `GOOGLE_SIGNIN_ON_SITE=true`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the app's environment (Vercel too).
3. Google Cloud → OAuth consent screen / Branding: app name, logo, support email, home page, privacy policy (`<site>/privacy`), authorized domain `maverickinnogarage.com`; publish the app and submit it for brand verification so Google shows the app name and logo.

Google sign-in exists on the job portal only. A Google login whose email belongs to a staff account is refused on the job portal; staff keep using `/admin/login`. A first Google sign-in creates the candidate account (source "Job Portal") and opens the profile so the candidate can add their phone number and location. Supabase links a Google login to an existing candidate with the same verified email address.

**Authentication → Policies (optional)**

- Set the minimum password length to 10 or more.

**Production email**

- Configure custom SMTP (Authentication → SMTP), for example Resend, SendGrid, Amazon SES or Postmark. **Without it, sign-up codes do not reach candidates:** Supabase's built-in sender only delivers to your own project team's addresses and allows only a few emails per hour.

### 2. Email templates

Authentication → Email Templates.

**Confirm signup: verification code.** Candidates finish sign-up by typing the code from this email into the sign-up page (the app checks it with `verifyOtp`). The template must contain `{{ .Token }}`. Suggested template:

- Subject: `Your MaverickInnogarage verification code`
- Body:

```html
<h2>Verify your email</h2>
<p>Enter this code on the MaverickInnogarage sign-up page to finish creating your account:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
<p>The code expires in 1 hour. If you didn't create an account, you can ignore this email.</p>
```

Unverified candidates who try to sign in are offered "Enter verification code", which can also send a new code.

**Reset password: link.** Server-side apps should use token-hash links, which `/auth/confirm` verifies on the server:

| Template | Link `href` |
|---|---|
| Reset password | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password` |

(`/auth/confirm` also accepts the default PKCE `?code=` links as a fallback.)

### 3. Database connections

- `DATABASE_URL`: the **transaction pooler** (port 6543) with `?pgbouncer=true&connection_limit=1`. The app uses this at runtime.
- `DIRECT_URL`: the session pooler or direct connection (port 5432). Prisma migrations use this.

The init migration enables **Row Level Security with no policies** on every application table and revokes `anon`/`authenticated` grants. All data access goes through Prisma on the server, so Supabase's auto-generated REST API exposes nothing. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

---

## Testing

```bash
npm test              # unit tests (always) + integration tests (when TEST_DATABASE_URL is set)
npm run test:e2e      # Playwright; starts `npm run dev` unless E2E_BASE_URL is set
npm run typecheck && npm run lint
```

- **Unit tests** (`tests/unit`) cover formatting (phones, money, time zones, deadlines), file type and content-signature checks, every Zod schema, role definitions, candidate-facing statuses, the advanced-search filter builder, snapshots, and redirect safety.
- **Integration tests** (`tests/integration`) run the real services against PostgreSQL with Supabase Storage faked in memory:
  - automatic case files
  - posted date preserved through edits and re-opening
  - unique IDs under concurrency
  - portal application creating its folder and documents
  - duplicate (including concurrent) applications rejected
  - invalid files rejected
  - internal candidates searchable, with duplicate detection
  - combined search filters
  - adding internal candidates to jobs with consent
  - snapshots unaffected by profile edits
  - status history
  - recruiter job scoping
  - rate limiting

  They **truncate every table**, so point `TEST_DATABASE_URL` at a disposable database with the migrations applied (`DATABASE_URL=$TEST_DATABASE_URL npm run db:migrate`). Hosted Supabase URLs, and the same URL as `DATABASE_URL`, are refused. To run them with plain `npm test`, put the URL in `.env.test.local` (git-ignored), e.g. with local Supabase:

  ```bash
  docker exec supabase_db_<project> createdb -U postgres mig_test
  echo 'TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/mig_test"' > .env.test.local
  DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/mig_test npm run db:migrate
  ```
- **End-to-end tests** (`tests/e2e`): public pages and access control run anywhere. The full journey (staff creates and publishes a job, candidate uploads a resume and applies, staff opens the case file and downloads the resume, the status update is visible to the candidate) needs a seeded environment with real Supabase and these variables: `E2E_STAFF_EMAIL`, `E2E_STAFF_PASSWORD`, `E2E_CANDIDATE_EMAIL`, `E2E_CANDIDATE_PASSWORD`.

---

## Deployment (Vercel + Supabase)

1. Create the Supabase project and apply the [configuration above](#supabase-configuration-required).
2. Import the repo into Vercel and set every variable from `.env.example` (Production and Preview). Set `NEXT_PUBLIC_SITE_URL` to the production URL, and `CRON_SECRET` to a long random string.
3. Run migrations from CI or your machine before (or as part of) each release: `DIRECT_URL=... DATABASE_URL=... npm run db:migrate`. Then run `npm run db:seed` without `SEED_DEMO_PASSWORD`. On a database that already has jobs, this only syncs roles and permissions.
4. `npm run setup:storage` once per environment.
5. `npm run create-super-admin -- owner@company.com "First" "Last" "Initial-Password1"` (password: at least 10 characters with a letter and a number). Further staff are created from Admin → Users.
6. `vercel.json` schedules `/api/cron/cleanup-uploads` daily. It removes uploads never attached to a profile or application (interrupted uploads or failed submissions).

**Production checklist:**

- [ ] Custom SMTP (required for sign-up codes to reach candidates)
- [ ] Email templates updated (Confirm signup contains `{{ .Token }}`)
- [ ] Redirect URLs set (`/auth/confirm`, `/auth/callback`)
- [ ] Google provider enabled with the production OAuth client
- [ ] Database backups / PITR enabled
- [ ] `SEED_DEMO_PASSWORD` unset
- [ ] Privacy notice reviewed by counsel (`src/app/(public)/privacy/page.tsx`)

---

## Architecture

A modular monolith. Business logic lives in `src/modules/*`. Pages and actions stay thin.

```text
src/
├── app/
│   ├── (public)/            homepage, /jobs, /jobs/[jobId], /jobs/[jobId]/apply, auth pages, /privacy
│   ├── candidate/           dashboard, applications, profile (requires a candidate session)
│   ├── admin/(auth)/        /admin/login, /admin/forbidden
│   ├── admin/(portal)/      jobs (+ add-candidate), case-files (job folders → application folders), applications, candidates,
│   │                        search, users, roles
│   ├── auth/                /auth/confirm (email links), /auth/google + /auth/callback (Google sign-in), /auth/signout
│   └── api/                 /api/documents/[id] (secure download), /api/cron/cleanup-uploads
├── components/              ui/ (design system), forms/, jobs/, candidates/, applications/, documents/, admin/, layout/
├── modules/
│   ├── access-control/      permissions & built-in roles, staff context, job scoping, user and role admin
│   ├── auth/                session guards, candidate provisioning, login/register/reset actions
│   ├── jobs/ candidates/ applications/ case-files/ documents/ search/
│   │                        each module: schemas.ts (Zod, shared), service.ts/queries.ts (server), actions.ts (Server Actions)
├── lib/                     prisma, supabase clients, env, formatting, validation helpers, rate limiting
└── config/                  site/contact info, US states & CA provinces, enum labels
prisma/                      schema.prisma, migrations/, seed.ts
scripts/                     setup-storage.ts, create-super-admin.ts, supabase-admin.ts (Node 20 WebSocket shim)
tests/                       unit/, integration/, e2e/
```

**Request flow:**

1. Middleware refreshes the Supabase session and redirects anonymous users away from `/admin` and `/candidate`.
2. Every page, server action and route handler then authorizes on the server with `requireStaff(permission)`, `requireStaffForAction(...)` or `requireCandidate()`.
3. Record-level scope is applied as Prisma `where` clauses (`jobScopeWhere`, `applicationScopeWhere`).

---

## Key design decisions

### Display IDs

`MIG-JOB-000001`, `MIG-CAN-…`, `MIG-APP-…`, `MIG-CF-…`, `MIG-FLD-…`, `MIG-CLI-…` are column defaults backed by Postgres sequences (`mig_next_display_id`):

- They are concurrency-safe, with a unique index as a backstop.
- They grow past 999999 without truncating.
- Internal primary keys are UUIDs.

### Case files

Case files and folders are rows linked by foreign keys: Job → CaseFile (1:1) → CaseFolder (1 per application) → Documents. The folder tree is virtual. Files live in one private bucket under `documents/<year>/<documentId>/<name>`.

### Atomic writes

- Job creation and its case file are one nested write.
- Application creation, its folder, the initial status history entry and document activation are one transaction.
- The unique `(candidate_id, job_id)` constraint makes duplicate applications impossible, even with concurrent double-submits.

### Uploads

1. The browser asks the server for a short-lived **signed upload URL**, and the server records a `PENDING` document.
2. The browser uploads directly to Storage, so large files never pass through Vercel.
3. On submit, the server verifies:
   - ownership,
   - the actual size (10 MB max),
   - and the **content signature** (a real PDF, DOCX, PNG or JPG).
4. Documents are activated inside the database transaction.
5. The daily cron deletes anything left `PENDING` for more than 24 hours.

### Application history is immutable

- Each application stores a JSON **snapshot** of the candidate profile and its **own copy** of the resume.
- Profile edits or a new default resume never change past applications.

### Downloads

`/api/documents/[id]` authorizes the request and redirects to a 60-second signed URL.

### Access control

- Roles map to permissions (`src/modules/access-control/permissions.ts`), which are synced to the database by the seed.
- **Permissions (18):**
  - Jobs: `job.view_all`, `job.create`, `job.edit`, `job.publish`, `job.close`
  - Candidates: `candidate.view`, `candidate.add`, `candidate.edit`
  - Applications: `application.view`, `application.create` (add candidates to jobs), `application.update_status`, `application.assign`, `application.note`
  - Case files and documents: `case_file.view`, `document.view` (open and download resumes)
  - Administration: `user.manage`, `role.manage`, `role.delete` (delete unused custom roles; built-in roles cannot be deleted)
- **Staff users** are created directly in Admin → Users, with an initial password set by the admin; there are no invitation emails. Admins can set a new password on a user's page, and deactivating a user blocks their login immediately.
- Without `job.view_all`, staff only see jobs they created or are the assigned recruiter for (and those jobs' applications and case files).
- The candidate talent pool is visible to everyone with `candidate.view`, but a candidate's applications are filtered by job scope.
- Guards:
  - The Super Admin role is locked.
  - At least one active Super Admin must always exist.
  - Only Super Admins can grant Super Admin.
  - Deactivation also bans the user in Supabase Auth.
  - Staff sessions expire after `STAFF_SESSION_MAX_HOURS` (12 by default).

### What candidates see

- Statuses are mapped to candidate-facing labels: "Submitted to Client" shows as "Shortlisted" and "Rejected" as "Not Selected".
- Internal notes, status history and recruiter assignments never reach the portal.

### Duplicate candidates

- Email is unique and is the primary matching signal.
- A candidate who registers with the verified email of an existing internal profile is linked to that profile instead of getting a duplicate.
- Recruiters creating a profile with the same phone number or name as an existing one must confirm it is a different person.

### Search

- A keyword box uses weighted full-text search over names, titles, skills, employer, education, certifications and locations.
- Structured filters use indexed columns and skill joins. All listed skills must match.
- Application filters (status, job, applied date) match on the same in-scope application.

### Rate limiting

A Postgres fixed-window counter (no Redis) covers sign-in, registration, password reset, applications and uploads. Sign-in counts **failed** attempts only (10 per email and 50 per IP per 15 minutes), so an office sharing one IP is never locked out by normal use.

### Time zones

- All timestamps are stored as `timestamptz` (UTC).
- The browser reports its time zone in a cookie, so server-rendered dates use the viewer's local time.
- Deadlines are calendar dates, open through the end of that day in Pacific Time.

---

## Assumptions and scope notes

- **Countries:** jobs are limited to the United States and Canada. Candidates may be located elsewhere (country "Other", with international phone numbers).
- **Work authorization:** only a country and a general status are collected. No immigration documents or ID numbers.
- **Internal candidates:** a portal login is never created automatically. Recruiters must record a consent or representation basis when adding a candidate to a job.
- **Removed by request:** client management, the audit log and in-app privacy requests (migration `20261104000000_remove_clients_audit_privacy`), recruitment groups (migration `20261105000000_remove_groups`), and the built-in Candidate role (migration `20261106000000_remove_candidate_role`; candidates are identified by their account type, which is what keeps them out of the admin portal). Jobs are no longer linked to a client. Candidates send access, correction or deletion requests to the privacy email shown on the privacy notice, and staff handle them manually. The included privacy notice is a template and does not establish legal compliance (PIPEDA, Quebec Law 25, provincial PIPA, US state laws).
- **Out of scope by design:** AI screening or ranking, workflow builders, duplicate-merge tooling, extra search infrastructure.
- **Dependency advisories (at time of writing):** `npm audit` reports issues only in build-time or dev tooling (PostCSS bundled inside Next's build, Prisma CLI's config loader, ESLint's `minimatch`). None of these ship in the runtime bundle.
