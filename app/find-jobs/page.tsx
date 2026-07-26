"use client";

import { useMemo, useState } from "react";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { FindJobsPageSkeleton } from "@/components/find-jobs/FindJobsPageSkeleton";
import { JobFilters } from "@/components/find-jobs/JobFilters";
import { JobsPagination } from "@/components/find-jobs/JobsPagination";
import { JobsTable } from "@/components/find-jobs/JobsTable";
import { SearchControls } from "@/components/find-jobs/SearchControls";
import Navbar from "@/components/layout/Navbar";
import {
  filterJobs,
  paginateJobs,
  sortJobs,
  type MatchFilter,
  type SortOption,
} from "@/lib/find-jobs-list";
import { MOCK_JOBS } from "@/lib/mock-jobs";

function FindJobsPageContent() {
  const [jobTitle, setJobTitle] = useState("Frontend Engineer");
  const [location, setLocation] = useState("");
  const [showSuccessBanner, setShowSuccessBanner] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");
  const [sort, setSort] = useState<SortOption>("match_score");
  const [page, setPage] = useState(1);

  const filteredSorted = useMemo(() => {
    const filtered = filterJobs(MOCK_JOBS, filterQuery, matchFilter);
    return sortJobs(filtered, sort);
  }, [filterQuery, matchFilter, sort]);

  const paginated = useMemo(
    () => paginateJobs(filteredSorted, page),
    [filteredSorted, page],
  );

  const resetToFirstPage = () => setPage(1);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-8 sm:px-8">
        <SearchControls
          jobTitle={jobTitle}
          location={location}
          showSuccessBanner={showSuccessBanner}
          onJobTitleChange={setJobTitle}
          onLocationChange={setLocation}
          onFindJobs={() => setShowSuccessBanner(true)}
        />

        <JobFilters
          filterQuery={filterQuery}
          matchFilter={matchFilter}
          sort={sort}
          onFilterQueryChange={(value) => {
            setFilterQuery(value);
            resetToFirstPage();
          }}
          onMatchFilterChange={(value) => {
            setMatchFilter(value);
            resetToFirstPage();
          }}
          onSortChange={(value) => {
            setSort(value);
            resetToFirstPage();
          }}
        />

        <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
          <JobsTable jobs={paginated.items} />
          <JobsPagination
            page={paginated.page}
            totalPages={paginated.totalPages}
            from={paginated.from}
            to={paginated.to}
            total={paginated.total}
            onPageChange={setPage}
          />
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
