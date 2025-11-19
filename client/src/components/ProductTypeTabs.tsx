import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type ProductType = "treacle" | "jaggery";

interface ProductTypeTabsProps {
  value: ProductType;
  onChange: (value: ProductType) => void;
  className?: string;
}

const PRODUCT_TYPE_OPTIONS: Array<{ value: ProductType; label: string }> = [
  { value: "treacle", label: "Treacle" },
  { value: "jaggery", label: "Jaggery" },
];

export function ProductTypeTabs({ value, onChange, className }: ProductTypeTabsProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange((next as ProductType) ?? "treacle")}
      className={cn("w-full sm:w-auto", className)}
    >
      <TabsList className="flex h-auto w-full flex-col gap-2 rounded-2xl bg-muted/40 p-1 sm:inline-flex sm:flex-row sm:flex-nowrap sm:gap-0 sm:rounded-full">
        {PRODUCT_TYPE_OPTIONS.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            className="flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-150 data-[state=active]:bg-cta data-[state=active]:text-cta-foreground data-[state=inactive]:text-foreground data-[state=inactive]:hover:bg-gray-200 sm:flex-none"
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
