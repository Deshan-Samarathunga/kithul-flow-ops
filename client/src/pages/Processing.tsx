import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
import { useAuth } from "@/lib/auth";
import DataService from "@/lib/dataService";
import type { ProcessingBatchDto } from "@/lib/apiClient";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ReportGenerationDialog } from "@/components/ReportGenerationDialog";

function normalizeStatus(status: string | null | undefined) {
  return String(status ?? "").trim().toLowerCase();
}

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
  const [productTypeFilter, setProductTypeFilter] = useState<"sap" | "treacle">("sap");
  const [productionDialog, setProductionDialog] = useState<{ open: boolean; batch: ProcessingBatchDto | null }>(
    { open: false, batch: null }
  );
  const [productionForm, setProductionForm] = useState({
    totalSapOutput: "",
    usedGasKg: "",
    laborCost: "",
  });
  const [isSavingProduction, setIsSavingProduction] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; batchNumber: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const userRole = user?.role || "Guest";
  const userName = user?.name || user?.userId || "User";
  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL || "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }, []);
  const userAvatar = user?.profileImage ? new URL(user.profileImage, apiBase).toString() : undefined;
  const productTypeOptions: Array<{ value: "sap" | "treacle"; label: string }> = [
    { value: "sap", label: "Sap" },
    { value: "treacle", label: "Treacle" },
  ];
  const selectedProductLabel = productTypeFilter === "sap" ? "Sap" : "Treacle";
  const activeProductionProductType = productionDialog.batch?.productType ?? null;
  const productionOutputLabel =
    activeProductionProductType === "sap"
      ? "Sap out after melting (L)"
      : activeProductionProductType
      ? "Output quantity (kg)"
      : "Output quantity";
  const productionOutputStep = activeProductionProductType === "sap" ? "0.1" : "0.01";

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

  const formatVolumeLiters = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return "—";
    }
    return `${Number(value).toFixed(1)} L`;
  };

  const formatVolumeByProduct = (
    value: number | null | undefined,
    productType: ProcessingBatchDto["productType"]
  ) => {
    if (value === null || value === undefined) {
      return "—";
    }
    const unit = productType === "sap" ? "L" : "kg";
    return `${Number(value).toFixed(1)} ${unit}`;
  };

  const formatCurrencyValue = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return "—";
    }
    return `Rs ${Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatUsedGasKg = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return "—";
    }
    return `${Number(value).toFixed(2)} kg`;
  };

  const openProductionDialogForBatch = (batch: ProcessingBatchDto) => {
    setProductionDialog({ open: true, batch });
    setProductionForm({
      totalSapOutput:
        batch.totalSapOutput !== null && batch.totalSapOutput !== undefined
          ? String(batch.totalSapOutput)
          : "",
      usedGasKg:
        batch.usedGasKg !== null && batch.usedGasKg !== undefined
          ? String(batch.usedGasKg)
          : "",
      laborCost: batch.laborCost !== null && batch.laborCost !== undefined ? String(batch.laborCost) : "",
    });
  };

  const closeProductionDialog = () => {
    setProductionDialog({ open: false, batch: null });
    setProductionForm({ totalSapOutput: "", usedGasKg: "", laborCost: "" });
  };

  const handleSaveProductionData = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetBatch = productionDialog.batch;
    if (!targetBatch) {
      return;
    }

    const parsedTotal = parseFloat(productionForm.totalSapOutput);
    const parsedUsedGas = parseFloat(productionForm.usedGasKg);
    const parsedLabor = parseFloat(productionForm.laborCost);

    if (
      Number.isNaN(parsedTotal) ||
      Number.isNaN(parsedUsedGas) ||
      Number.isNaN(parsedLabor) ||
      parsedTotal < 0 ||
      parsedUsedGas < 0 ||
      parsedLabor < 0
    ) {
      toast.error("Please enter valid non-negative numbers for all production fields.");
      return;
    }

    setIsSavingProduction(true);
    try {
      await DataService.updateProcessingBatch(targetBatch.id, {
        totalSapOutput: parsedTotal,
        usedGasKg: parsedUsedGas,
        laborCost: parsedLabor,
      });
      toast.success(`Production data saved for batch ${targetBatch.batchNumber}`);
      closeProductionDialog();
      await loadBatches();
    } catch (err) {
      console.error("Failed to save production data", err);
      toast.error("Unable to save production data. Please try again.");
    } finally {
      setIsSavingProduction(false);
    }
  };

  const batchMetrics = useMemo(() => {
    type Metric = { total: number; active: number; completed: number };
    const metrics: Record<"sap" | "treacle", Metric> = {
      sap: { total: 0, active: 0, completed: 0 },
      treacle: { total: 0, active: 0, completed: 0 },
    };

    batches.forEach((batch) => {
      const key = (batch.productType || "").toLowerCase();
      if (key !== "sap" && key !== "treacle") {
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
    const composite = [batch.batchNumber, batch.productType, normalizedStatus, formatDate(batch.scheduledDate)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return composite.includes(term);
  });

  const activeBatches = filteredBatches.filter((batch) => {
    const status = normalizeStatus(batch.status);
    return status !== "completed" && status !== "cancelled";
  });
  const completedBatches = filteredBatches.filter((batch) => normalizeStatus(batch.status) === "completed");
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
      <Navbar userRole={userRole} userName={userName} userAvatar={userAvatar} onLogout={handleLogout} />
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="space-y-6 sm:space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Processing Batches</h1>
            <p className="text-sm text-muted-foreground">
              Track, submit, and reopen batches as they move through processing.
            </p>
          </div>

          <div className="rounded-2xl border bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-1 bg-muted/60 rounded-full p-1 w-full sm:w-auto">
                {productTypeOptions.map((option) => {
                  const isActive = option.value === productTypeFilter;
                  const metrics = batchMetrics[option.value];
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setProductTypeFilter(option.value)}
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
                        {metrics.total}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-1 flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search batches"
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
                  <FileText className="mr-2 h-4 w-4" /> Generate report
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  className="w-full sm:w-auto"
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
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      {`Add ${selectedProductLabel} Batch`}
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-muted/40 px-3 py-3 text-xs sm:text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{selectedProductLabel} overview</span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-status-progress" /> Active: {selectedMetrics.active}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-status-completed" /> Completed: {selectedMetrics.completed}
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
                <h2 className="text-lg sm:text-xl font-semibold">Active Batches</h2>
                {activeBatches.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-muted/40 bg-muted/20 p-6 text-sm text-muted-foreground text-center">
                    No active {selectedProductLabel.toLowerCase()} batches.
                  </div>
                ) : (
                  activeBatches.map((batch) => (
                    <div
                      key={batch.id}
                      className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-6">
                          <span className="font-medium">{formatDate(batch.scheduledDate)}</span>
                          <span className="hidden text-muted-foreground sm:inline">|</span>
                          <span>
                            Batch <span className="font-semibold text-foreground">{batch.batchNumber}</span>
                          </span>
                          <span className="hidden text-muted-foreground sm:inline">|</span>
                          <span>{`${formatVolumeByProduct(batch.totalQuantity, batch.productType)} total`}</span>
                          <span className="hidden text-muted-foreground sm:inline">|</span>
                          <span>{batch.bucketCount} bucket{batch.bucketCount === 1 ? "" : "s"}</span>
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
                            disabled={submittingBatchId === batch.id}
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
                            className="flex-1 sm:flex-none"
                            onClick={() => setDeleteTarget({ id: batch.id, batchNumber: batch.batchNumber })}
                            disabled={isDeleting && deleteTarget?.id === batch.id}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-lg sm:text-xl font-semibold">Completed Batches</h2>
                {completedBatches.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-muted/40 bg-muted/20 p-6 text-sm text-muted-foreground text-center">
                    No completed {selectedProductLabel.toLowerCase()} batches yet.
                  </div>
                ) : (
                  completedBatches.map((batch) => {
                    const hasProductionData =
                      batch.totalSapOutput !== null &&
                      batch.totalSapOutput !== undefined &&
                      batch.usedGasKg !== null &&
                      batch.usedGasKg !== undefined &&
                      batch.laborCost !== null &&
                      batch.laborCost !== undefined;
                    const outputSummaryLabel = batch.productType === "sap" ? "Sap Output" : "Output Quantity";

                    return (
                      <div
                        key={batch.id}
                        className="rounded-2xl border bg-muted/30 p-4 sm:p-6"
                      >
                        <div className="space-y-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-6">
                              <span className="font-medium">{formatDate(batch.scheduledDate)}</span>
                              <span className="hidden text-muted-foreground sm:inline">|</span>
                              <span>
                                Batch <span className="font-semibold text-foreground">{batch.batchNumber}</span>
                              </span>
                              <span className="hidden text-muted-foreground sm:inline">|</span>
                              <span>{`${formatVolumeByProduct(batch.totalQuantity, batch.productType)} total`}</span>
                            </div>
                            <Badge variant="outline" className="border-status-completed/40 bg-status-completedBg text-status-completed">
                              {formatStatusLabel(batch.status)}
                            </Badge>
                          </div>

                          <div className="grid gap-3 text-xs sm:grid-cols-3">
                            <div className="rounded-lg bg-white/50 px-3 py-2 shadow-sm">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{outputSummaryLabel}</p>
                              <p className="mt-1 text-sm font-medium text-foreground">{formatVolumeByProduct(batch.totalSapOutput, batch.productType)}</p>
                            </div>
                            <div className="rounded-lg bg-white/50 px-3 py-2 shadow-sm">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Gas Cost</p>
                              <p className="mt-1 text-sm font-medium text-foreground">{formatUsedGasKg(batch.usedGasKg)}</p>
                            </div>
                            <div className="rounded-lg bg-white/50 px-3 py-2 shadow-sm">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Labor Cost</p>
                              <p className="mt-1 text-sm font-medium text-foreground">{formatCurrencyValue(batch.laborCost)}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/processing/batch/${batch.id}`)}
                              className="flex-1 sm:flex-none"
                            >
                              View
                            </Button>
                            <Button
                              size="sm"
                              className="bg-cta hover:bg-cta-hover text-cta-foreground flex-1 sm:flex-none"
                              onClick={() => openProductionDialogForBatch(batch)}
                            >
                              {hasProductionData ? "Update Production Data" : "Enter Production Data"}
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

  <ReportGenerationDialog stage="processing" open={reportDialogOpen} onOpenChange={setReportDialogOpen} />

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
              This will permanently remove processing batch {deleteTarget?.batchNumber}. You can recreate it from the
              appropriate drafting stage later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={productionDialog.open}
        onOpenChange={(open) => {
          if (!open && !isSavingProduction) {
            closeProductionDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Production details</DialogTitle>
            <DialogDescription>
              {productionDialog.batch
                ? `Record melting output and costs for batch ${productionDialog.batch.batchNumber}.`
                : "Record melting output and costs for the batch."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveProductionData} className="space-y-5">
            {productionDialog.batch?.productType === "sap" && (
              <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sap in</span>
                  <span className="font-medium text-foreground">
                    {formatVolumeLiters(productionDialog.batch.totalQuantity)}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="totalSapOutput">{productionOutputLabel}</Label>
              <Input
                id="totalSapOutput"
                type="number"
                min="0"
                step={productionOutputStep}
                value={productionForm.totalSapOutput}
                onChange={(event) =>
                  setProductionForm((prev) => ({ ...prev, totalSapOutput: event.target.value }))
                }
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="usedGasKg">Used gas (kg)</Label>
                <Input
                  id="usedGasKg"
                  type="number"
                  min="0"
                  step="0.01"
                  value={productionForm.usedGasKg}
                  onChange={(event) =>
                    setProductionForm((prev) => ({ ...prev, usedGasKg: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="laborCost">Labor cost</Label>
                <Input
                  id="laborCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={productionForm.laborCost}
                  onChange={(event) =>
                    setProductionForm((prev) => ({ ...prev, laborCost: event.target.value }))
                  }
                  required
                />
              </div>
            </div>
            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeProductionDialog}
                disabled={isSavingProduction}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingProduction} className="bg-cta hover:bg-cta-hover">
                {isSavingProduction ? "Saving…" : "Save production data"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}