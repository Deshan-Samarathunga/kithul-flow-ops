import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/field-collection" element={<FieldCollection />} />
          <Route path="/field-collection/draft/:draftId" element={<DraftDetail />} />
          <Route path="/field-collection/bucket/new" element={<BucketForm />} />
          <Route path="/field-collection/bucket/:bucketId/edit" element={<BucketForm />} />
          <Route path="/processing" element={<Processing />} />
          <Route path="/processing/batch/:batchId" element={<BatchDetail />} />
          <Route path="/packaging" element={<Packaging />} />
          <Route path="/labeling" element={<Labeling />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin/add-employee" element={<AddEmployee />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
