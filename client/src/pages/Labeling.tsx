import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar.lazy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { FileText, Loader2, RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import DataService from "@/lib/dataService";
import type { EligiblePackagingBatchDto, LabelingBatchDto } from "@/lib/apiClient";
import { ReportGenerationDialog } from "@/components/ReportGenerationDialog.lazy";
import { usePersistentState } from "@/hooks/usePersistentState";
import { BatchSearchBar } from "@/components/BatchSearchBar";
import { BatchOverview } from "@/components/BatchOverview";
import { ProductTypeTabs } from "@/components/ProductTypeTabs";
import { PageContainer } from "@/components/layout/PageContainer";
import { ResponsiveToolbar } from "@/components/layout/ResponsiveToolbar";

const formatStatusLabel = (status: string) =>
  status
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const formatVolumeByProduct = (
  value: number | null | undefined,
  productType: LabelingBatchDto["productType"],
) => {
  if (value === null || value === undefined) {
    return "—";
  }
  const unit = (productType || "").toLowerCase() === "treacle" ? "L" : "kg";
  return `${Number(value).toFixed(1)} ${unit}`;
};

// Labeling workflow dashboard for active and completed packaging batches.
export default function Labeling() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [batches, setBatches] = useState<LabelingBatchDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = usePersistentState<string>("labeling.search", "");
  const [productTypeFilter, setProductTypeFilter] = useState<"treacle" | "jaggery">(() => {
    const saved =
      typeof window !== "undefined" ? window.localStorage.getItem("labeling.productType") : null;
    return saved === "jaggery" || saved === "treacle" ? saved : "treacle";
  });
  const [deleteTarget, setDeleteTarget] = useState<{
    packagingId: string;
    batchNumber: string;
  } | null>(null);
  const [isDeletingLabeling, setIsDeletingLabeling] = useState<boolean>(false);
  const [submittingLabelingId, setSubmittingLabelingId] = useState<string | null>(null);
  const [reopeningLabelingId, setReopeningLabelingId] = useState<string | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = usePersistentState<boolean>(
    "labeling.reportDialogOpen",
    false,
  );
  const [createDialog, setCreateDialog] = usePersistentState<{ open: boolean }>(
    "labeling.createDialogOpen",
    { open: false },
  );
  const [eligiblePackaging, setEligiblePackaging] = useState<EligiblePackagingBatchDto[]>([]);
  const [eligibleSearch, setEligibleSearch] = useState("");
  const [isEligibleLoading, setIsEligibleLoading] = useState(false);
  const [selectedPackagingId, setSelectedPackagingId] = useState<string | null>(null);
  const [isCreatingLabelingBatch, setIsCreatingLabelingBatch] = useState(false);

  const userRole = user?.role || "Guest";
  const userName = user?.name || user?.userId || "User";
  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL || "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }, []);
  const userAvatar = user?.profileImage
    ? new URL(user.profileImage, apiBase).toString()
    : undefined;

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
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("labeling.productType", productTypeFilter);
      }
    } catch {
      // ignore storage errors
    }
  }, [productTypeFilter]);

  useEffect(() => {
    const state = (location.state ?? {}) as { packagingId?: string; batchNumber?: string };
    if (state.packagingId) {
      navigate(`/labeling/batch/${state.packagingId}`, { replace: true, state: undefined });
      return;
    }

    if (state.batchNumber) {
      setSearchQuery(state.batchNumber);
    }
  }, [location.state, navigate, setSearchQuery]);

  const openCreateLabelingDialog = () => {
    setCreateDialog({ open: true });
    setEligibleSearch("");
    setSelectedPackagingId(null);
  };

  useEffect(() => {
    if (createDialog.open) {
      void fetchEligiblePackagingBatches(productTypeFilter);
    }
  }, [createDialog.open, productTypeFilter]);

  const handleRefresh = () => {
    void loadBatches();
  };

  const fetchEligiblePackagingBatches = async (product: "treacle" | "jaggery") => {
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

  const buildLabelingUpdatePayload = (batch: LabelingBatchDto) => {
    const productType = (batch.productType || "").toLowerCase();
    const isTreacle = productType === "treacle";

    // All labeling batches require sticker and corrugated carton
    if (
      batch.stickerQuantity === null ||
      batch.stickerQuantity === undefined ||
      batch.corrugatedCartonQuantity === null ||
      batch.corrugatedCartonQuantity === undefined
    ) {
      return null;
    }

    const payload: {
      stickerQuantity: number;
      corrugatedCartonQuantity: number;
      shrinkSleeveQuantity?: number | null;
      neckTagQuantity?: number | null;
    } = {
      stickerQuantity: Number(batch.stickerQuantity),
      corrugatedCartonQuantity: Number(batch.corrugatedCartonQuantity),
    };

    if (isTreacle) {
      // Treacle (in-house) requires shrink sleeve and neck tag
      if (
        batch.shrinkSleeveQuantity === null ||
        batch.shrinkSleeveQuantity === undefined ||
        batch.neckTagQuantity === null ||
        batch.neckTagQuantity === undefined
      ) {
        return null;
      }
      payload.shrinkSleeveQuantity = Number(batch.shrinkSleeveQuantity);
      payload.neckTagQuantity = Number(batch.neckTagQuantity);
    } else {
      // Treacle sets these to null
      payload.shrinkSleeveQuantity = null;
      payload.neckTagQuantity = null;
    }

    return payload;
  };

  const handleSubmitLabelingBatch = async (batch: LabelingBatchDto) => {
    const packagingId = batch.packagingId;
    if (!packagingId) {
      toast.error("Unable to submit labeling batch.");
      return;
    }

    const payload = buildLabelingUpdatePayload(batch);
    if (!payload) {
      toast.error("Enter all required accessory quantities before submitting.");
      return;
    }

    setSubmittingLabelingId(packagingId);
    try {
      await DataService.updateLabelingBatch(packagingId, {
        ...payload,
        status: "completed",
      });
      toast.success(`Labeling batch ${batch.batchNumber} submitted`);
      await loadBatches();
    } catch (err) {
      console.error("Failed to submit labeling batch", err);
      toast.error("Unable to submit labeling batch. Please try again.");
    } finally {
      setSubmittingLabelingId(null);
    }
  };

  const handleReopenLabelingBatch = async (batch: LabelingBatchDto) => {
    const packagingId = batch.packagingId;
    if (!packagingId) {
      toast.error("Unable to reopen labeling batch.");
      return;
    }

    const payload = buildLabelingUpdatePayload(batch);
    if (!payload) {
      toast.error("Labeling batch is missing required quantities and cannot be reopened.");
      return;
    }

    setReopeningLabelingId(packagingId);
    try {
      await DataService.updateLabelingBatch(packagingId, {
        ...payload,
        status: "in-progress",
      });
      toast.success(`Labeling batch ${batch.batchNumber} reopened`);
      await loadBatches();
    } catch (err) {
      console.error("Failed to reopen labeling batch", err);
      toast.error("Unable to reopen labeling batch. Please try again.");
    } finally {
      setReopeningLabelingId(null);
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
      batch.stickerQuantity?.toString(),
      batch.corrugatedCartonQuantity?.toString(),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return composite.includes(term);
  });

  const normalizeLabelingStatus = (status: string | null | undefined) => {
    return String(status ?? "")
      .trim()
      .toLowerCase();
  };

  const isLabelingBatchComplete = (batch: LabelingBatchDto) => {
    const normalizedStatus = normalizeLabelingStatus(batch.labelingStatus);
    return normalizedStatus === "completed";
  };

  const activeLabelingBatches = filteredBatches.filter((batch) => !isLabelingBatchComplete(batch));
  const completedLabelingBatches = filteredBatches.filter((batch) =>
    isLabelingBatchComplete(batch),
  );

  const labelingMetrics = useMemo(() => {
    type Metrics = { total: number; completed: number; active: number };
    const metrics: Record<"treacle" | "jaggery", Metrics> = {
      treacle: { total: 0, completed: 0, active: 0 },
      jaggery: { total: 0, completed: 0, active: 0 },
    };

    batches.forEach((batch) => {
      const key = (batch.productType || "").toLowerCase();
      if (key !== "treacle" && key !== "jaggery") {
        return;
      }
      metrics[key].total += 1;

      const status = normalizeLabelingStatus(batch.labelingStatus);
      if (status === "completed") {
        metrics[key].completed += 1;
      } else {
        metrics[key].active += 1;
      }
    });

    return metrics;
  }, [batches]);

  const selectedProductLabel = productTypeFilter === "treacle" ? "Treacle" : "Jaggery";
  const selectedMetrics = labelingMetrics[productTypeFilter];

  const hasCompletedLabeling = useMemo(
    () => (labelingMetrics.treacle.completed ?? 0) + (labelingMetrics.jaggery.completed ?? 0) > 0,
    [labelingMetrics],
  );

  const renderLabelingCard = (batch: LabelingBatchDto, variant: "active" | "completed") => {
    const packagingId = batch.packagingId ?? undefined;
    const cardKey = packagingId ?? batch.processingBatchId ?? batch.batchNumber;
    const isCompleted = isLabelingBatchComplete(batch);
    const submitting = submittingLabelingId === batch.packagingId;
    const reopening = reopeningLabelingId === batch.packagingId;

    return (
      <div
        key={cardKey}
        className={cn(
          "rounded-2xl border bg-card p-4 sm:p-6 shadow-sm transition-shadow hover:shadow-md",
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm">
            <span>
              Batch ID: <span className="font-semibold text-foreground">{batch.batchNumber}</span>
            </span>
            <span className="px-2 text-muted-foreground/40">|</span>
            <span className="font-medium">{formatDate(batch.scheduledDate)}</span>
            <span className="px-2 text-muted-foreground/40">|</span>
            <span>
              Finished Qty:{" "}
              {formatVolumeByProduct(batch.finishedQuantity ?? null, batch.productType)}
            </span>
            <span className="px-2 text-muted-foreground/40">|</span>
            <span>Cans: {batch.canCount}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => packagingId && navigate(`/labeling/batch/${packagingId}`)}
              disabled={!packagingId}
              className="flex-1 sm:flex-none"
            >
              {variant === "completed" ? "View" : "Continue"}
            </Button>
            {variant === "active" && (
              <Button
                size="sm"
                className="bg-cta hover:bg-cta-hover text-cta-foreground flex-1 sm:flex-none"
                onClick={() => handleSubmitLabelingBatch(batch)}
                disabled={isCompleted || submitting || !packagingId}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            )}
            {variant === "active" && (
              <Button
                variant="destructive"
                size="sm"
                className="sm:flex-none"
                onClick={() =>
                  packagingId && setDeleteTarget({ packagingId, batchNumber: batch.batchNumber })
                }
                disabled={
                  !packagingId || (isDeletingLabeling && deleteTarget?.packagingId === packagingId)
                }
                aria-label={`Delete batch ${batch.batchNumber}`}
                title={`Delete batch ${batch.batchNumber}`}
              >
                <span className="inline-flex items-center gap-1">
                  <Trash2 className="h-4 w-4" /> Delete
                </span>
              </Button>
            )}
            {variant === "completed" && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => handleReopenLabelingBatch(batch)}
                disabled={!packagingId || reopening}
              >
                {reopening ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reopening…
                  </>
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

  const handleOpenReportDialog = () => {
    if (!hasCompletedLabeling) {
      toast.error("Complete at least one labeling batch before generating a report.");
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

      <PageContainer as="main" className="py-6 sm:py-10">
        <div className="space-y-6 sm:space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Labeling</h1>
            <p className="text-sm text-muted-foreground">
              Review packaged batches and capture labeling accessory quantities for treacle
              (in-house) and jaggery production.
            </p>
          </div>

          <div className="rounded-2xl border bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 p-4 sm:p-6">
            <ResponsiveToolbar stackAt="lg">
              <ResponsiveToolbar.Leading>
                <ProductTypeTabs value={productTypeFilter} onChange={setProductTypeFilter} />
              </ResponsiveToolbar.Leading>

              <ResponsiveToolbar.Content>
                <BatchSearchBar value={searchQuery} onChange={setSearchQuery} />
              </ResponsiveToolbar.Content>

              <ResponsiveToolbar.Actions className="gap-3">
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
                  className="w-full sm:w-auto"
                  disabled={isLoading}
                >
                  <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  <span className="ml-2">Refresh</span>
                </Button>
                <Button
                  onClick={openCreateLabelingDialog}
                  className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto"
                >
                  {isCreatingLabelingBatch ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <span className="font-medium">Add New</span>
                  )}
                </Button>
              </ResponsiveToolbar.Actions>
            </ResponsiveToolbar>

            <BatchOverview
              label={selectedProductLabel}
              active={selectedMetrics.active}
              completed={selectedMetrics.completed}
            />
          </div>

          {isLoading && (
            <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
              Loading labeling batches…
            </div>
          )}

          {error && !isLoading && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive shadow-sm">
              {error}
            </div>
          )}

          {!isLoading && !error && batches.length === 0 && (
            <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
              No batches yet. Create a new batch to get started.
            </div>
          )}

          {!isLoading && !error && batches.length > 0 && (
            <div className="space-y-10">
              <section className="space-y-3">
                <h2 className="text-lg sm:text-xl font-semibold">Labeling batches</h2>
                {activeLabelingBatches.length === 0 ? (
                  <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
                    No active batches right now.
                  </div>
                ) : (
                  activeLabelingBatches.map((batch) => renderLabelingCard(batch, "active"))
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-lg sm:text-xl font-semibold">Completed batches</h2>
                {completedLabelingBatches.length === 0 ? (
                  <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
                    No completed batches yet.
                  </div>
                ) : (
                  completedLabelingBatches.map((batch) => renderLabelingCard(batch, "completed"))
                )}
              </section>
            </div>
          )}
        </div>
  </PageContainer>

      {reportDialogOpen ? (
        <ReportGenerationDialog
          stage="labeling"
          open={reportDialogOpen}
          onOpenChange={setReportDialogOpen}
        />
      ) : null}

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
            <DialogTitle>Add New</DialogTitle>
            <DialogDescription>
              Choose a submitted packaging batch to start capturing labeling accessory usage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex-1 space-y-2">
                <Label htmlFor="packagingSearch">Search packaging batches</Label>
                <Input
                  id="packagingSearch"
                  placeholder="Search by batch, center, or quantity"
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
                <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                  Loading packaging batches…
                </div>
              ) : filteredEligiblePackaging.length === 0 ? (
                <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                  No completed packaging batches are available for labeling right now.
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
                        "w-full rounded-full border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        isSelected
                          ? "border-cta bg-cta/10 text-foreground"
                          : "hover:border-cta hover:bg-muted",
                      )}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold">Batch ID: {batch.batchNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            Scheduled {formatDate(batch.scheduledDate)} · {batch.canCount} can
                            {batch.canCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div className="text-sm text-muted-foreground sm:text-right">
                          <div>{(batch.productType ?? "").toUpperCase() || "—"}</div>
                          <div>
                            Finished Qty:{" "}
                            {typeof batch.finishedQuantity === "number"
                              ? batch.finishedQuantity.toFixed(1)
                              : "—"}{" "}
                            {batch.productType?.toLowerCase() === "treacle" ? "L" : "kg"}
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
              {isCreatingLabelingBatch ? "Creating…" : "Add New"}
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
            <AlertDialogTitle>Delete Labeling Batch?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes labeling data for batch {deleteTarget?.batchNumber}. You can recreate it
              from the packaging screen later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingLabeling}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteLabelingBatch()}
              disabled={isDeletingLabeling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingLabeling ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
