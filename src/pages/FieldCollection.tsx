import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { SecondaryToolbar } from "@/components/SecondaryToolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { mockDrafts } from "@/lib/mockData";
import { toast } from "sonner";

export default function FieldCollection() {
  const navigate = useNavigate();
  const userRole = sessionStorage.getItem("userRole") || "Guest";
  const userName = sessionStorage.getItem("userName") || "User";
  const [searchQuery, setSearchQuery] = useState("");
  
  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/");
  };

  const draftCollections = mockDrafts.filter((d) => d.status === "draft");
  const submittedCollections = mockDrafts.filter((d) => d.status === "submitted");

  return (
    <div className="min-h-screen bg-background">
      <Navbar userRole={userRole} userName={userName} onLogout={handleLogout} />
      
      <div className="container mx-auto px-6 py-8">
        <Tabs defaultValue="sap" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="sap">Sap Collection</TabsTrigger>
            <TabsTrigger value="treacle">Treacle Collection</TabsTrigger>
          </TabsList>
          
          <TabsContent value="sap" className="space-y-6">
            <SecondaryToolbar>
              <div className="flex items-center gap-3 flex-1">
                <Button
                  onClick={() => navigate("/field-collection/draft/new")}
                  className="bg-cta hover:bg-cta-hover text-cta-foreground"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Collection
                </Button>
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search collections..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Badge variant="secondary" className="ml-auto">
                  {draftCollections.length} Drafts
                </Badge>
              </div>
            </SecondaryToolbar>

            {/* Drafts */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Drafts</h2>
              {draftCollections.map((draft) => (
                <div
                  key={draft.id}
                  className="bg-card border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold">Draft collection : {draft.date}</h3>
                      <p className="text-sm text-muted-foreground">
                        Active buckets: {draft.buckets.length}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/field-collection/draft/${draft.id}`)}
                      >
                        Continue
                      </Button>
                      <Button
                        onClick={() => {
                          toast.success("Collection submitted successfully");
                        }}
                        className="bg-cta hover:bg-cta-hover text-cta-foreground"
                      >
                        Submit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toast.success("Draft deleted")}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Submitted History */}
            <div className="space-y-4 pt-8 border-t">
              <h2 className="text-xl font-semibold">Completed History</h2>
              {submittedCollections.map((draft) => (
                <div
                  key={draft.id}
                  className="bg-muted/50 border rounded-lg p-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold">Draft collection : {draft.date}</h3>
                      <p className="text-sm text-muted-foreground">
                        Active buckets: {draft.buckets.length}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/field-collection/draft/${draft.id}`)}
                      >
                        View
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => toast.success("Collection reopened")}
                      >
                        Reopen
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="treacle" className="space-y-6">
            <SecondaryToolbar>
              <div className="flex items-center gap-3 flex-1">
                <Button className="bg-cta hover:bg-cta-hover text-cta-foreground">
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Collection
                </Button>
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search collections..." />
                </div>
              </div>
            </SecondaryToolbar>
            <div className="text-center py-12 text-muted-foreground">
              Treacle collections will appear here
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
