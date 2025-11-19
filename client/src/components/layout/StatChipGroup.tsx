import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type StatChip = {
  id?: string | number;
  label: string;
  value: ReactNode;
  indicatorColor?: string;
};

export type StatChipGroupProps = {
  heading?: ReactNode;
  items: StatChip[];
  className?: string;
};

export const StatChipGroup = ({ heading, items, className }: StatChipGroupProps) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-muted/40 px-3 py-3 text-xs sm:text-sm text-muted-foreground",
        className,
      )}
    >
      {heading ? <span className="font-medium text-foreground">{heading}</span> : null}
      {items.map((item, index) => {
        const key = item.id ?? index;
        return (
          <span key={key} className="inline-flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.indicatorColor ?? "hsl(var(--muted-foreground))" }}
              aria-hidden="true"
            />
            <span>
              {item.label}: <span className="font-medium text-foreground">{item.value}</span>
            </span>
          </span>
        );
      })}
    </div>
  );
};
