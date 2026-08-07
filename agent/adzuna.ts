import type { createClient } from "@insforge/sdk";
import { generateObject } from "ai";

import {
    alignMatchScores,
    buildMatchScoreUserPrompt,
    extractModelTextFromError,
    fallbackMatchScores,
    healJobMatchScoresFromText,
    jobMatchScoresSchema,
    MATCH_SCORE_SYSTEM_PROMPT,
    type JobMatchScore,
} from "@/agent/match-score";
import {
    adzunaCurrencySymbol,
    detectAdzunaCountry,
    formatAdzunaSalary,
    searchAdzunaJobs,
    type AdzunaJob,
} from "@/lib/adzuna";
import {
    withOpenRouterKeyFailover,
    type OpenRouterFailoverOptions,
} from "@/lib/ai/provider";
import { errorMessage } from "@/lib/errors";
import type { Profile } from "@/types";

type InsforgeClient = ReturnType<typeof createClient>;

const MAX_OUTPUT_TOKENS = 8192;
/** Jobs per OpenRouter `generateObject` call (also drives Resume AI rate-limit hits). */
export const SCORE_BATCH_SIZE = 5;

export type DiscoverJobsResult =
  | {
      success: true;
      jobsFound: number;
      strongMatches: number;
      runId: string;
      message: string;
      matchScores: number[];
    }
  | { success: false; error: string; runId?: string };

/**
 * Optional hooks so Find Jobs can count Resume AI quota per successful AI batch
 * and fall back to skill-overlap when the pool is exhausted mid-search.
 */
export type MatchScoreRateLimitHooks = {
  /** Return false to skip AI for this batch (and typically remaining batches). */
  canUseAi?: () => Promise<boolean>;
  /** After scores come from generateObject or healed model text (not pure fallback). */
  onSuccessfulAiBatch?: () => Promise<void>;
};

export type DiscoverJobsOptions = {
  userId: string;
  jobTitle: string;
  location: string;
  profile: Profile;
  client: InsforgeClient;
  openRouter?: OpenRouterFailoverOptions;
  strongMatchThreshold?: number;
  searchJobs?: typeof searchAdzunaJobs;
  scoreJobs?: (
    profile: Profile,
    jobs: AdzunaJob[],
    openRouter?: OpenRouterFailoverOptions,
  ) => Promise<JobMatchScore[]>;
  /** Applied when using default `scoreJobsAgainstProfile` (ignored if `scoreJobs` is injected). */
  scoreRateLimit?: MatchScoreRateLimitHooks;
};

async function insertAgentLog(
  client: InsforgeClient,
  input: {
    runId: string;
    userId: string;
    message: string;
    level: "info" | "success" | "warning" | "error";
    jobId?: string | null;
  },
): Promise<void> {
  const { error } = await client.database.from("agent_logs").insert([
    {
      run_id: input.runId,
      user_id: input.userId,
      message: input.message,
      level: input.level,
      job_id: input.jobId ?? null,
    },
  ]);

  if (error) {
    console.error("[agent/adzuna] agent_logs", errorMessage(error));
  }
}

async function scoreJobBatch(
  profile: Profile,
  jobs: AdzunaJob[],
  openRouter?: OpenRouterFailoverOptions,
  rateLimit?: MatchScoreRateLimitHooks,
): Promise<JobMatchScore[]> {
  if (jobs.length === 0) return [];

  try {
    const object = await withOpenRouterKeyFailover(async (model) => {
      const result = await generateObject({
        model,
        schema: jobMatchScoresSchema,
        system: MATCH_SCORE_SYSTEM_PROMPT,
        prompt: buildMatchScoreUserPrompt(profile, jobs),
        temperature: 0.3,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      });
      return result.object;
    }, openRouter);

    await rateLimit?.onSuccessfulAiBatch?.();
    return alignMatchScores(jobs, object, profile.skills);
  } catch (error) {
    const modelText = extractModelTextFromError(error);
    if (modelText) {
      const healed = healJobMatchScoresFromText(modelText);
      if (healed) {
        console.warn(
          "[agent/adzuna] AI scoring parse failed; healed model text",
        );
        await rateLimit?.onSuccessfulAiBatch?.();
        return alignMatchScores(jobs, healed, profile.skills);
      }
    }

    console.warn(
      "[agent/adzuna] AI scoring failed; using skill overlap fallback",
      error,
    );
    return fallbackMatchScores(jobs, profile);
  }
}

/**
 * Score Adzuna listings against the profile (batched generateObject + heal/fallback).
 * When `rateLimit.canUseAi` returns false, remaining batches use skill-overlap only (no AI hit).
 */
export async function scoreJobsAgainstProfile(
  profile: Profile,
  jobs: AdzunaJob[],
  openRouter?: OpenRouterFailoverOptions,
  rateLimit?: MatchScoreRateLimitHooks,
): Promise<JobMatchScore[]> {
  if (jobs.length === 0) return [];

  const scores: JobMatchScore[] = [];
  let aiEnabled = true;

  for (let start = 0; start < jobs.length; start += SCORE_BATCH_SIZE) {
    const batch = jobs.slice(start, start + SCORE_BATCH_SIZE);

    if (aiEnabled && rateLimit?.canUseAi) {
      aiEnabled = await rateLimit.canUseAi();
    }

    if (!aiEnabled) {
      scores.push(...fallbackMatchScores(batch, profile));
      continue;
    }

    const batchScores = await scoreJobBatch(
      profile,
      batch,
      openRouter,
      rateLimit,
    );
    scores.push(...batchScores);
  }
  return scores;
}

