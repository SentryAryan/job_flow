import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border border-accent-dark border-b-[3px] border-b-accent-dark bg-accent text-accent-foreground hover:bg-accent-dark",
        primary:
          "border border-accent-dark border-b-[3px] border-b-accent-dark bg-accent text-accent-foreground hover:bg-accent-dark",
        outline:
          "border-border border-b-2 border-b-border-muted bg-surface text-text-primary hover:bg-surface-secondary",
        secondary:
          "border-border border-b-2 border-b-border-muted bg-surface text-text-primary hover:bg-surface-secondary",
        muted:
          "border-border border-b-2 border-b-border-muted bg-surface-secondary text-text-primary hover:bg-surface-tertiary",
        ghost:
          "hover:bg-muted hover:text-foreground",
        destructive:
          "border border-error border-b-[3px] border-b-error bg-error text-error-foreground hover:border-error-dark hover:border-b-error-dark hover:bg-error-dark",
        danger:
          "border border-error border-b-[3px] border-b-error bg-error text-error-foreground hover:border-error-dark hover:border-b-error-dark hover:bg-error-dark",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        xs: "h-6 gap-1 rounded-md px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 px-5",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  pending = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Shows spinner and sets aria-busy; also disables the button. */
    pending?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";
  const isDisabled = Boolean(disabled || pending);

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      disabled={isDisabled}
      aria-busy={pending || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {pending ? <Spinner decorative className="size-4" /> : null}
      {children}
    </Comp>
  );
}

export { Button, buttonVariants };
