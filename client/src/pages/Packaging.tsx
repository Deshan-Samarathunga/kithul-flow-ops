import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, Plus, RefreshCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import DataService from "@/lib/dataService";
import type { EligibleProcessingBatchDto, PackagingBatchDto } from "@/lib/apiClient";
import { ReportGenerationDialog } from "@/components/ReportGenerationDialog";
import { ProductTypeSelector } from "@/components/ProductTypeSelector";
import { usePersistentState } from "@/hooks/usePersistentState";

function normalizePackagingStatus(status: string | null | undefined) {
  return String(status ?? "").trim().toLowerCase();
}

export default function Packaging() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [batches, setBatches] = useState<PackagingBatchDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [eligibleProcessing, setEligibleProcessing] = useState<EligibleProcessingBatchDto[]>([]);
  const [eligibleSearch, setEligibleSearch] = useState<string>("");
  const [isEligibleLoading, setIsEligibleLoading] = useState<boolean>(false);
  const [createDialog, setCreateDialog] = usePersistentState<{ open: boolean }>("packaging.createDialogOpen", { open: false });
  const [selectedProcessingId, setSelectedProcessingId] = useState<string | null>(null);
  const [isCreatingPackagingBatch, setIsCreatingPackagingBatch] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<{ packagingId: string; batchNumber: string } | null>(null);
  const [isDeletingPackaging, setIsDeletingPackaging] = useState<boolean>(false);
  const [reportDialogOpen, setReportDialogOpen] = usePersistentState<boolean>("packaging.reportDialogOpen", false);
  const [submittingPackagingId, setSubmittingPackagingId] = useState<string | null>(null);
  const [reopeningPackagingId, setReopeningPackagingId] = useState<string | null>(null);
  const userRole = user?.role || "Guest";
  const userName = user?.name || user?.userId || "User";
  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL || "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }, []);
  const userAvatar = user?.profileImage ? new URL(user.profileImage, apiBase).toString() : undefined;
  const [searchQuery, setSearchQuery] = usePersistentState<string>("packaging.search", "");
  const [productTypeFilter, setProductTypeFilter] = useState<"sap" | "treacle">(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("packaging.productType") : null;
    return saved === "treacle" || saved === "sap" ? saved : "sap";
  });

  const packagingMetrics = useMemo(() => {
    type Metrics = { total: number; active: number; completed: number };
    const metrics: Record<"sap" | "treacle", Metrics> = {
      sap: { total: 0, active: 0, completed: 0 },
      treacle: { total: 0, active: 0, completed: 0 },
    };

    batches.forEach((batch) => {
      const key = (batch.productType || "").toLowerCase();
      if (key !== "sap" && key !== "treacle") {
        return;
      }
      const status = (batch.packagingStatus || "").toLowerCase();
      metrics[key].total += 1;
      if (status === "completed") {
        metrics[key].completed += 1;
      } else {
        metrics[key].active += 1;
      }
    });

    return metrics;
  }, [batches]);

  const filteredEligibleProcessing = useMemo(() => {
    const term = eligibleSearch.trim().toLowerCase();
    if (!term) {
      return eligibleProcessing;
    }
    return eligibleProcessing.filter((batch) => {
      const composite = [
        batch.batchNumber,
        batch.productType,
        batch.scheduledDate ?? "",
        batch.bucketCount.toString(),
        batch.totalQuantity.toString(),
      ]
        .join(" ")
        .toLowerCase();
      return composite.includes(term);
    });
  }, [eligibleProcessing, eligibleSearch]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const loadBatches = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const remoteBatches = await DataService.getPackagingBatches();
      setBatches(remoteBatches);
    } catch (err) {
      console.error("Failed to load packaging batches", err);
      setError("Unable to load packaging batches. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEligibleProcessingBatches = async (product: "sap" | "treacle") => {
    setIsEligibleLoading(true);
    try {
      const list = await DataService.getEligibleProcessingBatchesForPackaging(product);
      setEligibleProcessing(list);
    } catch (err) {
      console.error("Failed to load eligible processing batches", err);
      toast.error("Unable to load processing batches. Please try again later.");
      setEligibleProcessing([]);
    } finally {
      setIsEligibleLoading(false);
    }
  };

  const openCreatePackagingDialog = () => {
    setCreateDialog({ open: true });
    setEligibleSearch("");
    setSelectedProcessingId(null);
  };

  const handleCreatePackagingBatch = async () => {
    if (!selectedProcessingId) {
      toast.error("Select a processing batch first.");
      return;
    }
    setIsCreatingPackagingBatch(true);
    try {
      const created = await DataService.createPackagingBatch(selectedProcessingId);
      toast.success(`Packaging batch created for ${created.batchNumber}`);
      setCreateDialog({ open: false });
      await loadBatches();
    } catch (err) {
      console.error("Failed to create packaging batch", err);
      toast.error(err instanceof Error ? err.message : "Unable to create packaging batch");
    } finally {
      setIsCreatingPackagingBatch(false);
    }
  };

  const handleDeletePackagingBatch = async () => {
    if (!deleteTarget) {
      return;
    }
    setIsDeletingPackaging(true);
    try {
      await DataService.deletePackagingBatch(deleteTarget.packagingId);
      toast.success(`Packaging batch ${deleteTarget.batchNumber} deleted`);
      setDeleteTarget(null);
      await loadBatches();
    } catch (err) {
      console.error("Failed to delete packaging batch", err);
      toast.error(err instanceof Error ? err.message : "Unable to delete packaging batch");
    } finally {
      setIsDeletingPackaging(false);
    }
  };

  const buildPackagingUpdatePayload = (batch: PackagingBatchDto) => {
    const packagingId = batch.packagingId ?? batch.id;
    if (!packagingId) {
      return null;
    }

    const productType = (batch.productType || "").toLowerCase();
    const finishedQuantity =
      batch.finishedQuantity !== null && batch.finishedQuantity !== undefined
        ? Number(batch.finishedQuantity)
        : NaN;
    if (Number.isNaN(finishedQuantity)) {
      return null;
    }

    if (productType === "sap") {
      if (
        batch.bottleQuantity === null ||
        batch.bottleQuantity === undefined ||
        batch.lidQuantity === null ||
        batch.lidQuantity === undefined
      ) {
        return null;
      }
      return {
        finishedQuantity,
        bottleQuantity: Number(batch.bottleQuantity),
        lidQuantity: Number(batch.lidQuantity),
      };
    }

    if (productType === "treacle") {
      if (
        batch.alufoilQuantity === null ||
        batch.alufoilQuantity === undefined ||
        batch.vacuumBagQuantity === null ||
        batch.vacuumBagQuantity === undefined ||
        batch.parchmentPaperQuantity === null ||
        batch.parchmentPaperQuantity === undefined
      ) {
        return null;
      }
      return {
        finishedQuantity,
        alufoilQuantity: Number(batch.alufoilQuantity),
        vacuumBagQuantity: Number(batch.vacuumBagQuantity),
        parchmentPaperQuantity: Number(batch.parchmentPaperQuantity),
      };
    }

    return null;
  };

  const handleSubmitPackagingBatch = async (batch: PackagingBatchDto) => {
    const packagingId = batch.packagingId ?? batch.id;
    if (!packagingId) {
      toast.error("Unable to submit packaging batch.");
      return;
    }

    const payload = buildPackagingUpdatePayload(batch);
    if (!payload) {
      toast.error("Enter packaging quantities before submitting the batch.");
      return;
    }

    setSubmittingPackagingId(packagingId);
    try {
      await DataService.updatePackagingBatch(packagingId, {
        ...payload,
        status: "completed",
      });
      toast.success(`Packaging batch ${batch.batchNumber} submitted`);
      await loadBatches();
    } catch (err) {
      console.error("Failed to submit packaging batch", err);
      toast.error("Unable to submit packaging batch. Please try again.");
    } finally {
      setSubmittingPackagingId(null);
    }
  };

  const handleReopenPackagingBatch = async (batch: PackagingBatchDto) => {
    const packagingId = batch.packagingId ?? batch.id;
    if (!packagingId) {
      toast.error("Unable to reopen packaging batch.");
      return;
    }

    const payload = buildPackagingUpdatePayload(batch);
    if (!payload) {
      toast.error("Packaging batch is missing required quantities and cannot be reopened.");
      return;
    }

    setReopeningPackagingId(packagingId);
    try {
      await DataService.updatePackagingBatch(packagingId, {
        ...payload,
        status: "in-progress",
      });
      toast.success(`Packaging batch ${batch.batchNumber} reopened`);
      await loadBatches();
    } catch (err) {
      console.error("Failed to reopen packaging batch", err);
      toast.error("Unable to reopen packaging batch. Please try again.");
    } finally {
      setReopeningPackagingId(null);
    }
  };

  useEffect(() => {
    void loadBatches();
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("packaging.productType", productTypeFilter);
      }
    } catch {
      // ignore storage errors
    }
  }, [productTypeFilter]);

  useEffect(() => {
    if (createDialog.open) {
      void fetchEligibleProcessingBatches(productTypeFilter);
    }
  }, [createDialog.open, productTypeFilter]);

  const handleRefresh = () => {
    void loadBatches();
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

  const resolveBadgeStatus = (status: string) =>
    status === "completed" ? "completed" : "in-progress";

  const formatStatusLabel = (status: string) =>
    status
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  const formatVolumeByProduct = (
    value: number | null | undefined,
    productType: PackagingBatchDto["productType"]
  ) => {
    if (value === null || value === undefined) {
      return "—";
    }
    const unit = (productType || "").toLowerCase() === "sap" ? "L" : "kg";
    return `${Number(value).toFixed(1)} ${unit}`;
  };

  const formatFinishedQuantity = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return "—";
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return "—";
    }
    if (Number.isInteger(numeric)) {
      return numeric.toLocaleString();
    }
    return numeric.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const filteredBatches = batches.filter((batch) => {
    const matchesType = (batch.productType || "").toLowerCase() === productTypeFilter;
    if (!matchesType) {
      return false;
    }
    if (!searchQuery.trim()) {
      return true;
    }
    const term = searchQuery.trim().toLowerCase();
    const composite = [
      batch.batchNumber,
      batch.productType,
      formatDate(batch.startedAt ?? batch.scheduledDate),
      batch.totalSapOutput?.toString(),
      batch.finishedQuantity?.toString(),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return composite.includes(term);
  });

  const filteredByType = filteredBatches;
  const selectedProductLabel = productTypeFilter === "sap" ? "Sap" : "Treacle";
  const selectedMetrics = packagingMetrics[productTypeFilter];
  const activePackagingBatches = useMemo(
    () =>
      filteredByType.filter(
        (batch) => normalizePackagingStatus(batch.packagingStatus) !== "completed",
      ),
    [filteredByType],
  );
  const completedPackagingBatches = useMemo(
    () =>
      filteredByType.filter(
        (batch) => normalizePackagingStatus(batch.packagingStatus) === "completed",
      ),
    [filteredByType],
  );

  const hasCompletedPackaging = useMemo(
    () =>
      (packagingMetrics.sap.completed ?? 0) + (packagingMetrics.treacle.completed ?? 0) > 0,
    [packagingMetrics],
  );

  const handleOpenReportDialog = () => {
    if (!hasCompletedPackaging) {
      toast.error("Complete at least one packaging batch before generating a report.");
      return;
    }
    setReportDialogOpen(true);
  };

  const renderPackagingCard = (batch: PackagingBatchDto, variant: "active" | "completed" = "active") => {
    const productType = (batch.productType || "").toLowerCase();
    const isSap = productType === "sap";
    const isTreacle = productType === "treacle";
    const hasFinishedQuantity =
      batch.finishedQuantity !== null && batch.finishedQuantity !== undefined;
    const packagingId = batch.packagingId ?? batch.id;
    const hasPackagingData = isSap
      ? hasFinishedQuantity &&
        batch.bottleQuantity !== null &&
        batch.bottleQuantity !== undefined &&
        batch.lidQuantity !== null &&
        batch.lidQuantity !== undefined
      : isTreacle
      ? hasFinishedQuantity &&
        batch.alufoilQuantity !== null &&
        batch.alufoilQuantity !== undefined &&
        batch.vacuumBagQuantity !== null &&
        batch.vacuumBagQuantity !== undefined &&
        batch.parchmentPaperQuantity !== null &&
        batch.parchmentPaperQuantity !== undefined
      : false;

    const productLabel = productType ? productType.charAt(0).toUpperCase() + productType.slice(1) : "Sap";
    const showFinishedQuantity = variant === "completed";
    return (
      <div
        key={batch.id}
        className={cn(
          "border rounded-2xl p-4 sm:p-6 shadow-sm",
          variant === "completed" ? "bg-muted/30" : "bg-card transition-shadow hover:shadow-md",
        )}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm sm:gap-5">
            <span className="font-medium">{formatDate(batch.startedAt ?? batch.scheduledDate)}</span>
            <span className="hidden sm:inline text-muted-foreground">|</span>
            <span>
              Batch <span className="font-semibold text-foreground">{batch.batchNumber}</span>
            </span>
            <span className="hidden sm:inline text-muted-foreground">|</span>
            <span className="uppercase tracking-wide text-xs text-muted-foreground">{productLabel}</span>
            {variant === "active" && (
              <>
                <span className="hidden sm:inline text-muted-foreground">|</span>
                <span className="text-muted-foreground text-xs uppercase tracking-wide">
                  {hasPackagingData ? "Data recorded" : "Awaiting data"}
                </span>
              </>
            )}
          </div>
          <StatusBadge
            status={resolveBadgeStatus(batch.packagingStatus)}
            label={formatStatusLabel(batch.packagingStatus)}
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {showFinishedQuantity && (
              <>
                <span className="font-semibold text-foreground">Finished qty</span>
                <span>{formatFinishedQuantity(batch.finishedQuantity ?? null)}</span>
                <span className="hidden sm:inline">·</span>
              </>
            )}
            <span className="font-semibold text-foreground">Packaging qty</span>
            <span>{formatVolumeByProduct(batch.totalSapOutput ?? null, batch.productType)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "flex-1 sm:flex-none",
              variant === "active" && "border-cta text-cta hover:bg-cta/10",
            )}
            onClick={() => {
              if (!packagingId) {
                toast.error("Packaging batch is missing an identifier.");
                return;
              }
              navigate(`/packaging/batch/${packagingId}`);
            }}
            disabled={!packagingId}
          >
            {variant === "completed" ? "View" : "Continue"}
          </Button>
          {variant === "active" && (
            <Button
              size="sm"
              className="bg-cta hover:bg-cta-hover text-cta-foreground flex-1 sm:flex-none"
              onClick={() => void handleSubmitPackagingBatch(batch)}
              disabled={submittingPackagingId === packagingId || !hasPackagingData || !packagingId}
            >
              {submittingPackagingId === packagingId ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                </span>
              ) : (
                "Submit"
              )}
            </Button>
          )}
          {variant === "active" && (
            <Button
              variant="destructive"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() =>
                setDeleteTarget({ packagingId, batchNumber: batch.batchNumber })
              }
              disabled={isDeletingPackaging && deleteTarget?.packagingId === packagingId}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
          {variant === "completed" && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => void handleReopenPackagingBatch(batch)}
              disabled={reopeningPackagingId === packagingId}
            >
              {reopeningPackagingId === packagingId ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Reopening…
                </span>
              ) : (
                "Reopen"
              )}
            </Button>
          )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} userAvatar={userAvatar} onLogout={handleLogout} />
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="space-y-6 sm:space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Packaging</h1>
              <p className="text-sm text-muted-foreground">
                Review completed processing batches and record packaging material usage.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                onClick={openCreatePackagingDialog}
                className="bg-cta hover:bg-cta-hover text-cta-foreground"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Packaging Batch
              </Button>
              <Button
                variant="secondary"
                onClick={handleOpenReportDialog}
                className="w-full sm:w-auto"
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate report
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <ProductTypeSelector
                value={productTypeFilter}
                onChange={setProductTypeFilter}
                metrics={packagingMetrics}
              />

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
                  variant="outline"
                  onClick={handleRefresh}
                  className="w-full sm:w-auto"
                  disabled={isLoading}
                >
                  <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  <span className="ml-2">Refresh</span>
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl bg-muted/40 px-3 py-3 text-xs sm:text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{selectedProductLabel} overview</span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-status-progress" /> Active: {selectedMetrics.active}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-status-completed" /> Completed: {selectedMetrics.completed}
              </span>
            </div>

            {isLoading && (
              <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                Loading packaging batches…
              </div>
            )}

            {error && !isLoading && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {!isLoading && !error && filteredByType.length === 0 && (
              <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
                No {selectedProductLabel.toLowerCase()} batches available for packaging.
              </div>
            )}

            {!isLoading && !error && filteredByType.length > 0 && (
              <div className="space-y-10">
                <section className="space-y-3">
                  <h2 className="text-lg sm:text-xl font-semibold">Packaging batches</h2>
                  {activePackagingBatches.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-muted/40 bg-muted/20 p-6 text-sm text-muted-foreground text-center">
                      No active {selectedProductLabel.toLowerCase()} batches.
                    </div>
                  ) : (
                    activePackagingBatches.map((batch) => renderPackagingCard(batch, "active"))
                  )}
                </section>

                <section className="space-y-3">
                  <h2 className="text-lg sm:text-xl font-semibold">Completed batches</h2>
                  {completedPackagingBatches.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-muted/40 bg-muted/20 p-6 text-sm text-muted-foreground text-center">
                      No completed {selectedProductLabel.toLowerCase()} batches yet.
                    </div>
                  ) : (
                    completedPackagingBatches.map((batch) => renderPackagingCard(batch, "completed"))
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      </main>

  <ReportGenerationDialog stage="packaging" open={reportDialogOpen} onOpenChange={setReportDialogOpen} />

      <Dialog
        open={createDialog.open}
        onOpenChange={(open) => {
          if (!open && !isCreatingPackagingBatch) {
            setCreateDialog({ open: false });
            setSelectedProcessingId(null);
          } else if (open) {
            setCreateDialog({ open: true });
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add packaging batch</DialogTitle>
            <DialogDescription>
              Choose a submitted processing batch to start capturing packaging data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex-1 space-y-2">
                <Label htmlFor="processingSearch">Search processing batches</Label>
                <Input
                  id="processingSearch"
                  placeholder="Search by batch, center, or quantity"
                  value={eligibleSearch}
                  onChange={(event) => setEligibleSearch(event.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="sm:w-auto"
                onClick={() => void fetchEligibleProcessingBatches(productTypeFilter)}
                disabled={isEligibleLoading}
              >
                <RefreshCcw className={cn("h-4 w-4", isEligibleLoading && "animate-spin")} />
                <span className="ml-2">Refresh</span>
              </Button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {isEligibleLoading ? (
                <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                  Loading processing batches…
                </div>
              ) : filteredEligibleProcessing.length === 0 ? (
                <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                  No completed processing batches are available for packaging right now.
                </div>
              ) : (
                filteredEligibleProcessing.map((batch) => {
                  const isSelected = selectedProcessingId === batch.processingBatchId;
                  return (
                    <button
                      key={batch.processingBatchId}
                      type="button"
                      onClick={() => setSelectedProcessingId(batch.processingBatchId)}
                      className={cn(
                        "w-full rounded-lg border p-4 text-left transition-colors",
                        isSelected
                          ? "border-cta bg-cta/10 text-foreground"
                          : "hover:border-cta hover:bg-muted"
                      )}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold">Batch {batch.batchNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            Scheduled {formatDate(batch.scheduledDate)} · {batch.bucketCount} bucket
                            {batch.bucketCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div className="text-sm text-muted-foreground sm:text-right">
                          <div>{batch.productType.toUpperCase()}</div>
                          <div>Collected: {batch.totalQuantity.toFixed(1)} kg</div>
                          {batch.totalSapOutput !== null && (
                            <div>Sap out: {batch.totalSapOutput.toFixed(1)} L</div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!isCreatingPackagingBatch) {
                  setCreateDialog({ open: false });
                  setSelectedProcessingId(null);
                }
              }}
              disabled={isCreatingPackagingBatch}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreatePackagingBatch()}
              disabled={isCreatingPackagingBatch || !selectedProcessingId}
              className="bg-cta hover:bg-cta-hover"
            >
              {isCreatingPackagingBatch ? "Creating…" : "Add packaging batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDeletingPackaging) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete packaging batch?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove packaging and any downstream labeling data linked to batch {deleteTarget?.batchNumber}.
              You can recreate it later from the list of completed processing batches.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingPackaging}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeletePackagingBatch()}
              disabled={isDeletingPackaging}
            >
              {isDeletingPackaging ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}





