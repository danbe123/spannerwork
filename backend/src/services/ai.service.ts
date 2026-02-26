import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { redis, prefixKey } from '../config/redis.js';
import { prisma } from '../config/database.js';
import {
  AI_TASK_CONFIGS,
  PROMPT_VERSIONS,
  LISTING_FEW_SHOT_EXAMPLES,
  IMAGE_ANALYSIS_PROMPT,
  DEPOSIT_GUIDANCE,
} from '../config/ai.config.js';

/**
 * Validate URL to prevent SSRF attacks
 * Blocks internal IPs, localhost, and private network ranges
 */
function isUrlSafeForFetch(url: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Block non-HTTP(S) protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { safe: false, reason: 'Invalid protocol - only HTTP/HTTPS allowed' };
    }

    // Enforce HTTPS in production
    if (env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      return { safe: false, reason: 'HTTPS required in production' };
    }

    // Block localhost variations
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return { safe: false, reason: 'Localhost not allowed' };
    }

    // Block .local domains
    if (hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return { safe: false, reason: 'Local/internal domains not allowed' };
    }

    // Check for IP addresses
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const [, a, b, c, d] = ipv4Match.map(Number);

      // Validate IP format
      if ([a, b, c, d].some(octet => octet > 255)) {
        return { safe: false, reason: 'Invalid IP address' };
      }

      // Block private IP ranges (RFC 1918)
      if (a === 10) {
        return { safe: false, reason: 'Private IP range (10.x.x.x) not allowed' };
      }
      if (a === 172 && b >= 16 && b <= 31) {
        return { safe: false, reason: 'Private IP range (172.16-31.x.x) not allowed' };
      }
      if (a === 192 && b === 168) {
        return { safe: false, reason: 'Private IP range (192.168.x.x) not allowed' };
      }

      // Block link-local (including cloud metadata endpoint 169.254.169.254)
      if (a === 169 && b === 254) {
        return { safe: false, reason: 'Link-local address not allowed' };
      }

      // Block loopback range
      if (a === 127) {
        return { safe: false, reason: 'Loopback address not allowed' };
      }

      // Block multicast and reserved ranges
      if (a === 0 || a >= 224) {
        return { safe: false, reason: 'Reserved/multicast IP not allowed' };
      }
    }

    // Block IPv6 localhost and private ranges
    if (hostname.startsWith('[')) {
      // IPv6 addresses in URLs are enclosed in brackets
      const ipv6 = hostname.slice(1, -1).toLowerCase();
      if (ipv6 === '::1' || ipv6.startsWith('fe80:') || ipv6.startsWith('fc') || ipv6.startsWith('fd')) {
        return { safe: false, reason: 'Private/loopback IPv6 not allowed' };
      }
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }
}

/**
 * FIX #8: Sanitize user input to prevent prompt injection attacks
 * Removes or escapes potentially dangerous patterns that could manipulate AI behavior
 */
