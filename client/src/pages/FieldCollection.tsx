import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, RefreshCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import DataService from "@/lib/dataService";

type DraftStatus = "draft" | "submitted" | "completed" | string;

type DraftSummary = {
  id: string;
  draftId: string;
  date: string | null;
  productType: "sap" | "treacle" | string | null;
  status: DraftStatus;
  createdByName?: string | null;
  bucketCount: number;
  totalQuantity: number;
  createdAt: string | null;
  updatedAt: string | null;
};

type DraftMetrics = {
  total: number;
  active: number;
  submitted: number;
  bucketTotal: number;
  quantityTotal: number;
};

const normalizeStatus = (status: DraftStatus) => (typeof status === "string" ? status.trim().toLowerCase() : "draft");

const formatDateLabel = (value: string | null) => {
  if (!value) {
    return "—";
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleDateString();
};

const formatProductLabel = (productType: DraftSummary["productType"]) => {
  if (!productType) {
    return "Unknown";
  }
  const label = productType.toString();
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatNumericValue = (value: number) => (Number.isFinite(value) ? value.toLocaleString() : "0");

const productTypeOptions: Array<{ value: "sap" | "treacle"; label: string }> = [
  { value: "sap", label: "Sap" },
  { value: "treacle", label: "Treacle" },
];

export default function FieldCollection() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [productTypeFilter, setProductTypeFilter] = useState<"sap" | "treacle">("sap");
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [submittingDraftId, setSubmittingDraftId] = useState<string | null>(null);
  const [reopeningDraftId, setReopeningDraftId] = useState<string | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);

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

  const loadDrafts = async (options?: { suppressLoader?: boolean }) => {
    const shouldShowLoader = !options?.suppressLoader;
    if (shouldShowLoader) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const data = await DataService.getDrafts();
      const normalized: DraftSummary[] = (data ?? [])
        .map((item) => {
          const draftId = item?.draft_id ?? item?.draftId;
          if (!draftId) {
            return null;
          }
          const productTypeRaw = typeof item?.product_type === "string" ? item.product_type.toLowerCase() : null;
          const statusRaw = typeof item?.status === "string" ? item.status.toLowerCase() : "draft";
          const bucketCountRaw = Number(item?.bucket_count ?? 0);
          const totalQuantityRaw = Number(item?.total_quantity ?? 0);
          return {
            id: String(item?.id ?? draftId),
            draftId: String(draftId),
            date: item?.date ?? null,
            productType: productTypeRaw,
            status: statusRaw,
            createdByName: item?.created_by_name ?? null,
            bucketCount: Number.isFinite(bucketCountRaw) ? bucketCountRaw : 0,
            totalQuantity: Number.isFinite(totalQuantityRaw) ? totalQuantityRaw : 0,
            createdAt: item?.created_at ?? null,
            updatedAt: item?.updated_at ?? null,
          } satisfies DraftSummary;
        })
        .filter(Boolean) as DraftSummary[];
      setDrafts(normalized);
    } catch (err) {
      console.error("Failed to load drafts", err);
      const message = err instanceof Error ? err.message : "Unable to load drafts. Please try again.";
      setError(message);
      toast.error("Failed to load drafts");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDrafts();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadDrafts({ suppressLoader: true });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateDraft = async () => {
    setIsCreating(true);
    try {
      const currentDate = new Date().toISOString().split("T")[0];
      const created = await DataService.createDraft(productTypeFilter, currentDate);
      toast.success("Collection draft created successfully");
      await loadDrafts({ suppressLoader: true });
      navigate(`/field-collection/draft/${created.draft_id ?? created.draftId}`);
    } catch (err) {
      console.error("Error creating draft", err);
      toast.error("Failed to create draft");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSubmitDraft = async (draftId: string) => {
    setSubmittingDraftId(draftId);
    try {
      await DataService.submitDraft(draftId);
      toast.success("Draft submitted successfully");
      await loadDrafts({ suppressLoader: true });
    } catch (err) {
      console.error("Error submitting draft", err);
      toast.error("Failed to submit draft");
    } finally {
      setSubmittingDraftId(null);
    }
  };

  const handleReopenDraft = async (draftId: string) => {
    setReopeningDraftId(draftId);
    try {
      await DataService.reopenDraft(draftId);
      toast.success("Draft reopened successfully");
      await loadDrafts({ suppressLoader: true });
    } catch (err) {
      console.error("Error reopening draft", err);
      toast.error("Failed to reopen draft");
    } finally {
      setReopeningDraftId(null);
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    setDeletingDraftId(draftId);
    try {
      await DataService.deleteDraft(draftId);
      toast.success("Draft deleted successfully");
      await loadDrafts({ suppressLoader: true });
    } catch (err) {
      console.error("Error deleting draft", err);
      toast.error("Failed to delete draft");
    } finally {
      setDeletingDraftId(null);
    }
  };

  const draftMetrics = useMemo(() => {
    const base: DraftMetrics = { total: 0, active: 0, submitted: 0, bucketTotal: 0, quantityTotal: 0 };
    const metrics: Record<"sap" | "treacle", DraftMetrics> = {
      sap: { ...base },
      treacle: { ...base },
    };

    drafts.forEach((draft) => {
      const key: "sap" | "treacle" = draft.productType === "treacle" ? "treacle" : "sap";
      const normalized = normalizeStatus(draft.status);
      metrics[key].total += 1;
      metrics[key].bucketTotal += Number.isFinite(draft.bucketCount) ? draft.bucketCount : 0;
      metrics[key].quantityTotal += Number.isFinite(draft.totalQuantity) ? draft.totalQuantity : 0;
      if (normalized === "submitted" || normalized === "completed") {
        metrics[key].submitted += 1;
      } else {
        metrics[key].active += 1;
      }
    });

    return metrics;
  }, [drafts]);

  const filteredDrafts = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return drafts.filter((draft) => {
      const matchesType = (draft.productType ?? "sap") === productTypeFilter;
      if (!matchesType) {
        return false;
      }
      if (!term) {
        return true;
      }
      const composite = [
        draft.draftId,
        formatDateLabel(draft.date),
        draft.status,
        draft.productType,
        draft.createdByName,
        draft.bucketCount ? String(draft.bucketCount) : null,
        draft.totalQuantity ? String(draft.totalQuantity) : null,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return composite.includes(term);
    });
  }, [drafts, productTypeFilter, searchQuery]);

  const activeDrafts = filteredDrafts.filter((draft) => {
    const normalized = normalizeStatus(draft.status);
    return normalized !== "submitted" && normalized !== "completed";
  });

  const submittedDrafts = filteredDrafts.filter((draft) => {
    const normalized = normalizeStatus(draft.status);
    return normalized === "submitted" || normalized === "completed";
  });

  const selectedMetrics = draftMetrics[productTypeFilter];

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} userAvatar={userAvatar} onLogout={handleLogout} />

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="space-y-6 sm:space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Field Collection Drafts</h1>
            <p className="text-sm text-muted-foreground">
              Capture and track daily collection drafts before they move into processing.
            </p>
          </div>

          <div className="rounded-2xl border bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-1 bg-muted/60 rounded-full p-1 w-full sm:w-auto">
                {productTypeOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant="ghost"
                    onClick={() => setProductTypeFilter(option.value)}
                    className={cn(
                      "h-9 rounded-full px-4 text-sm font-medium transition-all",
                      productTypeFilter === option.value
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>

              <div className="flex flex-1 flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search drafts"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  className="w-full sm:w-auto"
                  disabled={isLoading || isRefreshing}
                >
                  <RefreshCcw className={cn("h-4 w-4", (isLoading || isRefreshing) && "animate-spin")} />
                </Button>
                <Button
                  onClick={handleCreateDraft}
                  className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto"
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  {isCreating ? "Creating" : "Add new"}
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-muted/40 px-3 py-3 text-xs sm:text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{productTypeFilter === "sap" ? "Sap" : "Treacle"} overview</span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-status-progress" /> Active: {selectedMetrics.active}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-status-completed" /> Submitted: {selectedMetrics.submitted}
              </span>
              <span className="inline-flex items-center gap-1">
                Buckets: {formatNumericValue(selectedMetrics.bucketTotal)}
              </span>
              <span className="inline-flex items-center gap-1">
                Quantity: {formatNumericValue(selectedMetrics.quantityTotal)}
              </span>
            </div>
          </div>

          {isLoading && (
            <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
              Loading drafts…
            </div>
          )}

          {error && !isLoading && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive shadow-sm">
              {error}
            </div>
          )}

          {!isLoading && !error && drafts.length === 0 && (
            <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground text-center shadow-sm">
              No drafts yet. Create your first collection draft to get started.
            </div>
          )}

          {!isLoading && !error && drafts.length > 0 && (
            <div className="space-y-10">
              <section className="space-y-3">
                <h2 className="text-lg sm:text-xl font-semibold">Active drafts</h2>
                {activeDrafts.length === 0 ? (
                  <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                    No active drafts for {productTypeFilter === "sap" ? "sap" : "treacle"}.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeDrafts.map((draft) => {
                      const status = normalizeStatus(draft.status);
                      const badgeStatus = status === "submitted" || status === "completed" ? "completed" : "in-progress";
                      const badgeLabel = status === "submitted" ? "Submitted" : status === "completed" ? "Completed" : "Draft";
                      return (
                        <div
                          key={draft.draftId}
                          className="rounded-xl border bg-card p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground">
                                <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                                  {formatProductLabel(draft.productType)}
                                </Badge>
                                <span>Draft ID: {draft.draftId}</span>
                                <span>Collected on {formatDateLabel(draft.date)}</span>
                              </div>
                              <div className="space-y-1">
                                <h3 className="text-base sm:text-lg font-semibold text-foreground">
                                  Collection draft · {formatDateLabel(draft.date)}
                                </h3>
                                <div className="flex flex-wrap gap-3 text-xs sm:text-sm text-muted-foreground">
                                  <span>Buckets: {formatNumericValue(draft.bucketCount)}</span>
                                  <span>Total quantity: {formatNumericValue(draft.totalQuantity)}</span>
                                  {draft.createdByName && <span>Created by {draft.createdByName}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col sm:items-end gap-3">
                              <StatusBadge status={badgeStatus} label={badgeLabel} />
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/field-collection/draft/${draft.draftId}`)}
                                >
                                  Continue
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleSubmitDraft(draft.draftId)}
                                  disabled={submittingDraftId === draft.draftId}
                                  className="bg-cta hover:bg-cta-hover text-cta-foreground"
                                >
                                  {submittingDraftId === draft.draftId ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : null}
                                  Submit
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={deletingDraftId === draft.draftId}
                                    >
                                      {deletingDraftId === draft.draftId ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      )}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete draft?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This action will permanently remove the collection draft created on {formatDateLabel(draft.date)}.
                                        This cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteDraft(draft.draftId)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-lg sm:text-xl font-semibold">Submitted history</h2>
                {submittedDrafts.length === 0 ? (
                  <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                    No submitted drafts for {productTypeFilter === "sap" ? "sap" : "treacle"}.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {submittedDrafts.map((draft) => {
                      const status = normalizeStatus(draft.status);
                      const badgeStatus = status === "submitted" || status === "completed" ? "completed" : "in-progress";
                      const badgeLabel = status === "submitted" ? "Submitted" : status === "completed" ? "Completed" : "Draft";
                      return (
                        <div
                          key={draft.draftId}
                          className="rounded-xl border bg-muted/50 p-4 sm:p-6 shadow-sm"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground">
                                <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                                  {formatProductLabel(draft.productType)}
                                </Badge>
                                <span>Draft ID: {draft.draftId}</span>
                                <span>Collected on {formatDateLabel(draft.date)}</span>
                              </div>
                              <div className="flex flex-wrap gap-3 text-xs sm:text-sm text-muted-foreground">
                                <span>Buckets: {formatNumericValue(draft.bucketCount)}</span>
                                <span>Total quantity: {formatNumericValue(draft.totalQuantity)}</span>
                                {draft.createdByName && <span>Created by {draft.createdByName}</span>}
                              </div>
                            </div>
                            <div className="flex flex-col sm:items-end gap-3">
                              <StatusBadge status={badgeStatus} label={badgeLabel} />
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/field-collection/draft/${draft.draftId}`)}
                                >
                                  View
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleReopenDraft(draft.draftId)}
                                  disabled={reopeningDraftId === draft.draftId}
                                >
                                  {reopeningDraftId === draft.draftId ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : null}
                                  Reopen
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}