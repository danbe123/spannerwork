/**
 * RequestCard - Premium Job Card Design V2
 *
 * Features:
 * - Full-bleed images with better visual presence
 * - Beautiful no-image fallback with patterns
 * - Uniform card heights in grid view
 * - Click to expand for full details
 * - Clean, professional list view
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import {
  MapPin,
  Clock,
  MessageCircle,
  ChevronRight,
  Bookmark,
  Share2,
  LucideIcon,
  Image as ImageIcon,
  Users,
  ArrowRight,
  Wrench,
  Sparkles,
  X,
  ChevronDown,
  Cog,
  Warehouse,
  Zap,
  Sun,
  Calendar,
  Leaf
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Request, User } from "@/types";
import { formatPrice } from "@/utils";
import { bookmarksService } from "@/api/services";
import { queryKeys } from "@/lib/queryKeys";

// Storage keys for scroll restoration
const FEED_SCROLL_STORAGE_KEY = 'spannerwork_feed_scroll_v1';
const FEED_RESTORE_HINT_KEY = 'spannerwork_feed_restore_hint_v1';

// Get area from postcode
const getAreaFromPostcode = (input?: string | null): string => {
  if (!input) return '';
  const cleaned = input.toString().replace(/\s+/g, '').toUpperCase();
  if (cleaned.length >= 5) {
    return `${cleaned.slice(0, -3)} area`;
  }
  return cleaned;
};

// Urgency configuration - with icons for accessibility
const URGENCY_CONFIG: Record<string, {
  label: string;
  bg: string;
  text: string;
  dot: string;
  pulse: boolean;
  icon: typeof Zap;
}> = {
  asap: {
    label: 'ASAP',
    bg: 'bg-red-500',
    text: 'text-white',
    dot: 'bg-white',
    pulse: true,
    icon: Zap
  },
  today: {
    label: 'Today',
    bg: 'bg-brand-500',
    text: 'text-white',
    dot: 'bg-white',
    pulse: true,
    icon: Sun
  },
  this_weekend: {
    label: 'This Weekend',
    bg: 'bg-amber-500',
    text: 'text-white',
    dot: 'bg-white',
    pulse: false,
    icon: Calendar
  },
  flexible: {
    label: 'Flexible',
    bg: 'bg-emerald-500',
    text: 'text-white',
    dot: 'bg-white',
    pulse: false,
    icon: Leaf
  },
};

// Category configuration - uses CSS class names for patterns (CSP-safe)
const CATEGORY_CONFIG: Record<string, {
  gradient: string;
  icon: typeof Wrench;
  patternClass: string;
}> = {
  TOOLS: {
    gradient: 'from-brand-500 via-amber-500 to-yellow-400',
    icon: Wrench,
    patternClass: 'bg-pattern-tools'
  },
  EXPERTISE: {
    gradient: 'from-blue-600 via-indigo-500 to-purple-500',
    icon: Cog,
    patternClass: 'bg-pattern-expertise'
  },
  SPACE: {
    gradient: 'from-violet-600 via-purple-500 to-fuchsia-500',
    icon: Warehouse,
    patternClass: 'bg-pattern-space'
  },
};

export type ViewMode = 'grid' | 'list';

interface RequestCardProps {
  request: Request;
  currentUser?: User;
  categoryIcons?: Record<string, LucideIcon>;
  viewMode?: ViewMode;
  /** Use priority loading for above-the-fold images (first 4 cards) */
  priority?: boolean;
}

