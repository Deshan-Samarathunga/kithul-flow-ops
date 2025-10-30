import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export default function BucketForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get("draftId");
  const centerId = searchParams.get("centerId");
  const { user, logout } = useAuth();

  const userRole = user?.role || "Guest";
  const userName = user?.name || user?.userId || "User";
  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL || "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }, []);
  const userAvatar = user?.profileImage ? new URL(user.profileImage, apiBase).toString() : undefined;

  const [formData, setFormData] = useState({
    canId: "",
    productType: "Toddy",
    phValue: "",
    quantity: "",
  });

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.canId || !formData.quantity) {
      toast.error("Please fill in all required fields");
      return;
    }

    const ph = parseFloat(formData.phValue);

    if (formData.phValue && (ph < 0 || ph > 14)) {
      toast.error("pH value must be between 0 and 14");
      return;
    }

    toast.success("Bucket added successfully");
    navigate(`/field-collection/draft/${draftId}/center/${centerId}`);
  };

  const amountPerL = 100;
  const total = parseFloat(formData.quantity || "0") * amountPerL;

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} userAvatar={userAvatar} onLogout={handleLogout} />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-4xl">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-semibold mb-6">New bucket</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <Label htmlFor="canId">Can ID *</Label>
                  <Input
                    id="canId"
                    placeholder="Enter can ID"
                    value={formData.canId}
                    onChange={(e) => setFormData({ ...formData, canId: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productType">Product type</Label>
                  <Input id="productType" value={formData.productType} disabled className="bg-muted" />
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
              </div>

              <div className="border-t pt-6 space-y-4">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Amount per L - Based on eligibility</span>
                  <span className="font-medium">Rs. {amountPerL}</span>
                </div>
                <div className="flex justify-between text-base sm:text-lg font-semibold">
                  <span>Total</span>
                  <span>Rs. {total.toFixed(2)}</span>
                </div>
              </div>

              <Button type="submit" className="w-full sm:w-auto bg-cta hover:bg-cta-hover text-cta-foreground">
                Submit
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
