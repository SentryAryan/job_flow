# Library Docs

Project-specific usage patterns for every third party library in this project. This file only covers how we use each library in this specific project — rules, patterns, and constraints specific to Job Flow.

Read the relevant section before implementing any feature that touches these libraries.

---

## Before Using Any Library

Before implementing any feature that uses a third party library:

1. **Check AGENTS.md** at the project root — it lists every skill installed for this project and how to use them. Skills contain up-to-date API documentation, usage patterns, and best practices specific to this codebase.

2. **Check if an MCP server is configured** for that library. Some tools have MCP servers that give the AI agent direct access to documentation, logs, and debugging tools. If an MCP server is available — use it before falling back to general knowledge.

3. **Read this file** for project-specific patterns that override general library knowledge.

The order of authority is:

```
MCP server (real-time docs) → Skills via AGENTS.md → This file (project rules) → General training knowledge
```

Never rely on general training knowledge alone for library APIs — they change frequently and training data may be outdated.

---

## InsForge

**Check first:** Check AGENTS.md for an installed InsForge skill. If an InsForge MCP server is configured — use it. The skill/MCP will have the latest API patterns.

### Client (browser-first)

`@insforge/ssr` does not exist. Use the real `@insforge/sdk` browser client — a single shared instance:

```typescript
// lib/insforge-client.ts
import { createClient } from "@insforge/sdk";

export const insforge = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
});
```

The SDK keeps the access token in memory plus a httpOnly refresh cookie, so the session survives reloads via `auth.getCurrentUser()`.

**Rules:**

- Import the browser client from `@/lib/insforge-client` in Client Components.
- Default SDK timeout is 30s — this project sets `timeout: 90000` via `NEXT_PUBLIC_INSFORGE_TIMEOUT_MS` so storage uploads to ap-southeast do not abort early.
- Server-side InsForge access for agent API routes is still open — there is no `createServerClient` cookie helper. **Feature 06 decision:** profile load/save/resume upload use the browser-authenticated `@insforge/sdk` client in `lib/profile.ts` (RLS via session JWT). Agent API routes (Feature 10) must still use a server JWT-forwarding pattern — never bypass RLS with a shared anon client for multi-table agent inserts.

---

### Auth

Browser-first. React auth state comes from a custom context (`components/auth/AuthProvider.tsx`) exposing `useUser(): { user, isLoaded, signOut }`. `@insforge/react` is deprecated and not used.

```typescript
// OAuth sign in (client)
await insforge.auth.signInWithOAuth("google", {
  redirectTo: `${window.location.origin}/callback`,
});

// Current user — hydration + automatic OAuth code exchange
const { data, error } = await insforge.auth.getCurrentUser();
const user = data?.user ?? null;

// Sign out
await insforge.auth.signOut();

// React state inside any Client Component
const { user, isLoaded } = useUser();
```

Route protection is client-side via `AuthGuard` (`components/auth/AuthGuard.tsx`) — there is no middleware.

### Authed Next.js API calls (Bearer JWT)

Server routes verify JWTs with `requireAuth` (`lib/api-auth.ts`). That path seeds a **static** `accessToken` client (no cookie refresh). Expired Bearer tokens therefore always return 401.

**Always** call those routes through `authedFetch` (`lib/authed-fetch.ts`), not raw `fetch` + `getValidAccessToken()`:

```typescript
import { authedFetch } from "@/lib/authed-fetch";

const response = await authedFetch("/api/resume/generate", { method: "POST" });
```

Behavior:

1. `getAccessTokenForApi` (`lib/auth-access-token.ts`) reads a token with a 120s exp leeway and falls back to `auth.refreshSession()` when the SDK would otherwise return an already-expired JWT.
2. On HTTP 401, force-refresh once and retry the request (FormData bodies are reusable).
3. Concurrent refreshes share one in-flight promise.

`AuthProvider` also refreshes proactively on tab focus / visibility and on an 8-minute interval so idle tabs do not keep a dead access JWT.

Do **not** use `authedFetch` for InsForge SDK calls (`insforge.database` / storage) — the SDK refreshes on its own HTTP path.

---

### DB Queries

> Note: predates the real SDK — to be corrected in Features 06+. The real accessor is `insforge.database.from("table")...` (not `insforge.from(...)`). The PostgREST filters/modifiers shown (`.select`, `.eq`, `.order`, `.range`, `.single`) are accurate.

