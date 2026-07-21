# PostHog post-wizard report

The wizard has completed a full PostHog integration for JobPilot. Here is a summary of every change made:

- **`instrumentation-client.ts`** (new) — Initializes PostHog via the Next.js 15.3+ `instrumentation-client` hook with a reverse proxy, exception autocapture, and debug mode in development.
- **`next.config.ts`** — Added `/ingest` rewrites so all PostHog requests route through the Next.js server (avoids ad-blockers); `skipTrailingSlashRedirect: true` added for PostHog API compatibility.
- **`.env.local`** — `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` written.
- **`components/auth/AuthProvider.tsx`** — Calls `posthog.identify(user.id, { email })` whenever the auth state resolves, covering both initial page load and returning sessions.
- **`app/(auth)/login/page.tsx`** — Captures `sign_in_started` (with `provider` property) when an OAuth button is clicked, and `sign_in_failed` (with `provider`) when the OAuth call returns an error.
- **`app/(auth)/callback/page.tsx`** — Captures `user_signed_in` when the OAuth callback resolves with an authenticated user.
- **`components/auth/SignOutButton.tsx`** — Captures `user_signed_out` then calls `posthog.reset()` before executing the sign-out, ensuring future events are anonymous.
- **`components/auth/AuthAwareCta.tsx`** — Added an optional `onClick` prop so parent components can attach click handlers to the CTA link.
- **`components/homepage/CtaButtons.tsx`** — Converted to a client component; captures `cta_clicked` with a `label` property (`get_started` or `find_first_match`) on each homepage CTA click.
- **`components/layout/Navbar.tsx`** — Converted to a client component; captures `navbar_cta_clicked` when the "Start for free" nav button is clicked.

## Events instrumented

| Event name | Description | File |
|---|---|---|
| `sign_in_started` | Fired when a user clicks the Google or GitHub OAuth button to begin sign-in. | `app/(auth)/login/page.tsx` |
| `sign_in_failed` | Fired when the OAuth sign-in flow returns an error and the user cannot be redirected. | `app/(auth)/login/page.tsx` |
| `user_signed_in` | Fired when a user successfully completes the OAuth flow and lands on the callback page authenticated. | `app/(auth)/callback/page.tsx` |
| `user_signed_out` | Fired when a user clicks the sign-out button and the sign-out request is initiated. | `components/auth/SignOutButton.tsx` |
| `cta_clicked` | Fired when a user clicks a primary CTA button on the homepage hero or bottom CTA section. | `components/homepage/CtaButtons.tsx` |
| `navbar_cta_clicked` | Fired when a user clicks the "Start for free" button in the top navigation bar. | `components/layout/Navbar.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/471373/dashboard/1878043)
- [Sign-in conversion funnel (wizard)](https://us.posthog.com/project/471373/insights/esxHUYZ7)
- [CTA clicks by button (wizard)](https://us.posthog.com/project/471373/insights/JSISwHjO)
- [Sign-in starts by provider (wizard)](https://us.posthog.com/project/471373/insights/7mzUknyh)
- [Sign-outs over time (wizard)](https://us.posthog.com/project/471373/insights/x1pX3a56)

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.sample` (and any CI/deploy secrets) so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path also calls `identify` — the `AuthProvider` now calls `posthog.identify()` on every auth state load, which covers both fresh logins and page refreshes with an existing session.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
