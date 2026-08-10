import { describe, expect, it } from "vitest";

import { parsePositiveEnvMs } from "@/lib/parse-env-ms";

describe("parsePositiveEnvMs", () => {
  it("uses the first positive numeric candidate", () => {
    expect(parsePositiveEnvMs(["45000", "90000"], 90_000)).toBe(45_000);
  });

  it("skips empty and whitespace-only strings (Docker/Render ARG trap)", () => {
    expect(parsePositiveEnvMs(["", "  ", "90000"], 60_000)).toBe(90_000);
  });

  it("skips nullish, zero, negative, and non-numeric values", () => {
    expect(
      parsePositiveEnvMs(
        [undefined, "0", "-1", "nope", "120000"],
        90_000,
      ),
    ).toBe(120_000);
  });

  it("returns fallback when nothing usable is set", () => {
    expect(parsePositiveEnvMs(["", undefined], 90_000)).toBe(90_000);
  });
});
