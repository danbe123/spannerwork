import apiClient from '../client';

export interface MatchResult {
  listingId: string;
  listingType: 'tool' | 'space' | 'service';
  matchScore: number;
  matchReason: string;
}

export interface BundleSuggestion {
  id: string;
  type: 'tool' | 'space' | 'service';
  name: string;
  reason: string;
  price: number;
}

export interface OptimizedRequest {
  optimizedTitle: string;
  optimizedDescription: string;
  suggestedBudget: number | null;
  feedbackId?: string;
}

export interface GeneratedListing {
  title: string;
  description: string;
  category: string;
  features: string[];
  suggestedDailyRate: number;
  suggestedDeposit: number;
  condition?: string;
  keywords: string[];
  promptVersion?: string;
  modelUsed?: string;
  // Image analysis results (when images were analyzed)
  imageAnalysis?: ImageAnalysis;
}

export interface GeneratedRequest {
  title: string;
  description: string;
  suggestedBudget: number;
  suggestedRateType: 'FIXED' | 'HOURLY' | 'DAILY';
  suggestedUrgency: 'ASAP' | 'TODAY' | 'THIS_WEEKEND' | 'FLEXIBLE';
  keywords: string[];
  promptVersion?: string;
  modelUsed?: string;
}

export interface ImprovedListing {
  improvedTitle: string;
  improvedDescription: string;
  seoScore: number;
  suggestions: string[];
  feedbackId?: string;
}

export interface ImageAnalysis {
  itemType: string;
  brand?: string | null;
  model?: string | null;
  condition: string;
  features: string[];
  concerns: string[];
  suggestedCategory?: string;
  confidence?: number;
}

export interface CategorySuggestion {
  suggestedSpecialties?: string[];
  suggestedFeatures?: string[];
  suggestedCondition?: string;
  confidence: number;
  feedbackId?: string;
}

export interface PolicyViolation {
  type: string;
  severity: 'BLOCK' | 'WARN' | 'FLAG';
  detail: string;
}

export interface ModerationResult {
  approved: boolean;
  riskScore: number;
  violations: PolicyViolation[];
  warnings: string[];
  reasoning: string;
  feedbackId?: string;
}

export type AIFeedbackAction = 'ACCEPTED_FULL' | 'ACCEPTED_PARTIAL' | 'REJECTED' | 'REGENERATED';

export interface AIFeedbackData {
  feedbackId: string;
  action: AIFeedbackAction;
  selectedFields?: string[];
  modifiedFields?: Record<string, { original: unknown; modified: unknown }>;
  finalData?: unknown;
}

// Generate a session ID for tracking related AI interactions
let currentSessionId: string | null = null;

export function getAISessionId(): string {
  if (!currentSessionId) {
    currentSessionId = crypto.randomUUID();
  }
  return currentSessionId;
}

export function resetAISessionId(): void {
  currentSessionId = null;
}

