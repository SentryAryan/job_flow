import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

type TagProps = {
  label: string;
  onRemove?: () => void;
};

export function Tag({ label, onRemove }: TagProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-accent bg-accent-light px-2.5 py-1 text-xs font-medium text-accent">
      {label}
      {onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          className="size-3.5 text-accent hover:bg-transparent hover:text-accent-dark"
          aria-label={`Remove ${label}`}
        >
          <X className="size-2.5" strokeWidth={2.5} />
        </Button>
      ) : null}
    </span>
  );
}
