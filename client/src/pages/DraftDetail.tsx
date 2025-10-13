import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";
import { mockDrafts } from "@/lib/mockData";
import { toast } from "sonner";

export default function DraftDetail() {
  const navigate = useNavigate();
  const { draftId } = useParams();
  const userRole = sessionStorage.getItem("userRole") || "Guest";
  const userName = sessionStorage.getItem("userName") || "User";
  
  const draft = mockDrafts.find((d) => d.id === draftId);

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/");
  };

  if (!draft) {
    return <div>Draft not found</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} onLogout={handleLogout} />
      
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold">Draft : {draft.date}</h1>
        </div>

        <div className="mb-6">
          <Button
            onClick={() => navigate(`/field-collection/bucket/new?draftId=${draftId}`)}
            className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Bucket
          </Button>
        </div>

        <div className="space-y-4">
          {draft.buckets.map((bucket) => (
            <div
              key={bucket.id}
              className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm">
                    <span className="font-medium">Farmer: {bucket.farmerName}</span>
                    <span className="hidden sm:inline text-muted-foreground">|</span>
                    <span>Quantity (L): {bucket.quantity}</span>
                    <span className="hidden sm:inline text-muted-foreground">|</span>
                    <span>Product: {bucket.productType}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate(`/field-collection/bucket/${bucket.id}/edit?draftId=${draftId}`)
                  }
                  className="text-cta hover:text-cta-hover w-full sm:w-auto"
                >
                  Edit
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <Button
            onClick={() => toast.success("Report generated successfully")}
            className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto"
          >
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>
    </div>
  );
}
