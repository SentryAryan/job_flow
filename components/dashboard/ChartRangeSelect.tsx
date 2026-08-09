"use client";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DASHBOARD_CHART_RANGES,
    DASHBOARD_CHART_RANGE_LABELS,
    type DashboardChartRange,
} from "@/lib/dashboard-range";

type ChartRangeSelectProps = {
  value: DashboardChartRange;
  onValueChange: (value: DashboardChartRange) => void;
};

export function ChartRangeSelect({
  value,
  onValueChange,
}: ChartRangeSelectProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-medium text-text-secondary">Chart range</p>
      <Select
        value={value}
        onValueChange={(next) => {
          if (
            (DASHBOARD_CHART_RANGES as readonly string[]).includes(next)
          ) {
            onValueChange(next as DashboardChartRange);
          }
        }}
      >
        <SelectTrigger
          aria-label="Chart time range"
          className="w-[180px] cursor-pointer"
        >
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent>
          {DASHBOARD_CHART_RANGES.map((range) => (
            <SelectItem
              key={range}
              value={range}
              className="cursor-pointer"
            >
              {DASHBOARD_CHART_RANGE_LABELS[range]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
