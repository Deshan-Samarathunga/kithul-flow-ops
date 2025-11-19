import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar.lazy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { toast } from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import DataService from "@/lib/dataService";
import type { ProcessingBatchDto, ProcessingCanDto } from "@/lib/apiClient";
import { ChevronRight, Loader2 } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";

const MAX_CAN_SELECTION = 15;

// Processing batch detail page for assigning cans and recording outputs.
export default function BatchDetail() {
  const navigate = useNavigate();
  const { batchId } = useParams();
  const { user, logout } = useAuth();
  const [batch, setBatch] = useState<ProcessingBatchDto | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [isBatchLoading, setIsBatchLoading] = useState<boolean>(true);
  const [availableCans, setAvailableCans] = useState<ProcessingCanDto[]>([]);
  const [canError, setCanError] = useState<string | null>(null);
  const [isCanLoading, setIsCanLoading] = useState<boolean>(true);
  const [selectedCans, setSelectedCans] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [canSearch, setCanSearch] = useState<string>("");
  const [productionDialogOpen, setProductionDialogOpen] = useState(false);
  const [productionForm, setProductionForm] = useState({
    totalSapOutput: "",
    usedGasKg: "",
  });
  const [isSavingProduction, setIsSavingProduction] = useState(false);
  const [isReopening, setIsReopening] = useState(false);

  const isEditable = batch?.status !== "completed" && batch?.status !== "cancelled";
  const isCompleted = batch?.status === "completed";

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

  const loadBatch = async (id: string) => {
    setIsBatchLoading(true);
    setBatchError(null);
    try {
      const remoteBatch = await DataService.getProcessingBatch(id);
      setBatch(remoteBatch);
      setSelectedCans((remoteBatch.canIds ?? []).slice(0, MAX_CAN_SELECTION));
    } catch (err: unknown) {
      console.error("Failed to load batch", err);
      setBatchError("Unable to load batch. Please try again later.");
    } finally {
      setIsBatchLoading(false);
    }
  };

  const loadCans = async (id: string) => {
    setIsCanLoading(true);
    setCanError(null);
    try {
      const cans = await DataService.getProcessingCans("active", id);
      const normalized = cans.map((can) => ({
        ...can,
        quantity: Number(can.quantity ?? 0),
        brixValue: can.brixValue !== null ? Number(can.brixValue) : null,
        phValue: can.phValue !== null ? Number(can.phValue) : null,
      }));
      setAvailableCans(normalized);
    } catch (err: unknown) {
      console.error("Failed to load cans", err);
      setCanError("Unable to load cans. Please try again later.");
    } finally {
      setIsCanLoading(false);
    }
  };

  useEffect(() => {
    if (!batchId) {
      return;
    }
    void loadBatch(batchId);
    void loadCans(batchId);
  }, [batchId]);

  useEffect(() => {
    if (availableCans.length === 0) {
      return;
    }
    setSelectedCans((prev) => prev.filter((id) => availableCans.some((can) => can.id === id)));
  }, [availableCans]);

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

  const handleToggleCan = (canId: string) => {
    if (!isEditable) {
      return;
    }
    setSelectedCans((prev) => {
      if (prev.includes(canId)) {
        return prev.filter((id) => id !== canId);
      }

      if (prev.length >= MAX_CAN_SELECTION) {
        toast.error(`You can select up to ${MAX_CAN_SELECTION} cans per batch.`);
        return prev;
      }

      return [...prev, canId];
    });
  };

  const handleReopenBatch = async () => {
    if (!batchId) {
      toast.error("Missing batch identifier.");
      return;
    }

    setIsReopening(true);
    try {
      await DataService.reopenProcessingBatch(batchId);
      toast.success("Processing batch reopened");
      navigate("/processing");
    } catch (err) {
      console.error("Failed to reopen processing batch", err);
      toast.error("Unable to reopen processing batch. Please try again.");
    } finally {
      setIsReopening(false);
    }
  };

  const handleSaveBatch = async () => {
    if (!batchId || !isEditable) {
      return;
    }
    setIsSaving(true);
    try {
      const updated = await DataService.updateProcessingBatchCans(batchId, selectedCans);
      setBatch(updated);
      setSelectedCans((updated.canIds ?? []).slice(0, MAX_CAN_SELECTION));
      await loadCans(batchId);
      toast.success("Batch updated successfully");
      navigate("/processing");
    } catch (err: unknown) {
      console.error("Failed to save batch cans", err);
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
    const unit = batch.productType === "treacle" ? "L" : "kg";
    const digits = batch.productType === "treacle" ? 1 : 2;
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
    const unit = batch.productType === "treacle" ? "L" : "kg";
    const digits = batch.productType === "treacle" ? 1 : 2;
    return `${Number(value).toFixed(digits)} ${unit}`;
  };

  const sortedCans = useMemo(() => {
    const copy = [...availableCans];
    copy.sort((a, b) => {
      const createdA = a.createdAt ? Date.parse(a.createdAt) : 0;
      const createdB = b.createdAt ? Date.parse(b.createdAt) : 0;
      if (createdA !== createdB) {
        return createdA - createdB;
      }
      return a.id.localeCompare(b.id);
    });
    return copy;
  }, [availableCans]);

  const filteredCans = useMemo(() => {
    const term = canSearch.trim().toLowerCase();
    if (!term) {
      return sortedCans;
    }

    return sortedCans.filter((can) => {
      const values = [
        can.id,
        can.collectionCenter?.name,
        can.collectionCenter?.location,
        can.productType,
        can.draft?.id,
        can.draft?.status,
        can.draft?.date,
        can.quantity?.toString(),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return values.includes(term);
    });
  }, [canSearch, sortedCans]);

  const selectedCansSummary = useMemo(() => {
    return selectedCans.reduce(
      (acc, canId) => {
        const can = availableCans.find((item) => item.id === canId);
        if (!can) {
          return acc;
        }

        return {
          count: acc.count + 1,
          totalQuantity: acc.totalQuantity + (can.quantity ?? 0),
        };
      },
      { count: 0, totalQuantity: 0 },
    );
  }, [availableCans, selectedCans]);

  const selectionLimitReached = selectedCans.length >= MAX_CAN_SELECTION;
  const noCansAvailable = !isCanLoading && !canError && sortedCans.length === 0;
  const noSearchMatches =
    !isCanLoading && !canError && sortedCans.length > 0 && filteredCans.length === 0;

  const cansToRender = isEditable
    ? filteredCans
    : filteredCans.filter((can) => selectedCans.includes(can.id)).slice(0, MAX_CAN_SELECTION);
  const noSelectedCans = !isEditable && cansToRender.length === 0;

  const selectAllState = useMemo(() => {
    if (!isEditable || cansToRender.length === 0) {
      return false;
    }
    return cansToRender.every((can) => selectedCans.includes(can.id));
  }, [cansToRender, selectedCans, isEditable]);

  const visibleSelectedQuantity = useMemo(() => {
    return cansToRender
      .filter((can) => selectedCans.includes(can.id))
      .reduce((sum, can) => sum + (can.quantity ?? 0), 0);
  }, [cansToRender, selectedCans]);

  const toggleSelectAllVisible = () => {
    if (!isEditable) {
      return;
    }

    const visibleCanIds = cansToRender.map((can) => can.id);
    const allSelected = visibleCanIds.every((id) => selectedCans.includes(id));

    if (allSelected) {
      // Deselect all visible cans
      setSelectedCans((prev) => prev.filter((id) => !visibleCanIds.includes(id)));
    } else {
      // Select all visible cans, respecting the limit
      const toAdd = visibleCanIds.filter((id) => !selectedCans.includes(id));
      const currentCount = selectedCans.length;
      const canAdd = MAX_CAN_SELECTION - currentCount;

      if (canAdd <= 0) {
        toast.error(`You can select up to ${MAX_CAN_SELECTION} cans per batch.`);
        return;
      }

      const addCount = Math.min(toAdd.length, canAdd);
      setSelectedCans((prev) => [...prev, ...toAdd.slice(0, addCount)]);

      if (toAdd.length > canAdd) {
        toast.error(
          `Only ${addCount} more can(s) could be selected due to the ${MAX_CAN_SELECTION}-can limit.`,
        );
      }
    }
  };

  const productionOutputLabel =
    batch?.productType === "treacle" ? "Treacle output (L)" : "Jaggery output (kg)";
  const productionOutputStep = batch?.productType === "treacle" ? "0.1" : "0.01";

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

      <PageContainer className="py-6 sm:py-8">
        {isBatchLoading ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            Loading batch…
          </div>
        ) : batchError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
            {batchError}
          </div>
        ) : batch ? (
          <>
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full min-w-0">
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold">Batch {batch.batchNumber}</h1>
                <p className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>Scheduled for {formatDate(batch.scheduledDate)}</span>
                  <span className="text-muted-foreground/40">|</span>
                  {batch.status === "completed" ? (
                    <span className="inline-block text-xs font-medium uppercase tracking-wide bg-green-50 text-green-700 px-2 py-1 rounded">
                      Submitted
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Status {batch.status}</span>
                  )}
                </p>
              </div>
              {isEditable ? (
                <div className="flex flex-col sm:flex-row w-full sm:w-auto sm:justify-end gap-2">
                  <Button
                    onClick={() => setProductionDialogOpen(true)}
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    {batch.totalSapOutput !== null && batch.totalSapOutput !== undefined
                      ? "Edit Production Data"
                      : "Add Production Data"}
                  </Button>
                  <Button
                    onClick={handleSaveBatch}
                    className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto"
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving…" : "Save Batch"}
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="mb-6 space-y-3">
              <h2 className="text-lg font-medium text-foreground mb-2 mt-6">Production Details</h2>
              <div className="rounded-xl border bg-white shadow-sm p-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground tracking-wide">
                      Output Quantity
                    </span>
                    <p className="text-sm font-semibold text-foreground">
                      {formatOutputQuantity(batch.totalSapOutput)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground tracking-wide">
                      Used Gas Amount
                    </span>
                    <p className="text-sm font-semibold text-foreground">
                      {formatGasAmount(batch.gasUsedKg)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isEditable
                    ? 'Select "Add production data" to record melting output and gas usage for this batch.'
                    : "Reopen the batch if you need to update production data."}
                </p>
              </div>
            </div>

            <hr className="my-6 border-gray-100" />

            <div className="mb-6">
              <p className="text-sm text-muted-foreground">
                Select cans from field collection to add to this batch
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-medium text-foreground mb-2 mt-6">
                {isEditable ? "Available Cans" : "Selected Cans"}
              </h2>

              <div className="max-w-md w-full md:w-1/2 min-w-0">
                <Input
                  value={canSearch}
                  onChange={(event) => setCanSearch(event.target.value)}
                  placeholder={
                    isEditable
                      ? "Search cans by ID, center, product, or draft"
                      : "Search within selected cans"
                  }
                  className="w-full rounded-lg border p-3 text-sm placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {isCanLoading && (
                <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                  Loading cans…
                </div>
              )}

              {canError && !isCanLoading && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                  {canError}
                </div>
              )}

              {noCansAvailable && (
                <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                  No active cans available.
                </div>
              )}

              {noSearchMatches && isEditable && (
                <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                  No cans match your search. Adjust the filters to see more cans.
                </div>
              )}

              {noSelectedCans && (
                <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                  No cans are selected for this submitted batch.
                </div>
              )}

              {isEditable && !isCanLoading && !canError && cansToRender.length > 0 && (
                <div className="flex flex-wrap items-start gap-4 pl-4">
                  <Checkbox
                    id="select-all-cans"
                    checked={selectAllState}
                    onCheckedChange={() => toggleSelectAllVisible()}
                    className="mt-1"
                  />
                  <label
                    htmlFor="select-all-cans"
                    className="flex-1 text-sm text-muted-foreground cursor-pointer"
                  >
                    Select all visible cans ({cansToRender.length})
                    {visibleSelectedQuantity > 0 && (
                      <span className="ml-2 font-medium text-foreground">
                        · Total: {visibleSelectedQuantity.toFixed(1)} kg
                      </span>
                    )}
                  </label>
                </div>
              )}

              {!isCanLoading &&
                !canError &&
                cansToRender.map((can) => {
                  const isChecked = selectedCans.includes(can.id);
                  const disableSelection = !isEditable || (selectionLimitReached && !isChecked);

                  const info = (
                    <>
                      <div className="flex items-center flex-wrap gap-3 text-sm text-muted-foreground">
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs uppercase tracking-wide"
                        >
                          Can ID · {can.id}
                        </Badge>
                        <span>Draft {can.draft.id}</span>
                        <span>Created: {formatDate(can.createdAt)}</span>
                      </div>
                      <div className="mt-3 flex items-center flex-wrap gap-3 text-sm text-gray-600">
                        <span className="font-medium text-foreground">
                          Collection Center: {can.collectionCenter.name}
                        </span>
                        <span className="px-2 text-muted-foreground/40">|</span>
                        <span>Quantity: {can.quantity} kg</span>
                        <span className="px-2 text-muted-foreground/40">|</span>
                        <span>Product: {can.productType}</span>
                        <span className="px-2 text-muted-foreground/40">|</span>
                        <span>Brix: {formatNumber(can.brixValue, 1)}</span>
                        <span className="px-2 text-muted-foreground/40">|</span>
                        <span>pH: {formatNumber(can.phValue, 2)}</span>
                      </div>
                    </>
                  );

                  return (
                    <div
                      key={can.id}
                      className="rounded-xl border bg-white shadow-sm p-4 mb-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        {isEditable ? (
                          <Checkbox
                            id={can.id}
                            checked={isChecked}
                            onCheckedChange={() => handleToggleCan(can.id)}
                            className="mt-1"
                            disabled={disableSelection}
                          />
                        ) : (
                          <div className="mt-1 h-4 w-4" aria-hidden />
                        )}
                        {isEditable ? (
                          <label
                            htmlFor={can.id}
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
                  You have reached the {MAX_CAN_SELECTION}-can limit for this batch. Deselect one to
                  pick another.
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
              <DialogContent className="sm:max-w-lg rounded-xl border bg-white shadow-sm p-6">
                <DialogHeader>
                  <DialogTitle>Production Data</DialogTitle>
                  <DialogDescription>
                    {isEditable
                      ? `Record melting output and gas usage for batch ${batch.batchNumber}.`
                      : `Production data for batch ${batch.batchNumber}. Reopen the batch to make changes.`}
                  </DialogDescription>
                </DialogHeader>
                {isEditable ? (
                  <form onSubmit={handleSaveProduction} className="space-y-5">
                    {batch.productType === "treacle" && (
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
                        {isSavingProduction ? "Saving…" : "Save Batch"}
                      </Button>
                    </DialogFooter>
                  </form>
                ) : (
                  <div className="space-y-4 text-sm">
                    <div className="grid gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground/80">
                          Output quantity
                        </p>
                        <p className="font-medium text-foreground">
                          {formatOutputQuantity(batch.totalSapOutput)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground/80">
                          Used gas amount
                        </p>
                        <p className="font-medium text-foreground">
                          {formatGasAmount(batch.gasUsedKg)}
                        </p>
                      </div>
                    </div>
                    <DialogFooter className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setProductionDialogOpen(false)}
                      >
                        Close
                      </Button>
                    </DialogFooter>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {isCompleted && (
              <div className="mt-6 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <span>Submitted batches are read-only. Reopen the batch to make adjustments.</span>
                <div>
                  <Button
                    onClick={handleReopenBatch}
                    disabled={isReopening}
                    className="bg-cta hover:bg-cta-hover text-cta-foreground"
                  >
                    {isReopening ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reopening…
                      </>
                    ) : (
                      "Reopen Batch"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            Batch not found.
          </div>
        )}
  </PageContainer>
    </div>
  );
}
