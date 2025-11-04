import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { adminCreateCenter, adminUpdateCenter, AdminCenter } from "@/lib/api";

interface CenterFormProps {
  center?: AdminCenter | null;
  onSuccess: (center: AdminCenter) => void;
  onCancel: () => void;
}

export function CenterForm({ center, onSuccess, onCancel }: CenterFormProps) {
  const [formData, setFormData] = useState({
    centerId: "",
    centerName: "",
    location: "",
    centerAgent: "",
    contactPhone: "",
    isActive: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (center) {
      setFormData({
        centerId: center.centerId,
        centerName: center.centerName,
        location: center.location,
        centerAgent: center.centerAgent,
        contactPhone: center.contactPhone || "",
        isActive: center.isActive,
      });
    }
  }, [center]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        centerId: formData.centerId,
        centerName: formData.centerName,
        location: formData.location,
        centerAgent: formData.centerAgent,
        contactPhone: formData.contactPhone || undefined,
      };

      let result: AdminCenter;
      if (center) {
        result = await adminUpdateCenter(center.id, {
          ...payload,
          isActive: formData.isActive,
        });
        toast.success("Center updated successfully");
      } else {
        result = await adminCreateCenter(payload);
        toast.success("Center created successfully");
      }

      onSuccess(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save center";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">
          {center ? "Edit Center" : "Add New Center"}
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="centerId">Center ID *</Label>
              <Input
                id="centerId"
                value={formData.centerId}
                onChange={(e) => handleChange("centerId", e.target.value)}
                placeholder="e.g., center001"
                required
                disabled={!!center} // Don't allow editing center ID
                className={center ? "bg-muted" : ""}
              />
              <p className="text-xs text-muted-foreground">
                {center ? "Center ID cannot be changed" : "Unique identifier for the center"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="centerName">Center Name *</Label>
              <Input
                id="centerName"
                value={formData.centerName}
                onChange={(e) => handleChange("centerName", e.target.value)}
                placeholder="e.g., Dambuluwana"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
                placeholder="e.g., Kegalle"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="centerAgent">Center Agent *</Label>
              <Input
                id="centerAgent"
                value={formData.centerAgent}
                onChange={(e) => handleChange("centerAgent", e.target.value)}
                placeholder="e.g., Agent Name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                value={formData.contactPhone}
                onChange={(e) => handleChange("contactPhone", e.target.value)}
                placeholder="e.g., +94 71 000 0001"
                type="tel"
              />
            </div>

            {center && (
              <div className="space-y-2">
                <Label htmlFor="isActive">Status</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => handleChange("isActive", checked)}
                  />
                  <Label htmlFor="isActive" className="text-sm">
                    {formData.isActive ? "Active" : "Inactive"}
                  </Label>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-cta hover:bg-cta-hover text-cta-foreground"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {center ? "Updating..." : "Creating..."}
                </>
              ) : center ? (
                "Update Center"
              ) : (
                "Create Center"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
