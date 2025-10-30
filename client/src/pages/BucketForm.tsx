import { useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
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
    serialNumber: "",
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

    if (!formData.quantity || !formData.serialNumber) {
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

    // Validate serial number: 1-8 digits (server will left-pad to 8)
    const serial = formData.serialNumber.trim();
    if (!/^\d{1,8}$/.test(serial)) {
      toast.error("Can ID number must be 1 to 8 digits");
      return;
    }

    try {
      // Create bucket data
      const bucketData = {
        draftId: draftId,
        collectionCenterId: centerId || 'center001',
        productType: productTypeLower as 'sap' | 'treacle',
        serialNumber: serial,
        brixValue: brix,
        phValue: ph,
        quantity: parseFloat(formData.quantity),
      };

      await DataService.createBucket(bucketData);
      
      toast.success("Can added successfully");
      navigate(`/field-collection/draft/${draftId}/center/${centerId || 'center001'}?productType=${productTypeLower}`);
    } catch (error) {
      console.error('Error creating can:', error);
      const fullId = (productTypeLower === 'sap' ? 'SAP-' : 'TCL-') + String(serial).padStart(8, '0');
      const msg = error instanceof Error ? error.message : '';
      if (typeof msg === 'string' && /already exists/i.test(msg)) {
        toast.error(`Can ID ${fullId} already exists`);
      } else if (msg) {
        toast.error(msg);
      } else {
        toast.error('Failed to add can');
      }
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
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-semibold">New Can</h2>
            <p className="text-sm text-muted-foreground mt-1">Enter details for the new can below.</p>
            <div className="mt-5" />

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <Label htmlFor="productType">Product type</Label>
                  <Input id="productType" value={productType} disabled />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="serialNumber">Can ID number (8 digits) *</Label>
                  <Input
                    id="serialNumber"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{1,8}"
                    maxLength={8}
                    placeholder="Enter 8-digit number"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value.replace(/[^0-9]/g, '') })}
                  />
                  <div className="text-xs text-muted-foreground">
                    Full Can ID: {(productTypeLower === 'sap' ? 'SAP-' : 'TCL-') + ((formData.serialNumber || '').padStart(8,'0') || '________')}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brixValue">Brix Value (0-100)</Label>
                  <Input
                    id="brixValue"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="Enter Brix (0–100)"
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
                    placeholder="Enter pH (0–14)"
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


              <div className="flex justify-end col-span-1 sm:col-span-2">
                <Button type="submit" className="bg-cta hover:bg-cta-hover text-cta-foreground">
                  Submit
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
