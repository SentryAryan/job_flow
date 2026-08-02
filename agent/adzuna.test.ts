import { describe, expect, it, vi } from "vitest";

import { discoverJobs } from "@/agent/adzuna";
import type { AdzunaJob } from "@/lib/adzuna";
import type { Profile } from "@/types";

const profile = {
  id: "u1",
  full_name: "Ada",
  email: "a@b.com",
  phone: null,
  location: null,
  current_title: "Engineer",
  experience_level: "mid",
  years_experience: 3,
  skills: ["React"],
  industries: [],
  work_experience: [],
  education: {},
  job_titles_seeking: [],
  remote_preference: null,
  preferred_locations: [],
  salary_expectation: null,
  cover_letter_tone: null,
  linkedin_url: null,
  portfolio_url: null,
  work_authorization: null,
  resume_pdf_url: null,
  is_complete: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
} satisfies Profile;

function makeAdzunaJob(id: string): AdzunaJob {
  return {
    id,
    title: `Role ${id}`,
    company: { display_name: "Acme" },
    location: { display_name: "Remote" },
    description: "React TypeScript work",
    redirect_url: `https://example.com/${id}`,
    salary_min: 100000,
    salary_max: 140000,
    salary_is_predicted: "1",
    created: "2026-07-01T00:00:00Z",
    category: { tag: "it-jobs", label: "IT" },
  };
}

function makeClient(options?: { completeError?: { message: string } }) {
  const logs: unknown[] = [];
  const jobs: unknown[] = [];
  let runStatus = "running";
  let jobsFound = 0;

  return {
    logs,
    jobs,
    get runStatus() {
      return runStatus;
    },
    get jobsFound() {
      return jobsFound;
    },
    database: {
      from(table: string) {
        if (table === "agent_runs") {
          return {
            insert() {
              return {
                select() {
                  return {
                    async single() {
                      return { data: { id: "run-1" }, error: null };
                    },
                  };
                },
              };
            },
            update(payload: { status?: string; jobs_found?: number }) {
              return {
                async eq() {
                  if (
                    payload.status === "completed" &&
                    options?.completeError
                  ) {
                    return { data: null, error: options.completeError };
                  }
                  if (payload.status) runStatus = payload.status;
                  if (payload.jobs_found != null) jobsFound = payload.jobs_found;
                  return { data: null, error: null };
                },
              };
            },
          };
        }

        if (table === "agent_logs") {
          return {
            async insert(rows: unknown[]) {
              logs.push(...rows);
              return { data: null, error: null };
            },
          };
        }

        if (table === "jobs") {
          return {
            async insert(rows: unknown[]) {
              jobs.push(...(rows as unknown[]));
              return { data: null, error: null };
            },
          };
        }

        throw new Error(`unexpected table ${table}`);
      },
    },
  };
}

