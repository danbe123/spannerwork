/**
 * RequestDetail - Job request detail page (Airbnb-style redesign)
 *
 * Layout:
 * - Full-width photo gallery at top (Airbnb-style grid)
 * - Two-column layout on desktop (content + sticky sidebar)
 * - Trust-focused seller card with verification badges
 * - Clear pricing and urgency display
 * - Strong CTAs for conversion
 */

import { useCallback, useState } from "react";
import { authService, requestsService, usersService, transactionsService } from "@/api/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RequestPhotoGallery,
  SellerTrustCard,
  RequestPricingCard,
  StickyRequestCTA,
  RequestHero
} from "@/components/request-detail";
import {
  ArrowLeft,
  MapPin,
  Share2,
  Bookmark,
  AlertCircle,
  Wrench,
  GraduationCap,
  Warehouse,
  LucideIcon,
  MessageCircle,
  Globe
} from "lucide-react";
import RequestResponseDialog from "../components/RequestResponseDialog";
import EditRequestDialog from "../components/EditRequestDialog";
import { Transaction } from "@/types";
import { queryKeys } from "@/lib/queryKeys";
import { formatPrice } from "@/utils";
import { toast } from "sonner";
import SEO from "@/components/SEO";

// Get outward code from UK postcode (e.g., "HR6" from "HR6 9AA")
// For privacy, we only show the area code, not the full postcode
const getOutwardCode = (input?: string) => {
  if (!input) return '';
  const cleaned = input.toString().replace(/\s+/g, '').toUpperCase();
  if (cleaned.length >= 5 && cleaned.length <= 7) {
    // Return only the outward code (everything except last 3 characters)
    return cleaned.slice(0, -3);
  }
  // If already short, return as-is
  return cleaned;
};

// Category configuration
const CATEGORY_CONFIG: Record<string, {
  icon: LucideIcon;
  label: string;
  color: string;
}> = {
  TOOLS: {
    icon: Wrench,
    label: 'Tools & Equipment',
    color: 'bg-blue-100 text-blue-700',
  },
  EXPERTISE: {
    icon: GraduationCap,
    label: 'Mechanic Services',
    color: 'bg-purple-100 text-purple-700',
  },
  SPACE: {
    icon: Warehouse,
    label: 'Workshop Space',
    color: 'bg-amber-100 text-amber-700',
  },
};

