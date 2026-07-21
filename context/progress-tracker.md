# Progress Tracker

Update this file after every completed feature. Any AI agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 1 — Foundation
**Last completed:** 04 Database Schema
**Next:** 05 Profile Page — Full UI

---

## Progress

### Phase 1 — Foundation

- [x] 01 Homepage
- [x] 02 Auth
- [x] 03 PostHog Initialization
- [x] 04 Database Schema

### Phase 2 — Profile Page

- [ ] 05 Profile Page — Full UI
- [ ] 06 Profile Save Logic
- [ ] 07 AI Profile Extraction from Resume
- [ ] 08 Resume PDF Generation from Profile



### Phase 3 — Find Jobs Page

- [ ] 09 Find Jobs Page — Full UI
- [ ] 10 Adzuna Job Discovery
- [ ] 11 Filter + Sort + Pagination



### Phase 4 — Job Details Page

- [ ] 12 Job Details Page — Full UI
- [ ] 13 Company Research Agent



### Phase 5 — Dashboard

- [ ] 14 Dashboard Page — Full UI
- [ ] 15 Stats Bar — Real Data
- [ ] 16 Recent Activity — Real Data
- [ ] 17 Analytics Charts — PostHog Data

---



## Decisions Made During Build

- **01 Homepage** — `public/` had no images, so the dashboard, jobs table, and agent-run previews are recreated as CSS/HTML mockups (not screenshots), matching the design.
- **Marketing CTA style** — Per the design, the primary marketing button ("Get Started" / "Start for free") is dark (`bg-overlay-dark`), not the app's purple primary button from `ui-rules`. The purple primary spec still applies to in-app buttons.
- **CTA routing** — All marketing CTAs link to `/login` for now; the auth-aware redirect (logged-in → `/dashboard`) will be wired in Feature 02.
- **Root layout** — Switched fonts from Geist to Inter (`next/font/google`, `variable: "--font-sans"`) per `ui-rules`; set real page `metadata`.
- **tsconfig** — Excluded gitignored tooling folders (`ECC`, `.claude`, `.cursor`, `graphify-out`) from TypeScript so `next build` type-checks only app code (an ECC skill sample was breaking the build).
- **02 Auth — SDK reality vs docs** — The context files assumed a Supabase-style `@insforge/ssr` package (`createBrowserClient`/`createServerClient`, cookie SSR, `insforge.from(...)`). That package does not exist. Built against the real `@insforge/sdk` (browser-first: `createClient`, `auth.signInWithOAuth`, `auth.getCurrentUser`, `auth.signOut`, `insforge.database.from(...)`). `@insforge/react` is deprecated, so auth state uses a custom `AuthProvider`/`useUser()` context instead. `architecture.md`, `library-docs.md`, and `code-standards.md` were updated to match.
- **02 Auth — route protection** — Client-side via `AuthGuard` (`useUser()` redirect to `/login`). No `middleware.ts` — the browser-first SDK has no server cookie helper.
- **02 Auth — OAuth callback** — `/callback` relies on the SDK auto-detecting `insforge_code` (surfaced through `getCurrentUser()` in `AuthProvider`), then redirects to `/dashboard`.
- **02 Auth — temp dashboard** — `app/dashboard/page.tsx` is a temporary `AuthGuard`-wrapped placeholder (shows user email + Sign out) so the auth loop is testable now; replaced by Feature 14.
- **02 Auth — deferred** — Server-side InsForge access (user-scoped DB writes in Server Actions/API routes) is undecided; resolve in Feature 06.
- **03 PostHog** — Client initialized via `instrumentation-client.ts` (Next.js 16 hook) with `/ingest` reverse proxy in `next.config.ts`. User identity wired in `AuthProvider` (`identify` on session load, `reset` on sign-out). Custom events: auth funnel (`sign_in_started`, `sign_in_failed`, `user_signed_in`, `user_signed_out`), marketing CTAs (`cta_clicked`, `navbar_cta_clicked`), and `dashboard_viewed`. Env vars: `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`.
- **02 Auth — manual prerequisite** — Google and GitHub OAuth providers must be enabled in the InsForge dashboard with `http://localhost:3000/callback` in `allowedRedirectUrls` before OAuth works end to end.
- **04 Database Schema — migration file** — Version-controlled SQL at `insforge/migrations/001_initial_schema.sql`; applied via InsForge MCP `run-raw-sql`. No `BEGIN/COMMIT` wrapping (InsForge handles transactions).
- **04 Database Schema — RLS pattern** — All four tables use `FOR ALL TO authenticated` with subquery `(SELECT auth.uid())` for performance. Profiles uses `id = auth.uid()`; other tables use `user_id = auth.uid()`.
- **04 Database Schema — storage** — Private `resumes` bucket (not public). Storage RLS on `storage.objects` scopes by `bucket = 'resumes'` and `(storage.foldername(key))[1] = auth.uid()::text`. Upload path convention: `{user_id}/resume.pdf`. InsForge uses `bucket`/`key` columns (not `bucket_id`/`name`).
- **04 Database Schema — signup trigger** — `SECURITY DEFINER` trigger `on_auth_user_created` on `auth.users` auto-inserts a stub `profiles` row (id + email + is_complete=false) on signup.
- **04 Database Schema — tailored fields excluded** — Build plan mentions "tailored fields" on jobs table but resume tailoring is out of scope per `project-overview.md`; `architecture.md` has no tailored columns. Excluded.
- **04 Database Schema — types** — TypeScript types at `types/index.ts` mirror all four tables plus `CompanyResearch` dossier shape (9 fields from Feature 13). `Profile.education` is `Partial<Education>` because new rows default to `{}`.
- **04 Database Schema — follow-up (002)** — `002_harden_schema.sql` hardens signup trigger with `ON CONFLICT`, backfills profiles for pre-trigger auth users. Bootstrap docs in `insforge/migrations/README.md`.
- **04 Database Schema — server writes** — Feature 06 will use `@insforge/sdk/ssr` (or JWT-forwarding) so RLS continues to scope server/agent writes to `auth.uid()`.
- **04 Database Schema — storage docs aligned** — `architecture.md` / `build-plan.md` / `library-docs.md` now use bucket `resumes` + key `{user_id}/resume.pdf` (matches storage RLS).

---



## Notes

*Add notes here as the build progresses — workarounds, patterns, anything that differs from the context files.*