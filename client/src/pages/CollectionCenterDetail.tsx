import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";
import { mockDrafts, mockCollectionCenters } from "@/lib/mockData";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function CollectionCenterDetail() {
  const navigate = useNavigate();
  const { draftId, centerId } = useParams();
  const { user, logout } = useAuth();

  const userRole = user?.role || "Guest";
  const userName = user?.name || user?.userId || "User";
  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL || "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }, []);
  const userAvatar = user?.profileImage ? new URL(user.profileImage, apiBase).toString() : undefined;

  const draft = mockDrafts.find((d) => d.id === draftId);
  const centerData = draft?.collectionCenters.find((c) => c.centerId === centerId);
  const centerInfo = mockCollectionCenters.find((c) => c.id === centerId);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (!draft || !centerData || !centerInfo) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar userRole={userRole} userName={userName} userAvatar={userAvatar} onLogout={handleLogout} />
        <div className="container mx-auto px-4 sm:px-6 py-10">
          <p className="text-sm text-muted-foreground">Collection center not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} userAvatar={userAvatar} onLogout={handleLogout} />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold mb-2">
            Draft : {draft.date}
          </h1>
          <p className="text-sm text-muted-foreground">
            Collection Center: {centerInfo.name}
          </p>
        </div>

        <div className="mb-6">
          <Button
            onClick={() => navigate(`/field-collection/bucket/new?draftId=${draftId}&centerId=${centerId}`)}
            className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Bucket
          </Button>
        </div>

        <div className="space-y-4">
          {centerData.buckets.map((bucket) => (
            <div
              key={bucket.id}
              className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <p className="text-xs sm:text-sm">
                    <span className="text-muted-foreground">Can ID: </span>
                    <span className="font-medium">{bucket.canId}</span>
                    <span className="text-muted-foreground mx-2">|</span>
                    <span className="text-muted-foreground">Quantity (L): </span>
                    <span className="font-medium">{bucket.quantity}</span>
                    <span className="text-muted-foreground mx-2">|</span>
                    <span className="text-muted-foreground">Product: </span>
                    <span className="font-medium">{bucket.productType}</span>
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.success("Bucket edited")}
                  className="w-full sm:w-auto"
                >
                  Edit
                </Button>
              </div>
            </div>
          ))}
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
