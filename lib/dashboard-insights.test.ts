import { describe, expect, it } from "vitest";

import {
    emptyFeatureUsage,
    mapFeatureUsageCounts,
} from "@/lib/dashboard-insights";

describe("mapFeatureUsageCounts", () => {
  it("fills zeros for missing keys", () => {
    expect(mapFeatureUsageCounts({})).toEqual(emptyFeatureUsage());
  });

  it("maps known event counts to labels", () => {
    const points = mapFeatureUsageCounts({
      resume_generated: 2,
      company_researched: 5,
    });
    expect(points).toEqual([
      { feature: "Resume generated", count: 2 },
      { feature: "Company researched", count: 5 },
      { feature: "Profile completed", count: 0 },
    ]);
  });
});
