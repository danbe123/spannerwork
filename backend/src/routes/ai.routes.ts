import { Router, Request, Response, NextFunction } from 'express';
import { aiService } from '../services/ai.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';

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
router.post('/match', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, category, budget, postcode, lat, lng } = req.body;

    if (!title || !description || !category) {
      res.status(400).json({ error: 'Missing required fields: title, description, category' });
      return;
    }

    const matches = await aiService.findMatches({
      title,
      description,
      category,
      budget: budget || 0,
      postcode: postcode || '',
      lat,
      lng,
    });

    res.json({ matches });
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
router.post('/optimize-request', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, category } = req.body;

    if (!title || !description || !category) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const optimized = await aiService.optimizeRequest(title, description, category);

    if (!optimized) {
      res.json({
        optimizedTitle: title,
        optimizedDescription: description,
        suggestedBudget: null,
      });
      return;
    }

    res.json(optimized);
    return;
  } catch (error) {
    next(error);
  }
});

export default router;
