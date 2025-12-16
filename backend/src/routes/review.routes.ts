import { Router } from 'express';
import { reviewController } from '../controllers/review.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';
import { createReviewSchema } from '../utils/validation.schemas.js';

const router = Router();

/**
 * @route   POST /api/v1/reviews
 * @desc    Create a review
 * @access  Private
 */
router.post(
  '/',
  requireAuth,
  verifyCsrfToken,
  validateBody(createReviewSchema),
  reviewController.create.bind(reviewController)
);

/**
 * @route   GET /api/v1/reviews/:id
 * @desc    Get review by ID
 * @access  Public
 */
router.get('/:id', reviewController.getById.bind(reviewController));

/**
 * @route   GET /api/v1/reviews/user/:userId
 * @desc    Get reviews for a specific user
 * @access  Public
 */
router.get('/user/:userId', reviewController.getByUser.bind(reviewController));

/**
 * @route   PATCH /api/v1/reviews/:id
 * @desc    Update a review
 * @access  Private
 */
router.patch('/:id', requireAuth, verifyCsrfToken, reviewController.update.bind(reviewController));

/**
 * @route   DELETE /api/v1/reviews/:id
 * @desc    Delete a review
 * @access  Private
 */
router.delete('/:id', requireAuth, verifyCsrfToken, reviewController.delete.bind(reviewController));

export default router;
