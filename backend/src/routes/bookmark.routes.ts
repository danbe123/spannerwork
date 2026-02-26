import { Router } from 'express';
import { bookmarkController } from '../controllers/bookmark.controller.js';
import { requireAuth, requireEmailVerified } from '../middleware/auth.middleware.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';
import { sensitiveLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

// All bookmark routes require authentication and email verification
router.use(requireAuth);
router.use(requireEmailVerified);

// GET /api/v1/bookmarks - List all bookmarks with request data
router.get('/', bookmarkController.list.bind(bookmarkController));

// GET /api/v1/bookmarks/ids - Get just bookmark IDs (for quick sync)
router.get('/ids', bookmarkController.getIds.bind(bookmarkController));

// POST /api/v1/bookmarks/sync - Sync client bookmarks with server
router.post('/sync', sensitiveLimiter, verifyCsrfToken, bookmarkController.sync.bind(bookmarkController));

// GET /api/v1/bookmarks/check/:requestId - Check if request is bookmarked
router.get('/check/:requestId', bookmarkController.check.bind(bookmarkController));

// POST /api/v1/bookmarks/:requestId - Add a bookmark
router.post('/:requestId', sensitiveLimiter, verifyCsrfToken, bookmarkController.add.bind(bookmarkController));

// DELETE /api/v1/bookmarks/:requestId - Remove a bookmark
router.delete('/:requestId', sensitiveLimiter, verifyCsrfToken, bookmarkController.remove.bind(bookmarkController));

// POST /api/v1/bookmarks/:requestId/toggle - Toggle a bookmark
router.post('/:requestId/toggle', sensitiveLimiter, verifyCsrfToken, bookmarkController.toggle.bind(bookmarkController));

export default router;
