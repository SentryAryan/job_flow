import type { createClient } from "@insforge/sdk";
import { generateObject } from "ai";

import {
    isNavigableHttpUrl,
    resolveSubPageTargets,
} from "@/agent/research-links";
import {
    isResearchDenylistUrl,
    isUnusableResearchPage,
    readPageNavSignals,
} from "@/agent/research-nav";
import {
    buildResearchSynthesisUserPrompt,
    companyResearchSchema,
    emptyDossierFallback,
    healCompanyResearchFromError,
    HOMEPAGE_EXTRACT_INSTRUCTION,
    homepageExtractSchema,
    isHomepageExtractThin,
    normalizeCompanyResearch,
    pickSubPageLinks,
    RESEARCH_SYNTHESIS_SYSTEM_PROMPT,
    SUBPAGE_EXTRACT_INSTRUCTION,
    subPageExtractSchema,
    type HomepageExtract,
    type SubPageExtract,
} from "@/agent/research-schemas";
import {
    withOpenRouterKeyFailover,
    type OpenRouterFailoverOptions,
} from "@/lib/ai/provider";
import { createResearchBrowserSession } from "@/lib/browserbase";
import {
    deriveCompanyHomepage,
    type DeriveHomepageResult,
} from "@/lib/company-homepage";
import { withTimeout } from "@/lib/errors";
import { getApplyUrl, mapDbRowToJob, type JobDbRow } from "@/lib/job-detail";
import { createLogger } from "@/lib/logger";
import { mapRowToProfile } from "@/lib/profile";
import {
    canAttemptSubPageExtract,
    remainingResearchMs,
    shouldSkipSubPageBecauseHomepageRich,
    withExtractRetry,
} from "@/lib/research-browse-policy";
import { ResearchLlmMeter } from "@/lib/research-llm-meter";
import {
    RESEARCH_USAGE_HITS,
    researchExtractTimeoutMs,
    researchGotoTimeoutMs,
    researchOverallTimeoutMs,
} from "@/lib/research-timeouts";
import {
    createResearchStagehand,
    type ResearchStagehandHandle,
} from "@/lib/stagehand";
import type { CompanyResearch, Job, Profile } from "@/types";

type InsforgeClient = ReturnType<typeof createClient>;

const log = createLogger("agent/research");

const MAX_OUTPUT_TOKENS = 4096;
const SYNTHESIS_TEMPERATURE = 0.3;

/**
 * Rate-limit hooks for Company Research LLM calls (Stagehand extracts + synthesis).
 * Route owns Redis; agent stays injectable/testable.
 */
export type ResearchRateLimitHooks = {
  /**
   * Return false to skip the next Stagehand extract (keep quota for synthesis).
   * Called before homepage and each sub-page extract.
   * Should subtract unflushed meter usage from Redis remaining.
   */
  canUseExtraExtract?: () => Promise<boolean>;
  /**
   * Return false to skip OpenRouter synthesis and use job/profile fallback.
   * Called after browse, before generateObject.
   */
  canUseSynthesis?: () => Promise<boolean>;
  /**
   * Record fixed usage hits for an admitted research request (Redis user pool).
   * Called once at the end of `researchCompany`. Meter is only for OpenRouter stop.
   */
  recordLlmHits?: (count: number) => Promise<void>;
};

export type ResearchCompanyResult =
  | {
      success: true;
      research: CompanyResearch;
      homepageUrl: string;
      browsed: boolean;
      /** True when dossier came from empty/profile fallback (synthesis + heal both failed). */
      degraded: boolean;
      /** OpenRouter chat completions metered during this request. */
      llmCalls: number;
    }
  | { success: false; error: string };

export type ResearchCompanyOptions = {
  userId: string;
  jobId: string;
  client: InsforgeClient;
  openRouter?: OpenRouterFailoverOptions;
  openRouterApiKey: string;
  rateLimit?: ResearchRateLimitHooks;
  /** Optional shared meter (tests). Default: new meter per request. */
  llmMeter?: ResearchLlmMeter;
  deriveHomepage?: typeof deriveCompanyHomepage;
  createSession?: typeof createResearchBrowserSession;
  createStagehand?: typeof createResearchStagehand;
  synthesize?: (
    input: {
      companyResearch: unknown;
      job: Job;
      profile: Profile;
      sources: string[];
    },
    openRouter?: OpenRouterFailoverOptions,
    meter?: ResearchLlmMeter,
  ) => Promise<CompanyResearch>;
};

