# Progress Tracker

Update this file after every completed feature. Any AI agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 1 — Foundation
**Last completed:** 03 PostHog Initialization
**Next:** 04 Database Schema

---

## Progress

### Phase 1 — Foundation

- [x] 01 Homepage
- [x] 02 Auth
- [x] 03 PostHog Initialization
- [ ] 04 Database Schema

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

---



## Notes

*Add notes here as the build progresses — workarounds, patterns, anything that differs from the context files.*