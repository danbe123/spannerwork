import { Router } from 'express';
import { savedSearchController } from '../controllers/savedSearch.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/v1/saved-searches
 * List all saved searches for the current user
 */
router.get('/', savedSearchController.list.bind(savedSearchController));

/**
 * POST /api/v1/saved-searches
 * Create a new saved search
 */
router.post('/', verifyCsrfToken, savedSearchController.create.bind(savedSearchController));

/**
 * GET /api/v1/saved-searches/:id
 * Get a saved search by ID
 */
router.get('/:id', savedSearchController.getById.bind(savedSearchController));

/**
 * PATCH /api/v1/saved-searches/:id
 * Update a saved search
 */
router.patch('/:id', verifyCsrfToken, savedSearchController.update.bind(savedSearchController));

/**
 * DELETE /api/v1/saved-searches/:id
 * Delete a saved search
 */
router.delete('/:id', verifyCsrfToken, savedSearchController.delete.bind(savedSearchController));

export default router;
