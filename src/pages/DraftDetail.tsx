import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { mockDrafts, mockCollectionCenters } from "@/lib/mockData";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function DraftDetail() {
  const navigate = useNavigate();
  const { draftId } = useParams();
  const { user, logout } = useAuth();

  const userRole = user?.role || "Guest";
  const userName = user?.name || user?.userId || "User";
  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL || "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }, []);
  const userAvatar = user?.profileImage ? new URL(user.profileImage, apiBase).toString() : undefined;

  const draft = mockDrafts.find((d) => d.id === draftId);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} userAvatar={userAvatar} onLogout={handleLogout} />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">Draft : {draft.date}</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => {
                toast.success("Draft reopened");
              }}
              className="flex-1 sm:flex-none"
            >
              Reopen
            </Button>
            <Button
              className="bg-cta hover:bg-cta-hover text-cta-foreground flex-1 sm:flex-none"
              onClick={() => toast.success("Draft submitted successfully")}
            >
              Submit Draft
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {draft.collectionCenters.map((center) => {
            const centerInfo = mockCollectionCenters.find((c) => c.id === center.centerId);
            if (!centerInfo) return null;
            
            const totalQuantity = center.buckets.reduce((sum, bucket) => sum + bucket.quantity, 0);

            return (
              <div
                key={center.centerId}
                className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/field-collection/draft/${draftId}/center/${center.centerId}`)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <h3 className="font-semibold text-sm sm:text-base">
                      Collection Center: {centerInfo.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Quantity (L): {totalQuantity} | Product: Toddy
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/field-collection/draft/${draftId}/center/${center.centerId}`);
                    }}
                    className="w-full sm:w-auto"
                  >
                    View
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            variant="outline"
            onClick={() => toast.success("Report generated")}
            className="w-full sm:w-auto"
          >
            <FileText className="h-4 w-4 mr-2" /> Generate Report
          </Button>
        </div>
      </div>
    </div>
  );
}
