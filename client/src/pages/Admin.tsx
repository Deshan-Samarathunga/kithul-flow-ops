import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";
import { toast } from "sonner";

const initialEmployees = [
  { id: "1", userId: "saman", name: "Saman Perera", role: "Field Collection", active: true },
  { id: "2", userId: "nimal", name: "Nimal Silva", role: "Processing", active: true },
  { id: "3", userId: "kamal", name: "Kamal Fernando", role: "Packaging", active: false },
];

export default function Admin() {
  const navigate = useNavigate();
  const userRole = sessionStorage.getItem("userRole") || "Guest";
  const userName = sessionStorage.getItem("userName") || "User";
  const [employees, setEmployees] = useState(initialEmployees);

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/");
  };

  const handleDeleteEmployee = (id: string) => {
    setEmployees(employees.filter(e => e.id !== id));
    toast.success("Employee deleted");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} onLogout={handleLogout} />
      
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-6">Administrator</h1>

        <Tabs defaultValue="employees" className="w-full">
          <TabsList className="mb-6 w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
            <TabsTrigger value="employees" className="text-xs sm:text-sm">Employees</TabsTrigger>
            <TabsTrigger value="monitoring" className="text-xs sm:text-sm">Monitoring</TabsTrigger>
            <TabsTrigger value="reports" className="text-xs sm:text-sm">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="employees" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-lg sm:text-xl font-semibold">Employees</h2>
              <Button 
                onClick={() => navigate("/admin/add-employee")}
                className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
            </div>

            <div className="space-y-4">
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-sm sm:text-base">{employee.name}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">{employee.role}</p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <span
                        className={`text-xs sm:text-sm ${
                          employee.active ? "text-green-600" : "text-gray-400"
                        }`}
                      >
                        {employee.active ? "Active" : "Inactive"}
                      </span>
                      <Button variant="outline" size="sm" className="flex-1 sm:flex-none">Edit</Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-destructive hover:text-destructive flex-1 sm:flex-none"
                        onClick={() => handleDeleteEmployee(employee.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="monitoring">
            <div className="space-y-4">
              <h2 className="text-lg sm:text-xl font-semibold">Module Monitoring</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Button
                  variant="outline"
                  className="h-20 sm:h-24 text-base sm:text-lg"
                  onClick={() => navigate("/field-collection")}
                >
                  Field Collection
                </Button>
                <Button
                  variant="outline"
                  className="h-20 sm:h-24 text-base sm:text-lg"
                  onClick={() => navigate("/processing")}
                >
                  Processing
                </Button>
                <Button
                  variant="outline"
                  className="h-20 sm:h-24 text-base sm:text-lg"
                  onClick={() => navigate("/packaging")}
                >
                  Packaging
                </Button>
                <Button
                  variant="outline"
                  className="h-20 sm:h-24 text-base sm:text-lg"
                  onClick={() => navigate("/labeling")}
                >
                  Labeling
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reports">
            <div className="space-y-6">
              <h2 className="text-lg sm:text-xl font-semibold">Generate Reports</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {["Field Collection", "Processing", "Packaging", "Labeling"].map((module) => (
                  <div key={module} className="bg-card border rounded-lg p-4 sm:p-6">
                    <h3 className="font-semibold mb-4 text-sm sm:text-base">{module}</h3>
                    <Button
                      onClick={() => toast.success(`${module} report downloaded`)}
                      className="w-full bg-cta hover:bg-cta-hover text-cta-foreground text-sm"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Download CSV/PDF
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
