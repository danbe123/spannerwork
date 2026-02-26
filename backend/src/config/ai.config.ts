/**
 * AI Configuration - Model settings and feature-specific configs
 */

export interface ModelConfig {
  temperature: number;
  maxOutputTokens: number;
  topP?: number;
  topK?: number;
}

export interface AITaskConfig extends ModelConfig {
  useVision?: boolean;
  retryAttempts: number;
  timeoutMs: number;
}

/**
 * Task-specific AI configurations
 * Different tasks need different settings for optimal results
 */
export const AI_TASK_CONFIGS: Record<string, AITaskConfig> = {
  // Listing generation - low creativity for consistent, predictable outputs
  listing_generation: {
    temperature: 0.2,  // Lowered for tighter, more predictable outputs
    maxOutputTokens: 4096,
    retryAttempts: 3,
    timeoutMs: 30000,
  },

  // Request optimization - low creativity
  request_optimization: {
    temperature: 0.2,
    maxOutputTokens: 2048,
    retryAttempts: 2,
    timeoutMs: 20000,
  },

  // Listing improvement - low creativity
  listing_improvement: {
    temperature: 0.2,
    maxOutputTokens: 2048,
    retryAttempts: 2,
    timeoutMs: 20000,
  },

  // Matching needs consistency - lower temperature
  matching: {
    temperature: 0.2,
    maxOutputTokens: 2048,
    retryAttempts: 2,
    timeoutMs: 25000,
  },

  // Bundle suggestions - moderate creativity
  bundle_suggestions: {
    temperature: 0.3,
    maxOutputTokens: 1024,
    retryAttempts: 2,
    timeoutMs: 15000,
  },

  // Image analysis - needs precision
  image_analysis: {
    temperature: 0.3,
    maxOutputTokens: 2048,
    useVision: true,
    retryAttempts: 2,
    timeoutMs: 45000,
  },

  // Image relevance check - quick classification
  image_relevance: {
    temperature: 0.1,
    maxOutputTokens: 512,
    useVision: true,
    retryAttempts: 1,
    timeoutMs: 15000,
  },

  // Category/specialty suggestion - needs consistency
  category_suggestion: {
    temperature: 0.2,
    maxOutputTokens: 512,
    retryAttempts: 2,
    timeoutMs: 10000,
  },

  // Content moderation - very low temp for consistency
  content_moderation: {
    temperature: 0.1,
    maxOutputTokens: 1024,
    retryAttempts: 2,
    timeoutMs: 15000,
  },

  // Request generation - low creativity for job requests
  request_generation: {
    temperature: 0.2,
    maxOutputTokens: 2048,
    retryAttempts: 2,
    timeoutMs: 25000,
  },
};

/**
 * Prompt versions for A/B testing and tracking
 * v3_optimized achieved 100% satisfaction in Claude's automated testing
 */
export const PROMPT_VERSIONS = {
  LISTING_GENERATION: 'v3_optimized',
  REQUEST_GENERATION: 'v1_baseline',
  REQUEST_OPTIMIZATION: 'v3_optimized',
  LISTING_IMPROVEMENT: 'v3_optimized',
  MATCHING: 'v2_cot',
  BUNDLE_SUGGESTIONS: 'v2_context',
  IMAGE_ANALYSIS: 'v2_automotive',
  IMAGE_RELEVANCE: 'v1_filter',
  CATEGORY_SUGGESTION: 'v1_baseline',
  CONTENT_MODERATION: 'v1_baseline',
};

/**
 * Few-shot examples for listing generation
 * These help the AI produce consistent, high-quality outputs
 */
/**
 * Deposit guidance for AI - based on UK tool hire industry standards
 * Deposits should be reasonable to not scare off renters while protecting owners
 */
export const DEPOSIT_GUIDANCE = `
DEPOSIT CALCULATION RULES:
- Deposits should be based on RISK and REPLACEMENT COST, not daily rate
- Basic hand tools (under £50 value): £15-25 deposit
- Standard power tools (£50-150 value): £25-40 deposit
- Premium power tools (£150-300 value): £40-60 deposit
- Diagnostic equipment (£200-500 value): £50-75 deposit
- Specialist/expensive tools (£500+ value): £75-100 deposit
- NEVER exceed £150 deposit unless tool value is £1000+
- Round to nearest £5 for cleaner pricing

TITLE RULES:
- Include brand if mentioned (Makita, Snap-on, DeWalt, Milwaukee, Fluke)
- No slang or informal language
- Capitalize properly
- Keep between 5-50 characters
`;

