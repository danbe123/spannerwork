import { Router, Request, Response } from 'express';
import { geocodingService } from '../services/geocoding.service.js';
import { geocodingLimiter } from '../middleware/rateLimit.middleware.js';
import { logger } from '../config/logger.js';

const router = Router();

/**
 * GET /api/v1/geocoding/postcode/:postcode
 * Geocode a UK postcode to lat/lng coordinates
 * Rate limited to 30 requests/minute per IP to control external API costs
 */
router.get(
  '/postcode/:postcode',
  geocodingLimiter,
  async (req: Request, res: Response) => {
    try {
      const { postcode } = req.params;

      if (!postcode || postcode.trim().length < 3) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid postcode',
        });
      }

      const result = await geocodingService.geocodePostcode(postcode);

      if (!result) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Could not find location for this postcode',
        });
      }

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Geocoding error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to geocode postcode',
      });
    }
  }
);

export default router;
