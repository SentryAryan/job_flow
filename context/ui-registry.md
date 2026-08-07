# UI Registry

Living document. Updated after every component is built. Read this before building any new component — match existing patterns exactly before inventing new ones.

---

## How to Use

Before building any component:

1. Check if a similar component already exists here
2. If yes — match its exact classes
3. If no — build it following ui-rules.md and ui-tokens.md, then add it here

After building any component — update this file with the component name, file path, and exact classes used.

---

## Layout Patterns

### Page frame — `app/page.tsx`

Homepage sections are wrapped in a centered bordered frame:

- Frame: `mx-auto max-w-6xl border-x border-border bg-surface` (left/right rulings run full height; white surface so tinted sections stand out)
- Navbar `border-b` (top edge) + Footer `border-t` (bottom edge) close the frame.
- Order + separators (matches design):
  - `Hero` → **plain** `border-t` → Dashboard section → **plain** `border-t` → `Features` → `<SectionDivider />` → `Confidence` → `<SectionDivider />` → `Testimonial` → `<SectionDivider />` → `CtaSection` → `<SectionDivider />`
  - The top group (Hero / Dashboard / Features) is split by thin plain borders; the lower marketing sections use hatched `SectionDivider` bands.
- Dashboard section (`app/page.tsx`): `border-t border-border bg-surface-muted px-6 py-14 sm:px-10` wrapping `DashboardPreview` (gray band, no overlap with Hero).

### SectionDivider — `components/homepage/SectionDivider.tsx`

Diagonal-hatched separator band between sections (matches design rulings).

- `h-20 w-full border-y border-border bg-surface` + inline `repeating-linear-gradient(-45deg, var(--color-border-light) 0 1px, transparent 1px 11px)`

### Two-column feature block (Features + Confidence)

- Section: `grid grid-cols-1 lg:grid-cols-2` (stacks below `lg`)
- Vertical divider between columns: the second column carries `border-t border-t-border lg:border-t-0 lg:border-l lg:border-l-border` (horizontal ruling when stacked → vertical divider on desktop)
- Column padding: `px-6 py-12 lg:px-10 lg:py-16`
- Split background (per design): one column white (`bg-surface`), the other gray (`bg-surface-muted`). Features → right/image column gray; Confidence → left/terminal column gray.
- Feature item: `border-t border-t-border border-l-2 <accent> py-5 pl-5` where `<accent>` is `border-l-accent` (purple, highlighted), `border-l-success` (green, highlighted), or `border-l-transparent` (default). Top border = ruling between items; colored left border = accent bar in the gutter.

## Components

### Logo — `components/layout/Logo.tsx`

Brand mark + wordmark, used in Navbar and Footer.

- Wrapper: `inline-flex items-center gap-2` (Next `Link`, default `href="/"`)
- Mark: `flex h-9 w-9 items-center justify-center rounded-[10px]` with inline `linear-gradient(45deg, var(--color-accent), var(--color-accent-dark))` + white 18px inline SVG
- Wordmark: `text-[19px] font-bold text-text-primary`

### CtaButtons — `components/homepage/CtaButtons.tsx`

Reusable pair of marketing CTAs ("Get Started" + "Find Your First Match"). Props: `align?: "start" | "center"`. Both use `AuthAwareCta` (Feature 02): `/dashboard` when signed in, else `/login`.

- Container: `flex flex-col gap-3 sm:flex-row` (+ `sm:justify-center` when centered)
- Primary (dark, per design): `inline-flex items-center justify-center gap-2 rounded-md bg-cta px-4 py-2 text-sm font-medium text-cta-foreground transition-colors hover:bg-cta-hover` + solid play-triangle SVG (`M8 5v14l11-7z`, 11px, `fill=currentColor`). NOTE: use solid-color hover (`bg-cta-hover`), never `hover:opacity-*` on dark buttons over a gradient (the gradient bleeds through and looks purplish). In dark mode CTAs use brand purple (`--jp-cta`) for contrast.
- Secondary: `inline-flex items-center justify-center rounded-md border border-border-light bg-accent-muted px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-accent-light`

### Navbar — `components/layout/Navbar.tsx`

Shared chrome for marketing and authenticated pages (home, login, profile, find-jobs, dashboard). `AppNavbar` re-exports this module.