function sanitizePromptInput(input: string): string {
  if (!input) return '';

  return input
    // Remove common injection patterns
    .replace(/ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/gi, '[FILTERED]')
    .replace(/disregard\s+(all\s+)?(previous|above|prior)\s+instructions?/gi, '[FILTERED]')
    .replace(/forget\s+(all\s+)?(previous|above|prior)\s+instructions?/gi, '[FILTERED]')
    .replace(/you\s+are\s+now\s+/gi, '[FILTERED]')
    .replace(/pretend\s+(to\s+be|you\s+are)/gi, '[FILTERED]')
    .replace(/act\s+as\s+(if\s+you\s+are|a)/gi, '[FILTERED]')
    .replace(/override\s+(your|the|all)\s+/gi, '[FILTERED]')
    .replace(/new\s+instructions?:/gi, '[FILTERED]')
    .replace(/system\s*:\s*/gi, '[FILTERED]')
    .replace(/assistant\s*:\s*/gi, '[FILTERED]')
    .replace(/user\s*:\s*/gi, '[FILTERED]')
    // Remove attempts to escape context
    .replace(/```/g, '')
    .replace(/\[\[/g, '[')
    .replace(/\]\]/g, ']')
    .replace(/\{\{/g, '{')
    .replace(/\}\}/g, '}')
    // Remove excessive newlines that could create visual separation
    .replace(/\n{3,}/g, '\n\n')
    // Limit length to prevent context overflow attacks
    .slice(0, 10000)
    .trim();
}

// Use stable models from env config
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// SpannerWork platform context - used across all AI methods
const PLATFORM_CONTEXT = `SpannerWork is a UK peer-to-peer rental marketplace for the automotive DIY community.

WHAT WE RENT:
- TOOLS: Diagnostic scanners, power tools, specialist automotive tools, lifting equipment
- SPACES: Workshop bays, garages with lifts, driveways for working on cars
- SERVICES: Mobile mechanics, diagnostics specialists, welders, bodywork experts

OUR USERS:
- Car enthusiasts doing DIY repairs and modifications
- Professional mechanics needing specialist tools occasionally
- People without garage space renting workshop time
- Side-hustle mechanics offering mobile services

UK MARKET CONTEXT:
- Prices in GBP (£), stored as pence (e.g., £25 = 2500)
- UK spelling: colour, tyre, spanner, centre, aluminium
- Common brands: Snap-on, Mac Tools, Sealey, Draper, Clarke, SIP, Autoglym
- MOT, service intervals, DVLA are common references`;

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
  error?: { message: string };
}

interface OpenAIResponse {
  choices?: Array<{
    message: { content: string };
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

interface ImageAnalysisResult {
  itemType: string;
  brand: string | null;
  model: string | null;
  condition: string;
  features: string[];
  concerns: string[];
  suggestedCategory: string;
  confidence: number;
}

interface FilteredImageResult {
  url: string;
  relevant: boolean;
  reason?: string;
  detectedContent?: string;
}

/**
 * AI Service powered by Google Gemini with OpenAI fallback
 * Provides intelligent features across the SpannerWork platform
 */
export class AIService {
  private hasGeminiKey = !!env.GEMINI_API_KEY;
  private hasOpenAIKey = !!env.OPENAI_API_KEY;

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Call Gemini API with retry logic
   */
  private async callGemini(
    prompt: string,
    systemInstruction?: string,
    taskType: string = 'listing_generation',
    imageBase64?: { data: string; mimeType: string }[]
  ): Promise<string | null> {
    if (!this.hasGeminiKey) {
      logger.warn('Gemini API key not configured');
      return null;
    }

    const config = AI_TASK_CONFIGS[taskType] || AI_TASK_CONFIGS.listing_generation;
    const model = config.useVision ? env.GEMINI_VISION_MODEL : env.GEMINI_MODEL;
    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

    // Build content parts
    const contentParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    // Add images first if present (for vision)
    if (imageBase64 && imageBase64.length > 0) {
      for (const img of imageBase64) {
        contentParts.push({
          inlineData: { mimeType: img.mimeType, data: img.data }
        });
      }
    }

    // Add text prompt
    contentParts.push({ text: prompt });

    const requestBody = {
      contents: [{ parts: contentParts }],
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
        responseMimeType: 'application/json', // Force JSON output
      },
    };

    // Retry with exponential backoff
    for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.text();
          logger.error('Gemini API error:', { status: response.status, error, attempt });

          if (response.status === 429 || response.status >= 500) {
            // Retry on rate limit or server errors
            if (attempt < config.retryAttempts) {
              await this.sleep(Math.pow(2, attempt) * 1000); // Exponential backoff
              continue;
            }
          }
          return null;
        }

        const data = (await response.json()) as GeminiResponse;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
          logger.debug('Gemini response received', { taskType, attempt, chars: text.length });
          return text;
        }

        return null;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          logger.warn('Gemini API timeout', { taskType, attempt, timeoutMs: config.timeoutMs });
        } else {
          logger.error('Gemini API error:', { error, attempt });
        }

        if (attempt < config.retryAttempts) {
          await this.sleep(Math.pow(2, attempt) * 1000);
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Call OpenAI API as fallback
   */
  private async callOpenAI(prompt: string, systemInstruction?: string): Promise<string | null> {
    if (!this.hasOpenAIKey) {
      return null;
    }

    try {
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.OPENAI_MODEL,
          messages: [
            ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
            { role: 'user', content: prompt }
          ],
          temperature: 0.5,
          max_tokens: 4096,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        logger.error('OpenAI API error:', { status: response.status });
        return null;
      }

      const data = (await response.json()) as OpenAIResponse;
      return data.choices?.[0]?.message?.content || null;
    } catch (error) {
      logger.error('OpenAI API error:', error);
      return null;
    }
  }

  /**
   * Call AI with automatic fallback to OpenAI
   */
  private async callAI(
    prompt: string,
    systemInstruction?: string,
    taskType: string = 'listing_generation'
  ): Promise<string | null> {
    // Try Gemini first
    let result = await this.callGemini(prompt, systemInstruction, taskType);

    // Fallback to OpenAI if Gemini fails
    if (!result && this.hasOpenAIKey) {
      logger.info('Falling back to OpenAI', { taskType });
      result = await this.callOpenAI(prompt, systemInstruction);
    }

    return result;
  }

  /**
   * Safely parse JSON from AI response
   */
  private safeParseJSON<T>(text: string): T | null {
    try {
      // Try direct parse first (for JSON mode responses)
      return JSON.parse(text) as T;
    } catch {
      // Fallback: extract JSON from text
      const jsonMatch = text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]) as T;
        } catch {
          logger.warn('Failed to parse JSON from AI response');
          return null;
        }
      }
      return null;
    }
  }

  // ============================================
  // 1. GENERATE LISTING - Create new listing from description
  // ============================================
  async generateListing(input: {
    rawDescription: string;
    imageUrls?: string[];
    listingType: 'tool' | 'space' | 'service';
  }): Promise<{
    title: string;
    description: string;
    category: string;
    features: string[];
    suggestedDailyRate: number;
    suggestedDeposit: number;
    condition?: string;
    keywords: string[];
    promptVersion: string;
    modelUsed: string;
    // Image analysis results (when images provided)
    imageAnalysis?: {
      brand: string | null;
      model: string | null;
      condition: string;
      itemType: string;
      features: string[];
      concerns: string[];
      suggestedCategory: string;
      confidence: number;
    };
  } | null> {
    const categoryInfo = this.getCategoryInfo(input.listingType);

    // STEP 1: Analyze images first if provided (for tools and spaces)
    // For tools: detects brand, model, condition from photos
    // For spaces: detects equipment like lifts, compressors, workbenches
    let imageAnalysis: ImageAnalysisResult | null = null;
    if (input.imageUrls?.length && (input.listingType === 'tool' || input.listingType === 'space')) {
      logger.info('Analyzing listing images before generation', {
        imageCount: input.imageUrls.length,
        listingType: input.listingType
      });
      imageAnalysis = input.listingType === 'space'
        ? await this.analyzeSpaceImages(input.imageUrls)
        : await this.analyzeListingImages(input.imageUrls);
      if (imageAnalysis) {
        logger.info('Image analysis completed for listing generation', {
          itemType: imageAnalysis.itemType,
          features: imageAnalysis.features,
          confidence: imageAnalysis.confidence
        });
      }
    }

    // Build enhanced context from image analysis - different format for tools vs spaces
    const imageContext = imageAnalysis ? (
      input.listingType === 'space' ? `
IMAGE ANALYSIS RESULTS - WORKSHOP/SPACE (use these to enhance the listing):
- Space Type: ${imageAnalysis.itemType}
- Overall Condition: ${imageAnalysis.condition} (confidence: ${Math.round(imageAnalysis.confidence * 100)}%)
- EQUIPMENT DETECTED: ${imageAnalysis.features.join(', ') || 'None detected'}
- Concerns/issues: ${imageAnalysis.concerns.join(', ') || 'None detected'}
- Suggested category: ${imageAnalysis.suggestedCategory}

CRITICAL FOR SPACES: Include ALL detected equipment in the features list. Renters need to know what's available.
${imageAnalysis.concerns.length > 0 ? `Note in description any limitations: ${imageAnalysis.concerns.join(', ')}` : ''}
` : `
IMAGE ANALYSIS RESULTS (use these to enhance the listing):
- Detected Item: ${imageAnalysis.itemType}
- Brand: ${imageAnalysis.brand || 'Not visible'}
- Model: ${imageAnalysis.model || 'Not visible'}
- Condition from photos: ${imageAnalysis.condition} (confidence: ${Math.round(imageAnalysis.confidence * 100)}%)
- Visible features: ${imageAnalysis.features.join(', ') || 'None detected'}
- Concerns/issues: ${imageAnalysis.concerns.join(', ') || 'None detected'}
- Suggested category: ${imageAnalysis.suggestedCategory}

IMPORTANT: Use the CONDITION detected from the photos (${imageAnalysis.condition}). This is more reliable than text description.
${imageAnalysis.brand ? `Include the brand "${imageAnalysis.brand}" in the title.` : ''}
${imageAnalysis.concerns.length > 0 ? `Note in description: ${imageAnalysis.concerns.join(', ')}` : ''}
`
    ) : '';

    const systemInstruction = `You are an expert UK marketplace copywriter for SpannerWork.

${PLATFORM_CONTEXT}

YOUR TASK: Transform the user's casual description into a compelling rental listing that will attract renters and rank well in search.

CRITICAL RULES:
1. FIX spelling and grammar - users type casually
2. Keep descriptions SHORT - 2-4 sentences MAX, no waffle or marketing fluff
3. ONLY use facts explicitly stated - DO NOT invent model numbers or specs
4. If user says "Makita drill" - say "Makita Cordless Drill", NOT "Makita LXT DHP486"
5. SELECT the most specific category - NEVER use "Other" if a better fit exists
6. SUGGEST realistic UK rental rates based on tool type
7. INCLUDE brand names in title when mentioned
8. Be CONCISE - renters scan listings quickly

CATEGORY GUIDANCE:
${categoryInfo.guidance}

PRICING GUIDANCE (typical UK tool hire rates):
- Basic hand tools: £5-15/day
- Power tools (drills, grinders): £15-35/day
- Diagnostic equipment: £25-75/day
- Specialist tools (timing kits, bearing pullers): £20-50/day
- Lifting equipment (jacks, stands): £15-40/day
- Welders: £35-75/day
- Workshop bay: £40-100/day

${DEPOSIT_GUIDANCE}

CONDITION DETECTION (for tools only):
- Analyze the description text for condition indicators
- Keywords for NEW: "brand new", "sealed", "unopened", "never used", "still in box"
- Keywords for LIKE_NEW: "barely used", "mint", "excellent", "pristine", "like new", "hardly used"
- Keywords for GOOD: "good condition", "works well", "normal wear", "good working order"
- Keywords for FAIR: "fair condition", "some wear", "cosmetic damage", "used but works"
- Keywords for POOR: "heavy wear", "needs repair", "well used", "worn"
- If no condition keywords mentioned, default to GOOD
- If photos are provided and show visible wear, scratches, or damage - factor that in

${LISTING_FEW_SHOT_EXAMPLES}

NOW generate a listing for the user's input. Return ONLY valid JSON.`;

    // Build the prompt with image analysis context if available
    const hasImageAnalysis = !!imageAnalysis;
    // FIX #8: Sanitize user input to prevent prompt injection
    const sanitizedDescription = sanitizePromptInput(input.rawDescription || '');
    const prompt = `Transform this into a professional SpannerWork listing:

USER'S INPUT: "${sanitizedDescription || '(No text description - use image analysis)'}"
TYPE: ${input.listingType}
${input.imageUrls?.length ? `PHOTOS: ${input.imageUrls.length} uploaded` : ''}
${imageContext}
${!input.rawDescription && hasImageAnalysis ? `
NOTE: User provided only images, no text. Base the listing entirely on the image analysis above.
Use the detected item type, brand, and features to create a complete listing.` : ''}

IMPORTANT: ${hasImageAnalysis
      ? 'Use the IMAGE ANALYSIS RESULTS above - they are from actual photo analysis. The condition from photos is authoritative.'
      : 'Only include details the user actually mentioned. Do NOT invent specs.'}

REQUIRED OUTPUT (JSON only):
{
  "title": "Professional title${hasImageAnalysis && imageAnalysis?.brand ? ` (include brand: ${imageAnalysis.brand})` : ''}, max 60 chars",
  "description": "2-4 SHORT sentences max. What it is + what's included.${hasImageAnalysis && imageAnalysis?.concerns.length ? ' Note any condition issues.' : ''} No fluff.",
  "category": "MUST be one of: ${JSON.stringify(categoryInfo.options)}${hasImageAnalysis ? ` (suggested: ${imageAnalysis?.suggestedCategory})` : ''}",
  "features": ["3-5 brief features${hasImageAnalysis ? ' - use detected features from photos' : ' - only what user mentioned'}"],
  "suggestedDailyRate": integer_in_pence,
  "suggestedDeposit": integer_in_pence,
  ${input.listingType === 'tool' ? `"condition": "${hasImageAnalysis ? imageAnalysis?.condition : 'NEW|LIKE_NEW|GOOD|FAIR'}",` : ''}
  "keywords": ["5-8 search terms renters would use"]
}`;

    const result = await this.callAI(prompt, systemInstruction, 'listing_generation');

    if (!result) {
      return this.fallbackListingGeneration(input);
    }

    const parsed = this.safeParseJSON<{
      title: string;
      description: string;
      category: string;
      features: string[];
      suggestedDailyRate: number;
      suggestedDeposit: number;
      condition?: string;
      keywords: string[];
    }>(result);

    if (!parsed) {
      return this.fallbackListingGeneration(input);
    }

    // Validate and fix category
    if (!categoryInfo.options.includes(parsed.category)) {
      parsed.category = this.findClosestCategory(parsed.category, categoryInfo.options, input.rawDescription);
    }

    // If we have image analysis, use its condition (more reliable than text-based detection)
    // Also merge features if image analysis detected additional ones
    if (imageAnalysis && input.listingType === 'tool') {
      // Override condition with image analysis (it's from actual photo inspection)
      parsed.condition = imageAnalysis.condition;

      // Merge features - add any unique features from image analysis
      const existingFeatures = new Set(parsed.features.map(f => f.toLowerCase()));
      for (const feature of imageAnalysis.features) {
        if (!existingFeatures.has(feature.toLowerCase())) {
          parsed.features.push(feature);
        }
      }
    }

    logger.info('AI generated listing', {
      listingType: input.listingType,
      category: parsed.category,
      promptVersion: PROMPT_VERSIONS.LISTING_GENERATION,
      hasImageAnalysis: !!imageAnalysis,
      imageCondition: imageAnalysis?.condition
    });

    return {
      ...parsed,
      promptVersion: PROMPT_VERSIONS.LISTING_GENERATION,
      modelUsed: env.GEMINI_MODEL,
      // Include image analysis results so frontend can display/use them
      ...(imageAnalysis && {
        imageAnalysis: {
          brand: imageAnalysis.brand,
          model: imageAnalysis.model,
          condition: imageAnalysis.condition,
          itemType: imageAnalysis.itemType,
          features: imageAnalysis.features,
          concerns: imageAnalysis.concerns,
          suggestedCategory: imageAnalysis.suggestedCategory,
          confidence: imageAnalysis.confidence,
        }
      }),
    };
  }

  // ============================================
  // 2. GENERATE REQUEST - Create job request from description
  // ============================================
  async generateRequest(input: {
    rawDescription: string;
    imageUrls?: string[];
    category: 'TOOLS' | 'EXPERTISE' | 'SPACE';
  }): Promise<{
    title: string;
    description: string;
    suggestedBudget: number;
    suggestedRateType: 'FIXED' | 'HOURLY' | 'DAILY';
    suggestedUrgency: 'ASAP' | 'TODAY' | 'THIS_WEEKEND' | 'FLEXIBLE';
    keywords: string[];
    promptVersion: string;
    modelUsed: string;
  } | null> {
    const categoryContext = {
      TOOLS: 'User needs to borrow or rent a tool/equipment for their automotive project',
      EXPERTISE: 'User needs help from a mechanic or specialist for a specific job',
      SPACE: 'User needs a workshop, garage, or space to work on their vehicle',
    };

    const systemInstruction = `You are a SpannerWork job request optimizer.

${PLATFORM_CONTEXT}

YOUR TASK: Transform casual user input into a clear, professional job request that will attract quality responses from tool owners, workshop providers, or service specialists.

CATEGORY: ${input.category}
CONTEXT: ${categoryContext[input.category]}

CRITICAL RULES:
1. FIX spelling and grammar - users type casually on mobile
2. Keep the title SPECIFIC - include make/model if mentioned
3. Keep descriptions CONCISE - what they need + any key details
4. Suggest a REALISTIC budget based on UK rates:
   - Tool rentals: £10-50/day for most tools
   - Diagnostic equipment: £25-75/day
   - Workshop space: £40-100/day
   - Mobile mechanic: £40-80/hour
   - Specialist work: £50-100/hour
5. Choose appropriate rate type (FIXED for one-off jobs, HOURLY for open-ended work, DAILY for tool/space rental)
6. Suggest urgency based on tone (mentions "urgent", "ASAP", "today" = urgent)

OUTPUT: Return ONLY valid JSON, no markdown or explanation.`;

    // FIX #8: Sanitize user input to prevent prompt injection
    const sanitizedDescription = sanitizePromptInput(input.rawDescription || '');
    const prompt = `Transform this into a professional SpannerWork job request:

USER'S INPUT: "${sanitizedDescription}"
CATEGORY: ${input.category}
${input.imageUrls?.length ? `PHOTOS: ${input.imageUrls.length} uploaded` : ''}

REQUIRED OUTPUT (JSON only):
{
  "title": "Clear, specific title max 80 chars",
  "description": "Concise description of what they need, 2-4 sentences",
  "suggestedBudget": integer_in_pence,
  "suggestedRateType": "FIXED|HOURLY|DAILY",
  "suggestedUrgency": "ASAP|TODAY|THIS_WEEKEND|FLEXIBLE",
  "keywords": ["5-8 search terms"]
}`;

    const result = await this.callAI(prompt, systemInstruction, 'request_generation');

    if (!result) {
      return this.fallbackRequestGeneration(input);
    }

    const parsed = this.safeParseJSON<{
      title: string;
      description: string;
      suggestedBudget: number;
      suggestedRateType: 'FIXED' | 'HOURLY' | 'DAILY';
      suggestedUrgency: 'ASAP' | 'TODAY' | 'THIS_WEEKEND' | 'FLEXIBLE';
      keywords: string[];
    }>(result);

    if (!parsed) {
      return this.fallbackRequestGeneration(input);
    }

    // Validate rate type
    const validRateTypes = ['FIXED', 'HOURLY', 'DAILY'];
    if (!validRateTypes.includes(parsed.suggestedRateType)) {
      parsed.suggestedRateType = 'HOURLY';
    }

    // Validate urgency
    const validUrgencies = ['ASAP', 'TODAY', 'THIS_WEEKEND', 'FLEXIBLE'];
    if (!validUrgencies.includes(parsed.suggestedUrgency)) {
      parsed.suggestedUrgency = 'FLEXIBLE';
    }

    logger.info('AI generated request', {
      category: input.category,
      promptVersion: PROMPT_VERSIONS.REQUEST_GENERATION
    });

    return {
      ...parsed,
      promptVersion: PROMPT_VERSIONS.REQUEST_GENERATION,
      modelUsed: env.GEMINI_MODEL,
    };
  }

  // ============================================
  // 3. OPTIMIZE REQUEST - Improve job posting
  // ============================================
  async optimizeRequest(title: string, description: string, category: string): Promise<{
    optimizedTitle: string;
    optimizedDescription: string;
    suggestedBudget: number;
    improvements: string[];
    promptVersion: string;
  } | null> {
    const systemInstruction = `You are a SpannerWork job posting optimizer.

${PLATFORM_CONTEXT}

YOUR TASK: Help users write better job requests that attract quality responses from tool owners and service providers.

OPTIMIZATION GOALS:
1. Make the title specific and searchable (include make/model if relevant)
2. Add missing details providers need (duration, location context, urgency)
3. Fix spelling/grammar while keeping the user's voice
4. Suggest a fair budget based on UK market rates
5. Identify what information is missing that providers would want`;

    const prompt = `Optimize this SpannerWork job request:

CURRENT TITLE: "${title}"
CURRENT DESCRIPTION: "${description}"
CATEGORY: ${category}

Return JSON only:
{
  "optimizedTitle": "Clearer, more specific title (max 80 chars)",
  "optimizedDescription": "Enhanced description with key details providers need",
  "suggestedBudget": estimated_fair_rate_in_pence,
  "improvements": ["List of 2-4 specific improvements made"]
}`;

    const result = await this.callAI(prompt, systemInstruction, 'request_optimization');

    if (!result) return null;

    const parsed = this.safeParseJSON<{
      optimizedTitle: string;
      optimizedDescription: string;
      suggestedBudget: number;
      improvements: string[];
    }>(result);

    if (!parsed) return null;

    return {
      ...parsed,
      promptVersion: PROMPT_VERSIONS.REQUEST_OPTIMIZATION,
    };
  }

  // ============================================
  // 3. IMPROVE LISTING - Enhance existing listing
  // ============================================
  async improveListing(currentListing: {
    title: string;
    description: string;
    category: string;
  }): Promise<{
    improvedTitle: string;
    improvedDescription: string;
    seoScore: number;
    suggestions: string[];
    promptVersion: string;
  } | null> {
    const systemInstruction = `You are a SpannerWork listing optimization expert.

${PLATFORM_CONTEXT}

YOUR TASK: Analyze an existing listing and provide improvements to increase visibility and bookings.

OPTIMIZATION FOCUS:
1. SEO: Include searchable keywords naturally
2. Clarity: Make it immediately clear what's being rented
3. Trust: Add details that build confidence (condition, what's included)
4. Conversion: Use benefit-focused language that motivates booking
5. Completeness: Identify missing information renters want`;

    const prompt = `Analyze and improve this SpannerWork listing:

CURRENT TITLE: "${currentListing.title}"
CURRENT DESCRIPTION: "${currentListing.description}"
CATEGORY: ${currentListing.category}

Return JSON only:
{
  "improvedTitle": "SEO-optimized title (max 60 chars)",
  "improvedDescription": "Enhanced description with better structure and selling points",
  "seoScore": 0-100_rating_of_listing_quality,
  "suggestions": ["3-5 specific actionable improvements"]
}`;

    const result = await this.callAI(prompt, systemInstruction, 'listing_improvement');

    if (!result) return null;

    const parsed = this.safeParseJSON<{
      improvedTitle: string;
      improvedDescription: string;
      seoScore: number;
      suggestions: string[];
    }>(result);

    if (!parsed) return null;

    return {
      ...parsed,
      promptVersion: PROMPT_VERSIONS.LISTING_IMPROVEMENT,
    };
  }

  // ============================================
  // 4. BUNDLE SUGGESTIONS - Cross-sell related items
  // ============================================
  async getBundleSuggestions(
    itemId: string,
    itemType: 'tool' | 'space' | 'service',
    itemName: string,
    itemCategory: string
  ): Promise<BundleSuggestion[]> {
    const cacheKey = prefixKey(`bundle:${itemType}:${itemId}`);
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const [tools, services] = await Promise.all([
      prisma.tool.findMany({
        where: { available: true, id: { not: itemType === 'tool' ? itemId : undefined } },
        take: 20,
        select: { id: true, name: true, category: true, dailyRate: true, description: true },
      }),
      prisma.service.findMany({
        where: { available: true, id: { not: itemType === 'service' ? itemId : undefined } },
        take: 15,
        select: { id: true, name: true, specialties: true, hourlyRate: true, description: true },
      }),
    ]);

    if (tools.length === 0 && services.length === 0) {
      return [];
    }

    const systemInstruction = `You are a SpannerWork bundle recommendation engine.

${PLATFORM_CONTEXT}

YOUR TASK: Suggest items commonly needed together for automotive DIY projects.

BUNDLE LOGIC:
- Think about complete jobs: "If they're renting X, they probably also need Y"
- Consider safety: jacks need axle stands, welders need PPE
- Think workflow: diagnostic scanner → relevant repair tools
- Workshop bundles: space rental + tools for the job`;

    const prompt = `A user is viewing: "${itemName}" (${itemCategory})

Available items to suggest:
TOOLS: ${tools.map(t => `${t.id}|${t.name}|${t.category}|£${t.dailyRate / 100}/day`).join('\n')}

SERVICES: ${services.map(s => `${s.id}|${s.name}|£${s.hourlyRate / 100}/hr`).join('\n')}

Return JSON array of 3 best complementary items:
[
  {"id": "item_id", "type": "tool|service", "name": "Item Name", "reason": "Why they need this too", "price": daily_rate_in_pence}
]`;

    const result = await this.callAI(prompt, systemInstruction, 'bundle_suggestions');

    if (!result) {
      return this.fallbackBundles(itemCategory, tools, services);
    }

    const suggestions = this.safeParseJSON<BundleSuggestion[]>(result);

    if (!suggestions || !Array.isArray(suggestions)) {
      return this.fallbackBundles(itemCategory, tools, services);
    }

    const validSuggestions = suggestions.slice(0, 3);
    await redis.setex(cacheKey, 21600, JSON.stringify(validSuggestions)); // 6 hours cache
    return validSuggestions;
  }

  // ============================================
  // 5. FIND MATCHES - Match request to providers
  // ============================================
  async findMatches(request: {
    title: string;
    description: string;
    category: string;
    budget: number;
    postcode: string;
    lat?: number;
    lng?: number;
    userId?: string;
  }): Promise<MatchResult[]> {
    const [tools, spaces, services] = await Promise.all([
      request.category === 'TOOLS' || request.category === 'ALL'
        ? prisma.tool.findMany({
            where: { available: true },
            include: { owner: { select: { id: true, name: true, rating: true, postcode: true, locationLat: true, locationLng: true } } },
            take: 20,
          })
        : [],
      request.category === 'SPACE' || request.category === 'ALL'
        ? prisma.space.findMany({
            where: { available: true },
            include: { owner: { select: { id: true, name: true, rating: true, postcode: true, locationLat: true, locationLng: true } } },
            take: 20,
          })
        : [],
      request.category === 'EXPERTISE' || request.category === 'ALL'
        ? prisma.service.findMany({
            where: { available: true },
            include: { provider: { select: { id: true, name: true, rating: true, postcode: true, locationLat: true, locationLng: true } } },
            take: 20,
          })
        : [],
    ]);

    if (tools.length === 0 && spaces.length === 0 && services.length === 0) {
      return [];
    }

    // Add distance calculations if coordinates available
    const listingsContext = [
      ...tools.map(t => ({
        id: t.id, type: 'tool' as const, name: t.name,
        description: t.description, category: t.category,
        dailyRate: t.dailyRate / 100, ownerRating: t.owner.rating,
        distance: this.calculateDistance(request.lat, request.lng, t.owner.locationLat, t.owner.locationLng),
      })),
      ...spaces.map(s => ({
        id: s.id, type: 'space' as const, name: s.name,
        description: s.description, dailyRate: s.dailyRate / 100,
        ownerRating: s.owner.rating,
        distance: this.calculateDistance(request.lat, request.lng, s.owner.locationLat, s.owner.locationLng),
      })),
      ...services.map(s => ({
        id: s.id, type: 'service' as const, name: s.name,
        description: s.description, specialties: s.specialties,
        hourlyRate: s.hourlyRate / 100, providerRating: s.provider.rating,
        distance: this.calculateDistance(request.lat, request.lng, s.provider.locationLat, s.provider.locationLng),
      })),
    ];

    const systemInstruction = `You are a SpannerWork matching engine.

${PLATFORM_CONTEXT}

YOUR TASK: Find the best matches between a job request and available listings.

Think step by step:
1. What is the user looking for? (summarize)
2. What are the key requirements?
3. For each listing, score:
   - Relevance (0-40): Does it solve their problem?
   - Quality (0-30): Provider rating, higher is better
   - Value (0-20): Price alignment with budget
   - Proximity (0-10): Closer is better (if distance provided)

Only return listings that genuinely match the request.`;

    const prompt = `Match this request to available listings:

REQUEST:
Title: ${request.title}
Description: ${request.description}
Budget: £${request.budget}
Category: ${request.category}
${request.postcode ? `Location: ${request.postcode}` : ''}

AVAILABLE:
${JSON.stringify(listingsContext, null, 2)}

Return JSON array of top 5 matches (only genuine matches, can be fewer):
[{"listingId": "id", "listingType": "tool|space|service", "matchScore": 0-100, "matchReason": "Why this matches"}]`;

    const result = await this.callAI(prompt, systemInstruction, 'matching');

    if (!result) {
      return this.fallbackMatching(request, listingsContext);
    }

    const matches = this.safeParseJSON<MatchResult[]>(result);

    if (!matches || !Array.isArray(matches)) {
      return this.fallbackMatching(request, listingsContext);
    }

    return matches.slice(0, 5);
  }

  // ============================================
  // 6. ANALYZE IMAGES - Extract details from photos
  // ============================================
  async analyzeListingImages(imageUrls: string[]): Promise<ImageAnalysisResult | null> {
    if (!this.hasGeminiKey || imageUrls.length === 0) {
      return null;
    }

    if (!env.AI_IMAGE_ANALYSIS_ENABLED) {
      logger.info('Image analysis disabled by feature flag');
      return null;
    }

    try {
      // Fetch images and convert to base64 (max 3 images)
      const imageContents: { data: string; mimeType: string }[] = [];

      for (const url of imageUrls.slice(0, 3)) {
        try {
          // SECURITY: Validate URL to prevent SSRF attacks
          const urlCheck = isUrlSafeForFetch(url);
          if (!urlCheck.safe) {
            logger.warn('Blocked unsafe URL in image analysis', { url, reason: urlCheck.reason });
            continue;
          }

          const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
          if (!response.ok) continue;

          const buffer = await response.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          const mimeType = response.headers.get('content-type') || 'image/jpeg';

          imageContents.push({ data: base64, mimeType });
        } catch (error) {
          logger.warn('Failed to fetch image for analysis', { url, error });
        }
      }

      if (imageContents.length === 0) {
        logger.warn('No images could be fetched for analysis');
        return null;
      }

      // Call Gemini Vision API
      const result = await this.callGemini(
        IMAGE_ANALYSIS_PROMPT,
        undefined,
        'image_analysis',
        imageContents
      );

      if (!result) {
        return null;
      }

      const parsed = this.safeParseJSON<ImageAnalysisResult>(result);

      if (!parsed) {
        return null;
      }

      logger.info('Image analysis completed', {
        imageCount: imageContents.length,
        itemType: parsed.itemType,
        confidence: parsed.confidence
      });

      return parsed;
    } catch (error) {
      logger.error('Image analysis error:', error);
      return null;
    }
  }

  // ============================================
  // 6b. ANALYZE SPACE IMAGES - Detect workshop equipment
  // ============================================
  async analyzeSpaceImages(imageUrls: string[]): Promise<ImageAnalysisResult | null> {
    if (!this.hasGeminiKey || imageUrls.length === 0) {
      return null;
    }

    if (!env.AI_IMAGE_ANALYSIS_ENABLED) {
      logger.info('Image analysis disabled by feature flag');
      return null;
    }

    const SPACE_ANALYSIS_PROMPT = `Analyze this workshop/garage space image for SpannerWork UK rental marketplace.

You are looking at photos of a workshop, garage, or space that someone wants to rent out for automotive work.

DETECT and list all visible EQUIPMENT and FEATURES. This is critical - renters need to know what's included.

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "itemType": "Type of space (e.g., 'Workshop Bay with 2-Post Lift', 'Full Workshop', 'Home Garage')",
  "brand": null,
  "model": null,
  "condition": "NEW|LIKE_NEW|GOOD|FAIR based on overall space condition, cleanliness, equipment state",
  "features": [
    "List ALL visible equipment and features - BE THOROUGH",
    "Examples: 2-Post Lift, 4-Post Lift, Scissor Lift, Inspection Pit",
    "Parts Washer, Bench Vice, Workbench, Air Compressor lines",
    "Welding equipment, Tyre Changer, Wheel Balancer",
    "Good lighting, Concrete floor, Roller door",
    "Power outlets, 3-phase power panel if visible"
  ],
  "concerns": ["Any issues - clutter, poor lighting, damaged floor, limited space, safety concerns"],
  "suggestedCategory": "Workshop Bay|Full Workshop|Storage Unit|Driveway|Parking Space|Other",
  "confidence": 0.0-1.0
}

IMPORTANT:
- List EVERY piece of equipment you can identify
- Note the number of bays if visible
- Mention lift type specifically (2-post, 4-post, scissor, none)
- Note floor type (concrete, gravel, etc.)
- Note if outdoor/indoor, covered/uncovered`;

    try {
      const imageContents: { data: string; mimeType: string }[] = [];

      for (const url of imageUrls.slice(0, 3)) {
        try {
          const urlCheck = isUrlSafeForFetch(url);
          if (!urlCheck.safe) {
            logger.warn('Blocked unsafe URL in space image analysis', { url, reason: urlCheck.reason });
            continue;
          }

          const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
          if (!response.ok) continue;

          const buffer = await response.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          const mimeType = response.headers.get('content-type') || 'image/jpeg';

          imageContents.push({ data: base64, mimeType });
        } catch (error) {
          logger.warn('Failed to fetch space image for analysis', { url, error });
        }
      }

      if (imageContents.length === 0) {
        logger.warn('No space images could be fetched for analysis');
        return null;
      }

      const result = await this.callGemini(
        SPACE_ANALYSIS_PROMPT,
        undefined,
        'image_analysis',
        imageContents
      );

      if (!result) {
        return null;
      }

      const parsed = this.safeParseJSON<ImageAnalysisResult>(result);

      if (!parsed) {
        return null;
      }

      logger.info('Space image analysis completed', {
        imageCount: imageContents.length,
        spaceType: parsed.itemType,
        equipmentCount: parsed.features.length,
        confidence: parsed.confidence
      });

      return parsed;
    } catch (error) {
      logger.error('Space image analysis error:', error);
      return null;
    }
  }

  // ============================================
  // 7. IMAGE RELEVANCE CHECK - Filter irrelevant images
  // ============================================

  /**
   * Local pre-filter for images before AI analysis
   * Checks basic validity without API calls
   */
  private preFilterImage(url: string): { valid: boolean; reason?: string } {
    // Check URL format
    if (!url || typeof url !== 'string') {
      return { valid: false, reason: 'Invalid URL' };
    }

    // Check for valid image extensions
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    const urlLower = url.toLowerCase().split('?')[0]; // Remove query params
    const hasValidExtension = validExtensions.some(ext => urlLower.endsWith(ext));

    // Also allow URLs without extensions (CDN URLs, etc) - they'll be validated by content-type
    if (!hasValidExtension && !url.includes('cloudinary') && !url.includes('amazonaws') && !url.includes('blob')) {
      // Be lenient - only reject obvious non-images
      const badExtensions = ['.pdf', '.doc', '.docx', '.txt', '.mp4', '.mp3', '.zip'];
      if (badExtensions.some(ext => urlLower.endsWith(ext))) {
        return { valid: false, reason: 'Not an image file' };
      }
    }

    return { valid: true };
  }

  /**
   * Generate cache key for image relevance
   */
  private getRelevanceCacheKey(url: string, title: string, description: string): string {
    // Use a hash of the context to keep keys short
    const contextHash = Buffer.from(`${title}|${description}`).toString('base64').substring(0, 20);
    const urlHash = Buffer.from(url).toString('base64').substring(0, 30);
    return prefixKey(`img_rel:${urlHash}:${contextHash}`);
  }

  /**
   * Filter images using SINGLE batched API call (cost-efficient)
   * Sends all images at once and gets relevance for each
   *
   * @param imageUrls - Array of image URLs to check
   * @param title - Listing title for context
   * @param description - Listing description for context
   * @param minConfidence - Minimum confidence threshold (default 0.6)
   * @returns Object with relevant URLs and detailed results
   */
  async filterRelevantImages(
    imageUrls: string[],
    title: string,
    description: string,
    minConfidence: number = 0.6
  ): Promise<{
    relevantUrls: string[];
    results: FilteredImageResult[];
    filteredCount: number;
  }> {
    // Early return if no images or AI disabled
    if (!imageUrls.length || !this.hasGeminiKey || !env.AI_IMAGE_ANALYSIS_ENABLED) {
      return {
        relevantUrls: imageUrls,
        results: imageUrls.map(url => ({ url, relevant: true, reason: 'AI check skipped' })),
        filteredCount: 0,
      };
    }

    const results: FilteredImageResult[] = [];
    const urlsToCheck: string[] = [];
    const urlIndexMap: Map<string, number> = new Map();

    // Step 1: Local pre-filter + check cache
    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];

      // Local pre-filter
      const preFilter = this.preFilterImage(url);
      if (!preFilter.valid) {
        results[i] = { url, relevant: false, reason: preFilter.reason };
        continue;
      }

      // Check cache
      const cacheKey = this.getRelevanceCacheKey(url, title, description);
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const cachedResult = JSON.parse(cached) as FilteredImageResult;
          results[i] = cachedResult;
          logger.debug('Image relevance cache hit', { url: url.substring(0, 50) });
          continue;
        }
      } catch {
        // Cache miss or error, continue to API check
      }

      // Need to check this URL
      urlsToCheck.push(url);
      urlIndexMap.set(url, i);
    }

    // Step 2: Batch API call for uncached images
    if (urlsToCheck.length > 0) {
      const batchResults = await this.batchCheckImageRelevance(urlsToCheck, title, description, minConfidence);

      // Map results back and cache them
      for (const result of batchResults) {
        const index = urlIndexMap.get(result.url);
        if (index !== undefined) {
          results[index] = result;

          // Cache the result (1 hour TTL)
          const cacheKey = this.getRelevanceCacheKey(result.url, title, description);
          try {
            await redis.setex(cacheKey, 3600, JSON.stringify(result));
          } catch {
            // Cache write failed, not critical
          }
        }
      }
    }

    // Step 3: Extract relevant URLs (maintaining original order)
    const relevantUrls: string[] = [];
    for (let i = 0; i < imageUrls.length; i++) {
      if (results[i]?.relevant) {
        relevantUrls.push(imageUrls[i]);
      }
    }

    const filteredCount = imageUrls.length - relevantUrls.length;

    if (filteredCount > 0) {
      logger.info('Filtered irrelevant images', {
        total: imageUrls.length,
        relevant: relevantUrls.length,
        filtered: filteredCount,
        cached: imageUrls.length - urlsToCheck.length,
        title: title.substring(0, 30),
      });
    }

    return { relevantUrls, results, filteredCount };
  }

  /**
   * Batch check multiple images in SINGLE API call
   * Much more cost-effective than individual calls
   */
  private async batchCheckImageRelevance(
    imageUrls: string[],
    title: string,
    description: string,
    minConfidence: number
  ): Promise<FilteredImageResult[]> {
    const results: FilteredImageResult[] = [];

    // Fetch all images in parallel
    const imageContents: { url: string; data: string; mimeType: string }[] = [];

    await Promise.all(imageUrls.map(async (url) => {
      try {
        // SECURITY: Validate URL to prevent SSRF attacks
        const urlCheck = isUrlSafeForFetch(url);
        if (!urlCheck.safe) {
          logger.warn('Blocked unsafe URL in batch image check', { url, reason: urlCheck.reason });
          results.push({ url, relevant: false, reason: `URL blocked: ${urlCheck.reason}` });
          return;
        }

        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) {
          results.push({ url, relevant: true, reason: 'Failed to fetch - included by default' });
          return;
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) {
          results.push({ url, relevant: false, reason: 'Not an image file' });
          return;
        }

        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        imageContents.push({ url, data: base64, mimeType: contentType });
      } catch (error) {
        results.push({ url, relevant: true, reason: 'Fetch error - included by default' });
      }
    }));

    if (imageContents.length === 0) {
      return results;
    }

    // Build single prompt for all images
    const prompt = `You are checking if images are RELEVANT to a rental listing.

LISTING:
Title: "${title}"
Description: "${description}"

I'm showing you ${imageContents.length} image(s). For EACH image, determine if it's relevant to this listing.

RELEVANT = Shows the actual item being listed, accessories, or the item in use
NOT RELEVANT = Random photos, pets, selfies, screenshots, wrong items, blurry/unidentifiable

Return a JSON array with one object per image, in the SAME ORDER as shown:
[
  {"index": 0, "isRelevant": true/false, "confidence": 0.0-1.0, "reason": "brief explanation", "detectedContent": "what the image shows"}
]

IMPORTANT: Return EXACTLY ${imageContents.length} results in the array, one for each image.`;

    // Call Gemini with all images at once
    const geminiImages = imageContents.map(img => ({ data: img.data, mimeType: img.mimeType }));

    const response = await this.callGemini(prompt, undefined, 'image_relevance', geminiImages);

    if (!response) {
      // API failed - fail open, include all images
      for (const img of imageContents) {
        results.push({ url: img.url, relevant: true, reason: 'AI check failed - included by default' });
      }
      return results;
    }

    // Parse batch response
    const parsed = this.safeParseJSON<Array<{
      index: number;
      isRelevant: boolean;
      confidence: number;
      reason: string;
      detectedContent: string;
    }>>(response);

    if (!parsed || !Array.isArray(parsed)) {
      // Parse failed - fail open
      for (const img of imageContents) {
        results.push({ url: img.url, relevant: true, reason: 'Parse failed - included by default' });
      }
      return results;
    }

    // Map parsed results back to URLs
    for (let i = 0; i < imageContents.length; i++) {
      const img = imageContents[i];
      const aiResult = parsed.find(r => r.index === i) || parsed[i];

      if (aiResult) {
        const isRelevant = aiResult.isRelevant && aiResult.confidence >= minConfidence;
        results.push({
          url: img.url,
          relevant: isRelevant,
          reason: aiResult.reason,
          detectedContent: aiResult.detectedContent,
        });
      } else {
        results.push({ url: img.url, relevant: true, reason: 'No AI result - included by default' });
      }
    }

    logger.info('Batch image relevance check completed', {
      imageCount: imageContents.length,
      relevant: results.filter(r => r.relevant).length,
      apiCalls: 1, // Single API call for all images!
    });

    return results;
  }

  // ============================================
  // 8. SUGGEST CATEGORY FIELDS - Auto-fill specialties/features
  // ============================================
  async suggestCategoryFields(input: {
    description: string;
    listingType: 'service' | 'space';
  }): Promise<{
    suggestedSpecialties?: string[];
    suggestedFeatures?: string[];
    suggestedCondition?: string;
    confidence: number;
    promptVersion: string;
  } | null> {
    // Define valid options based on listing type
    const serviceSpecialties = [
      'General Repairs', 'Diagnostics', 'Electrical', 'Engine Work', 'Gearbox',
      'Brakes', 'Suspension', 'Air Con', 'MOT Prep', 'Welding',
      'ECU Tuning', 'Classic Cars', 'Performance', 'Commercial'
    ];

    const spaceFeatures = [
      '2-Post Lift', '4-Post Lift', 'Inspection Pit', 'Air Compressor',
      'Power Supply', 'WiFi', 'Parking', '24/7 Access', 'Tool Storage', 'Waiting Area'
    ];

    const validOptions = input.listingType === 'service' ? serviceSpecialties : spaceFeatures;
    const fieldName = input.listingType === 'service' ? 'specialties' : 'features';

    const systemInstruction = `You are a SpannerWork category assistant.

${PLATFORM_CONTEXT}

YOUR TASK: Analyze the description and identify which ${fieldName} apply.

VALID OPTIONS (only use these exact values):
${JSON.stringify(validOptions)}

RULES:
1. Only suggest items that are explicitly or strongly implied in the description
2. Be conservative - only suggest when confident
3. Return an empty array if nothing matches
4. Look for synonyms and related terms (e.g., "MOT work" = "MOT Prep")`;

    const prompt = `Analyze this listing description and suggest applicable ${fieldName}:

DESCRIPTION: "${input.description}"
TYPE: ${input.listingType}

Return JSON only:
{
  "${fieldName}": ["Array of matching options from the valid list"],
  "confidence": 0.0-1.0
}`;

    const result = await this.callAI(prompt, systemInstruction, 'category_suggestion');

    if (!result) {
      return null;
    }

    const parsed = this.safeParseJSON<{
      specialties?: string[];
      features?: string[];
      confidence: number;
    }>(result);

    if (!parsed) {
      return null;
    }

    // Validate that returned items are in the valid list
    const suggestions = input.listingType === 'service'
      ? parsed.specialties?.filter(s => serviceSpecialties.includes(s)) || []
      : parsed.features?.filter(f => spaceFeatures.includes(f)) || [];

    // Also detect condition from text for tools (useful for frontend)
    const conditionKeywords: Record<string, string[]> = {
      'NEW': ['brand new', 'sealed', 'unopened', 'never used', 'still in box', 'bnib'],
      'LIKE_NEW': ['barely used', 'mint', 'excellent', 'pristine', 'like new', 'hardly used', 'as new'],
      'GOOD': ['good condition', 'works well', 'normal wear', 'good working order', 'works perfectly'],
      'FAIR': ['fair condition', 'some wear', 'cosmetic damage', 'used but works', 'working condition'],
      'POOR': ['heavy wear', 'needs repair', 'well used', 'worn', 'needs work']
    };

    let suggestedCondition: string | undefined;
    const descLower = input.description.toLowerCase();
    for (const [condition, keywords] of Object.entries(conditionKeywords)) {
      if (keywords.some(kw => descLower.includes(kw))) {
        suggestedCondition = condition;
        break;
      }
    }

    logger.info('AI suggested category fields', {
      listingType: input.listingType,
      suggestionsCount: suggestions.length,
      confidence: parsed.confidence,
      suggestedCondition
    });

    return {
      suggestedSpecialties: input.listingType === 'service' ? suggestions : undefined,
      suggestedFeatures: input.listingType === 'space' ? suggestions : undefined,
      suggestedCondition,
      confidence: parsed.confidence || 0.5,
      promptVersion: PROMPT_VERSIONS.CATEGORY_SUGGESTION,
    };
  }

  // ============================================
  // 10. CONTENT MODERATION - Check for policy violations
  // ============================================
  async moderateContent(input: {
    title: string;
    description: string;
    category: string;
    listingType: 'tool' | 'space' | 'service' | 'request';
  }): Promise<{
    approved: boolean;
    riskScore: number;
    violations: Array<{
      type: string;
      severity: 'BLOCK' | 'WARN' | 'FLAG';
      detail: string;
    }>;
    warnings: string[];
    reasoning: string;
    promptVersion: string;
    requiresManualReview?: boolean; // FIX #14: Added for fail-closed behavior
  } | null> {
    const systemInstruction = `You are a content moderator for SpannerWork, a UK automotive tool/space/service rental marketplace.

${PLATFORM_CONTEXT}

YOUR TASK: Check listings for policy violations before they go live.

VIOLATION TYPES TO CHECK:
1. ILLEGAL_ITEM: Stolen goods references, unlicensed services, prohibited items
2. DANGEROUS: Unsafe equipment without proper warnings, hazardous materials
3. DISCRIMINATORY: Discriminatory language or targeting specific groups
4. SPAM: Keyword stuffing, misleading claims, excessive caps/symbols
5. PERSONAL_INFO: Phone numbers, email addresses, home addresses in description
6. OFF_PLATFORM_PAYMENT: Requests for WhatsApp, direct bank transfer, cash only, "avoid fees"
7. SCAM: Unrealistic pricing (£1/day for expensive equipment), suspicious urgency
8. ABUSE: Profanity, hate speech, harassment
9. COMMERCIAL_SPAM: Business advertising disguised as peer-to-peer rental

SEVERITY LEVELS:
- BLOCK: Must not be published (illegal, scam, severe abuse)
- WARN: Show warning but allow (mild language, minor issues)
- FLAG: Flag for manual review (borderline cases)

CONTEXT:
- This is a peer-to-peer marketplace for automotive DIY community
- Users should communicate through the platform for safety
- Mild colloquial language is OK ("bloody good drill")
- Technical automotive terms are fine
- For job REQUESTS: users are looking for tools/services/space - different context than listings`;

    const prompt = `Moderate this SpannerWork listing:

TITLE: "${input.title}"
DESCRIPTION: "${input.description}"
CATEGORY: ${input.category}
TYPE: ${input.listingType}

Return JSON only:
{
  "approved": true/false,
  "riskScore": 0-100,
  "violations": [{"type": "VIOLATION_TYPE", "severity": "BLOCK|WARN|FLAG", "detail": "explanation"}],
  "warnings": ["Non-blocking suggestions"],
  "reasoning": "Brief explanation of decision"
}`;

    const result = await this.callAI(prompt, systemInstruction, 'content_moderation');

    if (!result) {
      // FIX #14: Fail CLOSED instead of open - require manual review if AI fails
      // This prevents attackers from bypassing moderation by causing AI failures
      logger.warn('Content moderation AI failed - requiring manual review');
      return {
        approved: false,
        riskScore: 50, // Medium risk - needs review
        violations: [],
        warnings: ['Content moderation unavailable - manual review required before approval'],
        reasoning: 'AI moderation failed - flagged for manual review (fail-closed policy)',
        promptVersion: PROMPT_VERSIONS.CONTENT_MODERATION,
        requiresManualReview: true,
      };
    }

    const parsed = this.safeParseJSON<{
      approved: boolean;
      riskScore: number;
      violations: Array<{
        type: string;
        severity: 'BLOCK' | 'WARN' | 'FLAG';
        detail: string;
      }>;
      warnings: string[];
      reasoning: string;
    }>(result);

    if (!parsed) {
      return {
        approved: true,
        riskScore: 0,
        violations: [],
        warnings: ['Content moderation parse failed - manual review may be required'],
        reasoning: 'AI moderation parse failed - approved by default',
        promptVersion: PROMPT_VERSIONS.CONTENT_MODERATION,
      };
    }

    // Determine approval based on violations
    const hasBlockingViolation = parsed.violations?.some(v => v.severity === 'BLOCK');

    logger.info('Content moderation completed', {
      listingType: input.listingType,
      approved: !hasBlockingViolation && parsed.approved,
      riskScore: parsed.riskScore,
      violationsCount: parsed.violations?.length || 0
    });

    return {
      approved: !hasBlockingViolation && parsed.approved,
      riskScore: parsed.riskScore || 0,
      violations: parsed.violations || [],
      warnings: parsed.warnings || [],
      reasoning: parsed.reasoning || '',
      promptVersion: PROMPT_VERSIONS.CONTENT_MODERATION,
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(
    lat1?: number | null,
    lng1?: number | null,
    lat2?: number | null,
    lng2?: number | null
  ): number | null {
    if (!lat1 || !lng1 || !lat2 || !lng2) return null;

    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10; // Round to 1 decimal place
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private getCategoryInfo(listingType: 'tool' | 'space' | 'service'): {
    options: string[];
    guidance: string;
  } {
    if (listingType === 'tool') {
      return {
        options: ['Diagnostics', 'Lifting Equipment', 'Power Tools', 'Hand Tools', 'Welding', 'Air Tools', 'Specialist Tools', 'Other'],
        guidance: `
- Diagnostics: OBD scanners, code readers, multimeters, oscilloscopes, battery testers
- Lifting Equipment: Trolley jacks, bottle jacks, axle stands, engine hoists, transmission jacks, vehicle dollies
- Power Tools: Drills, impact wrenches, angle grinders, sanders, polishers (electric/cordless)
- Hand Tools: Socket sets, spanners, screwdrivers, pliers, torque wrenches, breaker bars
- Welding: MIG welders, TIG welders, stick welders, plasma cutters, welding masks
- Air Tools: Air impact guns, air ratchets, spray guns, air compressors, blow guns
- Specialist Tools: Timing tools, bearing pullers, spring compressors, ball joint tools, brake bleeders
- Other: Only if nothing else fits`,
      };
    } else if (listingType === 'space') {
      return {
        options: ['Workshop Bay', 'Full Workshop', 'Storage Unit', 'Driveway', 'Parking Space', 'Other'],
        guidance: `
- Workshop Bay: Single bay in a shared workshop, may include lift access
- Full Workshop: Complete workshop rental with multiple bays/equipment
- Storage Unit: Secure storage for vehicles or parts
- Driveway: Private driveway for working on vehicles
- Parking Space: Basic parking, may allow light work

IMPORTANT FOR SPACES: Include available EQUIPMENT in features. Renters need to know what's included.
Common workshop equipment to look for/mention:
- LIFTING: 2-Post Lift, 4-Post Lift, Scissor Lift, Inspection Pit, Engine Crane
- EQUIPMENT: Parts Washer, Bench Vice, Workbench, Air Compressor, Welding Bay, Tyre Changer, Wheel Balancer, Brake Lathe, Oil Drain, Extraction Fan, Pressure Washer
- UTILITIES: 3-Phase Power, Good Lighting, Heating, WiFi, Water Supply, Toilet
- ACCESS: 24/7 Access, Parking, Tool Storage, Waiting Area`,
      };
    } else {
      return {
        options: ['Mobile Mechanic', 'Diagnostics Specialist', 'Bodywork', 'Electrical', 'Welding & Fabrication', 'General Servicing', 'Other'],
        guidance: `
- Mobile Mechanic: Comes to customer, general repairs and servicing
- Diagnostics Specialist: Expert in fault-finding and ECU work
- Bodywork: Dent repair, painting, panel work
- Electrical: Auto electrician, wiring, lighting, accessories
- Welding & Fabrication: Exhaust repairs, custom fabrication
- General Servicing: Oil changes, brakes, filters, basic maintenance`,
      };
    }
  }

  private findClosestCategory(aiCategory: string, validCategories: string[], rawInput: string): string {
    const normalized = aiCategory.toLowerCase();
    const inputLower = rawInput.toLowerCase();

    // Direct match
    for (const cat of validCategories) {
      if (cat.toLowerCase() === normalized) return cat;
    }

    // Keyword detection from input
    const keywordMap: Record<string, string> = {
      // Power Tools
      'drill': 'Power Tools', 'grinder': 'Power Tools', 'sander': 'Power Tools',
      'polisher': 'Power Tools', 'impact wrench': 'Power Tools', 'dewalt': 'Power Tools',
      'makita': 'Power Tools', 'milwaukee': 'Power Tools', 'bosch': 'Power Tools',
      // Diagnostics
      'scanner': 'Diagnostics', 'obd': 'Diagnostics', 'diagnostic': 'Diagnostics',
      'code reader': 'Diagnostics', 'multimeter': 'Diagnostics', 'autel': 'Diagnostics',
      'snap-on': 'Diagnostics', 'launch': 'Diagnostics',
      // Lifting
      'jack': 'Lifting Equipment', 'hoist': 'Lifting Equipment', 'lift': 'Lifting Equipment',
      'axle stand': 'Lifting Equipment', 'ramp': 'Lifting Equipment', 'dolly': 'Lifting Equipment',
      // Welding
      'welder': 'Welding', 'mig': 'Welding', 'tig': 'Welding', 'plasma': 'Welding',
      'welding': 'Welding', 'sip': 'Welding',
      // Hand Tools
      'socket': 'Hand Tools', 'spanner': 'Hand Tools', 'wrench': 'Hand Tools',
      'screwdriver': 'Hand Tools', 'torque': 'Hand Tools', 'ratchet': 'Hand Tools',
      // Air Tools
      'air gun': 'Air Tools', 'pneumatic': 'Air Tools', 'compressor': 'Air Tools',
      'air ratchet': 'Air Tools', 'spray gun': 'Air Tools',
      // Specialist
      'timing': 'Specialist Tools', 'bearing': 'Specialist Tools', 'puller': 'Specialist Tools',
      'spring compressor': 'Specialist Tools', 'ball joint': 'Specialist Tools',
      'brake bleeder': 'Specialist Tools', 'camshaft': 'Specialist Tools',
    };

    for (const [keyword, category] of Object.entries(keywordMap)) {
      if (inputLower.includes(keyword) && validCategories.includes(category)) {
        return category;
      }
    }

    return validCategories.includes('Other') ? 'Other' : validCategories[0];
  }

  private fallbackListingGeneration(input: {
    rawDescription: string;
    listingType: 'tool' | 'space' | 'service';
  }) {
    const words = input.rawDescription.split(/\s+/).slice(0, 8);
    const title = words.join(' ').substring(0, 60) || 'Item for Rent';

    return {
      title,
      description: input.rawDescription,
      category: 'Other',
      features: ['Available for rent', 'Collection available'],
      suggestedDailyRate: 2500,
      suggestedDeposit: 5000,
      condition: input.listingType === 'tool' ? 'GOOD' : undefined,
      keywords: words.slice(0, 5),
      promptVersion: 'fallback',
      modelUsed: 'none',
    };
  }

  private fallbackRequestGeneration(input: {
    rawDescription: string;
    category: 'TOOLS' | 'EXPERTISE' | 'SPACE';
  }) {
    const words = input.rawDescription.split(/\s+/).slice(0, 10);
    const title = words.join(' ').substring(0, 80) || 'Job Request';

    // Default budgets by category (in pence)
    const budgetDefaults: Record<string, number> = {
      TOOLS: 2500,      // £25/day
      EXPERTISE: 5000,  // £50/hour
      SPACE: 6000,      // £60/day
    };

    const rateDefaults: Record<string, 'FIXED' | 'HOURLY' | 'DAILY'> = {
      TOOLS: 'DAILY',
      EXPERTISE: 'HOURLY',
      SPACE: 'DAILY',
    };

    return {
      title,
      description: input.rawDescription,
      suggestedBudget: budgetDefaults[input.category] || 5000,
      suggestedRateType: rateDefaults[input.category] || 'HOURLY',
      suggestedUrgency: 'FLEXIBLE' as const,
      keywords: words.slice(0, 5),
      promptVersion: 'fallback',
      modelUsed: 'none',
    };
  }

  private fallbackBundles(
    category: string,
    tools: Array<{ id: string; name: string; category: string; dailyRate: number }>,
    services: Array<{ id: string; name: string; hourlyRate: number }>
  ): BundleSuggestion[] {
    const suggestions: BundleSuggestion[] = [];

    const relatedTools = tools.filter(t => t.category === category).slice(0, 2);
    for (const tool of relatedTools) {
      suggestions.push({
        id: tool.id,
        type: 'tool',
        name: tool.name,
        reason: 'Often rented together',
        price: tool.dailyRate,
      });
    }

    if (services.length > 0) {
      suggestions.push({
        id: services[0].id,
        type: 'service',
        name: services[0].name,
        reason: 'Need help with the job?',
        price: services[0].hourlyRate,
      });
    }

    return suggestions.slice(0, 3);
  }

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
          matchReason: score > 50 ? 'Matches your requirements' : 'Related listing',
        };
      })
      .filter(m => m.matchScore > 20)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);
  }
}

export const aiService = new AIService();
