import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export default function AddEmployee() {
  const navigate = useNavigate();
  const userRole = sessionStorage.getItem("userRole") || "Administrator";
  const userName = sessionStorage.getItem("userName") || "Admin";
  
  const [newUser, setNewUser] = useState({
    userId: "",
    name: "",
    role: "",
    password: ""
  });

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/");
  };

  const handleAddEmployee = () => {
    if (!newUser.userId || !newUser.name || !newUser.role || !newUser.password) {
      toast.error("Please fill in all fields");
      return;
    }
    
    // In a real app, this would make an API call
    toast.success("Employee added successfully");
    navigate("/admin");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} onLogout={handleLogout} />
      
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-2xl">
        <h1 className="text-xl sm:text-2xl font-semibold mb-6">Add New Employee</h1>

        <Card className="p-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                placeholder="Enter user ID"
                value={newUser.userId}
                onChange={(e) => setNewUser({ ...newUser, userId: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="Enter full name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Field Collection">Field Collection</SelectItem>
                  <SelectItem value="Processing">Processing</SelectItem>
                  <SelectItem value="Packaging">Packaging</SelectItem>
                  <SelectItem value="Labeling">Labeling</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button 
                onClick={handleAddEmployee} 
                className="flex-1 bg-cta hover:bg-cta-hover text-cta-foreground"
              >
                Add Employee
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/admin")}
                className="flex-1"
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
