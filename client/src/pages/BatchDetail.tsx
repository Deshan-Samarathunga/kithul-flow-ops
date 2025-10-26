import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import DataService from "@/lib/dataService";
import type { ProcessingBatchDto, ProcessingBucketDto } from "@/lib/apiClient";
import { ChevronRight } from "lucide-react";

const MAX_BUCKET_SELECTION = 15;

export default function BatchDetail() {
  const navigate = useNavigate();
  const { batchId } = useParams();
  const { user, logout } = useAuth();
  const [batch, setBatch] = useState<ProcessingBatchDto | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [isBatchLoading, setIsBatchLoading] = useState<boolean>(true);
  const [availableBuckets, setAvailableBuckets] = useState<ProcessingBucketDto[]>([]);
  const [bucketError, setBucketError] = useState<string | null>(null);
  const [isBucketLoading, setIsBucketLoading] = useState<boolean>(true);
  const [selectedBuckets, setSelectedBuckets] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [bucketSearch, setBucketSearch] = useState<string>("");
  const [productionDialogOpen, setProductionDialogOpen] = useState(false);
  const [productionForm, setProductionForm] = useState({
    totalSapOutput: "",
    usedGasKg: "",
  });
  const [isSavingProduction, setIsSavingProduction] = useState(false);

  const isEditable = batch?.status !== "completed" && batch?.status !== "cancelled";

  const userRole = user?.role || "Guest";
  const userName = user?.name || user?.userId || "User";
  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL || "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }, []);
  const userAvatar = user?.profileImage ? new URL(user.profileImage, apiBase).toString() : undefined;

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const loadBatch = async (id: string) => {
    setIsBatchLoading(true);
    setBatchError(null);
    try {
      const remoteBatch = await DataService.getProcessingBatch(id);
      setBatch(remoteBatch);
      setSelectedBuckets((remoteBatch.bucketIds ?? []).slice(0, MAX_BUCKET_SELECTION));
    } catch (err: unknown) {
      console.error("Failed to load batch", err);
      setBatchError("Unable to load batch. Please try again later.");
    } finally {
      setIsBatchLoading(false);
    }
  };

  const loadBuckets = async (id: string) => {
    setIsBucketLoading(true);
    setBucketError(null);
    try {
      const buckets = await DataService.getProcessingBuckets("active", id);
      const normalized = buckets.map((bucket) => ({
        ...bucket,
        quantity: Number(bucket.quantity ?? 0),
        brixValue: bucket.brixValue !== null ? Number(bucket.brixValue) : null,
        phValue: bucket.phValue !== null ? Number(bucket.phValue) : null,
      }));
      setAvailableBuckets(normalized);
    } catch (err: unknown) {
      console.error("Failed to load buckets", err);
      setBucketError("Unable to load buckets. Please try again later.");
    } finally {
      setIsBucketLoading(false);
    }
  };

  useEffect(() => {
    if (!batchId) {
      return;
    }
    void loadBatch(batchId);
    void loadBuckets(batchId);
  }, [batchId]);

  useEffect(() => {
    if (availableBuckets.length === 0) {
      return;
    }
    setSelectedBuckets((prev) =>
      prev.filter((id) => availableBuckets.some((bucket) => bucket.id === id))
    );
  }, [availableBuckets]);

  useEffect(() => {
    if (!batch) {
  setProductionForm({ totalSapOutput: "", usedGasKg: "" });
      return;
    }

    setProductionForm({
      totalSapOutput:
        batch.totalSapOutput !== null && batch.totalSapOutput !== undefined
          ? String(batch.totalSapOutput)
          : "",
      usedGasKg:
        batch.gasUsedKg !== null && batch.gasUsedKg !== undefined ? String(batch.gasUsedKg) : "",
    });
  }, [batch]);

  const handleToggleBucket = (bucketId: string) => {
    if (!isEditable) {
      return;
    }
    setSelectedBuckets((prev) => {
      if (prev.includes(bucketId)) {
        return prev.filter((id) => id !== bucketId);
      }

      if (prev.length >= MAX_BUCKET_SELECTION) {
        toast.error(`You can select up to ${MAX_BUCKET_SELECTION} buckets per batch.`);
        return prev;
      }

      return [...prev, bucketId];
    });
  };

  const handleSaveBatch = async () => {
    if (!batchId || !isEditable) {
      return;
    }
    setIsSaving(true);
    try {
      const updated = await DataService.updateProcessingBatchBuckets(batchId, selectedBuckets);
      setBatch(updated);
      setSelectedBuckets((updated.bucketIds ?? []).slice(0, MAX_BUCKET_SELECTION));
      await loadBuckets(batchId);
      toast.success("Batch updated successfully");
    } catch (err: unknown) {
      console.error("Failed to save batch buckets", err);
      const message = err instanceof Error ? err.message : "Unable to save batch";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProduction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!batchId || !batch) {
      return;
    }

    const parsedOutput = parseFloat(productionForm.totalSapOutput);
  const parsedGas = parseFloat(productionForm.usedGasKg);

    if (
      Number.isNaN(parsedOutput) ||
      Number.isNaN(parsedGas) ||
      parsedOutput < 0 ||
      parsedGas < 0
    ) {
      toast.error("Please enter valid non-negative numbers for production fields.");
      return;
    }

    setIsSavingProduction(true);
    try {
      const updated = await DataService.updateProcessingBatch(batchId, {
        totalSapOutput: parsedOutput,
        gasUsedKg: parsedGas,
      });
      setBatch(updated);
      toast.success("Production data saved");
      setProductionDialogOpen(false);
    } catch (err: unknown) {
      console.error("Failed to save production data", err);
      const message = err instanceof Error ? err.message : "Unable to save production data.";
      toast.error(message);
    } finally {
      setIsSavingProduction(false);
    }
  };

  const formatNumber = (value: number | null | undefined, fractionDigits = 1) => {
    if (value === null || value === undefined) {
      return "—";
    }
    return Number(value).toFixed(fractionDigits);
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

  const formatOutputQuantity = (value: number | null | undefined) => {
    if (value === null || value === undefined || !batch) {
      return "Not recorded";
    }
    const unit = batch.productType === "sap" ? "L" : "kg";
    const digits = batch.productType === "sap" ? 1 : 2;
    return `${Number(value).toFixed(digits)} ${unit}`;
  };

  const formatGasAmount = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return "Not recorded";
    }
    return `${Number(value).toFixed(2)} kg`;
  };

  const formatBatchQuantity = (value: number | null | undefined) => {
    if (value === null || value === undefined || !batch) {
      return "—";
    }
    const unit = batch.productType === "sap" ? "L" : "kg";
    const digits = batch.productType === "sap" ? 1 : 2;
    return `${Number(value).toFixed(digits)} ${unit}`;
  };

  const sortedBuckets = useMemo(() => {
    const copy = [...availableBuckets];
    copy.sort((a, b) => {
      const createdA = a.createdAt ? Date.parse(a.createdAt) : 0;
      const createdB = b.createdAt ? Date.parse(b.createdAt) : 0;
      if (createdA !== createdB) {
        return createdA - createdB;
      }
      return a.id.localeCompare(b.id);
    });
    return copy;
  }, [availableBuckets]);

  const filteredBuckets = useMemo(() => {
    const term = bucketSearch.trim().toLowerCase();
    if (!term) {
      return sortedBuckets;
    }

    return sortedBuckets.filter((bucket) => {
      const values = [
        bucket.id,
        bucket.collectionCenter?.name,
        bucket.collectionCenter?.location,
        bucket.productType,
        bucket.draft?.id,
        bucket.draft?.status,
        bucket.draft?.date,
        bucket.quantity?.toString(),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return values.includes(term);
    });
  }, [bucketSearch, sortedBuckets]);

  const selectedBucketsSummary = useMemo(() => {
    return selectedBuckets.reduce(
      (acc, bucketId) => {
        const bucket = availableBuckets.find((item) => item.id === bucketId);
        if (!bucket) {
          return acc;
        }

        return {
          count: acc.count + 1,
          totalQuantity: acc.totalQuantity + (bucket.quantity ?? 0),
        };
      },
      { count: 0, totalQuantity: 0 }
    );
  }, [availableBuckets, selectedBuckets]);

  const selectionLimitReached = selectedBuckets.length >= MAX_BUCKET_SELECTION;
  const noBucketsAvailable = !isBucketLoading && !bucketError && sortedBuckets.length === 0;
  const noSearchMatches =
    !isBucketLoading && !bucketError && sortedBuckets.length > 0 && filteredBuckets.length === 0;

  const bucketsToRender = isEditable
    ? filteredBuckets
    : filteredBuckets
        .filter((bucket) => selectedBuckets.includes(bucket.id))
        .slice(0, MAX_BUCKET_SELECTION);
  const noSelectedBuckets = !isEditable && bucketsToRender.length === 0;

  const productionOutputLabel = batch?.productType === "sap" ? "Sap out after melting (L)" : "Output quantity (kg)";
  const productionOutputStep = batch?.productType === "sap" ? "0.1" : "0.01";

  if (!batchId) {
    return <div className="p-6">No batch selected.</div>;
  }

  const breadcrumbContent = batch ? (
    <div className="flex items-center space-x-2 text-sm text-white/90">
      <Link to="/processing" className="hover:text-white transition-colors">
        Processing
      </Link>
      <ChevronRight className="h-4 w-4 opacity-60" />
      <span className="font-semibold text-black">Batch {batch.batchNumber}</span>
    </div>
  ) : undefined;

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        userRole={userRole}
        userName={userName}
        userAvatar={userAvatar}
        onLogout={handleLogout}
        breadcrumb={breadcrumbContent}
      />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isBatchLoading ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading batch…</div>
        ) : batchError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
            {batchError}
          </div>
        ) : batch ? (
          <>
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold">Batch {batch.batchNumber}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Scheduled for {formatDate(batch.scheduledDate)} · Status {batch.status}
                </p>
              </div>
              {isEditable ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto sm:justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setProductionDialogOpen(true)}
                    className="w-full sm:w-auto"
                  >
                    {batch.totalSapOutput !== null && batch.totalSapOutput !== undefined
                      ? "Edit production data"
                      : "Add production data"}
                  </Button>
                  <Button
                    onClick={handleSaveBatch}
                    className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto"
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving…" : "Save Batch"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 w-full sm:w-auto text-sm text-muted-foreground sm:items-end">
                  <div className="text-center sm:text-right">
                    Submitted batches are read-only. Reopen the batch to make changes.
                  </div>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setProductionDialogOpen(true)}
                  >
                    View production data
                  </Button>
                </div>
              )}
            </div>

            <div className="mb-6 space-y-3">
              <h2 className="text-base sm:text-lg font-semibold">Production details</h2>
              <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground/80">Output quantity</p>
                    <p className="text-sm font-medium text-foreground">
                      {formatOutputQuantity(batch.totalSapOutput)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground/80">Used gas amount</p>
                    <p className="text-sm font-medium text-foreground">
                      {formatGasAmount(batch.gasUsedKg)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isEditable
                    ? "Select \"Add production data\" to record melting output and gas usage for this batch."
                    : "Reopen the batch if you need to update production data."}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-muted-foreground">
                Select buckets from field collection to add to this batch
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-base sm:text-lg font-semibold">
                {isEditable ? "Available Buckets" : "Selected Buckets"}
              </h2>

              <div className="max-w-sm">
                <Input
                  value={bucketSearch}
                  onChange={(event) => setBucketSearch(event.target.value)}
                  placeholder={
                    isEditable
                      ? "Search buckets by ID, center, product, or draft"
                      : "Search within selected buckets"
                  }
                />
              </div>

              {isBucketLoading && (
                <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                  Loading buckets…
                </div>
              )}

              {bucketError && !isBucketLoading && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                  {bucketError}
                </div>
              )}

              {noBucketsAvailable && (
                <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                  No active buckets available.
                </div>
              )}

              {noSearchMatches && isEditable && (
                <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                  No buckets match your search. Adjust the filters to see more buckets.
                </div>
              )}

              {noSelectedBuckets && (
                <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                  No buckets are selected for this submitted batch.
                </div>
              )}

              {!isBucketLoading && !bucketError &&
                bucketsToRender.map((bucket) => {
                  const isChecked = selectedBuckets.includes(bucket.id);
                  const disableSelection = !isEditable || (selectionLimitReached && !isChecked);

                  const info = (
                    <>
                      <div className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                        <span className="font-medium">
                          Collection Center: {bucket.collectionCenter.name}
                        </span>
                        <span className="hidden sm:inline text-muted-foreground">|</span>
                        <span>Quantity: {bucket.quantity} kg</span>
                        <span className="hidden sm:inline text-muted-foreground">|</span>
                        <span>Product: {bucket.productType}</span>
                        <span className="hidden sm:inline text-muted-foreground">|</span>
                        <span>Brix: {formatNumber(bucket.brixValue, 1)}</span>
                        <span className="hidden sm:inline text-muted-foreground">|</span>
                        <span>pH: {formatNumber(bucket.phValue, 2)}</span>
                        <span className="hidden sm:inline text-muted-foreground">|</span>
                        <span>Draft Date: {formatDate(bucket.draft.date)}</span>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Draft ID: {bucket.draft.id} | Created: {formatDate(bucket.createdAt)}
                      </div>
                    </>
                  );

                  return (
                    <div
                      key={bucket.id}
                      className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-4">
                        {isEditable ? (
                          <Checkbox
                            id={bucket.id}
                            checked={isChecked}
                            onCheckedChange={() => handleToggleBucket(bucket.id)}
                            className="mt-1"
                            disabled={disableSelection}
                          />
                        ) : (
                          <div className="mt-1 h-4 w-4" aria-hidden />
                        )}
                        {isEditable ? (
                          <label
                            htmlFor={bucket.id}
                            className={`flex-1 ${
                              disableSelection ? "pointer-events-none opacity-60" : "cursor-pointer"
                            }`}
                          >
                            {info}
                          </label>
                        ) : (
                          <div className="flex-1">{info}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="mt-8 space-y-4">
              {isEditable && selectionLimitReached && (
                <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground">
                  You have reached the {MAX_BUCKET_SELECTION}-bucket limit for this batch. Deselect one to pick
                  another.
                </div>
              )}

              {selectedBuckets.length > 0 && (
                <div className="rounded-lg bg-muted/50 p-4 sm:p-6">
                  <h3 className="font-semibold mb-2">Selected Buckets: {selectedBucketsSummary.count}</h3>
                  <p className="text-sm text-muted-foreground">
                    Total Quantity: {selectedBucketsSummary.totalQuantity.toFixed(1)} kg
                  </p>
                </div>
              )}
            </div>

            <Dialog
              open={productionDialogOpen}
              onOpenChange={(open) => {
                if (!open && !isSavingProduction) {
                  setProductionDialogOpen(open);
                }
              }}
            >
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Production data</DialogTitle>
                  <DialogDescription>
                    {isEditable
                      ? `Record melting output and gas usage for batch ${batch.batchNumber}.`
                      : `Production data for batch ${batch.batchNumber}. Reopen the batch to make changes.`}
                  </DialogDescription>
                </DialogHeader>
                {isEditable ? (
                  <form onSubmit={handleSaveProduction} className="space-y-5">
                    {batch.productType === "sap" && (
                      <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Sap in</span>
                          <span className="font-medium text-foreground">
                            {formatBatchQuantity(batch.totalQuantity)}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="production-output">{productionOutputLabel}</Label>
                      <Input
                        id="production-output"
                        type="number"
                        min="0"
                        step={productionOutputStep}
                        value={productionForm.totalSapOutput}
                        onChange={(event) =>
                          setProductionForm((prev) => ({
                            ...prev,
                            totalSapOutput: event.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="production-gas">Used gas amount</Label>
                      <Input
                        id="production-gas"
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
                    <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setProductionDialogOpen(false)}
                        disabled={isSavingProduction}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="bg-cta hover:bg-cta-hover text-cta-foreground"
                        disabled={isSavingProduction}
                      >
                        {isSavingProduction ? "Saving…" : "Save production data"}
                      </Button>
                    </DialogFooter>
                  </form>
                ) : (
                  <div className="space-y-4 text-sm">
                    <div className="grid gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground/80">Output quantity</p>
                        <p className="font-medium text-foreground">{formatOutputQuantity(batch.totalSapOutput)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground/80">Used gas amount</p>
                        <p className="font-medium text-foreground">{formatGasAmount(batch.gasUsedKg)}</p>
                      </div>
                    </div>
                    <DialogFooter className="flex justify-end">
                      <Button type="button" variant="outline" onClick={() => setProductionDialogOpen(false)}>
                        Close
                      </Button>
                    </DialogFooter>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Batch not found.</div>
        )}
      </div>
    </div>
  );
}
