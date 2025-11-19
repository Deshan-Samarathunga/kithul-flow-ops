import { Suspense, lazy } from "react";
import type { ReportGenerationDialogProps } from "@/components/ReportGenerationDialog";

const ReportGenerationDialogComponent = lazy(() =>
  import("@/components/ReportGenerationDialog").then((module) => ({
    default: module.ReportGenerationDialog,
  })),
);

const ReportDialogFallback = () => (
  <div className="rounded-xl border bg-card/60 p-4 text-sm text-muted-foreground">
    Preparing reporting tools…
  </div>
);

export const ReportGenerationDialog = (props: ReportGenerationDialogProps) => (
  <Suspense fallback={<ReportDialogFallback />}>
    <ReportGenerationDialogComponent {...props} />
  </Suspense>
);

export type { ReportGenerationDialogProps };
