import { Router } from 'express';
import { getCsrfToken } from '../middleware/csrf.middleware.js';

const router = Router();

/**
 * GET /api/v1/csrf-token
 * Get a CSRF token for the current session
 * @auth Not required - needed for registration
 * Rate limited to prevent abuse
 */
router.get('/', getCsrfToken);

export default router;
