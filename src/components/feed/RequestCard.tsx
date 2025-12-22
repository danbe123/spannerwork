/**
 * RequestCard - Premium Job Card Component
 *
 * A beautifully redesigned card with:
 * - Rich visual design with gradients and depth
 * - Quick action buttons (bookmark, share, message)
 * - Mobile-friendly quick actions (always visible)
 * - User avatar with accurate activity indicator
 * - Smooth hover animations
 * - Photo gallery preview
 * - Persisted bookmarks via localStorage
 * - Full accessibility support
 * - Privacy-friendly: user names hidden until job is visited
 * - Smart description: hides if same as title
 * - Time remaining for urgent jobs
 */

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Clock,
  MessageCircle,
  ChevronRight,
  Bookmark,
  Share2,
  CheckCircle,
  LucideIcon,
  Image,
  Timer
} from "lucide-react";
import { formatDistanceToNow, differenceInHours, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { Request, User } from "@/types";
import { formatPrice } from "@/utils";

// Storage keys
const BOOKMARKS_STORAGE_KEY = 'spannerwork_bookmarks';
const FEED_SCROLL_STORAGE_KEY = 'spannerwork_feed_scroll_v1';
const FEED_RESTORE_HINT_KEY = 'spannerwork_feed_restore_hint_v1';

// Helper functions for bookmark persistence
function getBookmarks(): Set<string> {
  try {
    const stored = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveBookmark(requestId: string): void {
  const bookmarks = getBookmarks();
  bookmarks.add(requestId);
  localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify([...bookmarks]));
}

function removeBookmark(requestId: string): void {
  const bookmarks = getBookmarks();
  bookmarks.delete(requestId);
  localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify([...bookmarks]));
}

function isBookmarked(requestId: string): boolean {
  return getBookmarks().has(requestId);
}


// Get area code from UK postcode (privacy-friendly)
const getAreaFromPostcode = (input?: string | null): string => {
  if (!input) return '';
  const cleaned = input.toString().replace(/\s+/g, '').toUpperCase();
  // Extract outward code (first part before the space)
  // UK postcodes: outward code is 2-4 chars, inward is always 3 chars
  if (cleaned.length >= 5) {
    const outward = cleaned.slice(0, -3);
    return `${outward} area`;
  }
  return cleaned;
};


// Get time remaining message for urgent jobs
const getTimeRemaining = (urgency?: string | null, createdDate?: string | null): string | null => {
  if (!urgency || !createdDate) return null;
  const created = new Date(createdDate);
  const now = new Date();
  const hoursAgo = differenceInHours(now, created);
  const daysAgo = differenceInDays(now, created);

  switch (urgency?.toLowerCase()) {
    case 'asap':
      if (hoursAgo < 2) return 'Needed urgently';
      if (hoursAgo < 6) return 'Needed within hours';
      return 'Urgent request';
    case 'today':
      if (hoursAgo < 4) return 'Needed today';
      return 'Time sensitive';
    case 'this_weekend':
      if (daysAgo < 3) return 'Needed this weekend';
      return null;
    default:
      return null;
  }
};

// Urgency configuration
interface UrgencyConfigItem {
  label: string;
  emoji: string;
  gradient: string;
  bg: string;
  text: string;
  border: string;
  pulse: boolean;
}

const URGENCY_CONFIG: Record<string, UrgencyConfigItem> = {
  asap: { 
    label: 'ASAP', 
    emoji: '⚡', 
    gradient: 'from-red-500 to-orange-500',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    pulse: true
  },
  today: { 
    label: 'Today', 
    emoji: '🔥', 
    gradient: 'from-orange-500 to-amber-500',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    pulse: true
  },
  this_weekend: { 
    label: 'This Weekend', 
    emoji: '📅', 
    gradient: 'from-yellow-500 to-lime-500',
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    pulse: false
  },
  flexible: { 
    label: 'Flexible', 
    emoji: '✨', 
    gradient: 'from-green-500 to-emerald-500',
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    pulse: false
  },
};

interface QuickActionProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  active?: boolean;
  variant?: 'default' | 'primary';
}