```typescript
// Read
const { data, error } = await insforge
  .from("jobs")
  .select("*")
  .eq("user_id", user.id)
  .order("found_at", { ascending: false });

// Insert
const { data, error } = await insforge
  .from("jobs")
  .insert({ user_id: user.id, title, company, match_score })
  .select()
  .single();

// Update
const { error } = await insforge
  .from("jobs")
  .update({ company_research: dossier })
  .eq("id", jobId)
  .eq("user_id", user.id); // always scope to user
```

**Rules:**

- Always scope queries to `user_id` — never query without user filter
- Always handle the `error` return — never assume success
- Use `.single()` when expecting exactly one row

---

### Storage

> Real API: `insforge.storage.from("resumes").upload(path, file)` returns `{ data, error }` with `data.url` and `data.key`. The `resumes` bucket is **private** — use authenticated download or a signed URL, not a public URL. Buckets are created with InsForge MCP tools.

```typescript
// Upload first — InsForge may auto-rename on key collision. Persist data.url,
// then best-effort remove the previous object key (never delete before upload).
const key = `${userId}/resume.pdf`;
const { data, error } = await insforge.storage
  .from("resumes")
  .upload(key, file);

await insforge.database
  .from("profiles")
  .update({ resume_pdf_url: data?.url ?? null })
  .eq("id", userId);

// Then remove stale prior keys parsed from the old resume_pdf_url when different.

// Download (private bucket — requires authenticated session)
const key = extractStorageObjectKey(profile.resume_pdf_url!) ?? `${userId}/resume.pdf`;
const { data: blob, error: downloadError } = await insforge.storage
  .from("resumes")
  .download(key);
// View/preview: createObjectURL after normalizing blob type to application/pdf,
// then render in an iframe (inline + Expand modal). Do not window.open after await —
// that loses the user gesture and gets popup-blocked; untyped blobs download as UUID files.
```

**Storage paths:**

- Bucket: `resumes`
- Object key: `{user_id}/resume.pdf` (do **not** use `resumes/{user_id}/resume.pdf` as the key)

**Rules:**

- Upload before delete — never remove the existing resume until the new upload succeeds (InsForge auto-renames on collision; use returned `data.url` / `data.key`)
- After a successful upload + DB update, best-effort `remove` stale prior keys from the old `resume_pdf_url`
- Never use `uploadAuto()` — auto keys fail storage RLS
- Always save `data.url` (and prefer `data.key` when download/delete is needed) back to the DB after upload
- Never write files to disk — always upload buffer directly to storage

---

## Adzuna API

**Check first:** Check AGENTS.md for an installed Adzuna skill. If none exists — use this file and the official Adzuna API docs.

### Job Search

```typescript
// lib/adzuna.ts
export async function searchJobs(
  jobTitle: string,
  location: string,
  country: string = "us",
): Promise<AdzunaJob[]> {
  const params = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID!,
    app_key: process.env.ADZUNA_APP_KEY!,
    what: jobTitle,
    results_per_page: "10",
    "content-type": "application/json",
  });

  // Only add where if location is provided
  if (location) {
    params.set("where", location);
  }

  const response = await fetch(
    `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`,
  );

  if (!response.ok) {
    throw new Error(`Adzuna API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results || [];
}
```

### Response Shape

Each Adzuna job result contains:

```typescript
type AdzunaJob = {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  description: string; // snippet only — not full description
  redirect_url: string; // Adzuna tracking URL → redirects to actual job
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted: "0" | "1"; // "1" means salary is estimated
  contract_type?: string;
  created: string; // ISO date string
  category: { tag: string; label: string };
};
```

### Saving Jobs to DB

```typescript
// Map Adzuna result to jobs table
const jobRecord = {
  user_id: userId,
  run_id: runId,
  source: "search", // always 'search' for Adzuna jobs
  source_url: job.redirect_url,
  external_apply_url: job.redirect_url,
  title: job.title,
  company: job.company.display_name,
  location: job.location.display_name,
  salary: job.salary_min
    ? `$${Math.round(job.salary_min / 1000)}k - $${Math.round(job.salary_max! / 1000)}k`
    : null,
  job_type: job.contract_type || "fulltime",
  about_role: job.description, // Adzuna returns snippet — used as description
  match_score: scoredJob.matchScore,
  match_reason: scoredJob.matchReason,
  matched_skills: scoredJob.matchedSkills,
  missing_skills: scoredJob.missingSkills,
  found_at: new Date().toISOString(),
};
```

**Rules:**

- Do **not** send Adzuna `category` — search by `what` (title) and optional `where` (location) across all sectors
- Never pass `where` if location is empty — omit the parameter entirely
- `source` is always `'search'` for Adzuna jobs — never any other value
- `salary_is_predicted: "1"` means Adzuna estimated the salary — this is normal
- Adzuna description is a snippet — GPT-4o scores from it, not a full description
- Default country to `'us'` — support `gb`, `au`, `ca` as alternatives

---

## Browserbase

**Check first:** Check AGENTS.md for an installed Browserbase skill. If a Browserbase MCP server is configured — use it. The skill/MCP will have the latest session management and API patterns.

### Session Creation — Company Research

```typescript
import Browserbase from "@browserbasehq/sdk";

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });

