import { Toaster as HotToaster } from "react-hot-toast";

export function Toaster() {
  return (
    <HotToaster
      position="bottom-right"
      toastOptions={{
        duration: 5000,
        className:
          "rounded-xl bg-card text-card-foreground shadow-xl border border-border px-4 py-3 text-sm",
        success: {
          iconTheme: {
            primary: "#16a34a",
            secondary: "white",
          },
        },
        error: {
          iconTheme: {
            primary: "#dc2626",
            secondary: "white",
          },
        },
      }}
    />
  );
}