- Header: `w-full border-b border-border bg-background`
- Inner: `mx-auto flex h-16 max-w-6xl items-center justify-between px-6` — Logo | nav | `ThemeSwitcher` + CTA
- Logo links to `/` (homepage always reachable)
- Nav links: lucide icons (`LayoutGrid` / `Search` / `User`) + label; active `border-accent text-accent` underline; inactive `text-text-dark`
- Trailing: always-visible `ThemeSwitcher` then CTA
- CTA: signed out → dark **Get Started** → `/login`; signed in → shadcn `Avatar` + `DropdownMenu` (`NavbarCta`) with name/email, Profile link, Sign out (`user_signed_out` + analytics reset + redirect `/`). Auth-loading CTA uses `Skeleton` (rounded). Menu opens on hover; click pins it open until outside click / second click. Timers cleared on unmount.

### ThemeProvider — `components/theme/ThemeProvider.tsx`

Wraps `next-themes` (`attribute="class"`, `defaultTheme="system"`, `storageKey="jobpilot-theme"`). Mounted in `app/providers.tsx` outside `AuthProvider`. Root `<html>` uses `suppressHydrationWarning`.

### ThemeSwitcher — `components/theme/ThemeSwitcher.tsx`

Compact ghost icon button (Sun/Moon by resolved theme) + dropdown radio: Light / Dark / System. Uses `hooks/use-theme.ts`. Mounted in shared Navbar; reusable on any future page.

### AuthGuard — `components/auth/AuthGuard.tsx`

While auth is hydrating or the user is unsigned, renders `Navbar` + optional `fallback` page skeleton (default `DefaultMainSkeleton`) — never a blank full-screen spinner. Redirects to `/login` when loaded and signed out. Pages pass page-shaped fallbacks (`ProfilePageSkeleton`, `FindJobsPageSkeleton`, `DashboardPageSkeleton`).

### Footer — `components/layout/Footer.tsx`

- Footer: `w-full border-t border-border bg-surface`
- Inner: `mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row`
- Links: `text-sm font-medium text-text-secondary transition-colors hover:text-accent`

### Hero — `components/homepage/Hero.tsx`

Marketing hero — full-bleed gradient panel with heading + CTAs (DashboardPreview is now a separate section below, no overlap).

- Section: `pt-6` (white gap above gradient, inside the page frame)
- Gradient panel is full-bleed within the frame: `px-6 pb-20 pt-16 text-center` + inline layered `radial-gradient` using `--color-accent-light` / `--color-info-light` / `--color-accent-muted`
- H1: `mx-auto max-w-3xl text-4xl font-bold leading-tight text-text-darkest sm:text-5xl`
- Sub: `mx-auto mt-5 max-w-xl text-base text-text-secondary`

### DashboardPreview — `components/homepage/DashboardPreview.tsx`

Mock app dashboard (browser chrome + stat cards + activity + bar chart). Pure mock data.

- Card: `overflow-hidden rounded-xl border border-border bg-surface` + blue-tinted shadow `shadow-[0_28px_70px_-24px_rgba(43,127,255,0.4)]` (the "blueish shadow behind image" in the design; sits on the gray Dashboard section band)
- Chrome bar: `h-9 ... bg-surface-secondary` + traffic-light dots (`bg-error/bg-warning/bg-success`) + address pill
- Stat cards: `grid grid-cols-2 gap-3 lg:grid-cols-4`, each `rounded-lg border border-border bg-surface p-3`; value `text-[26px] font-semibold`; trend badge `rounded-sm bg-success-lightest text-success-darker` (per ui-rules trend-badge spec)
- Chart bars: `bg-info-medium rounded-t`, heights via inline `style`

### JobsTablePreview — `components/homepage/JobsTablePreview.tsx`

Jobs table mock used in Features. Follows ui-rules Table + Match Score Bar specs.

- Card: `overflow-hidden rounded-xl border border-border bg-surface shadow-sm`
- Rows: `grid grid-cols-[1.4fr_1.4fr_1.2fr_0.8fr] ... border-b border-border ... last:border-b-0`
- Headers: `text-[11px] font-medium uppercase tracking-wide text-text-secondary`
- Match bar: track `h-1 w-16 rounded-full bg-border`; fill color by score — `bg-success` (≥80), `bg-info` (60–79), `bg-warning` (<60)
- Source: `text-info-dark` (link) or `text-text-muted` (N/A)