async function flushResearchLlmHits(
  rateLimit: ResearchRateLimitHooks | undefined,
  meter: ResearchLlmMeter,
): Promise<number> {
  const counted = meter.consume();
  if (rateLimit?.recordLlmHits) {
    // Fixed charge per admitted research — matches OpenRouter ceiling.
    await rateLimit.recordLlmHits(RESEARCH_USAGE_HITS);
    return RESEARCH_USAGE_HITS;
  }
  return counted;
}

/**
 * Test doubles may only implement `consumeLlmCallCount` without wiring `onLlmCall`.
 * Production Stagehand increments the meter live via `onLlmCall`, so drain only when
 * the meter did not move during extracts.
 */
function absorbStagehandConsumeFallback(
  handle: ResearchStagehandHandle,
  meter: ResearchLlmMeter,
  meterBeforeExtracts: number,
): void {
  const drained = handle.consumeLlmCallCount();
  if (drained > 0 && meter.peek() === meterBeforeExtracts) {
    meter.increment(drained);
  }
}

async function logResearchNote(jobId: string, message: string): Promise<void> {
  // agent_logs.run_id is NOT NULL — research has no agent_run row.
  log.warn({ jobId }, message);
}

export async function synthesizeCompanyResearch(
  input: {
    companyResearch: unknown;
    job: Job;
    profile: Profile;
    sources: string[];
  },
  openRouter?: OpenRouterFailoverOptions,
  meter?: ResearchLlmMeter,
): Promise<CompanyResearch> {
  const healContext = {
    companyResearch: input.companyResearch,
    job: {
      title: input.job.title,
      company: input.job.company,
      about_role: input.job.about_role,
      matched_skills: input.job.matched_skills,
    },
  };

  const failoverOptions: OpenRouterFailoverOptions = {
    ...openRouter,
    onChatCompletionHttp: () => {
      meter?.increment(1);
      openRouter?.onChatCompletionHttp?.();
    },
  };

  try {
    const object = await withOpenRouterKeyFailover(async (model) => {
      const result = await generateObject({
        model,
        schema: companyResearchSchema,
        system: RESEARCH_SYNTHESIS_SYSTEM_PROMPT,
        prompt: buildResearchSynthesisUserPrompt({
          companyResearch: input.companyResearch,
          job: input.job,
          profile: input.profile,
        }),
        temperature: SYNTHESIS_TEMPERATURE,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      });
      return result.object;
    }, failoverOptions);

    return normalizeCompanyResearch(object, input.sources);
  } catch (error) {
    const healed = healCompanyResearchFromError(
      error,
      input.sources,
      healContext,
    );
    if (healed) {
      log.warn("synthesis schema mismatch; healed model output");
      return healed;
    }
    throw error;
  }
}