// Single session for company research — sequential page visits
const session = await bb.sessions.create({
  projectId: process.env.BROWSERBASE_PROJECT_ID!,
  // Default 285s (Hobby maxDuration headroom); override via BROWSERBASE_SESSION_TIMEOUT_SEC
  timeout: Number(process.env.BROWSERBASE_SESSION_TIMEOUT_SEC ?? 285),
});
```

**Important — Feature 13 awaits the full browse + synthesis in the API route** then returns the dossier. Always `await stagehand.close()` in `finally`. Do not fire-and-forget the Browserbase session.

**Env:** `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID` (server-only). Optional clamp: `RESEARCH_TIMEOUT_CLAMP` / `NEXT_PUBLIC_RESEARCH_TIMEOUT_CLAMP` (`clamp` default → Hobby 300s caps; `no_clamp` → long-running / Pro). Budgets: `BROWSERBASE_SESSION_TIMEOUT_SEC`, `RESEARCH_OVERALL_TIMEOUT_MS`, `RESEARCH_GOTO_TIMEOUT_MS`, `RESEARCH_EXTRACT_TIMEOUT_MS`, `NEXT_PUBLIC_RESEARCH_CLIENT_TIMEOUT_MS`, optional `RESEARCH_ROUTE_MAX_DURATION_SEC` when unclamped. Hobby defaults ≈ 285s session / 270s overall / 60s extract / 285s client; `no_clamp` defaults ≈ 780s / 720s / 180s / 750s.

**Rules:**

- Always use single sessions — never parallel sessions (free plan limit)
- Session timeout follows clamp mode — Hobby-safe when clamped; longer with `no_clamp` + env overrides
- After each `page.goto`, detect Chrome error pages and hard bot walls (`ERR_SSL_*`, Access Denied, `chrome-error://`) via `agent/research-nav.ts` and **skip extract**. Dedicated auth titles (`Sign In / Register`) and denylist paths also skip; do **not** treat ambient “Sign in” in page body as unusable
- Bound hung `goto` / `extract` / overall research with `withTimeout` (`lib/research-timeouts.ts`); overall timeout still returns a degraded dossier
- Always end sessions cleanly — call `stagehand.close()` when done
- Project ID always from `process.env.BROWSERBASE_PROJECT_ID` — never hardcode
- Browserbase client lives in `lib/browserbase.ts` — always import from there (`createResearchBrowserSession`)

---

## Stagehand

**Check first:** Check AGENTS.md for an installed Stagehand skill. If a Stagehand MCP server is configured — use it. The skill/MCP will have the latest act() and extract() patterns.

### Initialisation

```typescript
import { Stagehand } from "@browserbasehq/stagehand";
import { createResearchStagehand } from "@/lib/stagehand";

// Prefer lib/stagehand.ts — OpenRouter via CustomOpenAIClient (not AI SDK provider parse)
const stagehand = await createResearchStagehand({
  sessionId: session.id,
  openRouterApiKey: key,
});
// Uses AI_MODEL (default openrouter/free) + OpenAI SDK baseURL https://openrouter.ai/api/v1
// Do NOT pass modelName "openrouter/…" through Stagehand's model: config — unsupported provider.
// Homepage schema pageLinks.url MUST be z.url() (Zod 4) so Stagehand ID→href injection runs.
```

### extract() (Stagehand v3)

```typescript
const result = await stagehand.extract(
  "Extract the company overview…",
  z.object({
    oneLiner: z.string(),
    productSummary: z.string(),
    // …
  }),
);
```

Navigate with `stagehand.context.activePage()!.goto(url)`.

### act()

