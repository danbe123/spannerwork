import { useQuery } from '@tanstack/react-query';
import { aiService } from '@/api/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { Plus, Sparkles, ShoppingCart, ArrowRight, Zap } from 'lucide-react';
import { MouseEvent } from 'react';

interface BundleSuggestion {
  id: string;
  name: string;
  type: 'tool' | 'service' | 'space';
  reason: string;
  price?: number;
}

interface BundleSuggestionsProps {
  listingType: string;
  listingId: string;
  listingName: string;
  listingCategory: string;
  onAddBundle?: ((item: BundleSuggestion) => void) | null;
  className?: string;
}

export default function BundleSuggestions({ 
  listingType,
  listingId,
  listingName,
  listingCategory,
  onAddBundle = null,
  className = ''
}: BundleSuggestionsProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['bundleSuggestions', listingType, listingId],
    queryFn: () => aiService.getBundles(listingType as 'tool' | 'service' | 'space', listingId, listingName, listingCategory),
    staleTime: 5 * 60 * 1000,
    enabled: !!listingId && !!listingType,
  });

  const suggestions: BundleSuggestion[] = data?.suggestions || [];

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-purple-500" />
            People Also Rent
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-12 h-12 rounded-lg" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="w-16 h-8 rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || suggestions.length === 0) {
    return null;
  }

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="pb-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span>Frequently Rented Together</span>
          <Badge variant="secondary" className="ml-auto bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
            <Zap className="w-3 h-3 mr-1" />
            AI Suggested
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {suggestions.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-purple-200 dark:border-purple-800 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-950/30 transition-all cursor-pointer group"
            onClick={() => onAddBundle?.(item)}
          >
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/50 dark:to-pink-900/50 flex items-center justify-center text-2xl">
              {item.type === 'tool' ? '🔧' : item.type === 'service' ? '👨‍🔧' : '🏠'}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                {item.name}
              </h4>
              <p className="text-xs text-muted-foreground truncate">
                {item.reason}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                +£{item.price?.toFixed(0) || '0'}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-purple-600 hover:text-purple-700 hover:bg-purple-100"
                onClick={(e: MouseEvent) => {
                  e.stopPropagation();
                  onAddBundle?.(item);
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        ))}

        {onAddBundle && suggestions.length > 0 && (
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              className="w-full border-purple-200 text-purple-600 hover:bg-purple-50 hover:border-purple-400"
              onClick={() => suggestions.forEach(s => onAddBundle(s))}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Add All Suggestions
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface InlineBundleSuggestionProps {
  suggestion: BundleSuggestion | null;
  onAdd?: (suggestion: BundleSuggestion) => void;
}

export function InlineBundleSuggestion({ suggestion, onAdd }: InlineBundleSuggestionProps) {
  if (!suggestion) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-2 p-2 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800"
    >
      <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0" />
      <span className="text-xs text-muted-foreground flex-1 truncate">
        Add {suggestion.name} for +£{suggestion.price?.toFixed(0)}
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2 text-purple-600 hover:text-purple-700"
        onClick={() => onAdd?.(suggestion)}
      >
        <Plus className="w-3 h-3" />
      </Button>
    </motion.div>
  );
}
