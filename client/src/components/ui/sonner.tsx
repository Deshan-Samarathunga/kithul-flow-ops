import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton
      position="bottom-right"
      duration={5000}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:flex group-[.toaster]:items-center group-[.toaster]:justify-between group-[.toaster]:gap-3 group-[.toaster]:px-3",
          title: "group-[.toast]:order-1 group-[.toast]:text-left group-[.toast]:mr-auto",
          description:
            "group-[.toast]:order-1 group-[.toast]:text-left group-[.toast]:mr-auto group-[.toast]:text-muted-foreground",
          icon: "group-[.toast]:order-0",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:order-2 group-[.toast]:ml-2 group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:hover:bg-muted/80 group-[.toast]:flex-shrink-0",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
