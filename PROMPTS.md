# TrustVault prompt and review log

Use this file to record significant implementation prompt iterations and the review work performed before a change is accepted. Keep credentials and personal data out of this log.

## Entry template

### Iteration: YYYY-MM-DD — short change summary

- **Prompt / requirement:** What behavior was requested?
- **Implementation:** Files, decisions, and security boundaries changed.
- **AI-generated flaws found:** Incorrect assumptions, bugs, insecure patterns, or unsupported claims identified during review. Write `None identified` only after review.
- **Corrections:** What was changed to fix those flaws?
- **Validation:** Commands and results (typecheck, lint, tests, build, migration review).
- **Follow-up risks:** Remaining work or deployment assumptions.

## Initial implementation record

### Iteration: 2026-10-23 — TrustVault application scaffold

- **Prompt / requirement:** Build a multi-tenant document-sharing platform with Next.js 14, TypeScript, PostgreSQL/Prisma, NextAuth, RBAC, targeted sharing, time-bound grants, revocation, secure viewing, audit records, and setup/security documentation.
- **Implementation:** Added App Router pages, credentials authentication with organization slug, PostgreSQL data models, server actions, server-side role checks, private local file storage, HMAC viewer links, shadcn-style Tailwind UI components, and threat/setup documentation.
- **AI-generated flaws found:** The initial Next.js 14.2.21 pin had a security advisory; it was upgraded to 14.2.35. Typecheck found result-message narrowing issues and lint found unescaped apostrophes; both were corrected. Review also identified the need to keep role checks live rather than trusting JWT role claims, and to avoid associating cross-tenant guessed document IDs with a tenant's audit relation.
- **Corrections:** Upgraded to the latest available Next.js 14 patch, reread live membership/role data for server guards, constrained denied-access audit associations, and added a database trigger rejecting audit-log updates/deletes.
- **Validation:** `npx prisma format`, `npx prisma validate`, `npx prisma generate`, `npm run typecheck`, `npm run lint`, and `npm run build` completed successfully on the original Next.js 14 scaffold. The pre-upgrade audit reported framework and transitive dependency vulnerabilities.
- **Follow-up risks:** Initial-password delivery is out of band; local filesystem storage requires a durable private volume; DB trigger immutability depends on restricting the runtime DB role from altering it.

### Iteration: 2026-10-23 — Upgrade to Next.js 16.4.3

- **Prompt / requirement:** Upgrade the platform to Next.js 16.4.3 to address the previously identified framework advisory.
- **Implementation:** Upgrade Next.js and its matching ESLint config, React and React DOM to 19, React type packages, ESLint 9, and supported PostCSS; adjust server action configuration and lint command for Next.js 16.
- **AI-generated flaws found:** The first build exposed Next.js 16's async route params and async request-header APIs; these were updated. Build tracing warned about the runtime-configured private filesystem paths; explicit Turbopack ignore annotations were added for those dynamic file accesses.
- **Corrections:** Upgraded to Next.js 16.4.3, React/React DOM 19.3.1, React types 19, ESLint 9 flat config, and PostCSS 8.5.31; updated the `serverActions` config location, route params, and async header handling.
- **Validation:** `npm run typecheck`, `npm run lint`, and `npm run build` pass. `npx prisma validate` and `npx prisma generate` pass. `npm audit --omit=dev` reports zero vulnerabilities. Full `npm audit` reports three moderate development-only Tailwind 3 / PostCSS selector-parser advisories.
- **Follow-up risks:** Node.js 20.9+ is required; initial-password delivery is out of band; local filesystem storage requires a durable private volume; DB trigger immutability depends on restricting the runtime DB role from altering it.

### Iteration: 2026-10-24 — Migrate Tailwind to version 4

- **Prompt / requirement:** Continue resolving development dependency advisories by migrating the Tailwind 3 toolchain to Tailwind 4.
- **Implementation:** Upgrade Tailwind CSS and `tailwind-merge`, switch to `@tailwindcss/postcss`, and move custom design tokens into the CSS-first theme.
- **AI-generated flaws found:** The legacy Tailwind config and `@tailwind` directives are not the CSS-first Tailwind 4 setup; the PostCSS plugin and theme tokens were migrated together.
- **Corrections:** Installed `@tailwindcss/postcss` 4.3.3 and Tailwind 4.3.3, upgraded `tailwind-merge` to 3.7.0, moved theme tokens to `@theme`, removed the unused Tailwind 3 config, and updated the shadcn config.
- **Validation:** `npm run typecheck`, `npm run lint`, `npm run build`, and full `npm audit` pass; audit reports zero vulnerabilities. Production-server smoke tests verified `/login` and `/register` (HTTP 200), NextAuth providers and CSRF endpoints, and the document viewer's unauthenticated 401 response. Compiled CSS contains the custom brand, text, and shadow utilities.
- **Follow-up risks:** Node.js 20.9+ is required; initial-password delivery is out of band; local filesystem storage requires a durable private volume; DB trigger immutability depends on restricting the runtime DB role from altering it. Database-backed acceptance is not yet verified because this workspace has no `.env`, reachable local PostgreSQL server, or Docker runtime.

### Iteration: 2026-10-24 — Provide reproducible local PostgreSQL setup

