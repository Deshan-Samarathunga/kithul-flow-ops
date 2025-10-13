import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { mockBatches, mockBuckets } from "@/lib/mockData";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export default function BatchDetail() {
  const navigate = useNavigate();
  const { batchId } = useParams();
  const userRole = sessionStorage.getItem("userRole") || "Guest";
  const userName = sessionStorage.getItem("userName") || "User";
  
  const batch = mockBatches.find((b) => b.id === batchId);
  const [selectedBuckets, setSelectedBuckets] = useState<string[]>(batch?.selectedBuckets || []);

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/");
  };

  const handleToggleBucket = (bucketId: string) => {
    setSelectedBuckets(prev => 
      prev.includes(bucketId) 
        ? prev.filter(id => id !== bucketId)
        : [...prev, bucketId]
    );
  };

  const handleSaveBatch = () => {
    toast.success("Batch updated successfully");
  };

  if (!batch) {
    return <div>Batch not found</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} onLogout={handleLogout} />
      
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-semibold">Batch {batch.batchNumber}</h1>
          <Button 
            onClick={handleSaveBatch}
            className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto"
          >
            Save Batch
          </Button>
        </div>

        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            Select buckets from field collection to add to this batch
          </p>
        </div>

        {/* Available Buckets */}
        <div className="space-y-4">
          <h2 className="text-base sm:text-lg font-semibold">Available Buckets</h2>
          {mockBuckets.map((bucket) => (
            <div
              key={bucket.id}
              className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <Checkbox
                  id={bucket.id}
                  checked={selectedBuckets.includes(bucket.id)}
                  onCheckedChange={() => handleToggleBucket(bucket.id)}
                  className="mt-1"
                />
                <label
                  htmlFor={bucket.id}
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm">
                    <span className="font-medium">Farmer: {bucket.farmerName}</span>
                    <span className="hidden sm:inline text-muted-foreground">|</span>
                    <span>Quantity: {bucket.quantity} kg</span>
                    <span className="hidden sm:inline text-muted-foreground">|</span>
                    <span>Product: {bucket.productType}</span>
                    <span className="hidden sm:inline text-muted-foreground">|</span>
                    <span>Brix: {bucket.brixValue}</span>
                    <span className="hidden sm:inline text-muted-foreground">|</span>
                    <span>pH: {bucket.phValue}</span>
                    <span className="hidden sm:inline text-muted-foreground">|</span>
                    <span>Time: {bucket.collectionTime}</span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    QR: {bucket.qrCode} | Total: LKR {bucket.total}
                  </div>
                </label>
              </div>
            </div>
          ))}
        </div>

        {/* Selected Buckets Summary */}
        {selectedBuckets.length > 0 && (
          <div className="mt-8 p-4 sm:p-6 bg-muted/50 rounded-lg">
            <h3 className="font-semibold mb-2">Selected Buckets: {selectedBuckets.length}</h3>
            <p className="text-sm text-muted-foreground">
              Total Quantity: {mockBuckets
                .filter(b => selectedBuckets.includes(b.id))
                .reduce((sum, b) => sum + b.quantity, 0)} kg
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
