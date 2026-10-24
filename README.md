# TrustVault

**Secure sharing, Smarter Access, Verifiable Accountability**

TrustVault is a multi-tenant document-sharing application built with Next.js 16 App Router, TypeScript, Tailwind CSS 4, shadcn-style UI primitives, Prisma, PostgreSQL, and NextAuth.js. It provides organization-scoped accounts, role-based permissions, private file storage, targeted user sharing, expiring grants, immediately revocable access, and an append-only application audit trail.

## Features

- New organization registration creates its first `ADMIN` account. Sign-in requires the organization slug as well as the email and password, avoiding ambiguous cross-tenant identities.
- Admins provision `MANAGER` and `VIEWER` accounts from Settings. Initial passwords are created by the admin and must be delivered out of band.
- `ADMIN` and `MANAGER` can upload and manage documents throughout their organization. A document owner can share that document. `VIEWER` can view documents they own or that have been explicitly shared with them.
- Sharing targets one existing user in the same organization. A grant can have an optional expiry and can be revoked; the viewer checks the current database grant on every request, including requests made using a still-unexpired signed link.
- Local development stores files outside the public web root. Vercel deployments use private Vercel Blob storage and authenticated direct-to-Blob uploads, so files up to 10 MB do not exceed Vercel's serverless request-body limit. The viewer rechecks authorization and fetches private content server-side.
- Production uploads are verified against the supported file signatures and sent to a configured ClamAV HTTP bridge; upload fails closed when scanning is unavailable or reports infection.
- Production registration, credential sign-in, and document uploads use Upstash Redis rate limits. Missing or unavailable Redis blocks those operations in production.
- Upload, view, share, revoke, membership, role-change, login, registration, and denied-access events are recorded with user/document identifiers where available, timestamp, observed request IP, status, and details.

## Requirements

- Node.js 20.9+ (Node 22 LTS recommended)
- npm
- PostgreSQL 14+

## Local setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create a PostgreSQL database and copy `.env.example` to `.env`. Set `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_URL`, and two independent random secrets (at least 32 characters) for `NEXTAUTH_SECRET` and `VIEWER_LINK_SECRET`. For local PostgreSQL, the two database URLs can be the same.

   For local development, the included Compose file runs an isolated PostgreSQL 17 service with a persistent Docker volume:

   ```sh
   Copy-Item .env.example .env
   ```

   Edit `.env` and replace `POSTGRES_PASSWORD`, `NEXTAUTH_SECRET`, and `VIEWER_LINK_SECRET`. Use hexadecimal values for the database password so it does not need URL encoding in `DATABASE_URL`. You can generate a development database password with:

   ```sh
   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
   ```

   Then start the database and wait until its health check passes:

   ```sh
   docker compose up -d --wait db
   ```

   Docker Desktop (or another Docker Compose v2 runtime) must be installed and running. The database port is bound to localhost only. Stop the service without deleting its data with `docker compose stop db`; `docker compose down -v` permanently deletes the local database volume.

   Generate secrets with:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

3. Generate the Prisma client and apply the schema to a new development database:

   ```sh
   npm run db:generate
   npm run db:migrate
   ```

   The checked-in initial migration also installs a PostgreSQL trigger that rejects audit-row updates and deletes. Deploy committed migrations in production with `npx prisma migrate deploy`; do not use `db:push` where the trigger is required.

4. Start the app:

   ```sh
   npm run dev
   ```

5. Visit `http://localhost:3000/register` to create the first organization and administrator. The workspace slug is available under Settings and required when signing in.

## Production deployment checklist

