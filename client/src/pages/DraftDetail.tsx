import { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { DataService } from "@/lib/dataService";

type DraftDetailData = {
  buckets?: Array<Record<string, unknown>>;
  status?: string | null;
  date?: string | null;
  bucketCount?: number;
  bucket_count?: number;
} & Record<string, unknown>;

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
  const userAvatar = user?.profileImage ? new URL(user.profileImage, apiBase).toString() : undefined;

  const [draft, setDraft] = useState<DraftDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedCenters, setCompletedCenters] = useState<Set<string>>(new Set());

  const centerBucketCounts = useMemo(() => {
    const counts: Record<string, number> = {};
  const entries = Array.isArray(draft?.buckets) ? draft.buckets : [];

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

      const bucketsValue = data["buckets"];
      if (Array.isArray(bucketsValue)) {
        counts[centerIdCandidate] = bucketsValue.length;
        return;
      }

      counts[centerIdCandidate] = (counts[centerIdCandidate] ?? 0) + 1;
    });

    return counts;
  }, [draft?.buckets]);

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
        const message = err instanceof Error ? err.message : 'Failed to load draft';
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
        console.error('Failed to load completed centers:', err);
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
      toast.error('Submit at least one center before saving the draft');
      return;
    }
    
    try {
      setLoading(true);
      await DataService.updateDraft(draftId, "draft");

      toast.success('Draft saved successfully');

      navigate('/field-collection');
      
    } catch (error: unknown) {
      console.error('Error saving draft:', error);
      const message = error instanceof Error ? error.message : 'Failed to save draft';
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
      setCompletedCenters(prev => new Set([...prev, centerId]));
      
      toast.success('Center submitted successfully');
      
    } catch (error: unknown) {
      console.error('Error submitting center:', error);
      const message = error instanceof Error ? error.message : 'Failed to submit center';
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
      setCompletedCenters(prev => {
        const newSet = new Set(prev);
        newSet.delete(centerId);
        return newSet;
      });
      
      toast.success('Center reopened successfully');
      
    } catch (error: unknown) {
      console.error('Error reopening center:', error);
      const message = error instanceof Error ? error.message : 'Failed to reopen center';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar userRole={userRole} userName={userName} userAvatar={userAvatar} onLogout={handleLogout} />
        <div className="container mx-auto px-4 sm:px-6 py-10">
          <p className="text-sm text-muted-foreground">Loading draft...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar userRole={userRole} userName={userName} userAvatar={userAvatar} onLogout={handleLogout} />
        <div className="container mx-auto px-4 sm:px-6 py-10">
          <p className="text-sm text-destructive">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar userRole={userRole} userName={userName} userAvatar={userAvatar} onLogout={handleLogout} />
        <div className="container mx-auto px-4 sm:px-6 py-10">
          <p className="text-sm text-muted-foreground">Draft not found.</p>
        </div>
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
      phone: "+94-91-2345678"
    },
    {
      id: "center002", 
      name: "Kurunegala Collection Center",
      location: "Kurunegala, North Western Province",
      centerAgent: "Mary Perera",
      phone: "+94-37-2345678"
    },
    {
      id: "center003",
      name: "Hikkaduwa Collection Center", 
      location: "Hikkaduwa, Southern Province",
      centerAgent: "David Fernando",
      phone: "+94-91-3456789"
    },
    {
      id: "center004",
      name: "Matara Collection Center",
      location: "Matara, Southern Province", 
      centerAgent: "Sarah Jayawardena",
      phone: "+94-41-2345678"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        userRole={userRole} 
        userName={userName} 
        userAvatar={userAvatar} 
        onLogout={handleLogout}
        breadcrumb={
          <div className="flex items-center space-x-2 text-sm text-white">
            <Link 
              to={`/field-collection`}
              className="hover:text-orange-200"
            >
              Field Collection
            </Link>
            <span className="mx-2">&gt;</span>
            <span className="text-black font-semibold">Collection draft</span>
          </div>
        }
      />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">Draft {new Date(draft.date).toISOString().split('T')[0]}</h1>
            <p className="text-sm text-muted-foreground">Buckets: {draft.bucketCount ?? draft.bucket_count ?? 0}</p>
          </div>
          {draft.status === "draft" && (
            <div className="flex gap-2">
              <Button
                className="bg-cta hover:bg-cta-hover text-cta-foreground"
                onClick={handleSaveDraft}
                disabled={loading || completedCenters.size === 0}
              >
                Save draft
              </Button>
            </div>
          )}
        </div>

  <div className="space-y-6">
          {/* Always show both Active and Completed Centers for draft status */}
          {draft.status === "draft" && (
            <>
              {/* Active Centers */}
              <div>
                <h2 className="text-lg sm:text-xl font-semibold mb-4">Active Centers</h2>
                <div className="space-y-4">
                  {collectionCenters
                    .filter(center => !completedCenters.has(center.id))
                    .map((center) => {
                      // Find if this center has any buckets
                      const bucketCount = centerBucketCounts[center.id] ?? 0;
                      
                      return (
                        <div key={center.id} className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="space-y-1">
                              <h3 className="font-semibold text-sm sm:text-base">{center.name}</h3>
                              <p className="text-xs sm:text-sm text-muted-foreground">{center.location}</p>
                              <p className="text-xs sm:text-sm text-muted-foreground">Center Agent: {center.centerAgent}</p>
                              <p className="text-xs sm:text-sm text-muted-foreground">Active buckets: {bucketCount}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  navigate(`/field-collection/draft/${draftId}/center/${encodeURIComponent(center.id)}`);
                                }}
                                className="flex-1 sm:flex-none"
                              >
                                Continue
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSubmitCenter(center.id)}
                                disabled={loading}
                                className="bg-cta hover:bg-cta-hover text-cta-foreground flex-1 sm:flex-none"
                              >
                                Submit
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Completed Centers */}
              <div className="pt-8 border-t">
                <h2 className="text-lg sm:text-xl font-semibold mb-4">Completed Centers</h2>
                <div className="space-y-4">
                  {collectionCenters
                    .filter(center => completedCenters.has(center.id))
                    .map((center) => {
                      // Find if this center has any buckets
                      const bucketCount = centerBucketCounts[center.id] ?? 0;
                      
                      return (
                        <div key={`completed-${center.id}`} className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="space-y-1">
                              <h3 className="font-semibold text-sm sm:text-base">{center.name}</h3>
                              <p className="text-xs sm:text-sm text-muted-foreground">{center.location}</p>
                              <p className="text-xs sm:text-sm text-muted-foreground">Center Agent: {center.centerAgent}</p>
                              <p className="text-xs sm:text-sm text-muted-foreground">Completed buckets: {bucketCount}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  navigate(`/field-collection/draft/${draftId}/center/${encodeURIComponent(center.id)}`);
                                }}
                                className="flex-1 sm:flex-none"
                              >
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReopenCenter(center.id)}
                                disabled={loading}
                                className="flex-1 sm:flex-none"
                              >
                                Reopen
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {collectionCenters.filter(center => completedCenters.has(center.id)).length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No completed centers yet
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Show only Completed Centers for submitted drafts */}
          {draft.status === "submitted" && (
            <div>
              <h2 className="text-lg sm:text-xl font-semibold mb-4">Completed Centers</h2>
              <div className="space-y-4">
                {collectionCenters
                  .filter(center => completedCenters.has(center.id))
                  .map((center) => {
                    // Find if this center has any buckets
                    const bucketCount = centerBucketCounts[center.id] ?? 0;
                    
                    return (
                      <div key={center.id} className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="space-y-1">
                            <h3 className="font-semibold text-sm sm:text-base">{center.name}</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground">{center.location}</p>
                            <p className="text-xs sm:text-sm text-muted-foreground">Center Agent: {center.centerAgent}</p>
                            <p className="text-xs sm:text-sm text-muted-foreground">Completed buckets: {bucketCount}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                navigate(`/field-collection/draft/${draftId}/center/${encodeURIComponent(center.id)}`);
                              }}
                              className="flex-1 sm:flex-none"
                            >
                              View
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {collectionCenters.filter(center => completedCenters.has(center.id)).length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No completed centers yet
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
