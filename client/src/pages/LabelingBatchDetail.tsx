import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import DataService from "@/lib/dataService";
import type { LabelingBatchDto } from "@/lib/apiClient";

function normalizeStatus(status: string | null | undefined) {
  return String(status ?? "").trim().toLowerCase();
}

function formatStatusLabelText(status: string | null | undefined) {
  const raw = (status ?? "").trim();
  if (!raw) {
    return "Pending";
  }
  return raw
    .split(/[-_\s]+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export default function LabelingBatchDetail() {
  const { packagingId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [batch, setBatch] = useState<LabelingBatchDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [form, setForm] = useState({
    stickerQuantity: "",
    shrinkSleeveQuantity: "",
    neckTagQuantity: "",
    corrugatedCartonQuantity: "",
  });

  const userRole = user?.role || "Guest";
  const userName = user?.name || user?.userId || "User";
  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL || "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }, []);
  const userAvatar = user?.profileImage ? new URL(user.profileImage, apiBase).toString() : undefined;

  const productType = normalizeStatus(batch?.productType);
  const isTreacle = productType === "treacle";
  const isJaggery = productType === "jaggery";
  const normalizedStatus = normalizeStatus(batch?.labelingStatus);
  const isCompleted = normalizedStatus === "completed";

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const loadBatch = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await DataService.getLabelingBatch(id);
      setBatch(data);
    } catch (err) {
      console.error("Failed to load labeling batch", err);
      setError("Unable to load labeling batch. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!packagingId) {
      return;
    }
    void loadBatch(packagingId);
  }, [packagingId]);

  useEffect(() => {
    if (!batch) {
      setForm({
        stickerQuantity: "",
        shrinkSleeveQuantity: "",
        neckTagQuantity: "",
        corrugatedCartonQuantity: "",
      });
      return;
    }

    setForm({
      stickerQuantity:
        batch.stickerQuantity !== null && batch.stickerQuantity !== undefined ? String(batch.stickerQuantity) : "",
      shrinkSleeveQuantity:
        batch.shrinkSleeveQuantity !== null && batch.shrinkSleeveQuantity !== undefined
          ? String(batch.shrinkSleeveQuantity)
          : "",
      neckTagQuantity:
        batch.neckTagQuantity !== null && batch.neckTagQuantity !== undefined ? String(batch.neckTagQuantity) : "",
      corrugatedCartonQuantity:
        batch.corrugatedCartonQuantity !== null && batch.corrugatedCartonQuantity !== undefined
          ? String(batch.corrugatedCartonQuantity)
          : "",
    });
  }, [batch]);

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

  const parseNumber = (value: string) => {
    const numeric = parseFloat(value);
    return Number.isNaN(numeric) ? NaN : numeric;
  };

  const buildPayloadFromForm = () => {
    if (!isTreacle && !isJaggery) {
      toast.error("Unsupported product type for labeling batch.");
      return null;
    }

    const payload: {
      stickerQuantity?: number | null;
      shrinkSleeveQuantity?: number | null;
      neckTagQuantity?: number | null;
      corrugatedCartonQuantity?: number | null;
    } = {};

    const sticker = parseNumber(form.stickerQuantity);
    const carton = parseNumber(form.corrugatedCartonQuantity);
    if (Number.isNaN(sticker) || Number.isNaN(carton) || sticker < 0 || carton < 0) {
      toast.error("Enter valid non-negative sticker and carton quantities.");
      return null;
    }
    payload.stickerQuantity = sticker;
    payload.corrugatedCartonQuantity = carton;

    if (isTreacle) {
      const shrink = parseNumber(form.shrinkSleeveQuantity);
      const neck = parseNumber(form.neckTagQuantity);
      if (Number.isNaN(shrink) || Number.isNaN(neck) || shrink < 0 || neck < 0) {
        toast.error("Enter valid non-negative shrink sleeve and neck tag quantities.");
        return null;
      }
      payload.shrinkSleeveQuantity = shrink;
      payload.neckTagQuantity = neck;
    } else {
      payload.shrinkSleeveQuantity = null;
      payload.neckTagQuantity = null;
    }

    return payload;
  };

  const handleSaveLabeling = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!packagingId) {
      toast.error("Missing labeling batch identifier.");
      return;
    }

    const payload = buildPayloadFromForm();
    if (!payload) {
      return;
    }

    setIsSaving(true);
    try {
      const updated = await DataService.updateLabelingBatch(packagingId, payload);
      setBatch(updated);
      toast.success("Labeling data saved");
      navigate("/labeling");
    } catch (err) {
      console.error("Failed to save labeling data", err);
      toast.error("Unable to save labeling data. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReopenBatch = async () => {
    if (!packagingId) {
      toast.error("Missing labeling batch identifier.");
      return;
    }

    const payload = buildPayloadFromForm();
    if (!payload) {
      return;
    }

    setIsReopening(true);
    try {
      const updated = await DataService.updateLabelingBatch(packagingId, {
        ...payload,
        status: "in-progress",
      });
      setBatch(updated);
      toast.success("Labeling batch reopened");
    } catch (err) {
      console.error("Failed to reopen labeling batch", err);
      toast.error("Unable to reopen labeling batch. Please try again.");
    } finally {
      setIsReopening(false);
    }
  };

  if (!packagingId) {
    return <div className="p-6 text-sm text-muted-foreground">No labeling batch selected.</div>;
  }

  const breadcrumb = (
    <div className="flex items-center space-x-2 text-sm text-white/90">
      <Link to="/labeling" className="transition-colors hover:text-white">
        Labeling
      </Link>
      <span className="text-white/60">&gt;</span>
      <span className="font-semibold text-black">Batch {batch?.batchNumber ?? packagingId}</span>
    </div>
  );

  const productLabel = isTreacle ? "Treacle" : isJaggery ? "Jaggery" : "";
  const scheduledDate = formatDate(batch?.scheduledDate ?? batch?.startedAt);
  const canCountDisplay =
    typeof batch?.canCount === "number" ? batch.canCount.toLocaleString() : "—";
  const finishedQuantityDisplay =
    batch?.finishedQuantity !== null && batch?.finishedQuantity !== undefined
      ? `${Number(batch.finishedQuantity).toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })} ${isTreacle ? "L" : "kg"}`
      : "—";
  const statusLabelText = isCompleted ? "Submitted" : formatStatusLabelText(batch?.labelingStatus);
  const statusBadgeClass = isCompleted ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        userRole={userRole}
        userName={userName}
        userAvatar={userAvatar}
        onLogout={handleLogout}
        breadcrumb={breadcrumb}
      />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isLoading ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading labeling batch…</div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
            {error}
          </div>
        ) : batch ? (
          <>
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Batch {batch.batchNumber}</h1>
                <p className="text-sm text-gray-700 mt-1 flex items-center gap-4">
                  <span>Batch ID: {batch.batchNumber}</span>
                  <span className="text-gray-300">|</span>
                  <span>{scheduledDate}</span>
                  <span className="text-gray-300">|</span>
                  <span>Finished Qty: {finishedQuantityDisplay}</span>
                  <span className="text-gray-300">|</span>
                  <span>Cans: {canCountDisplay}</span>
                  <span className="text-gray-300">|</span>
                  {isCompleted ? (
                    <span className="inline-block text-xs font-medium uppercase tracking-wide bg-green-50 text-green-700 px-2 py-1 rounded">Submitted</span>
                  ) : (
                    <span className="inline-block text-xs uppercase bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">In Progress</span>
                  )}
                </p>
              </div>
              {!isCompleted || isReopening ? (
                <div className="flex w-full sm:w-auto sm:justify-end justify-stretch gap-2">
                  <Button
                    onClick={() => navigate("/labeling")}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium w-full sm:w-auto"
                  >
                    Back to Labeling
                  </Button>
                  <Button
                    type="submit"
                    form="labeling-form"
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium w-full sm:w-auto"
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving…" : "Save Labeling Data"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 w-full sm:w-auto text-sm text-muted-foreground sm:items-end">
                  <div className="text-center sm:text-right">
                    Submitted batches are read-only. Reopen the batch to make changes.
                  </div>
                </div>
              )}
            </div>

            <form id="labeling-form" onSubmit={handleSaveLabeling} className="mt-6 space-y-6">
              <section className="rounded-lg bg-white shadow-sm border border-gray-100 p-6">
                <div className="mb-4">
                  <h2 className="text-base font-medium text-foreground">Batch Snapshot</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Review the key details for this batch before recording accessory usage.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Finished Quantity</p>
                    <p className="text-sm font-semibold text-gray-800 mt-1">{finishedQuantityDisplay}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Can Count</p>
                    <p className="text-sm font-semibold text-gray-800 mt-1">{canCountDisplay}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-lg bg-white shadow-sm border border-gray-100 p-6">
                <div className="mb-4">
                  <h2 className="text-base font-medium text-foreground">Labeling Accessories</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Record the materials used to keep replenishment and costing accurate.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="stickerQuantity">Sticker Quantity</Label>
                    <Input
                      id="stickerQuantity"
                      type="number"
                      min="0"
                      step="1"
                      value={form.stickerQuantity}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, stickerQuantity: event.target.value }))
                      }
                      required
                      disabled={isCompleted && !isReopening}
                      className="rounded-md border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="corrugatedCartonQuantity">Corrugated Carton Quantity</Label>
                    <Input
                      id="corrugatedCartonQuantity"
                      type="number"
                      min="0"
                      step="1"
                      value={form.corrugatedCartonQuantity}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, corrugatedCartonQuantity: event.target.value }))
                      }
                      required
                      disabled={isCompleted && !isReopening}
                      className="rounded-md border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {isTreacle && (
                  <div className="grid grid-cols-2 gap-6 mt-6">
                    <div className="space-y-2">
                      <Label htmlFor="shrinkSleeveQuantity">Shrink Sleeve Quantity</Label>
                      <Input
                        id="shrinkSleeveQuantity"
                        type="number"
                        min="0"
                        step="1"
                        value={form.shrinkSleeveQuantity}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, shrinkSleeveQuantity: event.target.value }))
                        }
                        required
                        disabled={isCompleted && !isReopening}
                        className="rounded-md border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="neckTagQuantity">Neck Tag Quantity</Label>
                      <Input
                        id="neckTagQuantity"
                        type="number"
                        min="0"
                        step="1"
                        value={form.neckTagQuantity}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, neckTagQuantity: event.target.value }))
                        }
                        required
                        disabled={isCompleted && !isReopening}
                        className="rounded-md border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}
              </section>
            </form>

            {isCompleted && (
              <div className="mt-6 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <span>Submitted batches are read-only. Reopen the batch to make adjustments.</span>
                <div>
                  <Button
                    onClick={handleReopenBatch}
                    disabled={isReopening}
                    className="inline-flex items-center rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 font-medium text-white"
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
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Labeling batch not found.</div>
        )}
      </div>
    </div>
  );
}