async function browseCompanyPages(input: {
  homepage: DeriveHomepageResult;
  openRouterApiKey: string;
  rateLimit?: ResearchRateLimitHooks;
  meter: ResearchLlmMeter;
  createSession: typeof createResearchBrowserSession;
  createStagehand: typeof createResearchStagehand;
  /** Absolute deadline from research overall timeout. */
  deadlineAt: number;
  jobId?: string;
}): Promise<{
  browsed: boolean;
  homepageExtract: HomepageExtract | null;
  subPages: Array<{ url: string; extract: SubPageExtract }>;
  sources: string[];
}> {
  const sources: string[] = [input.homepage.homepageUrl];
  let handle: ResearchStagehandHandle | null = null;
  let meterBeforeExtracts = input.meter.peek();
  const gotoMs = researchGotoTimeoutMs();
  const extractMs = researchExtractTimeoutMs();
  const jobId = input.jobId;

  try {
    // Homepage only when meter is fresh and under the hard OpenRouter ceiling.
    if (input.meter.peek() !== 0 || input.meter.isAtCap()) {
      return {
        browsed: false,
        homepageExtract: null,
        subPages: [],
        sources,
      };
    }

    const canHome = input.rateLimit?.canUseExtraExtract
      ? await input.rateLimit.canUseExtraExtract()
      : true;
    if (!canHome) {
      return {
        browsed: false,
        homepageExtract: null,
        subPages: [],
        sources,
      };
    }

    log.info(
      { jobId, homepageUrl: input.homepage.homepageUrl },
      "browse starting",
    );

    const session = await input.createSession();
    handle = await input.createStagehand({
      sessionId: session.id,
      openRouterApiKey: input.openRouterApiKey,
      onLlmCall: () => {
        if (!input.meter.isAtCap()) {
          input.meter.increment(1);
        }
      },
    });
    const { stagehand } = handle;

    const page = stagehand.context.activePage();
    if (!page) {
      throw new Error("Stagehand has no active page");
    }

    await withTimeout(
      page.goto(input.homepage.homepageUrl, {
        waitUntil: "domcontentloaded",
      }),
      gotoMs,
      "Company homepage navigation timed out",
    );

    const homeSignals = await readPageNavSignals(page);
    if (isUnusableResearchPage(homeSignals)) {
      log.warn(
        {
          jobId,
          url: homeSignals.url,
          title: homeSignals.title,
        },
        "homepage unusable; skipping extract",
      );
      return {
        browsed: false,
        homepageExtract: null,
        subPages: [],
        sources,
      };
    }

    meterBeforeExtracts = input.meter.peek();

    const homepageExtract = await withExtractRetry(
      () =>
        withTimeout(
          stagehand.extract(
            HOMEPAGE_EXTRACT_INSTRUCTION,
            homepageExtractSchema,
          ),
          extractMs,
          "Company homepage extract timed out",
        ),
      {
        onRetry: (attempt) => {
          log.warn(
            { jobId, url: input.homepage.homepageUrl, attempt },
            "homepage extract timeout; retrying",
          );
        },
      },
    );

    if (isHomepageExtractThin(homepageExtract)) {
      log.warn(
        { jobId, url: input.homepage.homepageUrl },
        "homepage extract thin; browse not counted, extract still forwarded to synthesis",
      );
      return {
        browsed: false,
        homepageExtract,
        subPages: [],
        sources,
      };
    }

    log.info(
      {
        jobId,
        url: input.homepage.homepageUrl,
        signals: homepageExtract.signals.length,
        pageLinks: homepageExtract.pageLinks.length,
      },
      "homepage extracted; will use in dossier",
    );

    const subPages: Array<{ url: string; extract: SubPageExtract }> = [];
    const remainingAfterHome = remainingResearchMs(input.deadlineAt);

    if (
      shouldSkipSubPageBecauseHomepageRich({
        extract: homepageExtract,
        remainingMs: remainingAfterHome,
        gotoMs,
        extractMs,
      })
    ) {
      log.info(
        { jobId, remainingMs: remainingAfterHome },
        "skipping sub-page; homepage rich and retry budget tight",
      );
      return {
        browsed: true,
        homepageExtract,
        subPages,
        sources,
      };
    }

    if (
      !canAttemptSubPageExtract({
        remainingMs: remainingAfterHome,
        gotoMs,
        extractMs,
        includeRetryBudget: true,
      })
    ) {
      log.info(
        { jobId, remainingMs: remainingAfterHome },
        "skipping sub-page; remaining time too low",
      );
      return {
        browsed: true,
        homepageExtract,
        subPages,
        sources,
      };
    }

    const resolved = resolveSubPageTargets(
      homepageExtract.pageLinks,
      input.homepage.homepageUrl,
      1,
    );
    const links = pickSubPageLinks(resolved, 1);

    for (const link of links) {
      if (!isNavigableHttpUrl(link.url) || isResearchDenylistUrl(link.url)) {
        log.warn(
          { jobId, url: link.url },
          "skipping non-researchable sub-page url",
        );
        continue;
      }

      // Allow one sub-page while peek <= 2 (after homepage ~2 calls).
      if (input.meter.isAtCap() || input.meter.peek() > 2) {
        break;
      }

      const canExtract = input.rateLimit?.canUseExtraExtract
        ? await input.rateLimit.canUseExtraExtract()
        : true;
      if (!canExtract) break;

      const remainingBeforeSub = remainingResearchMs(input.deadlineAt);
      if (
        !canAttemptSubPageExtract({
          remainingMs: remainingBeforeSub,
          gotoMs,
          extractMs,
          includeRetryBudget: true,
        })
      ) {
        log.info(
          { jobId, url: link.url, remainingMs: remainingBeforeSub },
          "skipping sub-page; remaining time too low",
        );
        break;
      }

      try {
        await withTimeout(
          page.goto(link.url, { waitUntil: "domcontentloaded" }),
          gotoMs,
          `Company sub-page navigation timed out (${link.url})`,
        );

        const subSignals = await readPageNavSignals(page);
        if (isUnusableResearchPage(subSignals)) {
          log.warn(
            { jobId, url: link.url, title: subSignals.title },
            "sub-page unusable; skipping extract",
          );
          continue;
        }

        if (input.meter.isAtCap()) {
          break;
        }

        const extract = await withExtractRetry(
          () =>
            withTimeout(
              stagehand.extract(
                SUBPAGE_EXTRACT_INSTRUCTION,
                subPageExtractSchema,
              ),
              extractMs,
              `Company sub-page extract timed out (${link.url})`,
            ),
          {
            onRetry: (attempt) => {
              log.warn(
                { jobId, url: link.url, attempt },
                "sub-page extract timeout; retrying",
              );
            },
          },
        );
        subPages.push({ url: link.url, extract });
        sources.push(link.url);
        log.info(
          {
            jobId,
            url: link.url,
            keyPoints: extract.keyPoints.length,
            technologies: extract.technologies.length,
          },
          "sub-page extracted; will use in dossier",
        );
      } catch (error) {
        log.error(
          {
            jobId,
            url: link.url,
            err: error instanceof Error ? error.message : String(error),
          },
          "sub-page extract failed",
        );
      }
    }

    return {
      browsed: true,
      homepageExtract,
      subPages,
      sources,
    };
  } catch (error) {
    log.error(
      {
        jobId,
        err: error instanceof Error ? error.message : String(error),
      },
      "browse failed",
    );
    return {
      browsed: false,
      homepageExtract: null,
      subPages: [],
      sources,
    };
  } finally {
    if (handle) {
      absorbStagehandConsumeFallback(
        handle,
        input.meter,
        meterBeforeExtracts,
      );
      try {
        await handle.stagehand.close();
      } catch (error) {
        log.error(
          {
            jobId,
            err: error instanceof Error ? error.message : String(error),
          },
          "stagehand.close failed",
        );
      }
    }
  }
}

