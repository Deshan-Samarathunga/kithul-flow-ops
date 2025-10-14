import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { adminListUsers, AdminUser, adminDeleteUser } from "@/lib/api";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const ROLES_FOR_EMPLOYEES = [
  "Field Collection",
  "Processing",
  "Packaging",
  "Labeling",
];

export default function Admin() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const userRole = user?.role || "Guest";
  const userName = user?.name || user?.userId || "User";
  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL || "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }, []);
  const userAvatar = user?.profileImage ? new URL(user.profileImage, apiBase).toString() : undefined;

  const [employees, setEmployees] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const toAbsolute = useCallback(
    (path?: string | null) => {
      if (!path) return undefined;
      try {
        return new URL(path, apiBase).toString();
      } catch {
        return undefined;
      }
    },
    [apiBase]
  );

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminListUsers();
      setEmployees(data);
    } catch (error: any) {
      toast.error(error?.message || "Unable to load employees");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await adminDeleteUser(deleteTarget.id);
      setEmployees((prev) => prev.filter((emp) => emp.id !== deleteTarget.id));
      toast.success("Employee deleted");
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete employee");
    } finally {
      setDeleteTarget(null);
    }
  };

  const displayEmployees = employees.map((employee) => ({
    ...employee,
    profileImage: toAbsolute(employee.profileImage ?? undefined),
  }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} userAvatar={userAvatar} onLogout={handleLogout} />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-6">Administrator</h1>

        <Tabs defaultValue="employees" className="w-full">
          <TabsList className="mb-6 w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
            <TabsTrigger value="employees" className="text-xs sm:text-sm">
              Employees
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="text-xs sm:text-sm">
              Monitoring
            </TabsTrigger>
            <TabsTrigger value="reports" className="text-xs sm:text-sm">
              Reports
            </TabsTrigger>
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

            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading employees...
              </div>
            ) : displayEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No employees found.</p>
            ) : (
              <div className="space-y-4">
                {displayEmployees.map((employee) => (
                  <div key={employee.id} className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-sm sm:text-base">{employee.name || employee.userId}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">{employee.role}</p>
                        <p className="text-xs text-muted-foreground mt-1">ID: {employee.userId}</p>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        <span
                          className={`text-xs sm:text-sm ${
                            employee.isActive ? "text-green-600" : "text-gray-400"
                          }`}
                        >
                          {employee.isActive ? "Active" : "Inactive"}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          onClick={() => navigate(`/admin/employees/${employee.id}/edit`)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive flex-1 sm:flex-none"
                          onClick={() => setDeleteTarget(employee)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                {ROLES_FOR_EMPLOYEES.map((module) => (
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete employee?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently remove {deleteTarget?.name || deleteTarget?.userId}. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
