import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { SecondaryToolbar } from "@/components/SecondaryToolbar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} userAvatar={userAvatar} onLogout={handleLogout} />
      
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-6">Batches</h1>

        <SecondaryToolbar>
          <Button
            onClick={handleCreateBatch}
            className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto"
            disabled={isCreating}
          >
            <Plus className="h-4 w-4 mr-2" />
            {isCreating ? "Creating…" : "Add new Batch"}
          </Button>
        </SecondaryToolbar>

        <div className="space-y-4 mt-6">
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

          {!isLoading && !error &&
            batches.map((batch) => (
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
                  <div className="flex items-center gap-3 flex-wrap">
                    <StatusBadge
                      status={resolveBadgeStatus(batch.status)}
                      label={formatStatusLabel(batch.status)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/processing/batch/${batch.id}`)}
                      className="text-cta hover:text-cta-hover flex-1 sm:flex-none"
                    >
                      View
                    </Button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

