import { useState, useEffect } from "react";
import { authService, usersService, reviewsService, transactionsService } from "@/api/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import useAuth from "@/hooks/use-auth";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wrench, Star, Warehouse, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Profile sub-components - New redesigned components
import ProfileHeader from "../components/profile/ProfileHeader";
import GettingStartedCard from "../components/profile/GettingStartedCard";
import ActivityTimeline from "../components/profile/ActivityTimeline";
import ReviewsSection from "../components/profile/ReviewsSection";

// Legacy components still in use
import MyTools from "../components/profile/MyTools";
import MySpaces from "../components/profile/MySpaces";
import EditProfileDialog from "../components/profile/EditProfileDialog";
import BadgeDisplay from "../components/gamification/BadgeDisplay";

// Auth page (shown when not logged in)
import AuthPage from "../components/auth/AuthPage";
import SEO from "@/components/SEO";
import { toast } from "sonner";

import type { Tool, Space, Review, Transaction, PaginatedResponse } from "@/types";
import type { UserListings } from "@/api/services/users";

export default function Profile(): JSX.Element {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isWizardMode, setIsWizardMode] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [hasHandledWelcome, setHasHandledWelcome] = useState(false);

  const { user: currentUser, isLoading } = useAuth();

  useEffect(() => {
    if (hasHandledWelcome || isLoading || !currentUser) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const welcome = params.get('welcome');

    if (welcome !== '1') {
      return;
    }

    setHasHandledWelcome(true);

    const needsJobGateSetup =
      !currentUser?.emailVerified ||
      !currentUser?.name ||
      !(currentUser?.locationAddress || currentUser?.postcode);

    if (needsJobGateSetup) {
      toast.success("Complete your profile to post a job.");

      const canFixInEditDialog =
        !currentUser?.name ||
        !(currentUser?.locationAddress || currentUser?.postcode);

      if (canFixInEditDialog) {
        setIsWizardMode(true);
        setShowEditDialog(true);
      }
    }

    params.delete('welcome');
    params.delete('redirect');
    const nextSearch = params.toString();
    navigate(
      {
        pathname: '/profile',
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true }
    );
  }, [currentUser, hasHandledWelcome, isLoading, location.search, navigate]);

  useEffect(() => {
    if (!isRedirecting) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const redirect = params.get('redirect');

    if (!redirect || !currentUser || isLoading) {
      setIsRedirecting(false);
    }
  }, [currentUser, isLoading, isRedirecting, location.search]);

  // If user is logged in and there's a redirect param, redirect them
  useEffect(() => {
    if (currentUser && !isLoading) {
      const params = new URLSearchParams(location.search);
      const redirect = params.get('redirect');
      if (redirect) {
        const isSafeInternalRedirect = redirect.startsWith('/') && !redirect.startsWith('//');
        if (!isSafeInternalRedirect) {
          return;
        }
        setIsRedirecting(true);
        navigate(redirect, { replace: true });
      }
    }
  }, [currentUser, isLoading, location.search, navigate]);

  const { data: listingsData } = useQuery<UserListings>({
    queryKey: ['myListings', currentUser?.id],
    queryFn: () => usersService.getListings(currentUser!.id),
    enabled: !!currentUser?.id,
  });

  const tools: Tool[] = listingsData?.tools ?? [];
  const spaces: Space[] = listingsData?.spaces ?? [];

  const { data: reviewsData } = useQuery<PaginatedResponse<Review>>({
    queryKey: ['myReviews', currentUser?.id],
    queryFn: () => reviewsService.getByUser(currentUser!.id),
    enabled: !!currentUser?.id,
  });

  const reviews: Review[] = reviewsData?.data ?? [];

  const { data: transactionsData } = useQuery<Transaction[]>({
    queryKey: ['myTransactions', currentUser?.id],
    queryFn: async () => {
      const asUser = await transactionsService.list({});
      const asProvider = await transactionsService.list({ asProvider: true });
      return [
        ...(asUser.data ?? []),
        ...(asProvider.data ?? [])
      ];
    },
    enabled: !!currentUser?.id,
  });

  const transactions: Transaction[] = transactionsData || [];

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      queryClient.clear();
      navigate('/');
    },
  });

  const handleLogout = (): void => {
    logoutMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-48 w-full rounded-xl mb-6" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Show auth page when not logged in
  if (!currentUser) {
    return <AuthPage />;
  }

  // Show loading while redirecting (user just logged in with redirect param)
  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-brand-800 mx-auto mb-4" />
          <p className="text-gray-400">Signing you in...</p>
        </div>
      </div>
    );
  }

  const completedCount = transactions.filter(t => t.status === 'COMPLETED').length;
  const needsSetup =
    !currentUser?.emailVerified ||
    !currentUser?.phone ||
    !(currentUser?.name && currentUser?.bio) ||
    !(currentUser?.locationAddress || currentUser?.postcode);

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <SEO
        title={`${currentUser?.name || 'User'} Profile - SpannerWork`}
        description={currentUser?.bio || `View ${currentUser?.name || currentUser?.email}'s profile, tools, reviews and ratings on SpannerWork.`}
        keywords="mechanic profile, tool owner, service provider, user reviews, ratings"
      />

      {/* Hero Section */}
      <ProfileHeader
        currentUser={currentUser}
        tools={tools}
        reviews={reviews}
        transactions={transactions}
        onEditProfile={() => setShowEditDialog(true)}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10 pb-12">
        
        {/* Getting Started - Full width, prominent for new users */}
        {needsSetup && (
          <div className="mb-8">
            <GettingStartedCard 
              user={currentUser}
              tools={tools}
              transactions={transactions}
              onEditProfile={() => setShowEditDialog(true)}
            />
          </div>
        )}

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 lg:gap-6">
          
          {/* Stats & Achievements Row */}
          <div className="md:col-span-2 lg:col-span-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Rating Card */}
              <Card className="border-none shadow-lg bg-gradient-to-br from-brand-800 to-brand-900 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                      <Star className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-white/70 text-sm font-medium">Your Rating</p>
                      <p className="text-4xl font-bold">
                        {reviews.length > 0 ? (currentUser?.rating ?? 0).toFixed(1) : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-5 border-t border-white/20">
                    <div>
                      <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Reviews</p>
                      <p className="text-2xl font-bold">{reviews.length}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Completed</p>
                      <p className="text-2xl font-bold">{completedCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Achievements/Badges */}
              <div className="lg:col-span-2">
                <BadgeDisplay showProgress={true} compact={false} variant="profile" />
              </div>
            </div>
          </div>

          {/* My Listings - Large card */}
          <div className="md:col-span-2 lg:col-span-8">
            <Card className="border-none shadow-lg h-full">
              <Tabs defaultValue="tools" className="w-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-4">
                    <TabsList className="bg-gray-100 p-1 rounded-lg">
                      <TabsTrigger 
                        value="tools" 
                        className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 rounded-md text-sm"
                      >
                        <Wrench className="w-4 h-4 mr-2" />
                        My Tools ({tools.length})
                      </TabsTrigger>
                      <TabsTrigger 
                        value="spaces"
                        className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 rounded-md text-sm"
                      >
                        <Warehouse className="w-4 h-4 mr-2" />
                        My Spaces ({spaces.length})
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </CardHeader>
                <CardContent>
                  <TabsContent value="tools" className="mt-0">
                    <div className="flex justify-end mb-4">
                      <Button 
                        onClick={() => navigate('/create?type=tool')}
                        className="bg-brand-800 hover:bg-brand-900 text-white"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Tool
                      </Button>
                    </div>
                    <MyTools tools={tools} currentUser={currentUser} />
                  </TabsContent>
                  <TabsContent value="spaces" className="mt-0">
                    <div className="flex justify-end mb-4">
                      <Button 
                        onClick={() => navigate('/create?type=space')}
                        className="bg-brand-800 hover:bg-brand-900 text-white"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Space
                      </Button>
                    </div>
                    <MySpaces spaces={spaces} />
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </div>

          {/* Activity Timeline - Sidebar */}
          <div className="lg:col-span-4 lg:row-span-2">
            <ActivityTimeline 
              tools={tools}
              spaces={spaces}
              transactions={transactions}
              reviews={reviews}
              limit={6}
              className="h-full"
            />
          </div>

          {/* Reviews Section */}
          <div className="md:col-span-2 lg:col-span-8">
            <ReviewsSection reviews={reviews} />
          </div>
        </div>
      </div>

      {/* Edit Profile Dialog */}
      {showEditDialog && (
        <EditProfileDialog
          user={currentUser}
          wizardMode={isWizardMode}
          onClose={() => {
            setShowEditDialog(false);
            setIsWizardMode(false);
          }}
        />
      )}
    </div>
  );
}
