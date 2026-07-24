# Progress Tracker

Update this file after every completed feature. Any AI agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 2 — Profile Page
**Last completed:** 06 Profile Save Logic
**Next:** 07 AI Profile Extraction from Resume

---

## Progress

### Phase 1 — Foundation

- [x] 01 Homepage
- [x] 02 Auth
- [x] 03 PostHog Initialization
- [x] 04 Database Schema

### Phase 2 — Profile Page

- [x] 05 Profile Page — Full UI
- [x] 06 Profile Save Logic
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
- **02 Auth — deferred** — Server-side InsForge access for agent API routes remains deferred to Feature 10. Profile mutations (Feature 06) use the browser SDK session instead.
- **03 PostHog** — Client initialized via `instrumentation-client.ts` (Next.js 16 hook) with `/ingest` reverse proxy in `next.config.ts`. User identity wired in `AuthProvider` (`identify` on session load, `reset` on sign-out). Custom events: auth funnel (`sign_in_started`, `sign_in_failed`, `user_signed_in`, `user_signed_out`), marketing CTAs (`cta_clicked`, `navbar_cta_clicked`), and `dashboard_viewed`. Env vars: `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`.
- **02 Auth — manual prerequisite** — Google and GitHub OAuth providers must be enabled in the InsForge dashboard with `http://localhost:3000/callback` in `allowedRedirectUrls` before OAuth works end to end.
- **04 Database Schema — migration file** — Version-controlled SQL at `insforge/migrations/001_initial_schema.sql`; applied via InsForge MCP `run-raw-sql`. No `BEGIN/COMMIT` wrapping (InsForge handles transactions).
- **04 Database Schema — RLS pattern** — All four tables use `FOR ALL TO authenticated` with subquery `(SELECT auth.uid())` for performance. Profiles uses `id = auth.uid()`; other tables use `user_id = auth.uid()`.
- **04 Database Schema — storage** — Private `resumes` bucket (not public). Storage RLS on `storage.objects` scopes by `bucket = 'resumes'` and `(storage.foldername(key))[1] = auth.uid()::text`. Upload path convention: `{user_id}/resume.pdf`. InsForge uses `bucket`/`key` columns (not `bucket_id`/`name`).
- **04 Database Schema — signup trigger** — `SECURITY DEFINER` trigger `on_auth_user_created` on `auth.users` auto-inserts a stub `profiles` row (id + email + is_complete=false) on signup.
- **04 Database Schema — tailored fields excluded** — Build plan mentions "tailored fields" on jobs table but resume tailoring is out of scope per `project-overview.md`; `architecture.md` has no tailored columns. Excluded.
- **04 Database Schema — types** — TypeScript types at `types/index.ts` mirror all four tables plus `CompanyResearch` dossier shape (9 fields from Feature 13). `Profile.education` is `Partial<Education>` because new rows default to `{}`.
- **04 Database Schema — follow-up (002)** — `002_harden_schema.sql` hardens signup trigger with `ON CONFLICT`, backfills profiles for pre-trigger auth users. Bootstrap docs in `insforge/migrations/README.md`.
- **04 Database Schema — server writes** — Superseded by Feature 06: profile writes use the browser SDK. Agent API routes (Feature 10) still need a server JWT pattern.
- **04 Database Schema — storage docs aligned** — `architecture.md` / `build-plan.md` / `library-docs.md` now use bucket `resumes` + key `{user_id}/resume.pdf` (matches storage RLS).
- **05 Profile Page — UI only** — Built to `context/designs/profile.png` with mock data + local React state. No InsForge save/upload (Feature 06). Save / Select Resume / Generate buttons are visual stubs.
- **05 Profile Page — AppNavbar** — App shell uses `AppNavbar` (logo + Dashboard / Find Jobs / Profile). Active link uses accent color + purple underline (design override of ui-rules “no underline”). Marketing `Navbar` unchanged.
- **05 Profile Page — Cover Letter Tone omitted** — Field exists on `Profile` type / DB but is not shown in the PNG; deferred to Feature 06 wiring.
- **05 Profile Page — Email read-only** — Disabled input; auth-owned. Job titles seeking / preferred locations are free-text comma fields in the UI (arrays on save later).
- **05 Profile Page — UI primitives** — Lightweight token-based `components/ui/*` (Button, Input, Select, Textarea, Label, Card, Tag). shadcn not installed yet.
- **05 Profile Page — Completion** — `lib/profile-completion.ts` computes % + missing tags. Mock profile yields 70% with PHONE / LOCATION / EDUCATION missing.
- **06 Profile Save — browser SDK writes** — Resolved Feature 02 deferral: `/profile` loads/saves via `lib/profile.ts` using the authenticated browser `insforge` client (RLS via session JWT). No Server Action / `@insforge/sdk/ssr` for profile. `is_complete` derived from `getProfileCompletion` (no DB columns for %/missing tags). Resume upload: PDF ≤5MB to `resumes` at `{user_id}/resume.pdf`, persist returned `data.url`. Cover letter tone still omitted from UI (unchanged on save). `profile_completed` fires when save flips incomplete→complete. Generate Resume remains Feature 08 stub.
- **06 Profile Save — review hardening** — Vitest unit tests for profile/auth/storage helpers (`npm test`). AuthProvider preserves session only on transient errors (timeout/network); clears on auth rejection. Resume replace uploads first then removes stale prior keys (never delete-before-upload). Save uses auth email for completion; LinkedIn/portfolio require http(s) URLs; comma-list fields re-sync after save without clobbering mid-edit; resume feedback via Sonner toasts.
- **06 Profile Save — view/download resume** — When `resume_pdf_url` is set, `/profile` shows an authenticated inline PDF preview (`fetchResumeBlob` → blob URL iframe) with Expand (modal) and Download. Blobs are normalized to `application/pdf` so the browser renders instead of downloading an untyped UUID file.

---



## Notes

*Add notes here as the build progresses — workarounds, patterns, anything that differs from the context files.*