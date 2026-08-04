import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MultiStepProgress } from "@/components/ui/multi-step-progress";

const STEPS = [
  "Resolve company homepage",
  "Browse public pages",
  "Build interview dossier",
  "Save research",
] as const;

describe("MultiStepProgress", () => {
  it("marks prior steps completed and highlights the current step", () => {
    render(<MultiStepProgress steps={STEPS} currentIndex={1} />);

    expect(screen.getByText("Resolve company homepage")).toBeInTheDocument();
    expect(screen.getByText("Browse public pages")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Step 2 of 4: Browse public pages"),
    ).toBeInTheDocument();
  });

  it("clamps an out-of-range index to the last step", () => {
    render(<MultiStepProgress steps={STEPS} currentIndex={99} />);
    expect(
      screen.getByLabelText("Step 4 of 4: Save research"),
    ).toBeInTheDocument();
  });

  it("renders nothing when steps are empty", () => {
    const { container } = render(
      <MultiStepProgress steps={[]} currentIndex={0} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
