import { FormEvent, useEffect, useMemo, useState } from "react";
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
import { useAuth } from "@/lib/auth";
import DataService from "@/lib/dataService";
import type { EligibleProcessingBatchDto, PackagingBatchDto } from "@/lib/apiClient";
import { ReportGenerationDialog } from "@/components/ReportGenerationDialog";

export default function Packaging() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [batches, setBatches] = useState<PackagingBatchDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSavingPackaging, setIsSavingPackaging] = useState(false);
  const [packagingDialog, setPackagingDialog] = useState<{ open: boolean; batch: PackagingBatchDto | null }>(
    { open: false, batch: null }
  );
  const [packagingForm, setPackagingForm] = useState({
    finishedQuantity: "",
    bottleCost: "",
    lidCost: "",
    alufoilCost: "",
    vacuumBagCost: "",
    parchmentPaperCost: "",
  });
  const [eligibleProcessing, setEligibleProcessing] = useState<EligibleProcessingBatchDto[]>([]);
  const [eligibleSearch, setEligibleSearch] = useState<string>("");
  const [isEligibleLoading, setIsEligibleLoading] = useState<boolean>(false);
  const [createDialog, setCreateDialog] = useState<{ open: boolean }>({ open: false });
  const [selectedProcessingId, setSelectedProcessingId] = useState<string | null>(null);
  const [isCreatingPackagingBatch, setIsCreatingPackagingBatch] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<{ packagingId: string; batchNumber: string } | null>(null);
  const [isDeletingPackaging, setIsDeletingPackaging] = useState<boolean>(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const userRole = user?.role || "Guest";
  const userName = user?.name || user?.userId || "User";
  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL || "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }, []);
  const userAvatar = user?.profileImage ? new URL(user.profileImage, apiBase).toString() : undefined;
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [productTypeFilter, setProductTypeFilter] = useState<"sap" | "treacle">("sap");
  const productTypeOptions: Array<{ value: "sap" | "treacle"; label: string }> = [
    { value: "sap", label: "Sap" },
    { value: "treacle", label: "Treacle" },
  ];

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

  useEffect(() => {
    void loadBatches();
  }, []);

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
    productType: PackagingBatchDto["productType"]
  ) => {
    if (value === null || value === undefined) {
      return "—";
    }
    const unit = (productType || "").toLowerCase() === "sap" ? "L" : "kg";
    return `${Number(value).toFixed(1)} ${unit}`;
  };

  const openPackagingDialogForBatch = (batch: PackagingBatchDto) => {
    setPackagingDialog({ open: true, batch });
    setPackagingForm({
      finishedQuantity:
        batch.finishedQuantity !== null && batch.finishedQuantity !== undefined
          ? String(batch.finishedQuantity)
          : "",
      bottleCost:
        batch.bottleCost !== null && batch.bottleCost !== undefined ? String(batch.bottleCost) : "",
      lidCost: batch.lidCost !== null && batch.lidCost !== undefined ? String(batch.lidCost) : "",
      alufoilCost:
        batch.alufoilCost !== null && batch.alufoilCost !== undefined ? String(batch.alufoilCost) : "",
      vacuumBagCost:
        batch.vacuumBagCost !== null && batch.vacuumBagCost !== undefined ? String(batch.vacuumBagCost) : "",
      parchmentPaperCost:
        batch.parchmentPaperCost !== null && batch.parchmentPaperCost !== undefined
          ? String(batch.parchmentPaperCost)
          : "",
    });
  };

  const closePackagingDialog = () => {
    setPackagingDialog({ open: false, batch: null });
    setPackagingForm({
      finishedQuantity: "",
      bottleCost: "",
      lidCost: "",
      alufoilCost: "",
      vacuumBagCost: "",
      parchmentPaperCost: "",
    });
  };

  const handleSavePackagingData = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetBatch = packagingDialog.batch;
    if (!targetBatch) {
      return;
    }

    const productType = (targetBatch.productType || "").toLowerCase();
    const payload: {
      finishedQuantity?: number | null;
      bottleCost?: number | null;
      lidCost?: number | null;
      alufoilCost?: number | null;
      vacuumBagCost?: number | null;
      parchmentPaperCost?: number | null;
    } = {};

    const parseNumber = (value: string) => {
      const numeric = parseFloat(value);
      return Number.isNaN(numeric) ? NaN : numeric;
    };

    const finishedQuantityValue = parseNumber(packagingForm.finishedQuantity);
    if (Number.isNaN(finishedQuantityValue) || finishedQuantityValue < 0) {
      toast.error("Enter a valid non-negative finished quantity.");
      return;
    }
    payload.finishedQuantity = finishedQuantityValue;

    const parseCost = parseNumber;

    if (productType === "sap") {
      const bottle = parseCost(packagingForm.bottleCost);
      const lid = parseCost(packagingForm.lidCost);
      if (Number.isNaN(bottle) || Number.isNaN(lid) || bottle < 0 || lid < 0) {
        toast.error("Enter valid non-negative values for bottle and lid costs.");
        return;
      }
      payload.bottleCost = bottle;
      payload.lidCost = lid;
    } else if (productType === "treacle") {
      const alufoil = parseCost(packagingForm.alufoilCost);
      const vacuum = parseCost(packagingForm.vacuumBagCost);
      const parchment = parseCost(packagingForm.parchmentPaperCost);
      if (
        Number.isNaN(alufoil) ||
        Number.isNaN(vacuum) ||
        Number.isNaN(parchment) ||
        alufoil < 0 ||
        vacuum < 0 ||
        parchment < 0
      ) {
        toast.error("Enter valid non-negative values for treacle packaging costs.");
        return;
      }
      payload.alufoilCost = alufoil;
      payload.vacuumBagCost = vacuum;
      payload.parchmentPaperCost = parchment;
    } else {
      toast.error("Unsupported product type for packaging data.");
      return;
    }

    setIsSavingPackaging(true);
    try {
      await DataService.updatePackagingBatch(targetBatch.packagingId, payload);
      toast.success(`Packaging data saved for batch ${targetBatch.batchNumber}`);
      closePackagingDialog();
      navigate("/labeling", {
        state: { packagingId: targetBatch.packagingId, batchNumber: targetBatch.batchNumber },
      });
    } catch (err) {
      console.error("Failed to save packaging data", err);
      toast.error("Unable to save packaging data. Please try again.");
    } finally {
      setIsSavingPackaging(false);
    }
  };

  const activePackagingType = (packagingDialog.batch?.productType || "").toLowerCase();
  const isSapDialog = activePackagingType === "sap";
  const isTreacleDialog = activePackagingType === "treacle";
  const dialogTitle =
    packagingDialog.batch?.productType === "sap"
      ? "Sap Packaging"
      : packagingDialog.batch?.productType === "treacle"
      ? "Treacle Packaging"
      : "Packaging Details";
  const finishedQuantityStep = activePackagingType === "sap" ? "0.1" : "0.01";

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} userAvatar={userAvatar} onLogout={handleLogout} />
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="space-y-6 sm:space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Packaging</h1>
              <p className="text-sm text-muted-foreground">
                Review completed processing batches and record packaging costs.
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
                  const optionMetrics = packagingMetrics[option.value];
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
                        {optionMetrics.total}
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

            {!isLoading && !error &&
              filteredByType.map((batch) => {
                const productType = (batch.productType || "").toLowerCase();
                const isSap = productType === "sap";
                const isTreacle = productType === "treacle";
                const hasFinishedQuantity =
                  batch.finishedQuantity !== null && batch.finishedQuantity !== undefined;
                const hasPackagingData = isSap
                  ? hasFinishedQuantity &&
                    batch.bottleCost !== null &&
                    batch.bottleCost !== undefined &&
                    batch.lidCost !== null &&
                    batch.lidCost !== undefined
                  : isTreacle
                  ? hasFinishedQuantity &&
                    batch.alufoilCost !== null &&
                    batch.alufoilCost !== undefined &&
                    batch.vacuumBagCost !== null &&
                    batch.vacuumBagCost !== undefined &&
                    batch.parchmentPaperCost !== null &&
                    batch.parchmentPaperCost !== undefined
                  : false;

                return (
                  <div key={batch.id} className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm">
                        <span className="font-medium">{formatDate(batch.startedAt ?? batch.scheduledDate)}</span>
                        <span className="hidden sm:inline text-muted-foreground">|</span>
                        <span>Batch: {batch.batchNumber}</span>
                        <span className="hidden sm:inline text-muted-foreground">|</span>
                        <span>Production Qty: {formatVolumeByProduct(batch.totalSapOutput ?? null, batch.productType)}</span>
                        <span className="hidden sm:inline text-muted-foreground">|</span>
                        <span>Finished Qty: {formatVolumeByProduct(batch.finishedQuantity ?? null, batch.productType)}</span>
                      </div>
                      <StatusBadge
                        status={resolveBadgeStatus(batch.packagingStatus)}
                        label={formatStatusLabel(batch.packagingStatus)}
                      />
                    </div>

                    {(isSap || isTreacle) && (
                      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
                        <div className="rounded-lg bg-muted/30 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Finished Quantity</p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {formatVolumeByProduct(batch.finishedQuantity ?? null, batch.productType)}
                          </p>
                        </div>
                        {isSap ? (
                          <>
                            <div className="rounded-lg bg-muted/30 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Bottle Cost</p>
                              <p className="mt-1 text-sm font-medium text-foreground">{formatCurrencyValue(batch.bottleCost ?? null)}</p>
                            </div>
                            <div className="rounded-lg bg-muted/30 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Lid Cost</p>
                              <p className="mt-1 text-sm font-medium text-foreground">{formatCurrencyValue(batch.lidCost ?? null)}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="rounded-lg bg-muted/30 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Alufoil Cost</p>
                              <p className="mt-1 text-sm font-medium text-foreground">{formatCurrencyValue(batch.alufoilCost ?? null)}</p>
                            </div>
                            <div className="rounded-lg bg-muted/30 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Vacuum Bag Cost</p>
                              <p className="mt-1 text-sm font-medium text-foreground">{formatCurrencyValue(batch.vacuumBagCost ?? null)}</p>
                            </div>
                            <div className="rounded-lg bg-muted/30 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Parchment Paper Cost</p>
                              <p className="mt-1 text-sm font-medium text-foreground">{formatCurrencyValue(batch.parchmentPaperCost ?? null)}</p>
                            </div>
                          </>
                        )}
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
                      {(isSap || isTreacle) && (
                        <Button
                          size="sm"
                          className="bg-cta hover:bg-cta-hover text-cta-foreground flex-1 sm:flex-none"
                          onClick={() => openPackagingDialogForBatch(batch)}
                        >
                          {hasPackagingData ? "Update Packaging Data" : "Enter Packaging Data"}
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1 sm:flex-none"
                        onClick={() => setDeleteTarget({ packagingId: batch.packagingId, batchNumber: batch.batchNumber })}
                        disabled={isDeletingPackaging && deleteTarget?.packagingId === batch.packagingId}
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

      <Dialog
        open={packagingDialog.open}
        onOpenChange={(open) => {
          if (!open && !isSavingPackaging) {
            closePackagingDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {packagingDialog.batch
                ? `Capture packaging costs for batch ${packagingDialog.batch.batchNumber}.`
                : "Capture packaging costs for this batch."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSavePackagingData} className="space-y-5">
            {packagingDialog.batch && (
              <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Production quantity</span>
                  <span className="font-medium text-foreground">
                    {formatVolumeByProduct(packagingDialog.batch.totalSapOutput, packagingDialog.batch.productType)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-muted-foreground">
                  <span>Current finished quantity</span>
                  <span className="font-medium text-foreground">
                    {formatVolumeByProduct(packagingDialog.batch.finishedQuantity ?? null, packagingDialog.batch.productType)}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="finishedQuantity">Finished quantity</Label>
              <Input
                id="finishedQuantity"
                type="number"
                min="0"
                step={finishedQuantityStep}
                value={packagingForm.finishedQuantity}
                onChange={(event) =>
                  setPackagingForm((prev) => ({ ...prev, finishedQuantity: event.target.value }))
                }
                required
              />
            </div>

            {isSapDialog && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bottleCost">Bottle cost</Label>
                  <Input
                    id="bottleCost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={packagingForm.bottleCost}
                    onChange={(event) =>
                      setPackagingForm((prev) => ({ ...prev, bottleCost: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lidCost">Lid cost</Label>
                  <Input
                    id="lidCost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={packagingForm.lidCost}
                    onChange={(event) =>
                      setPackagingForm((prev) => ({ ...prev, lidCost: event.target.value }))
                    }
                    required
                  />
                </div>
              </div>
            )}

            {isTreacleDialog && (
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="alufoilCost">Alufoil cost</Label>
                  <Input
                    id="alufoilCost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={packagingForm.alufoilCost}
                    onChange={(event) =>
                      setPackagingForm((prev) => ({ ...prev, alufoilCost: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vacuumBagCost">Vacuum bag cost</Label>
                  <Input
                    id="vacuumBagCost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={packagingForm.vacuumBagCost}
                    onChange={(event) =>
                      setPackagingForm((prev) => ({ ...prev, vacuumBagCost: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parchmentPaperCost">Parchment paper cost</Label>
                  <Input
                    id="parchmentPaperCost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={packagingForm.parchmentPaperCost}
                    onChange={(event) =>
                      setPackagingForm((prev) => ({ ...prev, parchmentPaperCost: event.target.value }))
                    }
                    required
                  />
                </div>
              </div>
            )}

            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closePackagingDialog}
                disabled={isSavingPackaging}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingPackaging} className="bg-cta hover:bg-cta-hover">
                {isSavingPackaging ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </span>
                ) : (
                  "Save packaging data"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}





