"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { useUser } from "@/components/auth/AuthProvider";
import { FindJobsPageSkeleton } from "@/components/find-jobs/FindJobsPageSkeleton";
import { JobFilters } from "@/components/find-jobs/JobFilters";
import {
    JobsTableSkeleton,
    SEARCH_STATUS_MESSAGES,
} from "@/components/find-jobs/JobsLoading";
import { JobsPagination } from "@/components/find-jobs/JobsPagination";
import { JobsTable } from "@/components/find-jobs/JobsTable";
import { SearchControls } from "@/components/find-jobs/SearchControls";
import Navbar from "@/components/layout/Navbar";
import { captureEvent } from "@/lib/analytics";
import { findJobs } from "@/lib/find-jobs-api";
import {
    FIND_JOBS_PAGE_SIZE,
    type JobListRow,
    type MatchFilter,
    type PageSizeOption,
    type SortOption,
} from "@/lib/find-jobs-list";
import { fetchJobsPage, type FetchJobsPageParams } from "@/lib/jobs";
import { cn } from "@/lib/utils";

const FILTER_DEBOUNCE_MS = 300;
const SEARCH_STATUS_TICK_MS = 2800;

function FindJobsPageContent() {
  const { user } = useUser();
  const [jobTitle, setJobTitle] = useState("Frontend Engineer");
  const [location, setLocation] = useState("");
  const [jobs, setJobs] = useState<JobListRow[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchStatusIndex, setSearchStatusIndex] = useState(0);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [debouncedFilterQuery, setDebouncedFilterQuery] = useState("");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");
  const [sort, setSort] = useState<SortOption>("match_score");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(FIND_JOBS_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(0);
  const hasLoadedOnce = useRef(false);
  const skipNextAutoLoad = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilterQuery(filterQuery);
    }, FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filterQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedFilterQuery, matchFilter, sort, pageSize]);

  useEffect(() => {
    if (!searching) {
      setSearchStatusIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setSearchStatusIndex((index) =>
        Math.min(index + 1, SEARCH_STATUS_MESSAGES.length - 1),
      );
    }, SEARCH_STATUS_TICK_MS);
    return () => clearInterval(timer);
  }, [searching]);

  const applyPageData = useCallback(
    (data: {
      items: JobListRow[];
      total: number;
      totalPages: number;
      from: number;
      to: number;
      page: number;
    }) => {
      setJobs(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setFrom(data.from);
      setTo(data.to);
      if (data.page !== page) {
        setPage(data.page);
      }
      hasLoadedOnce.current = true;
    },
    [page],
  );

  const loadJobs = useCallback(
    async (
      opts?: { soft?: boolean; params?: Partial<FetchJobsPageParams> },
    ) => {
      if (!user?.id) return;
      const soft = Boolean(opts?.soft && hasLoadedOnce.current);
      if (soft) {
        setListRefreshing(true);
      } else {
        setJobsLoading(true);
      }

      const params: FetchJobsPageParams = {
        page: opts?.params?.page ?? page,
        pageSize: opts?.params?.pageSize ?? pageSize,
        q: opts?.params?.q ?? debouncedFilterQuery,
        match: opts?.params?.match ?? matchFilter,
        sort: opts?.params?.sort ?? sort,
      };

      const result = await fetchJobsPage(params);

      if (!result.success) {
        toast.error(result.error);
        if (!soft) {
          setJobs([]);
          setTotal(0);
          setTotalPages(0);
          setFrom(0);
          setTo(0);
        }
      } else {
        applyPageData(result.data);
      }

      setJobsLoading(false);
      setListRefreshing(false);
    },
    [
      user?.id,
      page,
      pageSize,
      debouncedFilterQuery,
      matchFilter,
      sort,
      applyPageData,
    ],
  );

  useEffect(() => {
    if (skipNextAutoLoad.current) {
      skipNextAutoLoad.current = false;
      return;
    }
    void loadJobs({ soft: true });
  }, [loadJobs]);

  const handleFindJobs = async () => {
    const title = jobTitle.trim();
    if (!title || searching || !user?.id) return;

    setSearching(true);
    setSearchStatusIndex(0);
    setShowSuccessBanner(false);
    captureEvent("job_search_started", {
      userId: user.id,
      jobTitle: title,
      location: location.trim() || undefined,
    });

    const result = await findJobs(title, location.trim());

    if (!result.success) {
      toast.error(result.error);
      setSearching(false);
      return;
    }

    for (const matchScore of result.data.matchScores) {
      captureEvent("job_found", {
        userId: user.id,
        source: "search",
        matchScore: String(matchScore),
      });
    }

    setSuccessMessage(result.data.message);
    setShowSuccessBanner(true);

    skipNextAutoLoad.current = true;
    setFilterQuery("");
    setDebouncedFilterQuery("");
    setMatchFilter("all");
    setSort("match_score");
    setPage(1);

    setListRefreshing(true);
    await loadJobs({
      soft: true,
      params: {
        page: 1,
        pageSize,
        q: "",
        match: "all",
        sort: "match_score",
      },
    });
    setSearching(false);
  };

  const emptyMessage =
    total === 0 && !debouncedFilterQuery && matchFilter === "all"
      ? "No jobs yet. Enter a title and click Find Jobs to discover matches."
      : "No jobs match your filters. Try adjusting search or match level.";

  const busy = searching || listRefreshing;
  const searchStatusMessage = SEARCH_STATUS_MESSAGES[searchStatusIndex]!;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-8 sm:px-8">
        <SearchControls
          jobTitle={jobTitle}
          location={location}
          showSuccessBanner={showSuccessBanner}
          successMessage={successMessage}
          searching={searching}
          searchStatusMessage={searchStatusMessage}
          onJobTitleChange={setJobTitle}
          onLocationChange={setLocation}
          onFindJobs={() => {
            void handleFindJobs();
          }}
        />

        <div
          className={cn(
            busy && "pointer-events-none opacity-60 transition-opacity",
          )}
        >
          <JobFilters
            filterQuery={filterQuery}
            matchFilter={matchFilter}
            sort={sort}
            onFilterQueryChange={setFilterQuery}
            onMatchFilterChange={(value) => {
              setMatchFilter(value);
              setPage(1);
            }}
            onSortChange={(value) => {
              setSort(value);
              setPage(1);
            }}
          />
        </div>

        <section className="relative overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
          {jobsLoading || searching || listRefreshing ? (
            <JobsTableSkeleton rows={Math.min(pageSize, 8)} />
          ) : (
            <>
              <JobsTable jobs={jobs} emptyMessage={emptyMessage} />
              {total > 0 ? (
                <JobsPagination
                  page={page}
                  totalPages={totalPages}
                  from={from}
                  to={to}
                  total={total}
                  pageSize={pageSize}
                  disabled={busy}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              ) : null}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default function FindJobsPage() {
  return (
    <AuthGuard fallback={<FindJobsPageSkeleton />}>
      <FindJobsPageContent />
    </AuthGuard>
  );
}
