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
import type { PackagingBatchDto } from "@/lib/apiClient";

function normalizeStatus(status: string | null | undefined) {
  return String(status ?? "").trim().toLowerCase();
}

export default function PackagingBatchDetail() {
  const { packagingId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [batch, setBatch] = useState<PackagingBatchDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [form, setForm] = useState({
    finishedQuantity: "",
    bottleQuantity: "",
    lidQuantity: "",
    alufoilQuantity: "",
    vacuumBagQuantity: "",
    parchmentPaperQuantity: "",
  });

  const userRole = user?.role || "Guest";
  const userName = user?.name || user?.userId || "User";
  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL || "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }, []);
  const userAvatar = user?.profileImage ? new URL(user.profileImage, apiBase).toString() : undefined;

  const productType = normalizeStatus(batch?.productType);
  const isSap = productType === "sap";
  const isTreacle = productType === "treacle";
  const normalizedStatus = normalizeStatus(batch?.packagingStatus);
  const isCompleted = normalizedStatus === "completed";
  const resolvedPackagingId = batch?.packagingId ?? packagingId ?? "";
  const finishedQuantityStep = isSap ? "0.1" : "0.01";
  const productLabel = isSap ? "Sap" : isTreacle ? "Treacle" : "";

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const loadBatch = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await DataService.getPackagingBatch(id);
      setBatch(data);
    } catch (err) {
      console.error("Failed to load packaging batch", err);
      setError("Unable to load packaging batch. Please try again later.");
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
        finishedQuantity: "",
        bottleQuantity: "",
        lidQuantity: "",
        alufoilQuantity: "",
        vacuumBagQuantity: "",
        parchmentPaperQuantity: "",
      });
      return;
    }

    setForm({
      finishedQuantity:
        batch.finishedQuantity !== null && batch.finishedQuantity !== undefined
          ? String(batch.finishedQuantity)
          : "",
      bottleQuantity:
        batch.bottleQuantity !== null && batch.bottleQuantity !== undefined ? String(batch.bottleQuantity) : "",
      lidQuantity:
        batch.lidQuantity !== null && batch.lidQuantity !== undefined ? String(batch.lidQuantity) : "",
      alufoilQuantity:
        batch.alufoilQuantity !== null && batch.alufoilQuantity !== undefined ? String(batch.alufoilQuantity) : "",
      vacuumBagQuantity:
        batch.vacuumBagQuantity !== null && batch.vacuumBagQuantity !== undefined
          ? String(batch.vacuumBagQuantity)
          : "",
      parchmentPaperQuantity:
        batch.parchmentPaperQuantity !== null && batch.parchmentPaperQuantity !== undefined
          ? String(batch.parchmentPaperQuantity)
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
    if (!isSap && !isTreacle) {
      toast.error("Unsupported product type for packaging batch.");
      return null;
    }

    const payload: {
      finishedQuantity?: number | null;
      bottleQuantity?: number | null;
      lidQuantity?: number | null;
      alufoilQuantity?: number | null;
      vacuumBagQuantity?: number | null;
      parchmentPaperQuantity?: number | null;
    } = {};

    const finishedQuantityValue = parseNumber(form.finishedQuantity);
    if (Number.isNaN(finishedQuantityValue) || finishedQuantityValue < 0) {
      toast.error("Enter a valid non-negative finished quantity.");
      return null;
    }
    payload.finishedQuantity = finishedQuantityValue;

    if (isSap) {
      const bottle = parseNumber(form.bottleQuantity);
      const lid = parseNumber(form.lidQuantity);
      if (Number.isNaN(bottle) || Number.isNaN(lid) || bottle < 0 || lid < 0) {
        toast.error("Enter valid non-negative quantities for bottles and lids.");
        return null;
      }
      payload.bottleQuantity = bottle;
      payload.lidQuantity = lid;
    } else {
      const alufoil = parseNumber(form.alufoilQuantity);
      const vacuum = parseNumber(form.vacuumBagQuantity);
      const parchment = parseNumber(form.parchmentPaperQuantity);
      if (
        Number.isNaN(alufoil) ||
        Number.isNaN(vacuum) ||
        Number.isNaN(parchment) ||
        alufoil < 0 ||
        vacuum < 0 ||
        parchment < 0
      ) {
        toast.error("Enter valid non-negative quantities for packaging materials.");
        return null;
      }
      payload.alufoilQuantity = alufoil;
      payload.vacuumBagQuantity = vacuum;
      payload.parchmentPaperQuantity = parchment;
    }

    return payload;
  };

  const handleSavePackaging = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resolvedPackagingId) {
      toast.error("Missing packaging batch identifier.");
      return;
    }

    const payload = buildPayloadFromForm();
    if (!payload) {
      return;
    }

    setIsSaving(true);
    try {
      const updated = await DataService.updatePackagingBatch(resolvedPackagingId, payload);
      setBatch(updated);
      toast.success("Packaging data saved");
    } catch (err) {
      console.error("Failed to save packaging data", err);
      toast.error("Unable to save packaging data. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReopenBatch = async () => {
    if (!resolvedPackagingId) {
      toast.error("Missing packaging batch identifier.");
      return;
    }

    const payload = buildPayloadFromForm();
    if (!payload) {
      return;
    }

    setIsReopening(true);
    try {
      const updated = await DataService.updatePackagingBatch(resolvedPackagingId, {
        ...payload,
        status: "in-progress",
      });
      setBatch(updated);
      toast.success("Packaging batch reopened");
    } catch (err) {
      console.error("Failed to reopen packaging batch", err);
      toast.error("Unable to reopen packaging batch. Please try again.");
    } finally {
      setIsReopening(false);
    }
  };

  const batchDetailParts = [
    productLabel ? `${productLabel} product` : null,
    batch?.scheduledDate ? `Scheduled ${formatDate(batch.scheduledDate)}` : null,
    typeof batch?.bucketCount === "number" ? `${batch.bucketCount} buckets` : null,
  ].filter(Boolean);
  const batchDetailLine = batchDetailParts.join(" • ");

  if (!packagingId) {
    return <div className="p-6 text-sm text-muted-foreground">No packaging batch selected.</div>;
  }

  const breadcrumb = (
    <div className="flex items-center space-x-2 text-sm text-white/90">
      <Link to="/packaging" className="transition-colors hover:text-white">
        Packaging
      </Link>
      <span className="text-white/60">/</span>
      <span className="font-semibold text-black">Batch {batch?.batchNumber ?? packagingId}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        userRole={userRole}
        userName={userName}
        userAvatar={userAvatar}
        onLogout={handleLogout}
        breadcrumb={breadcrumb}
      />

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isLoading ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading packaging batch…</div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
            {error}
          </div>
        ) : batch ? (
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Packaging batch</span>
              <h1 className="text-xl font-semibold text-foreground">
                Batch {batch.batchNumber ?? resolvedPackagingId}
              </h1>
              {batchDetailLine ? (
                <p className="text-sm text-muted-foreground">{batchDetailLine}</p>
              ) : null}
            </div>

            <form onSubmit={handleSavePackaging} className="mt-6 space-y-6">
              <section className="rounded-xl border border-border/60 bg-background/80 p-4 space-y-4">
                <div>
                  <h2 className="text-base font-medium text-foreground">Finished output</h2>
                  <p className="text-sm text-muted-foreground">
                    Enter the final packaged quantity so downstream teams know exactly what is ready.
                  </p>
                </div>
                <div className="grid gap-4 sm:max-w-xs">
                  <div className="space-y-2">
                    <Label htmlFor="finishedQuantity">Finished quantity</Label>
                    <Input
                      id="finishedQuantity"
                      type="number"
                      min="0"
                      step={finishedQuantityStep}
                      value={form.finishedQuantity}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, finishedQuantity: event.target.value }))
                      }
                      required
                      disabled={isCompleted && !isReopening}
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-border/60 bg-background/80 p-4 space-y-4">
                <div>
                  <h2 className="text-base font-medium text-foreground">Packaging materials</h2>
                  <p className="text-sm text-muted-foreground">
                    Track the materials used so replenishment and costing stay accurate.
                  </p>
                </div>

                {isSap ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="bottleQuantity">Bottle quantity</Label>
                      <Input
                        id="bottleQuantity"
                        type="number"
                        min="0"
                        step="1"
                        value={form.bottleQuantity}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, bottleQuantity: event.target.value }))
                        }
                        required
                        disabled={isCompleted && !isReopening}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lidQuantity">Lid quantity</Label>
                      <Input
                        id="lidQuantity"
                        type="number"
                        min="0"
                        step="1"
                        value={form.lidQuantity}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, lidQuantity: event.target.value }))
                        }
                        required
                        disabled={isCompleted && !isReopening}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="alufoilQuantity">Alufoil quantity</Label>
                      <Input
                        id="alufoilQuantity"
                        type="number"
                        min="0"
                        step="1"
                        value={form.alufoilQuantity}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, alufoilQuantity: event.target.value }))
                        }
                        required
                        disabled={isCompleted && !isReopening}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vacuumBagQuantity">Vacuum bag quantity</Label>
                      <Input
                        id="vacuumBagQuantity"
                        type="number"
                        min="0"
                        step="1"
                        value={form.vacuumBagQuantity}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, vacuumBagQuantity: event.target.value }))
                        }
                        required
                        disabled={isCompleted && !isReopening}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="parchmentPaperQuantity">Parchment paper quantity</Label>
                      <Input
                        id="parchmentPaperQuantity"
                        type="number"
                        min="0"
                        step="1"
                        value={form.parchmentPaperQuantity}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, parchmentPaperQuantity: event.target.value }))
                        }
                        required
                        disabled={isCompleted && !isReopening}
                      />
                    </div>
                  </div>
                )}
              </section>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/packaging")}
                >
                  Back to packaging
                </Button>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {isCompleted && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleReopenBatch()}
                      disabled={isReopening}
                    >
                      {isReopening ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Reopening…
                        </span>
                      ) : (
                        "Reopen batch"
                      )}
                    </Button>
                  )}
                  <Button
                    type="submit"
                    className="bg-cta hover:bg-cta-hover text-cta-foreground"
                    disabled={isSaving || (isCompleted && !isReopening)}
                  >
                    {isSaving ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                      </span>
                    ) : (
                      "Save packaging data"
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        ) : (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Packaging batch not found.</div>
        )}
      </main>
    </div>
  );
}
