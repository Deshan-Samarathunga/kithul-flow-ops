import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { toast } from "sonner";

const packagingData = [
  { id: "1", date: "2025/06/16", batchNumber: "03", status: "ready" as const },
  { id: "2", date: "2025/06/15", batchNumber: "02", status: "completed" as const },
];

export default function Packaging() {
  const navigate = useNavigate();
  const userRole = sessionStorage.getItem("userRole") || "Guest";
  const userName = sessionStorage.getItem("userName") || "User";

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} onLogout={handleLogout} />
      
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Packaging</h1>
          <Button
            onClick={() => toast.success("Report downloaded")}
            className="bg-cta hover:bg-cta-hover text-cta-foreground"
          >
            <FileText className="h-4 w-4 mr-2" />
            Download Report
          </Button>
        </div>

        <div className="space-y-4">
          {packagingData.map((item) => (
            <div
              key={item.id}
              className="bg-card border rounded-lg p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <span className="font-medium">{item.date}</span>
                  <span className="text-muted-foreground">|</span>
                  <span>Batch number: {item.batchNumber}</span>
                </div>
                <StatusBadge status={item.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
