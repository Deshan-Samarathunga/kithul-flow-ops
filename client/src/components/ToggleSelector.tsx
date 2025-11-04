import { cn } from "@/lib/utils";

interface ToggleOption<T> {
  value: T;
  label: string;
  count?: number;
}

interface ToggleSelectorProps<T> {
  options: ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ToggleSelector<T extends string | number>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: ToggleSelectorProps<T>) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1 bg-muted/60 rounded-full p-1 w-full sm:w-auto",
        className,
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
            className={cn(
              "rounded-full font-medium transition-colors",
              sizeClasses[size],
              isActive
                ? "bg-cta text-cta-foreground shadow"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
