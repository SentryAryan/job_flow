import pino, { type Logger } from "pino";

const defaultLevel =
  process.env.NODE_ENV === "test" ? "silent" : "info";

/**
 * App-wide Pino logger. Prefer `createLogger("area")` for scoped children.
 * Keep payloads small — never log page HTML/DOM snapshots.
 */
export const rootLogger: Logger = pino({
  level: process.env.LOG_LEVEL?.trim() || defaultLevel,
  base: { service: "jobflow" },
});

/** Scoped child logger (e.g. `createLogger("agent/research")`). */
export function createLogger(module: string): Logger {
  return rootLogger.child({ module });
}