```typescript
// Always wrap in try/catch
try {
  await stagehand.act({
    action: "Click the About link in the navigation",
  });
} catch (error) {
  await logAgentError(jobId, null, error);
}
```

## Company Research Section

Replace the existing Stagehand "Company Research Pattern" section in library-docs.md with this:

---

### Company Research Pattern

Three-step process: homepage extraction → sub-page extraction → GPT-4o synthesis.
Job description and user profile come from DB — never re-fetch what you already have.
Browser's only job is the company website.

```typescript
// Step 1 — Homepage extraction
const homepageData = await stagehand.extract({
  instruction:
    "This is a company's homepage. Capture what the company actually does, who it's for, and any concrete signals (funding, customers, scale, mission, recent launches). Then find the internal links most worth visiting to research them as an employer.",
  schema: z.object({
    oneLiner: z.string().describe("What the company does in one sentence"),
    productSummary: z
      .string()
      .describe("What they build/sell and who it's for"),
    signals: z
      .array(z.string())
      .describe("Funding, notable customers, scale, mission, recent news"),
    pageLinks: z
      .array(
        z.object({
          url: z.string(),
          kind: z.enum([
            "about",
            "careers",
            "blog",
            "engineering",
            "product",
            "team",
            "other",
          ]),
        }),
      )
      .describe("Internal links worth visiting"),
  }),
});

// If oneLiner and productSummary are empty — wrong site or parked domain
// Skip to synthesis with job description and profile only
if (!homepageData.oneLiner && !homepageData.productSummary) {
  await stagehand.close();
  // proceed to synthesis with empty companyResearch
}

// Step 2 — Sub-page extraction (max 3, prefer about/blog/engineering/product over careers)
const subPageData = await stagehand.extract({
  instruction:
    "Extract substance that helps a candidate understand this company before applying: what they do, their values and how they work, the specific technologies and tools they use, notable projects or customers, and how the team operates. Ignore nav, footers, cookie banners, and generic marketing copy.",
  schema: z.object({
    keyPoints: z.array(z.string()),
    technologies: z
      .array(z.string())
      .describe("Specific languages, frameworks, tools, platforms"),
    valuesOrCulture: z
      .array(z.string())
      .describe("Stated values, working style, team norms"),
    notable: z
      .array(z.string())
      .describe("Customers, funding, scale, projects, awards"),
  }),
});

// Step 3 — GPT-4o synthesis (after browser closes)
// Feed three data sources: company research + job from DB + profile from DB
const systemPrompt = `You are a sharp career strategist preparing a candidate to apply for a specific role. You are given (a) research collected from the company's own website, (b) the job posting, and (c) the candidate's profile. Produce a concise, concrete briefing that gives this specific candidate an edge for this specific role.

Rules:
- Ground every company claim in the provided research or job posting. Never invent funding, customers, headcount, or facts. If research was thin, infer carefully from the job posting and say what's inferred.
- Be specific to THIS candidate. Connect their actual skills and past work to this company's stack, product, and values. No generic advice that would apply to anyone.
- Turn the candidate's missing skills into a strategy: how to frame the gap honestly and what adjacent experience to lean on.
- Talking points and questions must reference real things from the research, the kind of detail that signals the candidate did their homework.
- Keep every item tight: one or two sentences. No fluff.

Return ONLY valid JSON matching this shape:
{
  "companyOverview": string,
  "techStack": string[],
  "culture": string[],
  "whyThisRole": string,
  "yourEdge": string[],
  "gapsToAddress": string[],
  "smartQuestions": string[],
  "interviewPrep": string[],
  "sources": string[]
}`;

const userPrompt = `COMPANY RESEARCH (from their website):
${JSON.stringify(companyResearch)}

JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description}
Matched skills (already computed): ${job.matched_skills.join(", ")}
Missing skills (already computed): ${job.missing_skills.join(", ")}

CANDIDATE PROFILE:
Current title: ${profile.current_title}
Experience: ${profile.years_experience} years, level ${profile.experience_level}
Skills: ${profile.skills.join(", ")}
Work history: ${JSON.stringify(profile.work_experience)}`;

const response = await openai.chat.completions.create({
  model: "gpt-4o",
  response_format: { type: "json_object" },
  temperature: 0.4,
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ],
});
```

**Dossier fields:**

