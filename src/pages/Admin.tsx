import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";
import { toast } from "sonner";

const employees = [
  { id: "1", name: "Saman Perera", role: "Field Collection", active: true },
  { id: "2", name: "Nimal Silva", role: "Processing", active: true },
  { id: "3", name: "Kamal Fernando", role: "Packaging", active: false },
];

export default function Admin() {
  const navigate = useNavigate();
  const userRole = sessionStorage.getItem("userRole") || "Guest";
  const userName = sessionStorage.getItem("userName") || "User";

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} onLogout={handleLogout} />
      
      <div className="container mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold mb-6">Administrator</h1>

        <Tabs defaultValue="employees" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="employees">Employee Management</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="employees" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Employees</h2>
              <Button className="bg-cta hover:bg-cta-hover text-cta-foreground">
                <Plus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
            </div>

            <div className="space-y-4">
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  className="bg-card border rounded-lg p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{employee.name}</h3>
                      <p className="text-sm text-muted-foreground">{employee.role}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm ${
                          employee.active ? "text-green-600" : "text-gray-400"
                        }`}
                      >
                        {employee.active ? "Active" : "Inactive"}
                      </span>
                      <Button variant="outline">Edit</Button>
                      <Button variant="outline" className="text-destructive hover:text-destructive">
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
              <h2 className="text-xl font-semibold">Module Monitoring</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-24 text-lg"
                  onClick={() => navigate("/field-collection")}
                >
                  Field Collection
                </Button>
                <Button
                  variant="outline"
                  className="h-24 text-lg"
                  onClick={() => navigate("/processing")}
                >
                  Processing
                </Button>
                <Button
                  variant="outline"
                  className="h-24 text-lg"
                  onClick={() => navigate("/packaging")}
                >
                  Packaging
                </Button>
                <Button
                  variant="outline"
                  className="h-24 text-lg"
                  onClick={() => navigate("/labeling")}
                >
                  Labeling
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reports">
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Generate Reports</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {["Field Collection", "Processing", "Packaging", "Labeling"].map((module) => (
                  <div key={module} className="bg-card border rounded-lg p-6">
                    <h3 className="font-semibold mb-4">{module}</h3>
                    <Button
                      onClick={() => toast.success(`${module} report downloaded`)}
                      className="w-full bg-cta hover:bg-cta-hover text-cta-foreground"
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