### Features — `components/homepage/Features.tsx`

"Manage Your Job Search With Ease" — two-column feature block (text list + JobsTablePreview). See "Two-column feature block" pattern above.

- H2: `max-w-sm text-3xl font-bold leading-tight text-text-darkest`
- First item "Find Jobs That Actually Fit" carries the purple accent (`border-l-accent`); others `border-l-transparent`
- Right column holds `JobsTablePreview` with the vertical divider (`lg:border-l`)

### AgentTerminal — `components/homepage/AgentTerminal.tsx`

Dark terminal mock of the agent run. Used in Confidence.

- Card: `overflow-hidden rounded-xl border border-overlay-dark bg-overlay-dark shadow-xl`
- Header: traffic-light dots + `agent · logs` label (`text-white/60`)
- Body: `font-mono text-[13px]`; tag colors `text-accent` (START), `text-success-alt` (DONE), `text-info` (RUN); blinking cursor `animate-pulse bg-white/70`

### Confidence — `components/homepage/Confidence.tsx`

"Apply With More Confidence, Every Time" — two-column feature block (AgentTerminal left + text list right). Split bg: left/terminal column `bg-surface-muted` (gray), right/text column `bg-surface` (white). The "AI-Powered Job Matching" item carries the green accent (`border-l-success`); others `border-l-transparent`. Vertical divider sits on the text column (`lg:border-l`).

### Testimonial — `components/homepage/Testimonial.tsx`

Centered quote block (content per design).

- Section: `px-6 py-20`; inner `mx-auto max-w-3xl text-center`
- Eyebrow: `text-xs font-semibold uppercase tracking-widest text-accent` — "Success Stories"
- Quote: `text-2xl font-medium leading-snug text-text-primary`
- Attribution: `next/image` photo `/images/user-icon.png` `h-11 w-11 rounded-lg object-cover` + name "Tom Wilson" (`text-sm font-semibold`) / "Junior Developer" (`text-xs text-text-secondary`)

### CtaSection — `components/homepage/CtaSection.tsx`

Bottom gradient CTA, full-bleed within the frame (same gradient technique as Hero).

- Panel: `px-6 py-20 text-center` + inline layered `radial-gradient`
- H2: `mx-auto max-w-2xl text-3xl font-bold ... text-text-darkest sm:text-4xl`; reuses `CtaButtons align="center"`

### Login page — `app/(auth)/login/page.tsx`

Client component (built to `context/designs/login-page.png`). Renders `<Navbar />` above a centered split card; keeps the OAuth logic (`useUser()` redirect to `/dashboard` when signed in, `insforge.auth.signInWithOAuth(provider, { redirectTo: <origin>/callback })`, `pending`/`error` state).

- **Auth gate (no form flash):** while `!isLoaded` or `user` is set, render `LoginPageSkeleton` (Navbar + split-card structural skeletons) — never mount the provider buttons for signed-in users. Form renders only when `isLoaded && !user`.
- **OAuth back-button:** `pageshow` listener clears `pending`/`error` so bfcache restore after abandoning Google/GitHub does not leave buttons stuck on "Redirecting...".
- Page: `flex min-h-screen flex-col bg-background`; main `flex flex-1 items-center justify-center px-6 py-12`
- Card: `grid w-full max-w-[760px] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)] md:grid-cols-2`
- Left (gradient) panel: `flex flex-col justify-center p-8 md:p-10` + inline `radial-gradient(... var(--color-accent-light) ...)` over `linear-gradient(135deg, var(--color-accent-muted), var(--color-surface) 70%)`
  - Badge pill: `inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-secondary` + shield-check SVG (`text-accent`)
  - H1: `mt-6 text-4xl font-bold leading-[1.1] text-text-primary`; sub `mt-5 max-w-sm text-sm leading-relaxed text-text-secondary`; footnote `mt-8 text-xs text-text-muted`
- Right (white) panel: `flex flex-col justify-center border-t border-border p-8 md:border-l md:border-t-0 md:p-10` (divider: top border stacked → left border on `md`)
  - Eyebrow `text-xs text-text-muted` ("Welcome to"); H2 `mt-1 text-2xl font-bold text-text-primary`; sub `mt-2 text-sm text-text-secondary`
