import { Slot } from "@radix-ui/react-slot";
import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

const stackClassMap = {
  sm: "sm:flex-row sm:flex-wrap sm:items-center sm:gap-4",
  md: "md:flex-row md:flex-wrap md:items-center md:gap-4",
  lg: "lg:flex-row lg:flex-wrap lg:items-center lg:gap-4",
} as const;

const childStackClassMap = {
  sm: "sm:flex-row sm:items-center",
  md: "md:flex-row md:items-center",
  lg: "lg:flex-row lg:items-center",
} as const;

const breakpointPrefixMap = {
  sm: "sm",
  md: "md",
  lg: "lg",
} as const;

type StackBreakpoint = keyof typeof stackClassMap;
type Align = "start" | "center" | "end" | "between";

type BaseResponsiveProps<T extends ElementType> = {
  as?: T;
  asChild?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children">;

type ResponsiveToolbarProps<T extends ElementType = "div"> = BaseResponsiveProps<T> & {
  stackAt?: StackBreakpoint;
  align?: Align;
  children: ReactNode;
};

type ToolbarSectionProps<T extends ElementType = "div"> = BaseResponsiveProps<T> & {
  children: ReactNode;
  grow?: boolean;
};

type ToolbarContextValue = {
  stackAt: StackBreakpoint;
};

const ResponsiveToolbarContext = createContext<ToolbarContextValue | null>(null);

const useToolbarContext = () => {
  return (
    useContext(ResponsiveToolbarContext) ?? {
      stackAt: "lg" as StackBreakpoint,
    }
  );
};

const buildAlignClass = (align: Align, stackAt: StackBreakpoint) => {
  const prefix = breakpointPrefixMap[stackAt];

  switch (align) {
    case "start":
      return `${prefix}:justify-start`;
    case "center":
      return `${prefix}:justify-center`;
    case "end":
      return `${prefix}:justify-end`;
    case "between":
    default:
      return `${prefix}:justify-between`;
  }
};

const getComponent = <T extends ElementType = "div">(asChild?: boolean, as?: T) => {
  if (asChild) {
    return Slot;
  }
  return (as ?? "div") as ElementType;
};

const toolbarSectionBase = "flex w-full min-w-0 flex-col gap-3";

const buildSectionClassName = (
  stackAt: NonNullable<ResponsiveToolbarProps["stackAt"]>,
  grow?: boolean,
  extraClassName?: string,
  className?: string,
) =>
  cn(
    toolbarSectionBase,
    childStackClassMap[stackAt],
    grow && `${breakpointPrefixMap[stackAt]}:flex-1`,
    extraClassName,
    className,
  );

const ResponsiveToolbarLeading = <T extends ElementType = "div">(
  { as, asChild, className, grow, children, ...props }: ToolbarSectionProps<T>,
) => {
  const { stackAt } = useToolbarContext();
  const Component = getComponent(asChild, as);
  return (
    <Component
      className={buildSectionClassName(stackAt, grow, "sm:flex-none", className)}
      {...props}
    >
      {children}
    </Component>
  );
};

const ResponsiveToolbarContent = <T extends ElementType = "div">(
  { as, asChild, className, grow, children, ...props }: ToolbarSectionProps<T>,
) => {
  const { stackAt } = useToolbarContext();
  const Component = getComponent(asChild, as);
  return (
    <Component
      className={buildSectionClassName(stackAt, grow, "sm:flex-1", className)}
      {...props}
    >
      {children}
    </Component>
  );
};

const ResponsiveToolbarActions = <T extends ElementType = "div">(
  { as, asChild, className, grow, children, ...props }: ToolbarSectionProps<T>,
) => {
  const { stackAt } = useToolbarContext();
  const Component = getComponent(asChild, as);
  return (
    <Component
      className={buildSectionClassName(
        stackAt,
        grow,
        "sm:flex-none sm:justify-end sm:items-center sm:ml-auto",
        cn("sm:justify-end", className),
      )}
      {...props}
    >
      {children}
    </Component>
  );
};

const ResponsiveToolbarSection = <T extends ElementType = "div">(
  { as, asChild, className, grow, children, ...props }: ToolbarSectionProps<T>,
) => {
  const { stackAt } = useToolbarContext();
  const Component = getComponent(asChild, as);
  return (
    <Component className={buildSectionClassName(stackAt, grow, undefined, className)} {...props}>
      {children}
    </Component>
  );
};

const ResponsiveToolbarRoot = <T extends ElementType = "div">({
  as,
  asChild,
  stackAt = "lg",
  align = "between",
  className,
  children,
  ...props
}: ResponsiveToolbarProps<T>) => {
  const Component = getComponent(asChild, as);

  return (
    <ResponsiveToolbarContext.Provider value={{ stackAt }}>
      <Component
        className={cn(
          "flex w-full min-w-0 flex-col gap-4",
          stackClassMap[stackAt],
          buildAlignClass(align, stackAt),
          className,
        )}
        {...props}
      >
        {children}
      </Component>
    </ResponsiveToolbarContext.Provider>
  );
};

export const ResponsiveToolbar = Object.assign(ResponsiveToolbarRoot, {
  Leading: ResponsiveToolbarLeading,
  Content: ResponsiveToolbarContent,
  Actions: ResponsiveToolbarActions,
  Section: ResponsiveToolbarSection,
});
