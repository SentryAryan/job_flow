import { describe, expect, it } from "vitest";

import { isPdfMagicBytes } from "@/lib/pdf-text";

describe("isPdfMagicBytes", () => {
  it("accepts buffers that start with %PDF", () => {
    expect(isPdfMagicBytes(Buffer.from("%PDF-1.4\n"))).toBe(true);
  });

  it("rejects empty or non-PDF buffers", () => {
    expect(isPdfMagicBytes(Buffer.from(""))).toBe(false);
    expect(isPdfMagicBytes(Buffer.from("hello"))).toBe(false);
  });
});
