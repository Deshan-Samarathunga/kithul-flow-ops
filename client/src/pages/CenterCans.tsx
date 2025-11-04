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

type CanListItem = {
  can_id: string;
  product_type: string;
  quantity: number;
  brix_value: number | null;
  ph_value: number | null;
  total_amount: number | null;
};

export default function CenterCans() {
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
  const userAvatar = user?.profileImage
    ? new URL(user.profileImage, apiBase).toString()
    : undefined;

  const [searchQuery, setSearchQuery] = usePersistentState<string>(
    `centerCans.search.${centerId ?? "all"}`,
    "",
  );
  const productTypeParam = searchParams.get("productType");
  const [activeTab, setActiveTab] = usePersistentTab(`tabs.centerCans.${centerId ?? "all"}`, "sap");

  const [cans, setCans] = useState<CanListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<string | null>(null);
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
    center001: { name: "Galle Collection Center", agent: "John Silva" },
    center002: { name: "Kurunegala Collection Center", agent: "Mary Perera" },
    center003: { name: "Hikkaduwa Collection Center", agent: "David Fernando" },
    center004: { name: "Matara Collection Center", agent: "Sarah Jayawardena" },
  };

  const centerInfo = collectionCenters[centerId as keyof typeof collectionCenters] || {
    name: "Center",
    agent: "Unknown",
  };
  const centerName = centerInfo.name;

  // Load cans and draft status from API
  const loadCans = useCallback(async () => {
    if (!draftId || !centerId || draftId === "new") {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [cansData, draftData] = await Promise.all([
        DataService.getCans(draftId, centerId),
        DataService.getDraft(draftId),
      ]);

      const normalizedCans = (Array.isArray(cansData) ? cansData : [])
        .map((can) => {
          if (!can || typeof can !== "object") {
            return null;
          }

          const record = can as Record<string, unknown>;
          const canId = typeof record.can_id === "string" ? record.can_id : null;
          const productType = typeof record.product_type === "string" ? record.product_type : null;

          if (!canId || !productType) {
            return null;
          }

          const quantityValue = Number(record.quantity ?? 0);

          return {
            can_id: canId,
            product_type: productType,
            quantity: Number.isFinite(quantityValue) ? quantityValue : 0,
            brix_value: typeof record.brix_value === "number" ? record.brix_value : null,
            ph_value: typeof record.ph_value === "number" ? record.ph_value : null,
            total_amount: typeof record.total_amount === "number" ? record.total_amount : null,
          } satisfies CanListItem;
        })
        .filter((can): can is CanListItem => can !== null);

      const draftRecord =
        draftData && typeof draftData === "object" ? (draftData as Record<string, unknown>) : null;

      const draftStatusValue =
        draftRecord && typeof draftRecord.status === "string"
          ? draftRecord.status.toLowerCase()
          : null;
      const draftDateValue =
        draftRecord && typeof draftRecord.date === "string" ? draftRecord.date : null;

      setCans(normalizedCans);
      // Only set status if we have a valid value, otherwise keep it null
      if (draftStatusValue) {
        console.log("[CenterCans] Setting draftStatus to:", draftStatusValue);
        setDraftStatus(draftStatusValue);
      } else {
        console.log("[CenterCans] No draftStatus found, setting to null");
        setDraftStatus(null);
      }
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
    loadCans();
  }, [loadCans]);

  // Refresh cans when page becomes visible (e.g., after navigation back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadCans();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [loadCans]);

  const filteredCans = cans.filter(
    (can) =>
      can.product_type === activeTab &&
      (can.can_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        can.product_type.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleDeleteCan = async (canId: string) => {
    try {
      setLoading(true);
      await DataService.deleteCan(canId);

      toast.success("Can deleted successfully");

      await loadCans();
    } catch (error: unknown) {
      console.error("Error deleting can:", error);
      const message = error instanceof Error ? error.message : "Failed to delete can";
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
            <Link to={`/field-collection`} className="hover:text-orange-200">
              Field Collection
            </Link>
            <span className="mx-2">&gt;</span>
            <Link to={`/field-collection/draft/${draftId}`} className="hover:text-orange-200">
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
            <h1 className="text-xl sm:text-2xl font-semibold">
              {centerName} - {!loading && draftStatus === "draft" ? "Cans List" : "View Cans"}
            </h1>
            <p className="text-sm text-muted-foreground">Draft: {draftDate}</p>
            <p className="text-sm text-muted-foreground">Center Agent: {centerInfo.agent}</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val)} className="w-full">
          <TabsList className="mb-6 w-full sm:w-auto">
            <TabsTrigger value="sap" className="flex-1 sm:flex-none">
              Sap Collection
            </TabsTrigger>
            <TabsTrigger value="treacle" className="flex-1 sm:flex-none">
              Treacle Collection
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sap" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3 flex-1 w-full">
                <Input
                  placeholder="Search Cans"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 w-full"
                />
              </div>
              {!loading && draftStatus === "draft" ? (
                <Button
                  className="bg-cta hover:bg-cta-hover text-cta-foreground"
                  onClick={() => {
                    navigate(
                      `/field-collection/can/new?productType=sap&draftId=${draftId}&centerId=${centerId}`,
                    );
                  }}
                >
                  Add New
                </Button>
              ) : null}
            </div>
            <div className="space-y-4">
              {loading ? (
                <div className="text-muted-foreground text-sm text-center py-4">
                  Loading cans...
                </div>
              ) : error ? (
                <div className="text-destructive text-sm text-center py-4">Error: {error}</div>
              ) : filteredCans.length === 0 ? (
                <div className="text-muted-foreground text-sm text-center py-4">No cans found.</div>
              ) : (
                filteredCans.map((can) => (
                  <div
                    key={can.can_id}
                    className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-4 text-sm">
                        <span>
                          Can ID:{" "}
                          <span className="font-semibold text-foreground">{can.can_id}</span>
                        </span>
                        <span className="px-2 text-muted-foreground/40">|</span>
                        <span>Product: {can.product_type}</span>
                        <span className="px-2 text-muted-foreground/40">|</span>
                        <span>Quantity: {can.quantity} L</span>
                        {can.brix_value !== null && (
                          <>
                            <span className="px-2 text-muted-foreground/40">|</span>
                            <span>Brix: {can.brix_value}</span>
                          </>
                        )}
                        {can.ph_value !== null && (
                          <>
                            <span className="px-2 text-muted-foreground/40">|</span>
                            <span>pH: {can.ph_value}</span>
                          </>
                        )}
                        {can.total_amount !== null && (
                          <>
                            <span className="px-2 text-muted-foreground/40">|</span>
                            <span>Amount: Rs. {can.total_amount}</span>
                          </>
                        )}
                      </div>
                      {!loading && draftStatus === "draft" ? (
                        <div className="flex items-center gap-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={loading}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete can?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action will permanently remove can {can.can_id}. This cannot
                                  be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteCan(can.can_id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="treacle" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3 flex-1 w-full">
                <Input
                  placeholder="Search Cans"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 w-full"
                />
              </div>
              {!loading && draftStatus === "draft" ? (
                <Button
                  className="bg-cta hover:bg-cta-hover text-cta-foreground"
                  onClick={() => {
                    navigate(
                      `/field-collection/can/new?productType=treacle&draftId=${draftId}&centerId=${centerId}`,
                    );
                  }}
                >
                  Add New
                </Button>
              ) : null}
            </div>
            <div className="space-y-4">
              {loading ? (
                <div className="text-muted-foreground text-sm text-center py-4">
                  Loading cans...
                </div>
              ) : error ? (
                <div className="text-destructive text-sm text-center py-4">Error: {error}</div>
              ) : filteredCans.length === 0 ? (
                <div className="text-muted-foreground text-sm text-center py-4">No cans found.</div>
              ) : (
                filteredCans.map((can) => (
                  <div
                    key={can.can_id}
                    className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-4 text-sm">
                        <span>
                          Can ID:{" "}
                          <span className="font-semibold text-foreground">{can.can_id}</span>
                        </span>
                        <span className="px-2 text-muted-foreground/40">|</span>
                        <span>Product: {can.product_type}</span>
                        <span className="px-2 text-muted-foreground/40">|</span>
                        <span>Quantity: {can.quantity} L</span>
                        {can.brix_value && (
                          <>
                            <span className="px-2 text-muted-foreground/40">|</span>
                            <span>Brix: {can.brix_value}</span>
                          </>
                        )}
                        {can.ph_value && (
                          <>
                            <span className="px-2 text-muted-foreground/40">|</span>
                            <span>pH: {can.ph_value}</span>
                          </>
                        )}
                        {can.total_amount && (
                          <>
                            <span className="px-2 text-muted-foreground/40">|</span>
                            <span>Amount: Rs. {can.total_amount}</span>
                          </>
                        )}
                      </div>
                      {!loading && draftStatus === "draft" ? (
                        <div className="flex items-center gap-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={loading}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete can?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action will permanently remove can {can.can_id}. This cannot
                                  be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteCan(can.can_id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ) : null}
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
