import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { adminGetUser, adminUpdateUser } from "@/lib/api";

const ROLE_OPTIONS = ["Field Collection", "Processing", "Packaging", "Labeling"];

// Page for editing an existing employee's role and status.
export default function EditEmployee() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { user, token, logout } = useAuth();

  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL || "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }, []);

  const userRole = user?.role || "Guest";
  const userName = user?.name || user?.userId || "User";
  const userAvatar = user?.profileImage
    ? new URL(user.profileImage, apiBase).toString()
    : undefined;

  const handleLogout = () => {
    logout();
    navigate("/");
  };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<string[]>(ROLE_OPTIONS);
  const [form, setForm] = useState({ name: "", role: ROLE_OPTIONS[0], isActive: true });

  useEffect(() => {
    if (!userId) {
      toast.error("Missing employee id");
      navigate("/admin");
      return;
    }

    if (!token) {
      toast.error("Session expired. Please log in again.");
      logout();
      navigate("/");
      return;
    }

    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);

        const [rolesResponse, employee] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/api/admin/roles`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then(async (res) => {
            if (!res.ok) throw new Error("Failed to load roles");
            const payload = (await res.json()) as { roles: string[] };
            return (payload.roles ?? []).filter((role) => role !== "Administrator");
          }),
          adminGetUser(Number(userId)),
        ]);

        if (cancelled) return;

        setRoles(rolesResponse.length ? rolesResponse : ROLE_OPTIONS);
        setForm({
          name: employee.name || "",
          role: rolesResponse.includes(employee.role)
            ? employee.role
            : (rolesResponse[0] ?? ROLE_OPTIONS[0]),
          isActive: employee.isActive,
        });
      } catch (error: unknown) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to load employee";
          toast.error(message);
          navigate("/admin");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [userId, token, navigate, logout]);

  const handleSave = async () => {
    if (!userId) return;
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      await adminUpdateUser(Number(userId), {
        name: form.name.trim(),
        role: form.role,
        isActive: form.isActive,
      });
      toast.success("Employee updated");
      navigate("/admin");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update employee";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        userRole={userRole}
        userName={userName}
        userAvatar={userAvatar}
        onLogout={handleLogout}
      />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-xl">
        <Card className="p-6 sm:p-8 shadow-lg border">
          <h1 className="text-xl sm:text-2xl font-semibold mb-1">Edit Employee</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Update the employee&apos;s details and access status.
          </p>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="employee-name">Full Name</Label>
                <Input
                  id="employee-name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employee-role">Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, role: value }))}
                >
                  <SelectTrigger id="employee-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between border rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Account Active</p>
                  <p className="text-xs text-muted-foreground">
                    Disable to temporarily revoke access without deleting the account.
                  </p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/admin")}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-cta hover:bg-cta-hover text-cta-foreground"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
