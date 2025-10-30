import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";

import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePersistentState } from "@/hooks/usePersistentState";
import { usePersistentTab } from "@/hooks/usePersistentTab";
import { DataService } from "@/lib/dataService";
import { toast } from "sonner";

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

type BucketListItem = {
  bucket_id: string;
  product_type: string;
  quantity: number;
  brix_value: number | null;
  ph_value: number | null;
  total_amount: number | null;
};

export default function CenterBuckets() {
  const navigate = useNavigate();
  const { draftId, centerId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const { user, logout } = useAuth();
  const userRole = user?.role || "Guest";
  const userName = user?.name || user?.userId || "User";
  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL || "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }, []);
  const userAvatar = user?.profileImage ? new URL(user.profileImage, apiBase).toString() : undefined;

  const [searchQuery, setSearchQuery] = usePersistentState<string>(
    `centerBuckets.search.${centerId ?? "all"}`,
    ""
  );
  const productTypeParam = searchParams.get("productType");
  const [activeTab, setActiveTab] = usePersistentTab(
    `tabs.centerBuckets.${centerId ?? "all"}`,
    "sap"
  );

  const [buckets, setBuckets] = useState<BucketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<string>("draft");
  const [draftDate, setDraftDate] = useState<string>("");

  // Update active tab when productType parameter changes
  useEffect(() => {
    if (productTypeParam && (productTypeParam === "sap" || productTypeParam === "treacle")) {
      setActiveTab(productTypeParam);
    }
  }, [productTypeParam, setActiveTab]);

  // Keep URL in sync when tab changes (so refresh preserves selection)
  useEffect(() => {
    const current = searchParams.get("productType");
    if (activeTab && (activeTab === "sap" || activeTab === "treacle") && current !== activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set("productType", activeTab);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Define the 4 collection centers mapping
  const collectionCenters = {
    "center001": { name: "Galle Collection Center", agent: "John Silva" },
    "center002": { name: "Kurunegala Collection Center", agent: "Mary Perera" }, 
    "center003": { name: "Hikkaduwa Collection Center", agent: "David Fernando" },
    "center004": { name: "Matara Collection Center", agent: "Sarah Jayawardena" }
  };

  const centerInfo = collectionCenters[centerId as keyof typeof collectionCenters] || { name: "Center", agent: "Unknown" };
  const centerName = centerInfo.name;

  // Load buckets and draft status from API
  const loadBuckets = useCallback(async () => {
    if (!draftId || !centerId || draftId === "new") {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [bucketsData, draftData] = await Promise.all([
        DataService.getBuckets(draftId, centerId),
        DataService.getDraft(draftId),
      ]);

      const normalizedBuckets = (Array.isArray(bucketsData) ? bucketsData : [])
        .map((bucket) => {
          if (!bucket || typeof bucket !== "object") {
            return null;
          }

          const record = bucket as Record<string, unknown>;
          const bucketId = typeof record.bucket_id === "string" ? record.bucket_id : null;
          const productType = typeof record.product_type === "string" ? record.product_type : null;

          if (!bucketId || !productType) {
            return null;
          }

          const quantityValue = Number(record.quantity ?? 0);

          return {
            bucket_id: bucketId,
            product_type: productType,
            quantity: Number.isFinite(quantityValue) ? quantityValue : 0,
            brix_value: typeof record.brix_value === "number" ? record.brix_value : null,
            ph_value: typeof record.ph_value === "number" ? record.ph_value : null,
            total_amount: typeof record.total_amount === "number" ? record.total_amount : null,
          } satisfies BucketListItem;
        })
        .filter((bucket): bucket is BucketListItem => bucket !== null);

      const draftRecord = draftData && typeof draftData === "object"
        ? (draftData as Record<string, unknown>)
        : null;

      const draftStatusValue = draftRecord && typeof draftRecord.status === "string" ? draftRecord.status : "draft";
      const draftDateValue = draftRecord && typeof draftRecord.date === "string" ? draftRecord.date : null;

      setBuckets(normalizedBuckets);
      setDraftStatus(draftStatusValue || "draft");
      setDraftDate(draftDateValue ? new Date(draftDateValue).toISOString().split("T")[0] : "");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load data";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [centerId, draftId]);

  useEffect(() => {
    loadBuckets();
  }, [loadBuckets]);

  // Refresh buckets when page becomes visible (e.g., after navigation back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadBuckets();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadBuckets]);

  const filteredBuckets = buckets.filter(
    (bucket) =>
      bucket.product_type === activeTab &&
      (bucket.bucket_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bucket.product_type.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleDeleteCan = async (bucketId: string) => {
    try {
      setLoading(true);
      await DataService.deleteBucket(bucketId);

      toast.success('Can deleted successfully');

      await loadBuckets();
    } catch (error: unknown) {
      console.error('Error deleting can:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete can';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

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
            <Link 
              to={`/field-collection/draft/${draftId}`}
              className="hover:text-orange-200"
            >
              Collection draft
            </Link>
            <span className="mx-2">&gt;</span>
            <span className="text-black font-semibold">{centerName} cans</span>
          </div>
        }
      />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">{centerName} - {draftStatus === "draft" ? "Cans List" : "View Cans"}</h1>
            <p className="text-sm text-muted-foreground">Draft: {draftDate}</p>
            <p className="text-sm text-muted-foreground">Center Agent: {centerInfo.agent}</p>
          </div>
        </div>
        
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val)} className="w-full">
          <TabsList className="mb-6 w-full sm:w-auto">
            <TabsTrigger value="sap" className="flex-1 sm:flex-none">Sap Collection</TabsTrigger>
            <TabsTrigger value="treacle" className="flex-1 sm:flex-none">Treacle Collection</TabsTrigger>
          </TabsList>
          
          <TabsContent value="sap" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <Input
                  placeholder="Search by Can ID or product..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-xs"
                />
              </div>
              {draftStatus === "draft" && (
                <Button
                  className="bg-cta hover:bg-cta-hover text-cta-foreground"
                  onClick={() => {
                    navigate(`/field-collection/bucket/new?productType=sap&draftId=${draftId}&centerId=${centerId}`);
                  }}
                >
                  Add Can
                </Button>
              )}
            </div>
            <div className="space-y-4">
              {loading ? (
                <div className="text-muted-foreground text-sm">Loading cans...</div>
              ) : error ? (
                <div className="text-destructive text-sm">Error: {error}</div>
              ) : filteredBuckets.length === 0 ? (
                <div className="text-muted-foreground text-sm">No cans found.</div>
              ) : (
                filteredBuckets.map((bucket) => (
                  <div key={bucket.bucket_id} className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-sm sm:text-base">Can ID: {bucket.bucket_id}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">Product: {bucket.product_type}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">Quantity: {bucket.quantity} L</p>
                        {bucket.brix_value !== null && (
                          <p className="text-xs sm:text-sm text-muted-foreground">Brix: {bucket.brix_value}</p>
                        )}
                        {bucket.ph_value !== null && (
                          <p className="text-xs sm:text-sm text-muted-foreground">pH: {bucket.ph_value}</p>
                        )}
                        {bucket.total_amount !== null && (
                          <p className="text-xs sm:text-sm text-muted-foreground">Amount: Rs. {bucket.total_amount}</p>
                        )}
                      </div>
                      {draftStatus === "draft" && (
                        <div className="flex items-center gap-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={loading}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete can?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action will permanently remove can {bucket.bucket_id}. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteCan(bucket.bucket_id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="treacle" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <Input
                  placeholder="Search by Can ID or product..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-xs"
                />
              </div>
              {draftStatus === "draft" && (
                <Button
                  className="bg-cta hover:bg-cta-hover text-cta-foreground"
                  onClick={() => {
                    navigate(`/field-collection/bucket/new?productType=treacle&draftId=${draftId}&centerId=${centerId}`);
                  }}
                >
                  Add Can
                </Button>
              )}
            </div>
            <div className="space-y-4">
              {loading ? (
                <div className="text-muted-foreground text-sm">Loading cans...</div>
              ) : error ? (
                <div className="text-destructive text-sm">Error: {error}</div>
              ) : filteredBuckets.length === 0 ? (
                <div className="text-muted-foreground text-sm">No cans found.</div>
              ) : (
                filteredBuckets.map((bucket) => (
                  <div key={bucket.bucket_id} className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-sm sm:text-base">Can ID: {bucket.bucket_id}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">Product: {bucket.product_type}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">Quantity: {bucket.quantity} L</p>
                        {bucket.brix_value && (
                          <p className="text-xs sm:text-sm text-muted-foreground">Brix: {bucket.brix_value}</p>
                        )}
                        {bucket.ph_value && (
                          <p className="text-xs sm:text-sm text-muted-foreground">pH: {bucket.ph_value}</p>
                        )}
                        {bucket.total_amount && (
                          <p className="text-xs sm:text-sm text-muted-foreground">Amount: Rs. {bucket.total_amount}</p>
                        )}
                      </div>
                      {draftStatus === "draft" && (
                        <div className="flex items-center gap-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={loading}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete can?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action will permanently remove can {bucket.bucket_id}. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteCan(bucket.bucket_id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}