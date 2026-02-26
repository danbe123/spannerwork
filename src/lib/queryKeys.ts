export const queryKeys = {
  currentUser: () => ['currentUser'] as const,
  messages: () => ['messages'] as const,
  transactions: () => ['transactions'] as const,
  notifications: () => ['notifications'] as const,

  conversations: () => ['conversations'] as const,
  conversation: (userId: string) => ['conversation', userId] as const,
  allMessages: () => ['allMessages'] as const,

  requests: () => ['requests'] as const,
  request: (requestId: string) => ['request', requestId] as const,
  requestsList: (params: Record<string, unknown>) => ['requests', params] as const,
  myRequests: () => ['myRequests'] as const,
  pendingResponses: () => ['pendingResponses'] as const,
  requestResponses: (requestId: string) => ['requestResponses', requestId] as const,

  tools: () => ['tools'] as const,
  tool: (toolId: string) => ['tool', toolId] as const,

  spaces: () => ['spaces'] as const,
  space: (spaceId: string) => ['space', spaceId] as const,

  services: () => ['services'] as const,
  service: (serviceId: string) => ['service', serviceId] as const,

  bookings: () => ['bookings'] as const,
  bookingsByTool: (toolId: string) => ['bookings', toolId] as const,
  calendar: () => ['calendar'] as const,

  myTools: () => ['myTools'] as const,
  myListings: () => ['myListings'] as const,

  providerRoot: () => ['provider'] as const,
  provider: (providerId: string) => ['provider', providerId] as const,

  owner: (ownerId: string) => ['owner', ownerId] as const,

  userIdRoot: () => ['userId'] as const,
  userId: (userId: string) => ['userId', userId] as const,

  allUsers: () => ['allUsers'] as const,
  allTransactions: () => ['allTransactions'] as const,
  allDisputes: () => ['allDisputes'] as const,
  allRequests: () => ['allRequests'] as const,

  adminAnalyticsOverview: () => ['admin-analytics-overview'] as const,
  adminAnalyticsRevenue: (dateRange: string) => ['admin-analytics-revenue', dateRange] as const,
  adminAnalyticsUsers: (dateRange: string) => ['admin-analytics-users', dateRange] as const,
  adminAnalyticsListings: (dateRange: string) => ['admin-analytics-listings', dateRange] as const,
  adminAnalyticsCategories: () => ['admin-analytics-categories'] as const,
  adminAnalyticsGeographic: () => ['admin-analytics-geographic'] as const,
  adminAnalyticsFunnel: () => ['admin-analytics-funnel'] as const,
  adminAnalyticsTopPerformers: () => ['admin-analytics-top-performers'] as const,

  activityFeed: () => ['activityFeed'] as const,
  activityFeedWithLimit: (limit: number) => ['activityFeed', limit] as const,

  unreadMessages: () => ['unreadMessages'] as const,
  newRequests: () => ['newRequests'] as const,

  myBadges: () => ['myBadges'] as const,
  nextBadges: () => ['nextBadges'] as const,

  mySpaces: () => ['mySpaces'] as const,

  bundleSuggestions: (listingType: string, listingId: string) => ['bundleSuggestions', listingType, listingId] as const,

  paymentAccountStatus: () => ['paymentAccountStatus'] as const,

  userTrustSignals: (userId: string) => ['userTrustSignals', userId] as const,

  userBadges: (userId: string) => ['userBadges', userId] as const,

  platformStats: () => ['platformStats'] as const,

  liveStats: () => ['liveStats'] as const,

  myStats: () => ['myStats'] as const,

  savedSearchesRoot: () => ['savedSearches'] as const,
  savedSearches: (userId: string) => ['savedSearches', userId] as const,

  myReferralsRoot: () => ['myReferrals'] as const,
  myReferrals: (userId: string) => ['myReferrals', userId] as const,

  myTransactionsAnalytics: (userId: string) => ['myTransactionsAnalytics', userId] as const,
  myToolsAnalytics: (userId: string) => ['myToolsAnalytics', userId] as const,
  myReviewsAnalytics: (userId: string) => ['myReviewsAnalytics', userId] as const,

  myListingsByUser: (userId: string) => ['myListings', userId] as const,
  myReviewsByUser: (userId: string) => ['myReviews', userId] as const,
  myTransactionsByUser: (userId: string) => ['myTransactions', userId] as const,

  myDisputes: () => ['myDisputes'] as const,
  myTransactionsForDispute: (userId: string) => ['myTransactionsForDispute', userId] as const,

  providerTools: (providerId: string) => ['providerTools', providerId] as const,

  userSpecificRoots: [
    'messages',
    'transactions',
    'notifications',
    'savedSearches',
    'referrals',
    'disputes',
    'userTools',
    'userSpaces',
    'userServices',
    'userRequests',
    'calendar',
  ] as const,

  transaction: (transactionId: string) => ['transaction', transactionId] as const,

  // Blog
  blogPosts: () => ['blogPosts'] as const,
  blogPost: (slug: string) => ['blogPost', slug] as const,
  blogCategories: () => ['blogCategories'] as const,

  // Bookmarks
  bookmarks: () => ['bookmarks'] as const,
  bookmarkIds: () => ['bookmarkIds'] as const,
  isBookmarked: (requestId: string) => ['isBookmarked', requestId] as const,
} as const;
