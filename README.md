# job_flow

Job Flow — AI job search copilot (Next.js 16 + InsForge).

## Getting Started

```bash
npm install
cp .env.sample .env.local   # fill in Shared + Local sections
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Env reference: [`.env.sample`](.env.sample) — **Shared**, **Local**, **Vercel**, and **Render** sections are separate. Do not copy a Vercel Hobby clamp preset onto Render (or the reverse).

## Will Docker / Render files break Vercel?

**No.** Safe to push together:

| Artifact | Vercel | Render |
|----------|--------|--------|
| `Dockerfile`, `.dockerignore`, `render.yaml` | Ignored | Used |
| `output: "standalone"` in `next.config.ts` | Harmless (Vercel still runs its own `next build`) | Used for `node server.js` |
| Env vars | Set in Vercel dashboard (`clamp` on Hobby) | Set in Render dashboard (`no_clamp`) |

Each host has its **own** environment variables. Pushing the repo does not copy Render env into Vercel or vice versa.

---

## Deploy on Render (Docker) — step by step

### 0. Prerequisites

- Repo on GitHub (this project).
- [Render](https://render.com) account.
- Values from `.env.sample` **Shared** + **Render** sections (InsForge, OpenRouter, Redis, Adzuna, Browserbase, PostHog, BYOK secret).
- Docker Desktop only needed for a **local** image smoke test (optional).

### 1. Push the code

Commit and push `Dockerfile`, `.dockerignore`, `render.yaml`, and `next.config.ts` (`output: "standalone"`) to GitHub.

### 2. Create the service

**Option A — Blueprint (recommended)**

1. Render Dashboard → **New** → **Blueprint**.
2. Connect the GitHub repo / branch.
3. Render reads `render.yaml` (`job-flow` web service, Docker, starter plan).
4. For each `sync: false` variable, paste the secret when prompted (or add them after create).

**Option B — Manual Docker web service**

1. **New** → **Web Service** → connect repo.
2. Runtime: **Docker** (Dockerfile path `./Dockerfile`, context `.`).
3. Pick a plan that stays up if you need long Company Research (free instances sleep).

### 3. Set environment variables

In **Environment**, set everything from `.env.sample` **Shared** + **Render**.

**Must be present at Docker build** (inlined into the browser bundle):

- `NEXT_PUBLIC_INSFORGE_URL`
- `NEXT_PUBLIC_INSFORGE_ANON_KEY`
- `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`
- `NEXT_PUBLIC_POSTHOG_HOST` (e.g. `https://us.i.posthog.com`)
- `NEXT_PUBLIC_RESEARCH_TIMEOUT_CLAMP` = `no_clamp`
- `NEXT_PUBLIC_RESEARCH_CLIENT_TIMEOUT_MS` = `750000`

On Render Docker, dashboard env vars are available at **build and runtime**, so setting them once is enough.

**Runtime secrets / server** (never commit):

- `APP_ENV` = `production`
- `OPENROUTER_API_KEYS` (or `OPENROUTER_API_KEY`)
- `BYOK_ENCRYPTION_SECRET`
- `REDIS_URL`
- `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`
- `BROWSERBASE_API_KEY` / `BROWSERBASE_PROJECT_ID`
- `POSTHOG_PERSONAL_API_KEY` / `POSTHOG_PROJECT_ID`
- `AI_PROVIDER` = `openrouter`, `AI_MODEL` = `openrouter/free`

**Research timeouts** (Blueprint already sets these; confirm if you used Option B):

```text
RESEARCH_TIMEOUT_CLAMP=no_clamp
NEXT_PUBLIC_RESEARCH_TIMEOUT_CLAMP=no_clamp
BROWSERBASE_SESSION_TIMEOUT_SEC=780
RESEARCH_OVERALL_TIMEOUT_MS=720000
RESEARCH_GOTO_TIMEOUT_MS=60000
RESEARCH_EXTRACT_TIMEOUT_MS=180000
NEXT_PUBLIC_RESEARCH_CLIENT_TIMEOUT_MS=750000
```

Do **not** use the Vercel Hobby `clamp` / 285s values on Render.

### 4. Deploy

Trigger the first deploy (Blueprint apply or **Manual Deploy**). Wait until the service is **Live** and note the URL, e.g. `https://job-flow-xxxx.onrender.com`.

### 5. InsForge OAuth callback

In the InsForge dashboard, add to `allowedRedirectUrls`:

```text
https://YOUR-SERVICE.onrender.com/callback
```

Keep `http://localhost:3000/callback` for local dev.

### 6. Smoke-check

1. Open the Render URL → homepage loads.
2. Sign in (OAuth returns to `/callback`).
3. Profile / Find Jobs / a short Company Research run if Browserbase is configured.

### 7. Optional — local Docker smoke test

Start Docker Desktop, then:

```bash
docker build \
  --build-arg NEXT_PUBLIC_INSFORGE_URL=https://your.insforge.app \
  --build-arg NEXT_PUBLIC_INSFORGE_ANON_KEY=your-anon-key \
  --build-arg NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_xxx \
  --build-arg NEXT_PUBLIC_RESEARCH_TIMEOUT_CLAMP=no_clamp \
  -t job-flow .
docker run --rm -p 3000:3000 --env-file .env.local job-flow
```

---

## Deploy on Vercel (unchanged)

Vercel ignores Docker files. In the Vercel project env, use the **Vercel → Hobby** block in `.env.sample` (`RESEARCH_TIMEOUT_CLAMP=clamp`, ~285s budgets). Do not set Render’s `no_clamp` / 720000 values on Hobby or research will hit the 300s platform kill.
