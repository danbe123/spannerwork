/**
 * API Services Index
 * 
 * Centralized exports for all API service modules.
 * All services are fully typed TypeScript.
 */

// Auth service
export { authService } from './auth';
export type { CurrentUserResponse } from './auth';

// Core domain services
export { requestsService } from './requests';
export type { ListRequestsParams } from './requests';

export { toolsService } from './tools';
export type { ListToolsParams, AvailabilityParams, AvailabilityResponse } from './tools';

export { spacesService } from './spaces';
export type { ListSpacesParams } from './spaces';

export { servicesService } from './services';
export type { ListServicesParams } from './services';

export { usersService } from './users';
export type { UpdateUserData, ListReviewsParams, UserListings } from './users';

export { transactionsService } from './transactions';
export type { ListTransactionsParams } from './transactions';

export { messagesService } from './messages';
export type { ConversationParams, UnreadCountResponse, GetConversationResponse } from './messages';

export { reviewsService } from './reviews';
export type { ListReviewsParams as ReviewListParams } from './reviews';

export { disputesService } from './disputes';
export type { ListDisputesParams, ResolveDisputeData } from './disputes';

// Admin service
export { adminService } from './admin';

// Blog service
export { blogService, adminBlogService } from './blog';
export type {
  BlogPost,
  BlogPostSummary,
  BlogPostStatus,
  ListBlogPostsParams,
  AdminListBlogPostsParams,
  CreateBlogPostData,
  UpdateBlogPostData,
  PaginatedBlogResponse,
} from './blog';

// Utility services
export { savedSearchesService } from './savedSearches';
export { uploadService } from './upload';
export { contactService } from './contact';
export { statsService } from './stats';
export { referralsService } from './referrals';
export { geocodingService } from './geocoding';
export { addressService } from './address';
export type { AddressResult, AddressLookupResponse } from './address';

// New UX feature services (TypeScript)
export { aiService } from './ai';
export type {
  MatchResult,
  BundleSuggestion,
  OptimizedRequest,
  GeneratedListing,
  ImprovedListing,
  ImageAnalysis,
} from './ai';
export { activityService } from './activity';
export type { ActivityEvent, LiveStats } from './activity';
export { gamificationService } from './gamification';
export type { Badge, UserStats, LeaderboardEntry, NextBadge } from './gamification';
export { quickAcceptService } from './quickAccept';
export type { MatchingProvider, PendingResponse } from './quickAccept';

// Payment service (Stripe)
export { paymentsService } from './payments';
export type {
  StripeConfig,
  ConnectAccountResponse,
  AccountStatus,
  PaymentIntentResponse,
  EscrowStatus,
  CaptureResponse,
  RefundResponse,
} from './payments';

// Admin analytics service (TypeScript)
export { analyticsService } from './analytics.service';
export type {
  OverviewMetrics,
  RevenueDataPoint,
  RevenueResponse,
  UserGrowthDataPoint,
  UserGrowthResponse,
  ListingTrendsDataPoint,
  ListingTrendsResponse,
  CategoryBreakdown,
  GeographicDataPoint,
  ConversionFunnel,
  ConversionFunnelResponse,
  TopPerformer,
  TopPerformersResponse,
} from './analytics.service';

// Bookmarks service (TypeScript)
export { bookmarksService } from './bookmarks';
export type {
  Bookmark,
  BookmarkIdsResponse,
  BookmarksListResponse,
  BookmarkCheckResponse,
  BookmarkToggleResponse,
  BookmarkSyncResponse,
} from './bookmarks';

// Invoice service (TypeScript)
export { invoicesService } from './invoices';
export type {
  InvoiceSettings,
  UpdateInvoiceSettingsData,
  Invoice,
  LineItem,
  ListInvoicesParams,
  TaxSummary,
} from './invoices';

// Trade Account service (TypeScript)
export { tradeAccountService } from './tradeAccount';
export type {
  AccountType,
  TeamRole,
  MemberStatus,
  TeamMember,
  TradeAccount,
  CreateTradeAccountData,
  UpdateTradeAccountData,
  TeamInvitation,
  DiscountResult,
} from './tradeAccount';

// Re-export types
export type {
  User,
  Tool,
  Space,
  Service,
  Request,
  Transaction,
  Review,
  Message,
  Dispute,
  Booking,
  Referral,
  SavedSearch,
  AuthResponse,
  LoginCredentials,
  RegisterData,
  PaginatedResponse,
} from '@/types';
