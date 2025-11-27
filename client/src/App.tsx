import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "@/lib/auth";
import RequireAuth from "@/lib/RequireAuth";
import RequireRole from "@/lib/RequireRole";

const Login = lazy(() => import("./pages/Login"));
const FieldCollection = lazy(() => import("./pages/FieldCollection"));
const DraftDetail = lazy(() => import("./pages/DraftDetail"));
const CenterCans = lazy(() => import("./pages/CenterCans"));
const CanForm = lazy(() => import("./pages/CanForm"));
const Processing = lazy(() => import("./pages/Processing"));
const BatchDetail = lazy(() => import("./pages/BatchDetail"));
const Packaging = lazy(() => import("./pages/Packaging"));
const Labeling = lazy(() => import("./pages/Labeling"));
const PackagingBatchDetail = lazy(() => import("./pages/PackagingBatchDetail"));
const LabelingBatchDetail = lazy(() => import("./pages/LabelingBatchDetail"));
const Admin = lazy(() => import("./pages/Admin"));
const Profile = lazy(() => import("./pages/Profile"));
const AddEmployee = lazy(() => import("./pages/AddEmployee"));
const EditEmployee = lazy(() => import("./pages/EditEmployee"));
const NotFound = lazy(() => import("./pages/NotFound"));

const LoadingScreen = () => (
  <div className="flex min-h-[60vh] items-center justify-center px-4 text-sm text-muted-foreground">
    Loading…
  </div>
);

const queryClient = new QueryClient();

const isElectron = navigator.userAgent.toLowerCase().includes("electron/");
const Router = isElectron ? HashRouter : BrowserRouter;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
  <Toaster />
        <Router>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
            {/* public */}
            <Route path="/" element={<Login />} />

            {/* protected - role-based */}
            <Route
              path="/field-collection"
              element={
                <RequireAuth>
                  <RequireRole allow={["Field Collection", "Administrator"]}>
                    <FieldCollection />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/field-collection/draft/new"
              element={
                <RequireAuth>
                  <RequireRole allow={["Field Collection", "Administrator"]}>
                    <DraftDetail />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/field-collection/draft/:draftId"
              element={
                <RequireAuth>
                  <RequireRole allow={["Field Collection", "Administrator"]}>
                    <DraftDetail />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/field-collection/draft/:draftId/center/:centerId"
              element={
                <RequireAuth>
                  <RequireRole allow={["Field Collection", "Administrator"]}>
                    <CenterCans />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/field-collection/can/new"
              element={
                <RequireAuth>
                  <RequireRole allow={["Field Collection", "Administrator"]}>
                    <CanForm />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/field-collection/can/:canId/edit"
              element={
                <RequireAuth>
                  <RequireRole allow={["Field Collection", "Administrator"]}>
                    <CanForm />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/processing"
              element={
                <RequireAuth>
                  <RequireRole allow={["Processing", "Administrator"]}>
                    <Processing />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/processing/batch/:batchId"
              element={
                <RequireAuth>
                  <RequireRole allow={["Processing", "Administrator"]}>
                    <BatchDetail />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/packaging"
              element={
                <RequireAuth>
                  <RequireRole allow={["Packaging", "Administrator"]}>
                    <Packaging />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/packaging/batch/:packagingId"
              element={
                <RequireAuth>
                  <RequireRole allow={["Packaging", "Administrator"]}>
                    <PackagingBatchDetail />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/labeling"
              element={
                <RequireAuth>
                  <RequireRole allow={["Labeling", "Administrator"]}>
                    <Labeling />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/labeling/batch/:packagingId"
              element={
                <RequireAuth>
                  <RequireRole allow={["Labeling", "Administrator"]}>
                    <LabelingBatchDetail />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <RequireRole allow={["Administrator"]}>
                    <Admin />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/admin/add-employee"
              element={
                <RequireAuth>
                  <RequireRole allow={["Administrator"]}>
                    <AddEmployee />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/admin/employees/:userId/edit"
              element={
                <RequireAuth>
                  <RequireRole allow={["Administrator"]}>
                    <EditEmployee />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <Profile />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </Router>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
