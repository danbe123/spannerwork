import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authService, quickAcceptService, gamificationService, type UserStats, type PendingResponse } from '@/api/services';
import { queryKeys } from '@/lib/queryKeys';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import QuickAcceptCard from '@/components/provider/QuickAcceptCard';
import BadgeDisplay from '@/components/gamification/BadgeDisplay';
import LiveActivityFeed from '@/components/feed/LiveActivityFeed';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench,
  Star,
  CheckCircle,
  Clock,
  Inbox,
  ArrowRight,
  Zap,
  BarChart3,
  MessageCircle,
  ChevronRight,
  LucideIcon
} from 'lucide-react';
import SEO from '@/components/SEO';

interface QuickStat {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  urgent?: boolean;
  sub?: string;
}

/**
 * Provider Dashboard
 * 
 * Central hub for providers to:
 * - Accept/decline job requests
 * - View earnings and stats
 * - Track badges and achievements
 * - See local activity
 */
export default function ProviderDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('requests');

  // Get current user
  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () => authService.getCurrentUser(),
  });

  const user = userData?.user;

  // Get pending job requests
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: queryKeys.pendingResponses(),
    queryFn: () => quickAcceptService.getPending(),
    refetchInterval: 30000,
  });

  // Filter out any responses with null requests (edge case from deleted requests)
  const pendingResponses = (pendingData?.responses || []).filter(
    (r: PendingResponse) => r.request !== null && r.request !== undefined
  );

  // Get gamification stats
  const { data: statsData } = useQuery({
    queryKey: queryKeys.myStats(),
    queryFn: () => gamificationService.getMyStats(),
  });

  const stats: UserStats | undefined = statsData?.stats;

  // Quick stats for dashboard - all values from real backend data
  const quickStats: QuickStat[] = [
    {
      label: 'My Listings',
      value: stats?.totalListings?.toString() || '0',
      icon: Wrench,
      color: 'text-green-600 bg-green-100',
    },
    {
      label: 'Active Requests',
      value: pendingResponses.length.toString(),
      icon: Inbox,
      color: 'text-brand-600 bg-brand-100',
      urgent: pendingResponses.some((r: PendingResponse) => r.request?.urgency === 'ASAP'),
    },
    {
      label: 'Completed Jobs',
      value: stats?.totalTransactions?.toString() || '0',
      icon: CheckCircle,
      color: 'text-blue-600 bg-blue-100',
    },
    {
      label: 'Rating',
      value: stats?.rating?.toFixed(1) || '-',
      icon: Star,
      color: 'text-brand-600 bg-brand-100',
      sub: `${stats?.totalReviews || 0} reviews`,
    },
  ];

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO 
        title="Provider Dashboard - SpannerWork"
        description="Manage your jobs, track earnings, and respond to requests."
      />

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-500 to-brand-600 text-white">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-1">
                  Welcome back, {user?.name?.split(' ')[0] || 'Provider'}!
                </h1>
                <p className="text-brand-100">
                  You have {pendingResponses.length} pending request{pendingResponses.length !== 1 ? 's' : ''} to review
                </p>
              </div>
              <Button
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                onClick={() => navigate('/Profile')}
              >
                View Profile
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickStats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="relative overflow-hidden">
                  {stat.urgent && (
                    <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full m-2 animate-pulse" />
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="text-2xl font-bold mt-1">{stat.value}</p>
                        {stat.sub && (
                          <p className="text-xs text-muted-foreground">{stat.sub}</p>
                        )}
                      </div>
                      <div className={`p-2 rounded-lg ${stat.color}`}>
                        <stat.icon className="w-5 h-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Requests & Activity */}
            <div className="lg:col-span-2 space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="requests" className="relative">
                    <Inbox className="w-4 h-4 mr-2" />
                    Requests
                    {pendingResponses.length > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-brand-500">
                        {pendingResponses.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="accepted">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Accepted
                  </TabsTrigger>
                  <TabsTrigger value="history">
                    <Clock className="w-4 h-4 mr-2" />
                    History
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="requests" className="mt-4">
                  {pendingLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-48" />
                      ))}
                    </div>
                  ) : pendingResponses.length > 0 ? (
                    <AnimatePresence>
                      <div className="space-y-4">
                        {pendingResponses.map((response: PendingResponse) => (
                          <QuickAcceptCard
                            key={response.id}
                            request={response.request}
                            seeker={response.user}
                            onAccept={() => {}}
                            onDecline={() => {}}
                          />
                        ))}
                      </div>
                    </AnimatePresence>
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center mb-4">
                          <Inbox className="w-8 h-8 text-brand-500" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No pending requests</h3>
                        <p className="text-muted-foreground text-center max-w-sm">
                          New job requests matching your services will appear here.
                          Make sure your listings are up to date!
                        </p>
                        <Button 
                          className="mt-4"
                          onClick={() => navigate('/CreateOffer')}
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          Create a Listing
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="accepted">
                  <Card>
                    <CardContent className="py-16 text-center text-muted-foreground">
                      <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>Your accepted jobs will appear here.</p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="history">
                  <Card>
                    <CardContent className="py-16 text-center text-muted-foreground">
                      <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>View your completed job history.</p>
                      <Button 
                        variant="link" 
                        className="mt-2"
                        onClick={() => navigate('/Profile?tab=transactions')}
                      >
                        View Transaction History
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* Right Column - Badges & Activity */}
            <div className="space-y-6">
              {/* Badges */}
              <BadgeDisplay showProgress={true} />

              {/* Live Activity */}
              <LiveActivityFeed 
                limit={8} 
                showStats={false} 
                compact={true}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
