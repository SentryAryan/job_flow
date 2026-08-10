/**
 * Parse the first usable positive millisecond env value.
 *
 * Empty strings from Docker `ARG`/`ENV` without a default (common on Render)
 * must not win over later fallbacks — `"" ?? "90000"` stays `""`, and
 * `Number("") === 0`, which makes `setTimeout(..., 0)` look like an instant
 * "Request timed out".
 */
export function parsePositiveEnvMs(
  candidates: Array<string | undefined>,
  fallbackMs: number,
): number {
  for (const raw of candidates) {
    if (raw == null) continue;
    const trimmed = raw.trim();
    if (trimmed === "") continue;
    const n = Number(trimmed);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallbackMs;
}