describe("discoverJobs", () => {
  it("scores, saves jobs, and completes the agent run", async () => {
    const client = makeClient();
    const adzunaJob = makeAdzunaJob("adz-1");
    adzunaJob.title = "Frontend Engineer";
    adzunaJob.description = "React work";

    const result = await discoverJobs({
      userId: "u1",
      jobTitle: "Frontend Engineer",
      location: "Remote",
      profile,
      client: client as never,
      searchJobs: vi.fn(async () => [adzunaJob]),
      scoreJobs: vi.fn(async () => [
        {
          matchScore: 92,
          matchReason: "Strong React overlap",
          matchedSkills: ["React"],
          missingSkills: [],
        },
      ]),
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.jobsFound).toBe(1);
    expect(result.strongMatches).toBe(1);
    expect(result.message).toContain("Found and saved 1 job");
    expect(result.message).toContain("1 strong match (70%+)");
    expect(client.jobs).toHaveLength(1);
    expect(client.runStatus).toBe("completed");
    expect(client.jobsFound).toBe(1);
  });

  it("formats salary with GB currency when searching London", async () => {
    const client = makeClient();
    const adzunaJob = makeAdzunaJob("adz-gb");
    const searchJobs = vi.fn(async () => [adzunaJob]);

    const result = await discoverJobs({
      userId: "u1",
      jobTitle: "Engineer",
      location: "London",
      profile,
      client: client as never,
      searchJobs,
      scoreJobs: vi.fn(async () => [
        {
          matchScore: 80,
          matchReason: "ok",
          matchedSkills: ["React"],
          missingSkills: [],
        },
      ]),
    });

    expect(result.success).toBe(true);
    expect(searchJobs).toHaveBeenCalledWith(
      expect.objectContaining({ country: "gb", location: "London" }),
    );
    expect(client.jobs[0]).toMatchObject({ salary: "£100k - £140k" });
  });

  it("marks the run failed when completion update errors", async () => {
    const client = makeClient({
      completeError: { message: "db write failed" },
    });
    const adzunaJob = makeAdzunaJob("adz-1");

    const result = await discoverJobs({
      userId: "u1",
      jobTitle: "Engineer",
      location: "",
      profile,
      client: client as never,
      searchJobs: vi.fn(async () => [adzunaJob]),
      scoreJobs: vi.fn(async () => [
        {
          matchScore: 80,
          matchReason: "ok",
          matchedSkills: ["React"],
          missingSkills: [],
        },
      ]),
    });

    expect(result.success).toBe(false);
    expect(client.runStatus).toBe("failed");
  });

  it("rejects empty job title without creating a run", async () => {
    const client = makeClient();
    const result = await discoverJobs({
      userId: "u1",
      jobTitle: "  ",
      location: "",
      profile,
      client: client as never,
    });

    expect(result).toEqual({
      success: false,
      error: "Job title is required.",
    });
  });

  it("passes scoreRateLimit into default scoring", async () => {
    const client = makeClient();
    const onSuccessfulAiBatch = vi.fn(async () => undefined);
    const canUseAi = vi.fn(async () => true);

    vi.resetModules();
    vi.doMock("ai", () => ({
      generateObject: vi.fn(async ({ prompt }: { prompt: string }) => {
        const m = prompt.match(/index 0\.\.(\d+)/);
        const count = m ? Number(m[1]) + 1 : 1;
        return {
          object: {
            scores: Array.from({ length: count }, (_, index) => ({
              index,
              matchScore: 80,
              matchReason: "ok",
              matchedSkills: ["React"],
              missingSkills: [] as string[],
            })),
          },
        };
      }),
    }));
    vi.doMock("@/lib/ai/provider", () => ({
      withOpenRouterKeyFailover: async (
        fn: (model: unknown) => Promise<unknown>,
      ) => fn({}),
    }));

    const { discoverJobs: discover } = await import("@/agent/adzuna");
    const jobs = Array.from({ length: 10 }, (_, i) =>
      makeAdzunaJob(`adz-${i}`),
    );

    const result = await discover({
      userId: "u1",
      jobTitle: "Engineer",
      location: "",
      profile,
      client: client as never,
      searchJobs: vi.fn(async () => jobs),
      scoreRateLimit: { canUseAi, onSuccessfulAiBatch },
    });

    expect(result.success).toBe(true);
    expect(canUseAi).toHaveBeenCalledTimes(2);
    expect(onSuccessfulAiBatch).toHaveBeenCalledTimes(2);
  });
});

describe("scoreJobsAgainstProfile rate-limit hooks", () => {
  it("records one onSuccessfulAiBatch per AI batch for 10 jobs", async () => {
    vi.resetModules();
    const generateObject = vi.fn(async ({ prompt }: { prompt: string }) => {
      const m = prompt.match(/index 0\.\.(\d+)/);
      const count = m ? Number(m[1]) + 1 : 1;
      return {
        object: {
          scores: Array.from({ length: count }, (_, index) => ({
            index,
            matchScore: 70 + index,
            matchReason: "scored",
            matchedSkills: ["React"],
            missingSkills: [] as string[],
          })),
        },
      };
    });
    vi.doMock("ai", () => ({ generateObject }));
    vi.doMock("@/lib/ai/provider", () => ({
      withOpenRouterKeyFailover: async (
        fn: (model: unknown) => Promise<unknown>,
      ) => fn({}),
    }));

    const { scoreJobsAgainstProfile: score } = await import("@/agent/adzuna");
    const onSuccessfulAiBatch = vi.fn(async () => undefined);
    const canUseAi = vi.fn(async () => true);
    const jobs = Array.from({ length: 10 }, (_, i) => makeAdzunaJob(`j-${i}`));

    const scores = await score(profile, jobs, undefined, {
      canUseAi,
      onSuccessfulAiBatch,
    });

    expect(scores).toHaveLength(10);
    expect(canUseAi).toHaveBeenCalledTimes(2);
    expect(onSuccessfulAiBatch).toHaveBeenCalledTimes(2);
    expect(generateObject).toHaveBeenCalledTimes(2);
  });

  it("falls back without AI hit when canUseAi becomes false", async () => {
    vi.resetModules();
    const generateObject = vi.fn(async ({ prompt }: { prompt: string }) => {
      const m = prompt.match(/index 0\.\.(\d+)/);
      const count = m ? Number(m[1]) + 1 : 1;
      return {
        object: {
          scores: Array.from({ length: count }, (_, index) => ({
            index,
            matchScore: 90,
            matchReason: "first batch",
            matchedSkills: ["React"],
            missingSkills: [] as string[],
          })),
        },
      };
    });
    vi.doMock("ai", () => ({ generateObject }));
    vi.doMock("@/lib/ai/provider", () => ({
      withOpenRouterKeyFailover: async (
        fn: (model: unknown) => Promise<unknown>,
      ) => fn({}),
    }));

    const { scoreJobsAgainstProfile: score } = await import("@/agent/adzuna");
    const onSuccessfulAiBatch = vi.fn(async () => undefined);
    let calls = 0;
    const canUseAi = vi.fn(async () => {
      calls += 1;
      return calls === 1;
    });

    // 6 jobs → 2 batches (5 + 1); second denied → fallback
    const jobs = Array.from({ length: 6 }, (_, i) => makeAdzunaJob(`j-${i}`));
    const scores = await score(profile, jobs, undefined, {
      canUseAi,
      onSuccessfulAiBatch,
    });

    expect(scores).toHaveLength(6);
    expect(generateObject).toHaveBeenCalledTimes(1);
    expect(onSuccessfulAiBatch).toHaveBeenCalledTimes(1);
    expect(canUseAi).toHaveBeenCalledTimes(2);
  });
});
