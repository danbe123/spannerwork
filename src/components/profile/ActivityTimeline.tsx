/**
 * ActivityTimeline Component
 * 
 * Visual timeline showing recent user activity:
 * - Completed jobs
 * - New tools listed
 * - Reviews received
 * - Badges earned
 */

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Wrench, 
  Star, 
  Trophy,
  Clock,
  Warehouse,
  PoundSterling,
  TrendingUp
} from "lucide-react";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";

import type { Tool, Transaction, Review, Space } from "@/types";
import type { LucideIcon } from "lucide-react";

interface ActivityItem {
  id: string;
  type: 'transaction' | 'tool_listed' | 'space_listed' | 'review_received' | 'badge_earned';
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  date: Date;
  meta?: {
    amount?: number;
    rating?: number;
    photo?: string;
  };
}

interface ActivityTimelineProps {
  tools: Tool[];
  spaces: Space[];
  transactions: Transaction[];
  reviews: Review[];
  badges?: Array<{ type: string; earnedAt: string }>;
  limit?: number;
  className?: string;
}

// Group activities by date
function groupByDate(activities: ActivityItem[]): Map<string, ActivityItem[]> {
  const groups = new Map<string, ActivityItem[]>();
  
  activities.forEach(activity => {
    let dateKey: string;
    if (isToday(activity.date)) {
      dateKey = 'Today';
    } else if (isYesterday(activity.date)) {
      dateKey = 'Yesterday';
    } else {
      dateKey = format(activity.date, 'MMMM d, yyyy');
    }
    
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(activity);
  });
  
  return groups;
}

function ActivityCard({ activity, isLast }: { activity: ActivityItem; isLast: boolean }) {
  const Icon = activity.icon;
  
  return (
    <div className="relative flex gap-4">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-gray-200" />
      )}
      
      {/* Icon */}
      <motion.div 
        className={`relative z-10 w-10 h-10 rounded-full ${activity.iconBg} flex items-center justify-center shadow-md`}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        <Icon className={`w-5 h-5 ${activity.iconColor}`} />
      </motion.div>
      
      {/* Content */}
      <motion.div 
        className="flex-1 pb-6"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900">{activity.title}</h4>
              <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
              
              {/* Meta info */}
              {activity.meta && (
                <div className="flex items-center gap-3 mt-2">
                  {activity.meta.amount !== undefined && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      <PoundSterling className="w-3 h-3 mr-1" />
                      {activity.meta.amount.toFixed(2)}
                    </Badge>
                  )}
                  {activity.meta.rating !== undefined && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                      <Star className="w-3 h-3 mr-1 fill-amber-500" />
                      {activity.meta.rating.toFixed(1)}
                    </Badge>
                  )}
                </div>
              )}
            </div>
            
            {/* Thumbnail */}
            {activity.meta?.photo && (
              <img 
                src={activity.meta.photo} 
                alt="" 
                className="w-16 h-16 rounded-lg object-cover"
              />
            )}
          </div>
          
          {/* Time */}
          <div className="flex items-center gap-1 mt-3 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(activity.date, { addSuffix: true })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function ActivityTimeline({ 
  tools = [],
  spaces = [],
  transactions = [],
  reviews = [],
  badges = [],
  limit = 10,
  className = ""
}: ActivityTimelineProps) {
  // Build activity items
  const activities: ActivityItem[] = [];

  // Add completed transactions
  transactions
    .filter(tx => tx.status === 'COMPLETED')
    .forEach(tx => {
      activities.push({
        id: `tx-${tx.id}`,
        type: 'transaction',
        icon: CheckCircle2,
        iconColor: 'text-green-600',
        iconBg: 'bg-green-100',
        title: 'Transaction Completed',
        description: tx.tool?.name 
          ? `Rental of ${tx.tool.name} completed successfully`
          : tx.space?.name
            ? `Space rental at ${tx.space.name} completed`
            : 'Transaction completed successfully',
        date: new Date(tx.completedDate || tx.updatedDate),
        meta: {
          amount: tx.totalAmount,
          photo: tx.tool?.photos?.[0] || tx.space?.photos?.[0],
        },
      });
    });

  // Add tools listed
  tools.forEach(tool => {
    activities.push({
      id: `tool-${tool.id}`,
      type: 'tool_listed',
      icon: Wrench,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-100',
      title: 'New Tool Listed',
      description: `Listed ${tool.name} for rent`,
      date: new Date(tool.createdDate),
      meta: {
        amount: tool.dailyRate,
        photo: tool.photos?.[0],
      },
    });
  });

  // Add spaces listed
  spaces.forEach(space => {
    activities.push({
      id: `space-${space.id}`,
      type: 'space_listed',
      icon: Warehouse,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-100',
      title: 'New Space Listed',
      description: `Listed ${space.name} for rent`,
      date: new Date(space.createdDate),
      meta: {
        amount: space.dailyRate,
        photo: space.photos?.[0],
      },
    });
  });

  // Add reviews received
  reviews.forEach(review => {
    activities.push({
      id: `review-${review.id}`,
      type: 'review_received',
      icon: Star,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-100',
      title: 'Review Received',
      description: review.comment 
        ? `"${review.comment.slice(0, 100)}${review.comment.length > 100 ? '...' : ''}"`
        : 'Received a rating',
      date: new Date(review.createdDate),
      meta: {
        rating: review.rating,
      },
    });
  });

  // Add badges earned
  badges.forEach(badge => {
    activities.push({
      id: `badge-${badge.type}`,
      type: 'badge_earned',
      icon: Trophy,
      iconColor: 'text-orange-500',
      iconBg: 'bg-orange-100',
      title: 'Badge Earned',
      description: `Earned the ${badge.type.replace(/_/g, ' ').toLowerCase()} badge`,
      date: new Date(badge.earnedAt),
    });
  });

  // Sort by date (newest first) and limit
  const sortedActivities = activities
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, limit);

  // Group by date
  const groupedActivities = groupByDate(sortedActivities);

  if (sortedActivities.length === 0) {
    return (
      <Card className={`border-none shadow-lg ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="w-5 h-5 text-brand-800" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="mb-2">No activity yet</p>
            <p className="text-sm">Your recent actions will appear here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-none shadow-lg ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="w-5 h-5 text-brand-800" />
          Recent Activity
          <Badge variant="secondary" className="ml-2">
            {sortedActivities.length} events
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Array.from(groupedActivities.entries()).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-sm font-medium text-gray-500 px-2">{dateLabel}</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              
              {/* Activities for this date */}
              <div>
                {items.map((activity, index) => (
                  <ActivityCard 
                    key={activity.id} 
                    activity={activity} 
                    isLast={index === items.length - 1}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
