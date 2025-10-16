import { useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { DataService } from "@/lib/dataService";

export default function BucketForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get("draftId");
  const productTypeParam = searchParams.get("productType");
  const centerId = searchParams.get("centerId");
  const { user, logout } = useAuth();

  // Define the 4 collection centers mapping
  const collectionCenters = {
    "center001": { name: "Galle Collection Center", agent: "John Silva" },
    "center002": { name: "Kurunegala Collection Center", agent: "Mary Perera" }, 
    "center003": { name: "Hikkaduwa Collection Center", agent: "David Fernando" },
    "center004": { name: "Matara Collection Center", agent: "Sarah Jayawardena" }
  };

  const centerInfo = collectionCenters[centerId as keyof typeof collectionCenters] || { name: "Galle Collection Center", agent: "John Silva" };
  const centerName = centerInfo.name;

  const userRole = user?.role || "Guest";
  const userName = user?.name || user?.userId || "User";
  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL || "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }, []);
  const userAvatar = user?.profileImage ? new URL(user.profileImage, apiBase).toString() : undefined;

  const productType = productTypeParam === "treacle" ? "Treacle" : "Sap";
  const productTypeLower = productTypeParam === "treacle" ? "treacle" : "sap";
  const [formData, setFormData] = useState({
    brixValue: "",
    phValue: "",
    quantity: "",
  });

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.quantity) {
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

    try {
      // Create bucket data
      const bucketData = {
        draftId: draftId,
        collectionCenterId: centerId || 'center001',
        productType: productTypeLower as 'sap' | 'treacle',
        brixValue: brix,
        phValue: ph,
        quantity: parseFloat(formData.quantity),
      };

      await DataService.createBucket(bucketData);
      
      toast.success("Bucket added successfully");
      navigate(`/field-collection/draft/${draftId}/center/${centerId || 'center001'}?productType=${productTypeLower}`);
    } catch (error) {
      console.error('Error creating bucket:', error);
      toast.error('Failed to add bucket');
    }
  };


  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        userRole={userRole} 
        userName={userName} 
        userAvatar={userAvatar} 
        onLogout={handleLogout}
        breadcrumb={
          <div className="flex items-center space-x-2 text-sm text-white">
            <Link 
              to={`/field-collection?productType=${productTypeLower}`}
              className="hover:text-orange-200"
            >
              Field Collection
            </Link>
            <span className="mx-2">&gt;</span>
            <Link 
              to={`/field-collection/draft/${draftId}?productType=${productTypeLower}`}
              className="hover:text-orange-200"
            >
              {productType} collection draft
            </Link>
            <span className="mx-2">&gt;</span>
            <Link 
              to={`/field-collection/draft/${draftId}/center/${encodeURIComponent(centerId || 'center001')}?productType=${productTypeLower}`}
              className="hover:text-orange-200"
            >
              {centerName} cans
            </Link>
            <span className="mx-2">&gt;</span>
            <span className="text-black font-semibold">add new can</span>
          </div>
        }
      />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-4xl">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-semibold mb-6">New bucket</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <Label htmlFor="productType">Product type</Label>
                  <Input id="productType" value={productType} disabled />
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
              </div>


              <Button type="submit" className="w-full sm:w-auto bg-cta hover:bg-cta-hover text-cta-foreground col-span-1 sm:col-span-2">
                Submit
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
