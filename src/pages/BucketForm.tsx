import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { mockFarmers } from "@/lib/mockData";
import { toast } from "sonner";

export default function BucketForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get("draftId");
  const userRole = sessionStorage.getItem("userRole") || "Guest";
  const userName = sessionStorage.getItem("userName") || "User";

  const [formData, setFormData] = useState({
    farmer: "",
    productType: "Toddy",
    brixValue: "",
    phValue: "",
    quantity: "",
    collectionTime: "",
    qrCode: "",
  });

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.farmer || !formData.quantity || !formData.collectionTime) {
      toast.error("Please fill in all required fields");
      return;
    }

    const brix = parseFloat(formData.brixValue);
    const ph = parseFloat(formData.phValue);

    if (brix < 0 || brix > 100) {
      toast.error("Brix value must be between 0 and 100");
      return;
    }

    if (ph < 0 || ph > 14) {
      toast.error("pH value must be between 0 and 14");
      return;
    }

    toast.success("Bucket added successfully");
    navigate(`/field-collection/draft/${draftId}`);
  };

  const amountPerKg = 100;
  const total = parseFloat(formData.quantity || "0") * amountPerKg;

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} onLogout={handleLogout} />
      
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-2xl font-semibold mb-6">New bucket</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="farmer">Farmer *</Label>
                  <Select value={formData.farmer} onValueChange={(v) => setFormData({ ...formData, farmer: v })}>
                    <SelectTrigger id="farmer">
                      <SelectValue placeholder="Select farmer or Scan QR" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockFarmers.map((farmer) => (
                        <SelectItem key={farmer.id} value={farmer.id}>
                          {farmer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productType">Product type</Label>
                  <Input id="productType" value={formData.productType} disabled />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brixValue">Brix Value (0-100)</Label>
                  <Input
                    id="brixValue"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="Enter brix value"
                    value={formData.brixValue}
                    onChange={(e) => setFormData({ ...formData, brixValue: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phValue">pH value (0-14)</Label>
                  <Input
                    id="phValue"
                    type="number"
                    step="0.1"
                    min="0"
                    max="14"
                    placeholder="Enter pH value"
                    value={formData.phValue}
                    onChange={(e) => setFormData({ ...formData, phValue: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity (L) *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="Enter quantity"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="qrCode">QR code</Label>
                  <Input
                    id="qrCode"
                    placeholder="Enter QR code"
                    value={formData.qrCode}
                    onChange={(e) => setFormData({ ...formData, qrCode: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="collectionTime">Collection time *</Label>
                  <Select
                    value={formData.collectionTime}
                    onValueChange={(v) => setFormData({ ...formData, collectionTime: v })}
                  >
                    <SelectTrigger id="collectionTime">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Morning">Morning</SelectItem>
                      <SelectItem value="Evening">Evening</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground">
                    {"{Scan QR code}"}
                  </div>
                </div>
              </div>

              <div className="border-t pt-6 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount per L - Based on eligibility</span>
                  <span className="font-medium">Rs. {amountPerKg}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>Rs. {total.toFixed(2)}</span>
                </div>
              </div>

              <Button type="submit" className="w-full md:w-auto bg-cta hover:bg-cta-hover text-cta-foreground">
                Submit
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
