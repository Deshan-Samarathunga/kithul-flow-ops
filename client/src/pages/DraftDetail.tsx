import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";
import { mockDrafts } from "@/lib/mockData";
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
            <h1 className="text-xl sm:text-2xl font-semibold">Draft {draft.date}</h1>
            <p className="text-sm text-muted-foreground">Buckets: {draft.buckets.length}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                toast.success("Draft reopened");
              }}
            >
              Reopen
            </Button>
            <Button
              className="bg-cta hover:bg-cta-hover text-cta-foreground"
              onClick={() => toast.success("Draft submitted successfully")}
            >
              Submit Draft
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {draft.buckets.map((bucket) => (
            <div key={bucket.id} className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm sm:text-base">{bucket.farmerName}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">{bucket.productType}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast.success(`Bucket ${bucket.qrCode} updated`)}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Bucket
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast.success("Bucket report generated")}
                  >
                    <FileText className="h-4 w-4 mr-1" /> Report
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
