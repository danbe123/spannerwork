import { Router } from 'express';
import { getCsrfToken, ensureAnonSession } from '../middleware/csrf.middleware.js';

const router = Router();

/**
 * GET /api/v1/csrf-token
 * Get a CSRF token for the current session
 * @auth Not required - needed for registration
 * Rate limited to prevent abuse
 *
 * For unauthenticated users, sets an anonymous session cookie
 * to provide a stable CSRF identifier.
 */
router.get('/', ensureAnonSession, getCsrfToken);

export default router;