- Provider buttons (secondary, per design — NOT dark): `inline-flex w-full items-center justify-center gap-3 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-70`
  - Icons are official brand marks (fixed brand hex is an intentional exception to the no-raw-hex rule): Google 4-color `G` (viewBox `0 0 48 48`); GitHub mark (`fill="currentColor"` → inherits `text-text-primary`)
- Error: `mt-4 text-sm text-error`

### Find Jobs page — `app/find-jobs/page.tsx`

Client page wrapped in `AuthGuard` with `FindJobsPageSkeleton` fallback (Navbar stays visible while auth hydrates). Composes `Navbar` + search + filters + jobs table backed by InsForge `jobs` (Features 10–11).

- Shell: `min-h-screen bg-background`
- Main: `mx-auto flex max-w-6xl flex-col gap-5 px-6 py-8 sm:px-8`
- Components under `components/find-jobs/`: `SearchControls`, `JobFilters`, `JobsTable`, `JobsPagination`, `MatchScoreBar`
- Find Jobs button → `POST /api/agent/find` (`lib/find-jobs-api.ts` + `authedFetch`); Adzuna discovery by title/location across **any sector** (no `category`); job title placeholder indicates any role; list load via `GET /api/jobs` (`lib/jobs.ts` `fetchJobsPage`) with `page` / `pageSize` (10|20|50) / `q` (company|title) / `match` / `sort` — DB-backed filter/sort/`range` + exact count (`lib/jobs-list-query.ts`), not in-memory 500-row fetch
- Columns: COMPANY, ROLE, MATCH SCORE, SALARY EST., DATE FOUND, details chevron (opens `/find-jobs/[id]`)
- Loading UX: table skeleton matching `JobsTable` columns while loading/searching/refreshing; rotating status banner under the form (`Searching Adzuna…` → `Scoring…` → `Saving discovered jobs…`); Howler completion sound on successful Find Jobs
- Pagination **Rows** select (10 / 20 / 50) wired through `JobsPagination` → API
- Helpers: `lib/jobs-list-query.ts` (PostgREST plan / ilike escape / paginate meta); `lib/find-jobs-list.ts` (pure filter / sort / paginate / `parsePageSizeParam` / relative dates / score color); default `FIND_JOBS_PAGE_SIZE = 20`
- Also: `JobsLoading` (`JobsTableSkeleton`, `SearchProgressBanner` → shared `MultiStepProgress`)
- Success banner: `Found and saved N jobs · M strong matches (70%+).` (all scored listings are saved; strong = score ≥70)
- Match score fill: ≥90 `bg-success`, ≥80 `bg-info`, else `bg-warning` (design override of homepage preview thresholds); the fill is `scaleX` on `origin-left`, not `width`, so a full page re-scoring does not trigger layout per frame
- Pagination: Rows select 10 / 20 / 50 (default 20); footer inside results card when `total > 0`
- PostHog: `job_search_started`, per-job `job_found` with `matchScore`
- Motion: search card → filters → results card reveal once per visit (`Reveal` steps 0–2). The results `<section>` carries the reveal, **not** the table, so filter / sort / pagination changes never replay it. Busy dim keeps `transition-opacity duration-200 ease-out-strong` mounted at all times and toggles only `opacity-60` — with the transition class itself conditional, restoring snapped. Search success banner is `.jp-reveal` (it lands after a long agent run)

### Job Details page — `app/find-jobs/[id]/page.tsx`

Client page wrapped in `AuthGuard` with `JobDetailsSkeleton` fallback. Loads one job via `GET /api/jobs/[id]` (`lib/jobs.ts` `fetchJobById`). Design: `context/designs/job-details.png`.