- **Prompt / requirement:** Fix the missing local database setup blocking end-to-end acceptance testing.
- **Implementation:** Added a Docker Compose PostgreSQL 17 service with a localhost-only port, persistent volume, health check, and required environment variables; connected the sample `.env` variables to the database URL and documented setup/cleanup.
- **AI-generated flaws found:** The machine has no PostgreSQL binaries/service, Docker executable, Compose runtime, or existing `.env`; no in-place database could be safely started.
- **Corrections:** Added a repeatable project-owned database setup that users can run once Docker Compose is available, and documented that the local volume persists unless explicitly removed.
- **Validation:** Configuration files and docs reviewed; re-run project lint/typecheck/build/audit below. Live Compose startup and database migration are blocked because Docker is unavailable in this environment.
- **Follow-up risks:** Install/start Docker Desktop or provide a reachable PostgreSQL database; configure `.env`, apply migrations, and run the documented database-backed acceptance flows.

### Iteration: 2026-10-24 — Verify PostgreSQL-backed acceptance flows

- **Prompt / requirement:** Resume work, fix remaining blockers, and complete the project's practical end-to-end checks.
- **Implementation:** Started a local PostgreSQL 17.8 installation, applied the checked-in Prisma migration, and exercised real registration/login, upload/private viewing, explicit user sharing, expiry, revocation, tenant isolation, and audit behavior. Updated this README with the verified setup and acceptance status.
- **AI-generated flaws found:** The previous setup documentation incorrectly stated that no database-backed acceptance testing had been performed. The first browser check exposed Next.js 16's asynchronous `searchParams` requirement in the Sharing page. The final full dependency audit also identified a newly disclosed high-severity Zod 3 advisory.
- **Corrections:** Verified active/expired/revoked/unshared access at the viewer endpoint, including denial of a previously issued signed link after revocation. Exercised the revoke button in the browser; its success notification and revoked row appeared, and the database recorded the REVOKE audit event. Updated the Sharing page to await `searchParams`. Verified database-level rejection of audit-row updates. Invalidated the temporary QA viewer's password and removed the named temporary source/token files. Retained the QA account, revoked share, and test document because the immutable audit trigger prevents deleting referenced records without violating audit integrity. Upgraded the app's Zod dependency to patched 4.6.7 and disabled Next.js's development-only generated `AGENTS.md`.
- **Validation:** PostgreSQL 17.8 accepted connections; the initial Prisma migration is applied and the schema is up to date. Registration, login, upload, view, explicit share, expiry behavior, UI-driven revocation, post-revocation denial, cross-document/cross-tenant denial, denied-access audit events, and audit immutability were exercised. After the Zod upgrade and async API fix, `npm run typecheck`, `npm run lint`, `npm run build`, `npx prisma migrate status`, and `npm audit` pass; the full dependency audit reports zero vulnerabilities. The local dev server responds HTTP 200 at `/login`.
- **Follow-up risks:** The local filesystem adapter is single-instance only. A production deployment still needs a chosen host, production secrets, managed PostgreSQL, durable private shared storage, backup/restore configuration, and deployment-appropriate rate limiting and malware scanning. Fresh environments need PostgreSQL and local environment variables; the committed Compose configuration is the documented path. The append-only audit policy intentionally retains related QA records.

### Iteration: 2026-10-24 — Prepare serverless production services

- **Prompt / requirement:** Prepare and deploy TrustVault to Vercel with private document storage, rate limiting, ClamAV scanning, and Supabase PostgreSQL.
- **Implementation:** Added the Vercel Blob private-storage adapter and short-lived authenticated client-upload endpoint, moved Vercel uploads out of Server Actions to respect the 4.5 MB function request limit, and verify downloaded Blob bytes before scan and DB registration. Added fail-closed Upstash sliding-window limits to registration, sign-in, and upload flows, plus an HTTPS bearer-authenticated ClamAV bridge client that rejects non-clean and unavailable results. Added a Render Docker bridge using ClamAV's INSTREAM protocol, bounded request/concurrency handling, and a health endpoint; updated its client contract to raw `application/octet-stream`. Added Supabase pooled/direct URL support, deployment environment templates, production instructions, rate-limit policies, and a release migration command.
- **AI-generated flaws found:** The initial storage plan used server-side upload through a Server Action, which cannot reliably accept the existing 10 MB limit on Vercel. Current Vercel Blob releases also introduced transitive audit advisories, so the patched compatible 2.4.0 release was selected and pinned. A live Vercel deployment cannot proceed because the CLI reports logged out and no project or production provider credentials are configured. The provided `http://localhost:3000` value is the local app URL, not a remotely reachable ClamAV scanning service.
- **Corrections:** Use authenticated direct-to-private-Blob uploads, scope upload token paths to the current organization, restrict MIME types and file size in the token, revalidate actual stored bytes and scan before creating the document record, and remove failed uploads. Rate-limit service outages and scanner failures fail closed in production. Add Supabase `DATABASE_URL` pooling and `DIRECT_URL` migration support. Document the Render bridge provisioning steps and remaining account linking, database, Blob, and Upstash setup instead of claiming a completed deployment.
- **Validation:** `npm install`/lockfile update completed. `npm run typecheck`, `npm run lint`, full `npm audit` (zero vulnerabilities), `npm run build`, Prisma validation/migration status, and `npm run db:deploy` pass. Production smoke tests returned HTTP 200 for `/login`, `/register`, NextAuth provider/CSRF routes, and HTTP 401 for an unauthenticated direct-upload token request. The bridge was syntax/lint checked and exercised against a mock ClamAV TCP daemon for health, unauthorized and invalid-content-type rejection, clean/infected responses, oversized-body rejection, and daemon outage. Docker is unavailable locally, so the image itself has not been built. Vercel CLI `whoami` reports logged out; no live provider requests were made.
- **Follow-up risks:** Vercel authentication/project linking, a Supabase project and migration run, private Blob store/token, Upstash Redis, and a deployed HTTPS ClamAV bridge are required before production deployment. The Render Blueprint has not been provisioned and may incur charges. Abandoned uploads can leave unreferenced private Blobs, which require operational cleanup/retention.
