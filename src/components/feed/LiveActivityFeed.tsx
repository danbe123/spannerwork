import React, { useState, useEffect, useRef, type FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { activityService } from '@/api/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  /** Render without card wrapper (for embedding) */
  embedded?: boolean;
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
  embedded = false,
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
    const loadingContent = (
      <div className="space-y-3" aria-busy="true" aria-label="Loading activity feed">
        {[...Array(compact ? 3 : 5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3" aria-hidden="true">
            <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
        <span className="sr-only">Loading recent platform activity...</span>
      </div>
    );

    if (embedded) {
      return <div className={className}>{loadingContent}</div>;
    }

    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="w-5 h-5 text-brand-500" aria-hidden="true" />
            <span>Live Activity</span>
          </CardTitle>
        </CardHeader>
        <CardContent>{loadingContent}</CardContent>
      </Card>
    );
  }

  // Error state
  if (feedError) {
    const errorContent = (
      <div className="flex flex-col items-center justify-center py-4 text-center" role="alert" aria-live="polite">
        <AlertCircle className="w-6 h-6 text-gray-300 mb-2" aria-hidden="true" />
        <p className="text-sm text-gray-500 mb-2">Unable to load</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRetry}
          className="text-xs h-7"
          aria-label="Retry loading activity feed"
        >
          <RefreshCw className="w-3 h-3 mr-1" aria-hidden="true" />
          Retry
        </Button>
      </div>
    );

    if (embedded) {
      return <div className={className}>{errorContent}</div>;
    }

    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="w-5 h-5 text-brand-500" aria-hidden="true" />
            Live Activity
          </CardTitle>
        </CardHeader>
        <CardContent>{errorContent}</CardContent>
      </Card>
    );
  }

  // Activity list content (shared between embedded and card modes)
  const activityListContent = (
    <>
      <div
        role="feed"
        aria-labelledby={embedded ? undefined : "activity-feed-title"}
        aria-label={ariaLabel}
        aria-live="polite"
        aria-atomic="false"
        className="space-y-1"
      >
        <AnimatePresence mode="popLayout">
          {displayedActivities.map((activity, index) => {
            const href = getActivityHref(activity);
            const isClickable = Boolean(href);

            return (
              <motion.article
                key={activity.id}
                initial={activity.isNew ? { opacity: 0, y: -10 } : false}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{
                  duration: 0.2,
                  delay: activity.isNew ? index * 0.03 : 0,
                  ease: 'easeOut'
                }}
                className={`
                  flex items-center gap-3 py-2 ${embedded ? 'px-0' : 'px-2'} rounded-lg
                  ${isClickable ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}
                  transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1
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
                  className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-base"
                  aria-hidden="true"
                >
                  {activity.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate leading-tight">
                    {activity.message}
                  </p>
                  <p className="text-xs text-gray-400">
                    <time dateTime={activity.timestamp}>
                      {formatTime(activity.timestamp)}
                    </time>
                  </p>
                </div>

                {activity.isNew && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" aria-hidden="true" title="New" />
                )}
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>

      {displayedActivities.length === 0 && (
        <div
          className="text-center py-6 text-gray-400"
          role="status"
          aria-label="No activity yet"
        >
          <Zap className="w-6 h-6 mx-auto mb-1.5 opacity-40" aria-hidden="true" />
          <p className="text-sm">No recent activity</p>
        </div>
      )}

      {/* Hidden live region for screen reader announcements */}
      <div
        id="activity-announcements"
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      />
    </>
  );

  // Embedded mode - no card wrapper
  if (embedded) {
    return (
      <div className={className} ref={feedRef}>
        {activityListContent}
      </div>
    );
  }

  // Card mode - full styling
  return (
    <Card
      className={`overflow-hidden ${className}`}
      ref={feedRef}
    >
      <CardHeader className="pb-3 bg-gradient-to-r from-brand-50 to-brand-100 dark:from-brand-900/30 dark:to-brand-800/30">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="relative" aria-hidden="true">
              <Activity className="w-5 h-5 text-brand-500" />
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

      <CardContent className={`${compact ? 'p-3' : 'p-4'}`}>
        {activityListContent}
      </CardContent>
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
