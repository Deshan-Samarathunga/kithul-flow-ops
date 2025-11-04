import { cn } from "@/lib/utils";

interface ProductTypeTabsProps {
  value: "treacle" | "jaggery";
  onChange: (value: "treacle" | "jaggery") => void;
  className?: string;
}

export function ProductTypeTabs({ value, onChange, className }: ProductTypeTabsProps) {
  return (
    <div className={cn("inline-flex bg-muted/40 rounded-full p-1 w-full sm:w-auto", className)}>
      <button
        type="button"
        className={cn(
          "px-4 py-1.5 text-sm font-medium rounded-full transition-colors duration-150",
          value === "treacle"
            ? "bg-cta hover:bg-cta-hover text-cta-foreground"
            : "text-foreground hover:bg-gray-200",
        )}
        aria-pressed={value === "treacle"}
        onClick={() => onChange("treacle")}
      >
        Treacle
      </button>
      <button
        type="button"
        className={cn(
          "px-4 py-1.5 text-sm font-medium rounded-full transition-colors duration-150",
          value === "jaggery"
            ? "bg-cta hover:bg-cta-hover text-cta-foreground"
            : "text-foreground hover:bg-gray-200",
        )}
        aria-pressed={value === "jaggery"}
        onClick={() => onChange("jaggery")}
      >
        Jaggery
      </button>
    </div>
  );
}
