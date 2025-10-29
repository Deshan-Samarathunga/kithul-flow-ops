import { cn } from "@/lib/utils";

interface ProductTypeSelectorProps {
  value: "sap" | "treacle";
  onChange: (value: "sap" | "treacle") => void;
  metrics?: {
    sap: { total: number; active: number; completed: number };
    treacle: { total: number; active: number; completed: number };
  };
  className?: string;
}

const productTypeOptions: Array<{ value: "sap" | "treacle"; label: string }> = [
  { value: "sap", label: "Sap" },
  { value: "treacle", label: "Treacle" },
];

export function ProductTypeSelector({ value, onChange, metrics, className }: ProductTypeSelectorProps) {
  return (
    <div className={cn("flex items-center gap-1 bg-muted/60 rounded-full p-1 w-full sm:w-auto", className)}>
      {productTypeOptions.map((option) => {
        const isActive = option.value === value;
        const optionMetrics = metrics?.[option.value] || { total: 0, active: 0, completed: 0 };
        
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-cta text-cta-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>{option.label}</span>
            <span
              className={cn(
                "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                isActive ? "bg-white/25 text-white" : "bg-muted text-muted-foreground"
              )}
            >
              {optionMetrics.total}
            </span>
          </button>
        );
      })}
    </div>
  );
}
