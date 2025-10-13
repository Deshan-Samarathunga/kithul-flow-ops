import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    // Mock authentication - In production, validate against database
    // For demo: admin/admin goes to admin, others to field-collection
    const role = userId === "admin" ? "Administrator" : "Field Collection";
    
    sessionStorage.setItem("userRole", role);
    sessionStorage.setItem("userName", userId);
    
    toast.success(`Welcome, ${userId}!`);
    
    // Route based on role
    if (role === "Administrator") {
      navigate("/admin");
    } else if (role === "Field Collection") {
      navigate("/field-collection");
    } else if (role === "Processing") {
      navigate("/processing");
    } else if (role === "Packaging") {
      navigate("/packaging");
    } else if (role === "Labeling") {
      navigate("/labeling");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-cta/10 p-4 sm:p-6">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-2 pb-6">
          <div className="flex items-center justify-center mb-2">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-cta flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-2xl">KF</span>
            </div>
          </div>
          <CardTitle className="text-2xl sm:text-3xl text-center">Kithul Flow</CardTitle>
          <CardDescription className="text-center text-sm sm:text-base">
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
                placeholder="Enter your user ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="focus:ring-cta h-11"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="focus:ring-cta h-11"
              />
            </div>

            <Button type="submit" className="w-full bg-cta hover:bg-cta-hover text-cta-foreground h-11 text-base font-medium shadow-sm hover:shadow-md transition-shadow">
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