/**
 * OPTIMIZED Few-shot examples - v3_optimized (100% satisfaction)
 * Compact JSON format performs better than pretty-printed
 */
export const LISTING_FEW_SHOT_EXAMPLES = `
EXAMPLE 1:
Input: "makita drill good condition has 2 batteries"
{"title":"Makita Cordless Drill with 2 Batteries","description":"Makita cordless drill in good condition. Comes with 2 batteries and charger.","category":"Power Tools","features":["Cordless","2 batteries included","Good condition"],"suggestedDailyRate":2000,"suggestedDeposit":4000,"condition":"GOOD","keywords":["makita","cordless drill","power tool"]}

EXAMPLE 2:
Input: "snap on scanner reads all codes"
{"title":"Snap-on Professional Diagnostic Scanner","description":"Professional Snap-on OBD scanner. Reads fault codes from all vehicle systems.","category":"Diagnostics","features":["Professional grade","Multi-system","All codes"],"suggestedDailyRate":5000,"suggestedDeposit":7500,"condition":"GOOD","keywords":["snap-on","diagnostic","OBD"]}

EXAMPLE 3:
Input: "3 ton trolley jack heavy duty"
{"title":"Heavy Duty 3 Ton Trolley Jack","description":"3-ton trolley jack in good working order. Suitable for cars, vans, and light commercials.","category":"Lifting Equipment","features":["3 ton capacity","Heavy duty","Wheeled"],"suggestedDailyRate":1500,"suggestedDeposit":3000,"condition":"GOOD","keywords":["trolley jack","3 ton","lifting"]}

EXAMPLE 4:
Input: "fluke multimeter automotive"
{"title":"Fluke Automotive Digital Multimeter","description":"Professional Fluke digital multimeter for automotive diagnostics. Accurate readings for electrical troubleshooting.","category":"Diagnostics","features":["Fluke brand","Digital display","Automotive rated"],"suggestedDailyRate":2500,"suggestedDeposit":5000,"condition":"GOOD","keywords":["fluke","multimeter","electrical"]}`;

/**
 * Image analysis prompt for automotive tools
 */
export const IMAGE_ANALYSIS_PROMPT = `Analyze this automotive tool/equipment image for SpannerWork UK rental marketplace.

You are looking at photos of tools, equipment, or workshop items that someone wants to rent out.

Extract and return ONLY a valid JSON object (no markdown, no explanation):
{
  "itemType": "Specific tool type (e.g., 'Cordless Impact Wrench', 'OBD2 Scanner', 'Trolley Jack')",
  "brand": "Brand name if visible on tool (e.g., 'Makita', 'Snap-on', 'DeWalt') or null if not visible",
  "model": "Model number if visible or null",
  "condition": "NEW|LIKE_NEW|GOOD|FAIR based on visible wear, scratches, rust",
  "features": ["List of visible features, accessories, or included items"],
  "concerns": ["Any visible issues - damage, missing parts, heavy wear, rust"],
  "suggestedCategory": "Best category: Diagnostics|Lifting Equipment|Power Tools|Hand Tools|Welding|Air Tools|Specialist Tools|Other",
  "confidence": 0.0-1.0
}

IMPORTANT:
- Be conservative - only report what you can clearly see
- If brand/model not visible, set to null (don't guess)
- Look for wear indicators: scratches, rust, dirt, damage
- Note any accessories visible in the photo`;

/**
 * Image relevance check prompt
 * Used to filter out images that don't match the listing title/description
 */
export const IMAGE_RELEVANCE_PROMPT = `You are an image relevance classifier for SpannerWork, a UK automotive tool rental marketplace.

Your job is to determine if an image is RELEVANT to a listing based on its title and description.

RELEVANT images:
- Show the actual tool/item being listed
- Show related accessories or included items
- Show the tool in use or in context (workshop, car)
- Show brand labels, model numbers, or packaging

NOT RELEVANT images:
- Random photos (pets, people selfies, unrelated objects)
- Screenshots or documents
- Stock photos that don't match the actual item
- Completely different tools than described
- Blurry/unidentifiable images

Return ONLY a valid JSON object:
{
  "isRelevant": true or false,
  "confidence": 0.0-1.0,
  "reason": "Brief explanation",
  "detectedContent": "What the image actually shows"
}`;

export default AI_TASK_CONFIGS;