export const aiService = {
  /**
   * Get AI-powered matches for a request
   */
  async getMatches(data: {
    title: string;
    description: string;
    category: string;
    budget?: number;
    postcode?: string;
  }): Promise<{ matches: MatchResult[]; feedbackId?: string }> {
    const response = await apiClient.post<{ matches: MatchResult[]; feedbackId?: string }>('/ai/match', {
      ...data,
      sessionId: getAISessionId(),
    });
    return response.data;
  },

  /**
   * Get bundle suggestions for a listing
   */
  async getBundles(
    listingType: 'tool' | 'space' | 'service',
    listingId: string,
    name: string,
    category: string
  ): Promise<{ suggestions: BundleSuggestion[] }> {
    const response = await apiClient.get<{ suggestions: BundleSuggestion[] }>(
      `/ai/bundles/${listingType}/${listingId}`,
      { params: { name, category } }
    );
    return response.data;
  },

  /**
   * Optimize request title and description
   */
  async optimizeRequest(
    title: string,
    description: string,
    category: string
  ): Promise<OptimizedRequest> {
    const response = await apiClient.post<OptimizedRequest>('/ai/optimize-request', {
      title,
      description,
      category,
      sessionId: getAISessionId(),
    });
    return response.data;
  },

  /**
   * Generate optimized listing from raw input
   */
  async generateListing(
    rawDescription: string,
    listingType: 'tool' | 'space' | 'service',
    imageUrls?: string[]
  ): Promise<{ listing: GeneratedListing; feedbackId?: string }> {
    const response = await apiClient.post<{ listing: GeneratedListing; feedbackId?: string }>('/ai/generate-listing', {
      rawDescription,
      listingType,
      imageUrls,
      sessionId: getAISessionId(),
    });
    return response.data;
  },

  /**
   * Generate optimized job request from raw input
   */
  async generateRequest(
    rawDescription: string,
    category: 'TOOLS' | 'EXPERTISE' | 'SPACE',
    imageUrls?: string[]
  ): Promise<{ request: GeneratedRequest; feedbackId?: string }> {
    const response = await apiClient.post<{ request: GeneratedRequest; feedbackId?: string }>('/ai/generate-request', {
      rawDescription,
      category,
      imageUrls,
      sessionId: getAISessionId(),
    });
    return response.data;
  },

  /**
   * Improve an existing listing
   */
  async improveListing(
    title: string,
    description: string,
    category: string
  ): Promise<{ improved: ImprovedListing; feedbackId?: string }> {
    const response = await apiClient.post<{ improved: ImprovedListing; feedbackId?: string }>('/ai/improve-listing', {
      title,
      description,
      category,
      sessionId: getAISessionId(),
    });
    return response.data;
  },

  /**
   * Analyze listing images
   */
  async analyzeImages(imageUrls: string[]): Promise<{ analysis: ImageAnalysis; feedbackId?: string }> {
    const response = await apiClient.post<{ analysis: ImageAnalysis; feedbackId?: string }>('/ai/analyze-images', {
      imageUrls,
      sessionId: getAISessionId(),
    });
    return response.data;
  },

  /**
   * Suggest categories (specialties/features) based on description
   * Also suggests condition for tools based on text analysis
   */
  async suggestCategories(
    description: string,
    listingType: 'tool' | 'space' | 'service'
  ): Promise<CategorySuggestion> {
    const response = await apiClient.post<CategorySuggestion>('/ai/suggest-categories', {
      description,
      listingType,
      sessionId: getAISessionId(),
    });
    return response.data;
  },

  /**
   * Check listing content for policy violations
   * Returns approval status and any violations/warnings
   */
  async moderateContent(data: {
    title: string;
    description: string;
    category: string;
    listingType: 'tool' | 'space' | 'service' | 'request';
  }): Promise<ModerationResult> {
    const response = await apiClient.post<ModerationResult>('/ai/moderate-content', {
      ...data,
      sessionId: getAISessionId(),
    });
    return response.data;
  },

  /**
   * Send feedback about AI suggestions
   * Call this when user accepts, modifies, rejects, or regenerates AI suggestions
   */
  async sendFeedback(data: AIFeedbackData): Promise<{ success: boolean }> {
    const response = await apiClient.post<{ success: boolean }>('/ai/feedback', data);
    return response.data;
  },

  /**
   * Helper to detect which fields were modified
   */
  detectModifications(
    original: Record<string, unknown>,
    final: Record<string, unknown>
  ): Record<string, { original: unknown; modified: unknown }> {
    const modifications: Record<string, { original: unknown; modified: unknown }> = {};

    for (const key of Object.keys(original)) {
      const originalValue = original[key];
      const finalValue = final[key];

      // Simple comparison - could be enhanced for deep comparison
      if (JSON.stringify(originalValue) !== JSON.stringify(finalValue)) {
        modifications[key] = { original: originalValue, modified: finalValue };
      }
    }

    return modifications;
  },

  /**
   * Helper to get list of accepted fields
   */
  getAcceptedFields(
    original: Record<string, unknown>,
    final: Record<string, unknown>
  ): string[] {
    const accepted: string[] = [];

    for (const key of Object.keys(original)) {
      if (final[key] !== undefined) {
        accepted.push(key);
      }
    }

    return accepted;
  },
};