- Shell: `min-h-screen bg-background` + shared `Navbar` (Find Jobs stays active)
- Main: `mx-auto flex max-w-6xl flex-col gap-5 px-6 py-8 sm:px-8`
- Components under `components/job-details/`: `BackToJobs`, `JobHeader`, `JobMetaCards`, `AiMatchReasoning`, `SkillsComparison`, `JobDescription`, `CompanyResearchCard`, `ApplyNowButton`, `JobDetailsSkeleton`, `JobDetailsNotFound`
- Match pill: ≥70 `bg-success-lightest text-success-dark`; gap skill chips use `bg-accent-light text-accent` (PNG, not red)
- Job description: HTML stripped to text; Show more / less when &gt;400 chars
- Company Research: empty state + **Research Company** → `POST /api/agent/research`; while pending: `MultiStepProgress` checklist (completed / current / upcoming: homepage → browse → synthesize → save) + section-card skeleton; dossier = grid of iconed cards (Overview, Tech, Culture, Why, Edge, Gaps, Questions, Prep, Sources); Sonner success / limited-web / degraded info; re-research overwrites
- View Job Post / Apply Now → `external_apply_url` then `source_url`, `target="_blank"` `rel="noopener noreferrer"`
- Helpers: `lib/job-detail.ts` (`mapDbRowToJob`, `formatJobType`, `stripHtmlToText`, `getApplyUrl`, display fallbacks)
- Motion: all eight sections reveal top-to-bottom via `Reveal` steps 0–7 (last lands ~280ms, so it reads as one arrival). The dossier reveals **only** when research completes in this session (`justResearched`) — research already on the job rides the page cascade instead of double-animating

### Navbar AI panels — `components/layout/NavbarAiPanels.tsx`

Avatar dropdown embeds compact **AI usage** (shared Extract / Generate / Find Jobs / Company Research pool) and **OpenRouter keys** add/list (same APIs as profile). Wider menu (`w-80`). Keys change refreshes usage panel. Research / Extract / Generate dispatch `jobpilot:resume-ai-usage-refresh` for an immediate usage refetch.

### UI primitives — `components/ui/`

**shadcn/ui** (radix-nova) + JobPilot tokens. Config: `components.json`. Add via `npx shadcn@latest add <name>`. Index barrel allowed only here.

- **Button** — shadcn `Button` with JobPilot variants: `default`/`primary` (purple elevated border), `secondary`/`outline` (gray elevated), `muted`, `danger`/`destructive` (solid red hover). Optional `pending` shows decorative `Spinner` + `aria-busy` and disables. Always `cursor-pointer` / `disabled:cursor-not-allowed`. No hover translate. Lucide icons via `data-icon="inline-start"` on profile actions.
- **Spinner** — lucide `Loader2` + `text-accent`; `size` sm|md; `decorative` inside busy buttons
- **Skeleton** — shadcn `Skeleton` (`animate-pulse bg-muted`); page/section loading placeholders keep Navbar visible — never full-viewport spinner-only screens
- **Progress** — shadcn Progress (`components/ui/progress.tsx`); used by Resume AI usage card
- **Input / Textarea** — elevated field chrome (`border-border` + heavier `border-b-border-muted`), focus accent ring
- **Select** — Radix shadcn Select (`SelectTrigger` / `SelectContent` / `SelectItem`) for all dropdowns (enums, months/years, filters); trigger chrome matches Input — never native `<select>`
- **Checkbox** — shadcn Checkbox for boolean fields (e.g. “Currently working here”)
- **Label** — Radix Label; profile default `mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary`
- **Card** — compose with `CardContent` (and Header/Title/Footer as needed); `border-border` + `shadow-[var(--shadow-card)]`
- **Chart** — shadcn Chart (`components/ui/chart.tsx`) over Recharts v3; use `ChartContainer` + `ChartTooltip` / `ChartTooltipContent`; series colors via `--chart-1`…`--chart-5` (JobPilot accent/info/success)
- **Badge** — shadcn Badge available
- **Tag** — project chip (`border-accent bg-accent-light`) for skills/industry; not from shadcn

### Dashboard page — `app/dashboard/page.tsx`

Client page wrapped in `AuthGuard` with `DashboardPageSkeleton` fallback. Live stats/activity via `fetchDashboardSummary` → `GET /api/dashboard` (Features 15–16); live charts via `fetchDashboardCharts` → `GET /api/dashboard/charts` (Feature 17 PostHog HogQL). Incomplete profile banner via `fetchProfile` + `CompletionBanner`. Composes `Navbar` + `StatsBar` (or `StatsBarSkeleton`) + mid row (activity | research chart) + bottom row (jobs area | match bars). Chart loading uses `ChartCardSkeleton`; chart errors toast + empty zero series.

- Shell: `min-h-screen bg-background`
- Main: `mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 sm:px-8`
- Dashboard fetch errors: Sonner toast + zero stats / empty activity

