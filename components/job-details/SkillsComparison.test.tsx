/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SkillsComparison } from "@/components/job-details/SkillsComparison";

describe("SkillsComparison", () => {
  it("renders matched skills with You have and gap skills", () => {
    render(
      <SkillsComparison
        matchedSkills={["Node.js", "AWS"]}
        missingSkills={["Java (Spring Boot)"]}
      />,
    );

    expect(screen.getByText("You have")).toBeTruthy();
    expect(screen.getByText("Node.js")).toBeTruthy();
    expect(screen.getByText("AWS")).toBeTruthy();
    expect(screen.getByText("Gap skills")).toBeTruthy();
    expect(screen.getByText("Java (Spring Boot)")).toBeTruthy();
  });

  it("shows empty copy when no skills", () => {
    render(<SkillsComparison matchedSkills={[]} missingSkills={[]} />);
    expect(
      screen.getByText(/No skill comparison is available/i),
    ).toBeTruthy();
  });
});
