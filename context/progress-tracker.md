# Progress Tracker

Update this file after every completed feature. Any AI agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 5 — Dashboard (complete)
**Last completed:** App-wide Theme Switcher (Light / Dark / System)
**Next:** —

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
- [x] 07 AI Profile Extraction from Resume
- [x] 08 Resume PDF Generation from Profile



### Phase 3 — Find Jobs Page

- [x] 09 Find Jobs Page — Full UI
- [x] 10 Adzuna Job Discovery
- [x] 11 Filter + Sort + Pagination



### Phase 4 — Job Details Page

- [x] 12 Job Details Page — Full UI
- [x] 13 Company Research Agent



### Phase 5 — Dashboard

- [x] 14 Dashboard Page — Full UI
- [x] 15 Stats Bar — Real Data
- [x] 16 Recent Activity — Real Data
- [x] 17 Analytics Charts — PostHog Data

---



## Decisions Made During Build

- **01 Homepage** — `public/` had no images, so the dashboard, jobs table, and agent-run previews are recreated as CSS/HTML mockups (not screenshots), matching the design.
- **Marketing CTA style** — Per the design, the primary marketing button ("Get Started" / "Start for free") is dark (`bg-overlay-dark`), not the app's purple primary button from `ui-rules`. The purple primary spec still applies to in-app buttons.
- **CTA routing** — Marketing “Get Started” / “Find Your First Match” go to `/login` when signed out and `/find-jobs` when signed in (homepage stays reachable; no bounce to dashboard via logo). Navbar CTA is **Get Started** → `/login` when signed out, and avatar menu (Profile + Sign out) when signed in — dashboard placeholder no longer duplicates Sign out.
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
- **05 Profile Page — AppNavbar** — App shell uses shared `Navbar` (logo → `/`, Dashboard / Find Jobs / Profile with lucide icons + active underline, CTA **Profile**). Marketing and app pages share the same chrome.
- **05 Profile Page — Cover Letter Tone omitted** — Field exists on `Profile` type / DB but is not shown in the PNG; deferred to Feature 06 wiring.
- **05 Profile Page — Email read-only** — Disabled input; auth-owned. Job titles seeking / preferred locations are free-text comma fields in the UI (arrays on save later).
- **05 Profile Page — UI primitives** — Replaced with **shadcn/ui** (`components.json`, radix-nova). JobPilot tokens remain source of truth in `app/globals.css` (`--jp-*` + `@theme`); shadcn semantic vars map onto them. Prefer shadcn primitives for all form controls (Select / Checkbox / Button) — no native `<select>` wrappers.
- **05 Profile Page — Completion** — `lib/profile-completion.ts` computes % + missing tags. Mock profile yields 70% with PHONE / LOCATION / EDUCATION missing.
- **06 Profile Save — browser SDK writes** — Resolved Feature 02 deferral: `/profile` loads/saves via `lib/profile.ts` using the authenticated browser `insforge` client (RLS via session JWT). No Server Action / `@insforge/sdk/ssr` for profile. `is_complete` derived from `getProfileCompletion` (no DB columns for %/missing tags). Resume upload: PDF ≤5MB to `resumes` at `{user_id}/resume.pdf`, persist returned `data.url`. Cover letter tone still omitted from UI (unchanged on save). `profile_completed` fires when save flips incomplete→complete. Generate Resume remains Feature 08 stub.
- **06 Profile Save — review hardening** — Vitest unit tests for profile/auth/storage helpers (`npm test`). AuthProvider preserves session only on transient errors (timeout/network); clears on auth rejection. Resume replace uploads first then removes stale prior keys (never delete-before-upload). Save uses auth email for completion; LinkedIn/portfolio require http(s) URLs; comma-list fields re-sync after save without clobbering mid-edit; resume feedback via Sonner toasts.
- **06 Profile Save — view/download resume** — When `resume_pdf_url` is set, `/profile` shows an authenticated inline PDF preview (`fetchResumeBlob` → blob URL iframe) with Expand (modal) and Download. Blobs are normalized to `application/pdf` so the browser renders instead of downloading an untyped UUID file.
- **07 AI Profile Extraction** — Extract from Resume (after upload) POSTs the PDF to `POST /api/resume/extract` with InsForge Bearer JWT (`lib/api-auth.ts`). Server uses `pdf-parse` v2 (`PDFParse` + `%PDF` magic-byte check) then Vercel AI SDK `generateObject` via OpenRouter model `openrouter/free` (response-healing). Env: server-only `OPENROUTER_API_KEYS` (multi-key failover) or `OPENROUTER_API_KEY`, plus `AI_PROVIDER`, `AI_MODEL`. Shared Resume AI Redis pool with Generate (see below). Client merges into form state via `mergeExtractedIntoProfile` (no auto-save). Success requires substantive fields (not salary-only). Provider swap + key rotation live in `lib/ai/provider.ts`.
- **08 Resume PDF Generation** — Generate Resume: client save-first dirty gate (`isProfileDirty` vs last loaded/saved baseline) then `POST /api/resume/generate` with Bearer JWT. Server loads saved `profiles` row, OpenRouter `generateObject` (temp 0.7, same `openrouter/free` + `withOpenRouterKeyFailover`) polishes summary/bullets, `@react-pdf/renderer` renders one-page A4 matching `context/templates/demo_resume.pdf` visual style. Uploads to private `resumes` at `{user_id}/resume.pdf`, updates `resume_pdf_url`; client refreshes preview. PostHog `resume_generated`. Button label **Generate Resume** + `FileText` icon (equal width with Extract).
- **Resume AI shared rate limits + usage card** — Extract + Generate + Find Jobs + Company Research share Redis key `resume-ai:{userId}`; windows from `RESUME_AI_RATE_LIMIT_PER_MINUTE|HOUR|DAY` (defaults 3/15/40). Extract/Generate: **one hit only after a successful response** (admission peeks without consuming; 429 does not increment). Find Jobs: **one hit per successful AI scoring batch** (batches of 5; admission peeks without consuming; mid-search exhaustion → skill-overlap fallback for remaining batches). Company Research: **fixed 5 hits** per admitted request (requires `remaining >= 5`); OpenRouter hard-capped at 5 via `ResearchLlmMeter`; flush via `enforceResumeAiRateLimitHitsCapped`. Hits recorded whenever `REDIS_URL` is set; **429 only in production**. `GET /api/resume/usage` peeks without consuming. Profile `ResumeAiUsageCard` (Progress bars, combined-copy, 60s poll + refresh). Hidden in development or when user has BYOK keys. Deploy note: namespace renamed from `resume-extract:` (counters reset once).
- **Pre-13 IP rate-limit hardening** — Second Redis pool `resume-ai-ip:{sha256(ip)[0:32]}` on Extract / Generate / Find Jobs / Company Research (after auth, before user quota). **1 hit per request** (Find: once per search click; Research: once per Research Company). Defaults via `RESUME_AI_IP_RATE_LIMIT_PER_MINUTE|HOUR|DAY` (10/45/120). Always applies when Redis is set, including BYOK; 429 only in production with copy “Too many requests from this network…”. Not exposed in usage UI. Signup/OAuth IP limits remain out of scope (InsForge-hosted).
- **OpenRouter BYOK** — Profile section saves up to 5 encrypted OpenRouter keys (`profiles.openrouter_keys_enc`, AES-256-GCM via `BYOK_ENCRYPTION_SECRET`). API `GET/POST/DELETE /api/profile/openrouter-keys` verifies each key with OpenRouter before save. With BYOK: Extract/Generate/Find/Research use only user keys + skip shared **per-user** rate limits (IP pool still applies); no platform-key fallback. Invalid/exhausted keys show a clear remove-to-switch message.
- **13 Company Research Agent** — `POST /api/agent/research` `{ jobId }` (`maxDuration` 800): derive homepage from apply/Adzuna redirect (`lib/company-homepage.ts`; known retail storefronts → corporate/about URLs on redirect **and** name fallback; redirect fetch AbortSignal 20s), one Browserbase + Stagehand session (`lib/browserbase.ts` default session **600s**, `lib/stagehand.ts` via Stagehand `CustomOpenAIClient` → OpenRouter chat — heals null `content` from `reasoning` for free models; Stagehand `verbose: 0` + quiet logger), homepage + **max 1** employer sub-page (`about`/`careers`/`team`/`engineering`/`blog`; denylist login/account/cart; skip Access Denied / auth-wall **titles** / Chrome SSL via `agent/research-nav.ts` before extract — ambient nav “Sign in” does not skip; **one extract timeout retry**; skip sub-page when remaining overall budget is tight or rich homepage cannot afford retry; per-`goto` / per-`extract` / overall via `RESEARCH_*_TIMEOUT_MS`), then OpenRouter `generateObject` dossier (temp 0.3) with schema heal + job/profile fallback (`degraded: true`). OpenRouter hard-capped at **5** calls (`RESEARCH_MAX_OPENROUTER_CALLS`); Redis usage always **5** when admitted (`RESEARCH_USAGE_HITS`). Pino research logs (no page DOM dumps). Client AbortSignal ~750s+. Always returns a dossier. Saves `jobs.company_research` (full overwrite). UI: multi-step progress + section cards; completion sound `public/sounds/completion.mp3`. Env: `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, optional `BROWSERBASE_SESSION_TIMEOUT_SEC` / `RESEARCH_*_TIMEOUT_MS` / `LOG_LEVEL`.
- **Find Jobs details affordance** — Jobs table trailing chevron column → `/find-jobs/[id]` (Company/Role cells still link too).
- **AI completion sound** — Howler helper `lib/completion-sound.ts` plays `/sounds/completion.mp3` after successful Research / Extract / Generate / Find Jobs (drop your file at `public/sounds/completion.mp3`).
- **UI — shadcn/ui** — Initialized shadcn (`radix` + `nova`, `components.json`). Primitives under `components/ui/` from the registry; JobPilot colors kept via `--jp-*` / `@theme` (brand purple stays `bg-accent`). Custom toaster (`toaster.tsx`) kept over default sonner for token-styled toasts. **Prefer shadcn for everything** — use registry `Select` / `Checkbox` / `Button` instead of native `<select>` / checkbox / raw buttons when counterparts exist. Removed `NativeSelect`. Progress used for usage card.
- **09 Find Jobs Page — UI only** — Built `/find-jobs` to `context/designs/find-jobs.png` with mock data (`lib/mock-jobs.ts`). No Adzuna / InsForge jobs API (Features 10–11). Client-side filter / sort / pagination via `lib/find-jobs-list.ts` (`PAGE_SIZE = 6` to match design “1 to 6 of 24”). Columns match PNG (COMPANY, ROLE, MATCH SCORE, SALARY EST., DATE FOUND) — SOURCE and Adzuna credit omitted. Match score bars use design bands (≥90 `bg-success`, ≥80 `bg-info`, else `bg-warning`). Find Jobs button shows fixed success banner only. Rows link to `/find-jobs/[id]` (details page is Feature 12). `AppNavbar` gains lucide icons to match find-jobs chrome.
- **10–11 Adzuna discovery + real list** — `POST /api/agent/find` (Bearer JWT → `createAuthedInsforgeClient`): Adzuna search by `what` + optional `where` only — **no `category` filter** (`lib/adzuna.ts`), sector-agnostic OpenRouter `generateObject` scoring (`agent/match-score.ts` + `agent/adzuna.ts`, same provider/failover/BYOK as Extract/Generate), writes `agent_runs` / `jobs` / `agent_logs`, returns banner counts. Shared Resume AI Redis pool (`resume-ai:{userId}`) — skipped with BYOK; **+1 hit per successful scoring batch** (not per click); 429 only in production. Find Jobs list via `GET /api/jobs` (Postgres filter/sort/`range` + exact count via `lib/jobs-list-query.ts`; query `page`, `pageSize` 10|20|50, `q` company|title, `match`, `sort`); client `fetchJobsPage`. Default page size 20; Rows select in pagination. Loading: table skeleton, search progress banner + overlay with rotating status copy. High match ≥70. PostHog `job_search_started` / `job_found`. Navbar avatar dropdown embeds compact AI usage + OpenRouter keys panels. SOURCE / Adzuna credit still omitted (design follow-up).
- **10–11 Scoring harden + InsForge timeouts** — Match scoring batches 5 jobs, hardened prompt/schema (compact JSON `{scores:[]}` only), heals markdown fences / bare arrays / truncated JSON before skill-overlap fallback. Server InsForge clients use 60s timeout; `requireAuth` maps auth timeouts to 503 (not 401); `GET /api/jobs` maps DB timeouts to 504.
- **12 Job Details** — `/find-jobs/[id]` AuthGuard page matching `context/designs/job-details.png`: header (match pill + View Job Post), meta cards, AI match reasoning, skills comparison (green “You have” / purple “Gap skills”), expandable job description, Company Research empty state + stub Research button (Sonner info — Feature 13 wires agent), Apply Now CTA. Data via `GET /api/jobs/[id]` + `fetchJobById` (`lib/jobs.ts`); helpers in `lib/job-detail.ts`. Dossier UI renders when `company_research` is already set. Shared Navbar (avatar), not design’s inline Sign out.
- **14 Dashboard Page — UI only** — Replaced Feature 02 placeholder with full `/dashboard` matching `context/designs/dashboard.png` + mock data (`lib/mock-dashboard.ts`). Labels follow design / Features 15–17 (Jobs This Week, Company Research Activity) over stale build-plan “Cover Letters” / “Resume Tailoring”. Components under `components/dashboard/` (`StatsBar`, `RecentActivity`, chart cards in `AnalyticsCharts.tsx`). Charts via shadcn `chart` + recharts (`--chart-1` accent area, `--chart-2` info bars, `--chart-3` success bars). Incomplete profile shows existing `CompletionBanner` when `!is_complete`. Stats/activity/charts stay mocked until Features 15–17. AuthGuard + Navbar + `dashboard_viewed`; layout skeleton mirrors stats + mid/bottom rows. Entrance motion via the shared `.jp-reveal` CSS cascade (`app/globals.css` + `revealDelay()` in `lib/motion-tokens.ts`) and tuned Recharts series timing; both degrade under `prefers-reduced-motion`.
- **09–13 Motion pass** — Extended the `.jp-reveal` cascade to `/find-jobs` and `/find-jobs/[id]` via a shared `Reveal` wrapper (`components/motion/Reveal.tsx`). Find Jobs reveals search → filters → results card once per visit; the reveal sits on the stable results `<section>` so filter / sort / pagination never replay it. Job details cascades all eight sections (steps 0–7). Async arrivals reveal on landing: search success banner, and the research dossier only when a run completes in-session (`justResearched`) so pre-existing research doesn't double-animate. Two defects fixed along the way — the busy dim only had its `transition-opacity` class while busy (restoring snapped back), and `MatchScoreBar` animated `width` (layout per frame across a full page of rows) instead of `scaleX` on `origin-left`.
- **15–16 Dashboard live data** — `GET /api/dashboard` (Bearer JWT) returns stats + recent activity from InsForge. Stats: COUNT jobs, AVG match_score, COUNT researched, COUNT found_at last 7 days (no WoW trend badges; keep design subtext on researched / this-week). Activity: merge completed `agent_runs` + jobs with `company_research`, sort by time, top 5. Added `jobs.researched_at` (`004_jobs_researched_at.sql`, set on research save; backfill `found_at` for existing dossiers). Helpers in `lib/dashboard.ts`; charts still mocked until Feature 17. In-place skeletons for stats/activity; empty activity copy; Sonner on fetch error.
- **17 Analytics Charts — PostHog** — Separate `GET /api/dashboard/charts` (Bearer JWT) runs HogQL against PostHog Query API (`POSTHOG_PERSONAL_API_KEY` + `POSTHOG_PROJECT_ID`; host via `getPostHogUiHost()`). Filters `distinct_id = auth.user.id`. Series: `job_found` last 30d daily + matchScore buckets (`50-60%`…`90-100%`); `company_researched` last 7d daily. Zero-fill with `M/D` labels; missing Query credentials → empty zero series (200). Empty chart copy; dynamic Y domain; `ChartCardSkeleton` while loading. Helpers in `lib/dashboard-charts.ts` / `lib/posthog-query.ts`. Capture parity: `userId` on `company_researched`.
- **Theme switcher (app-wide)** — `next-themes` with `class` on `<html>`, `defaultTheme=system`, `storageKey=jobpilot-theme`. Dark palette redefines `--jp-*` under `.dark` (brand purple kept). `ThemeSwitcher` in shared Navbar (Light / Dark / System). CTA hover uses `bg-cta-hover` token. Sonner toaster follows `resolvedTheme`. Future pages inherit via tokens; import `ThemeSwitcher` only if a page lacks Navbar.

---



## Notes

*Add notes here as the build progresses — workarounds, patterns, anything that differs from the context files.*