Entrance cascade via `revealDelayMs` props (stats 0 → activity 100 → research 140 → jobs 180 → match 220). The async completion banner is wrapped in `.jp-reveal` so it fades in instead of popping when the profile fetch resolves.

### Entrance reveal — `.jp-reveal` (`app/globals.css` + `lib/motion-tokens.ts`)

Shared CSS entrance for page sections: fade + 8px rise, 280ms, `--jp-ease-out` (`cubic-bezier(0.22, 1, 0.36, 1)`). CSS rather than `motion/react` so the cascade does not drop frames while charts and fetches occupy the main thread — use `MotionSection` only where JS-driven control is actually needed.

- Stagger by setting `--jp-reveal-delay` via `revealDelay(ms)`; keep steps at `REVEAL_STAGGER_MS` (40ms) and total delay under ~300ms
- `prefers-reduced-motion: reduce` swaps to `jp-reveal-fade` (opacity only, 160ms) and forces delay to 0 — no travel, no cascade
- Easing utilities `ease-out-strong` / `ease-in-out-strong` are available for transitions elsewhere
- Only wrap elements that mount **once per visit**. Replaying a reveal on every filter, sort, or pagination change makes routine interactions feel slow — put the reveal on the stable container, not on the list that re-renders

### Reveal — `components/motion/Reveal.tsx`

Wrapper applying `.jp-reveal` with a delay. `<Reveal step={n}>` spaces items by `REVEAL_STAGGER_MS`; `delayMs` overrides for irregular timing. Used for the find-jobs chrome and the job-details section cascade; dashboard components take a `revealDelayMs` prop instead because they set the class on their own card.

### StatsBar — `components/dashboard/StatsBar.tsx`

Four equal cards: Total Jobs Found, Avg. Match Rate, Companies Researched, Jobs This Week. Props: `stats: DashboardStats` (from `lib/dashboard.ts`), `revealDelayMs?`. Live Feature 15 data omits WoW `trend` badges; researched / this-week use gray subtext. Optional trend chips still supported for mocks.

- Grid: `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4`
- Card: `Card size="sm"` + `bg-surface shadow-none`; value `text-3xl font-bold text-text-primary`
- Cards reveal left-to-right, `REVEAL_STAGGER_MS` apart
- Loading: `StatsBarSkeleton`

### RecentActivity — `components/dashboard/RecentActivity.tsx`

Vertical feed of typed activity items (top 5 from `GET /api/dashboard`). Dots: `job_found` → `bg-success-light` / `bg-success-alt`; `company_researched` → `bg-info-light` / `bg-info` (via `activityDotClasses`). Empty state: “No activity yet. Find jobs or research a company to get started.”

- Card title `text-base font-semibold`; list `gap-5`; message `text-sm font-medium`; time `text-xs text-text-muted`
- Items trail the card by 60ms and stagger 30ms, capped at 6 steps so long feeds never feel slow
- Loading: `RecentActivitySkeleton`

### AnalyticsCharts — `components/dashboard/AnalyticsCharts.tsx`

Exports `CompanyResearchChart` (info `BarChart`), `JobsFoundOverTimeChart` (accent `AreaChart` monotone + gradient), and `MatchScoreDistributionChart` (success `BarChart`). Live series from PostHog (`DaySeriesPoint` / `MatchBucketPoint` via `lib/dashboard-charts.ts`). Empty states: “No research yet.” / “No jobs found yet.” / “No match scores yet.” Y domain `0…max(4, maxCount)`; 30-day X axis uses `interval="preserveStartEnd"` + `minTickGap`. Grid lines dashed `stroke-border`; axis ticks `text-text-muted` 12px. Chart height `h-[220px]` on `ChartContainer`.

