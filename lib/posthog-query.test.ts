import { describe, expect, it } from "vitest";

import { escapeHogqlString } from "@/lib/posthog-query";

describe("escapeHogqlString", () => {
  it("escapes backslashes and single quotes", () => {
    expect(escapeHogqlString("a'b\\c")).toBe("a\\'b\\\\c");
  });
});
