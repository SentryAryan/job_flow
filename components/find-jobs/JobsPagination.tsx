"use client";

import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    getPaginationItems,
    isPageSizeOption,
    PAGE_SIZE_OPTIONS,
    type PageSizeOption,
    type PaginationItem,
} from "@/lib/find-jobs-list";
import { cn } from "@/lib/utils";

type JobsPaginationProps = {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  pageSize: PageSizeOption;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSizeOption) => void;
  disabled?: boolean;
  className?: string;
};

function PageButton({
  item,
  currentPage,
  onPageChange,
  disabled,
}: {
  item: PaginationItem;
  currentPage: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
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
      disabled={disabled}
      onClick={() => onPageChange(item)}
      aria-label={`Page ${item}`}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "size-8 cursor-pointer text-sm font-medium disabled:cursor-not-allowed",
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
  pageSize,
  onPageChange,
  onPageSizeChange,
  disabled = false,
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <p className="text-sm text-text-muted">
          Showing {from} to {to} of {total} results
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium tracking-wide text-text-secondary uppercase">
            Rows
          </span>
          <Select
            value={String(pageSize)}
            disabled={disabled}
            onValueChange={(value) => {
              const n = Number.parseInt(value, 10);
              if (isPageSizeOption(n)) onPageSizeChange(n);
            }}
          >
            <SelectTrigger
              aria-label="Rows per page"
              className="h-8 w-[4.5rem] cursor-pointer disabled:cursor-not-allowed"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="cursor-pointer text-text-muted disabled:cursor-not-allowed"
        >
          Previous
        </Button>

        {items.map((item, index) => (
          <PageButton
            key={item === "ellipsis" ? `ellipsis-${index}` : `page-${item}`}
            item={item}
            currentPage={page}
            onPageChange={onPageChange}
            disabled={disabled}
          />
        ))}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="cursor-pointer font-medium text-text-primary disabled:cursor-not-allowed"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