- Series draw-in via `useSeriesAnimation`: 600ms `ease-out` (Recharts' 1500ms default reads as sluggish), beginning 120ms after the card so card and data feel like one motion
- `isAnimationActive` is off under `prefers-reduced-motion`

### ChartCardSkeleton — `components/dashboard/ChartCardSkeleton.tsx`

In-place loading stand-in for a chart card (`title` skeleton + `h-[220px]` plot). Used while `fetchDashboardCharts` is pending.

### DashboardPageSkeleton — `components/layout/DashboardPageSkeleton.tsx`

AuthGuard fallback mirroring stats row + mid activity/chart + bottom two charts (no Navbar; AuthGuard supplies it).

### Profile page — `app/profile/page.tsx`

Client page wrapped in `AuthGuard` with `ProfilePageSkeleton` fallback. Loads profile via `fetchProfile` (`lib/profile.ts`); composes `Navbar` + completion banner + resume + form. Initial fetch and AuthGuard use structural shadcn `Skeleton` layouts (not full-viewport spinners); Resume AI usage / OpenRouter keys / resume preview skeletonize independently inside their cards.

- Shell: `min-h-screen bg-background`
- Main: `mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8 sm:px-8`

### CompletionBanner — `components/profile/CompletionBanner.tsx`

Alert card when `missing.length > 0`. Red warning icon, title, body, uppercase missing tags (`text-xs font-semibold uppercase tracking-wide text-error`), SVG progress ring (`stroke-error`, percent centered).

- Card: same Card + `CardContent` + `border-error/40`; layout `flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`

### ResumeAiUsageCard — `components/profile/ResumeAiUsageCard.tsx`

Profile card above Resume: three Progress rows (minute / hour / day) showing **used / limit** for the **shared** Extract + Generate + Find Jobs + Company Research pool. Copy states limits are combined. Refresh icon + 60s poll (pauses when tab hidden). Hides when `available: false` (no Redis, development/`dev`, or user has BYOK keys). Ref `refresh()` after AI actions settle or BYOK keys change. Compact twin lives in the Navbar avatar menu.

### OpenRouterKeysSection — `components/profile/OpenRouterKeysSection.tsx`

Profile Card for optional personal OpenRouter keys: paste one key → Add (server verifies with OpenRouter before save). Lists masked `••••last4` with Remove. User-facing copy explains using your own credits (no JobPilot limits) for Extract, Generate, and Find Jobs vs removing keys to return to JobPilot keys + limits. Status banner while keys are active. Max 5 keys; ciphertext never returned to the client. Calls `onKeysChanged` so the usage card can refresh/hide. Compact twin in Navbar avatar menu.

### ResumeUpload — `components/profile/ResumeUpload.tsx`

Resume card: title + description; dashed dropzone with purple cloud-upload icon; Select Resume opens hidden PDF file input (≤5MB) → `uploadResume` (upload overlay + `Button pending` spinner). When `resume_pdf_url` is set, shows authenticated PDF preview with Expand/Download. **Extract from Resume** (`FileSearch`) and **Generate Resume** (`FileText`) share equal sizing (`min-h-11` + `sm:w-[15.5rem]`). Long ops show `InlineActionStatus`. Extract: POST `/api/resume/extract`. Generate: save-first dirty gate → POST `/api/resume/generate` → preview refresh; PostHog `resume_generated`. Calls `onAiActionSettled` to refresh usage card.

### ProfileForm — `components/profile/ProfileForm.tsx`

Orchestrates sections with `border-t border-border` dividers; Save Profile (`Save` icon) calls `saveProfile` with `Button pending` spinner and form `fieldset` disabled + opacity while saving. **Clear all fields** (`Eraser` icon, `danger`/red, beside Save) resets editable form state via `clearProfileFormFields` while keeping `resume_pdf_url` / email / id / timestamps. Success/error feedback via Sonner toasts — no inline status text above the button. Sections: `PersonalInfoSection`, `ProfessionalInfoSection` (+ `TagInput`), `WorkExperienceSection` (max 3, “+ Add role”, role blocks use `bg-surface-secondary`), `EducationSection`, `JobPreferencesSection`.

### Profile motion — `MotionSection` / `InlineActionStatus` / `Spinner`

- `components/profile/MotionSection.tsx` — soft fade/slide entrance for CompletionBanner → Resume → Form (`motion/react`, respects `useReducedMotion`)
- `components/profile/InlineActionStatus.tsx` — polite live-region status strip for upload/extract/generate
- `components/ui/spinner.tsx` + `Button pending` — lucide spinner with `text-accent`
- Tokens: `lib/motion-tokens.ts`

### Toaster — `components/ui/toaster.tsx`

Sonner host mounted in `app/providers.tsx` (`position="bottom-right"`). Unstyled + token `classNames`; type icons use filled circles — success `bg-success` + white check, error `bg-error` + white ×, warning/info `bg-warning` + white glyph. Use `toast` from `sonner` in Client Components.
