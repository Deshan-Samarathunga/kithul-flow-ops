import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { SecondaryToolbar } from "@/components/SecondaryToolbar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import DataService from "@/lib/dataService";
import type { ProcessingBatchDto } from "@/lib/apiClient";
import { toast } from "sonner";

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
      const created = await DataService.createProcessingBatch();
      toast.success(`Batch ${created.batchNumber} created`);
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

  const resolveBadgeStatus = (status: string) => (status === "completed" ? "completed" : "in-progress");

  const formatStatusLabel = (status: string) =>
    status
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  const filteredBatches = batches.filter((batch) => {
    if (!searchQuery.trim()) {
      return true;
    }
    const term = searchQuery.trim().toLowerCase();
    const composite = [batch.batchNumber, batch.productType, batch.status, formatDate(batch.scheduledDate)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return composite.includes(term);
  });

  const activeBatches = filteredBatches.filter((batch) => batch.status !== "completed" && batch.status !== "cancelled");
  const completedBatches = filteredBatches.filter((batch) => batch.status === "completed");

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} userAvatar={userAvatar} onLogout={handleLogout} />
      
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="space-y-6">
          <SecondaryToolbar>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 w-full">
              <Button
                onClick={handleCreateBatch}
                className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto"
                disabled={isCreating}
              >
                <Plus className="h-4 w-4 mr-2" />
                {isCreating ? "Creating…" : "Add new Batch"}
              </Button>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search batches"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="pl-10"
                />
              </div>
              <StatusBadge status="in-progress" label={`${activeBatches.length} Active`} />
            </div>
          </SecondaryToolbar>

          {isLoading && (
            <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
              Loading batches…
            </div>
          )}

          {error && !isLoading && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {!isLoading && !error && batches.length === 0 && (
            <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
              No batches yet. Create a new batch to get started.
            </div>
          )}

          {!isLoading && !error && batches.length > 0 && (
            <div className="space-y-10">
              <section className="space-y-4">
                <h2 className="text-lg sm:text-xl font-semibold">Active Batches</h2>
                {activeBatches.length === 0 ? (
                  <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                    No batches ready for submission.
                  </div>
                ) : (
                  activeBatches.map((batch) => (
                    <div
                      key={batch.id}
                      className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm">
                          <span className="font-medium">{formatDate(batch.scheduledDate)}</span>
                          <span className="hidden sm:inline text-muted-foreground">|</span>
                          <span>Batch: {batch.batchNumber}</span>
                          <span className="hidden sm:inline text-muted-foreground">|</span>
                          <span>Buckets: {batch.bucketCount}</span>
                          <span className="hidden sm:inline text-muted-foreground">|</span>
                          <span>Total Qty: {Number(batch.totalQuantity ?? 0).toFixed(1)} kg</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
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
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </section>

              <section className="space-y-4">
                <h2 className="text-lg sm:text-xl font-semibold">Submitted History</h2>
                {completedBatches.length === 0 ? (
                  <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                    No submitted batches yet.
                  </div>
                ) : (
                  completedBatches.map((batch) => (
                    <div
                      key={batch.id}
                      className="bg-muted/50 border rounded-lg p-4 sm:p-6"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm">
                          <span className="font-medium">{formatDate(batch.scheduledDate)}</span>
                          <span className="hidden sm:inline text-muted-foreground">|</span>
                          <span>Batch: {batch.batchNumber}</span>
                          <span className="hidden sm:inline text-muted-foreground">|</span>
                          <span>Total Qty: {Number(batch.totalQuantity ?? 0).toFixed(1)} kg</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge
                            status={resolveBadgeStatus(batch.status)}
                            label="Submitted"
                          />
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
                  ))
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

