import { createHash } from "node:crypto";

/**
 * Best-effort client IP from reverse-proxy headers (Vercel / similar).
 * Prefer first hop of X-Forwarded-For, then X-Real-IP.
 * Returns null when missing or not a plausible IP (caller should skip IP limits).
 */
export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim() ?? "";
    if (isPlausibleIp(first)) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim() ?? "";
  if (isPlausibleIp(realIp)) return realIp;

  return null;
}

/** SHA-256 hex truncated to 32 chars — never store raw IPs in Redis keys. */
export function hashIpForRateLimit(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

function isPlausibleIp(value: string): boolean {
  if (!value) return false;
  if (value.includes(" ")) return false;
  // IPv4
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) {
    return value.split(".").every((octet) => {
      const n = Number.parseInt(octet, 10);
      return n >= 0 && n <= 255;
    });
  }
  // IPv6 (simplified — requires at least one colon, hex/colon only)
  if (value.includes(":")) {
    return /^[0-9a-fA-F:]+$/.test(value) && value.length <= 45;
  }
  return false;
}
