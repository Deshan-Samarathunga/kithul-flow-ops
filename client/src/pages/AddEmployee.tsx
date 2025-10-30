import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type FormState = {
  userId: string;
  name: string;
  role: string;
  password: string;
};

const initialState: FormState = {
  userId: "",
  name: "",
  role: "",
  password: "",
};

export default function AddEmployee() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();

  const [form, setForm] = useState<FormState>(initialState);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);

  const userRole = user?.role || "Administrator";
  const userName = user?.name || user?.userId || "Admin";
  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL || "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }, []);
  const userAvatar = user?.profileImage ? new URL(user.profileImage, apiBase).toString() : undefined;

  useEffect(() => {
    let cancelled = false;

    async function fetchRoles() {
      if (!token) return;
      setRolesLoading(true);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/roles`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load roles");
        const data = (await res.json()) as { roles: string[] };
        if (!cancelled) {
          const allowedRoles = (data.roles ?? []).filter((role) => role !== "Administrator");
          setRoles(allowedRoles);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to load roles";
          toast.error(message);
          setRoles(["Field Collection", "Processing", "Packaging", "Labeling"]);
        }
      } finally {
        if (!cancelled) setRolesLoading(false);
      }
    }

    fetchRoles();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const allRoles = useMemo(() => [...roles].sort(), [roles]);

  useEffect(() => {
    if (!form.role && roles.length) {
      setForm((prev) => ({ ...prev, role: roles[0] }));
    }
  }, [roles, form.role]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleChange = (field: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddEmployee = async () => {
    const trimmedUserId = form.userId.trim();
    const trimmedName = form.name.trim();

    if (!trimmedUserId || !trimmedName || !form.role || !form.password) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(trimmedUserId)) {
      toast.error("User ID can only include letters, numbers, dots, hyphens, and underscores.");
      return;
    }

    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    if (!token) {
      toast.error("Your session has expired. Please log in again.");
      handleLogout();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: trimmedUserId,
          name: trimmedName,
          role: form.role,
          password: form.password,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errorMessage =
          data.error ||
          data.details?.formErrors?.join(", ") ||
          Object.values<string[]>(data.details?.fieldErrors ?? {})
            .flat()
            .join(", ");
        throw new Error(errorMessage || "Unable to add employee");
      }

      const created = await res.json();
      toast.success(`Employee ${created.userId} added successfully`);
      setForm(initialState);
      navigate("/admin");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add employee";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} userAvatar={userAvatar} onLogout={handleLogout} />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-2xl">
        <h1 className="text-xl sm:text-2xl font-semibold mb-6">Add New Employee</h1>

        <Card className="p-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                placeholder="Enter user ID"
                value={form.userId}
                onChange={(e) => handleChange("userId")(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="Enter full name"
                value={form.name}
                onChange={(e) => handleChange("name")(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={form.password}
                onChange={(e) => handleChange("password")(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={form.role}
                onValueChange={(value) => handleChange("role")(value)}
                disabled={rolesLoading}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder={rolesLoading ? "Loading roles..." : "Select role"} />
                </SelectTrigger>
                <SelectContent>
                  {allRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                onClick={handleAddEmployee}
                className="flex-1 bg-cta hover:bg-cta-hover text-cta-foreground"
                disabled={loading}
              >
                {loading ? "Adding..." : "Add Employee"}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/admin")}
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}