/**
 * Research a company for a job: browse public pages + synthesize dossier.
 * Always returns a dossier on success (synthesis-only if browse fails).
 */
export async function researchCompany(
  options: ResearchCompanyOptions,
): Promise<ResearchCompanyResult> {
  const deriveHomepage = options.deriveHomepage ?? deriveCompanyHomepage;
  const createSession = options.createSession ?? createResearchBrowserSession;
  const createStagehand = options.createStagehand ?? createResearchStagehand;
  const meter = options.llmMeter ?? new ResearchLlmMeter();
  const useInjectedSynthesize = Boolean(options.synthesize);
  const synthesize = options.synthesize ?? synthesizeCompanyResearch;

  const { data: jobRow, error: jobError } = await options.client.database
    .from("jobs")
    .select("*")
    .eq("id", options.jobId)
    .eq("user_id", options.userId)
    .single();

  if (jobError || !jobRow || typeof jobRow !== "object") {
    return { success: false, error: "Job not found." };
  }

  const job = mapDbRowToJob(jobRow as JobDbRow);

  const { data: profileRow, error: profileError } =
    await options.client.database
      .from("profiles")
      .select("*")
      .eq("id", options.userId)
      .single();

  if (profileError || !profileRow || typeof profileRow !== "object") {
    return {
      success: false,
      error: "Profile not found. Save your profile and try again.",
    };
  }

  const profile = mapRowToProfile(profileRow as Record<string, unknown>);
  const applyUrl = getApplyUrl(job);

  const homepage = await deriveHomepage({
    redirectUrl: applyUrl,
    companyName: job.company,
  });

  let browse: {
    browsed: boolean;
    homepageExtract: HomepageExtract | null;
    subPages: Array<{ url: string; extract: SubPageExtract }>;
    sources: string[];
  };
  let research: CompanyResearch;
  let degraded = false;

  const overallMs = researchOverallTimeoutMs();
  const deadlineAt = Date.now() + overallMs;

  log.info(
    {
      jobId: options.jobId,
      company: job.company,
      homepageUrl: homepage.homepageUrl,
      homepageSource: homepage.source,
    },
    "research started",
  );

  try {
    const core = await withTimeout(
      (async () => {
        const browseResult = await browseCompanyPages({
          homepage,
          openRouterApiKey: options.openRouterApiKey,
          rateLimit: options.rateLimit,
          meter,
          createSession,
          createStagehand,
          deadlineAt,
          jobId: options.jobId,
        });

        if (!browseResult.browsed) {
          await logResearchNote(
            options.jobId,
            "Company browser research was thin or failed; synthesizing from job + profile.",
          );
        }

        const companyResearchPayload = {
          homepageUrl: homepage.homepageUrl,
          homepage: browseResult.homepageExtract,
          pages: browseResult.subPages,
        };

        let dossier: CompanyResearch;
        let wasDegraded = false;

        const canSynthesize =
          !meter.isAtCap() &&
          (options.rateLimit?.canUseSynthesis
            ? await options.rateLimit.canUseSynthesis()
            : true);

        if (!canSynthesize) {
          await logResearchNote(
            options.jobId,
            "AI quota exhausted mid-research; using job + profile fallback dossier.",
          );
          dossier = emptyDossierFallback({
            company: job.company,
            sources: browseResult.sources,
            job,
            profile,
          });
          wasDegraded = true;
        } else {
          try {
            dossier = await synthesize(
              {
                companyResearch: companyResearchPayload,
                job,
                profile,
                sources: browseResult.sources,
              },
              options.openRouter,
              meter,
            );
            if (useInjectedSynthesize && !meter.isAtCap()) {
              meter.increment(1);
            }
            log.info(
              {
                jobId: options.jobId,
                homepageUsed: Boolean(browseResult.homepageExtract),
                subPagesUsed: browseResult.subPages.map((p) => p.url),
                sources: browseResult.sources,
              },
              "dossier synthesized",
            );
          } catch (error) {
            log.error(
              {
                jobId: options.jobId,
                err: error instanceof Error ? error.message : String(error),
              },
              "synthesis failed",
            );
            dossier = emptyDossierFallback({
              company: job.company,
              sources: browseResult.sources,
              job,
              profile,
            });
            wasDegraded = true;
          }
        }

        return { browseResult, dossier, wasDegraded };
      })(),
      overallMs,
      "Company research timed out",
    );

    browse = core.browseResult;
    research = core.dossier;
    degraded = core.wasDegraded;
  } catch (error) {
    log.error(
      {
        jobId: options.jobId,
        err: error instanceof Error ? error.message : String(error),
      },
      "overall timeout or failure",
    );
    await logResearchNote(
      options.jobId,
      "Company research timed out; using job + profile fallback dossier.",
    );
    browse = {
      browsed: false,
      homepageExtract: null,
      subPages: [],
      sources: [homepage.homepageUrl],
    };
    research = emptyDossierFallback({
      company: job.company,
      sources: browse.sources,
      job,
      profile,
    });
    degraded = true;
  }

  const llmCalls = await flushResearchLlmHits(options.rateLimit, meter);

  const { error: updateError } = await options.client.database
    .from("jobs")
    .update({ company_research: research })
    .eq("id", options.jobId)
    .eq("user_id", options.userId);

  if (updateError) {
    log.error(
      {
        jobId: options.jobId,
        err:
          typeof updateError === "object" &&
          updateError !== null &&
          "message" in updateError
            ? String((updateError as { message: unknown }).message)
            : String(updateError),
      },
      "save dossier failed",
    );
    return {
      success: false,
      error: "Could not save company research. Please try again.",
    };
  }

  log.info(
    {
      jobId: options.jobId,
      browsed: browse.browsed,
      degraded,
      llmCalls,
      homepageUsed: Boolean(browse.homepageExtract),
      subPagesUsed: browse.subPages.map((p) => p.url),
    },
    "research completed",
  );

  return {
    success: true,
    research,
    homepageUrl: homepage.homepageUrl,
    browsed: browse.browsed,
    degraded,
    llmCalls,
  };
}
