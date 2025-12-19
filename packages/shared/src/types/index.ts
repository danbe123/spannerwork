/**
 * Core type definitions for SpannerWork
 * Shared between web and mobile apps
 * These types mirror the backend Prisma models
 */

// ============================================================================
// ENUMS
// ============================================================================

export type Role = 'USER' | 'ADMIN' | 'MODERATOR';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';
export type Category = 'TOOLS' | 'EXPERTISE' | 'SPACE';
export type Urgency = 'ASAP' | 'TODAY' | 'THIS_WEEKEND' | 'FLEXIBLE';
export type RateType = 'FIXED' | 'HOURLY' | 'DAILY';
export type RequestStatus = 'ACTIVE' | 'FULFILLED' | 'EXPIRED' | 'CANCELLED';
export type TransactionStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED';
export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export type ReferralStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED';
export type ToolCondition = 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'POOR';

// ============================================================================
// USER
// ============================================================================

export interface User {
  id: string;
  email: string;
  name?: string | null;
  username?: string | null;
  phone?: string | null;
  avatar?: string | null;
  bio?: string | null;
  postcode?: string | null;
  locationAddress?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  role: Role;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  emailVerifiedAt?: string | null;
  phoneVerified?: boolean;
  insuranceVerified?: boolean;
  idVerified?: boolean;
  coverPhoto?: string | null;
  rating?: number | null;
  totalTransactions: number;
  totalReviews: number;
  createdDate: string;
  updatedDate: string;
}

export interface UserProfile extends User {
  tools?: Tool[];
  spaces?: Space[];
  services?: Service[];
  reviewsReceived?: Review[];
}

// ============================================================================
// LISTINGS
// ============================================================================

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  dailyRate: number;
  weeklyRate?: number | null;
  deposit: number;
  photos: string[];
  condition: ToolCondition | string;
  available: boolean;
  postcode: string;
  locationLat?: number | null;
  locationLng?: number | null;
  ownerId: string;
  owner?: User;
  createdDate: string;
  updatedDate: string;
}

export interface Space {
  id: string;
  name: string;
  description: string;
  spaceType?: string | null;
  hourlyRate: number;
  dailyRate: number;
  weeklyRate?: number | null;
  size?: number | null;
  sizeSqft?: number | null;
  features: string[];
  photos: string[];
  available: boolean;
  postcode: string;
  locationAddress: string;
  locationLat?: number | null;
  locationLng?: number | null;
  ownerId: string;
  owner?: User;
  deposit?: number | null;
  vehicleCapacity?: number | null;
  maxVehicleHeight?: number | null;
  electricityAvailable?: boolean;
  toolsAvailable?: boolean;
  supervisionRequired?: boolean;
  insuranceRequired?: boolean;
  createdDate: string;
  updatedDate: string;
}

export interface Service {
  id: string;
  name: string;
  title: string;
  description: string;
  category: string;
  specialties: string[];
  hourlyRate: number;
  calloutFee?: number | null;
  radius: number;
  serviceRadius?: number | null;
  photos: string[];
  available: boolean;
  postcode: string;
  locationLat?: number | null;
  locationLng?: number | null;
  providerId: string;
  provider?: User;
  mobileService?: boolean;
  responseTime?: string | null;
  yearsExperience?: number | null;
  weekendAvailability?: boolean;
  eveningAvailability?: boolean;
  emergencyCallout?: boolean;
  offersFreeQuote?: boolean;
  certifications?: string[];
  hasInsurance?: boolean;
  requiresInsurance?: boolean;
  createdDate: string;
  updatedDate: string;
}

// ============================================================================
// REQUESTS
// ============================================================================

export interface Request {
  id: string;
  title: string;
  description: string;
  category: Category;
  urgency: Urgency;
  budget: number;
  rateType: RateType;
  broadcastRadius: number;
  postcode: string;
  locationAddress?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  photos: string[];
  status: RequestStatus;
  responseCount: number;
  seekerId: string;
  seeker?: User;
  expiresAt: string;
  createdDate: string;
  updatedDate: string;
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

export interface Transaction {
  id: string;
  requestId?: string | null;
  toolId?: string | null;
  spaceId?: string | null;
  serviceId?: string | null;
  userId: string;
  providerId?: string | null;
  startDate: string;
  endDate: string;
  rentalFee: number;
  platformFee: number;
  totalAmount: number;
  status: TransactionStatus;
  paymentStatus: PaymentStatus;
  notes?: string | null;
  createdDate: string;
  updatedDate: string;
  completedDate?: string | null;
  user?: User;
  provider?: User;
  tool?: Tool | null;
  space?: Space | null;
  service?: Service | null;
  request?: Request | null;
  reviews?: Review[];
  depositAmount?: number | null;
  pickupConditionPhoto?: string | null;
  returnConditionPhoto?: string | null;
  agreedTerms?: {
    durationDays?: number;
    [key: string]: unknown;
  } | null;
  title?: string | null;
  category?: string | null;
  photos?: string[];
  rating?: number | null;
}

// ============================================================================
// REVIEWS
// ============================================================================

export interface Review {
  id: string;
  transactionId: string;
  reviewerId: string;
  reviewedUserId: string;
  rating: number;
  comment?: string | null;
  createdDate: string;
  updatedDate: string;
  reviewer?: User;
  reviewedUser?: User;
  transaction?: Transaction;
  reviewerName?: string | null;
  reviewerAvatar?: string | null;
  transactionType?: string | null;
}

// ============================================================================
// MESSAGES
// ============================================================================

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  read: boolean;
  reactions?: string[];
  createdDate: string;
  updatedDate: string;
  sender?: User;
  recipient?: User;
}

