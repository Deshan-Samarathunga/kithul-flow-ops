import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { mockBatches } from "@/lib/mockData";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

export default function BatchDetail() {
  const navigate = useNavigate();
  const { batchId } = useParams();
  const userRole = sessionStorage.getItem("userRole") || "Guest";
  const userName = sessionStorage.getItem("userName") || "User";
  
  const batch = mockBatches.find((b) => b.id === batchId);

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/");
  };

  if (!batch) {
    return <div>Batch not found</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} onLogout={handleLogout} />
      
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold">Batch number {batch.batchNumber}</h1>
        </div>

        <div className="mb-6">
          <Button className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add bucket
          </Button>
        </div>

        {/* Quality Check Form */}
        <Card className="mb-8">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2">
                <Label>Select farmer</Label>
                <Input placeholder="{Scan QR code}" />
              </div>
              <div className="space-y-2">
                <Label>Product</Label>
                <Input disabled />
              </div>
              <div className="space-y-2">
                <Label>Quality check status</Label>
                <Select defaultValue="Pass">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pass">Pass</SelectItem>
                    <SelectItem value="Fail">Fail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Comment</Label>
                <Textarea placeholder="Add any comments..." rows={3} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quality Passed */}
        <div className="mb-8">
          <h2 className="text-base sm:text-lg font-semibold mb-4">Quality passed</h2>
          <div className="space-y-4">
            {batch.qualityPassed.map((bucket) => (
              <div
                key={bucket.id}
                className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm">
                    <span className="font-medium">Farmer: {bucket.farmerName}</span>
                    <span className="hidden sm:inline text-muted-foreground">|</span>
                    <span>Quantity (L): {bucket.quantity}</span>
                    <span className="hidden sm:inline text-muted-foreground">|</span>
                    <span>Product: {bucket.productType}</span>
                  </div>
                  <Button variant="outline" size="sm" className="text-cta hover:text-cta-hover w-full sm:w-auto">
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quality Failed */}
        <div>
          <h2 className="text-base sm:text-lg font-semibold mb-4">Quality Failed</h2>
          <div className="space-y-4">
            {batch.qualityFailed.map((bucket) => (
              <div
                key={bucket.id}
                className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm">
                    <span className="font-medium">Farmer: {bucket.farmerName}</span>
                    <span className="hidden sm:inline text-muted-foreground">|</span>
                    <span>Quantity (L): {bucket.quantity}</span>
                    <span className="hidden sm:inline text-muted-foreground">|</span>
                    <span>Product: {bucket.productType}</span>
                  </div>
                  <Button variant="outline" size="sm" className="text-cta hover:text-cta-hover w-full sm:w-auto">
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
