import { Router } from 'express';
import { blogController } from '../controllers/blog.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/authorize.middleware.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { apiLimiter, adminLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

// =============================================================================
// PUBLIC ROUTES (no auth required)
// =============================================================================

/**
 * @route   GET /api/v1/blog
 * @desc    List published blog posts
 * @access  Public
 */
router.get('/', apiLimiter, asyncHandler(blogController.listPublished.bind(blogController)));

/**
 * @route   GET /api/v1/blog/categories
 * @desc    Get all blog categories
 * @access  Public
 */
router.get('/categories', apiLimiter, asyncHandler(blogController.getCategories.bind(blogController)));

/**
 * @route   GET /api/v1/blog/post/:slug
 * @desc    Get a blog post by slug
 * @access  Public
 */
router.get('/post/:slug', apiLimiter, asyncHandler(blogController.getBySlug.bind(blogController)));

// =============================================================================
// ADMIN ROUTES (admin auth required)
// =============================================================================

/**
 * @route   GET /api/v1/blog/admin
 * @desc    List all blog posts (admin view)
 * @access  Admin
 */
router.get('/admin', requireAuth, requireAdmin, adminLimiter, asyncHandler(blogController.listAll.bind(blogController)));

/**
 * @route   GET /api/v1/blog/admin/:id
 * @desc    Get a blog post by ID (admin view)
 * @access  Admin
 */
router.get('/admin/:id', requireAuth, requireAdmin, adminLimiter, asyncHandler(blogController.getById.bind(blogController)));

/**
 * @route   POST /api/v1/blog/admin
 * @desc    Create a new blog post
 * @access  Admin
 */
router.post('/admin', requireAuth, requireAdmin, adminLimiter, verifyCsrfToken, asyncHandler(blogController.create.bind(blogController)));

/**
 * @route   PUT /api/v1/blog/admin/:id
 * @desc    Update a blog post
 * @access  Admin
 */
router.put('/admin/:id', requireAuth, requireAdmin, adminLimiter, verifyCsrfToken, asyncHandler(blogController.update.bind(blogController)));

/**
 * @route   DELETE /api/v1/blog/admin/:id
 * @desc    Delete a blog post
 * @access  Admin
 */
router.delete('/admin/:id', requireAuth, requireAdmin, adminLimiter, verifyCsrfToken, asyncHandler(blogController.delete.bind(blogController)));

/**
 * @route   POST /api/v1/blog/admin/:id/publish
 * @desc    Publish a blog post
 * @access  Admin
 */
router.post('/admin/:id/publish', requireAuth, requireAdmin, adminLimiter, verifyCsrfToken, asyncHandler(blogController.publish.bind(blogController)));

/**
 * @route   POST /api/v1/blog/admin/:id/unpublish
 * @desc    Unpublish a blog post
 * @access  Admin
 */
router.post('/admin/:id/unpublish', requireAuth, requireAdmin, adminLimiter, verifyCsrfToken, asyncHandler(blogController.unpublish.bind(blogController)));

export default router;