| Field           | Type     | Purpose                                             |
| --------------- | -------- | --------------------------------------------------- |
| companyOverview | string   | What the company does                               |
| techStack       | string[] | Technologies they use                               |
| culture         | string[] | Values and working style                            |
| whyThisRole     | string   | Why this role exists                                |
| yourEdge        | string[] | Specific links between THIS candidate and this role |
| gapsToAddress   | string[] | Missing skills reframed as strategy                 |
| smartQuestions  | string[] | Questions that show real research                   |
| interviewPrep   | string[] | Topics to prepare for this role                     |
| sources         | string[] | Pages the company info came from                    |

**Rules:**

- Always use `extract()` with a Zod schema — never parse raw HTML or use regex
- Always wrap every `act()` and `extract()` in try/catch
- Always call `await stagehand.close()` when done — ends the Browserbase session
- Model is always `gpt-4o` — never use other models
- Temperature is `0.3` for research synthesis (project AI rule) — grounded, specific to the candidate
- Max 3 sub-pages — never exceed this on free plan
- Always close session in finally block — never leave sessions open even if research fails
- Job description and profile always come from DB — never re-fetch via browser
- If browser research returns empty — still run synthesis with job + profile only (`agent/research.ts`)
- Synthesis uses AI SDK `generateObject` + OpenRouter (`lib/ai/provider.ts`), not raw `openai`
- Stagehand LLM via OpenRouter `CustomOpenAIClient` (`lib/stagehand.ts`) — bypasses unsupported AI SDK `openrouter` provider; each `createChatCompletion` increments `ResearchLlmMeter` via `onLlmCall`
- Homepage `pageLinks.url` must be `z.url()` (Zod 4; Stagehand ID→href inject); normalize + `/about|/careers|/who-we-are` fallbacks in `agent/research-links.ts`
- Stagehand OpenRouter client wraps `chat.completions.create` to heal null `message.content` from `reasoning` / `reasoning_details` before Stagehand validates
- Mid-research quota: peek Redis remaining − unflushed `ResearchLlmMeter`; skip extracts when effective &lt; 3, skip synthesis AI when &lt; 1; flush via `enforceResumeAiRateLimitHitsCapped`
- Synthesis heals alternate free-model JSON shapes (`healCompanyResearchFromText`); richer job/profile fallback + `degraded` flag when heal fails
- yourEdge, gapsToAddress, and smartQuestions are the most valuable fields — never skip them

## Vercel AI SDK + OpenRouter

**Packages:** `ai`, `@openrouter/ai-sdk-provider`

**Check first:** Prefer `lib/ai/provider.ts` — never hardcode a provider at call sites.

### Structured extraction (Feature 07)

```typescript
import { generateObject } from "ai";
import { withOpenRouterKeyFailover } from "@/lib/ai/provider";
import { profileExtractSchema } from "@/lib/resume-extract";

const { object } = await withOpenRouterKeyFailover((model) =>
  generateObject({
    model,
    schema: profileExtractSchema,
    temperature: 0.3,
    maxOutputTokens: 800,
    system: "Extract profile fields…",
    prompt: `Resume text:\n\n${text}`,
  }),
);
```

**Env (server-only):**

- `OPENROUTER_API_KEYS` — preferred; comma / semicolon / newline-separated keys for in-request failover on 429/quota
- `OPENROUTER_API_KEY` — single-key fallback (still supported if `OPENROUTER_API_KEYS` is unset)
- `AI_PROVIDER` — default `openrouter`
- `AI_MODEL` — default `openrouter/free` (free models router only)
- `APP_ENV` — `development`/`dev` skips **429 enforcement**; `production`/`prod` enforces shared Resume AI limits (falls back to `NODE_ENV` if unset). When `REDIS_URL` is set, hits are still recorded in any env so the usage card works.
- `REDIS_URL` — required in production/prod for distributed Resume AI rate limits (Redis sliding-window sorted sets — not pub/sub). Usage card hides when Redis is unavailable.
- `RESUME_AI_RATE_LIMIT_PER_MINUTE` — default `3`
- `RESUME_AI_RATE_LIMIT_PER_HOUR` — default `15`
- `RESUME_AI_RATE_LIMIT_PER_DAY` — default `40`
- `RESUME_AI_IP_RATE_LIMIT_PER_MINUTE` — default `10` (per-IP abuse backstop)
- `RESUME_AI_IP_RATE_LIMIT_PER_HOUR` — default `45`
- `RESUME_AI_IP_RATE_LIMIT_PER_DAY` — default `120`
- `BYOK_ENCRYPTION_SECRET` — server-only AES-256-GCM secret for encrypting user OpenRouter keys (`profiles.openrouter_keys_enc`). Required when BYOK is used; missing secret → `503` on encrypt/decrypt (fail closed).

