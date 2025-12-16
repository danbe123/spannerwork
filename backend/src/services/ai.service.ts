import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { redis } from '../config/redis.js';
import { prisma } from '../config/database.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
  error?: { message: string };
}

interface MatchResult {
  listingId: string;
  listingType: 'tool' | 'space' | 'service';
  matchScore: number;
  matchReason: string;
}

interface BundleSuggestion {
  id: string;
  type: 'tool' | 'space' | 'service';
  name: string;
  reason: string;
  price: number;
}

/**
 * AI Service powered by Google Gemini
 * Handles: Smart matching, bundle suggestions, request optimization
 */
export class AIService {
  private hasApiKey = !!env.GEMINI_API_KEY;

  /**
   * Call Gemini API with a prompt
   */
  private async callGemini(prompt: string, systemInstruction?: string): Promise<string | null> {
    if (!this.hasApiKey) {
      logger.warn('Gemini API key not configured, skipping AI features');
      return null;
    }

    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Gemini API error:', { status: response.status, error });
        return null;
      }

      const data = (await response.json()) as GeminiResponse;
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (error) {
      logger.error('Error calling Gemini API:', error);
      return null;
    }
  }

  /**
   * Smart Matching: Find best listings for a request
   */
  async findMatches(request: {
    title: string;
    description: string;
    category: string;
    budget: number;
    postcode: string;
    lat?: number;
    lng?: number;
  }): Promise<MatchResult[]> {
    // Get available listings in the area
    const [tools, spaces, services] = await Promise.all([
      request.category === 'TOOLS' || request.category === 'ALL'
        ? prisma.tool.findMany({
            where: { available: true },
            include: { owner: { select: { id: true, name: true, rating: true, postcode: true } } },
            take: 20,
          })
        : [],
      request.category === 'SPACE' || request.category === 'ALL'
        ? prisma.space.findMany({
            where: { available: true },
            include: { owner: { select: { id: true, name: true, rating: true, postcode: true } } },
            take: 20,
          })
        : [],
      request.category === 'EXPERTISE' || request.category === 'ALL'
        ? prisma.service.findMany({
            where: { available: true },
            include: { provider: { select: { id: true, name: true, rating: true, postcode: true } } },
            take: 20,
          })
        : [],
    ]);

    if (tools.length === 0 && spaces.length === 0 && services.length === 0) {
      return [];
    }

    // Build listing context for AI
    const listingsContext = [
      ...tools.map(t => ({
        id: t.id,
        type: 'tool' as const,
        name: t.name,
        description: t.description,
        category: t.category,
        dailyRate: t.dailyRate / 100,
        ownerRating: t.owner.rating,
      })),
      ...spaces.map(s => ({
        id: s.id,
        type: 'space' as const,
        name: s.name,
        description: s.description,
        dailyRate: s.dailyRate / 100,
        ownerRating: s.owner.rating,
      })),
      ...services.map(s => ({
        id: s.id,
        type: 'service' as const,
        name: s.name,
        description: s.description,
        specialties: s.specialties,
        hourlyRate: s.hourlyRate / 100,
        providerRating: s.provider.rating,
      })),
    ];

    const prompt = `
You are a marketplace matching assistant. A user needs help with this request:

REQUEST:
Title: ${request.title}
Description: ${request.description}
Category: ${request.category}
Budget: £${request.budget}

AVAILABLE LISTINGS:
${JSON.stringify(listingsContext, null, 2)}

Return a JSON array of the top 5 best matches with this format:
[
  {
    "listingId": "id",
    "listingType": "tool|space|service",
    "matchScore": 0-100,
    "matchReason": "Brief reason why this is a good match"
  }
]

Only return the JSON array, no other text.
`;

    const result = await this.callGemini(prompt, 'You are a helpful marketplace matching assistant. Always respond with valid JSON only.');
    
    if (!result) {
      // Fallback: simple keyword matching
      return this.fallbackMatching(request, listingsContext);
    }

    try {
      // Extract JSON from response
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return this.fallbackMatching(request, listingsContext);
      
      const matches = JSON.parse(jsonMatch[0]) as MatchResult[];
      return matches.slice(0, 5);
    } catch {
      logger.warn('Failed to parse AI matching response, using fallback');
      return this.fallbackMatching(request, listingsContext);
    }
  }

  /**
   * Fallback matching when AI is unavailable
   */
  private fallbackMatching(
    request: { title: string; description: string; budget: number },
    listings: Array<{ id: string; type: 'tool' | 'space' | 'service'; name: string; description: string }>
  ): MatchResult[] {
    const searchTerms = `${request.title} ${request.description}`.toLowerCase().split(/\s+/);
    
    return listings
      .map(listing => {
        const listingText = `${listing.name} ${listing.description}`.toLowerCase();
        const matchCount = searchTerms.filter(term => listingText.includes(term)).length;
        const score = Math.min(100, Math.round((matchCount / searchTerms.length) * 100));
        
        return {
          listingId: listing.id,
          listingType: listing.type,
          matchScore: score,
          matchReason: score > 50 ? 'Matches your search terms' : 'Related listing',
        };
      })
      .filter(m => m.matchScore > 20)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);
  }

  /**
   * Bundle Suggestions: Recommend related items
   */
  async getBundleSuggestions(
    itemId: string,
    itemType: 'tool' | 'space' | 'service',
    itemName: string,
    itemCategory: string
  ): Promise<BundleSuggestion[]> {
    // Check cache first
    const cacheKey = `bundle:${itemType}:${itemId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get other available listings
    const [tools, services] = await Promise.all([
      prisma.tool.findMany({
        where: { available: true, id: { not: itemType === 'tool' ? itemId : undefined } },
        take: 15,
        select: { id: true, name: true, category: true, dailyRate: true, description: true },
      }),
      prisma.service.findMany({
        where: { available: true, id: { not: itemType === 'service' ? itemId : undefined } },
        take: 10,
        select: { id: true, name: true, specialties: true, hourlyRate: true, description: true },
      }),
    ]);

    const prompt = `
A user is renting: "${itemName}" (${itemCategory})

What 3 other items would commonly be needed together? Choose from:

TOOLS:
${tools.map(t => `- ${t.id}: ${t.name} (${t.category}) - £${t.dailyRate / 100}/day`).join('\n')}

SERVICES:
${services.map(s => `- ${s.id}: ${s.name} - £${s.hourlyRate / 100}/hr`).join('\n')}

Return JSON array:
[
  {
    "id": "listing-id",
    "type": "tool|service",
    "name": "Item name",
    "reason": "Why they'd need this together",
    "price": 0
  }
]

Only return JSON, no other text.
`;

    const result = await this.callGemini(prompt, 'You are a helpful assistant suggesting related rental items.');
    
    if (!result) {
      // Fallback: suggest items from same category
      return this.fallbackBundles(itemCategory, tools, services);
    }

    try {
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return this.fallbackBundles(itemCategory, tools, services);
      
      const suggestions = JSON.parse(jsonMatch[0]) as BundleSuggestion[];
      
      // Cache for 1 hour
      await redis.setex(cacheKey, 3600, JSON.stringify(suggestions.slice(0, 3)));
      
      return suggestions.slice(0, 3);
    } catch {
      return this.fallbackBundles(itemCategory, tools, services);
    }
  }

  /**
   * Fallback bundle suggestions
   */
  private fallbackBundles(
    category: string,
    tools: Array<{ id: string; name: string; category: string; dailyRate: number }>,
    services: Array<{ id: string; name: string; hourlyRate: number }>
  ): BundleSuggestion[] {
    const suggestions: BundleSuggestion[] = [];
    
    // Add tools from same category
    const relatedTools = tools.filter(t => t.category === category).slice(0, 2);
    for (const tool of relatedTools) {
      suggestions.push({
        id: tool.id,
        type: 'tool',
        name: tool.name,
        reason: 'Often rented together',
        price: tool.dailyRate / 100,
      });
    }
    
    // Add a service suggestion
    if (services.length > 0) {
      const service = services[0];
      suggestions.push({
        id: service.id,
        type: 'service',
        name: service.name,
        reason: 'Need help with installation?',
        price: service.hourlyRate / 100,
      });
    }
    
    return suggestions.slice(0, 3);
  }

  /**
   * Optimize request title/description for better matching
   */
  async optimizeRequest(title: string, description: string, category: string): Promise<{
    optimizedTitle: string;
    optimizedDescription: string;
    suggestedBudget: number;
  } | null> {
    const prompt = `
Optimize this marketplace request for better responses:

Category: ${category}
Title: ${title}
Description: ${description}

Return JSON:
{
  "optimizedTitle": "Clearer, more specific title (max 60 chars)",
  "optimizedDescription": "Improved description with key details",
  "suggestedBudget": estimated fair market rate in GBP
}

Only return JSON, no other text.
`;

    const result = await this.callGemini(prompt, 'You are helping users write better marketplace listings for tools, workspace, and mechanical services in the UK.');
    
    if (!result) return null;

    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  }
}

export const aiService = new AIService();