- **Free-tier operation:** The app can run without a malware scanner, but production document uploads are intentionally disabled and the documents page tells managers why. The upload-token API rejects requests before creating a Blob upload token. Existing documents remain viewable and shareable. Do not send confidential files to an unrelated public scanning API as a substitute. The included ClamAV Blueprint uses Render's free web-service plan to avoid paid provisioning. Render documents free web services as unsuitable for production: they may sleep when idle, restart, lose local files, and be suspended at free-usage limits. ClamAV may also exceed the free instance's memory. Do not enable sensitive document uploads on this service unless it passes the scanner, health, reliability, and resource checks required by your threat model.
- **Framework security:** Next.js is pinned to 16.4.3. Run `npm audit` before deployment and keep the framework on a supported patched release.
- `npm audit --omit=dev` reports no production dependency vulnerabilities. Tailwind 4 is configured with the `@tailwindcss/postcss` plugin and CSS-first theme tokens.
- Use HTTPS and secure production values for both secrets. Do not reuse the same secret for sessions and viewer links.
- Vercel requires private object storage; the local filesystem adapter is only for development. Browser uploads use short-lived Vercel Blob client tokens, tenant-scoped random pathnames, and a private store. The server verifies the stored bytes, scans them, and only then creates the tenant-scoped document record. Never switch the store to public.
- Use Supabase PostgreSQL with its transaction-pooler URL as `DATABASE_URL` (include `pgbouncer=true` and `connection_limit=1`) and the direct database URL as `DIRECT_URL`; keep SSL enabled. Configure backups and restore testing. Apply checked-in migrations with `npm run db:deploy` from a trusted release environment before promoting the deployment. Do not run schema migrations from a parallel build worker.
- Connect a **private** Vercel Blob store to the Vercel project and set `TRUSTVAULT_STORAGE_PROVIDER=vercel-blob`. Vercel's integration supplies `BLOB_READ_WRITE_TOKEN`; this long-lived token must remain a server-only Vercel secret.
- Create an Upstash Redis database and configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Rate limits are 5 registrations/hour/IP, 20 sign-in attempts/15 minutes/IP, 8 sign-in attempts/15 minutes/email, and 10 upload tokens/10 minutes/user and IP. Limits fail closed if Redis is misconfigured or unavailable.
- Deploy a trusted ClamAV HTTP bridge separately from the Vercel app. Set `CLAMAV_SCAN_URL` to its HTTPS `/scan` endpoint and `CLAMAV_SCAN_TOKEN` to an independent random value of at least 32 characters. The service contract is `POST application/octet-stream` with file bytes in the raw body, `Authorization: Bearer …`, and JSON `{"status":"clean"}` or `{"status":"infected"}`. Non-2xx, malformed responses, timeouts, and missing configuration reject the upload. The bridge must run ClamAV and must not return `clean` until the full file has been scanned.
- Configure `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `VIEWER_LINK_SECRET`, database credentials, Blob credentials, Upstash credentials, and ClamAV bridge credentials in Vercel's encrypted environment settings; never commit or paste secret values into this repository or chat.
- Vercel terminates HTTPS and supplies request forwarding headers; the audit trail records the app-observed IP. Retain request-size limits at 10 MB and configure backups, retention, monitoring, incident response, and any organization-specific policy.
- Membership accounts use administrator-provisioned initial passwords. A production identity rollout should add a secure password reset/rotation flow or connect an enterprise identity provider before onboarding external users.
- The initial migration blocks audit-row updates/deletes with a PostgreSQL trigger. For regulatory-grade immutability, run the application with a database role that cannot alter that trigger and add external WORM archival.

## Vercel deployment preparation

The app is configured for Vercel. Within provider free-tier limits, it can run with the linked Vercel project, managed PostgreSQL database, private Blob storage, and Upstash Redis while uploads remain disabled. A free Render ClamAV service can be tested without adding a payment method, but it may sleep, restart, lose scanner database updates, or fail from memory pressure; Render does not recommend its free instances for production. Keep uploads disabled unless the scanner meets your security and availability requirements.

1. Install or run the Vercel CLI and link this folder to the intended project:

   ```sh
   npx vercel login
   npx vercel link
   ```

2. In the linked Vercel project, add a **private** Blob store. The Vercel Blob integration supplies `BLOB_READ_WRITE_TOKEN`; keep it server-only. Enable Production (and Preview/Development only if needed).
3. Create a Supabase project and configure its transaction-pooler URL as `DATABASE_URL` and direct connection URL as `DIRECT_URL`. Configure the other project environment variables from the checklist above, then apply migrations from a trusted release runner:

   ```sh
   npm ci
   npm run db:deploy
   ```

4. Create the Upstash Redis database. The included `render.yaml` uses Render's free web-service plan; it has cold starts, ephemeral storage, and resource limits and is not a production reliability guarantee. Render builds `clamav-bridge/Dockerfile`, downloads the virus database at startup, and exposes the bridge over HTTPS. Generate a unique token (for example, `openssl rand -hex 32`) and enter it as `CLAMAV_SCAN_TOKEN` in Render's service settings. Set `CLAMAV_SCAN_URL` to `https://<your-render-service>.onrender.com/scan` and set the same token as `CLAMAV_SCAN_TOKEN` in Vercel's encrypted Production environment only after verifying the scanner works and is acceptable for your threat model. The bridge accepts only bearer-authenticated raw `application/octet-stream` bodies up to 10 MB. Confirm Render's `/healthz` check and test scans before enabling uploads. No payment method is required for the free plan; never upgrade the service without reviewing costs.
5. Verify the Production variables and migration state, then deploy:

   ```sh
   npx vercel --prod
   ```

   A successful build alone does not prove that database, Blob, rate-limit, and scanner integrations are reachable. Complete the post-deployment acceptance checks against the production deployment before inviting users.

