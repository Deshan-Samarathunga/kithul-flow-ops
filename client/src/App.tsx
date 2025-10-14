import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "@/lib/auth";
import RequireAuth from "@/lib/RequireAuth";
import RequireRole from "@/lib/RequireRole";

import Login from "./pages/Login";
import FieldCollection from "./pages/FieldCollection";
import DraftDetail from "./pages/DraftDetail";
import BucketForm from "./pages/BucketForm";
import Processing from "./pages/Processing";
import BatchDetail from "./pages/BatchDetail";
import Packaging from "./pages/Packaging";
import Labeling from "./pages/Labeling";
import Admin from "./pages/Admin";
import Profile from "./pages/Profile";
import AddEmployee from "./pages/AddEmployee";
import EditEmployee from "./pages/EditEmployee";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* public */}
            <Route path="/" element={<Login />} />

            {/* protected - role-based */}
            <Route path="/field-collection" element={
              <RequireAuth>
                <RequireRole allow={["Field Collection", "Administrator"]}>
                  <FieldCollection />
                </RequireRole>
              </RequireAuth>
            } />
            <Route path="/field-collection/draft/:draftId" element={
              <RequireAuth>
                <RequireRole allow={["Field Collection", "Administrator"]}>
                  <DraftDetail />
                </RequireRole>
              </RequireAuth>
            } />
            <Route path="/field-collection/bucket/new" element={
              <RequireAuth>
                <RequireRole allow={["Field Collection", "Administrator"]}>
                  <BucketForm />
                </RequireRole>
              </RequireAuth>
            } />
            <Route path="/field-collection/bucket/:bucketId/edit" element={
              <RequireAuth>
                <RequireRole allow={["Field Collection", "Administrator"]}>
                  <BucketForm />
                </RequireRole>
              </RequireAuth>
            } />
            <Route path="/processing" element={
              <RequireAuth>
                <RequireRole allow={["Processing", "Administrator"]}>
                  <Processing />
                </RequireRole>
              </RequireAuth>
            } />
            <Route path="/processing/batch/:batchId" element={
              <RequireAuth>
                <RequireRole allow={["Processing", "Administrator"]}>
                  <BatchDetail />
                </RequireRole>
              </RequireAuth>
            } />
            <Route path="/packaging" element={
              <RequireAuth>
                <RequireRole allow={["Packaging", "Administrator"]}>
                  <Packaging />
                </RequireRole>
              </RequireAuth>
            } />
            <Route path="/labeling" element={
              <RequireAuth>
                <RequireRole allow={["Labeling", "Administrator"]}>
                  <Labeling />
                </RequireRole>
              </RequireAuth>
            } />
            <Route path="/admin" element={
              <RequireAuth>
                <RequireRole allow={["Administrator"]}>
                  <Admin />
                </RequireRole>
              </RequireAuth>
            } />
            <Route path="/admin/add-employee" element={
              <RequireAuth>
                <RequireRole allow={["Administrator"]}>
                  <AddEmployee />
                </RequireRole>
              </RequireAuth>
            } />
            <Route path="/admin/employees/:userId/edit" element={
              <RequireAuth>
                <RequireRole allow={["Administrator"]}>
                  <EditEmployee />
                </RequireRole>
              </RequireAuth>
            } />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
