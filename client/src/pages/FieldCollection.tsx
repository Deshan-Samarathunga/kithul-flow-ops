import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { SecondaryToolbar } from "@/components/SecondaryToolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { DataService } from "@/lib/dataService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function FieldCollection() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const userRole = user?.role || "Guest";
  const userName = user?.name || user?.userId || "User";
  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL || "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }, []);
  const userAvatar = user?.profileImage ? new URL(user.profileImage, apiBase).toString() : undefined;
  const [searchQuery, setSearchQuery] = useState("");
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleCreateDraft = async () => {
    try {
      setLoading(true);
      const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      const newDraft = await DataService.createDraft('sap', currentDate); // Default to sap, will be changed later
      
      toast.success('Collection draft created successfully');
      
      // Refresh the drafts list
      const data = await DataService.getDrafts();
      setDrafts(data);
      
      // Navigate to the new draft
      navigate(`/field-collection/draft/${newDraft.draft_id}`);
      
    } catch (error) {
      console.error('Error creating draft:', error);
      toast.error('Failed to create draft');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    try {
      setLoading(true);
      await DataService.deleteDraft(draftId);
      
      toast.success('Draft deleted successfully');
      
      // Refresh the drafts list
      const data = await DataService.getDrafts();
      setDrafts(data);
      
    } catch (error) {
      console.error('Error deleting draft:', error);
      toast.error('Failed to delete draft');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDraft = async (draftId: string) => {
    try {
      setLoading(true);
      await DataService.submitDraft(draftId);
      
      toast.success('Draft submitted successfully');
      
      // Refresh the drafts list
      const data = await DataService.getDrafts();
      setDrafts(data);
      
    } catch (error) {
      console.error('Error submitting draft:', error);
      toast.error('Failed to submit draft');
    } finally {
      setLoading(false);
    }
  };

  const handleReopenDraft = async (draftId: string) => {
    try {
      setLoading(true);
      await DataService.reopenDraft(draftId);
      
      toast.success('Draft reopened successfully');
      
      // Refresh the drafts list
      const data = await DataService.getDrafts();
      setDrafts(data);
      
    } catch (error) {
      console.error('Error reopening draft:', error);
      toast.error('Failed to reopen draft');
    } finally {
      setLoading(false);
    }
  };


  // Load drafts from API
  useEffect(() => {
    const loadDrafts = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await DataService.getDrafts();
        setDrafts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load drafts');
        toast.error('Failed to load drafts');
      } finally {
        setLoading(false);
      }
    };

    loadDrafts();
  }, []);

  // Filter drafts by search query
  const filteredDrafts = drafts.filter(
    (draft) =>
      draft.date.toLowerCase().includes(searchQuery.toLowerCase()) ||
      draft.draft_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Separate active and submitted drafts
  const draftCollections = filteredDrafts.filter(draft => draft.status === 'draft');
  const submittedCollections = filteredDrafts.filter(draft => draft.status === 'submitted');

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} userAvatar={userAvatar} onLogout={handleLogout} />
      
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="space-y-6">
            <SecondaryToolbar>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 w-full">
                <Button
                onClick={() => handleCreateDraft()}
                disabled={loading}
                  className="bg-cta hover:bg-cta-hover text-cta-foreground w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                {loading ? 'Creating...' : 'Add New'}
                </Button>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Badge variant="secondary" className="sm:ml-auto">
                  {draftCollections.length} Drafts
                </Badge>
              </div>
            </SecondaryToolbar>

            {/* Drafts */}
            <div className="space-y-4">
              <h2 className="text-lg sm:text-xl font-semibold">Drafts</h2>
              {draftCollections.map((draft) => (
                <div
                  key={draft.id}
                  className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                    <h3 className="font-semibold text-sm sm:text-base">Collection draft : {new Date(draft.date).toISOString().split('T')[0]}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                      Active buckets: {draft.bucket_count}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                      onClick={() => navigate(`/field-collection/draft/${draft.draft_id}`)}
                        className="flex-1 sm:flex-none"
                      >
                        Continue
                      </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSubmitDraft(draft.draft_id)}
                      disabled={loading}
                      className="bg-cta hover:bg-cta-hover text-cta-foreground flex-1 sm:flex-none"
                    >
                      Submit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                          disabled={loading}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete draft?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action will permanently remove collection draft : {new Date(draft.date).toISOString().split('T')[0]}. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteDraft(draft.draft_id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Submitted History */}
            <div className="space-y-4 pt-8 border-t">
              <h2 className="text-lg sm:text-xl font-semibold">Completed History</h2>
              {submittedCollections.map((draft) => (
                <div
                  key={draft.id}
                  className="bg-muted/50 border rounded-lg p-4 sm:p-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                    <h3 className="font-semibold text-sm sm:text-base">Collection draft : {new Date(draft.date).toISOString().split('T')[0]}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                      Active buckets: {draft.bucket_count}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                      onClick={() => navigate(`/field-collection/draft/${draft.draft_id}`)}
                        className="flex-1 sm:flex-none"
                      >
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReopenDraft(draft.draft_id)}
                        disabled={loading}
                        className="flex-1 sm:flex-none"
                      >
                        Reopen
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
        </div>
      </div>
    </div>
  );
}