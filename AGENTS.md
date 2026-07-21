<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Read Before Anything Else

Read in this exact order before any implementation:

1. context/project-overview.md
2. context/architecture.md
3. context/ui-tokens.md
4. context/ui-rules.md
5. context/ui-registry.md
6. context/code-standards.md
7. context/library-docs.md
8. context/build-plan.md
9. context/progress-tracker.md

## Rules That Never Change

- Never use hardcoded hex values or raw Tailwind color classes
- Update `progress-tracker.md` and `ui-registry.md` after every feature
- Before any third party library — load its installed skill first,
  then read `context/library-docs.md` for project-specific rules
- If the same problem persists after one corrective prompt —
  stop immediately and run /recover

## Available Skills

- `/architect` — before any complex feature. Think before building.
- `/imprint` — after any new UI component. Capture patterns.
- `/review` — before demo or when something feels off.
- `/recover` — when something breaks after one failed correction.
- `/remember save` — when a feature spans multiple sessions.
- `/remember restore` — when returning after a multi-session feature.

## Learned User Preferences

- Dark buttons over a gradient must use a solid-color hover (e.g. `hover:bg-black`), never `hover:opacity-*` — opacity lets the purple gradient bleed through and looks "purplish".
- Do not add hover transforms (translate/scale "move up") to buttons unless the design explicitly shows them.

## Learned Workspace Facts

- Stack is Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + TypeScript 5. There is NO `tailwind.config.js`; design tokens live in `app/globals.css` under the `@theme` directive as CSS variables (the single source of truth). Use token utilities (`bg-surface-muted`, `border-l-accent`, `bg-overlay-dark`, `text-text-primary`, `border-border`, `var(--color-accent)` / `--color-accent-dark`), never raw hex or default Tailwind color classes. With `next/font`, use an intermediate `--font-inter` variable and `@theme inline { --font-sans: var(--font-inter); }` — never set `--font-sans` to static `"Inter"` in `@theme`.
- InsForge is the chosen backend (`@insforge/sdk`, base URL `https://9d5rf9jh.ap-southeast.insforge.app`); backend is currently empty. **`@insforge/ssr` does not exist** — never reference `createBrowserClient`/`createServerClient`. **`@insforge/react` is deprecated** — use a custom `AuthProvider`/`useUser()` wrapping `@insforge/sdk`. Use the SDK for app logic (auth/DB/storage/AI/functions) and InsForge MCP tools for infra (schema, buckets, functions, deploy). Call `fetch-docs`/`fetch-sdk-docs` before writing any InsForge code. SDK ops return `{ data, error }`; DB access is `insforge.database.from("table")` (not `insforge.from(...)`); DB inserts need array format `[{...}]`; serverless functions have a single endpoint (no nested routes).
- Auth (Feature 02) is **browser-first**: custom `AuthProvider` + client-side `AuthGuard` redirects; **no `middleware.ts`**. OAuth via `insforge.auth.signInWithOAuth`; `/callback` relies on SDK auto-detecting `insforge_code` through `getCurrentUser()`. Google/GitHub OAuth must be enabled in the InsForge dashboard with `http://localhost:3000/callback` in `allowedRedirectUrls`.
- PostHog (Feature 03) initializes in `instrumentation-client.ts` (Next.js 16 client hook) with `/ingest` reverse-proxy rewrites in `next.config.ts`. User identity wired in `AuthProvider` (`identify` on session load, `reset` on sign-out). Env vars: `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST` (documented in `.env.sample`).
- InsForge's generic guidance says "keep Tailwind on 3.4" — this does NOT apply here; this project deliberately runs Tailwind v4. Never downgrade to satisfy that generic rule.
- The homepage (Feature 01) is built from `context/designs/landing-page.png` as modular components under `components/homepage/` and `components/layout/`, composed in `app/page.tsx`, and documented in `context/ui-registry.md`. Layout uses a centered `max-w-6xl border-x` frame: the top group (Hero → DashboardPreview → Features) is split by plain borders; lower sections (Confidence, Testimonial, CTA) are split by hatched `SectionDivider` bands. DashboardPreview is its own section (light-gray bg + blue shadow), not overlapping the Hero.
- `next build`'s TS check scans the whole tree including `ECC/`, `.claude/`, `.cursor/`, and `graphify-out/`; these are listed in `tsconfig.json` `exclude` to keep the build green. The dev server "1 Issue" / hydration-mismatch warning seen in the Cursor IDE browser is a tooling artifact from injected `data-cursor-ref` attributes, not an app bug — the production build passes clean.
- To verify UI against a design PNG in the browser: `file://` URLs are blocked by the cursor-ide-browser tool, so temporarily copy the image into `public/` (served at localhost:3000), inspect, then delete it. Scale via CDP `Runtime.evaluate` (`img.style.width`), scroll with `window.scrollTo`, and screenshot regions.
- `browser_take_screenshot` only captures the first viewport (no full-page). Use CDP `Emulation.setDeviceMetricsOverride` to widen the viewport (1280/1440) to verify `lg:` breakpoints and the centered `max-w` frame.
- CDP `Runtime.evaluate` shares one persistent global scope across calls; redeclaring `const`/`let` (e.g. `h`) throws "already declared". Wrap each snippet in an IIFE.
- User-supplied images are auto-saved under `.cursor/projects/<slug>/assets/`; project image assets live in `public/images/`.