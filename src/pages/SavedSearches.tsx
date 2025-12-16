import { useState, ChangeEvent } from "react";
import { authService, savedSearchesService } from "@/api/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Bookmark, 
  Bell, 
  BellOff, 
  Trash2, 
  Search,
  Plus,
  Mail,
  Filter
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { SavedSearch, User } from "@/types";

interface NewSearchState {
  name: string;
  searchQuery: string;
  category: string;
  priceMin: number;
  priceMax: number;
  radiusMiles: number;
  emailAlerts: boolean;
  alertFrequency: string;
}

interface ToggleAlertsParams {
  searchId: string;
  enabled: boolean;
}

export default function SavedSearches() {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<SavedSearch | null>(null);
  const [newSearch, setNewSearch] = useState<NewSearchState>({
    name: "",
    searchQuery: "",
    category: "all",
    priceMin: 0,
    priceMax: 200,
    radiusMiles: 10,
    emailAlerts: true,
    alertFrequency: "daily"
  });

  const { data: currentUserData } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => authService.getCurrentUser(),
  });

  const currentUser: User | undefined = currentUserData?.user;

  const { data: savedSearchesData } = useQuery({
    queryKey: ['savedSearches', currentUser?.id],
    queryFn: () => savedSearchesService.list(),
    enabled: !!currentUser?.id,
  });

  const savedSearches: SavedSearch[] = savedSearchesData?.savedSearches || [];

  const createSearchMutation = useMutation({
    mutationFn: (searchData: NewSearchState) => savedSearchesService.create({
      name: searchData.name,
      filters: {
        query: searchData.searchQuery,
        category: searchData.category,
        priceMin: searchData.priceMin,
        priceMax: searchData.priceMax,
        radiusMiles: searchData.radiusMiles,
        emailAlerts: searchData.emailAlerts,
        alertFrequency: searchData.alertFrequency,
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedSearches'] });
      setShowAddDialog(false);
      setNewSearch({
        name: "",
        searchQuery: "",
        category: "all",
        priceMin: 0,
        priceMax: 200,
        radiusMiles: 10,
        emailAlerts: true,
        alertFrequency: "daily"
      });
    },
  });

  const deleteSearchMutation = useMutation({
    mutationFn: (searchId: string) => savedSearchesService.delete(searchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedSearches'] });
      setDeleteConfirm(null);
    },
  });

  const toggleAlertsMutation = useMutation({
    mutationFn: ({ searchId, enabled }: ToggleAlertsParams) => 
      savedSearchesService.update(searchId, { 
        filters: { emailAlerts: enabled } 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedSearches'] });
    },
  });

  const handleCreateSearch = () => {
    if (!newSearch.name || !newSearch.searchQuery) return;
    createSearchMutation.mutate(newSearch);
  };

  // Helper to get filter values from saved search
  const getFilter = (search: SavedSearch, key: string): unknown => {
    return search.filters?.[key];
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Saved Searches</h1>
            <p className="text-gray-600">Get notified when new matches appear</p>
          </div>
          <Button
            onClick={() => setShowAddDialog(!showAddDialog)}
            className="bg-brand-800 hover:bg-brand-900"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Search
          </Button>
        </div>

        {/* Add Search Form */}
        {showAddDialog && (
          <Card className="border-none shadow-lg mb-6">
            <CardHeader>
              <CardTitle>Create Saved Search</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Search Name *</label>
                <Input
                  placeholder="e.g., Weekend Table Saw"
                  value={newSearch.name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNewSearch({...newSearch, name: e.target.value})}
                  maxLength={100}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Search Query *</label>
                <Input
                  placeholder="e.g., table saw"
                  value={newSearch.searchQuery}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNewSearch({...newSearch, searchQuery: e.target.value})}
                  maxLength={200}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <Select 
                    value={newSearch.category} 
                    onValueChange={(value) => setNewSearch({...newSearch, category: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="tools">Tools</SelectItem>
                      <SelectItem value="expertise">Expertise</SelectItem>
                      <SelectItem value="space">Space</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Alert Frequency</label>
                  <Select 
                    value={newSearch.alertFrequency} 
                    onValueChange={(value) => setNewSearch({...newSearch, alertFrequency: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instant">Instant</SelectItem>
                      <SelectItem value="daily">Daily Digest</SelectItem>
                      <SelectItem value="weekly">Weekly Summary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Price Range: £{newSearch.priceMin} - £{newSearch.priceMax}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={newSearch.priceMin}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setNewSearch({...newSearch, priceMin: Math.max(0, parseInt(e.target.value) || 0)})}
                      placeholder="Min"
                    />
                    <Input
                      type="number"
                      min="0"
                      value={newSearch.priceMax}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setNewSearch({...newSearch, priceMax: Math.max(0, parseInt(e.target.value) || 200)})}
                      placeholder="Max"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Radius: {newSearch.radiusMiles} miles
                  </label>
                  <Input
                    type="range"
                    min="1"
                    max="25"
                    value={newSearch.radiusMiles}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNewSearch({...newSearch, radiusMiles: parseInt(e.target.value)})}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={newSearch.emailAlerts}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNewSearch({...newSearch, emailAlerts: e.target.checked})}
                  className="w-4 h-4"
                />
                <div className="text-sm">
                  <p className="font-medium text-blue-900">Enable Email Alerts</p>
                  <p className="text-blue-700">Get notified when new matches are posted</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowAddDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateSearch}
                  disabled={!newSearch.name || !newSearch.searchQuery || createSearchMutation.isPending}
                  className="flex-1 bg-brand-800 hover:bg-brand-900"
                >
                  Save Search
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Saved Searches List */}
        {savedSearches.length === 0 ? (
          <Card className="border-none shadow-lg">
            <CardContent className="py-12 text-center">
              <Bookmark className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">No Saved Searches</h3>
              <p className="text-gray-600 mb-6">
                Save your searches to get alerts when new matches appear
              </p>
              <Button
                onClick={() => setShowAddDialog(true)}
                variant="outline"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Search
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {savedSearches.map((search) => {
              const emailAlerts = getFilter(search, 'emailAlerts') as boolean;
              const query = getFilter(search, 'query') as string;
              const category = getFilter(search, 'category') as string;
              const priceMin = getFilter(search, 'priceMin') as number;
              const priceMax = getFilter(search, 'priceMax') as number;
              const radiusMiles = getFilter(search, 'radiusMiles') as number;
              const alertFrequency = getFilter(search, 'alertFrequency') as string;

              return (
                <Card key={search.id} className="border-none shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold">{search.name}</h3>
                          {emailAlerts ? (
                            <Badge className="bg-green-100 text-green-800">
                              <Bell className="w-3 h-3 mr-1" />
                              Alerts On
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <BellOff className="w-3 h-3 mr-1" />
                              Alerts Off
                            </Badge>
                          )}
                        </div>
                        <p className="text-gray-600 mb-3">"{query}"</p>
                        
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Badge variant="outline" className="capitalize">
                            <Filter className="w-3 h-3 mr-1" />
                            {category}
                          </Badge>
                          <Badge variant="outline">
                            £{priceMin}-£{priceMax}
                          </Badge>
                          <Badge variant="outline">
                            {radiusMiles} mi radius
                          </Badge>
                          {emailAlerts && (
                            <Badge variant="outline">
                              <Mail className="w-3 h-3 mr-1" />
                              {alertFrequency}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => toggleAlertsMutation.mutate({
                            searchId: search.id,
                            enabled: !emailAlerts
                          })}
                        >
                          {emailAlerts ? (
                            <BellOff className="w-4 h-4" />
                          ) : (
                            <Bell className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setDeleteConfirm(search)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <Link to={createPageUrl(`Search?q=${encodeURIComponent(query || '')}`)}>
                      <Button variant="outline" className="w-full">
                        <Search className="w-4 h-4 mr-2" />
                        Run This Search Now
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Saved Search?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "<strong>{deleteConfirm.name}</strong>"? 
                You will no longer receive alerts for this search. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteSearchMutation.mutate(deleteConfirm.id)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete Search
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
