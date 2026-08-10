import { createClient } from "@insforge/sdk";

import { createInsforgeBrowserFetch } from "@/lib/insforge-fetch";
import { parsePositiveEnvMs } from "@/lib/parse-env-ms";

/** InsForge default is 30s — too short for storage uploads to ap-southeast. */
const INSFORGE_TIMEOUT_MS = parsePositiveEnvMs(
  [process.env.NEXT_PUBLIC_INSFORGE_TIMEOUT_MS],
  90_000,
);

export const insforge = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  timeout: INSFORGE_TIMEOUT_MS,
  // Avoid browser conditional GETs (304) that break PostgREST clients.
  fetch: createInsforgeBrowserFetch(),
});
