import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";

type User = {
  id: number;
  userId: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
};

function routeForRole(role?: string | null) {
  switch ((role || "").toLowerCase()) {
    case "administrator":
    case "admin":
      return "/admin";
    case "field collection":
    case "field":
      return "/field-collection";
    case "processing":
      return "/processing";
    case "packaging":
      return "/packaging";
    case "labeling":
      return "/labeling";
    default:
      return "/field-collection"; // sensible default
  }
}

// Authentication entry page for the entire application.
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectFrom = ((): string | undefined => {
    const state = location.state;
    if (state && typeof state === "object" && "from" in state) {
      const value = (state as Record<string, unknown>).from;
      return typeof value === "string" ? value : undefined;
    }
    return undefined;
  })();
  const { login } = useAuth();

  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    if (!userId || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const loggedInUser = await login({ userId, password });

      toast.success(`Welcome, ${loggedInUser.name || loggedInUser.userId}!`);

      // redirect priority: explicit redirectFrom -> role route -> default
      const target = redirectFrom || routeForRole(loggedInUser.role);
      navigate(target, { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid credentials";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const logoUrl = new URL("/logo/kitul-flow-logo-black.png", import.meta.url).toString();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-cta/10 p-4 sm:p-6">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-2 pb-6">
          <div className="login-logo-wrapper mx-auto w-full max-w-xs text-center pt-6">
            <img
              src={logoUrl}
              srcSet={`${logoUrl} 1x, ${logoUrl} 2x`}
              alt="Kithul Flow logo"
              width="224"
              height="224"
              className="mx-auto block w-56 h-56 object-contain"
              loading="eager"
              aria-hidden="false"
            />
          </div>
          <CardDescription className="mt-4 text-center text-sm text-gray-500">
            Sign in to access your dashboard
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                type="text"
                placeholder="admin01"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="focus:ring-cta h-11"
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="flex gap-2">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-cta h-11"
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 shrink-0"
                  onClick={() => setShowPw((s) => !s)}
                >
                  {showPw ? "Hide" : "Show"}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Remember me
              </label>
              {/* place for "Forgot password?" later */}
            </div>

            <Button
              type="submit"
              className="w-full bg-cta hover:bg-cta-hover text-cta-foreground h-11 text-base font-medium shadow-sm hover:shadow-md transition-shadow"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
