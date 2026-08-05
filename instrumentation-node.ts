/**
 * Prefer IPv4 when dual-stack DNS returns broken AAAA records.
 * Loaded only from `instrumentation.ts` when NEXT_RUNTIME === "nodejs".
 */
import dns from "node:dns";

export function registerNodeInstrumentation(): void {
  if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
  }
}
