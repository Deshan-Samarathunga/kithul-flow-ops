import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar.lazy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "react-hot-toast";
import { Camera } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PageContainer } from "@/components/layout/PageContainer";

// Profile settings page for updating personal details and password.
export default function Profile() {
  const navigate = useNavigate();
  const { user, token, logout, updateUser } = useAuth();

  const userRole = user?.role || "Guest";
  const userId = user?.userId || "";
  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL || "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }, []);

  const [name, setName] = useState(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const toAbsolute = useCallback(
    (path?: string | null) => {
      if (!path) return null;
      try {
        return new URL(path, apiBase).toString();
      } catch {
        return null;
      }
    },
    [apiBase],
  );

  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    toAbsolute(user?.profileImage ?? null),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name ?? "");
    setAvatarPreview(toAbsolute(user?.profileImage ?? null));
  }, [user, toAbsolute]);

  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setAvatarFile(file);
    if (avatarPreview && avatarPreview.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreview);
    }
    const nextPreview = URL.createObjectURL(file);
    setAvatarPreview(nextPreview);
  };

  const handleSave = async () => {
    if (!token) {
      toast.error("Your session has expired. Please log in again.");
      handleLogout();
      return;
    }

    if (newPassword && newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long");
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword && !currentPassword) {
      toast.error("Please enter your current password");
      return;
    }

    const form = new FormData();
    form.append("name", name.trim());
    if (currentPassword) form.append("currentPassword", currentPassword);
    if (newPassword) form.append("newPassword", newPassword);
    if (avatarFile) form.append("avatar", avatarFile);

    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/api/profile`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update profile");
      }

      const updated = (await res.json()) as {
        id: number;
        userId: string;
        name?: string | null;
        role?: string | null;
        profileImage?: string | null;
      };

      updateUser({
        id: updated.id,
        userId: updated.userId,
        name: updated.name ?? null,
        role: updated.role ?? null,
        profileImage: updated.profileImage ?? null,
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setAvatarFile(null);
      setAvatarPreview(toAbsolute(updated.profileImage ?? null));

      toast.success("Profile updated successfully");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to save changes";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const displayName = name || user?.userId || "User";

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        userRole={userRole}
        userName={displayName}
        userAvatar={avatarPreview || undefined}
        onLogout={handleLogout}
      />

      <PageContainer className="py-6 sm:py-8 max-w-2xl">
        <h1 className="text-xl sm:text-2xl font-semibold mb-6">Profile Settings</h1>

        <Card className="p-6">
          <div className="space-y-6">
            {/* Profile Picture */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage
                    key={avatarPreview || "avatar-fallback"}
                    src={avatarPreview || undefined}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                    {displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <label
                  htmlFor="profile-picture"
                  className="absolute bottom-0 right-0 bg-cta hover:bg-cta-hover text-cta-foreground rounded-full p-2 cursor-pointer shadow-md"
                >
                  <Camera className="h-4 w-4" />
                  <input
                    id="profile-picture"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
              </div>
            </div>

            {/* User ID (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input id="userId" value={userId} disabled className="bg-muted" />
            </div>

            {/* Role (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input id="role" value={userRole} disabled className="bg-muted" />
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Password Change Section */}
            <div className="pt-4 border-t">
              <h3 className="text-lg font-semibold mb-4">Change Password</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                onClick={handleSave}
                className="flex-1 bg-cta hover:bg-cta-hover text-cta-foreground"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(-1)}
                className="flex-1"
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      </PageContainer>
    </div>
  );
}
