import { describe, expect, it } from "vitest";

import { resolveAppEnv } from "@/lib/app-env";

describe("resolveAppEnv", () => {
  it("treats production and prod as production", () => {
    expect(resolveAppEnv("production", "development")).toBe("production");
    expect(resolveAppEnv("prod", "development")).toBe("production");
    expect(resolveAppEnv("PROD", "development")).toBe("production");
  });

  it("treats development, dev, test, and unset as development", () => {
    expect(resolveAppEnv("development", "production")).toBe("development");
    expect(resolveAppEnv("dev", "production")).toBe("development");
    expect(resolveAppEnv("test", "production")).toBe("development");
    expect(resolveAppEnv(undefined, "development")).toBe("development");
    expect(resolveAppEnv(undefined, undefined)).toBe("development");
  });

  it("falls back to NODE_ENV when APP_ENV is unset", () => {
    expect(resolveAppEnv(undefined, "production")).toBe("production");
  });
});