export interface Conversation {
  id: string;
  participant: User;
  lastMessage: Message;
  unreadCount: number;
}

// ============================================================================
// DISPUTES
// ============================================================================

export interface Dispute {
  id: string;
  transactionId: string;
  initiatorId: string;
  respondentId: string;
  reason: string;
  description: string;
  status: DisputeStatus;
  resolution?: string | null;
  refundAmountInitiator?: number | null;
  refundAmountRespondent?: number | null;
  createdDate: string;
  updatedDate: string;
  resolvedDate?: string | null;
  transaction?: Transaction;
  initiator?: User;
  respondent?: User;
}

// ============================================================================
// BOOKINGS
// ============================================================================

export interface Booking {
  id: string;
  userId: string;
  toolId?: string | null;
  spaceId?: string | null;
  serviceId?: string | null;
  startDate: string;
  endDate: string;
  status: BookingStatus;
  notes?: string | null;
  createdDate: string;
  updatedDate: string;
  user?: User;
  tool?: Tool | null;
  space?: Space | null;
  service?: Service | null;
}

// ============================================================================
// REFERRALS
// ============================================================================

export interface Referral {
  id: string;
  referrerId: string;
  referredId?: string | null;
  code: string;
  email?: string | null;
  phone?: string | null;
  status: ReferralStatus;
  reward?: number | null;
  createdDate: string;
  updatedDate: string;
  completedDate?: string | null;
  referrer?: User;
  referred?: User | null;
}

// ============================================================================
// SAVED SEARCHES
// ============================================================================

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  filters: Record<string, unknown>;
  createdDate: string;
  updatedDate: string;
}

// ============================================================================
// ANALYTICS (Admin)
// ============================================================================

export interface OverviewMetrics {
  totalUsers: number;
  totalListings: number;
  totalTransactions: number;
  totalGmv: number;
  platformRevenue: number;
  activeUsers24h: number;
  newUsersToday: number;
  pendingDisputes: number;
}

export interface RevenueDataPoint {
  date: string;
  gmv: number;
  platformFee: number;
  transactionCount: number;
}

export interface UserGrowthDataPoint {
  date: string;
  newUsers: number;
  totalUsers: number;
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  revenue: number;
}

export interface ConversionFunnel {
  totalSignups: number;
  profileCompleted: number;
  firstListingCreated: number;
  firstBookingMade: number;
  firstTransactionCompleted: number;
  repeatCustomers: number;
}

export interface GeographicDataPoint {
  region: string;
  userCount: number;
  listingCount: number;
  transactionCount: number;
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    prevCursor: string | null;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    total?: number;
  };
}

export interface AuthResponse {
  message: string;
  user: User;
}

// ============================================================================
// FORM / INPUT TYPES
// ============================================================================

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

export interface CreateToolData {
  name: string;
  description: string;
  category: string;
  dailyRate: number;
  weeklyRate?: number;
  deposit: number;
  photos: string[];
  condition: ToolCondition | string;
  postcode: string;
}

export interface CreateSpaceData {
  name: string;
  description: string;
  hourlyRate: number;
  dailyRate: number;
  weeklyRate?: number;
  size?: number;
  features: string[];
  photos: string[];
  postcode: string;
  locationAddress: string;
}

export interface CreateServiceData {
  name: string;
  description: string;
  specialties: string[];
  hourlyRate: number;
  calloutFee?: number;
  radius: number;
  photos?: string[];
  requiresInsurance?: boolean;
  postcode: string;
}

export interface CreateRequestData {
  title: string;
  description: string;
  category: Category;
  urgency: Urgency;
  budget: number;
  rateType: RateType;
  broadcastRadius: number;
  postcode: string;
  photos?: string[];
}

export interface CreateTransactionData {
  requestId?: string;
  toolId?: string;
  spaceId?: string;
  serviceId?: string;
  startDate: string;
  endDate: string;
  notes?: string;
}

export interface CreateReviewData {
  transactionId: string;
  reviewedUserId: string;
  rating: number;
  comment?: string;
}

export interface CreateMessageData {
  recipientId: string;
  content: string;
  requestId?: string;
}

export interface CreateDisputeData {
  transactionId: string;
  reason: string;
  description: string;
}
