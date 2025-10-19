import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import DataService from "@/lib/dataService";
import type { PackagingBatchDto } from "@/lib/apiClient";

export default function Packaging() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [batches, setBatches] = useState<PackagingBatchDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
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
      const remoteBatches = await DataService.getPackagingBatches();
      setBatches(remoteBatches);
    } catch (err) {
      console.error("Failed to load packaging batches", err);
      setError("Unable to load packaging batches. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadBatches();
  }, []);

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} userAvatar={userAvatar} onLogout={handleLogout} />
      
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold">Packaging</h1>
          <Button
            onClick={() => toast.success("Report downloaded")}
            className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto"
          >
            <FileText className="h-4 w-4 mr-2" />
            Download Report
          </Button>
        </div>

        <div className="space-y-4">
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

          {!isLoading && !error && batches.length === 0 && (
            <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
              No batches have moved into packaging yet.
            </div>
          )}

          {!isLoading && !error &&
            batches.map((item) => (
              <div
                key={item.id}
                className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm">
                    <span className="font-medium">{formatDate(item.startedAt ?? item.scheduledDate)}</span>
                    <span className="hidden sm:inline text-muted-foreground">|</span>
                    <span>Batch: {item.batchNumber}</span>
                    <span className="hidden sm:inline text-muted-foreground">|</span>
                    <span>Total Qty: {Number(item.totalQuantity ?? 0).toFixed(1)} kg</span>
                    <span className="hidden sm:inline text-muted-foreground">|</span>
                    <span>Buckets: {item.bucketCount}</span>
                  </div>
                  <StatusBadge
                    status={resolveBadgeStatus(item.packagingStatus)}
                    label={formatStatusLabel(item.packagingStatus)}
                  />
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}





