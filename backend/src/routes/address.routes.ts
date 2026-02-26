import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getAddressService } from '../services/getaddress.service.js';
import { logger } from '../config/logger.js';

const router = Router();

/**
 * GET /api/v1/address/lookup/:postcode
 * Lookup addresses for a UK postcode
 * Requires authentication to prevent abuse
 */
router.get('/lookup/:postcode', requireAuth, async (req: Request, res: Response) => {
  try {
    const { postcode } = req.params;

    if (!postcode || postcode.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Invalid postcode',
      });
    }

    // Check if service is available
    if (!getAddressService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'Address lookup service not available',
      });
    }

    const addresses = await getAddressService.lookupPostcode(postcode);

    return res.json({
      success: true,
      data: {
        postcode: postcode.toUpperCase().replace(/\s+/g, ''),
        addresses,
      },
    });
  } catch (error) {
    logger.error('Address lookup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Address lookup failed',
    });
  }
});

/**
 * GET /api/v1/address/available
 * Check if address lookup is available
 */
router.get('/available', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    data: {
      available: getAddressService.isAvailable(),
    },
  });
});

export default router;
