/**
 * Feed - Premium Job Discovery Experience
 *
 * A beautifully redesigned feed with:
 * - Animated header with visual depth
 * - Tactile filter pills with motion feedback
 * - Staggered card animations
 * - Smart empty states
 * - Skeleton loading
 * - Pull-to-refresh visual feel
 * - Virtualized list for performance with large datasets
 * - Fully functional filtering system
 * - Pagination with load more
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { authService, requestsService, activityService } from "@/api/services";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigationType } from "react-router-dom";
import { queryKeys } from "@/lib/queryKeys";
import { motion, AnimatePresence } from "framer-motion";
import { List, type RowComponentProps } from "react-window";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  TrendingUp,
  Sparkles,
  X,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowUpDown,
  LucideIcon,
  RefreshCw
} from "lucide-react";
import RequestCard from "../components/feed/RequestCard";
import FeedFilters from "../components/feed/FeedFilters";
import LiveActivityFeed from "../components/feed/LiveActivityFeed";
import { Request, type User } from "@/types";

// Custom hook for debounced search
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const }
  }
};

const filterVariants = {
  inactive: { scale: 1 },
  active: { scale: 1.02 },
  tap: { scale: 0.95 }
};

interface CategoryConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

// Category configuration
const CATEGORIES: CategoryConfig[] = [
  { id: 'all', label: 'All Jobs', icon: Sparkles, color: 'from-gray-600 to-gray-800' },
  { id: 'tools', label: 'Tools', icon: Wrench, color: 'from-orange-500 to-red-500' },
  { id: 'expertise', label: 'Services', icon: GraduationCap, color: 'from-blue-500 to-indigo-500' },
  { id: 'space', label: 'Space', icon: Warehouse, color: 'from-purple-500 to-pink-500' },
];

// Category icons map
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  TOOLS: Wrench,
  EXPERTISE: GraduationCap,
  SPACE: Warehouse
};

// Skeleton card component
function SkeletonCard() {
  return (
    <Card className="border border-gray-200/70 shadow-sm overflow-hidden bg-white">
      <div className="h-1 bg-gray-100 animate-pulse" />
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-gray-200 rounded-xl animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4" />
            <div className="flex gap-2">
              <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
              <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6" />
        </div>
        <div className="flex gap-3 pt-2 border-t">
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
      </CardContent>
    </Card>
  );
}

// Virtualization threshold - only virtualize when we have many items
const VIRTUALIZATION_THRESHOLD = 20;
const ROW_HEIGHT = 420; // Approximate height of a card row
const GAP = 24; // Gap between cards (gap-6 = 1.5rem = 24px)

// Virtualized grid row component
interface VirtualizedRowProps {
  requests: Request[];
  currentUser?: User;
  categoryIcons: Record<string, LucideIcon>;
  columnCount: number;
}

type VirtualizedRowData = VirtualizedRowProps

function VirtualizedRow({ index, style, requests, currentUser, categoryIcons, columnCount }: RowComponentProps<VirtualizedRowData>) {
  const startIndex = index * columnCount;
  const rowRequests = requests.slice(startIndex, startIndex + columnCount);

  return (
    <div style={style} className="flex gap-6 pr-4">
      {rowRequests.map((request: Request) => (
        <div key={request.id} className="flex-1 min-w-0">
          <motion.div variants={cardVariants} initial="hidden" animate="visible">
            <RequestCard
              request={request}
              currentUser={currentUser}
              categoryIcons={categoryIcons}
            />
          </motion.div>
        </div>
      ))}
      {/* Fill empty slots to maintain grid alignment */}
      {rowRequests.length < columnCount &&
        Array.from({ length: columnCount - rowRequests.length }).map((_, i) => (
          <div key={`empty-${i}`} className="flex-1 min-w-0" />
        ))}
    </div>
  );
}

// Hook to track container width for responsive column count
function useContainerWidth() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  return { containerRef, width };
}

