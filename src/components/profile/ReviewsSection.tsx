/**
 * ReviewsSection Component
 * 
 * Enhanced reviews display with:
 * - Rating breakdown chart
 * - Filter by rating/date
 * - Highlighted "Most Helpful" reviews
 * - Summary statistics
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { 
  Star, 
  MessageSquare,
  ThumbsUp,
  Filter,
  TrendingUp,
  Clock,
  ChevronDown,
  ChevronUp,
  Quote
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import type { Review } from "@/types";

interface ReviewsSectionProps {
  reviews: Review[];
  className?: string;
}

type FilterType = 'all' | '5' | '4' | '3' | '2' | '1';
type SortType = 'recent' | 'highest' | 'lowest';

const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'highest', label: 'Highest' },
  { value: 'lowest', label: 'Lowest' },
];

// Rating breakdown component
function RatingBreakdown({ reviews }: { reviews: Review[] }) {
  const breakdown = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => {
      const rating = Math.round(r.rating) as 1 | 2 | 3 | 4 | 5;
      if (rating >= 1 && rating <= 5) counts[rating]++;
    });
    return counts;
  }, [reviews]);

  const total = reviews.length || 1;

  return (
    <div className="space-y-2">
      {[5, 4, 3, 2, 1].map(rating => {
        const count = breakdown[rating as keyof typeof breakdown];
        const percentage = (count / total) * 100;
        
        return (
          <div key={rating} className="flex items-center gap-3">
            <div className="flex items-center gap-1 w-12">
              <span className="text-sm font-medium">{rating}</span>
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            </div>
            <div className="flex-1">
              <Progress value={percentage} className="h-2" />
            </div>
            <span className="text-sm text-gray-500 w-8 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// Individual review card
function ReviewCard({ review, isHighlighted = false }: { review: Review; isHighlighted?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const reviewerName = review.reviewerName || review.reviewer?.name || 'Anonymous';
  const reviewerInitial = reviewerName[0]?.toUpperCase() || 'A';
  const comment = review.comment || '';
  const isLongComment = comment.length > 200;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`p-4 rounded-xl border transition-all ${
        isHighlighted 
          ? 'bg-amber-50 border-amber-200 shadow-md' 
          : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
      }`}
    >
      {isHighlighted && (
        <Badge className="mb-3 bg-amber-100 text-amber-700 border-amber-200">
          <ThumbsUp className="w-3 h-3 mr-1" />
          Most Helpful
        </Badge>
      )}
      
      <div className="flex items-start gap-4">
        <Avatar className="w-10 h-10">
          <AvatarImage src={review.reviewerAvatar || review.reviewer?.avatar} />
          <AvatarFallback className="bg-gradient-to-br from-orange-100 to-amber-100 text-brand-800">
            {reviewerInitial}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900">{reviewerName}</span>
            <div className="flex">
              {Array(5).fill(0).map((_, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${
                    i < review.rating
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
          
          {comment && (
            <div className="relative">
              <Quote className="absolute -left-1 -top-1 w-4 h-4 text-gray-200" />
              <p className={`text-gray-700 pl-4 ${!expanded && isLongComment ? 'line-clamp-3' : ''}`}>
                {comment}
              </p>
              {isLongComment && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-brand-800 text-sm font-medium mt-1 flex items-center gap-1 hover:underline"
                >
                  {expanded ? (
                    <>Show less <ChevronUp className="w-3 h-3" /></>
                  ) : (
                    <>Read more <ChevronDown className="w-3 h-3" /></>
                  )}
                </button>
              )}
            </div>
          )}
          
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(review.createdDate), { addSuffix: true })}
            </span>
            {review.transactionType && (
              <Badge variant="outline" className="text-xs">
                {review.transactionType}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function ReviewsSection({ 
  reviews = [],
  className = ""
}: ReviewsSectionProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('recent');
  const [showFilters, setShowFilters] = useState(false);

  // Calculate stats
  const stats = useMemo(() => {
    if (reviews.length === 0) return { average: 0, total: 0, trend: 0 };
    
    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const average = sum / total;
    
    // Calculate recent trend (last 5 reviews vs previous 5)
    const sorted = [...reviews].sort((a, b) => 
      new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
    );
    const recent5 = sorted.slice(0, 5);
    const previous5 = sorted.slice(5, 10);
    
    const recentAvg = recent5.length > 0 
      ? recent5.reduce((acc, r) => acc + r.rating, 0) / recent5.length 
      : average;
    const previousAvg = previous5.length > 0 
      ? previous5.reduce((acc, r) => acc + r.rating, 0) / previous5.length 
      : average;
    
    const trend = recentAvg - previousAvg;
    
    return { average, total, trend };
  }, [reviews]);

  // Filter and sort reviews
  const filteredReviews = useMemo(() => {
    let result = [...reviews];
    
    // Apply filter
    if (filter !== 'all') {
      const targetRating = parseInt(filter);
      result = result.filter(r => Math.round(r.rating) === targetRating);
    }
    
    // Apply sort
    switch (sort) {
      case 'recent':
        result.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
        break;
      case 'highest':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'lowest':
        result.sort((a, b) => a.rating - b.rating);
        break;
    }
    
    return result;
  }, [reviews, filter, sort]);

  // Find most helpful review (highest rated with longest comment)
  const mostHelpfulId = useMemo(() => {
    if (reviews.length === 0) return null;
    const helpful = [...reviews]
      .filter(r => r.rating >= 4 && r.comment && r.comment.length > 50)
      .sort((a, b) => (b.comment?.length || 0) - (a.comment?.length || 0))[0];
    return helpful?.id;
  }, [reviews]);

  if (reviews.length === 0) {
    return (
      <Card className={`border-none shadow-lg ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="w-5 h-5 text-brand-800" />
            Reviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="mb-2">No reviews yet</p>
            <p className="text-sm">Complete services to receive reviews from customers</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-none shadow-lg ${className}`}>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="w-5 h-5 text-brand-800" />
            Reviews
            <Badge variant="secondary" className="ml-2">
              {stats.total} reviews
            </Badge>
          </CardTitle>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="w-fit"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {showFilters ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Stats Summary */}
        <div className="grid md:grid-cols-3 gap-6 mb-6 p-4 bg-gray-50 rounded-xl">
          {/* Average Rating */}
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="text-4xl font-bold text-gray-900">{stats.average.toFixed(1)}</span>
              <Star className="w-8 h-8 fill-amber-400 text-amber-400" />
            </div>
            <p className="text-sm text-gray-500 mt-1">Average rating</p>
            {stats.trend !== 0 && (
              <div className={`flex items-center gap-1 mt-2 text-sm ${
                stats.trend > 0 ? 'text-green-600' : 'text-red-500'
              }`}>
                <TrendingUp className={`w-4 h-4 ${stats.trend < 0 ? 'rotate-180' : ''}`} />
                {stats.trend > 0 ? '+' : ''}{stats.trend.toFixed(1)} recent trend
              </div>
            )}
          </div>
          
          {/* Rating Breakdown */}
          <div className="md:col-span-2">
            <RatingBreakdown reviews={reviews} />
          </div>
        </div>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
                {/* Rating filter */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Rating</p>
                  <div className="flex gap-2">
                    {(['all', '5', '4', '3', '2', '1'] as FilterType[]).map(f => (
                      <Button
                        key={f}
                        variant={filter === f ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter(f)}
                        className={filter === f ? 'bg-brand-800 hover:bg-brand-900' : ''}
                      >
                        {f === 'all' ? 'All' : `${f}★`}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Sort */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Sort by</p>
                  <div className="flex gap-2">
                    {SORT_OPTIONS.map(s => (
                      <Button
                        key={s.value}
                        variant={sort === s.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSort(s.value)}
                        className={sort === s.value ? 'bg-brand-800 hover:bg-brand-900' : ''}
                      >
                        {s.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reviews List */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredReviews.map(review => (
              <ReviewCard 
                key={review.id} 
                review={review} 
                isHighlighted={review.id === mostHelpfulId}
              />
            ))}
          </AnimatePresence>
          
          {filteredReviews.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No reviews match this filter</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
