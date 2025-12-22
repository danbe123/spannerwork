import React, { useState, useEffect, useRef, type FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { activityService } from '@/api/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, TrendingUp, Users, Zap, RefreshCw, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { queryKeys } from '@/lib/queryKeys';

// Types
interface ActivityEvent {
  id: string;
  type: string;
  message: string;
  icon: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  targetType?: string | null;
  targetId?: string | null;
}

interface LiveStats {
  activeListings: number;
  activeRequests: number;
  recentTransactions: number;
  updatedAt: string;
}

interface LiveActivityFeedProps {
  /** Maximum number of activities to display */
  limit?: number;
  /** Show platform statistics in header */
  showStats?: boolean;
  /** Use compact layout */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Aria label for the feed region */
  ariaLabel?: string;
}

interface DisplayedActivity extends ActivityEvent {
  isNew: boolean;
}

/**
 * Live Activity Feed Component
 * 
 * Shows real-time platform activity with smooth animations.
 * Includes full accessibility support and error handling.
 */
const LiveActivityFeed: FC<LiveActivityFeedProps> = ({ 
  limit = 10, 
  showStats = true,
  compact = false,
  className = '',
  ariaLabel = 'Live platform activity feed'
}) => {
  const navigate = useNavigate();
  const [displayedActivities, setDisplayedActivities] = useState<DisplayedActivity[]>([]);
  const prevActivitiesRef = useRef<ActivityEvent[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);

  // Fetch activity feed
  const { 
    data: feedData, 
    isLoading: feedLoading,
    isError: feedError,
    refetch: refetchFeed
  } = useQuery({
    queryKey: queryKeys.activityFeedWithLimit(limit),
    queryFn: () => activityService.getFeed(limit),
    refetchInterval: 30000,
    staleTime: 10000,
    retry: 3,
  });

  // Fetch live stats
  const { data: statsData } = useQuery<LiveStats>({
    queryKey: queryKeys.liveStats(),
    queryFn: () => activityService.getStats(),
    refetchInterval: 60000,
    staleTime: 30000,
    enabled: showStats,
    retry: 2,
  });

  // Animate new activities sliding in
  useEffect(() => {
    if (feedData?.activities) {
      const newActivities = feedData.activities;
      const prevIds = new Set(prevActivitiesRef.current.map(a => a.id));
      
      // Mark new items for animation
      const markedActivities: DisplayedActivity[] = newActivities.map(activity => ({
        ...activity,
        isNew: !prevIds.has(activity.id),
      }));
      
      setDisplayedActivities(markedActivities);
      prevActivitiesRef.current = newActivities;

      // Announce new activities to screen readers
      const newCount = markedActivities.filter(a => a.isNew).length;
      if (newCount > 0) {
        announceToScreenReader(`${newCount} new ${newCount === 1 ? 'activity' : 'activities'} added`);
      }
    }
  }, [feedData]);

  const formatTime = (timestamp: string): string => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'just now';
    }
  };

  const handleRetry = () => {
    refetchFeed();
  };

  const getActivityHref = (activity: ActivityEvent): string | null => {
    const targetType = activity.targetType ?? null;
    const targetId = activity.targetId ?? null;

    const metadataItemType = typeof activity.metadata?.itemType === 'string' ? (activity.metadata.itemType as string) : null;
    const metadataListingId = typeof activity.metadata?.listingId === 'string' ? (activity.metadata.listingId as string) : null;

    if (!targetType || !targetId) {
      if (metadataItemType && metadataListingId) {
        if (metadataItemType === 'tool') return `/tool/${metadataListingId}`;
        if (metadataItemType === 'space') return `/space/${metadataListingId}`;
        if (metadataItemType === 'service') return `/service/${metadataListingId}`;
      }
      return null;
    }

    if (targetType === 'request') return `/request/${targetId}`;
    if (targetType === 'transaction') return `/transaction/${targetId}`;
    if (targetType === 'tool') return `/tool/${targetId}`;
    if (targetType === 'space') return `/space/${targetId}`;
    if (targetType === 'service') return `/service/${targetId}`;

    return null;
  };

  const handleNavigate = (activity: ActivityEvent): void => {
    const href = getActivityHref(activity);
    if (href) {
      navigate(href);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, activity: ActivityEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNavigate(activity);
    }
  };

  // Loading skeleton
  if (feedLoading) {
    return (
      <Card className={className} aria-busy="true" aria-label="Loading activity feed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="w-5 h-5 text-orange-500" aria-hidden="true" />
            <span>Live Activity</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3" aria-hidden="true">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
          <span className="sr-only">Loading recent platform activity...</span>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (feedError) {
    return (
      <Card className={className} role="alert" aria-live="polite">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="w-5 h-5 text-orange-500" aria-hidden="true" />
            Live Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mb-2" aria-hidden="true" />
            <p className="text-sm text-muted-foreground mb-3">Unable to load activity</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetry}
              aria-label="Retry loading activity feed"
            >
              <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={`overflow-hidden ${className}`}
      ref={feedRef}
    >
      <CardHeader className="pb-3 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="relative" aria-hidden="true">
              <Activity className="w-5 h-5 text-orange-500" />
              <span 
                className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"
                aria-label="Live updates active"
              />
            </div>
            <span id="activity-feed-title">Live Activity</span>
          </CardTitle>
          {showStats && statsData && (
            <div 
              className="flex items-center gap-3 text-sm text-muted-foreground"
              aria-label={`${statsData.recentTransactions} transactions today, ${statsData.activeListings} active listings`}
            >
              <div className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4 text-green-500" aria-hidden="true" />
                <span className="font-medium">{statsData.recentTransactions}</span>
                <span className="hidden sm:inline">today</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4 text-blue-500" aria-hidden="true" />
                <span className="font-medium">{statsData.activeListings}</span>
                <span className="hidden sm:inline">active</span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className={`${compact ? 'p-3' : 'p-4'} space-y-1`}>
        <div
          role="feed"
          aria-labelledby="activity-feed-title"
          aria-label={ariaLabel}
          aria-live="polite"
          aria-atomic="false"
        >
          <AnimatePresence mode="popLayout">
            {displayedActivities.map((activity, index) => (
              (() => {
                const href = getActivityHref(activity);
                const isClickable = Boolean(href);

                return (
              <motion.article
                key={activity.id}
                initial={activity.isNew ? { opacity: 0, x: -20, height: 0 } : false}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                transition={{ 
                  duration: 0.3, 
                  delay: activity.isNew ? index * 0.05 : 0,
                  ease: 'easeOut'
                }}
                className={`
                  flex items-center gap-3 py-2 px-2 rounded-lg
                  hover:bg-muted/50 transition-colors ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                  focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
                  ${activity.isNew ? 'bg-orange-50 dark:bg-orange-950/20' : ''}
                `}
                tabIndex={0}
                role="article"
                aria-label={`${activity.message}, ${formatTime(activity.timestamp)}`}
                aria-setsize={displayedActivities.length}
                aria-posinset={index + 1}
                data-href={href || ''}
                onClick={isClickable ? () => handleNavigate(activity) : undefined}
                onKeyDown={(e) => handleKeyDown(e, activity)}
              >
                <div 
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/50 dark:to-amber-900/50 flex items-center justify-center text-lg"
                  aria-hidden="true"
                >
                  {activity.icon}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">
                    {activity.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <time dateTime={activity.timestamp}>
                      {formatTime(activity.timestamp)}
                    </time>
                  </p>
                </div>

                {activity.isNew && (
                  <Badge 
                    variant="secondary" 
                    className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
                    aria-label="New activity"
                  >
                    New
                  </Badge>
                )}
              </motion.article>
                );
              })()
            ))}
          </AnimatePresence>
        </div>

        {displayedActivities.length === 0 && (
          <div 
            className="text-center py-8 text-muted-foreground"
            role="status"
            aria-label="No activity yet"
          >
            <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
            <p>Activity will appear here</p>
          </div>
        )}
      </CardContent>

      {/* Hidden live region for screen reader announcements */}
      <div 
        id="activity-announcements" 
        className="sr-only" 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
      />
    </Card>
  );
};

/**
 * Announce messages to screen readers
 */
function announceToScreenReader(message: string): void {
  const announcer = document.getElementById('activity-announcements');
  if (announcer) {
    announcer.textContent = message;
    // Clear after announcement
    setTimeout(() => {
      announcer.textContent = '';
    }, 1000);
  }
}

export default LiveActivityFeed;
