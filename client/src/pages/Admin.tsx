import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, FileText, Loader2, Search, Edit, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { adminListUsers, AdminUser, adminDeleteUser, adminListCenters, AdminCenter, adminDeleteCenter } from "@/lib/api";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CenterForm } from "@/components/CenterForm";
import { ToggleSelector } from "@/components/ToggleSelector";

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
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [employeeRoleFilter, setEmployeeRoleFilter] = useState<"all" | "Field Collection" | "Processing" | "Packaging" | "Labeling">("all");
  
  // Centers state
  const [centers, setCenters] = useState<AdminCenter[]>([]);
  const [centersLoading, setCentersLoading] = useState(false);
  const [centerSearchQuery, setCenterSearchQuery] = useState("");
  const [centerStatusFilter, setCenterStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [showCenterForm, setShowCenterForm] = useState(false);
  const [editingCenter, setEditingCenter] = useState<AdminCenter | null>(null);
  const [deleteCenterTarget, setDeleteCenterTarget] = useState<AdminCenter | null>(null);

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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to load employees";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCenters = useCallback(async () => {
    setCentersLoading(true);
    try {
      const data = await adminListCenters();
      setCenters(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to load centers";
      toast.error(message);
    } finally {
      setCentersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
    loadCenters();
  }, [loadEmployees, loadCenters]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await adminDeleteUser(deleteTarget.id);
      setEmployees((prev) => prev.filter((emp) => emp.id !== deleteTarget.id));
      toast.success("Employee deleted");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete employee";
      toast.error(message);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleCenterSuccess = (center: AdminCenter) => {
    if (editingCenter) {
      setCenters((prev) => prev.map((c) => (c.id === center.id ? center : c)));
    } else {
      setCenters((prev) => [center, ...prev]);
    }
    setShowCenterForm(false);
    setEditingCenter(null);
  };

  const handleCenterCancel = () => {
    setShowCenterForm(false);
    setEditingCenter(null);
  };

  const handleEditCenter = (center: AdminCenter) => {
    setEditingCenter(center);
    setShowCenterForm(true);
  };

  const handleDeleteCenter = async () => {
    if (!deleteCenterTarget) return;
    try {
      await adminDeleteCenter(deleteCenterTarget.id);
      setCenters((prev) => prev.filter((center) => center.id !== deleteCenterTarget.id));
      toast.success("Center deleted");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete center";
      toast.error(message);
    } finally {
      setDeleteCenterTarget(null);
    }
  };

  const displayEmployees = employees.map((employee) => ({
    ...employee,
    profileImage: toAbsolute(employee.profileImage ?? undefined),
  }));

  const filteredEmployees = useMemo(() => {
    let filtered = displayEmployees;

    // Filter by role
    if (employeeRoleFilter !== "all") {
      filtered = filtered.filter((employee) => employee.role === employeeRoleFilter);
    }

    // Filter by search query
    if (employeeSearchQuery.trim()) {
      const query = employeeSearchQuery.toLowerCase();
      filtered = filtered.filter((employee) => {
        const name = (employee.name || "").toLowerCase();
        const id = (employee.userId || "").toLowerCase();
        const role = (employee.role || "").toLowerCase();
        return name.includes(query) || id.includes(query) || role.includes(query);
      });
    }

    return filtered;
  }, [displayEmployees, employeeSearchQuery, employeeRoleFilter]);

  const filteredCenters = useMemo(() => {
    let filtered = centers;

    // Filter by status
    if (centerStatusFilter !== "all") {
      filtered = filtered.filter((center) => 
        centerStatusFilter === "active" ? center.isActive : !center.isActive
      );
    }

    // Filter by search query
    if (centerSearchQuery.trim()) {
      const query = centerSearchQuery.toLowerCase();
      filtered = filtered.filter((center) =>
        center.centerName.toLowerCase().includes(query) ||
        center.location.toLowerCase().includes(query) ||
        center.centerAgent.toLowerCase().includes(query) ||
        center.centerId.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [centers, centerSearchQuery, centerStatusFilter]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} userAvatar={userAvatar} onLogout={handleLogout} />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="space-y-2 mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Administrator</h1>
          <p className="text-sm text-muted-foreground">Manage employees, collection centers, monitoring and reports.</p>
        </div>

        <Tabs defaultValue="employees" className="w-full">
          <TabsList className="mb-6 w-full sm:w-auto grid grid-cols-4 sm:inline-flex">
            <TabsTrigger value="employees" className="text-xs sm:text-sm">
              Employees
            </TabsTrigger>
            <TabsTrigger value="centers" className="text-xs sm:text-sm">
              Centers
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="text-xs sm:text-sm">
              Monitoring
            </TabsTrigger>
            <TabsTrigger value="reports" className="text-xs sm:text-sm">
              Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="employees" className="space-y-6">
            <div className="rounded-2xl border bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 p-4 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <h2 className="text-lg sm:text-xl font-semibold">Employees</h2>
                <div className="flex flex-1 flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
                  <div className="relative w-full sm:w-64 order-2 sm:order-none">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search employees"
                      value={employeeSearchQuery}
                      onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button
                    onClick={() => navigate("/admin/add-employee")}
                    className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Employee
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-muted/40 px-3 py-3 text-xs sm:text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Overview</span>
                <span>All: {employees.length}</span>
                <span>Field Collection: {employees.filter(e => e.role === "Field Collection").length}</span>
                <span>Processing: {employees.filter(e => e.role === "Processing").length}</span>
                <span>Packaging: {employees.filter(e => e.role === "Packaging").length}</span>
                <span>Labeling: {employees.filter(e => e.role === "Labeling").length}</span>
              </div>

              <div className="mt-4">
                <ToggleSelector
                  options={[
                    { value: "all", label: "All", count: employees.length },
                    { value: "Field Collection", label: "Field Collection", count: employees.filter(e => e.role === "Field Collection").length },
                    { value: "Processing", label: "Processing", count: employees.filter(e => e.role === "Processing").length },
                    { value: "Packaging", label: "Packaging", count: employees.filter(e => e.role === "Packaging").length },
                    { value: "Labeling", label: "Labeling", count: employees.filter(e => e.role === "Labeling").length },
                  ]}
                  value={employeeRoleFilter}
                  onChange={(v) => setEmployeeRoleFilter(v as typeof employeeRoleFilter)}
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading employees...
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground text-center shadow-sm">
                {employeeSearchQuery || employeeRoleFilter !== "all" ? "No employees match your filters." : "No employees found."}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEmployees.map((employee) => (
                  <div key={employee.id} className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm transition-shadow hover:shadow-md">
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
                          variant="destructive"
                          size="sm"
                          className="flex-1 sm:flex-none"
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

          <TabsContent value="centers" className="space-y-6">
            {showCenterForm ? (
              <CenterForm
                center={editingCenter}
                onSuccess={handleCenterSuccess}
                onCancel={handleCenterCancel}
              />
            ) : (
              <>
             <div className="rounded-2xl border bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 p-4 sm:p-6">
               <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                 <h2 className="text-lg sm:text-xl font-semibold">Collection Centers</h2>
                 <div className="flex flex-1 flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
                   <div className="relative w-full sm:w-64 order-2 sm:order-none">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                     <Input
                       placeholder="Search centers"
                       value={centerSearchQuery}
                       onChange={(e) => setCenterSearchQuery(e.target.value)}
                       className="pl-10"
                     />
                   </div>
                   <Button
                     onClick={() => setShowCenterForm(true)}
                     className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto"
                   >
                     <Plus className="h-4 w-4 mr-2" />
                     Add Center
                   </Button>
                 </div>
               </div>

               <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-muted/40 px-3 py-3 text-xs sm:text-sm text-muted-foreground">
                 <span className="font-medium text-foreground">Overview</span>
                 <span>All: {centers.length}</span>
                 <span>Active: {centers.filter(c => c.isActive).length}</span>
                 <span>Inactive: {centers.filter(c => !c.isActive).length}</span>
               </div>

               <div className="mt-4">
                 <ToggleSelector
                   options={[
                     { value: "all", label: "All", count: centers.length },
                     { value: "active", label: "Active", count: centers.filter(c => c.isActive).length },
                     { value: "inactive", label: "Inactive", count: centers.filter(c => !c.isActive).length },
                   ]}
                   value={centerStatusFilter}
                   onChange={(v) => setCenterStatusFilter(v as typeof centerStatusFilter)}
                 />
               </div>
             </div>

                {centersLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading centers...
                  </div>
                ) : filteredCenters.length === 0 ? (
                  <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground text-center shadow-sm">
                    <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    {centerSearchQuery ? "No centers match your search." : "No centers found."}
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {filteredCenters.map((center) => (
                      <div key={center.id} className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm transition-shadow hover:shadow-md">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-sm sm:text-base">{center.centerName}</h3>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                center.isActive 
                                  ? "bg-green-100 text-green-800" 
                                  : "bg-gray-100 text-gray-800"
                              }`}>
                                {center.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                            <div className="space-y-1 text-xs sm:text-sm text-muted-foreground">
                              <p><strong>ID:</strong> {center.centerId}</p>
                              <p><strong>Location:</strong> {center.location}</p>
                              <p><strong>Agent:</strong> {center.centerAgent}</p>
                              {center.contactPhone && (
                                <p><strong>Phone:</strong> {center.contactPhone}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditCenter(center)}
                              className="flex-1 sm:flex-none"
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeleteCenterTarget(center)}
                              className="flex-1 sm:flex-none"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
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
                  <div key={module} className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm">
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

      <AlertDialog open={!!deleteCenterTarget} onOpenChange={(open) => !open && setDeleteCenterTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete center?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently remove {deleteCenterTarget?.centerName} ({deleteCenterTarget?.centerId}). 
              This cannot be undone. Centers with associated buckets cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCenter} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