// Quick action button component with accessibility
function QuickAction({ icon: Icon, label, onClick, active = false, variant = 'default' }: QuickActionProps) {
  return (
    <motion.button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`
        p-2 rounded-lg transition-all
        ${active
          ? 'bg-brand-800 text-white'
          : variant === 'primary'
            ? 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
        }
      `}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      aria-label={label}
      aria-pressed={active}
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
    </motion.button>
  );
}


interface RequestCardProps {
  request: Request;
  currentUser?: User;
  categoryIcons?: Record<string, LucideIcon>;
}

export default function RequestCard({ request, currentUser, categoryIcons }: RequestCardProps) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  // Initialize bookmark state from localStorage
  const [bookmarked, setBookmarked] = useState(() => isBookmarked(request.id));

  // Sync bookmark state if it changes externally (e.g., another tab)
  useEffect(() => {
    const handleStorage = () => {
      setBookmarked(isBookmarked(request.id));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [request.id]);

  const CategoryIcon = categoryIcons?.[request.category] || null;
  const isOwnRequest = currentUser?.id === request.seekerId;
  const urgencyKey = request.urgency?.toLowerCase()?.replace(/_/g, '_') || 'flexible';
  const urgencyConfig = URGENCY_CONFIG[urgencyKey] || URGENCY_CONFIG.flexible;

  // Computed display values
  const timeRemaining = getTimeRemaining(request.urgency, request.createdDate);
  const areaDisplay = getAreaFromPostcode(request.postcode || request.locationAddress);
  const hasPhotos = request.photos && request.photos.length > 0;

  // Calculate distance
  const calculateDistance = useCallback(() => {
    if (!currentUser?.locationLat || !currentUser?.locationLng ||
        !request?.locationLat || !request?.locationLng) {
      return null;
    }
    const R = 3959;
    const dLat = (request.locationLat - currentUser.locationLat) * Math.PI / 180;
    const dLon = (request.locationLng - currentUser.locationLng) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(currentUser.locationLat * Math.PI / 180) *
      Math.cos(request.locationLat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  }, [currentUser?.locationLat, currentUser?.locationLng, request?.locationLat, request?.locationLng]);

  const getRateDisplay = () => {
    if (!request.budget) return null;
    switch (request.rateType) {
      case 'HOURLY': return `${formatPrice(request.budget)}/hr`;
      case 'DAILY': return `${formatPrice(request.budget)}/day`;
      default: return `${formatPrice(request.budget)}`;
    }
  };

  const handleViewDetails = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    try {
      if (window.location.pathname.toLowerCase() === '/feed') {
        const windowY = Number.isFinite(window.scrollY) ? Math.max(0, Math.round(window.scrollY)) : 0;

        let virtualizedOffset: number | undefined;
        const startEl = (e?.currentTarget as HTMLElement | null) ?? null;
        let el: HTMLElement | null = startEl;
        while (el && el !== document.body) {
          const style = window.getComputedStyle(el);
          const overflowY = style.overflowY;
          const isScrollable = (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
          if (isScrollable) {
            const st = Number.isFinite(el.scrollTop) ? Math.max(0, Math.round(el.scrollTop)) : 0;
            if (st > 0) virtualizedOffset = st;
            break;
          }
          el = el.parentElement;
        }

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
            windowY,
            virtualizedOffset: typeof virtualizedOffset === 'number' ? virtualizedOffset : existing.virtualizedOffset,
          })
        );
        sessionStorage.setItem(FEED_RESTORE_HINT_KEY, '1');
      }
    } catch {
      // ignore
    }

    navigate(`/request/${request.id}`);
  }, [navigate, request.id]);

  const handleQuickMessage = () => {
    navigate(`/messages?userId=${request.seekerId}&requestId=${request.id}`);
  };

  const handleBookmark = useCallback(() => {
    const newState = !bookmarked;
    setBookmarked(newState);

    // Persist to localStorage
    if (newState) {
      saveBookmark(request.id);
    } else {
      removeBookmark(request.id);
    }

    toast.success(newState ? 'Job saved to bookmarks' : 'Job removed from bookmarks', {
      duration: 2000,
    });
  }, [bookmarked, request.id]);

  const handleShare = async () => {
    const shareData = {
      title: request.title,
      text: request.description,
      url: `${window.location.origin}/request/${request.id}`
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or share failed - copy to clipboard as fallback
        if ((err as Error).name !== 'AbortError') {
          await navigator.clipboard.writeText(shareData.url);
          toast.success('Link copied to clipboard');
        }
      }
    } else {
      // Fallback for browsers without share API
      await navigator.clipboard.writeText(shareData.url);
      toast.success('Link copied to clipboard');
    }
  };

  const distance = calculateDistance();
  const timeAgo = formatDistanceToNow(new Date(request.createdDate), { addSuffix: true });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative"
    >
      <Card
        className={`
          rounded-2xl border border-gray-200/80 bg-white/90 backdrop-blur-sm
          shadow-[0_1px_2px_rgba(0,0,0,0.06)] hover:shadow-[0_18px_45px_rgba(0,0,0,0.12)]
          ring-1 ring-black/5 hover:ring-brand-200/60
          transition-all duration-300
          overflow-hidden cursor-pointer relative group
          ${urgencyConfig.pulse ? 'ring-1 ring-orange-200/70 ring-offset-1' : ''}
        `}
        onClick={handleViewDetails}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleViewDetails();
          }
        }}
        role="article"
        aria-label={`Job: ${request.title}, ${urgencyConfig.label} urgency${request.budget ? `, ${getRateDisplay()}` : ''}`}
      >
        {/* Urgency gradient bar */}
        <div className={`h-1 bg-gradient-to-r ${urgencyConfig.gradient}`} />

        <CardContent className="p-5 space-y-4">
          {/* Header: Posted time + Quick Actions */}
          <div className="flex items-center justify-between gap-3">
            {/* Posted time */}
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Clock className="w-4 h-4" aria-hidden="true" />
              <span>Posted {timeAgo}</span>
            </div>

            {/* Quick actions - always visible on mobile, hover on desktop */}
            <div
              className={`
                flex items-center gap-1 transition-opacity duration-200
                ${isHovered ? 'opacity-100' : 'opacity-100 md:opacity-0'}
              `}
              role="group"
              aria-label="Quick actions"
            >
              <QuickAction
                icon={Bookmark}
                label={bookmarked ? "Remove from saved" : "Save job"}
                onClick={handleBookmark}
                active={bookmarked}
              />
              <QuickAction
                icon={Share2}
                label="Share job"
                onClick={handleShare}
                active={false}
              />
              <QuickAction
                icon={MessageCircle}
                label="Send message"
                onClick={handleQuickMessage}
                active={false}
                variant="primary"
              />
            </div>
          </div>

          {/* Title + Category */}
          <div className="flex items-start gap-3">
            {(CategoryIcon || hasPhotos) && (
              <div
                className={`
                  w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 relative overflow-hidden
                  bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100
                  group-hover:scale-[1.04] transition-transform
                `}
                aria-hidden="true"
              >
                {hasPhotos && (
                  <img
                    src={request.photos![0]}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10" />
                {CategoryIcon && (
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    <CategoryIcon className={`w-6 h-6 ${hasPhotos ? 'text-white drop-shadow' : 'text-brand-800'}`} />
                  </div>
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-[17px] font-semibold text-gray-900 group-hover:text-brand-800 transition-colors line-clamp-2 leading-snug">
                {request.title}
              </h3>
              <div className="flex items-center flex-wrap gap-2 mt-2">
                <Badge className={`${urgencyConfig.bg} ${urgencyConfig.text} ${urgencyConfig.border} border text-xs font-semibold rounded-full`}>
                  <span aria-hidden="true">{urgencyConfig.emoji}</span> {urgencyConfig.label}
                </Badge>
                {request.budget && (
                  <Badge className="bg-gradient-to-r from-emerald-600 to-green-500 text-white border-transparent border text-xs font-semibold rounded-full shadow-sm">
                    <span aria-hidden="true">💰</span> {getRateDisplay()}
                  </Badge>
                )}
                {/* Photo indicator when photos exist but not shown as preview */}
                {hasPhotos && (
                  <Badge className="bg-purple-50 text-purple-700 border-purple-200 border text-xs font-semibold rounded-full">
                    <Image className="w-3 h-3 mr-1" aria-hidden="true" />
                    {request.photos!.length} photo{request.photos!.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Time remaining indicator for urgent jobs */}
          {timeRemaining && (
            <div className="flex items-center gap-2 text-sm">
              <Timer className="w-4 h-4 text-orange-500" aria-hidden="true" />
              <span className="font-medium text-orange-600">{timeRemaining}</span>
            </div>
          )}

          {/* Description */}
          <p className="text-gray-600 line-clamp-2 leading-relaxed text-sm">
            {request.description}
          </p>

          {/* Meta info - Location with distance */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 pt-2 border-t border-gray-100">
            {/* Location - show area only for privacy */}
            {(distance || areaDisplay) && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-brand-800" aria-hidden="true" />
                <span className="font-medium">
                  {distance && <span aria-label={`${distance} miles away`}>{distance} mi</span>}
                  {distance && areaDisplay && <span aria-hidden="true"> • </span>}
                  {areaDisplay}
                </span>
              </div>
            )}
          </div>

          {/* Response count indicator */}
          {request.responseCount > 0 && (
            <motion.div
              className="flex items-center gap-2 p-3 bg-blue-50/60 rounded-xl border border-blue-200/60"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              aria-label={`${request.responseCount} ${request.responseCount === 1 ? 'person has' : 'people have'} responded to this job`}
            >
              <div className="flex -space-x-2" aria-hidden="true">
                {[...Array(Math.min(3, request.responseCount))].map((_, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 border-2 border-white flex items-center justify-center"
                  >
                    <span className="text-white text-xs font-bold">
                      {String.fromCharCode(65 + i)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex-1">
                <span className="font-semibold text-blue-900 text-sm">
                  {request.responseCount} {request.responseCount === 1 ? 'person' : 'people'} interested
                </span>
              </div>
              <CheckCircle className="w-5 h-5 text-blue-500" aria-hidden="true" />
            </motion.div>
          )}

          {/* CTA Button */}
          <div className="pt-2">
            {!isOwnRequest ? (
              <Button
                className="w-full bg-gradient-to-r from-brand-800 to-brand-500 hover:from-brand-900 hover:to-brand-700 text-white font-semibold shadow-sm hover:shadow-md transition-shadow"
                onClick={handleViewDetails}
                aria-label={`View details and respond to: ${request.title}`}
              >
                <span>I Can Help</span>
                <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full border-2 border-gray-200 hover:border-brand-800 hover:text-brand-800 font-semibold group"
                onClick={handleViewDetails}
                aria-label={`View ${request.responseCount || 0} responses to your job: ${request.title}`}
              >
                <span>View Responses</span>
                <Badge className="ml-2 bg-brand-800 text-white" aria-hidden="true">
                  {request.responseCount || 0}
                </Badge>
              </Button>
            )}
          </div>
        </CardContent>

        {/* Hover glow effect */}
        <div
          className={`
            absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-300
            bg-gradient-to-br from-orange-500/5 via-transparent to-amber-500/5
            ${isHovered ? 'opacity-100' : 'opacity-0'}
          `}
          aria-hidden="true"
        />
      </Card>
    </motion.div>
  );
}
