/**
 * Insurance Routes
 * 
 * Provider routes for managing insurance documents
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import insuranceController from '../controllers/insurance.controller.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/v1/insurance/upload
 * Upload a new insurance document
 */
router.post('/upload', insuranceController.uploadDocument);

/**
 * GET /api/v1/insurance/my-documents
 * Get current user's insurance documents
 */
router.get('/my-documents', insuranceController.getMyDocuments);

/**
 * GET /api/v1/insurance/status
 * Get current user's insurance status summary
 */
router.get('/status', insuranceController.getMyInsuranceStatus);

/**
 * DELETE /api/v1/insurance/:id
 * Delete an insurance document (only pending/rejected)
 */
router.delete('/:id', insuranceController.deleteDocument);

export default router;
