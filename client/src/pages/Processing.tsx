import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText, Loader2, Plus, RefreshCcw, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import DataService from "@/lib/dataService";
import type { ProcessingBatchDto } from "@/lib/apiClient";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ReportGenerationDialog } from "@/components/ReportGenerationDialog";
import { ProductTypeSelector } from "@/components/ProductTypeSelector";

function normalizeStatus(status: string | null | undefined) {
  return String(status ?? "")
    .trim()
    .toLowerCase();
}

// Processing dashboard for managing batches prior to packaging.
export default function Processing() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [batches, setBatches] = useState<ProcessingBatchDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [submittingBatchId, setSubmittingBatchId] = useState<string | null>(null);
  const [reopeningBatchId, setReopeningBatchId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [productTypeFilter, setProductTypeFilter] = useState<"treacle" | "jaggery">(() => {
    const saved =
      typeof window !== "undefined" ? window.localStorage.getItem("processing.productType") : null;
    return saved === "jaggery" || saved === "treacle" ? saved : "treacle";
  });
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; batchNumber: string } | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const userRole = user?.role || "Guest";
  const userName = user?.name || user?.userId || "User";

  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL || "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }, []);
  const userAvatar = user?.profileImage
    ? new URL(user.profileImage, apiBase).toString()
    : undefined;
  const selectedProductLabel = productTypeFilter === "treacle" ? "Treacle" : "Jaggery";

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const loadBatches = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const remoteBatches = await DataService.getProcessingBatches();
      setBatches(remoteBatches);
    } catch (err) {
      console.error("Failed to load processing batches", err);
      setError("Unable to load batches. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadBatches();
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("processing.productType", productTypeFilter);
      }
    } catch {
      // no-op if storage is unavailable
    }
  }, [productTypeFilter]);

  const handleCreateBatch = async () => {
    setIsCreating(true);
    try {
      const created = await DataService.createProcessingBatch({ productType: productTypeFilter });
      toast.success(`${selectedProductLabel} batch ${created.batchNumber} created`);
      await loadBatches();
      navigate(`/processing/batch/${created.id}`);
    } catch (err) {
      console.error("Failed to create processing batch", err);
      toast.error("Unable to create a new batch. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSubmitBatch = async (batchId: string, batchNumber: string) => {
    setSubmittingBatchId(batchId);
    try {
      await DataService.submitProcessingBatch(batchId);
      toast.success(`Batch ${batchNumber} submitted`);
      await loadBatches();
    } catch (err) {
      console.error("Failed to submit processing batch", err);
      toast.error("Unable to submit the batch. Please try again.");
    } finally {
      setSubmittingBatchId(null);
    }
  };

  const handleReopenBatch = async (batchId: string, batchNumber: string) => {
    setReopeningBatchId(batchId);
    try {
      await DataService.reopenProcessingBatch(batchId);
      toast.success(`Batch ${batchNumber} reopened`);
      await loadBatches();
    } catch (err) {
      console.error("Failed to reopen processing batch", err);
      toast.error("Unable to reopen the batch. Please try again.");
    } finally {
      setReopeningBatchId(null);
    }
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) {
      return "—";
    }
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      return value;
    }
    return new Date(parsed).toLocaleDateString();
  };

  const formatStatusLabel = (status: string) =>
    status
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  const formatVolumeByProduct = (
    value: number | null | undefined,
    productType: ProcessingBatchDto["productType"],
  ) => {
    if (value === null || value === undefined) {
      return "—";
    }
    const unit = productType === "treacle" ? "L" : "kg";
    return `${Number(value).toFixed(1)} ${unit}`;
  };

  const formatOutputQuantity = (batch: ProcessingBatchDto) =>
    formatVolumeByProduct(batch.totalSapOutput ?? null, batch.productType);

  const batchMetrics = useMemo(() => {
    type Metric = { total: number; active: number; completed: number };
    const metrics: Record<"treacle" | "jaggery", Metric> = {
      treacle: { total: 0, active: 0, completed: 0 },
      jaggery: { total: 0, active: 0, completed: 0 },
    };

    batches.forEach((batch) => {
      const key = (batch.productType || "").toLowerCase();
      if (key !== "treacle" && key !== "jaggery") {
        return;
      }

      const status = normalizeStatus(batch.status);
      metrics[key].total += 1;
      if (status === "completed") {
        metrics[key].completed += 1;
      } else if (status !== "cancelled") {
        metrics[key].active += 1;
      }
    });

    return metrics;
  }, [batches]);

  const handleRefresh = () => {
    void loadBatches();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);
    try {
      await DataService.deleteProcessingBatch(deleteTarget.id);
      toast.success(`Batch ${deleteTarget.batchNumber} deleted`);
      setDeleteTarget(null);
      await loadBatches();
    } catch (err) {
      console.error("Failed to delete processing batch", err);
      toast.error("Unable to delete the batch. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredBatches = batches.filter((batch) => {
    const matchesType = (batch.productType || "").toLowerCase() === productTypeFilter;
    if (!matchesType) {
      return false;
    }

    const normalizedStatus = normalizeStatus(batch.status);
    if (!searchQuery.trim()) {
      return true;
    }
    const term = searchQuery.trim().toLowerCase();
    const composite = [
      batch.batchNumber,
      batch.productType,
      normalizedStatus,
      formatDate(batch.scheduledDate),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return composite.includes(term);
  });

  const activeBatches = filteredBatches.filter((batch) => {
    const status = normalizeStatus(batch.status);
    return status !== "completed" && status !== "cancelled";
  });
  const completedBatches = filteredBatches.filter(
    (batch) => normalizeStatus(batch.status) === "completed",
  );
  const displayBatchNumbers = useMemo(() => {
    const map = new Map<string, number>();
    filteredBatches.forEach((batch, index) => {
      map.set(batch.id, index + 1);
    });
    return map;
  }, [filteredBatches]);
  const selectedMetrics = batchMetrics[productTypeFilter];

  const hasSubmittedProcessing = useMemo(
    () =>
      batches.some((batch) => {
        const status = normalizeStatus(batch.status);
        return status === "submitted" || status === "completed";
      }),
    [batches],
  );

  const handleOpenReportDialog = () => {
    if (!hasSubmittedProcessing) {
      toast.error("Submit at least one batch before generating a report.");
      return;
    }
    setReportDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        userRole={userRole}
        userName={userName}
        userAvatar={userAvatar}
        onLogout={handleLogout}
      />
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="space-y-6 sm:space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
              Processing Batches
            </h1>
            <p className="text-sm text-muted-foreground">
              Track, submit, and reopen batches as they move through processing.
            </p>
          </div>

          <div className="rounded-2xl border bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="inline-flex bg-muted/40 rounded-full p-1 w-full sm:w-auto">
                <button
                  type="button"
                  className={`px-4 py-1.5 text-sm font-medium rounded-full ${productTypeFilter === "treacle" ? "bg-cta hover:bg-cta-hover text-cta-foreground" : "text-foreground hover:bg-gray-200 transition-colors duration-150"}`}
                  aria-pressed={productTypeFilter === "treacle"}
                  onClick={() => setProductTypeFilter("treacle")}
                >
                  Treacle
                </button>
                <button
                  type="button"
                  className={`px-4 py-1.5 text-sm font-medium rounded-full ${productTypeFilter === "jaggery" ? "bg-cta hover:bg-cta-hover text-cta-foreground" : "text-foreground hover:bg-gray-200 transition-colors duration-150"}`}
                  aria-pressed={productTypeFilter === "jaggery"}
                  onClick={() => setProductTypeFilter("jaggery")}
                >
                  Jaggery
                </button>
              </div>

              <div className="flex flex-1 flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search Batches"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="pl-10"
                  />
                </div>

                <Button
                  variant="secondary"
                  onClick={handleOpenReportDialog}
                  className="w-full sm:w-auto"
                >
                  <FileText className="mr-2 h-4 w-4" /> Generate Report
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  className="w-full sm:w-auto md:mr-4"
                  disabled={isLoading}
                >
                  <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  <span className="ml-2">Refresh</span>
                </Button>
                <Button
                  onClick={handleCreateBatch}
                  className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto"
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <span className="font-medium">Add New</span>
                  )}
                </Button>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-4 rounded-xl bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{selectedProductLabel} Overview</span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-600" /> Active:{" "}
                {selectedMetrics.active}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-600" /> Completed:{" "}
                {selectedMetrics.completed}
              </span>
            </div>
          </div>

          {isLoading && (
            <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
              Loading batches…
            </div>
          )}

          {error && !isLoading && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive shadow-sm">
              {error}
            </div>
          )}

          {!isLoading && !error && batches.length === 0 && (
            <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground text-center shadow-sm">
              No batches yet. Create a new batch to get started.
            </div>
          )}

          {!isLoading && !error && batches.length > 0 && (
            <div className="space-y-10">
              <section className="space-y-3">
                <h2 className="text-lg sm:text-xl font-semibold">Processing batches</h2>
                {activeBatches.length === 0 ? (
                  <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
                    No active {selectedProductLabel.toLowerCase()} batches.
                  </div>
                ) : (
                  activeBatches.map((batch) => (
                    <div
                      key={batch.id}
                      className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm">
                          <span>
                            Batch ID:{" "}
                            <span className="font-semibold text-foreground">
                              {displayBatchNumbers.get(batch.id) ?? batch.batchNumber}
                            </span>
                          </span>
                          <span className="px-2 text-muted-foreground/40">|</span>
                          <span className="font-medium">{formatDate(batch.scheduledDate)}</span>
                          <span className="px-2 text-muted-foreground/40">|</span>
                          <span>
                            Total quantity:{" "}
                            {formatVolumeByProduct(batch.totalQuantity, batch.productType)}
                          </span>
                          <span className="px-2 text-muted-foreground/40">|</span>
                          <span>Cans: {batch.canCount}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/processing/batch/${batch.id}`)}
                            className="flex-1 sm:flex-none"
                          >
                            Continue
                          </Button>
                          <Button
                            size="sm"
                            className="bg-cta hover:bg-cta-hover text-cta-foreground flex-1 sm:flex-none"
                            onClick={() => void handleSubmitBatch(batch.id, batch.batchNumber)}
                            disabled={
                              submittingBatchId === batch.id ||
                              !(
                                batch.totalSapOutput !== null &&
                                batch.totalSapOutput !== undefined &&
                                batch.gasUsedKg !== null &&
                                batch.gasUsedKg !== undefined
                              )
                            }
                          >
                            {submittingBatchId === batch.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Submitting…
                              </>
                            ) : (
                              "Submit"
                            )}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="sm:flex-none"
                            onClick={() =>
                              setDeleteTarget({ id: batch.id, batchNumber: batch.batchNumber })
                            }
                            disabled={isDeleting && deleteTarget?.id === batch.id}
                            aria-label={`Delete batch ${batch.batchNumber}`}
                            title={`Delete batch ${batch.batchNumber}`}
                          >
                            <span className="inline-flex items-center gap-1">
                              <Trash2 className="h-4 w-4" /> Delete
                            </span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-lg sm:text-xl font-semibold">Completed batches</h2>
                {completedBatches.length === 0 ? (
                  <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
                    No completed {selectedProductLabel.toLowerCase()} batches yet.
                  </div>
                ) : (
                  completedBatches.map((batch) => {
                    return (
                      <div
                        key={batch.id}
                        className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="space-y-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm">
                              <span>
                                Batch ID:{" "}
                                <span className="font-semibold text-foreground">
                                  {displayBatchNumbers.get(batch.id) ?? batch.batchNumber}
                                </span>
                              </span>
                              <span className="px-2 text-muted-foreground/40">|</span>
                              <span className="font-medium">{formatDate(batch.scheduledDate)}</span>
                              <span className="px-2 text-muted-foreground/40">|</span>
                              <span>{`Output quantity: ${formatOutputQuantity(batch)}`}</span>
                              <span className="px-2 text-muted-foreground/40">|</span>
                              <span className="text-xs font-medium uppercase tracking-wide bg-green-50 text-green-700 px-2 py-1 rounded">
                                {normalizeStatus(batch.status) === "completed"
                                  ? "Submitted"
                                  : formatStatusLabel(batch.status)}
                              </span>
                            </div>

                            <div className="hidden sm:flex sm:flex-wrap sm:items-center sm:gap-2 sm:justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/processing/batch/${batch.id}`)}
                                className="sm:flex-none"
                              >
                                View
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleReopenBatch(batch.id, batch.batchNumber)}
                                disabled={reopeningBatchId === batch.id}
                                className="sm:flex-none"
                              >
                                {reopeningBatchId === batch.id ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Reopening…
                                  </>
                                ) : (
                                  "Reopen"
                                )}
                              </Button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:hidden">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/processing/batch/${batch.id}`)}
                              className="flex-1 sm:flex-none"
                            >
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleReopenBatch(batch.id, batch.batchNumber)}
                              disabled={reopeningBatchId === batch.id}
                              className="flex-1 sm:flex-none"
                            >
                              {reopeningBatchId === batch.id ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Reopening…
                                </>
                              ) : (
                                "Reopen"
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </section>
            </div>
          )}
        </div>
      </main>

      <ReportGenerationDialog
        stage="processing"
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete processing batch?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove processing batch {deleteTarget?.batchNumber}. You can
              recreate it from the appropriate drafting stage later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmDelete()}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
