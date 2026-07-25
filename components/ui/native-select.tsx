import * as React from "react";

import { cn } from "@/lib/utils";

/** Native `<select>` styled like shadcn Input — use for dense form option lists. */
function NativeSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-10 w-full cursor-pointer rounded-md border border-border border-b-2 border-b-border-muted bg-surface px-3 py-2 text-sm text-text-primary transition-colors outline-none focus-visible:border-accent focus-visible:border-b-accent focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-text-secondary disabled:opacity-50 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };

