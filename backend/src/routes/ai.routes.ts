import { Router, Request, Response, NextFunction } from 'express';
import { aiService } from '../services/ai.service.js';
import { aiFeedbackService } from '../services/ai-feedback.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';
import crypto from 'crypto';

const router = Router();

/**
 * @swagger
 * /ai/match:
 *   post:
 *     summary: Get AI-powered matches for a request
 *     tags: [AI]
 *     security:
 *       - sessionAuth: []
 */
router.post('/match', requireAuth, verifyCsrfToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, category, budget, postcode, lat, lng, sessionId } = req.body;

    if (!title || !description || !category) {
      res.status(400).json({ error: 'Missing required fields: title, description, category' });
      return;
    }

    const startTime = Date.now();

    const matches = await aiService.findMatches({
      title,
      description,
      category,
      budget: budget || 0,
      postcode: postcode || '',
      lat,
      lng,
      userId: req.user!.id,
    });

    const latencyMs = Date.now() - startTime;

    // Track feedback
    const feedbackId = await aiFeedbackService.trackGeneration({
      userId: req.user!.id,
      sessionId: sessionId || crypto.randomUUID(),
      featureType: 'MATCHING',
      inputData: { title, description, category, budget, postcode },
      outputData: { matches },
      promptVersion: 'v2_cot',
      modelUsed: 'gemini-3-flash-preview',
      latencyMs,
    });

    res.json({ matches, feedbackId });
    return;
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /ai/bundles/{listingId}:
 *   get:
 *     summary: Get bundle suggestions for a listing
 *     tags: [AI]
 */
router.get('/bundles/:listingType/:listingId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { listingType, listingId } = req.params;
    const { name, category } = req.query;

    if (!['tool', 'space', 'service'].includes(listingType)) {
      res.status(400).json({ error: 'Invalid listing type' });
      return;
    }

    const suggestions = await aiService.getBundleSuggestions(
      listingId,
      listingType as 'tool' | 'space' | 'service',
      (name as string) || '',
      (category as string) || ''
    );

    res.json({ suggestions });
    return;
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /ai/optimize-request:
 *   post:
 *     summary: Optimize a request title and description
 *     tags: [AI]
 */
router.post('/optimize-request', requireAuth, verifyCsrfToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, category, sessionId } = req.body;

    if (!title || !description || !category) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const startTime = Date.now();
    const optimized = await aiService.optimizeRequest(title, description, category);
    const latencyMs = Date.now() - startTime;

    if (!optimized) {
      res.json({
        optimizedTitle: title,
        optimizedDescription: description,
        suggestedBudget: null,
      });
      return;
    }

    // Track feedback
    const feedbackId = await aiFeedbackService.trackGeneration({
      userId: req.user!.id,
      sessionId: sessionId || crypto.randomUUID(),
      featureType: 'REQUEST_OPTIMIZATION',
      inputData: { title, description, category },
      outputData: optimized,
      promptVersion: optimized.promptVersion,
      modelUsed: 'gemini-3-flash-preview',
      latencyMs,
    });

    res.json({ ...optimized, feedbackId });
    return;
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /ai/generate-listing:
 *   post:
 *     summary: Generate optimized listing from raw input
 *     tags: [AI]
 *     security:
 *       - sessionAuth: []
 */
router.post('/generate-listing', requireAuth, verifyCsrfToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rawDescription, imageUrls, listingType, sessionId } = req.body;

    if (!rawDescription || !listingType) {
      res.status(400).json({ error: 'Missing required fields: rawDescription, listingType' });
      return;
    }

    if (!['tool', 'space', 'service'].includes(listingType)) {
      res.status(400).json({ error: 'Invalid listingType. Must be tool, space, or service.' });
      return;
    }

    const startTime = Date.now();

    const listing = await aiService.generateListing({
      rawDescription,
      imageUrls: imageUrls || [],
      listingType,
    });

    const latencyMs = Date.now() - startTime;

    if (!listing) {
      res.status(500).json({ error: 'Failed to generate listing' });
      return;
    }

    // Track feedback
    const feedbackId = await aiFeedbackService.trackGeneration({
      userId: req.user!.id,
      sessionId: sessionId || crypto.randomUUID(),
      featureType: 'LISTING_GENERATION',
      inputData: { rawDescription, imageUrls, listingType },
      outputData: listing,
      promptVersion: listing.promptVersion,
      modelUsed: listing.modelUsed,
      latencyMs,
    });

    res.json({ listing, feedbackId });
    return;
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /ai/generate-request:
 *   post:
 *     summary: Generate optimized job request from raw input
 *     tags: [AI]
 *     security:
 *       - sessionAuth: []
 */
router.post('/generate-request', requireAuth, verifyCsrfToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rawDescription, imageUrls, category, sessionId } = req.body;

    if (!rawDescription || !category) {
      res.status(400).json({ error: 'Missing required fields: rawDescription, category' });
      return;
    }

    if (!['TOOLS', 'EXPERTISE', 'SPACE'].includes(category)) {
      res.status(400).json({ error: 'Invalid category. Must be TOOLS, EXPERTISE, or SPACE.' });
      return;
    }

    const startTime = Date.now();

    const request = await aiService.generateRequest({
      rawDescription,
      imageUrls: imageUrls || [],
      category,
    });

    const latencyMs = Date.now() - startTime;

    if (!request) {
      res.status(500).json({ error: 'Failed to generate request' });
      return;
    }

    // Track feedback
    const feedbackId = await aiFeedbackService.trackGeneration({
      userId: req.user!.id,
      sessionId: sessionId || crypto.randomUUID(),
      featureType: 'REQUEST_OPTIMIZATION',
      inputData: { rawDescription, imageUrls, category },
      outputData: request,
      promptVersion: request.promptVersion,
      modelUsed: request.modelUsed,
      latencyMs,
    });

    res.json({ request, feedbackId });
    return;
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /ai/improve-listing:
 *   post:
 *     summary: Improve an existing listing
 *     tags: [AI]
 *     security:
 *       - sessionAuth: []
 */
router.post('/improve-listing', requireAuth, verifyCsrfToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, category, sessionId } = req.body;

    if (!title || !description || !category) {
      res.status(400).json({ error: 'Missing required fields: title, description, category' });
      return;
    }

    const startTime = Date.now();
    const improved = await aiService.improveListing({ title, description, category });
    const latencyMs = Date.now() - startTime;

    if (!improved) {
      res.json({
        improvedTitle: title,
        improvedDescription: description,
        seoScore: 50,
        suggestions: ['Add more details about the item', 'Include brand and model information'],
      });
      return;
    }

    // Track feedback
    const feedbackId = await aiFeedbackService.trackGeneration({
      userId: req.user!.id,
      sessionId: sessionId || crypto.randomUUID(),
      featureType: 'LISTING_IMPROVEMENT',
      inputData: { title, description, category },
      outputData: improved,
      promptVersion: improved.promptVersion,
      modelUsed: 'gemini-3-flash-preview',
      latencyMs,
    });

    res.json({ improved, feedbackId });
    return;
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /ai/analyze-images:
 *   post:
 *     summary: Analyze listing images
 *     tags: [AI]
 *     security:
 *       - sessionAuth: []
 */
router.post('/analyze-images', requireAuth, verifyCsrfToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { imageUrls, sessionId } = req.body;

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      res.status(400).json({ error: 'Missing or invalid imageUrls array' });
      return;
    }

    // SECURITY: Validate image URL array
    const MAX_IMAGE_URLS = 10;
    if (imageUrls.length > MAX_IMAGE_URLS) {
      res.status(400).json({ error: `Maximum ${MAX_IMAGE_URLS} image URLs allowed` });
      return;
    }

    // Validate each URL format
    for (const url of imageUrls) {
      if (typeof url !== 'string') {
        res.status(400).json({ error: 'Each imageUrl must be a string' });
        return;
      }
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          res.status(400).json({ error: 'Invalid URL protocol. Only HTTP/HTTPS allowed.' });
          return;
        }
      } catch {
        res.status(400).json({ error: 'Invalid URL format in imageUrls array' });
        return;
      }
    }

    const startTime = Date.now();
    const analysis = await aiService.analyzeListingImages(imageUrls);
    const latencyMs = Date.now() - startTime;

    if (!analysis) {
      res.json({
        analysis: {
          itemType: 'Unknown',
          brand: null,
          condition: 'GOOD',
          features: [],
          concerns: [],
        }
      });
      return;
    }

    // Track feedback
    const feedbackId = await aiFeedbackService.trackGeneration({
      userId: req.user!.id,
      sessionId: sessionId || crypto.randomUUID(),
      featureType: 'IMAGE_ANALYSIS',
      inputData: { imageUrls },
      outputData: analysis,
      promptVersion: 'v2_automotive',
      modelUsed: 'gemini-3-flash-preview',
      latencyMs,
      confidence: analysis.confidence,
    });

    res.json({ analysis, feedbackId });
    return;
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /ai/filter-images:
 *   post:
 *     summary: Filter images for relevance to listing
 *     description: Checks uploaded images against the listing title/description and returns only relevant images
 *     tags: [AI]
 *     security:
 *       - sessionAuth: []
 */
router.post('/filter-images', requireAuth, verifyCsrfToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { imageUrls, title, description, minConfidence } = req.body;

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      res.status(400).json({ error: 'Missing or invalid imageUrls array' });
      return;
    }

    if (!title || !description) {
      res.status(400).json({ error: 'Missing required fields: title, description' });
      return;
    }

    const startTime = Date.now();

    const filterResult = await aiService.filterRelevantImages(
      imageUrls,
      title,
      description,
      minConfidence || 0.6
    );

    const latencyMs = Date.now() - startTime;

    // Log filtering stats
    if (filterResult.filteredCount > 0) {
      // Track feedback for filtered images
      await aiFeedbackService.trackGeneration({
        userId: req.user!.id,
        sessionId: crypto.randomUUID(),
        featureType: 'IMAGE_ANALYSIS',
        inputData: { imageUrls, title, description, minConfidence },
        outputData: filterResult,
        promptVersion: 'v1_filter',
        modelUsed: 'gemini-1.5-flash',
        latencyMs,
      });
    }

    res.json({
      relevantUrls: filterResult.relevantUrls,
      results: filterResult.results,
      filteredCount: filterResult.filteredCount,
      totalCount: imageUrls.length,
    });
    return;
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /ai/suggest-categories:
 *   post:
 *     summary: Suggest specialties/features based on description
 *     tags: [AI]
 *     security:
 *       - sessionAuth: []
 */
router.post('/suggest-categories', requireAuth, verifyCsrfToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { description, listingType, sessionId } = req.body;

    if (!description || !listingType) {
      res.status(400).json({ error: 'Missing required fields: description, listingType' });
      return;
    }

    if (!['service', 'space', 'tool'].includes(listingType)) {
      res.status(400).json({ error: 'Invalid listingType. Must be service, space, or tool.' });
      return;
    }

    const startTime = Date.now();

    // For tools, we just detect condition from text
    if (listingType === 'tool') {
      const conditionKeywords: Record<string, string[]> = {
        'NEW': ['brand new', 'sealed', 'unopened', 'never used', 'still in box', 'bnib'],
        'LIKE_NEW': ['barely used', 'mint', 'excellent', 'pristine', 'like new', 'hardly used', 'as new'],
        'GOOD': ['good condition', 'works well', 'normal wear', 'good working order', 'works perfectly'],
        'FAIR': ['fair condition', 'some wear', 'cosmetic damage', 'used but works', 'working condition'],
        'POOR': ['heavy wear', 'needs repair', 'well used', 'worn', 'needs work']
      };

      let suggestedCondition: string | undefined;
      const descLower = description.toLowerCase();
      for (const [condition, keywords] of Object.entries(conditionKeywords)) {
        if (keywords.some((kw: string) => descLower.includes(kw))) {
          suggestedCondition = condition;
          break;
        }
      }

      res.json({
        suggestedCondition,
        confidence: suggestedCondition ? 0.8 : 0.5,
      });
      return;
    }

    const suggestions = await aiService.suggestCategoryFields({
      description,
      listingType: listingType as 'service' | 'space',
    });

    const latencyMs = Date.now() - startTime;

    if (!suggestions) {
      res.json({
        suggestedSpecialties: [],
        suggestedFeatures: [],
        confidence: 0,
      });
      return;
    }

    // Track feedback
    const feedbackId = await aiFeedbackService.trackGeneration({
      userId: req.user!.id,
      sessionId: sessionId || crypto.randomUUID(),
      featureType: 'LISTING_GENERATION',
      inputData: { description, listingType },
      outputData: suggestions,
      promptVersion: suggestions.promptVersion,
      modelUsed: 'gemini-3-flash-preview',
      latencyMs,
      confidence: suggestions.confidence,
    });

    res.json({ ...suggestions, feedbackId });
    return;
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /ai/moderate-content:
 *   post:
 *     summary: Check listing content for policy violations
 *     tags: [AI]
 *     security:
 *       - sessionAuth: []
 */
router.post('/moderate-content', requireAuth, verifyCsrfToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, category, listingType, sessionId } = req.body;

    if (!title || !description || !listingType) {
      res.status(400).json({ error: 'Missing required fields: title, description, listingType' });
      return;
    }

    if (!['tool', 'space', 'service', 'request'].includes(listingType)) {
      res.status(400).json({ error: 'Invalid listingType. Must be tool, space, service, or request.' });
      return;
    }

    const startTime = Date.now();

    const moderation = await aiService.moderateContent({
      title,
      description,
      category: category || 'Other',
      listingType,
    });

    const latencyMs = Date.now() - startTime;

    if (!moderation) {
      // Fail open - if moderation fails, allow the listing
      res.json({
        approved: true,
        riskScore: 0,
        violations: [],
        warnings: ['Moderation unavailable'],
        reasoning: 'Moderation check failed - approved by default',
      });
      return;
    }

    // Track feedback
    const feedbackId = await aiFeedbackService.trackGeneration({
      userId: req.user!.id,
      sessionId: sessionId || crypto.randomUUID(),
      featureType: 'LISTING_GENERATION',
      inputData: { title, description, category, listingType },
      outputData: moderation,
      promptVersion: moderation.promptVersion,
      modelUsed: 'gemini-3-flash-preview',
      latencyMs,
    });

    res.json({ ...moderation, feedbackId });
    return;
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /ai/feedback:
 *   post:
 *     summary: Track user action on AI suggestions
 *     tags: [AI]
 *     security:
 *       - sessionAuth: []
 */
router.post('/feedback', requireAuth, verifyCsrfToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { feedbackId, action, selectedFields, modifiedFields, finalData } = req.body;

    if (!feedbackId || !action) {
      res.status(400).json({ error: 'Missing required fields: feedbackId, action' });
      return;
    }

    const validActions = ['ACCEPTED_FULL', 'ACCEPTED_PARTIAL', 'REJECTED', 'REGENERATED'];
    if (!validActions.includes(action)) {
      res.status(400).json({ error: `Invalid action. Must be one of: ${validActions.join(', ')}` });
      return;
    }

    const success = await aiFeedbackService.trackAction({
      feedbackId,
      action,
      selectedFields,
      modifiedFields,
      finalData,
    });

    res.json({ success });
    return;
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /ai/metrics:
 *   get:
 *     summary: Get AI performance metrics (admin only)
 *     tags: [AI]
 *     security:
 *       - sessionAuth: []
 */
router.get('/metrics', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Simple check - could be enhanced with proper admin middleware
    const { featureType, promptVersion, startDate, endDate } = req.query;

    const metrics = await aiFeedbackService.getPerformanceMetrics({
      featureType: featureType as any,
      promptVersion: promptVersion as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json({ metrics });
    return;
  } catch (error) {
    next(error);
  }
});

export default router;
