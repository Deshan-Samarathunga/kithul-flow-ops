import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { SecondaryToolbar } from "@/components/SecondaryToolbar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus } from "lucide-react";
import { mockBatches } from "@/lib/mockData";
import { useAuth } from "@/lib/auth";

export default function Processing() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} userAvatar={userAvatar} onLogout={handleLogout} />
      
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-6">Batches</h1>

        <SecondaryToolbar>
          <Button className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add new Batch
          </Button>
        </SecondaryToolbar>

        <div className="space-y-4 mt-6">
          {mockBatches.map((batch) => (
            <div
              key={batch.id}
              className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm">
                  <span className="font-medium">{batch.date}</span>
                  <span className="hidden sm:inline text-muted-foreground">|</span>
                  <span>Batch: {batch.batchNumber}</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <StatusBadge status={batch.status} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/processing/batch/${batch.id}`)}
                    className="text-cta hover:text-cta-hover flex-1 sm:flex-none"
                  >
                    View
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




