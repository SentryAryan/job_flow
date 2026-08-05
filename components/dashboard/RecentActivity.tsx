import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    activityDotClasses,
    type DashboardActivityItem,
} from "@/lib/mock-dashboard";
import { revealDelay } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

type RecentActivityProps = {
  items: DashboardActivityItem[];
  revealDelayMs?: number;
};

/** Items trail the card, then stop cascading so long feeds never feel slow. */
const ITEM_STAGGER_MS = 30;
const ITEM_LEAD_MS = 60;
const MAX_STAGGERED_ITEMS = 6;

export function RecentActivity({
  items,
  revealDelayMs = 0,
}: RecentActivityProps) {
  return (
    <Card
      className="jp-reveal h-full bg-surface shadow-none"
      style={revealDelay(revealDelayMs)}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-text-primary">
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-5" aria-label="Recent activity">
          {items.map((item, index) => {
            const colors = activityDotClasses(item.type);
            const step = Math.min(index, MAX_STAGGERED_ITEMS);
            return (
              <li
                key={item.id}
                className="jp-reveal flex items-start gap-3"
                style={revealDelay(
                  revealDelayMs + ITEM_LEAD_MS + step * ITEM_STAGGER_MS,
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-surface",
                    colors.ring,
                  )}
                  aria-hidden="true"
                >
                  <span className={cn("size-2 rounded-full", colors.dot)} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">
                    {item.message}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">{item.timeAgo}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
