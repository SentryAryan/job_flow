"use client";

import { Button } from "@/components/ui/button";
import {
    getPaginationItems,
    type PaginationItem,
} from "@/lib/find-jobs-list";
import { cn } from "@/lib/utils";

type JobsPaginationProps = {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
};

function PageButton({
  item,
  currentPage,
  onPageChange,
}: {
  item: PaginationItem;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  if (item === "ellipsis") {
    return (
      <span
        className="inline-flex size-8 items-center justify-center text-sm text-text-muted"
        aria-hidden
      >
        …
      </span>
    );
  }

  const isActive = item === currentPage;

  return (
    <Button
      type="button"
      variant={isActive ? "primary" : "outline"}
      size="icon-sm"
      onClick={() => onPageChange(item)}
      aria-label={`Page ${item}`}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "size-8 text-sm font-medium",
        !isActive && "text-text-secondary",
      )}
    >
      {item}
    </Button>
  );
}

export function JobsPagination({
  page,
  totalPages,
  from,
  to,
  total,
  onPageChange,
  className,
}: JobsPaginationProps) {
  if (total === 0) return null;

  const items = getPaginationItems(page, totalPages);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5",
        className,
      )}
    >
      <p className="text-sm text-text-muted">
        Showing {from} to {to} of {total} results
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="text-text-muted"
        >
          Previous
        </Button>

        {items.map((item, index) => (
          <PageButton
            key={item === "ellipsis" ? `ellipsis-${index}` : `page-${item}`}
            item={item}
            currentPage={page}
            onPageChange={onPageChange}
          />
        ))}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="font-medium text-text-primary"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