export default function RequestDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showResponseDialog, setShowResponseDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const { id: requestId } = useParams<{ id: string }>();

  // Mark as complete mutation
  const markCompleteMutation = useMutation({
    mutationFn: () => requestsService.markComplete(requestId!),
    onSuccess: () => {
      toast.success('Job marked as complete!');
      queryClient.invalidateQueries({ queryKey: queryKeys.request(requestId!) });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to mark job as complete');
    },
  });

  // Cancel/close mutation
  const cancelMutation = useMutation({
    mutationFn: () => requestsService.cancel(requestId!),
    onSuccess: () => {
      toast.success('Job closed');
      queryClient.invalidateQueries({ queryKey: queryKeys.request(requestId!) });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to close job');
    },
  });

  const handleMarkComplete = () => {
    if (confirm('Mark this job as complete? This will close the job listing.')) {
      markCompleteMutation.mutate();
    }
  };

  const handleClose = () => {
    if (confirm('Close this job as no longer needed? This cannot be undone.')) {
      cancelMutation.mutate();
    }
  };

  const handleBackToFeed = useCallback(() => {
    try {
      sessionStorage.setItem('spannerwork_feed_restore_hint_v1', '1');
    } catch { /* ignore */ }
    try {
      const state = window.history.state as { idx?: number } | null;
      if (typeof state?.idx === 'number' && state.idx > 0) {
        navigate(-1);
        return;
      }
      if (typeof window.history.length === 'number' && window.history.length > 1) {
        navigate(-1);
        return;
      }
    } catch { /* ignore */ }
    navigate('/feed');
  }, [navigate]);

  const requestIdKey = requestId ?? '';

  const { data: currentUserData } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () => authService.getCurrentUser(),
  });

  const currentUser = currentUserData?.user;

  const { data: requestData, isLoading } = useQuery({
    queryKey: queryKeys.request(requestIdKey),
    queryFn: async () => requestId ? requestsService.getById(requestId) : Promise.resolve(undefined),
    enabled: !!requestId,
  });

  const request = requestData?.request;

  const seekerIdKey = request?.seekerId ?? '';

  const { data: seekerData } = useQuery({
    queryKey: request?.seekerId ? queryKeys.userId(seekerIdKey) : queryKeys.userIdRoot(),
    queryFn: async () => request?.seekerId ? usersService.getById(request.seekerId) : Promise.resolve(undefined),
    enabled: !!request?.seekerId,
  });

  const seeker = seekerData?.user;

  const { data: responsesData } = useQuery({
    queryKey: queryKeys.requestResponses(requestIdKey),
    queryFn: async () => requestId ? transactionsService.list({ requestId }) : Promise.resolve({ data: [] }),
    enabled: !!requestId,
  });

  const responses = responsesData?.data || [];

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: request?.title, url }); }
      catch (err) { if ((err as Error).name !== 'AbortError') { await navigator.clipboard.writeText(url); toast.success('Link copied'); } }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    }
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    toast.success(isBookmarked ? 'Removed from saved' : 'Saved to bookmarks');
  };

  const handleMessage = () => {
    if (seeker) {
      navigate(`/messages?userId=${seeker.id}`);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Skeleton className="h-[400px] w-full rounded-2xl mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-48 w-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!request) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Job Not Found</h2>
          <p className="text-gray-500 mb-6">This job may have been removed or doesn't exist.</p>
          <Button onClick={handleBackToFeed} className="bg-gray-900 hover:bg-gray-800">
            Back to Feed
          </Button>
        </div>
      </div>
    );
  }

  const isOwnRequest = currentUser?.id === request?.seekerId;
  const isActive = request?.status === 'ACTIVE';
  const categoryConfig = CATEGORY_CONFIG[request.category] || CATEGORY_CONFIG.TOOLS;
  const CategoryIcon = categoryConfig.icon;

  // Build JobPosting schema for SEO
  const locationCity = request.locationAddress?.split(',')[0] || request.postcode?.split(' ')[0] || 'UK';
  const jobPostingSchema = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    "title": request.title,
    "description": request.description,
    "datePosted": request.createdDate,
    "hiringOrganization": {
      "@type": "Person",
      "name": request.seeker?.name || "SpannerWork User"
    },
    "jobLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": locationCity,
        "postalCode": request.postcode || "",
        "addressCountry": "GB"
      }
    },
    "baseSalary": request.budget ? {
      "@type": "MonetaryAmount",
      "currency": "GBP",
      "value": {
        "@type": "QuantitativeValue",
        "value": request.budget,
        "unitText": request.rateType === "HOURLY" ? "HOUR" : request.rateType === "DAILY" ? "DAY" : "PROJECT"
      }
    } : undefined,
    "employmentType": "TEMPORARY",
    "validThrough": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  };

  return (
    <>
      <SEO
        title={`${request.title} - SpannerWork`}
        description={request.description?.slice(0, 160) || `${categoryConfig.label} job in ${locationCity}. Budget: ${formatPrice(request.budget)}`}
        keywords={`${categoryConfig.label.toLowerCase()}, ${request.category.toLowerCase()}, job, ${locationCity}`}
        url={`https://www.spannerwork.co.uk/request/${request.id}`}
        schema={jobPostingSchema}
      />
      <div className="min-h-screen bg-gray-50">
        {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={handleBackToFeed}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors p-2 -ml-2 min-w-[44px] min-h-[44px] rounded-lg hover:bg-gray-100 active:bg-gray-200"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline font-medium">Back</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBookmark}
              className={`p-2 rounded-full transition-all ${
                isBookmarked
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
            >
              <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={handleShare}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Photo Gallery */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden"
        >
          <RequestPhotoGallery
            photos={request.photos || []}
            title={request.title}
            category={request.category}
          />
        </motion.div>
      </div>

      {/* Hero Section - Title, Badges, Budget */}
      <RequestHero
        title={request.title}
        category={request.category}
        categoryLabel={categoryConfig.label}
        urgency={request.urgency}
        postcode={request.postcode}
        locationAddress={request.locationAddress ?? undefined}
        broadcastRadius={request.broadcastRadius}
        createdDate={request.createdDate}
        budget={request.budget}
        rateType={request.rateType}
        status={request.status}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 pb-32 lg:pb-12 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Content */}
          <div className="lg:col-span-2 space-y-6">

            {/* Mobile Seller Card */}
            <div className="lg:hidden">
              {seeker && (
                <SellerTrustCard
                  user={seeker}
                  isOwnRequest={isOwnRequest}
                  onMessage={handleMessage}
                  variant="inline"
                />
              )}
            </div>

            {/* Description */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className={`h-1 ${
                  request.category === 'TOOLS' ? 'bg-amber-400' :
                  request.category === 'EXPERTISE' ? 'bg-blue-400' :
                  'bg-purple-400'
                }`} />
                <CardContent className="p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      request.category === 'TOOLS' ? 'bg-amber-50' :
                      request.category === 'EXPERTISE' ? 'bg-blue-50' :
                      'bg-purple-50'
                    }`}>
                      <CategoryIcon className={`w-4 h-4 ${
                        request.category === 'TOOLS' ? 'text-amber-600' :
                        request.category === 'EXPERTISE' ? 'text-blue-600' :
                        'text-purple-600'
                      }`} />
                    </span>
                    About This Job
                  </h2>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base">
                    {request.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Location Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-1 bg-brand-400" />
                <CardContent className="p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-brand-600" />
                    </span>
                    Location
                  </h2>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-900 font-semibold text-lg">
                        {request.postcode ? getOutwardCode(request.postcode) : request.locationAddress || 'Location not specified'}
                      </p>
                      {request.broadcastRadius !== undefined && request.broadcastRadius < 999 && (
                        <p className="text-gray-500 mt-1">Within {request.broadcastRadius} miles</p>
                      )}
                      {request.broadcastRadius !== undefined && request.broadcastRadius >= 999 && (
                        <p className="text-blue-600 mt-1 flex items-center gap-1">
                          <Globe className="w-4 h-4" />
                          Nationwide request - open to all areas
                        </p>
                      )}
                    </div>
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center shadow-sm">
                      <MapPin className="w-7 h-7 text-brand-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Desktop CTA - under location on left column */}
            <div className="hidden lg:block">
              <StickyRequestCTA
                isOwnRequest={isOwnRequest}
                isActive={isActive}
                budget={request.budget}
                rateType={request.rateType}
                responseCount={responses.length}
                hasAlreadyQuoted={request.userHasQuoted}
                seekerId={request.seekerId}
                requestId={request.id}
                onSendQuote={() => setShowResponseDialog(true)}
                onEdit={() => setShowEditDialog(true)}
                onViewResponses={() => navigate('/messages')}
                onBack={handleBackToFeed}
                onMarkComplete={handleMarkComplete}
                onClose={handleClose}
                variant="desktop"
              />
            </div>

            {/* Responses (for job owner) */}
            {isOwnRequest && responses.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-blue-500" />
                  Quotes Received ({responses.length})
                </h2>
                <div className="space-y-3">
                  {responses.map((response: Transaction) => (
                    <Card key={response.id} className="border-0 shadow-sm bg-gradient-to-r from-blue-50 to-indigo-50 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => navigate(`/messages?userId=${response.providerId}&requestId=${request.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">New quote received</p>
                            <p className="text-sm text-gray-600 mt-0.5">
                              {formatPrice(response.rentalFee)}
                              {response.depositAmount ? ` + ${formatPrice(response.depositAmount)} deposit` : ''}
                            </p>
                          </div>
                          <Button className="bg-blue-600 hover:bg-blue-700 rounded-xl">
                            View Quote
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Column - Sidebar (Desktop) */}
          <div className="hidden lg:block">
            <div className="sticky top-20 space-y-4">
              {/* Seller Card */}
              {seeker && (
                <SellerTrustCard
                  user={seeker}
                  isOwnRequest={isOwnRequest}
                  onMessage={handleMessage}
                  variant="sidebar"
                />
              )}

              {/* Pricing Card */}
              <RequestPricingCard
                budget={request.budget}
                rateType={request.rateType}
                urgency={request.urgency}
                responseCount={responses.length}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile CTA - fixed bottom bar */}
      <StickyRequestCTA
        isOwnRequest={isOwnRequest}
        isActive={isActive}
        budget={request.budget}
        rateType={request.rateType}
        responseCount={responses.length}
        hasAlreadyQuoted={request.userHasQuoted}
        seekerId={request.seekerId}
        requestId={request.id}
        onSendQuote={() => setShowResponseDialog(true)}
        onEdit={() => setShowEditDialog(true)}
        onViewResponses={() => navigate('/messages')}
        onBack={handleBackToFeed}
        onMarkComplete={handleMarkComplete}
        onClose={handleClose}
        variant="mobile"
      />

      {/* Dialogs */}
      {showResponseDialog && request && (
        <RequestResponseDialog
          request={request}
          onClose={() => setShowResponseDialog(false)}
        />
      )}

      {showEditDialog && request && (
        <EditRequestDialog
          request={request}
          onClose={() => setShowEditDialog(false)}
        />
      )}
    </div>
    </>
  );
}
