import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { FileText, Loader2, Plus, RefreshCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import DataService from "@/lib/dataService";
import { ReportGenerationDialog } from "@/components/ReportGenerationDialog";

type DraftStatus = "draft" | "submitted" | "completed" | string;

type DraftSummary = {
  id: string;
  draftId: string;
  date: string | null;
  status: DraftStatus;
  bucketCount: number;
  totalQuantity: number;
  createdByName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const normalizeStatus = (status: DraftStatus) =>
  typeof status === "string" ? status.trim().toLowerCase() : "draft";

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

const formatNumeric = (value: number) => {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const hasFraction = !Number.isInteger(value);
  return value.toLocaleString(undefined, {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  });
};

const toIdString = (value: unknown) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const toOptionalString = (value: unknown) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

const toFiniteNumber = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pushToken = (tokens: string[], value: unknown) => {
  if (value === null || value === undefined) {
    return;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0 && trimmed !== "—") {
      tokens.push(trimmed.toLowerCase());
    }
    return;
  }

  if (typeof value === "number") {
    tokens.push(String(value));
    return;
  }

  if (value instanceof Date) {
    pushToken(tokens, value.toISOString());
    pushToken(tokens, value.toLocaleDateString());
  }
};

const createSearchTokens = (draft: DraftSummary): string[] => {
  const tokens: string[] = [];
  pushToken(tokens, draft.id);
  pushToken(tokens, draft.draftId);
  pushToken(tokens, draft.status);
  pushToken(tokens, normalizeStatus(draft.status));
  pushToken(tokens, draft.createdByName);
  pushToken(tokens, draft.date);
  if (draft.date) {
    pushToken(tokens, new Date(draft.date));
    pushToken(tokens, formatDateLabel(draft.date));
  }
  pushToken(tokens, draft.createdAt);
  pushToken(tokens, draft.updatedAt);
  pushToken(tokens, draft.bucketCount);
  pushToken(tokens, formatNumeric(draft.bucketCount));
  pushToken(tokens, draft.totalQuantity);
  pushToken(tokens, formatNumeric(draft.totalQuantity));
  return tokens;
};

const normalizeDraftRecord = (input: unknown): DraftSummary | null => {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const draftId = toIdString(record.draft_id) ?? toIdString(record.draftId);
  if (!draftId) {
    return null;
  }

  const id = toIdString(record.id) ?? draftId;
  const statusValue = toOptionalString(record.status) ?? "draft";

  return {
    id,
    draftId,
    date: toOptionalString(record.date),
    status: normalizeStatus(statusValue) as DraftStatus,
    bucketCount: toFiniteNumber(record.bucket_count ?? record.bucketCount),
    totalQuantity: toFiniteNumber(record.total_quantity ?? record.totalQuantity),
    createdByName: toOptionalString(record.created_by_name) ?? toOptionalString(record.createdByName),
    createdAt: toOptionalString(record.created_at) ?? toOptionalString(record.createdAt),
    updatedAt: toOptionalString(record.updated_at) ?? toOptionalString(record.updatedAt),
  } satisfies DraftSummary;
};

const extractDraftId = (input: unknown): string | null => {
  if (!input || typeof input !== "object") {
    return null;
  }
  const record = input as Record<string, unknown>;
  return toIdString(record.draft_id) ?? toIdString(record.draftId);
};

export default function FieldCollection() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const userRole = user?.role || "Guest";
  const userName = user?.name || user?.userId || "User";
  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL || "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }, []);
  const userAvatar = user?.profileImage
    ? new URL(user.profileImage, apiBase).toString()
    : undefined;

  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submittingDraftId, setSubmittingDraftId] = useState<string | null>(
    null,
  );
  const [reopeningDraftId, setReopeningDraftId] = useState<string | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

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
      const normalized = (Array.isArray(data) ? data : [])
        .map((item) => normalizeDraftRecord(item))
        .filter((draft): draft is DraftSummary => draft !== null);
      setDrafts(normalized);
    } catch (err: unknown) {
      console.error("Failed to load drafts", err);
      const message = err instanceof Error ? err.message : "Failed to load drafts";
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
      const created = await DataService.createDraft(currentDate);
      const newDraftId = extractDraftId(created);
      if (!newDraftId) {
        throw new Error("Draft created but response did not include an identifier.");
      }
      toast.success("Collection draft created successfully");
      await loadDrafts({ suppressLoader: true });
      navigate(`/field-collection/draft/${newDraftId}`);
    } catch (err: unknown) {
      console.error("Error creating draft", err);
      const message = err instanceof Error && err.message.trim().length > 0
        ? err.message
        : "Failed to create draft";
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSubmitDraft = async (draftId: string) => {
    setSubmittingDraftId(draftId);
    try {
      const [centersData, completedData] = await Promise.all([
        DataService.getCollectionCenters(),
        DataService.getCompletedCenters(draftId),
      ]);

      const centers = (Array.isArray(centersData) ? centersData : []).map((item) => {
        if (!item || typeof item !== "object") {
          return { id: null as string | null, name: undefined as string | undefined };
        }

        const record = item as Record<string, unknown>;
        const rawId =
          typeof record.center_id === "string"
            ? record.center_id
            : typeof record.centerId === "string"
              ? record.centerId
              : typeof record.id === "string"
                ? record.id
                : typeof record.id === "number"
                  ? String(record.id)
                  : null;

        const nameCandidate =
          typeof record.center_name === "string"
            ? record.center_name
            : typeof record.centerName === "string"
              ? record.centerName
              : undefined;

        return {
          id: rawId && rawId.trim().length > 0 ? rawId.trim() : null,
          name: nameCandidate,
        };
      }).filter((center): center is { id: string; name: string | undefined } =>
        typeof center.id === "string" && center.id.length > 0
      );

      const completedIds = new Set(
        (Array.isArray(completedData) ? completedData : [])
          .map((entry) => {
            if (!entry || typeof entry !== "object") {
              return null;
            }

            const record = entry as Record<string, unknown>;
            const rawId =
              typeof record.center_id === "string"
                ? record.center_id
                : typeof record.centerId === "string"
                  ? record.centerId
                  : null;

            return rawId && rawId.trim().length > 0 ? rawId.trim() : null;
          })
          .filter((id): id is string => id !== null),
      );

      const pendingCenters = centers.filter((center) => !completedIds.has(center.id));

      if (pendingCenters.length > 0) {
        const pendingLabel = pendingCenters
          .map((center) => center.name ?? center.id)
          .join(", ");
        toast.error(
          pendingLabel
            ? `Submit the following centers before submitting the draft: ${pendingLabel}`
            : "Submit all centers before submitting the draft",
        );
        return;
      }

      await DataService.submitDraft(draftId);
      toast.success("Draft submitted successfully");
      await loadDrafts({ suppressLoader: true });
    } catch (err) {
      console.error("Error submitting draft", err);
      const message = err instanceof Error && err.message.trim().length > 0
        ? err.message
        : "Failed to submit draft";
      toast.error(message);
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

  const filteredDrafts = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) {
      return drafts;
    }
    return drafts.filter((draft) => {
      const tokens = createSearchTokens(draft);
      return tokens.some((token) => token.includes(term));
    });
  }, [drafts, searchQuery]);

  const activeDrafts = filteredDrafts.filter(
    (draft) => normalizeStatus(draft.status) === "draft",
  );
  const submittedDrafts = filteredDrafts.filter((draft) =>
    ["submitted", "completed"].includes(normalizeStatus(draft.status)),
  );

  const stats = useMemo(() => {
    const totals = {
      total: drafts.length,
      active: 0,
      submitted: 0,
    };

    drafts.forEach((draft) => {
      const status = normalizeStatus(draft.status);
      if (status === "draft") {
        totals.active += 1;
      } else {
        totals.submitted += 1;
      }
    });

    return totals;
  }, [drafts]);

  const hasSubmittedDrafts = useMemo(
    () => drafts.some((draft) => {
      const status = normalizeStatus(draft.status);
      return status === "submitted" || status === "completed";
    }),
    [drafts],
  );

  const handleOpenReportDialog = () => {
    if (!hasSubmittedDrafts) {
      toast.error("Submit a draft before generating a report.");
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

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
              Field Collection Drafts
            </h1>
            <p className="text-sm text-muted-foreground">
              Field collectors create a single daily draft and record bucket
              details per center from there.
            </p>
          </div>

          <div className="rounded-2xl border bg-card/95 p-4 sm:p-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 w-full">
              <Button
                onClick={handleCreateDraft}
                disabled={isCreating}
                className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                {isCreating ? "Creating" : "Add new"}
              </Button>

              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search drafts"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="pl-10"
                />
              </div>

              <Button
                variant="secondary"
                onClick={handleOpenReportDialog}
                className="w-full sm:w-auto"
              >
                <FileText className="h-4 w-4 mr-2" /> Generate report
              </Button>

              <Button
                variant="outline"
                onClick={handleRefresh}
                className="w-full sm:w-auto"
                disabled={isLoading || isRefreshing}
              >
                <RefreshCcw
                  className={
                    isLoading || isRefreshing
                      ? "h-4 w-4 animate-spin"
                      : "h-4 w-4"
                  }
                />
              </Button>

              <Badge variant="secondary" className="sm:ml-auto">
                {formatNumeric(stats.total)} total
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border bg-card p-4 text-sm">
              <p className="text-muted-foreground">All drafts</p>
              <p className="text-lg font-semibold text-foreground">
                {formatNumeric(stats.total)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4 text-sm">
              <p className="text-muted-foreground">Active drafts</p>
              <p className="text-lg font-semibold text-foreground">
                {formatNumeric(stats.active)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4 text-sm">
              <p className="text-muted-foreground">Submitted drafts</p>
              <p className="text-lg font-semibold text-foreground">
                {formatNumeric(stats.submitted)}
              </p>
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
              No drafts yet. Create your first field collection draft to get started.
            </div>
          )}

          {!isLoading && !error && drafts.length > 0 && (
            <div className="space-y-10">
              {filteredDrafts.length === 0 ? (
                <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground text-center shadow-sm">
                  No drafts match the current search.
                </div>
              ) : (
                <>
                  <section className="space-y-3">
                    <h2 className="text-lg sm:text-xl font-semibold">Active drafts</h2>
                    {activeDrafts.length === 0 ? (
                      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                        No active drafts right now.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {activeDrafts.map((draft) => (
                          <div
                            key={draft.draftId}
                            className="rounded-xl border bg-card p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground">
                                  <span>Draft ID: {draft.id}</span>
                                  <span>Collected on {formatDateLabel(draft.date)}</span>
                                </div>
                                <div className="flex flex-wrap gap-3 text-xs sm:text-sm text-muted-foreground">
                                  <span>Buckets: {formatNumeric(draft.bucketCount)}</span>
                                  <span>Total quantity: {formatNumeric(draft.totalQuantity)}</span>
                                  {draft.createdByName && (
                                    <span>Created by {draft.createdByName}</span>
                                  )}
                                </div>
                              </div>
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
                                    <Loader2 className="h-4 w-4 animate-spin" />
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
                                        Deleting this draft will remove all field collection data captured for {formatDateLabel(draft.date)}.
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
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="space-y-3">
                    <h2 className="text-lg sm:text-xl font-semibold">Submitted history</h2>
                    {submittedDrafts.length === 0 ? (
                      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                        No submitted drafts yet.
                        </div>
                    ) : (
                      <div className="space-y-4">
                        {submittedDrafts.map((draft) => (
                          <div
                            key={draft.draftId}
                            className="rounded-xl border bg-muted/50 p-4 sm:p-6 shadow-sm"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground">
                                  <span>Draft ID: {draft.id}</span>
                                  <span>Collected on {formatDateLabel(draft.date)}</span>
                                  <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">
                                    {normalizeStatus(draft.status) === "completed" ? "Completed" : "Submitted"}
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap gap-3 text-xs sm:text-sm text-muted-foreground">
                                  <span>Buckets: {formatNumeric(draft.bucketCount)}</span>
                                  <span>Total quantity: {formatNumeric(draft.totalQuantity)}</span>
                                  {draft.createdByName && (
                                    <span>Created by {draft.createdByName}</span>
                                  )}
                                </div>
                              </div>
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
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : null}
                                  Reopen
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          )}
        </div>
      </div>
  <ReportGenerationDialog stage="field" open={reportDialogOpen} onOpenChange={setReportDialogOpen} />
    </div>
  );
}