interface EmptyStateProps {
  category: string;
  onReset: () => void;
  hasActiveFilters?: boolean;
}

// Popular search suggestions
const POPULAR_SEARCHES = [
  { label: 'Power tools', query: 'power tools' },
  { label: 'Plumbing', query: 'plumbing' },
  { label: 'Workshop space', query: 'workshop' },
  { label: 'Electrical work', query: 'electrical' },
];

// Empty state component
function EmptyState({ category, onReset, hasActiveFilters }: EmptyStateProps) {
  const categoryLabel = CATEGORIES.find(c => c.id === category)?.label || 'jobs';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16 px-4"
      role="status"
      aria-live="polite"
    >
      <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-amber-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
        <Search className="w-12 h-12 text-orange-400" aria-hidden="true" />
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-2">
        No {category === 'all' ? '' : categoryLabel.toLowerCase() + ' '}jobs found
      </h3>
      <p className="text-gray-500 mb-6 max-w-sm mx-auto">
        {hasActiveFilters
          ? "Try adjusting your filters or search terms to find more jobs."
          : category === 'all'
            ? "Be the first to post a job and get help from the community!"
            : `No ${categoryLabel.toLowerCase()} requests right now. Try another category or post your own!`
        }
      </p>

      {/* Popular searches suggestion */}
      {!hasActiveFilters && (
        <div className="mb-8">
          <p className="text-sm text-gray-500 mb-3">Popular searches:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {POPULAR_SEARCHES.map((search) => (
              <Badge
                key={search.query}
                className="bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer px-3 py-1"
              >
                {search.label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {hasActiveFilters ? (
          <Button
            variant="outline"
            onClick={onReset}
            className="border-2"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Clear All Filters
          </Button>
        ) : (
          <>
            <Link to="/create">
              <Button className="bg-brand-800 hover:bg-brand-900 shadow-lg shadow-orange-500/25">
                <PlusCircle className="w-4 h-4 mr-2" />
                Post a Job
              </Button>
            </Link>
            {category !== 'all' && (
              <Button variant="outline" onClick={onReset}>
                View All Jobs
              </Button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

interface StatsBannerProps {
  totalJobs: number;
}

// Stats banner component
function StatsBanner({ totalJobs }: StatsBannerProps) {
  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-gray-600">
          <span className="font-semibold text-gray-900">{totalJobs}</span> active jobs
        </span>
      </div>
    </div>
  );
}

// Items per page for pagination
const ITEMS_PER_PAGE = 12;

const FEED_SCROLL_STORAGE_KEY = 'spannerwork_feed_scroll_v1';
const FEED_RESTORE_HINT_KEY = 'spannerwork_feed_restore_hint_v1';

type SortMode = 'recommended' | 'newest' | 'closest' | 'budget_high' | 'responses_low';

export default function Feed() {
  const navigationType = useNavigationType();

  const shouldRestoreFromHint = useMemo(() => {
    try {
      return sessionStorage.getItem(FEED_RESTORE_HINT_KEY) === '1';
    } catch {
      return false;
    }
  }, []);

  const savedFeedScrollState = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(FEED_SCROLL_STORAGE_KEY);
      if (!raw) return {} as { displayCount?: number; virtualizedOffset?: number; windowY?: number };
      const parsed = JSON.parse(raw) as
        | { type?: string; offset?: number; displayCount?: number }
        | { displayCount?: number; virtualizedOffset?: number; windowY?: number };

      if ('type' in parsed) {
        if (parsed.type === 'virtualized') {
          return {
            displayCount: parsed.displayCount,
            virtualizedOffset: typeof parsed.offset === 'number' ? parsed.offset : undefined,
          };
        }
        if (parsed.type === 'window') {
          return {
            displayCount: parsed.displayCount,
            windowY: typeof parsed.offset === 'number' ? parsed.offset : undefined,
          };
        }
      }

      return {
        displayCount: parsed.displayCount,
        virtualizedOffset: (parsed as { virtualizedOffset?: number }).virtualizedOffset,
        windowY: (parsed as { windowY?: number }).windowY,
      };
    } catch {
      return {} as { displayCount?: number; virtualizedOffset?: number; windowY?: number };
    }
  }, []);
  // Search and category state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const { containerRef, width: containerWidth } = useContainerWidth();

  // Filter states
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [rateTypeFilter, setRateTypeFilter] = useState("all");
  const [budgetRange, setBudgetRange] = useState<number | string>("");
  const [radiusFilter, setRadiusFilter] = useState(25);
  const [nationwideSearch, setNationwideSearch] = useState(true);

  const [sortMode, setSortMode] = useState<SortMode>('recommended');

  // Pagination state
  const [displayCount, setDisplayCount] = useState(() => {
    try {
      const saved = savedFeedScrollState.displayCount;
      if (typeof saved === 'number' && Number.isFinite(saved) && saved > ITEMS_PER_PAGE) {
        return Math.max(ITEMS_PER_PAGE, Math.floor(saved));
      }
    } catch {
      // ignore
    }
    return ITEMS_PER_PAGE;
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const hasInitializedRef = useRef(false);
  const hasRestoredWindowScrollRef = useRef(false);
  const hasRestoredVirtualizedScrollRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FixedSizeList ref type is complex
  const virtualListRef = useRef<any>(null);

  // Debounced search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Determine column count based on container width (md breakpoint = 768px)
  const columnCount = containerWidth >= 768 ? 2 : 1;

  // Fetch requests
  const { data: requestsData, isLoading } = useQuery({
    queryKey: queryKeys.requestsList({ status: 'ACTIVE' }),
    queryFn: () => requestsService.list({ status: 'ACTIVE' }),
  });

  const requests = requestsData?.data || [];

  // Fetch current user
  const { data: currentUserData } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () => authService.getCurrentUser(),
  });

  const currentUser = currentUserData?.user;

  // Fetch live stats for market insights
  const { data: liveStats } = useQuery({
    queryKey: queryKeys.liveStats(),
    queryFn: () => activityService.getStats(),
    refetchInterval: 60000, // Refresh every minute
  });

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = useCallback((lat1?: number | null, lng1?: number | null, lat2?: number | null, lng2?: number | null): number | null => {
    if (!lat1 || !lng1 || !lat2 || !lng2) return null;
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Filter requests with all criteria
  const filteredRequests = useMemo(() => {
    return requests.filter((request: Request) => {
      // Category filter
      if (activeCategory !== 'all' && request.category?.toUpperCase() !== activeCategory.toUpperCase()) {
        return false;
      }

      // Search filter (using debounced value)
      if (debouncedSearchQuery) {
        const query = debouncedSearchQuery.toLowerCase();
        const matchesTitle = request.title?.toLowerCase().includes(query);
        const matchesDescription = request.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDescription) {
          return false;
        }
      }

      // Urgency filter
      if (urgencyFilter !== 'all') {
        const requestUrgency = request.urgency?.toLowerCase().replace(/_/g, '_');
        if (requestUrgency !== urgencyFilter) {
          return false;
        }
      }

      // Rate type filter
      if (rateTypeFilter !== 'all') {
        const requestRateType = request.rateType?.toLowerCase();
        if (requestRateType !== rateTypeFilter) {
          return false;
        }
      }

      // Budget filter
      if (budgetRange && typeof budgetRange === 'number') {
        const maxBudgetPence = Math.round(budgetRange * 100);
        if (!request.budget || request.budget > maxBudgetPence) {
          return false;
        }
      }

      // Distance filter (only if user has location and not nationwide)
      if (!nationwideSearch && currentUser?.locationLat && currentUser?.locationLng) {
        const distance = calculateDistance(
          currentUser.locationLat,
          currentUser.locationLng,
          request.locationLat,
          request.locationLng
        );
        if (distance !== null && distance > radiusFilter) {
          return false;
        }
      }

      return true;
    });
  }, [requests, activeCategory, debouncedSearchQuery, urgencyFilter, rateTypeFilter, budgetRange, nationwideSearch, radiusFilter, currentUser, calculateDistance]);

  const sortedRequests = useMemo(() => {
    const getCreatedTs = (r: Request) => {
      const ts = r.createdDate ? Date.parse(r.createdDate) : 0;
      return Number.isFinite(ts) ? ts : 0;
    };

    const urgencyScore = (urgency?: string | null) => {
      switch ((urgency || '').toUpperCase()) {
        case 'ASAP':
          return 1;
        case 'TODAY':
          return 0.75;
        case 'THIS_WEEKEND':
          return 0.5;
        case 'FLEXIBLE':
        default:
          return 0.25;
      }
    };

    const getDistanceMiles = (r: Request) => {
      if (!currentUser?.locationLat || !currentUser?.locationLng) return null;
      return calculateDistance(
        currentUser.locationLat,
        currentUser.locationLng,
        r.locationLat,
        r.locationLng
      );
    };

    const recommendedScore = (r: Request) => {
      const u = urgencyScore(r.urgency);

      const createdTs = getCreatedTs(r);
      const hoursSince = createdTs ? (Date.now() - createdTs) / (1000 * 60 * 60) : 9999;
      const recency = Math.exp(-Math.max(0, hoursSince) / 48);

      const distance = !nationwideSearch ? getDistanceMiles(r) : null;
      const distanceScore = distance === null ? 0 : 1 / (1 + distance / 10);

      const budgetPence = typeof r.budget === 'number' ? r.budget : 0;
      const budgetPounds = budgetPence / 100;
      const budgetScore = budgetPounds > 0 ? Math.min(1, Math.log10(1 + budgetPounds) / 3) : 0;

      const responses = typeof r.responseCount === 'number' ? r.responseCount : 0;
      const competitionScore = 1 / (1 + responses);

      return (
        u * 0.35 +
        recency * 0.25 +
        distanceScore * 0.2 +
        budgetScore * 0.15 +
        competitionScore * 0.05
      );
    };

    const stableTieBreak = (a: Request, b: Request) => {
      const createdDiff = getCreatedTs(b) - getCreatedTs(a);
      if (createdDiff !== 0) return createdDiff;
      return a.id.localeCompare(b.id);
    };

    const sorted = [...filteredRequests];

    sorted.sort((a, b) => {
      if (sortMode === 'newest') {
        return stableTieBreak(a, b);
      }

      if (sortMode === 'closest') {
        const da = getDistanceMiles(a);
        const db = getDistanceMiles(b);
        if (da === null && db === null) return stableTieBreak(a, b);
        if (da === null) return 1;
        if (db === null) return -1;
        if (da !== db) return da - db;
        return stableTieBreak(a, b);
      }

      if (sortMode === 'budget_high') {
        const ba = typeof a.budget === 'number' ? a.budget : 0;
        const bb = typeof b.budget === 'number' ? b.budget : 0;
        if (ba !== bb) return bb - ba;
        return stableTieBreak(a, b);
      }

      if (sortMode === 'responses_low') {
        const ra = typeof a.responseCount === 'number' ? a.responseCount : 0;
        const rb = typeof b.responseCount === 'number' ? b.responseCount : 0;
        if (ra !== rb) return ra - rb;
        return stableTieBreak(a, b);
      }

      const sa = recommendedScore(a);
      const sb = recommendedScore(b);
      if (sa !== sb) return sb - sa;
      return stableTieBreak(a, b);
    });

    return sorted;
  }, [filteredRequests, sortMode, nationwideSearch, currentUser, calculateDistance]);

  // Paginated requests for display
  const paginatedRequests = useMemo(() => {
    return sortedRequests.slice(0, displayCount);
  }, [sortedRequests, displayCount]);

  // Check if there are more items to load
  const hasMore = displayCount < sortedRequests.length;

  // Reset display count when filters change
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      return;
    }
    setDisplayCount(ITEMS_PER_PAGE);
    try {
      sessionStorage.removeItem(FEED_RESTORE_HINT_KEY);
      sessionStorage.removeItem(FEED_SCROLL_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, [activeCategory, debouncedSearchQuery, urgencyFilter, rateTypeFilter, budgetRange, nationwideSearch, radiusFilter]);

  useEffect(() => {
    if (hasRestoredWindowScrollRef.current) return;
    if (navigationType !== 'POP' && !shouldRestoreFromHint) return;
    const target = typeof savedFeedScrollState.windowY === 'number' ? savedFeedScrollState.windowY : 0;
    if (!Number.isFinite(target) || target <= 0) return;
    if (isLoading) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, Math.max(0, Math.round(target)));
        hasRestoredWindowScrollRef.current = true;
        try {
          sessionStorage.removeItem(FEED_RESTORE_HINT_KEY);
        } catch {
          // ignore
        }
      });
    });
  }, [navigationType, shouldRestoreFromHint, savedFeedScrollState.windowY, isLoading]);

  const savedVirtualizedScrollOffset = useMemo(() => {
    const offset = typeof savedFeedScrollState.virtualizedOffset === 'number' ? savedFeedScrollState.virtualizedOffset : 0;
    return Number.isFinite(offset) && offset > 0 ? offset : 0;
  }, []);

  useEffect(() => {
    if (hasRestoredVirtualizedScrollRef.current) return;
    if (navigationType !== 'POP' && !shouldRestoreFromHint) return;
    if (isLoading) return;
    if (savedVirtualizedScrollOffset <= 0) return;
    if (paginatedRequests.length <= VIRTUALIZATION_THRESHOLD) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FixedSizeList API type varies
        const api = virtualListRef.current as any;
        const method = api?.scrollTo ?? api?.scrollToOffset;
        if (typeof method === 'function') {
          method.call(api, savedVirtualizedScrollOffset);
          hasRestoredVirtualizedScrollRef.current = true;
          try {
            sessionStorage.removeItem(FEED_RESTORE_HINT_KEY);
          } catch {
            // ignore
          }
        }
      });
    });
  }, [navigationType, shouldRestoreFromHint, isLoading, paginatedRequests.length, savedVirtualizedScrollOffset]);

  const persistVirtualizedScrollOffset = useCallback((offset: number) => {
    try {
      const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.round(offset)) : 0;

      let existing: { displayCount?: number; virtualizedOffset?: number; windowY?: number } = {};
      try {
        const raw = sessionStorage.getItem(FEED_SCROLL_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as
            | { type?: string; offset?: number; displayCount?: number }
            | { displayCount?: number; virtualizedOffset?: number; windowY?: number };
          if ('type' in parsed) {
            if (parsed.type === 'window') {
              existing = { displayCount: parsed.displayCount, windowY: parsed.offset };
            } else if (parsed.type === 'virtualized') {
              existing = { displayCount: parsed.displayCount, virtualizedOffset: parsed.offset };
            }
          } else {
            existing = parsed;
          }
        }
      } catch {
        // ignore
      }

      sessionStorage.setItem(
        FEED_SCROLL_STORAGE_KEY,
        JSON.stringify({
          ...existing,
          displayCount,
          virtualizedOffset: safeOffset,
        })
      );
    } catch {
      // ignore
    }
  }, [displayCount]);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        try {
          if (window.location.pathname.toLowerCase() !== '/feed') return;
          const safeY = Number.isFinite(window.scrollY) ? Math.max(0, Math.round(window.scrollY)) : 0;

          let existing: { displayCount?: number; virtualizedOffset?: number; windowY?: number } = {};
          try {
            const raw = sessionStorage.getItem(FEED_SCROLL_STORAGE_KEY);
            if (raw) {
              const parsed = JSON.parse(raw) as
                | { type?: string; offset?: number; displayCount?: number }
                | { displayCount?: number; virtualizedOffset?: number; windowY?: number };
              if ('type' in parsed) {
                if (parsed.type === 'window') {
                  existing = { displayCount: parsed.displayCount, windowY: parsed.offset };
                } else if (parsed.type === 'virtualized') {
                  existing = { displayCount: parsed.displayCount, virtualizedOffset: parsed.offset };
                }
              } else {
                existing = parsed;
              }
            }
          } catch {
            // ignore
          }

          sessionStorage.setItem(
            FEED_SCROLL_STORAGE_KEY,
            JSON.stringify({
              ...existing,
              displayCount,
              windowY: safeY,
            })
          );
        } catch {
          // ignore
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [displayCount]);

  useEffect(() => {
    try {
      if (window.location.pathname.toLowerCase() !== '/feed') return;
      let existing: { displayCount?: number; virtualizedOffset?: number; windowY?: number } = {};
      try {
        const raw = sessionStorage.getItem(FEED_SCROLL_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as
            | { type?: string; offset?: number; displayCount?: number }
            | { displayCount?: number; virtualizedOffset?: number; windowY?: number };
          if ('type' in parsed) {
            if (parsed.type === 'window') {
              existing = { displayCount: parsed.displayCount, windowY: parsed.offset };
            } else if (parsed.type === 'virtualized') {
              existing = { displayCount: parsed.displayCount, virtualizedOffset: parsed.offset };
            }
          } else {
            existing = parsed;
          }
        }
      } catch {
        // ignore
      }

      sessionStorage.setItem(
        FEED_SCROLL_STORAGE_KEY,
        JSON.stringify({
          ...existing,
          displayCount,
        })
      );
    } catch {
      // ignore
    }
  }, [displayCount]);

  // Load more handler
  const handleLoadMore = useCallback(() => {
    setIsLoadingMore(true);
    // Simulate a small delay for better UX
    setTimeout(() => {
      setDisplayCount(prev => prev + ITEMS_PER_PAGE);
      setIsLoadingMore(false);
    }, 300);
  }, []);

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
  };

  const scrollToFilters = useCallback(() => {
    setShowFilters(true);

    requestAnimationFrame(() => {
      const el = document.getElementById('feed-filters');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, []);

  // Reset all filters
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

  // Check if any filters are active
  const hasActiveFilters =
    activeCategory !== 'all' ||
    Boolean(debouncedSearchQuery) ||
    urgencyFilter !== 'all' ||
    rateTypeFilter !== 'all' ||
    Boolean(budgetRange) ||
    !nationwideSearch;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50/10">
      {/* Premium Header */}
      <div id="feed-filters" className="bg-white/90 backdrop-blur border-b border-gray-100 sticky top-0 z-20 md:relative">
        <div className="max-w-7xl mx-auto px-4 py-5">
          {/* Top row: Title + CTA */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <motion.h1 
                className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                Find Jobs
              </motion.h1>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <StatsBanner totalJobs={filteredRequests.length} />
              </motion.div>
            </div>
            
            <Link to="/create">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button className="bg-gradient-to-r from-brand-800 to-brand-500 hover:from-brand-900 hover:to-brand-700 text-white shadow-sm hover:shadow-md transition-shadow font-semibold">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Post a Job</span>
                  <span className="sm:hidden">Post</span>
                </Button>
              </motion.div>
            </Link>
          </div>

          {/* Search bar */}
          <motion.div
            className="relative mb-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
            <Input
              placeholder="Search for tools, services, workshop space..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-12 py-5 text-[15px] bg-white border-gray-200 rounded-xl shadow-sm focus:shadow-md focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              aria-label="Search jobs"
              aria-describedby="search-hint"
              role="searchbox"
            />
            <span id="search-hint" className="sr-only">
              Search by job title or description. Results update as you type.
            </span>
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </motion.div>

          {/* Category filters */}
          <motion.div
            className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            role="tablist"
            aria-label="Filter by category"
          >
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              const isActive = activeCategory === category.id;

              return (
                <motion.button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all
                    ${isActive
                      ? `bg-gradient-to-r ${category.color} text-white shadow-sm ring-1 ring-black/5`
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }
                  `}
                  variants={filterVariants}
                  initial="inactive"
                  animate={isActive ? "active" : "inactive"}
                  whileTap="tap"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="job-results"
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  {category.label}
                  {isActive && category.id !== 'all' && (
                    <Badge className="bg-white/20 text-white text-xs ml-1">
                      {filteredRequests.length}
                    </Badge>
                  )}
                </motion.button>
              );
            })}

            <div className="ml-auto flex items-center gap-2">
              <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                <SelectTrigger
                  className="h-9 px-4 rounded-full font-medium text-sm whitespace-nowrap border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  aria-label="Sort jobs"
                >
                  <ArrowUpDown className="w-4 h-4 mr-2" aria-hidden="true" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommended">Recommended</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="closest" disabled={nationwideSearch || !currentUser?.locationLat || !currentUser?.locationLng}>Closest</SelectItem>
                  <SelectItem value="budget_high">Highest budget</SelectItem>
                  <SelectItem value="responses_low">Fewest responses</SelectItem>
                </SelectContent>
              </Select>

              {/* Advanced filters button */}
              <motion.button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all ${
                  showFilters || hasActiveFilters
                    ? 'bg-orange-50 text-orange-700 border border-orange-200'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
                whileTap={{ scale: 0.95 }}
                aria-expanded={showFilters}
                aria-controls="advanced-filters"
                aria-label={`${showFilters ? 'Hide' : 'Show'} advanced filters${hasActiveFilters ? ' (filters active)' : ''}`}
              >
                <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
                Filters
                {hasActiveFilters && !showFilters && (
                  <span className="w-2 h-2 bg-orange-500 rounded-full" aria-hidden="true" />
                )}
              </motion.button>
            </div>
          </motion.div>

          {/* Advanced Filters Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                id="advanced-filters"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetFilters}
                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reset all filters
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active search indicator */}
          <AnimatePresence>
            {searchQuery && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4"
              >
                <div className="flex items-center gap-2 text-sm text-gray-600 bg-orange-50 rounded-lg px-3 py-2">
                  <Search className="w-4 h-4 text-orange-500" />
                  <span>Showing results for "<span className="font-semibold text-gray-900">{searchQuery}</span>"</span>
                  <button 
                    onClick={clearSearch}
                    className="ml-auto text-orange-600 hover:text-orange-800 font-medium"
                  >
                    Clear
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Job Cards */}
          <div className="lg:col-span-2" ref={containerRef} id="job-results" role="tabpanel" aria-label="Job listings">
            {/* Results summary */}
            {!isLoading && filteredRequests.length > 0 && (
              <motion.p
                className="text-sm text-gray-600 mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                Showing {paginatedRequests.length} of {filteredRequests.length} jobs
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="ml-2 text-orange-700 hover:text-orange-800 underline underline-offset-4"
                  >
                    Clear filters
                  </button>
                )}
              </motion.p>
            )}

            {isLoading ? (
              // Skeleton loading
              <div className="grid md:grid-cols-2 gap-6">
                {[...Array(4)].map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : filteredRequests.length === 0 ? (
              // Empty state
              <EmptyState
                category={activeCategory}
                onReset={resetFilters}
                hasActiveFilters={hasActiveFilters}
              />
            ) : paginatedRequests.length > VIRTUALIZATION_THRESHOLD ? (
              // Virtualized list for large datasets
              <List
                ref={virtualListRef}
                rowCount={Math.ceil(paginatedRequests.length / columnCount)}
                rowHeight={ROW_HEIGHT + GAP}
                rowComponent={VirtualizedRow}
                rowProps={{
                  requests: paginatedRequests,
                  currentUser,
                  categoryIcons: CATEGORY_ICONS,
                  columnCount,
                }}
                initialScrollOffset={savedVirtualizedScrollOffset}
                onScroll={(args: unknown) => {
                  const a = args as { scrollOffset?: number; scrollTop?: number } | number | null | undefined;
                  const offset =
                    typeof a === 'number'
                      ? a
                      : typeof a?.scrollOffset === 'number'
                        ? a.scrollOffset
                        : typeof a?.scrollTop === 'number'
                          ? a.scrollTop
                          : 0;
                  persistVirtualizedScrollOffset(offset);
                }}
                style={{ height: Math.min(800, window.innerHeight - 300), width: '100%' }}
                className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
              />
            ) : (
              // Regular rendering for smaller datasets (keeps animations)
              <motion.div
                className="grid md:grid-cols-2 gap-6"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {paginatedRequests.map((request: Request) => (
                  <motion.div key={request.id} variants={cardVariants}>
                    <RequestCard
                      request={request}
                      currentUser={currentUser}
                      categoryIcons={CATEGORY_ICONS}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Load more button */}
            {hasMore && (
              <motion.div
                className="text-center py-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Button
                  variant="outline"
                  className="border-2 min-w-[200px]"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  aria-label={`Load more jobs. Currently showing ${paginatedRequests.length} of ${filteredRequests.length}`}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Load More Jobs ({filteredRequests.length - paginatedRequests.length} remaining)
                    </>
                  )}
                </Button>
              </motion.div>
            )}

            {/* End of results indicator */}
            {!hasMore && filteredRequests.length > ITEMS_PER_PAGE && (
              <motion.p
                className="text-center text-gray-500 text-sm py-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                You've seen all {filteredRequests.length} jobs
              </motion.p>
            )}
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              {/* Provider CTA */}
              {currentUser && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Card className="border border-orange-200/30 shadow-sm bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 text-white overflow-hidden relative">
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute inset-0" style={{
                        backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                        backgroundSize: '20px 20px'
                      }} />
                    </div>
                    <CardContent className="p-6 relative">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-5 h-5" />
                        <span className="font-bold">Provider Mode</span>
                      </div>
                      <p className="text-orange-100 text-sm mb-4">
                        Get notified instantly when jobs match your services.
                      </p>
                      <Link to="/provider-dashboard">
                        <Button variant="secondary" size="sm" className="w-full bg-white text-orange-600 hover:bg-orange-50 font-semibold">
                          Open Dashboard
                          <ArrowUpRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Quick Stats Card - Now with live data */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="border border-gray-200/70 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="w-5 h-5 text-green-600" aria-hidden="true" />
                      <span className="font-bold text-gray-900">Market Insights</span>
                      {liveStats && (
                        <span className="text-xs text-gray-400 ml-auto">Live</span>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 text-sm">Active Jobs</span>
                        <span className="font-semibold text-gray-900">
                          {liveStats?.activeRequests ?? filteredRequests.length}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 text-sm">Active Listings</span>
                        <span className="font-semibold text-gray-900">
                          {liveStats?.activeListings ?? '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 text-sm">Recent Transactions</span>
                        <span className="font-semibold text-gray-900">
                          {liveStats?.recentTransactions ?? '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 text-sm">Most Active</span>
                        <Badge className="bg-orange-100 text-orange-800">Tools</Badge>
                      </div>
                    </div>
                    {liveStats?.updatedAt && (
                      <p className="text-xs text-gray-400 mt-4 text-right">
                        Updated {new Date(liveStats.updatedAt).toLocaleTimeString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Live Activity Feed */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <LiveActivityFeed 
                  limit={8} 
                  showStats={true} 
                  compact={true}
                  className="border border-gray-200/70 shadow-sm"
                />
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile FAB for filters (shown when scrolled) */}
      <div className="fixed bottom-40 right-4 md:hidden z-30">
        <motion.button
          className="w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center border border-gray-200"
          whileTap={{ scale: 0.9 }}
          onClick={scrollToFilters}
          aria-label="Scroll to filters"
        >
          <Filter className="w-5 h-5 text-gray-700" />
        </motion.button>
      </div>
    </div>
  );
}
