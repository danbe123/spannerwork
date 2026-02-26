import { useQuery } from '@tanstack/react-query';
import { gamificationService } from '@/api/services';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  Shield, 
  Star, 
  Award,
  Calendar,
  TrendingUp,
  Zap,
  LucideIcon
} from 'lucide-react';
import { User } from '@/types';
import { queryKeys } from '@/lib/queryKeys';

interface Signal {
  id: string;
  icon: LucideIcon;
  label: string;
  description: string;
  color: string;
  bgColor: string;
}

interface TrustSignalsProps {
  user?: User;
  size?: 'sm' | 'md' | 'lg';
  showAll?: boolean;
  className?: string;
}

export default function TrustSignals({ 
  user,
  size = 'md',
  showAll = false,
  className = '' 
}: TrustSignalsProps) {
  const { data: badgesData } = useQuery({
    queryKey: queryKeys.userBadges(user?.id ?? ''),
    queryFn: () => gamificationService.getMyBadges(),
    enabled: !!user?.id,
    staleTime: 60000,
  });

  const badges = badgesData?.badges || [];
  const signals: Signal[] = [];

  if (user?.emailVerified) {
    signals.push({
      id: 'verified',
      icon: CheckCircle2,
      label: 'Verified',
      description: 'Email verified',
      color: 'text-blue-500',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    });
  }

  if ((user?.rating ?? 0) >= 4.8 && (user?.totalReviews ?? 0) >= 5) {
    signals.push({
      id: 'top-rated',
      icon: Star,
      label: 'Top Rated',
      description: `${user?.rating?.toFixed(1)} avg from ${user?.totalReviews} reviews`,
      color: 'text-amber-500',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    });
  } else if ((user?.rating ?? 0) >= 4.5 && (user?.totalReviews ?? 0) >= 3) {
    signals.push({
      id: 'highly-rated',
      icon: Star,
      label: 'Highly Rated',
      description: `${user?.rating?.toFixed(1)} avg rating`,
      color: 'text-amber-500',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    });
  }

  if ((user?.totalTransactions ?? 0) >= 25) {
    signals.push({
      id: 'experienced',
      icon: Award,
      label: 'Experienced',
      description: `${user?.totalTransactions}+ completed transactions`,
      color: 'text-purple-500',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    });
  } else if ((user?.totalTransactions ?? 0) >= 10) {
    signals.push({
      id: 'active',
      icon: TrendingUp,
      label: 'Active',
      description: `${user?.totalTransactions} transactions completed`,
      color: 'text-green-500',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    });
  }

  const hasQuickResponder = badges.some((b: { type: string }) => b.type === 'QUICK_RESPONDER');
  if (hasQuickResponder) {
    signals.push({
      id: 'quick',
      icon: Zap,
      label: 'Quick Responder',
      description: 'Typically responds within 1 hour',
      color: 'text-brand-500',
      bgColor: 'bg-brand-100 dark:bg-brand-900/30',
    });
  }

  const hasReliable = badges.some((b: { type: string }) => b.type === 'RELIABLE');
  if (hasReliable) {
    signals.push({
      id: 'reliable',
      icon: Shield,
      label: 'Reliable',
      description: 'No cancellations',
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    });
  }

  if (user?.createdDate) {
    const memberSince = new Date(user.createdDate);
    const monthsAgo = Math.floor((Date.now() - memberSince.getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (monthsAgo >= 6) {
      signals.push({
        id: 'member',
        icon: Calendar,
        label: monthsAgo >= 12 ? 'Long-term Member' : 'Established Member',
        description: `Member since ${memberSince.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`,
        color: 'text-gray-500',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
      });
    }
  }

  const displaySignals = showAll ? signals : signals.slice(0, 3);
  
  if (displaySignals.length === 0) return null;

  const sizeClasses = {
    sm: { container: 'gap-1', badge: 'h-5 text-xs px-1.5', icon: 'w-3 h-3' },
    md: { container: 'gap-1.5', badge: 'h-6 text-xs px-2', icon: 'w-3.5 h-3.5' },
    lg: { container: 'gap-2', badge: 'h-7 text-sm px-2.5', icon: 'w-4 h-4' },
  };

  const styles = sizeClasses[size];

  return (
    <TooltipProvider>
      <div className={`flex flex-wrap items-center ${styles.container} ${className}`}>
        {displaySignals.map((signal, index) => (
          <Tooltip key={signal.id}>
            <TooltipTrigger asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <Badge
                  variant="secondary"
                  className={`${signal.bgColor} ${signal.color} border-0 ${styles.badge} cursor-help`}
                >
                  <signal.icon className={`${styles.icon} mr-1`} />
                  {signal.label}
                </Badge>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{signal.description}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        
        {!showAll && signals.length > 3 && (
          <Badge variant="outline" className={`${styles.badge} text-muted-foreground`}>
            +{signals.length - 3} more
          </Badge>
        )}
      </div>
    </TooltipProvider>
  );
}

interface TrustBadgeProps {
  type: 'verified' | 'top-rated' | 'quick-responder' | 'reliable';
  size?: 'sm' | 'md' | 'lg';
}

export function TrustBadge({ type, size = 'sm' }: TrustBadgeProps) {
  const badges: Record<string, { icon: LucideIcon; label: string; color: string }> = {
    verified: { icon: CheckCircle2, label: 'Verified', color: 'text-blue-500 bg-blue-100' },
    'top-rated': { icon: Star, label: 'Top Rated', color: 'text-amber-500 bg-amber-100' },
    'quick-responder': { icon: Zap, label: 'Fast', color: 'text-brand-500 bg-brand-100' },
    reliable: { icon: Shield, label: 'Reliable', color: 'text-emerald-500 bg-emerald-100' },
  };

  const badge = badges[type];
  if (!badge) return null;

  const sizeClasses = { sm: 'w-5 h-5 text-xs', md: 'w-6 h-6 text-sm', lg: 'w-8 h-8 text-base' };

  return (
    <div 
      className={`${sizeClasses[size]} rounded-full ${badge.color} flex items-center justify-center`}
      title={badge.label}
    >
      <badge.icon className="w-3/5 h-3/5" />
    </div>
  );
}

interface RatingWithTrustProps {
  rating?: number | null;
  reviewCount?: number;
  className?: string;
}

export function RatingWithTrust({ rating, reviewCount = 0, className = '' }: RatingWithTrustProps) {
  if (!rating) return null;

  const getTrustLevel = () => {
    if (rating >= 4.8 && reviewCount >= 10) return { label: 'Excellent', color: 'text-green-600' };
    if (rating >= 4.5 && reviewCount >= 5) return { label: 'Great', color: 'text-green-500' };
    if (rating >= 4.0 && reviewCount >= 3) return { label: 'Good', color: 'text-amber-500' };
    return { label: '', color: '' };
  };

  const trust = getTrustLevel();

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center">
        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
        <span className="font-semibold ml-0.5">{rating.toFixed(1)}</span>
      </div>
      {reviewCount > 0 && (
        <span className="text-sm text-muted-foreground">({reviewCount})</span>
      )}
      {trust.label && (
        <Badge variant="secondary" className={`${trust.color} text-xs h-5 px-1.5`}>
          {trust.label}
        </Badge>
      )}
    </div>
  );
}
