import { Router, Request, Response, NextFunction } from 'express';
import { quickAcceptService } from '../services/quickAccept.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';

const router = Router();

/**
 * @swagger
 * /quick-accept/matches/{requestId}:
 *   get:
 *     summary: Get matching providers for a request
 *     tags: [QuickAccept]
 *     security:
 *       - sessionAuth: []
 */
router.get('/matches/:requestId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { requestId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const providers = await quickAcceptService.findMatchingProviders(requestId, limit);

    res.json({ providers });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /quick-accept/accept:
 *   post:
 *     summary: Quick accept a request (provider action)
 *     tags: [QuickAccept]
 *     security:
 *       - sessionAuth: []
 */
router.post('/accept', requireAuth, verifyCsrfToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { requestId, proposedRate } = req.body;
    const providerId = req.user!.id;

    if (!requestId) {
      res.status(400).json({ error: 'Request ID is required' });
      return;
    }

    const result = await quickAcceptService.quickAccept(requestId, providerId, proposedRate);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({
      success: true,
      transactionId: result.transactionId,
      message: 'Request accepted! The seeker has been notified.',
    });
    return;
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /quick-accept/decline:
 *   post:
 *     summary: Decline a request (provider action)
 *     tags: [QuickAccept]
 *     security:
 *       - sessionAuth: []
 */
router.post('/decline', requireAuth, verifyCsrfToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { requestId } = req.body;
    const providerId = req.user!.id;

    if (!requestId) {
      res.status(400).json({ error: 'Request ID is required' });
      return;
    }

    await quickAcceptService.quickDecline(requestId, providerId);

    res.json({ success: true, message: 'Request declined' });
    return;
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /quick-accept/pending:
 *   get:
 *     summary: Get pending responses for the current provider
 *     tags: [QuickAccept]
 *     security:
 *       - sessionAuth: []
 */
router.get('/pending', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const providerId = req.user!.id;
    const responses = await quickAcceptService.getPendingResponses(providerId);

    res.json({ responses });
    return;
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /quick-accept/notify/{requestId}:
 *   post:
 *     summary: Trigger notifications to matching providers (called after request creation)
 *     tags: [QuickAccept]
 *     security:
 *       - sessionAuth: []
 */
router.post('/notify/:requestId', requireAuth, verifyCsrfToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { requestId } = req.params;

    const notifiedCount = await quickAcceptService.notifyMatchingProviders(requestId);

    res.json({
      success: true,
      notifiedProviders: notifiedCount,
      message: `Notified ${notifiedCount} matching providers`,
    });
    return;
  } catch (error) {
    next(error);
  }
});

export default router;
