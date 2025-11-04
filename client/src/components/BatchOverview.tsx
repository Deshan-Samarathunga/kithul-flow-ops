interface BatchOverviewProps {
  label: string;
  active: number;
  completed: number;
  className?: string;
}

export function BatchOverview({ label, active, completed, className }: BatchOverviewProps) {
  return (
    <div
      className={`mt-4 flex items-center gap-4 rounded-xl bg-muted/40 px-3 py-3 text-sm text-muted-foreground ${className ?? ""}`}
    >
      <span className="font-medium text-foreground">{label} Overview</span>
      <span className="px-2 text-muted-foreground/40">·</span>
      <span className="inline-flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#e74c3c" }} /> Active:{" "}
        {active}
      </span>
      <span className="px-2 text-muted-foreground/40">·</span>
      <span className="inline-flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#2ecc71" }} /> Completed:{" "}
        {completed}
      </span>
    </div>
  );
}
