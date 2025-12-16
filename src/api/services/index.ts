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

// Utility services
export { savedSearchesService } from './savedSearches';
export { uploadService } from './upload';
export { contactService } from './contact';
export { statsService } from './stats';
export { referralsService } from './referrals';
export { geocodingService } from './geocoding';

// New UX feature services (TypeScript)
export { aiService } from './ai';
export type { MatchResult, BundleSuggestion, OptimizedRequest } from './ai';
export { activityService } from './activity';
export type { ActivityEvent, LiveStats } from './activity';
export { gamificationService } from './gamification';
export type { Badge, UserStats, LeaderboardEntry, NextBadge } from './gamification';
export { quickAcceptService } from './quickAccept';
export type { MatchingProvider, PendingResponse } from './quickAccept';

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