export default function RequestCard({ request, currentUser, categoryIcons, viewMode = 'grid', priority = false }: RequestCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [bookmarked, setBookmarked] = useState(() => bookmarksService.isLocallyBookmarked(request.id));
  const [isToggling, setIsToggling] = useState(false);
  const [, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Sync bookmarks across tabs and check server state
  useEffect(() => {
    const handleStorage = () => setBookmarked(bookmarksService.isLocallyBookmarked(request.id));
    window.addEventListener('storage', handleStorage);

    // Check server state if authenticated
    if (currentUser) {
      bookmarksService.isBookmarked(request.id)
        .then(setBookmarked)
        .catch(() => {/* Keep local state on error */});
    }

    return () => window.removeEventListener('storage', handleStorage);
  }, [request.id, currentUser]);

  // Close on escape
  useEffect(() => {
    if (!isExpanded) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExpanded(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isExpanded]);

  // Scroll into view when expanded
  useEffect(() => {
    if (isExpanded && cardRef.current) {
      const timer = setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  const categoryConfig = CATEGORY_CONFIG[request.category] || CATEGORY_CONFIG.TOOLS;
  const CategoryIcon = categoryIcons?.[request.category] || categoryConfig.icon;
  const isOwnRequest = currentUser?.id === request.seekerId;
  const urgencyKey = request.urgency?.toLowerCase()?.replace(/_/g, '_') || 'flexible';
  const urgencyConfig = URGENCY_CONFIG[urgencyKey] || URGENCY_CONFIG.flexible;
  const areaDisplay = getAreaFromPostcode(request.postcode || request.locationAddress);
  const hasPhotos = request.photos && request.photos.length > 0 && !imageError;
  const photoCount = request.photos?.length || 0;
  const timeAgo = formatDistanceToNow(new Date(request.createdDate), { addSuffix: true });

  // Distance calculation
  const distance = useCallback(() => {
    if (!currentUser?.locationLat || !currentUser?.locationLng || !request?.locationLat || !request?.locationLng) return null;
    const R = 3959;
    const dLat = (request.locationLat - currentUser.locationLat) * Math.PI / 180;
    const dLon = (request.locationLng - currentUser.locationLng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(currentUser.locationLat * Math.PI / 180) * Math.cos(request.locationLat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
  }, [currentUser?.locationLat, currentUser?.locationLng, request?.locationLat, request?.locationLng])();

  const getRateDisplay = () => {
    if (!request.budget) return null;
    switch (request.rateType) {
      case 'HOURLY': return `${formatPrice(request.budget)}/hr`;
      case 'DAILY': return `${formatPrice(request.budget)}/day`;
      default: return formatPrice(request.budget);
    }
  };

  const handleViewDetails = useCallback(() => {
    try {
      if (window.location.pathname.toLowerCase() === '/feed') {
        sessionStorage.setItem(FEED_SCROLL_STORAGE_KEY, JSON.stringify({ windowY: Math.round(window.scrollY) }));
        sessionStorage.setItem(FEED_RESTORE_HINT_KEY, '1');
      }
    } catch { /* ignore */ }
    navigate(`/request/${request.id}`);
  }, [navigate, request.id]);

  const handleQuickMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/messages?userId=${request.seekerId}&requestId=${request.id}`);
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isToggling) return;

    const previousState = bookmarked;
    const newState = !bookmarked;

    // Optimistic update
    setBookmarked(newState);
    setIsToggling(true);

    try {
      await bookmarksService.toggle(request.id);
      // Invalidate bookmarks queries to refresh any bookmarks pages
      queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks() });
      toast.success(newState ? 'Saved to bookmarks' : 'Removed from bookmarks', { duration: 1500 });
    } catch {
      // Revert on error
      setBookmarked(previousState);
      toast.error('Failed to update bookmark');
    } finally {
      setIsToggling(false);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/request/${request.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: request.title, url }); }
      catch (err) { if ((err as Error).name !== 'AbortError') { await navigator.clipboard.writeText(url); toast.success('Link copied'); } }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    }
  };

  const handleCardClick = () => {
    handleViewDetails();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleViewDetails();
    }
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  // ============================================
  // LIST VIEW - Clean horizontal layout
  // ============================================
  if (viewMode === 'list') {
    return (
      <div ref={cardRef}>
        <Card
          className="group relative bg-white border border-gray-100 hover:border-gray-200 hover:shadow-md rounded-xl overflow-hidden cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          onClick={handleCardClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="article"
          aria-label={`Job: ${request.title}. ${urgencyConfig.label} urgency. ${areaDisplay || 'Location not specified'}`}
        >
          <div className="flex items-stretch h-24">
            {/* Image/Visual section */}
            <div className="w-24 h-full flex-shrink-0 relative overflow-hidden">
              {hasPhotos && request.photos ? (
                <>
                  <OptimizedImage
                    src={request.photos[0]}
                    alt=""
                    sizes="thumbnail"
                    priority={priority}
                    className={`w-full h-full transition-all duration-300 group-hover:scale-105`}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageError(true)}
                  />
                  {photoCount > 1 && (
                    <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <ImageIcon className="w-2.5 h-2.5" />
                      {photoCount}
                    </div>
                  )}
                </>
              ) : (
                <div
                  className={`w-full h-full bg-gradient-to-br ${categoryConfig.gradient} ${categoryConfig.patternClass} flex items-center justify-center`}
                >
                  <CategoryIcon className="w-7 h-7 text-white drop-shadow-sm" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 px-4 py-3 flex flex-col justify-center">
              {/* Title row */}
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-1 group-hover:text-brand-700 transition-colors">
                  {request.title}
                  {request.description && (
                    <span className="font-normal text-gray-500"> — {request.description}</span>
                  )}
                </h3>
                {request.budget && (
                  <span className="flex-shrink-0 text-sm font-bold text-emerald-600 tabular-nums">
                    {getRateDisplay()}
                  </span>
                )}
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                <span className={`inline-flex items-center gap-1 font-medium ${urgencyConfig.bg} ${urgencyConfig.text} px-1.5 py-0.5 rounded text-[10px]`}>
                  <urgencyConfig.icon className="w-2.5 h-2.5" aria-hidden="true" />
                  {urgencyConfig.label}
                </span>
                {(distance || areaDisplay) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-gray-500" />
                    {distance ? `${distance} mi` : areaDisplay}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gray-500" />
                  {timeAgo}
                </span>
                {request.responseCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-blue-600">
                    <Users className="w-3 h-3" />
                    {request.responseCount}
                  </span>
                )}
              </div>
            </div>

            {/* Action area */}
            <div className="flex items-center gap-1.5 pr-3">
              <button
                onClick={handleBookmark}
                aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"}
                className={`p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${bookmarked ? 'bg-brand-50 text-brand-600' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-current' : ''}`} />
              </button>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ============================================
  // GRID VIEW - Premium card design
  // ============================================
  return (
    <div ref={cardRef}>
      <Card
        className={`group relative bg-white rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
          isExpanded
            ? 'shadow-2xl ring-1 ring-gray-200'
            : 'shadow-sm hover:shadow-xl border border-gray-100 hover:border-gray-200'
        }`}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="article"
        aria-label={`Job: ${request.title}. ${urgencyConfig.label} urgency. ${areaDisplay || 'Location not specified'}`}
      >
        {/* Container for collapsed state */}
        <div className={isExpanded ? '' : 'min-h-[280px] md:min-h-[320px] 2xl:min-h-[360px] flex flex-col'}>
          {/* Image area - larger for better visual impact */}
          <div className="relative h-36 md:h-40 2xl:h-48 flex-shrink-0 overflow-hidden">
            {hasPhotos && request.photos ? (
              <>
                <OptimizedImage
                  src={request.photos[isExpanded ? selectedPhoto : 0]}
                  alt={`${request.title}${isExpanded && photoCount > 1 ? ` - photo ${selectedPhoto + 1} of ${photoCount}` : ''}`}
                  sizes="card"
                  priority={priority}
                  className={`w-full h-full transition-all duration-500 ${!isExpanded ? 'group-hover:scale-[1.03]' : ''}`}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                />
                {/* Gradient overlay for text legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent pointer-events-none" />

                {/* Photo count badge */}
                {photoCount > 1 && !isExpanded && (
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>{photoCount}</span>
                  </div>
                )}
              </>
            ) : (
              // Beautiful gradient fallback for no-image cards
              <div
                className={`w-full h-full bg-gradient-to-br ${categoryConfig.gradient} ${categoryConfig.patternClass} relative overflow-hidden`}
              >
                {/* Decorative elements */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 blur-2xl bg-white/20 rounded-full scale-150" />
                    <CategoryIcon className="w-16 h-16 text-white/90 drop-shadow-lg relative z-10" />
                  </div>
                </div>
                {/* Subtle pattern overlay */}
                <div className="absolute inset-0 opacity-30 bg-cross-pattern" />
              </div>
            )}

            {/* Urgency badge - top left with icon for accessibility */}
            <div className="absolute top-3 left-3">
              <div className={`${urgencyConfig.bg} ${urgencyConfig.text} font-semibold text-xs px-2.5 py-1 rounded-lg shadow-lg flex items-center gap-1.5`}>
                <urgencyConfig.icon className={`w-3 h-3 ${urgencyConfig.pulse ? 'animate-pulse' : ''}`} aria-hidden="true" />
                {urgencyConfig.label}
              </div>
            </div>

            {/* Budget - bottom right, on image */}
            {request.budget && (
              <div className="absolute bottom-3 right-3 bg-white text-gray-900 font-bold text-sm px-3 py-1.5 rounded-lg shadow-lg">
                {getRateDisplay()}
              </div>
            )}

            {/* Close button when expanded */}
            {isExpanded && (
              <button
                onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 rounded-lg text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Content area */}
          <div className="p-4 flex-1 flex flex-col">
            {/* Title - clean, prominent */}
            <h2 className={`font-bold text-gray-900 leading-snug mb-2 group-hover:text-brand-700 transition-colors ${isExpanded ? 'text-lg 2xl:text-xl' : 'text-base lg:text-lg line-clamp-2'}`}>
              {request.title}
            </h2>

            {/* Description */}
            {request.description && (
              <p className={`text-gray-600 text-sm leading-relaxed ${isExpanded ? 'mb-4' : 'line-clamp-2 mb-3'}`}>
                {request.description}
              </p>
            )}

            {/* Meta info - bottom of card */}
            <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 ${isExpanded ? 'mb-4' : 'mt-auto'}`}>
              {(distance || areaDisplay) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-brand-500" />
                  <span className="text-gray-700 font-medium">{distance ? `${distance} mi` : areaDisplay}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {timeAgo}
              </span>
            </div>

            {/* Footer - responses and expand */}
            {!isExpanded && (
              <div className="flex items-center justify-between pt-3 mt-auto border-t border-gray-100">
                {request.responseCount > 0 ? (
                  <span className="text-xs font-medium text-blue-600 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {request.responseCount} interested
                  </span>
                ) : (
                  <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Be first to respond
                  </span>
                )}
                <button
                  onClick={handleExpandClick}
                  aria-label={isExpanded ? "Hide details" : "Show details"}
                  aria-expanded={isExpanded}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-0.5 transition-colors"
                >
                  Details
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="overflow-hidden border-t border-gray-100"
            >
              <div className="p-4 space-y-4 bg-gray-50/50">
                {/* Photo gallery */}
                {hasPhotos && photoCount > 1 && request.photos && (
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4" role="listbox" aria-label="Photo gallery">
                    {request.photos.map((photo, i) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); setSelectedPhoto(i); }}
                        className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 ring-2 transition-all ${
                          selectedPhoto === i ? 'ring-brand-500 ring-offset-2' : 'ring-transparent hover:ring-gray-300'
                        }`}
                        aria-label={`View photo ${i + 1} of ${photoCount}`}
                        aria-selected={selectedPhoto === i}
                        role="option"
                      >
                        <OptimizedImage src={photo} alt={`${request.title} - photo ${i + 1}`} sizes="thumbnail" className="w-full h-full" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Quick stats */}
                <div className="flex flex-wrap gap-2">
                  {request.budget && (
                    <div className="flex-1 min-w-[100px] bg-white rounded-xl p-3 border border-gray-100">
                      <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Budget</div>
                      <div className="font-bold text-emerald-600 text-sm">{getRateDisplay()}</div>
                    </div>
                  )}
                  <div className="flex-1 min-w-[100px] bg-white rounded-xl p-3 border border-gray-100">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Urgency</div>
                    <div className="font-bold text-gray-900 text-sm">{urgencyConfig.label}</div>
                  </div>
                  {(distance || areaDisplay) && (
                    <div className="flex-1 min-w-[100px] bg-white rounded-xl p-3 border border-gray-100">
                      <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Location</div>
                      <div className="font-bold text-gray-900 text-sm truncate">{distance ? `${distance} mi` : areaDisplay}</div>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={(e) => { e.stopPropagation(); handleViewDetails(); }}
                    className="flex-1 min-w-[140px] bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl h-11"
                  >
                    {isOwnRequest ? 'View Job' : 'Respond'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleBookmark}
                      className={`rounded-xl h-11 w-11 flex-shrink-0 ${bookmarked ? 'bg-brand-50 border-brand-200 text-brand-600' : ''}`}
                    >
                      <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-current' : ''}`} />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleShare} className="rounded-xl h-11 w-11 flex-shrink-0">
                      <Share2 className="w-4 h-4" />
                    </Button>
                    {!isOwnRequest && (
                      <Button variant="outline" size="icon" onClick={handleQuickMessage} className="rounded-xl h-11 w-11 flex-shrink-0">
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}