## File organization

```text
prisma/
  schema.prisma                 Tenant, user, document, share, and audit models
src/
  actions/                      Validated Server Actions for auth, files, sharing, and roles
  app/
    (workspace)/                Authenticated dashboard, documents, sharing, audit, settings
    api/auth/[...nextauth]/     NextAuth credentials handler
    api/documents/[id]/view/    Signed, permission-checked file viewer endpoint
    api/documents/upload/       Authenticated, rate-limited private Blob token endpoint
    login/ register/            Public authentication pages
  components/                   Page-specific UI, forms, viewer, audit and shadcn-style primitives
  lib/
    auth.ts                     NextAuth credentials and session callbacks
    auth-guard.ts               Live identity/role lookup
    audit.ts                    Append-only event creation and observed IP helper
    prisma.ts                   Shared Prisma client
    storage.ts                  Private filesystem/Vercel Blob adapters and upload validation
    rate-limit.ts               Fail-closed Upstash sliding-window limits
    malware-scan.ts             Fail-closed ClamAV HTTP bridge client
    viewer-token.ts             Short-lived HMAC viewer tokens
  types/                        NextAuth session/JWT augmentation
.env.example                    Environment variable template
eslint.config.mjs               ESLint 9 flat config for Next.js
compose.yaml                    Local PostgreSQL development service
THREATS.md                      Threat model and mitigations
PROMPTS.md                      Prompt/review iteration log template
```

## Useful commands

```sh
npm run typecheck
npm run lint
npm run build
npm run db:studio
```

## Verification status

Local PostgreSQL acceptance flows were exercised, including browser-driven share revocation and audit verification. During the Vercel adaptation, the app gained private Blob storage, direct uploads to avoid Vercel's 4.5 MB serverless request limit, Upstash rate limiting, and a fail-closed ClamAV HTTP bridge contract. Final typecheck, lint, production build, migration status, and full dependency audit pass; the audit reports zero vulnerabilities. A live deployment has not been performed: this workspace is not linked to a Vercel project and has no configured production database, Blob store, Upstash Redis, or scanner endpoint. The Vercel CLI confirmed the workspace is logged out. Configure these services and authenticate/link the project before deployment; then execute the documented production acceptance checks before launch. The local QA account, revoked share, and test document remain as audit-linked records; its temporary password has been invalidated.

## Architecture notes

All document and membership lookups are constrained by the authenticated organization ID. Sharing stores a specific recipient user ID rather than a public URL or an organization-wide role grant. Role and membership data are read from PostgreSQL by the server authorization guard rather than trusted from possibly stale JWT role claims. Viewer URLs are short-lived, user-bound, signed capabilities, but possession of a URL alone is insufficient: the viewer also requires the matching current session and active database permission.
