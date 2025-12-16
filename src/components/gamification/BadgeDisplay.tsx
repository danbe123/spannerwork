import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gamificationService } from '@/api/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Award, ChevronDown, ChevronRight, Lock, Star, Trophy, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BadgeData {
  type: string;
  name: string;
  description: string;
  icon: string;
  requirement?: string;
  earnedAt?: string;
}

interface NextBadgeItem {
  badge: BadgeData;
  progress: number;
  remaining: string;
}

interface BadgeDisplayProps {
  showProgress?: boolean;
  compact?: boolean;
  variant?: 'dashboard' | 'profile';
}

export default function BadgeDisplay({ showProgress = true, compact = false, variant = "dashboard" }: BadgeDisplayProps) {
  const [showAllNext, setShowAllNext] = useState(false);

  const { data: badgesData, isLoading: badgesLoading } = useQuery({
    queryKey: ['myBadges'],
    queryFn: () => gamificationService.getMyBadges(),
    staleTime: 60000,
  });

  const { data: nextBadgesData } = useQuery({
    queryKey: ['nextBadges'],
    queryFn: () => gamificationService.getNextBadges(3),
    staleTime: 60000,
    enabled: showProgress,
  });

  const badges: BadgeData[] = badgesData?.badges || [];
  const nextBadges: NextBadgeItem[] = [...(nextBadgesData?.nextBadges || [])].sort((a, b) => b.progress - a.progress);

  if (badgesLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="w-12 h-12 rounded-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const BadgeItem = ({ badge, index }: { badge: BadgeData; index: number }) => (
    <Dialog key={badge.type}>
      <DialogTrigger asChild>
        <motion.button
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ 
            delay: index * 0.1, 
            type: 'spring', 
            stiffness: 200,
            damping: 15 
          }}
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.95 }}
          className="relative w-14 h-14 rounded-full bg-gradient-to-br from-amber-100 to-yellow-200 dark:from-amber-900/50 dark:to-yellow-800/50 flex items-center justify-center text-2xl shadow-lg border-2 border-amber-300 dark:border-amber-600 cursor-pointer hover:shadow-xl transition-shadow"
        >
          <span>{badge.icon}</span>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
            <Star className="w-3 h-3 text-white fill-white" />
          </div>
        </motion.button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-4xl">{badge.icon}</span>
            <div>
              <h3 className="text-xl font-bold">{badge.name}</h3>
              <p className="text-sm text-muted-foreground font-normal">
                {badge.description}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Award className="w-4 h-4" />
            <span>Requirement: {badge.requirement}</span>
          </div>
          {badge.earnedAt && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Star className="w-4 h-4" />
              <span>Earned {new Date(badge.earnedAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  const NextBadgeProgress = ({ item, index, size = 'md' }: { item: NextBadgeItem; index: number; size?: 'sm' | 'md' }) => (
    <motion.div
      key={item.badge.type}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`flex items-center gap-${size === 'sm' ? '2' : '3'} p-${size === 'sm' ? '2' : '3'} rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors`}
    >
      <div className={`relative w-${size === 'sm' ? '8' : '10'} h-${size === 'sm' ? '8' : '10'} rounded-full bg-muted flex items-center justify-center text-${size === 'sm' ? 'base' : 'xl'} opacity-60 flex-shrink-0`}>
        <span>{item.badge.icon}</span>
        <Lock className={`absolute -bottom-0.5 -right-0.5 w-${size === 'sm' ? '3' : '3.5'} h-${size === 'sm' ? '3' : '3.5'} text-muted-foreground`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium truncate">
            {item.badge.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {item.progress}%
          </span>
        </div>
        <Progress value={item.progress} className={`h-${size === 'sm' ? '1.5' : '2'}`} />
        <p className="text-xs text-muted-foreground mt-1">
          {item.remaining}
        </p>
      </div>
    </motion.div>
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="w-5 h-5 text-amber-500" />
            Achievements
            {badges.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {badges.length} earned
              </Badge>
            )}
          </CardTitle>
          {badges.length > 5 && (
            <Button variant="ghost" size="sm" className="text-amber-600">
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {variant === "profile" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              {badges.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {badges.slice(0, compact ? 6 : 12).map((badge, index) => (
                    <BadgeItem key={badge.type} badge={badge} index={index} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Award className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Complete actions to earn badges!</p>
                </div>
              )}
            </div>

            {showProgress && nextBadges.length > 0 && (
              <div className="border-l pl-6">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-orange-500" />
                  Next Achievements
                </h4>
                <div className="space-y-3">
                  {nextBadges.slice(0, 1).map((item, index) => (
                    <NextBadgeProgress key={item.badge.type} item={item} index={index} />
                  ))}
                  
                  <AnimatePresence mode="sync">
                    {showAllNext && nextBadges.slice(1).map((item, index) => (
                      <motion.div
                        key={item.badge.type}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ 
                          duration: 0.2,
                          delay: index * 0.03,
                          ease: "easeOut"
                        }}
                      >
                        <NextBadgeProgress item={item} index={index} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {nextBadges.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllNext(!showAllNext)}
                      className="w-full text-muted-foreground hover:text-foreground"
                    >
                      {showAllNext ? (
                        <>Show Less <ChevronDown className="w-4 h-4 ml-1 rotate-180" /></>
                      ) : (
                        <>Show All ({nextBadges.length - 1} more) <ChevronDown className="w-4 h-4 ml-1" /></>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            {badges.length > 0 ? (
              <div className="flex flex-wrap gap-3 mb-4">
                {badges.slice(0, compact ? 6 : 12).map((badge, index) => (
                  <BadgeItem key={badge.type} badge={badge} index={index} />
                ))}
              </div>
            ) : (
              <div className="text-center py-3 text-muted-foreground">
                <Award className="w-8 h-8 mx-auto mb-1 opacity-30" />
                <p className="text-sm">Complete actions to earn badges!</p>
              </div>
            )}

            {showProgress && nextBadges.length > 0 && (
              <div className={badges.length === 0 ? "" : "border-t pt-4 mt-4"}>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-orange-500" />
                  Next Achievements
                </h4>
                <div className="space-y-2">
                  {nextBadges.map((item, index) => (
                    <NextBadgeProgress key={item.badge.type} item={item} index={index} size="sm" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface BadgeRowProps {
  badges?: BadgeData[];
  max?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function BadgeRow({ badges = [], max = 5, size = 'sm' }: BadgeRowProps) {
  if (!badges.length) return null;

  const sizeClasses: Record<string, string> = {
    sm: 'w-6 h-6 text-sm',
    md: 'w-8 h-8 text-lg',
    lg: 'w-10 h-10 text-xl',
  };

  return (
    <div className="flex items-center gap-1">
      {badges.slice(0, max).map((badge, i) => (
        <div
          key={badge.type || i}
          className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-amber-100 to-yellow-200 dark:from-amber-900/50 dark:to-yellow-800/50 flex items-center justify-center border border-amber-300/50`}
          title={badge.name}
        >
          {badge.icon}
        </div>
      ))}
      {badges.length > max && (
        <span className="text-xs text-muted-foreground ml-1">
          +{badges.length - max}
        </span>
      )}
    </div>
  );
}
