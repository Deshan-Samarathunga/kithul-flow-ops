import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, FileText, Loader2, Search, Edit, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { adminListUsers, AdminUser, adminDeleteUser, adminListCenters, AdminCenter, adminDeleteCenter } from "@/lib/api";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CenterForm } from "@/components/CenterForm";
import { ToggleSelector } from "@/components/ToggleSelector";
import { usePersistentTab } from "@/hooks/usePersistentTab";
import { usePersistentState } from "@/hooks/usePersistentState";
import { ReportGenerationDialog } from "@/components/ReportGenerationDialog";

const ROLES_FOR_EMPLOYEES = [
  "Field Collection",
  "Processing",
  "Packaging",
  "Labeling",
];

export default function Admin() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [adminTab, setAdminTab] = usePersistentTab("tabs.admin", "employees");

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
  const [employeeSearchQuery, setEmployeeSearchQuery] = usePersistentState<string>("admin.employees.search", "");
  const [employeeRoleFilter, setEmployeeRoleFilter] = usePersistentTab("filters.admin.employeeRole", "all") as unknown as [
    "all" | "Field Collection" | "Processing" | "Packaging" | "Labeling",
    (v: "all" | "Field Collection" | "Processing" | "Packaging" | "Labeling") => void
  ];
  
  // Centers state
  const [centers, setCenters] = useState<AdminCenter[]>([]);
  const [centersLoading, setCentersLoading] = useState(false);
  const [centerSearchQuery, setCenterSearchQuery] = usePersistentState<string>("admin.centers.search", "");
  const [centerStatusFilter, setCenterStatusFilter] = usePersistentTab("filters.admin.centerStatus", "all") as unknown as [
    "all" | "active" | "inactive",
    (v: "all" | "active" | "inactive") => void
  ];
  const [showCenterForm, setShowCenterForm] = useState(false);
  const [editingCenter, setEditingCenter] = useState<AdminCenter | null>(null);
  const [deleteCenterTarget, setDeleteCenterTarget] = useState<AdminCenter | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportStage, setReportStage] = useState<"field" | "processing" | "packaging" | "labeling">("field");

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

  const handleOpenReportDialog = (module: string) => {
    const stageMap: Record<string, "field" | "processing" | "packaging" | "labeling"> = {
      "Field Collection": "field",
      "Processing": "processing",
      "Packaging": "packaging",
      "Labeling": "labeling",
    };
    const stage = stageMap[module] || "field";
    setReportStage(stage);
    setReportDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} userAvatar={userAvatar} onLogout={handleLogout} />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="space-y-6 sm:space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Administrator</h1>
            <p className="text-sm text-muted-foreground">Manage employees, collection centers, monitoring and reports.</p>
          </div>

          <Tabs value={adminTab} onValueChange={setAdminTab} className="w-full">
            <div className="rounded-2xl border bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 p-4 sm:p-6 mb-6">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 w-full">
                <div className="inline-flex bg-muted/40 rounded-full p-1 w-full sm:w-auto">
                  <button
                    type="button"
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors duration-150 ${adminTab === "employees" ? "bg-cta hover:bg-cta-hover text-cta-foreground" : "text-foreground hover:bg-muted"}`}
                    onClick={() => setAdminTab("employees")}
                  >
                    Employees
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors duration-150 ${adminTab === "centers" ? "bg-cta hover:bg-cta-hover text-cta-foreground" : "text-foreground hover:bg-muted"}`}
                    onClick={() => setAdminTab("centers")}
                  >
                    Centers
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors duration-150 ${adminTab === "monitoring" ? "bg-cta hover:bg-cta-hover text-cta-foreground" : "text-foreground hover:bg-muted"}`}
                    onClick={() => setAdminTab("monitoring")}
                  >
                    Monitoring
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors duration-150 ${adminTab === "reports" ? "bg-cta hover:bg-cta-hover text-cta-foreground" : "text-foreground hover:bg-muted"}`}
                    onClick={() => setAdminTab("reports")}
                  >
                    Reports
                  </button>
                </div>
              </div>
            </div>

          <TabsContent value="employees" className="space-y-6">
            <div className="rounded-2xl border bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 w-full">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search Employees"
                    value={employeeSearchQuery}
                    onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  onClick={() => navigate("/admin/add-employee")}
                  className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto sm:ml-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Employee
                </Button>
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
              <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
                Loading employees…
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground text-center shadow-sm">
                {employeeSearchQuery || employeeRoleFilter !== "all" ? "No employees match your filters." : "No employees found."}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEmployees.map((employee) => (
                  <div key={employee.id} className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex flex-col space-y-1">
                        <h3 className="text-sm font-semibold text-foreground">{employee.name || employee.userId}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{employee.role}</span>
                          <span className="text-muted-foreground/40">|</span>
                          <span>ID: {employee.userId}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            employee.isActive 
                              ? "bg-green-100 text-green-700" 
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {employee.isActive ? "Active" : "Inactive"}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/admin/employees/${employee.id}/edit`)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
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
               <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 w-full">
                 <div className="relative flex-1">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                   <Input
                     placeholder="Search Centers"
                     value={centerSearchQuery}
                     onChange={(e) => setCenterSearchQuery(e.target.value)}
                     className="pl-10"
                   />
                 </div>
                 <Button
                   onClick={() => setShowCenterForm(true)}
                   className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto sm:ml-auto"
                 >
                   <Plus className="h-4 w-4 mr-2" />
                   Add Center
                 </Button>
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
                  <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
                    Loading centers…
                  </div>
                ) : filteredCenters.length === 0 ? (
                  <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground text-center shadow-sm">
                    <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    {centerSearchQuery ? "No centers match your search." : "No centers found."}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredCenters.map((center) => (
                      <div key={center.id} className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex flex-col space-y-1">
                            <h3 className="text-sm font-semibold text-foreground">{center.centerName}</h3>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>ID: {center.centerId}</span>
                              <span className="text-muted-foreground/40">|</span>
                              <span>Location: {center.location}</span>
                              <span className="text-muted-foreground/40">|</span>
                              <span>Agent: {center.centerAgent}</span>
                              {center.contactPhone && (
                                <>
                                  <span className="text-muted-foreground/40">|</span>
                                  <span>Phone: {center.contactPhone}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                center.isActive 
                                  ? "bg-green-100 text-green-700" 
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {center.isActive ? "Active" : "Inactive"}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditCenter(center)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeleteCenterTarget(center)}
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

          <TabsContent value="monitoring" className="space-y-6">
            <h2 className="text-lg font-semibold text-foreground">Module Monitoring</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div
                className="rounded-lg border bg-card shadow-sm text-center p-8 hover:shadow-md transition cursor-pointer focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-[#1890ff]"
                onClick={() => navigate("/field-collection")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    navigate("/field-collection");
                  }
                }}
                tabIndex={0}
                role="button"
              >
                <h3 className="text-base font-semibold text-foreground">Field Collection</h3>
              </div>
              <div
                className="rounded-lg border bg-card shadow-sm text-center p-8 hover:shadow-md transition cursor-pointer focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-[#1890ff]"
                onClick={() => navigate("/processing")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    navigate("/processing");
                  }
                }}
                tabIndex={0}
                role="button"
              >
                <h3 className="text-base font-semibold text-foreground">Processing</h3>
              </div>
              <div
                className="rounded-lg border bg-card shadow-sm text-center p-8 hover:shadow-md transition cursor-pointer focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-[#1890ff]"
                onClick={() => navigate("/packaging")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    navigate("/packaging");
                  }
                }}
                tabIndex={0}
                role="button"
              >
                <h3 className="text-base font-semibold text-foreground">Packaging</h3>
              </div>
              <div
                className="rounded-lg border bg-card shadow-sm text-center p-8 hover:shadow-md transition cursor-pointer focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-[#1890ff]"
                onClick={() => navigate("/labeling")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    navigate("/labeling");
                  }
                }}
                tabIndex={0}
                role="button"
              >
                <h3 className="text-base font-semibold text-foreground">Labeling</h3>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <h2 className="text-lg font-semibold text-foreground">Generate Reports</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {ROLES_FOR_EMPLOYEES.map((module) => (
                <div key={module} className="rounded-lg border bg-card shadow-sm p-6">
                  <h3 className="text-base font-semibold text-foreground mb-3">{module}</h3>
                  <Button
                    onClick={() => handleOpenReportDialog(module)}
                    className="w-full bg-cta hover:bg-cta-hover text-cta-foreground"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Download CSV/PDF
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
        </div>
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteCenterTarget} onOpenChange={(open) => !open && setDeleteCenterTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Center?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently remove {deleteCenterTarget?.centerName} ({deleteCenterTarget?.centerId}). 
              This cannot be undone. Centers with associated cans cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCenter} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReportGenerationDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        stage={reportStage}
      />
    </div>
  );
}