**Shared Resume AI rate limits (Extract + Generate + Find Jobs + Company Research):**

- One pool per authenticated user: Redis key `resume-ai:{userId}` (`lib/resume-ai-rate-limit.ts`)
- **Deploy note:** this namespace replaced the older `resume-extract:{userId}` keys — counters reset once on deploy; old Redis keys expire via their sliding windows
- Windows from env via `getResumeAiRateWindows()` in `lib/rate-limit.ts`
- Returns `429` with `Retry-After` / `X-RateLimit-*` headers when exceeded **in production only**
- Missing `REDIS_URL` in production → `503` (fail closed)
- Usage peek: `GET /api/resume/usage` (auth, no hit) + profile `ResumeAiUsageCard` (60s poll + refresh)
- Usage card hidden (`available: false`) in development/`dev` **or** when the user has ≥1 BYOK key
- **Extract / Generate:** admit with `admitResumeAiUserQuota` (peek only); record **one hit only after a successful response** — 429 / failed AI does not increment usage
- **Company Research:** fixed **5** Redis hits per admitted request (requires `remaining >= 5`); OpenRouter hard-capped at 5 via `ResearchLlmMeter` (`RESEARCH_MAX_OPENROUTER_CALLS`); flush via `enforceResumeAiRateLimitHitsCapped`; storefront domains map to corporate about URLs (redirect + name fallback); skip Access Denied / auth-wall titles / account-cart URLs before extract (not ambient nav “Sign in”)

**Per-IP Resume AI rate limits (abuse backstop):**

- Second Redis pool keyed by hashed client IP: `resume-ai-ip:{sha256(ip)[0:32]}` (`enforceResumeAiIpRateLimit`, `lib/client-ip.ts`)
- Applied on Extract / Generate / Find Jobs / Company Research **after auth, before** the per-user pool — **1 hit per request**
- Always applies when `REDIS_URL` is set, **including BYOK users**
- Windows from `getResumeAiIpRateWindows()`; defaults 10 / min, 45 / hour, 120 / day
- Same production 429 rules as the user pool
- Not shown in the Navbar/profile usage card

**Company Research agent:**

- `POST /api/agent/research` `{ jobId }` — `agent/research.ts` + Browserbase/Stagehand + OpenRouter synthesis (`maxDuration` from clamp mode: Hobby **300** / `no_clamp` **800**)
- After `goto`, skip LLM extract on unusable pages (Chrome SSL, Access Denied / bot walls, **auth-wall titles** like `Sign In / Register`, denylisted `/login|/account|/cart|…` via `agent/research-nav.ts`). Ambient “Sign in” in retailer nav chrome does **not** skip extract
- Prefer About/Careers/Team/Engineering/Blog; **max 1** sub-page; hard-cap OpenRouter at 5; fixed Redis charge of 5 when admitted
- Sub-page: retry once on extract timeout; skip when remaining overall budget is tight; skip rich homepage + tight retry budget (`lib/research-browse-policy.ts`)
- Logging: Pino (`lib/logger.ts`) — short events only (pages extracted / used in dossier); Stagehand `verbose: 0` + quiet logger (no DOM dumps)
- Budgets in `lib/research-timeouts.ts` via `RESEARCH_TIMEOUT_CLAMP`; overall timeout → degraded dossier
- Homepage derivation: `lib/company-homepage.ts` (20s fetch abort); known storefronts (Amazon → aboutamazon, etc.) override on redirect **and** company-name fallback
- Dossier saved to `jobs.company_research`; client fires PostHog `company_researched`; client AbortSignal follows clamp mode

**OpenRouter BYOK (profile):**

- UI: `OpenRouterKeysSection` on `/profile` → `GET/POST/DELETE /api/profile/openrouter-keys`
- On Add: format check + live OpenRouter `GET /api/v1/key` probe (`lib/openrouter-key-validate.ts`) before encrypt/save
- Ciphertext only in DB (`openrouter_keys_enc`); client sees masked `last4` + `id` (max 5 keys)
- When BYOK present: Extract/Generate/Find/Research use **only** user keys via `withOpenRouterKeyFailover({ keys })` (no platform fallback); **skip** shared per-user Redis rate limits (IP pool still applies)
- Invalid/exhausted BYOK keys → clear user error (`BYOK_KEYS_FAILED_USER_MESSAGE`); never fall back to platform keys
- Undecryptable stored rows (corrupt ciphertext or post-rotation leftovers) are skipped per key so users can still add/remove keys; missing `BYOK_ENCRYPTION_SECRET` still fails closed
- Helpers: `lib/byok-keys.ts`; migration `insforge/migrations/003_byok_openrouter_keys.sql`

