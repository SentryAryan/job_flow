"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MatchFilter, SortOption } from "@/lib/find-jobs-list";
import { cn } from "@/lib/utils";

type JobFiltersProps = {
  filterQuery: string;
  matchFilter: MatchFilter;
  sort: SortOption;
  onFilterQueryChange: (value: string) => void;
  onMatchFilterChange: (value: MatchFilter) => void;
  onSortChange: (value: SortOption) => void;
  className?: string;
};

export function JobFilters({
  filterQuery,
  matchFilter,
  sort,
  onFilterQueryChange,
  onMatchFilterChange,
  onSortChange,
  className,
}: JobFiltersProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
          aria-hidden
        />
        <Input
          value={filterQuery}
          onChange={(event) => onFilterQueryChange(event.target.value)}
          placeholder="Filter by company or role..."
          className="pl-9"
          aria-label="Filter by company or role"
          autoComplete="off"
        />
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Select
          value={matchFilter}
          onValueChange={(value) =>
            onMatchFilterChange(value as MatchFilter)
          }
        >
          <SelectTrigger
            aria-label="Filter by match level"
            className="w-auto min-w-[8.5rem]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Matches</SelectItem>
            <SelectItem value="high">High Match</SelectItem>
            <SelectItem value="low">Low Match</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sort}
          onValueChange={(value) => onSortChange(value as SortOption)}
        >
          <SelectTrigger aria-label="Sort jobs" className="w-auto min-w-[8.5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="match_score">Match Score</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
