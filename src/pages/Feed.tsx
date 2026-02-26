/**
 * Feed - Premium Job Discovery Experience
 *
 * Completely redesigned with:
 * - Spacious, breathable layouts
 * - Premium visual hierarchy
 * - Smooth animations
 * - Clean filtering system
 * - Mobile-optimized experience
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { authService, requestsService, activityService } from "@/api/services";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigationType } from "react-router-dom";
import { queryKeys } from "@/lib/queryKeys";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  PlusCircle,
  Wrench,
  GraduationCap,
  Warehouse,
  Loader2,
  Zap,
  Filter,
  Sparkles,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  LucideIcon,
  RefreshCw,
  LayoutGrid,
  List as ListIcon,
  ChevronRight,
  ChevronLeft,
  BarChart3,
  ArrowUp
} from "lucide-react";
import RequestCard from "../components/feed/RequestCard";
import FeedFilters from "../components/feed/FeedFilters";
import LiveActivityFeed from "../components/feed/LiveActivityFeed";
import CardErrorFallback from "../components/feed/CardErrorFallback";
import ErrorBoundary from "@/components/ErrorBoundary";
import SEO from "@/components/SEO";
import { Request } from "@/types";

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const }
  }
};

interface CategoryConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  gradient: string;
  activeGradient: string;
}

// Category configuration
const CATEGORIES: CategoryConfig[] = [
  { id: 'all', label: 'All Jobs', icon: Sparkles, gradient: 'from-gray-500 to-gray-700', activeGradient: 'from-brand-600 to-brand-800' },
  { id: 'tools', label: 'Tools', icon: Wrench, gradient: 'from-brand-400 to-brand-600', activeGradient: 'from-brand-500 to-red-500' },
  { id: 'expertise', label: 'Services', icon: GraduationCap, gradient: 'from-blue-400 to-blue-600', activeGradient: 'from-blue-500 to-indigo-600' },
  { id: 'space', label: 'Space', icon: Warehouse, gradient: 'from-purple-400 to-purple-600', activeGradient: 'from-purple-500 to-pink-500' },
];

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  TOOLS: Wrench,
  EXPERTISE: GraduationCap,
  SPACE: Warehouse
};

// Skeleton card
function SkeletonCard({ viewMode }: { viewMode: 'grid' | 'list' }) {
  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
        <div className="flex items-stretch">
          <div className="w-1.5 bg-gray-200 flex-shrink-0" />
          <div className="w-28 h-28 bg-gray-200 flex-shrink-0" />
          <div className="flex-1 p-5">
            <div className="h-5 bg-gray-200 rounded-lg w-3/4 mb-3" />
            <div className="flex gap-4">
              <div className="h-4 bg-gray-200 rounded w-20" />
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-4 bg-gray-200 rounded w-16" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="h-44 bg-gray-200" />
      <div className="p-5 space-y-4">
        <div className="h-5 bg-gray-200 rounded-lg w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-2/3" />
        <div className="flex gap-3 pt-2">
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="h-4 bg-gray-200 rounded w-24" />
        </div>
        <div className="flex justify-between pt-4 border-t border-gray-100">
          <div className="h-4 bg-gray-200 rounded w-28" />
          <div className="h-9 bg-gray-200 rounded-full w-24" />
        </div>
      </div>
    </div>
  );
}

// Empty state with improved search guidance
function EmptyState({ category, onReset, hasActiveFilters, searchQuery }: {
  category: string;
  onReset: () => void;
  hasActiveFilters?: boolean;
  searchQuery?: string;
}) {
  const categoryLabel = CATEGORIES.find(c => c.id === category)?.label || 'jobs';

  // Build helpful suggestions based on active filters
  const getSuggestions = () => {
    const suggestions: string[] = [];
    if (searchQuery) {
      suggestions.push('Check your spelling or try different keywords');
      suggestions.push('Use broader search terms');
    }
    if (category !== 'all') {
      suggestions.push(`Try searching in "All Jobs" instead of just ${categoryLabel}`);
    }
    if (hasActiveFilters && !searchQuery) {
      suggestions.push('Expand your location radius');
      suggestions.push('Try a different urgency level');
      suggestions.push('Adjust your budget range');
    }
    return suggestions;
  };

  const suggestions = getSuggestions();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-20 px-6"
    >
      <div className="w-24 h-24 bg-gradient-to-br from-brand-100 to-brand-100 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg">
        <Search className="w-12 h-12 text-brand-400" />
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-3">
        No {category === 'all' ? '' : categoryLabel.toLowerCase() + ' '}jobs found
        {searchQuery && <span className="text-gray-500 font-normal"> for "{searchQuery}"</span>}
      </h3>

      {hasActiveFilters && suggestions.length > 0 ? (
        <div className="mb-8 max-w-md mx-auto">
          <p className="text-gray-600 mb-4">Try these suggestions:</p>
          <ul className="text-left space-y-2">
            {suggestions.slice(0, 3).map((suggestion, i) => (
              <li key={i} className="flex items-start gap-2 text-gray-500">
                <span className="w-5 h-5 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-gray-500 mb-8 max-w-md mx-auto text-lg">
          Be the first to post a job and connect with the community!
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        {hasActiveFilters ? (
          <Button variant="outline" size="lg" onClick={onReset} className="rounded-full px-8">
            <RefreshCw className="w-4 h-4 mr-2" />
            Clear All Filters
          </Button>
        ) : (
          <Link to="/create">
            <Button size="lg" className="bg-brand-800 hover:bg-brand-900 rounded-full px-8 shadow-lg shadow-brand-500/20">
              <PlusCircle className="w-5 h-5 mr-2" />
              Post a Job
            </Button>
          </Link>
        )}
      </div>
    </motion.div>
  );
}

// Storage keys
const ITEMS_PER_PAGE = 12;
const FEED_SCROLL_STORAGE_KEY = 'spannerwork_feed_scroll_v1';
const FEED_RESTORE_HINT_KEY = 'spannerwork_feed_restore_hint_v1';
const FEED_VIEW_MODE_KEY = 'spannerwork_feed_view_mode';

type SortMode = 'recommended' | 'newest' | 'closest' | 'budget_high' | 'responses_low';
type ViewMode = 'grid' | 'list';

// Get persisted view mode
function getPersistedViewMode(): ViewMode {
  try {
    const saved = localStorage.getItem(FEED_VIEW_MODE_KEY);
    if (saved === 'grid' || saved === 'list') return saved;
  } catch {}
  return 'grid';
}

export default function Feed() {
  const navigationType = useNavigationType();

  // Restore state from session storage
  const savedState = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(FEED_SCROLL_STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }, []);

  const shouldRestore = useMemo(() => {
    try {
      return sessionStorage.getItem(FEED_RESTORE_HINT_KEY) === '1';
    } catch {
      return false;
    }
  }, []);

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [rateTypeFilter, setRateTypeFilter] = useState("all");
  const [budgetRange, setBudgetRange] = useState<number | string>("");
  const [radiusFilter, setRadiusFilter] = useState(25);
  const [nationwideSearch, setNationwideSearch] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('recommended');
  const [viewMode, setViewMode] = useState<ViewMode>(getPersistedViewMode);
  const [displayCount, setDisplayCount] = useState(() => {
    const saved = savedState.displayCount;
    return typeof saved === 'number' && saved > ITEMS_PER_PAGE ? saved : ITEMS_PER_PAGE;
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Track scroll for back-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const hasInitializedRef = useRef(false);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Queries - Feed must always show fresh data
  const { data: requestsData, isLoading } = useQuery({
    queryKey: queryKeys.requestsList({ status: 'ACTIVE' }),
    queryFn: () => requestsService.list({ status: 'ACTIVE' }),
    staleTime: 0, // Always consider data stale - refetch on every mount
    gcTime: 0, // Don't cache in memory
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: currentUserData } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () => authService.getCurrentUser(),
  });

  const { data: liveStats } = useQuery({
    queryKey: queryKeys.liveStats(),
    queryFn: () => activityService.getStats(),
    staleTime: 0,
    refetchInterval: 30000, // Poll every 30 seconds for live stats
    refetchOnWindowFocus: true,
  });

  const requests = useMemo(() => requestsData?.data || [], [requestsData?.data]);
  const currentUser = currentUserData?.user;

  // Distance calculation
  const calculateDistance = useCallback((lat1?: number | null, lng1?: number | null, lat2?: number | null, lng2?: number | null): number | null => {
    if (!lat1 || !lng1 || !lat2 || !lng2) return null;
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((request: Request) => {
      if (activeCategory !== 'all' && request.category?.toUpperCase() !== activeCategory.toUpperCase()) return false;
      if (debouncedSearchQuery) {
        const query = debouncedSearchQuery.toLowerCase();
        if (!request.title?.toLowerCase().includes(query) && !request.description?.toLowerCase().includes(query)) return false;
      }
      if (urgencyFilter !== 'all' && request.urgency?.toLowerCase().replace(/_/g, '_') !== urgencyFilter) return false;
      if (rateTypeFilter !== 'all' && request.rateType?.toLowerCase() !== rateTypeFilter) return false;
      if (budgetRange && typeof budgetRange === 'number' && (!request.budget || request.budget > budgetRange * 100)) return false;
      if (!nationwideSearch && currentUser?.locationLat && currentUser?.locationLng) {
        const dist = calculateDistance(currentUser.locationLat, currentUser.locationLng, request.locationLat, request.locationLng);
        if (dist !== null && dist > radiusFilter) return false;
      }
      return true;
    });
  }, [requests, activeCategory, debouncedSearchQuery, urgencyFilter, rateTypeFilter, budgetRange, nationwideSearch, radiusFilter, currentUser, calculateDistance]);

  // Sorted requests
  const sortedRequests = useMemo(() => {
    const sorted = [...filteredRequests];
    const getCreatedTs = (r: Request) => r.createdDate ? Date.parse(r.createdDate) : 0;
    const getDistance = (r: Request) => calculateDistance(currentUser?.locationLat, currentUser?.locationLng, r.locationLat, r.locationLng);

    sorted.sort((a, b) => {
      if (sortMode === 'newest') return getCreatedTs(b) - getCreatedTs(a);
      if (sortMode === 'closest') {
        const da = getDistance(a), db = getDistance(b);
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      }
      if (sortMode === 'budget_high') return (b.budget || 0) - (a.budget || 0);
      if (sortMode === 'responses_low') return (a.responseCount || 0) - (b.responseCount || 0);
      // Recommended: urgency + recency
      const urgencyScore = (u?: string) => ({ 'ASAP': 4, 'TODAY': 3, 'THIS_WEEKEND': 2 }[u?.toUpperCase() || ''] || 1);
      return (urgencyScore(b.urgency) - urgencyScore(a.urgency)) || (getCreatedTs(b) - getCreatedTs(a));
    });
    return sorted;
  }, [filteredRequests, sortMode, currentUser, calculateDistance]);

  const paginatedRequests = useMemo(() => sortedRequests.slice(0, displayCount), [sortedRequests, displayCount]);
  const hasMore = displayCount < sortedRequests.length;

  // Reset on filter change
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      return;
    }
    setDisplayCount(ITEMS_PER_PAGE);
    try {
      sessionStorage.removeItem(FEED_RESTORE_HINT_KEY);
      sessionStorage.removeItem(FEED_SCROLL_STORAGE_KEY);
    } catch {}
  }, [activeCategory, debouncedSearchQuery, urgencyFilter, rateTypeFilter, budgetRange, nationwideSearch, radiusFilter]);

  // Persist view mode
  useEffect(() => {
    try {
      localStorage.setItem(FEED_VIEW_MODE_KEY, viewMode);
    } catch {}
  }, [viewMode]);

  // Scroll restoration
  useEffect(() => {
    if (navigationType !== 'POP' && !shouldRestore) return;
    const y = savedState.windowY;
    if (typeof y !== 'number' || y <= 0 || isLoading) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
        try { sessionStorage.removeItem(FEED_RESTORE_HINT_KEY); } catch {}
      });
    });
  }, [navigationType, shouldRestore, savedState.windowY, isLoading]);

  // Persist scroll
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        try {
          if (window.location.pathname.toLowerCase() !== '/feed') return;
          sessionStorage.setItem(FEED_SCROLL_STORAGE_KEY, JSON.stringify({ displayCount, windowY: Math.round(window.scrollY) }));
        } catch {}
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [displayCount]);

  const handleLoadMore = useCallback(() => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setDisplayCount(prev => prev + ITEMS_PER_PAGE);
      setIsLoadingMore(false);
    }, 300);
  }, []);

  const resetFilters = () => {
    setActiveCategory("all");
    setSearchQuery("");
    setUrgencyFilter("all");
    setRateTypeFilter("all");
    setBudgetRange("");
    setRadiusFilter(25);
    setNationwideSearch(true);
    setSortMode('recommended');
    setShowFilters(false);
  };

  const hasActiveFilters = activeCategory !== 'all' || Boolean(debouncedSearchQuery) || urgencyFilter !== 'all' || rateTypeFilter !== 'all' || Boolean(budgetRange) || !nationwideSearch;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <SEO
        title="Find Jobs - SpannerWork | Tool Rentals, Mechanics & Workshop Space"
        description="Browse job opportunities from people who need tools, mechanics, or workshop space. Find local work and start earning on SpannerWork."
        url="https://www.spannerwork.co.uk/feed"
      />
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20 md:relative">
        <div className="max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1920px] 4xl:max-w-[2400px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 3xl:px-16 py-6">
          {/* Title Row */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl 2xl:text-5xl font-bold text-gray-900 tracking-tight">
                Find Jobs
              </h1>
              <p className="text-gray-500 mt-1 text-sm sm:text-base 2xl:text-lg">
                {filteredRequests.length} active {filteredRequests.length === 1 ? 'opportunity' : 'opportunities'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* View toggle */}
              <div className="hidden sm:flex items-center bg-gray-100 rounded-full p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2.5 rounded-full transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-brand-800' : 'text-gray-500 hover:text-gray-700'}`}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2.5 rounded-full transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-brand-800' : 'text-gray-500 hover:text-gray-700'}`}
                  aria-label="List view"
                >
                  <ListIcon className="w-4 h-4" />
                </button>
              </div>

              <Link to="/create">
                <Button className="bg-brand-800 hover:bg-brand-900 text-white rounded-full px-5 shadow-lg shadow-brand-500/20">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Post a Job</span>
                  <span className="sm:hidden">Post</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-5">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search jobs, tools, services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-12 py-6 text-base bg-gray-50 border-gray-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              const isActive = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm whitespace-nowrap transition-all ${
                    isActive
                      ? `bg-gradient-to-r ${category.activeGradient} text-white shadow-lg`
                      : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {category.label}
                </button>
              );
            })}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Sort */}
            <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
              <SelectTrigger className="h-10 px-4 rounded-full font-medium text-sm border border-gray-200 bg-white w-[185px]" aria-label="Sort jobs by">
                <ArrowUpDown className="w-4 h-4 mr-2 text-gray-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recommended">Recommended</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="closest" disabled={nationwideSearch || !currentUser?.locationLat}>Closest</SelectItem>
                <SelectItem value="budget_high">Highest Budget</SelectItem>
                <SelectItem value="responses_low">Fewest Responses</SelectItem>
              </SelectContent>
            </Select>

            {/* Filters */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all ${
                showFilters || hasActiveFilters
                  ? 'bg-brand-100 text-brand-800 border border-brand-200'
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {hasActiveFilters && !showFilters && (
                <span className="w-2 h-2 bg-brand-500 rounded-full" />
              )}
            </button>
          </div>

          {/* Desktop Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden hidden md:block"
              >
                <div className="pt-6 pb-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Refine Results</h3>
                    <button onClick={() => setShowFilters(false)} className="text-gray-500 hover:text-gray-700">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <FeedFilters
                    urgencyFilter={urgencyFilter}
                    setUrgencyFilter={setUrgencyFilter}
                    rateTypeFilter={rateTypeFilter}
                    setRateTypeFilter={setRateTypeFilter}
                    budgetRange={budgetRange}
                    setBudgetRange={setBudgetRange}
                    radiusFilter={radiusFilter}
                    setRadiusFilter={setRadiusFilter}
                    nationwideSearch={nationwideSearch}
                    setNationwideSearch={setNationwideSearch}
                  />
                  {hasActiveFilters && (
                    <div className="mt-4 flex justify-end">
                      <Button variant="ghost" size="sm" onClick={resetFilters} className="text-brand-700">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reset all
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1920px] 4xl:max-w-[2400px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 3xl:px-16 py-8">
        <div className="relative">
          {/* Job Cards - Full width, sidebar is now a slide-out panel */}
          <div ref={containerRef}>
            {isLoading ? (
              <div className={viewMode === 'list' ? 'space-y-4' : 'grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-4 md:gap-5 lg:gap-6 items-start'}>
                {[...Array(6)].map((_, i) => (
                  <SkeletonCard key={i} viewMode={viewMode} />
                ))}
              </div>
            ) : filteredRequests.length === 0 ? (
              <EmptyState category={activeCategory} onReset={resetFilters} hasActiveFilters={hasActiveFilters} searchQuery={debouncedSearchQuery} />
            ) : (
              <>
                {/* Results count */}
                <p className="text-sm text-gray-500 mb-6">
                  Showing {paginatedRequests.length} of {filteredRequests.length} jobs
                  {hasActiveFilters && (
                    <button onClick={resetFilters} className="ml-2 text-brand-700 hover:underline">
                      Clear filters
                    </button>
                  )}
                </p>

                {/* Cards */}
                <motion.div
                  className={viewMode === 'list' ? 'space-y-4' : 'grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-4 md:gap-5 lg:gap-6 items-start'}
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {paginatedRequests.map((request: Request, index: number) => (
                    <motion.div key={request.id} variants={cardVariants}>
                      <ErrorBoundary
                        fallback={<CardErrorFallback viewMode={viewMode} />}
                        key={`eb-${request.id}`}
                      >
                        <RequestCard
                          request={request}
                          currentUser={currentUser}
                          categoryIcons={CATEGORY_ICONS}
                          viewMode={viewMode}
                          priority={index < 4}
                        />
                      </ErrorBoundary>
                    </motion.div>
                  ))}
                </motion.div>

                {/* Load more */}
                {hasMore && (
                  <div className="text-center py-12">
                    <Button
                      variant="outline"
                      size="lg"
                      className="rounded-full px-8 border-2"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          Load More
                          <Badge className="ml-2 bg-gray-100 text-gray-600">
                            {filteredRequests.length - paginatedRequests.length}
                          </Badge>
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {!hasMore && filteredRequests.length > ITEMS_PER_PAGE && (
                  <p className="text-center text-gray-400 text-sm py-8">
                    You've seen all {filteredRequests.length} jobs
                  </p>
                )}
              </>
            )}
          </div>

          </div>
      </div>

      {/* Sidebar Toggle Button - Desktop only */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 z-40 w-10 h-24 bg-white border border-r-0 border-gray-200 rounded-l-xl shadow-lg items-center justify-center hover:bg-gray-50 transition-colors group"
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        <div className="flex flex-col items-center gap-1">
          <BarChart3 className="w-4 h-4 text-gray-600 group-hover:text-brand-800" />
          {sidebarOpen ? (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Sidebar Slide-out Panel - Desktop only */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="hidden lg:block fixed inset-0 bg-black/20 z-40"
              onClick={() => setSidebarOpen(false)}
            />
            {/* Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="hidden lg:block fixed right-0 top-0 bottom-0 w-80 xl:w-96 bg-white shadow-2xl z-50 overflow-y-auto"
            >
              <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-lg text-gray-900">Market Insights</h2>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {/* Stats Card */}
                <Card className="border-0 shadow-lg bg-white overflow-hidden">
                  <div className="p-5 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">Market Overview</h3>
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                        </span>
                        <span className="text-xs text-gray-500">Live</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{liveStats?.activeRequests ?? filteredRequests.length}</div>
                        <div className="text-xs text-gray-500 mt-1">Jobs</div>
                      </div>
                      <div className="border-x border-gray-100">
                        <div className="text-2xl font-bold text-gray-900">{liveStats?.activeListings ?? '—'}</div>
                        <div className="text-xs text-gray-500 mt-1">Listings</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-emerald-600">{liveStats?.recentTransactions ?? '—'}</div>
                        <div className="text-xs text-gray-500 mt-1">Today</div>
                      </div>
                    </div>
                  </div>

                  {currentUser && (
                    <div className="px-5 pb-5">
                      <Link to="/provider-dashboard" className="group flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-brand-800 flex items-center justify-center">
                            <Zap className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">Provider Dashboard</div>
                            <div className="text-xs text-gray-500">Manage your listings</div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-800 transition-colors" />
                      </Link>
                    </div>
                  )}
                </Card>

                {/* Activity Feed */}
                <Card className="border-0 shadow-lg bg-white overflow-hidden">
                  <div className="p-5 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Recent Activity</h3>
                  </div>
                  <div className="p-5">
                    <LiveActivityFeed limit={5} showStats={false} compact={true} embedded={true} />
                  </div>
                </Card>

                {/* Post CTA */}
                <Link to="/create" className="block">
                  <Card className="border-0 bg-gradient-to-br from-brand-800 to-brand-900 text-white overflow-hidden hover:shadow-xl transition-shadow">
                    <div className="p-6 text-center">
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <PlusCircle className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-lg mb-2">Need help with something?</h3>
                      <p className="text-brand-100 text-sm mb-4">Post a job and get responses from local experts</p>
                      <Button className="w-full bg-white text-brand-800 hover:bg-brand-50 font-semibold">
                        Post a Job
                      </Button>
                    </div>
                  </Card>
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Floating Action Pill - Filter + Back to Top */}
      <div className="fixed bottom-32 right-4 md:hidden z-30">
        <motion.div
          className="flex items-center bg-white rounded-full shadow-xl border border-gray-200 overflow-hidden"
          initial={false}
          animate={{ width: showBackToTop ? 'auto' : 56 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
        >
          {/* Back to Top - appears when scrolled */}
          <AnimatePresence>
            {showBackToTop && (
              <motion.button
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 48 }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="h-14 flex items-center justify-center text-brand-600 hover:text-brand-800 transition-colors"
                aria-label="Back to top"
              >
                <ArrowUp className="w-5 h-5" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Divider - only shows when back-to-top is visible */}
          {showBackToTop && (
            <div className="w-px h-8 bg-gray-200" />
          )}

          {/* Filter Button - always visible */}
          <button
            onClick={() => setShowFilters(true)}
            className={`relative w-14 h-14 flex items-center justify-center transition-colors ${
              hasActiveFilters
                ? 'text-brand-600'
                : 'text-gray-700'
            }`}
            aria-label="Open filters"
          >
            <Filter className="w-5 h-5" />
            {hasActiveFilters && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-brand-500 rounded-full" />
            )}
          </button>
        </motion.div>
      </div>

      {/* Mobile Filter Sheet */}
      <AnimatePresence>
        {showFilters && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setShowFilters(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 right-0 bottom-0 z-50 md:hidden bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-auto"
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
              <div className="flex items-center justify-between px-5 pb-4 border-b border-gray-100">
                <h3 className="font-bold text-lg text-gray-900">Filters</h3>
                <button onClick={() => setShowFilters(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <FeedFilters
                urgencyFilter={urgencyFilter}
                setUrgencyFilter={setUrgencyFilter}
                rateTypeFilter={rateTypeFilter}
                setRateTypeFilter={setRateTypeFilter}
                budgetRange={budgetRange}
                setBudgetRange={setBudgetRange}
                radiusFilter={radiusFilter}
                setRadiusFilter={setRadiusFilter}
                nationwideSearch={nationwideSearch}
                setNationwideSearch={setNationwideSearch}
                onClose={() => setShowFilters(false)}
                onReset={resetFilters}
                isMobile={true}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