**Rules:**

- Profile extraction uses `openrouter/free` with OpenRouter `response-healing` plugin
- Temperature `0.3` for extraction / matching / research synthesis; `0.7` for resume generation
- Max tokens for profile extraction: `800` (generate uses higher headroom for polished bullets)
- Validate with Zod (`profileExtractSchema` / `resumeGenerateSchema`) before merging or rendering
- Use `withOpenRouterKeyFailover` for LLM calls so rate-limited keys rotate automatically
- Reject non-PDF buffers via `%PDF` magic bytes; do not treat salary-only inference as a successful extract
- Swap providers by extending `lib/ai/provider.ts` — do not import OpenRouter elsewhere
- Do not install the raw `openai` package for app LLM calls; use the AI SDK

---

## Motion (`motion`)

**Package:** `motion` — import from `motion/react` only (do not also install `framer-motion`).

**Check first:** ECC motion-ui skill / Context7 Motion docs.

### Profile page usage

```typescript
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { motionTokens, fadeInUp } from "@/lib/motion-tokens";
```

**Rules:**

- Use Motion for state communication (loading strips, section entrance) — not decorative noise
- Always call `useReducedMotion()` and skip translate/height animation when reduced
- Prefer opacity fades; keep durations in `lib/motion-tokens.ts` (`fast` / `normal` / `slow`)
- Never add hover translate/scale on buttons (project preference)
- Client Components only (`"use client"`)

---

## shadcn/ui

**Config:** `components.json` (style `radix-nova`, base radix, CSS variables, lucide icons).

**Check first:** shadcn skill / `npx shadcn@latest docs <component>` / Context7.

### Adding components

```bash
npx shadcn@latest add button card dialog
```

Install into `components/ui/`. Do not hand-roll primitives that already exist in the registry.

### Theming (Job Flow tokens win)

- Brand / product colors live as `--jp-*` in `app/globals.css` and are exposed via `@theme` (`bg-accent`, `text-text-primary`, `border-border`, …).
- shadcn semantic vars (`--primary`, `--muted`, …) map onto Job Flow values in `:root`.
- **Do not** let `@theme inline` overwrite `--color-accent` / `--color-border` / `--color-background` with shadcn’s muted “accent” meaning — brand purple must stay `bg-accent`.
- Font: Inter via `--font-inter` → `--font-sans` (never Geist unless design changes).

### Project conventions on top of shadcn

- Prefer Job Flow Button variants: `primary` / `secondary` / `muted` / `danger` (aliases of shadcn defaults).
- `Button` may take `pending` for spinner + `aria-busy` (compose pattern kept for profile UX).
- Toasts: keep `components/ui/toaster.tsx` (token-styled Sonner) — do not swap to default shadcn sonner without matching bottom-right + semantic colors.
- **Always use shadcn registry components first** (`Select`, `Checkbox`, `Button`, `Input`, …). Do not use native `<select>`, `<button>`, or `<input type="checkbox">` when a shadcn counterpart exists. Style triggers/fields with Job Flow tokens — never invent a parallel native wrapper.
- Dropdowns: Radix `Select` + `SelectTrigger` / `SelectContent` / `SelectItem` (trigger chrome matches `Input`).
- Use `cn()` from `@/lib/utils` for class merges.
- Always `cursor-pointer` on clickable controls; no hover translate on buttons.

---

## Sonner (toasts)

**Package:** `sonner`

Host: `components/ui/toaster.tsx` mounted once in `app/providers.tsx`.

```typescript
import { toast } from "sonner";

toast.success("Profile saved");
toast.error("Failed to save profile");
```

**Rules:**

- Prefer Sonner for transient success/error feedback — do not add inline status text next to primary submit buttons for save confirmations.
- Style only via the shared `Toaster` (`unstyled` + token `classNames` + typed `icons`). Do not hardcode hex or default Tailwind palette colors on individual toasts.
- Keep `position="bottom-right"`. Icon circles: success green, error red, warning/info yellow (`bg-warning`).
- Call `toast.*` from Client Components only.

---

## PostHog

