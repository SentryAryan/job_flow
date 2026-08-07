/**
 * Server-only PostHog Query API (HogQL) for dashboard charts.
 */

import { withTimeout } from "@/lib/errors";
import { getPostHogUiHost } from "@/lib/posthog-config";

const QUERY_TIMEOUT_MS = 20_000;

export type PostHogQueryConfig = {
  personalApiKey: string;
  projectId: string;
  apiHost: string;
};

export function getPostHogQueryConfig(): PostHogQueryConfig | null {
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim() ?? "";
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim() ?? "";
  if (!personalApiKey || !projectId) {
    return null;
  }
  return {
    personalApiKey,
    projectId,
    apiHost: getPostHogUiHost(),
  };
}

/** Escape a string for use as a HogQL single-quoted literal. */
export function escapeHogqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

type HogQLResponse = {
  results?: unknown[][];
  columns?: string[];
  error?: string;
  detail?: string;
};

/**
 * Run a HogQL query against the configured PostHog project.
 * Returns row arrays aligned with `columns` when present.
 * Caller must pass a non-null config from `getPostHogQueryConfig()`.
 */
export async function queryHogQL(
  sql: string,
  config: PostHogQueryConfig,
): Promise<{ columns: string[]; results: unknown[][] }> {
  const url = `${config.apiHost}/api/projects/${encodeURIComponent(config.projectId)}/query/`;

  const response = await withTimeout(
    fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.personalApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query: sql,
        },
      }),
    }),
    QUERY_TIMEOUT_MS,
    "PostHog query timed out",
  );

  let payload: HogQLResponse = {};
  try {
    payload = (await response.json()) as HogQLResponse;
  } catch {
    if (!response.ok) {
      throw new Error(`PostHog query failed (${response.status})`);
    }
    throw new Error("PostHog query returned invalid JSON");
  }

  if (!response.ok) {
    const detail =
      (typeof payload.error === "string" && payload.error) ||
      (typeof payload.detail === "string" && payload.detail) ||
      `PostHog query failed (${response.status})`;
    throw new Error(detail);
  }

  return {
    columns: Array.isArray(payload.columns) ? payload.columns : [],
    results: Array.isArray(payload.results) ? payload.results : [],
  };
}

export function rowsToObjects(
  columns: string[],
  results: unknown[][],
): Record<string, unknown>[] {
  return results.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}