function buildJobInsertRow(input: {
  userId: string;
  runId: string;
  job: AdzunaJob;
  score: JobMatchScore;
  currencySymbol: string;
}) {
  return {
    user_id: input.userId,
    run_id: input.runId,
    source: "search" as const,
    source_url: input.job.redirect_url,
    external_apply_url: input.job.redirect_url,
    title: input.job.title,
    company: input.job.company.display_name,
    location: input.job.location.display_name,
    salary: formatAdzunaSalary(
      input.job.salary_min,
      input.job.salary_max,
      input.currencySymbol,
    ),
    job_type: input.job.contract_type || "fulltime",
    about_role: input.job.description,
    responsibilities: [] as string[],
    requirements: [] as string[],
    nice_to_have: [] as string[],
    benefits: [] as string[],
    about_company: null as string | null,
    match_score: input.score.matchScore,
    match_reason: input.score.matchReason,
    matched_skills: input.score.matchedSkills,
    missing_skills: input.score.missingSkills,
    company_research: null,
    researched_at: null as string | null,
    found_at: new Date().toISOString(),
  };
}

/**
 * Adzuna discovery + profile match scoring + DB persistence for one agent run.
 */
export async function discoverJobs(
  options: DiscoverJobsOptions,
): Promise<DiscoverJobsResult> {
  const jobTitle = options.jobTitle.trim();
  const location = options.location.trim();
  const threshold = options.strongMatchThreshold ?? 70;
  const search = options.searchJobs ?? searchAdzunaJobs;

  if (!jobTitle) {
    return { success: false, error: "Job title is required." };
  }

  const { data: runRow, error: runError } = await options.client.database
    .from("agent_runs")
    .insert([
      {
        user_id: options.userId,
        status: "running",
        job_title_searched: jobTitle,
        location_searched: location || null,
        jobs_found: 0,
      },
    ])
    .select("id")
    .single();

  if (runError || !runRow || typeof runRow !== "object") {
    console.error("[agent/adzuna] create run", runError);
    return {
      success: false,
      error: "Could not start job search. Please try again.",
    };
  }

  const runId = String((runRow as { id: string }).id);

  try {
    await insertAgentLog(options.client, {
      runId,
      userId: options.userId,
      message: `Searching Adzuna for "${jobTitle}"${location ? ` in ${location}` : ""}`,
      level: "info",
    });

    const country = detectAdzunaCountry(location);
    const currencySymbol = adzunaCurrencySymbol(country);

    const adzunaJobs = await search({
      jobTitle,
      location,
      country,
    });

    await insertAgentLog(options.client, {
      runId,
      userId: options.userId,
      message: `Adzuna returned ${adzunaJobs.length} listing(s)`,
      level: "info",
    });

    const scores = options.scoreJobs
      ? await options.scoreJobs(
          options.profile,
          adzunaJobs,
          options.openRouter,
        )
      : await scoreJobsAgainstProfile(
          options.profile,
          adzunaJobs,
          options.openRouter,
          options.scoreRateLimit,
        );

    const rows = adzunaJobs.map((job, index) =>
      buildJobInsertRow({
        userId: options.userId,
        runId,
        job,
        score: scores[index] ?? fallbackMatchScores([job], options.profile)[0]!,
        currencySymbol,
      }),
    );

    if (rows.length > 0) {
      const { error: insertError } = await options.client.database
        .from("jobs")
        .insert(rows);

      if (insertError) {
        console.error("[agent/adzuna] insert jobs", insertError);
        throw new Error("Failed to save discovered jobs");
      }
    }

    const strongMatches = rows.filter(
      (row) => (row.match_score ?? 0) >= threshold,
    ).length;
    const jobsFound = rows.length;
    const jobWord = jobsFound === 1 ? "job" : "jobs";
    const strongWord = strongMatches === 1 ? "strong match" : "strong matches";
    const message = `Found and saved ${jobsFound} ${jobWord} · ${strongMatches} ${strongWord} (70%+).`;

    const { error: completeError } = await options.client.database
      .from("agent_runs")
      .update({
        status: "completed",
        jobs_found: jobsFound,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);

    if (completeError) {
      console.error("[agent/adzuna] complete run", completeError);
      throw new Error("Failed to complete job search run");
    }

    await insertAgentLog(options.client, {
      runId,
      userId: options.userId,
      message,
      level: "success",
    });

    return {
      success: true,
      jobsFound,
      strongMatches,
      runId,
      message,
      matchScores: rows.map((row) => row.match_score),
    };
  } catch (error) {
    const message = errorMessage(error);
    console.error("[agent/adzuna] discover failed", error);

    await options.client.database
      .from("agent_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);

    await insertAgentLog(options.client, {
      runId,
      userId: options.userId,
      message: `Job search failed: ${message}`,
      level: "error",
    });

    return {
      success: false,
      error:
        message.includes("Adzuna") || message.includes("credentials")
          ? "Job search is temporarily unavailable. Please try again later."
          : "Could not complete job search. Please try again.",
      runId,
    };
  }
}
