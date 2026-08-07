import { describe, expect, it } from "vitest";

import {
    parseAppTheme,
    THEME_OPTIONS,
    themeIconForResolved,
    themeOptionLabel,
} from "@/lib/theme";

describe("parseAppTheme", () => {
  it("accepts light, dark, and system", () => {
    expect(parseAppTheme("light")).toBe("light");
    expect(parseAppTheme("dark")).toBe("dark");
    expect(parseAppTheme("system")).toBe("system");
  });

  it("defaults unknown or empty values to system", () => {
    expect(parseAppTheme(undefined)).toBe("system");
    expect(parseAppTheme(null)).toBe("system");
    expect(parseAppTheme("")).toBe("system");
    expect(parseAppTheme("auto")).toBe("system");
  });
});

describe("themeIconForResolved", () => {
  it("maps resolved dark to moon icon key", () => {
    expect(themeIconForResolved("dark")).toBe("dark");
  });

  it("maps light and unknown to sun icon key", () => {
    expect(themeIconForResolved("light")).toBe("light");
    expect(themeIconForResolved(undefined)).toBe("light");
  });
});

describe("THEME_OPTIONS", () => {
  it("exposes Light, Dark, and System labels", () => {
    expect(THEME_OPTIONS.map((o) => o.value)).toEqual([
      "light",
      "dark",
      "system",
    ]);
    expect(themeOptionLabel("light")).toBe("Light");
    expect(themeOptionLabel("dark")).toBe("Dark");
    expect(themeOptionLabel("system")).toBe("System");
  });
});
