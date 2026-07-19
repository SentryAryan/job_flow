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

Reusable pair of marketing CTAs ("Get Started" + "Find Your First Match"). Props: `align?: "start" | "center"`. Both link to `/login` (auth-aware redirect deferred to Feature 02).

- Container: `flex flex-col gap-3 sm:flex-row` (+ `sm:justify-center` when centered)
- Primary (dark, per design): `inline-flex items-center justify-center gap-2 rounded-md bg-overlay-dark px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black` + solid play-triangle SVG (`M8 5v14l11-7z`, 11px, `fill=currentColor`). NOTE: use solid-color hover, never `hover:opacity-*` on dark buttons over a gradient (the gradient bleeds through and looks purplish).
- Secondary: `inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary`

### Navbar — `components/layout/Navbar.tsx`

- Header: `w-full border-b border-border bg-surface`
- Inner: `mx-auto flex h-16 max-w-6xl items-center justify-between px-6`
- Nav links: `text-sm font-medium text-text-dark transition-colors hover:text-accent` (hidden below `md`)
- CTA "Start for free": dark button — `rounded-md bg-overlay-dark px-4 py-2 text-sm font-medium text-white hover:opacity-90`

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
