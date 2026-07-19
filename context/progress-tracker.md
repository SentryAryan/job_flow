# Progress Tracker

Update this file after every completed feature. Any AI agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 1 — Foundation
**Last completed:** 01 Homepage (full UI, mock data)
**Next:** 02 Auth

---

## Progress

### Phase 1 — Foundation

- [x] 01 Homepage
- [ ] 02 Auth
- [ ] 03 PostHog Initialization
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

---



## Notes

*Add notes here as the build progresses — workarounds, patterns, anything that differs from the context files.*