import { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar.lazy";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "react-hot-toast";
import { DataService } from "@/lib/dataService";
import { PageContainer } from "@/components/layout/PageContainer";

type DraftDetailData = {
  cans?: Array<Record<string, unknown>>;
  status?: string | null;
  date?: string | null;
  canCount?: number;
  can_count?: number;
} & Record<string, unknown>;

const formatDraftDate = (value: string | null | undefined) => {
  if (!value) {
    return "—";
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleDateString();
};

// Field collection draft summary with navigation into center cans.
export default function DraftDetail() {
  const navigate = useNavigate();
  const { draftId } = useParams();
  const [searchParams] = useSearchParams();
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

  const [draft, setDraft] = useState<DraftDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedCenters, setCompletedCenters] = useState<Set<string>>(new Set());
  const [isReopening, setIsReopening] = useState(false);

  const centerCanCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const entries = Array.isArray(draft?.cans) ? draft.cans : [];

    entries.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }

      const data = entry as Record<string, unknown>;

      const centerIdCandidate =
        typeof data["centerId"] === "string"
          ? data["centerId"]
          : typeof data["collectionCenterId"] === "string"
            ? data["collectionCenterId"]
            : typeof data["center_id"] === "string"
              ? data["center_id"]
              : typeof data["collection_center_id"] === "string"
                ? data["collection_center_id"]
                : undefined;

      if (!centerIdCandidate) {
        return;
      }

      const cansValue = data["cans"];
      if (Array.isArray(cansValue)) {
        counts[centerIdCandidate] = cansValue.length;
        return;
      }

      counts[centerIdCandidate] = (counts[centerIdCandidate] ?? 0) + 1;
    });

    return counts;
  }, [draft?.cans]);

  useEffect(() => {
    const loadDraft = async () => {
      if (!draftId) {
        setError("No draft ID provided.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const fetchedDraft = await DataService.getDraft(draftId);
        setDraft(fetchedDraft);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load draft";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    loadDraft();
  }, [draftId]);

  // Load completed centers from backend
  useEffect(() => {
    const loadCompletedCenters = async () => {
      if (!draftId) return;

      try {
        const completedCentersData = await DataService.getCompletedCenters(draftId);
        const completedIds = (Array.isArray(completedCentersData) ? completedCentersData : [])
          .map((entry) => {
            if (!entry || typeof entry !== "object") {
              return null;
            }
            const record = entry as Record<string, unknown>;
            const id = record.center_id ?? record.centerId;
            return typeof id === "string" ? id : null;
          })
          .filter((id): id is string => id !== null);
        setCompletedCenters(new Set(completedIds));
      } catch (err: unknown) {
        console.error("Failed to load completed centers:", err);
        // Don't show error toast for this, just log it
      }
    };
    loadCompletedCenters();
  }, [draftId]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleSaveDraft = async () => {
    if (!draftId) return;
    // Require at least one submitted center before allowing save
    if (!completedCenters || completedCenters.size === 0) {
      toast.error("Submit at least one center before saving the draft");
      return;
    }

    try {
      setLoading(true);
      await DataService.updateDraft(draftId, "draft");

      toast.success("Draft saved successfully");

      navigate("/field-collection");
    } catch (error: unknown) {
      console.error("Error saving draft:", error);
      const message = error instanceof Error ? error.message : "Failed to save draft";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCenter = async (centerId: string) => {
    try {
      setLoading(true);

      // Call API to submit center
      await DataService.submitCenter(draftId!, centerId);

      // Add center to completed set
      setCompletedCenters((prev) => new Set([...prev, centerId]));

      toast.success("Center submitted successfully");
    } catch (error: unknown) {
      console.error("Error submitting center:", error);
      const message = error instanceof Error ? error.message : "Failed to submit center";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReopenCenter = async (centerId: string) => {
    try {
      setLoading(true);

      // Call API to reopen center
      await DataService.reopenCenter(draftId!, centerId);

      // Remove center from completed set
      setCompletedCenters((prev) => {
        const newSet = new Set(prev);
        newSet.delete(centerId);
        return newSet;
      });

      toast.success("Center reopened successfully");
    } catch (error: unknown) {
      console.error("Error reopening center:", error);
      const message = error instanceof Error ? error.message : "Failed to reopen center";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReopenDraft = async () => {
    if (!draftId) {
      toast.error("Missing draft identifier.");
      return;
    }

    setIsReopening(true);
    try {
      await DataService.reopenDraft(draftId);
      toast.success("Draft reopened successfully");
      navigate("/field-collection");
    } catch (err) {
      console.error("Failed to reopen draft", err);
      toast.error("Unable to reopen draft. Please try again.");
    } finally {
      setIsReopening(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar
          userRole={userRole}
          userName={userName}
          userAvatar={userAvatar}
          onLogout={handleLogout}
        />
        <PageContainer className="py-10">
          <p className="text-sm text-muted-foreground">Loading draft...</p>
        </PageContainer>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar
          userRole={userRole}
          userName={userName}
          userAvatar={userAvatar}
          onLogout={handleLogout}
        />
        <PageContainer className="py-10">
          <p className="text-sm text-destructive">Error: {error}</p>
        </PageContainer>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar
          userRole={userRole}
          userName={userName}
          userAvatar={userAvatar}
          onLogout={handleLogout}
        />
        <PageContainer className="py-10">
          <p className="text-sm text-muted-foreground">Draft not found.</p>
        </PageContainer>
      </div>
    );
  }

  // Define the 4 collection centers
  const collectionCenters = [
    {
      id: "center001",
      name: "Galle Collection Center",
      location: "Galle, Southern Province",
      centerAgent: "John Silva",
      phone: "+94-91-2345678",
    },
    {
      id: "center002",
      name: "Kurunegala Collection Center",
      location: "Kurunegala, North Western Province",
      centerAgent: "Mary Perera",
      phone: "+94-37-2345678",
    },
    {
      id: "center003",
      name: "Hikkaduwa Collection Center",
      location: "Hikkaduwa, Southern Province",
      centerAgent: "David Fernando",
      phone: "+94-91-3456789",
    },
    {
      id: "center004",
      name: "Matara Collection Center",
      location: "Matara, Southern Province",
      centerAgent: "Sarah Jayawardena",
      phone: "+94-41-2345678",
    },
  ];

  const activeCenters = collectionCenters.filter((center) => !completedCenters.has(center.id));
  const completedCenterList = collectionCenters.filter((center) => completedCenters.has(center.id));
  const totalCenters = collectionCenters.length;
  const completedCount = completedCenterList.length;
  const activeCount = totalCenters - completedCount;
  const totalCans = draft.canCount ?? draft.can_count ?? 0;
  const normalizedStatus = (draft.status ?? "").toLowerCase();
  const isDraftStatus = normalizedStatus === "draft";
  const isSubmittedStatus = normalizedStatus === "submitted" || normalizedStatus === "completed";
  const draftDateLabel = formatDraftDate(draft.date);
  const statusDisplay = (() => {
    switch (normalizedStatus) {
      case "submitted":
      case "completed":
        return { label: "Submitted", className: "bg-emerald-100 text-emerald-800" };
      case "draft":
      default:
        return { label: "In progress", className: "bg-amber-100 text-amber-800" };
    }
  })();

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        userRole={userRole}
        userName={userName}
        userAvatar={userAvatar}
        onLogout={handleLogout}
        breadcrumb={
          <div className="flex items-center space-x-2 text-sm text-white">
            <Link to={`/field-collection`} className="hover:text-orange-200">
              Field Collection
            </Link>
            <span className="mx-2">&gt;</span>
            <span className="text-black font-semibold">Collection draft</span>
          </div>
        }
      />

      <PageContainer as="main" className="py-6 sm:py-8 space-y-6">
        <section className="rounded-2xl border bg-card/95 p-4 sm:p-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Draft date</p>
              <h1 className="text-2xl font-semibold text-foreground">
                Field collection draft · {draftDateLabel}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground/80">
                <span>Total cans: {totalCans}</span>
                <span className="text-muted-foreground/40">|</span>
                <span>Total centers: {totalCenters}</span>
                <span className="text-muted-foreground/40">|</span>
                <span>Completed centers: {completedCount}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end w-full sm:w-auto">
              <Badge
                className={`w-fit border-0 px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusDisplay.className}`}
              >
                {statusDisplay.label}
              </Badge>
              {isDraftStatus ? (
                <Button
                  className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto"
                  onClick={handleSaveDraft}
                  disabled={loading || completedCenters.size === 0}
                >
                  Save draft
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => navigate("/field-collection")}
                  className="w-full sm:w-auto"
                >
                  Back to Field Collection
                </Button>
              )}
            </div>
          </div>
          <dl className="mt-6 grid grid-cols-1 gap-4 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border bg-white/60 p-4 shadow-sm dark:bg-muted/30">
              <dt className="text-xs font-medium uppercase tracking-wide">Total centers</dt>
              <dd className="mt-2 text-2xl font-semibold text-foreground">{totalCenters}</dd>
            </div>
            <div className="rounded-xl border bg-white/60 p-4 shadow-sm dark:bg-muted/30">
              <dt className="text-xs font-medium uppercase tracking-wide">Completed</dt>
              <dd className="mt-2 text-2xl font-semibold text-foreground">{completedCount}</dd>
            </div>
            <div className="rounded-xl border bg-white/60 p-4 shadow-sm dark:bg-muted/30">
              <dt className="text-xs font-medium uppercase tracking-wide">Remaining</dt>
              <dd className="mt-2 text-2xl font-semibold text-foreground">{activeCount}</dd>
            </div>
            <div className="rounded-xl border bg-white/60 p-4 shadow-sm dark:bg-muted/30">
              <dt className="text-xs font-medium uppercase tracking-wide">Status</dt>
              <dd className="mt-2 text-lg font-semibold text-foreground">{statusDisplay.label}</dd>
            </div>
          </dl>
        </section>

        <div className="space-y-6">
          {isDraftStatus && (
            <section className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold">Active centers</h2>
                  <p className="text-sm text-muted-foreground">
                    Finish reviews and submit completed centers.
                  </p>
                </div>
                <span className="text-sm font-medium text-muted-foreground">{activeCount} remaining</span>
              </div>
              {activeCenters.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                  All centers have been submitted.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {activeCenters.map((center) => {
                    const canCount = centerCanCounts[center.id] ?? 0;
                    return (
                      <div
                        key={center.id}
                        className="rounded-xl border bg-card/95 p-4 sm:p-6 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1 text-sm">
                            <h3 className="font-semibold text-foreground">{center.name}</h3>
                            <p className="text-muted-foreground">{center.location}</p>
                            <p className="text-muted-foreground">Center Agent: {center.centerAgent}</p>
                            <p className="text-muted-foreground">Active cans: {canCount}</p>
                          </div>
                          <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                navigate(
                                  `/field-collection/draft/${draftId}/center/${encodeURIComponent(center.id)}`,
                                );
                              }}
                              className="w-full sm:w-auto"
                            >
                              Continue
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleSubmitCenter(center.id)}
                              disabled={loading}
                              className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto"
                            >
                              Submit
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          <section className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold">Completed centers</h2>
                <p className="text-sm text-muted-foreground">
                  {isDraftStatus
                    ? "Review submitted centers or reopen to make edits."
                    : "Submitted centers are view-only."}
                </p>
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {completedCount}/{totalCenters} completed
              </span>
            </div>
            {completedCenterList.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                No completed centers yet.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {completedCenterList.map((center) => {
                  const canCount = centerCanCounts[center.id] ?? 0;
                  return (
                    <div
                      key={`completed-${center.id}`}
                      className="rounded-xl border bg-card/95 p-4 sm:p-6 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1 text-sm">
                          <h3 className="font-semibold text-foreground">{center.name}</h3>
                          <p className="text-muted-foreground">{center.location}</p>
                          <p className="text-muted-foreground">Center Agent: {center.centerAgent}</p>
                          <p className="text-muted-foreground">Completed cans: {canCount}</p>
                        </div>
                        <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigate(
                                `/field-collection/draft/${draftId}/center/${encodeURIComponent(center.id)}`,
                              );
                            }}
                            className="w-full sm:w-auto"
                          >
                            View
                          </Button>
                          {isDraftStatus && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReopenCenter(center.id)}
                              disabled={loading}
                              className="w-full sm:w-auto"
                            >
                              Reopen
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {isSubmittedStatus && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-4 text-sm text-amber-900">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p>Submitted drafts are read-only. Reopen the draft to make adjustments.</p>
                <Button
                  onClick={handleReopenDraft}
                  disabled={isReopening}
                  className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto"
                >
                  {isReopening ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reopening…
                    </>
                  ) : (
                    "Reopen Draft"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </PageContainer>
    </div>
  );
}
