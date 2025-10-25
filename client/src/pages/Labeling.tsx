import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { useAuth } from "@/lib/auth";
import DataService from "@/lib/dataService";
import type { EligiblePackagingBatchDto, LabelingBatchDto } from "@/lib/apiClient";
import { ReportGenerationDialog } from "@/components/ReportGenerationDialog";

const formatStatusLabel = (status: string) =>
  status
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export default function Labeling() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [batches, setBatches] = useState<LabelingBatchDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [productTypeFilter, setProductTypeFilter] = useState<"sap" | "treacle">("sap");
  const [isSavingLabeling, setIsSavingLabeling] = useState(false);
  const [labelingDialog, setLabelingDialog] = useState<{ open: boolean; batch: LabelingBatchDto | null }>(
    { open: false, batch: null }
  );
  const [labelingForm, setLabelingForm] = useState({
    stickerCost: "",
    shrinkSleeveCost: "",
    neckTagCost: "",
    corrugatedCartonCost: "",
  });
  const [autoOpenedFor, setAutoOpenedFor] = useState<string | null>(null);
  const [eligiblePackaging, setEligiblePackaging] = useState<EligiblePackagingBatchDto[]>([]);
  const [eligibleSearch, setEligibleSearch] = useState<string>("");
  const [isEligibleLoading, setIsEligibleLoading] = useState<boolean>(false);
  const [createDialog, setCreateDialog] = useState<{ open: boolean }>({ open: false });
  const [selectedPackagingId, setSelectedPackagingId] = useState<string | null>(null);
  const [isCreatingLabelingBatch, setIsCreatingLabelingBatch] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<{ packagingId: string; batchNumber: string } | null>(null);
  const [isDeletingLabeling, setIsDeletingLabeling] = useState<boolean>(false);
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

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const loadBatches = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const remote = await DataService.getLabelingBatches();
      setBatches(remote);
    } catch (err) {
      console.error("Failed to load labeling batches", err);
      setError("Unable to load labeling batches. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEligiblePackagingBatches = async (product: "sap" | "treacle") => {
    setIsEligibleLoading(true);
    try {
      const list = await DataService.getEligiblePackagingBatchesForLabeling(product);
      setEligiblePackaging(list);
    } catch (err) {
      console.error("Failed to load eligible packaging batches", err);
      toast.error("Unable to load packaging batches. Please try again.");
      setEligiblePackaging([]);
    } finally {
      setIsEligibleLoading(false);
    }
  };

  const openCreateLabelingDialog = () => {
    setCreateDialog({ open: true });
    setEligibleSearch("");
    setSelectedPackagingId(null);
  };

  const handleCreateLabelingBatch = async () => {
    if (!selectedPackagingId) {
      toast.error("Select a packaging batch first.");
      return;
    }
    setIsCreatingLabelingBatch(true);
    try {
      const created = await DataService.createLabelingBatch(selectedPackagingId);
      toast.success(`Labeling batch created for ${created.batchNumber}`);
      setCreateDialog({ open: false });
      await loadBatches();
    } catch (err) {
      console.error("Failed to create labeling batch", err);
      toast.error(err instanceof Error ? err.message : "Unable to create labeling batch");
    } finally {
      setIsCreatingLabelingBatch(false);
    }
  };

  const handleDeleteLabelingBatch = async () => {
    if (!deleteTarget) {
      return;
    }
    setIsDeletingLabeling(true);
    try {
      await DataService.deleteLabelingBatch(deleteTarget.packagingId);
      toast.success(`Labeling batch for ${deleteTarget.batchNumber} deleted`);
      setDeleteTarget(null);
      await loadBatches();
    } catch (err) {
      console.error("Failed to delete labeling batch", err);
      toast.error(err instanceof Error ? err.message : "Unable to delete labeling batch");
    } finally {
      setIsDeletingLabeling(false);
    }
  };

  useEffect(() => {
    void loadBatches();
  }, []);

  useEffect(() => {
    if (!isLoading && batches.length > 0) {
      const state = (location.state ?? {}) as { packagingId?: string; batchNumber?: string };
      if (state.packagingId && autoOpenedFor !== state.packagingId) {
        const match = batches.find((batch) => batch.packagingId === state.packagingId);
        if (match) {
          openLabelingDialogForBatch(match);
          setAutoOpenedFor(state.packagingId);
          if (state.batchNumber) {
            setSearchQuery(state.batchNumber);
          }
        }
      }
    }
  }, [isLoading, batches, location.state, autoOpenedFor]);

  useEffect(() => {
    if (createDialog.open) {
      void fetchEligiblePackagingBatches(productTypeFilter);
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

  const formatCurrencyValue = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return "—";
    }
    return `Rs ${Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatVolumeByProduct = (
    value: number | null | undefined,
    productType: LabelingBatchDto["productType"]
  ) => {
    if (value === null || value === undefined) {
      return "—";
    }
    const unit = (productType || "").toLowerCase() === "sap" ? "L" : "kg";
    return `${Number(value).toFixed(1)} ${unit}`;
  };

  const openLabelingDialogForBatch = (batch: LabelingBatchDto) => {
    setLabelingDialog({ open: true, batch });
    setLabelingForm({
      stickerCost:
        batch.stickerCost !== null && batch.stickerCost !== undefined ? String(batch.stickerCost) : "",
      shrinkSleeveCost:
        batch.shrinkSleeveCost !== null && batch.shrinkSleeveCost !== undefined
          ? String(batch.shrinkSleeveCost)
          : "",
      neckTagCost:
        batch.neckTagCost !== null && batch.neckTagCost !== undefined ? String(batch.neckTagCost) : "",
      corrugatedCartonCost:
        batch.corrugatedCartonCost !== null && batch.corrugatedCartonCost !== undefined
          ? String(batch.corrugatedCartonCost)
          : "",
    });
  };

  const closeLabelingDialog = () => {
    setLabelingDialog({ open: false, batch: null });
    setLabelingForm({ stickerCost: "", shrinkSleeveCost: "", neckTagCost: "", corrugatedCartonCost: "" });
  };

  const handleSaveLabelingData = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetBatch = labelingDialog.batch;
    if (!targetBatch) {
      return;
    }

    const productType = (targetBatch.productType || "").toLowerCase();
    const parseNumber = (value: string) => {
      const numeric = parseFloat(value);
      return Number.isNaN(numeric) ? NaN : numeric;
    };

    const stickerCost = parseNumber(labelingForm.stickerCost);
    const corrugatedCartonCost = parseNumber(labelingForm.corrugatedCartonCost);

    if (
      Number.isNaN(stickerCost) ||
      Number.isNaN(corrugatedCartonCost) ||
      stickerCost < 0 ||
      corrugatedCartonCost < 0
    ) {
      toast.error("Enter valid non-negative sticker and corrugated carton costs.");
      return;
    }

    const payload: {
      stickerCost?: number | null;
      shrinkSleeveCost?: number | null;
      neckTagCost?: number | null;
      corrugatedCartonCost?: number | null;
    } = {
      stickerCost,
      corrugatedCartonCost,
    };

    if (productType === "sap") {
      const shrinkSleeveCost = parseNumber(labelingForm.shrinkSleeveCost);
      const neckTagCost = parseNumber(labelingForm.neckTagCost);

      if (
        Number.isNaN(shrinkSleeveCost) ||
        Number.isNaN(neckTagCost) ||
        shrinkSleeveCost < 0 ||
        neckTagCost < 0
      ) {
        toast.error("Enter valid non-negative shrink sleeve and neck tag costs for sap labeling.");
        return;
      }

      payload.shrinkSleeveCost = shrinkSleeveCost;
      payload.neckTagCost = neckTagCost;
    } else if (productType === "treacle") {
      // For treacle, ignore shrink sleeve and neck tag inputs
      payload.shrinkSleeveCost = null;
      payload.neckTagCost = null;
    } else {
      toast.error("Unsupported product type for labeling data.");
      return;
    }

    setIsSavingLabeling(true);
    try {
      await DataService.updateLabelingBatch(targetBatch.packagingId, payload);
      toast.success(`Labeling data saved for batch ${targetBatch.batchNumber}`);
      closeLabelingDialog();
      await loadBatches();
    } catch (err) {
      console.error("Failed to save labeling data", err);
      toast.error("Unable to save labeling data. Please try again.");
    } finally {
      setIsSavingLabeling(false);
    }
  };

  const labelingMetrics = useMemo(() => {
    type Metrics = { total: number; completed: number; active: number };
    const metrics: Record<"sap" | "treacle", Metrics> = {
      sap: { total: 0, completed: 0, active: 0 },
      treacle: { total: 0, completed: 0, active: 0 },
    };

    batches.forEach((batch) => {
      const key = (batch.productType || "").toLowerCase();
      if (key !== "sap" && key !== "treacle") {
        return;
      }
      metrics[key].total += 1;

      const hasSticker = batch.stickerCost !== null && batch.stickerCost !== undefined;
      const hasCarton = batch.corrugatedCartonCost !== null && batch.corrugatedCartonCost !== undefined;
      const hasShrink = batch.shrinkSleeveCost !== null && batch.shrinkSleeveCost !== undefined;
      const hasNeck = batch.neckTagCost !== null && batch.neckTagCost !== undefined;
      const isCompleted =
        key === "sap" ? hasSticker && hasCarton && hasShrink && hasNeck : hasSticker && hasCarton;

      if (isCompleted) {
        metrics[key].completed += 1;
      } else {
        metrics[key].active += 1;
      }
    });

    return metrics;
  }, [batches]);

  const filteredEligiblePackaging = useMemo(() => {
    const term = eligibleSearch.trim().toLowerCase();
    if (!term) {
      return eligiblePackaging;
    }
    return eligiblePackaging.filter((batch) => {
      const composite = [
        batch.batchNumber,
        batch.productType,
        batch.scheduledDate ?? "",
        batch.finishedQuantity?.toString() ?? "",
        batch.totalQuantity.toString(),
      ]
        .join(" ")
        .toLowerCase();
      return composite.includes(term);
    });
  }, [eligiblePackaging, eligibleSearch]);

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
      formatDate(batch.scheduledDate),
      batch.stickerCost?.toString(),
      batch.corrugatedCartonCost?.toString(),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return composite.includes(term);
  });

  const selectedProductLabel = productTypeFilter === "sap" ? "Sap" : "Treacle";
  const selectedMetrics = labelingMetrics[productTypeFilter];

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} userAvatar={userAvatar} onLogout={handleLogout} />

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="space-y-6 sm:space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Labeling</h1>
              <p className="text-sm text-muted-foreground">
                Review packaged batches and capture labeling costs for sap and treacle production.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                onClick={openCreateLabelingDialog}
                className="bg-cta hover:bg-cta-hover text-cta-foreground"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Labeling Batch
              </Button>
              <Button
                variant="secondary"
                onClick={() => setReportDialogOpen(true)}
                className="w-full sm:w-auto"
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate report
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-1 bg-muted/60 rounded-full p-1 w-full sm:w-auto">
                {productTypeOptions.map((option) => {
                  const isActive = option.value === productTypeFilter;
                  const metrics = labelingMetrics[option.value];
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
                Loading labeling batches…
              </div>
            )}

            {error && !isLoading && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {!isLoading && !error && filteredBatches.length === 0 && (
              <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
                No {selectedProductLabel.toLowerCase()} batches available for labeling.
              </div>
            )}

            {!isLoading && !error &&
              filteredBatches.map((batch) => {
                const productType = (batch.productType || "").toLowerCase();
                const isSap = productType === "sap";
                const isTreacle = productType === "treacle";
                const hasSticker = batch.stickerCost !== null && batch.stickerCost !== undefined;
                const hasCarton = batch.corrugatedCartonCost !== null && batch.corrugatedCartonCost !== undefined;
                const hasShrink = batch.shrinkSleeveCost !== null && batch.shrinkSleeveCost !== undefined;
                const hasNeck = batch.neckTagCost !== null && batch.neckTagCost !== undefined;
                const costCompleted = isSap ? hasSticker && hasCarton && hasShrink && hasNeck : hasSticker && hasCarton;
                const rawStatus = batch.labelingStatus || "pending";
                const isCompleted = rawStatus === "completed" || costCompleted;
                const statusVariant = isCompleted ? "completed" : "in-progress";
                const statusLabel = isCompleted ? "Completed" : formatStatusLabel(rawStatus);

                return (
                  <div key={batch.packagingId} className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm">
                        <span className="font-medium">{formatDate(batch.scheduledDate)}</span>
                        <span className="hidden sm:inline text-muted-foreground">|</span>
                        <span>Batch: {batch.batchNumber}</span>
                        <span className="hidden sm:inline text-muted-foreground">|</span>
                        <span>
                          Finished Qty: {formatVolumeByProduct(batch.finishedQuantity ?? null, batch.productType)}
                        </span>
                      </div>
                      <StatusBadge status={statusVariant} label={statusLabel} />
                    </div>

                    {(isSap || isTreacle) && (
                      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
                        <div className="rounded-lg bg-muted/30 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sticker Cost</p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {formatCurrencyValue(batch.stickerCost ?? null)}
                          </p>
                        </div>
                        {isSap && (
                          <>
                            <div className="rounded-lg bg-muted/30 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Shrink Sleeve Cost</p>
                              <p className="mt-1 text-sm font-medium text-foreground">
                                {formatCurrencyValue(batch.shrinkSleeveCost ?? null)}
                              </p>
                            </div>
                            <div className="rounded-lg bg-muted/30 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Neck Tag Cost</p>
                              <p className="mt-1 text-sm font-medium text-foreground">
                                {formatCurrencyValue(batch.neckTagCost ?? null)}
                              </p>
                            </div>
                          </>
                        )}
                        <div className="rounded-lg bg-muted/30 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Corrugated Carton Cost</p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {formatCurrencyValue(batch.corrugatedCartonCost ?? null)}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/processing/batch/${batch.processingBatchId}`)}
                        className="flex-1 sm:flex-none"
                      >
                        View Processing Batch
                      </Button>
                      <Button
                        size="sm"
                        className="bg-cta hover:bg-cta-hover text-cta-foreground flex-1 sm:flex-none"
                        onClick={() => openLabelingDialogForBatch(batch)}
                      >
                        {isCompleted ? "Update Labeling Data" : "Enter Labeling Data"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1 sm:flex-none"
                        onClick={() => setDeleteTarget({ packagingId: batch.packagingId, batchNumber: batch.batchNumber })}
                        disabled={isDeletingLabeling && deleteTarget?.packagingId === batch.packagingId}
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </main>

  <ReportGenerationDialog stage="labeling" open={reportDialogOpen} onOpenChange={setReportDialogOpen} />

      <Dialog
        open={createDialog.open}
        onOpenChange={(open) => {
          if (!open && !isCreatingLabelingBatch) {
            setCreateDialog({ open: false });
            setSelectedPackagingId(null);
          } else if (open) {
            setCreateDialog({ open: true });
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add labeling batch</DialogTitle>
            <DialogDescription>
              Pick a packaging batch without labeling data to start tracking costs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex-1 space-y-2">
                <Label htmlFor="packagingSearch">Search packaging batches</Label>
                <Input
                  id="packagingSearch"
                  placeholder="Search by batch, status, or quantity"
                  value={eligibleSearch}
                  onChange={(event) => setEligibleSearch(event.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="sm:w-auto"
                onClick={() => void fetchEligiblePackagingBatches(productTypeFilter)}
                disabled={isEligibleLoading}
              >
                <RefreshCcw className={cn("h-4 w-4", isEligibleLoading && "animate-spin")} />
                <span className="ml-2">Refresh</span>
              </Button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {isEligibleLoading ? (
                <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                  Loading packaging batches…
                </div>
              ) : filteredEligiblePackaging.length === 0 ? (
                <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                  No packaging batches are waiting for labeling right now.
                </div>
              ) : (
                filteredEligiblePackaging.map((batch) => {
                  const isSelected = selectedPackagingId === batch.packagingId;
                  return (
                    <button
                      key={batch.packagingId}
                      type="button"
                      onClick={() => setSelectedPackagingId(batch.packagingId)}
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
                          <div>
                            Finished qty: {formatVolumeByProduct(batch.finishedQuantity, batch.productType as LabelingBatchDto["productType"])}
                          </div>
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
                if (!isCreatingLabelingBatch) {
                  setCreateDialog({ open: false });
                  setSelectedPackagingId(null);
                }
              }}
              disabled={isCreatingLabelingBatch}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreateLabelingBatch()}
              disabled={isCreatingLabelingBatch || !selectedPackagingId}
              className="bg-cta hover:bg-cta-hover"
            >
              {isCreatingLabelingBatch ? "Creating…" : "Add labeling batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDeletingLabeling) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete labeling batch?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes labeling data for batch {deleteTarget?.batchNumber}. You can recreate it from the packaging screen later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingLabeling}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteLabelingBatch()}
              disabled={isDeletingLabeling}
            >
              {isDeletingLabeling ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={labelingDialog.open}
        onOpenChange={(open) => {
          if (!open && !isSavingLabeling) {
            closeLabelingDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Labeling details</DialogTitle>
            <DialogDescription>
              {labelingDialog.batch
                ? `Record labeling costs for batch ${labelingDialog.batch.batchNumber}.`
                : "Record labeling costs for the batch."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveLabelingData} className="space-y-5">
            {labelingDialog.batch && (
              <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Finished quantity</span>
                  <span className="font-medium text-foreground">
                    {formatVolumeByProduct(
                      labelingDialog.batch.finishedQuantity ?? null,
                      labelingDialog.batch.productType
                    )}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="stickerCost">Sticker cost</Label>
              <Input
                id="stickerCost"
                type="number"
                min="0"
                step="0.01"
                value={labelingForm.stickerCost}
                onChange={(event) =>
                  setLabelingForm((prev) => ({ ...prev, stickerCost: event.target.value }))
                }
                required
              />
            </div>

            {labelingDialog.batch?.productType?.toLowerCase() === "sap" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="shrinkSleeveCost">Shrink sleeve cost</Label>
                  <Input
                    id="shrinkSleeveCost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={labelingForm.shrinkSleeveCost}
                    onChange={(event) =>
                      setLabelingForm((prev) => ({ ...prev, shrinkSleeveCost: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="neckTagCost">Neck tag cost</Label>
                  <Input
                    id="neckTagCost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={labelingForm.neckTagCost}
                    onChange={(event) =>
                      setLabelingForm((prev) => ({ ...prev, neckTagCost: event.target.value }))
                    }
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="corrugatedCartonCost">Corrugated carton cost</Label>
              <Input
                id="corrugatedCartonCost"
                type="number"
                min="0"
                step="0.01"
                value={labelingForm.corrugatedCartonCost}
                onChange={(event) =>
                  setLabelingForm((prev) => ({ ...prev, corrugatedCartonCost: event.target.value }))
                }
                required
              />
            </div>

            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeLabelingDialog}
                disabled={isSavingLabeling}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingLabeling} className="bg-cta hover:bg-cta-hover">
                {isSavingLabeling ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </span>
                ) : (
                  "Save labeling data"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}