**Check first:** Check AGENTS.md for an installed PostHog skill. If a PostHog MCP server is configured — use it. The skill/MCP will have the latest client and server patterns.

### Client Setup (Browser)

```typescript
// lib/posthog-client.ts
import posthog from "posthog-js";

export function initPostHog() {
  if (typeof window !== "undefined") {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
      capture_pageview: false, // manual pageview tracking
    });
  }
}

// Capture event client-side
posthog.capture("job_found", {
  userId,
  source: "search",
  matchScore: score,
});
```

### Server Setup

```typescript
// lib/posthog-server.ts
import { PostHog } from "posthog-node";

export const createPostHogServer = () =>
  new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
    flushAt: 1, // send immediately
    flushInterval: 0, // no batching — Next.js functions are short-lived
  });

// Always use and shutdown in the same function
const posthog = createPostHogServer();
posthog.capture({
  distinctId: userId,
  event: "company_researched",
  properties: { userId, jobId, company },
});
await posthog.shutdown(); // required — ensures event is sent
```

**Rules:**

- Always call `await posthog.shutdown()` in server-side functions — events are lost without it
- `flushAt: 1` and `flushInterval: 0` always set on server client
- Event names must match exactly the list in `code-standards.md`
- Always include `userId` as a property on every server-side event
- Call `posthog.identify(userId)` after login on client side
- Call `posthog.reset()` on logout on client side

---

## @react-pdf/renderer

**Check first:** AGENTS.md / Context7 for `@react-pdf/renderer` (`renderToBuffer` is Node-only).

### Resume PDF Generation (Feature 08)

Layout lives in `lib/resume-pdf/DemoResumeDocument.tsx` — visual style matched to `context/templates/demo_resume.pdf` (Helvetica, uppercase section headers, pipe-separated contact, link row, black bullets). Content is built from the saved profile + AI polish (`lib/resume-generate.ts`); do not fill the binary template PDF.

```typescript
import { renderResumePdfBuffer } from "@/lib/resume-pdf/DemoResumeDocument";

const buffer = await renderResumePdfBuffer(pdfModel);
const file = new File([buffer], "resume.pdf", { type: "application/pdf" });
await client.storage.from("resumes").upload(`${userId}/resume.pdf`, file);
```

**Supported CSS properties:**
Only use these — others are silently ignored:
`padding, margin, fontSize, color, fontFamily, flexDirection, alignItems, justifyContent, borderRadius, width, height, fontWeight, textAlign, lineHeight`

**Rules:**

- Server-side only — never import in client components
- Always use `renderToBuffer` — not `renderToStream` or `PDFDownloadLink`
- PDF generation only in `app/api/resume/` routes
- Generated buffer uploaded as `File`/`Blob` to InsForge Storage — never written to disk
- Bucket is **private**; after upload save `resume_pdf_url` and preview via authenticated `fetchResumeBlob` (same as Feature 06 View/Download)
- Hard cap one A4 page (`wrap={false}`); omit empty sections; truncate roles/bullets/summary in `lib/resume-generate.ts`
- AI polish: temperature `0.7`, `openrouter/free` + `withOpenRouterKeyFailover` (same stack as extract)
---

## pdf-parse

**Check first:** Use `lib/pdf-text.ts` (Node only). pdf-parse v2 uses the `PDFParse` class.

### Extract Text from Uploaded Resume

```typescript
import { PDFParse } from "pdf-parse";

const parser = new PDFParse({ data: buffer });
try {
  // Prefer lib/pdf-text extractPdfContent — enables hyperlink recovery for LinkedIn/GitHub labels
  const pdfData = await parser.getText({ parseHyperlinks: true });
  const info = await parser.getInfo({ parsePageInfo: true });
  const extractedText = pdfData.text;
  const links = info.pages.flatMap((p) => p.links);
} finally {
  await parser.destroy();
}
```

**Rules:**

- Server-side only — never import in client components
- Route must use `export const runtime = "nodejs"`
- Use `extractPdfContent` from `lib/pdf-text.ts` (Node only) so embedded hyperlinks (e.g. "LinkedIn" / "GitHub" anchors) are appended as `EXTRACTED_HYPERLINKS` for AI + heuristics
- `pdfData.text` is raw unformatted text — the AI SDK handles structure extraction
- Always handle parse errors — some PDFs are image-based and return empty text
- If text is empty or shorter than 50 chars — return: "Could not extract text from this PDF. Please try a different file."
