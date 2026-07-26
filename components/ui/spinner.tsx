import { Loader2Icon } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type SpinnerSize = "sm" | "md";

type SpinnerProps = ComponentProps<"svg"> & {
  size?: SpinnerSize;
  label?: string;
  /** Hide from accessibility tree when parent already announces busy state. */
  decorative?: boolean;
};

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: "size-4",
  md: "size-5",
};

function Spinner({
  className,
  size = "sm",
  label = "Loading",
  decorative = false,
  ...props
}: SpinnerProps) {
  return (
    <Loader2Icon
      data-slot="spinner"
      className={cn("animate-spin text-accent", SIZE_CLASSES[size], className)}
      {...(decorative
        ? { "aria-hidden": true as const }
        : { role: "status" as const, "aria-label": label })}
      {...props}
    />
  );
}

export { Spinner };
