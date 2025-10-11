import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const roles = [
  "Administrator",
  "Field Collection",
  "Processing",
  "Packaging",
  "Labeling",
];

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password || !role) {
      toast.error("Please fill in all fields");
      return;
    }

    // Store user info in sessionStorage
    sessionStorage.setItem("userRole", role);
    sessionStorage.setItem("userName", username);
    
    toast.success(`Welcome, ${username}!`);
    
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
              <Label htmlFor="username">Username / Email</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
            
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="role" className="focus:ring-cta h-11">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
