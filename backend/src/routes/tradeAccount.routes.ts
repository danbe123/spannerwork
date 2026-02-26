import { Router } from 'express';
import { tradeAccountController } from '../controllers/tradeAccount.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';

const router = Router();

/**
 * GET /api/v1/trade-account
 * Get the user's own trade account (as owner)
 */
router.get(
  '/',
  requireAuth,
  tradeAccountController.get.bind(tradeAccountController)
);

/**
 * POST /api/v1/trade-account
 * Create a new trade account
 * Body: { accountType, companyName, companyRegistrationNo, vatNumber, billingAddress, billingCity, billingPostcode, billingCountry }
 */
router.post(
  '/',
  requireAuth,
  verifyCsrfToken,
  tradeAccountController.create.bind(tradeAccountController)
);

/**
 * PATCH /api/v1/trade-account
 * Update trade account details
 */
router.patch(
  '/',
  requireAuth,
  verifyCsrfToken,
  tradeAccountController.update.bind(tradeAccountController)
);

/**
 * GET /api/v1/trade-account/my-account
 * Get the trade account the user belongs to (as owner or team member)
 */
router.get(
  '/my-account',
  requireAuth,
  tradeAccountController.getMyTradeAccount.bind(tradeAccountController)
);

/**
 * GET /api/v1/trade-account/invitations
 * Get pending team invitations for the current user
 */
router.get(
  '/invitations',
  requireAuth,
  tradeAccountController.getPendingInvitations.bind(tradeAccountController)
);

/**
 * GET /api/v1/trade-account/discount
 * Calculate bulk discount for a given amount
 * Query: amount (in pence)
 */
router.get(
  '/discount',
  requireAuth,
  tradeAccountController.calculateDiscount.bind(tradeAccountController)
);

/**
 * GET /api/v1/trade-account/team
 * Get team members
 */
router.get(
  '/team',
  requireAuth,
  tradeAccountController.getTeam.bind(tradeAccountController)
);

/**
 * POST /api/v1/trade-account/team/invite
 * Invite a new team member
 * Body: { email, role? }
 */
router.post(
  '/team/invite',
  requireAuth,
  verifyCsrfToken,
  tradeAccountController.inviteTeamMember.bind(tradeAccountController)
);

/**
 * POST /api/v1/trade-account/team/:id/accept
 * Accept a team invitation
 */
router.post(
  '/team/:id/accept',
  requireAuth,
  verifyCsrfToken,
  tradeAccountController.acceptInvitation.bind(tradeAccountController)
);

/**
 * PATCH /api/v1/trade-account/team/:id/role
 * Update a team member's role
 * Body: { role: 'ADMIN' | 'MEMBER' }
 */
router.patch(
  '/team/:id/role',
  requireAuth,
  verifyCsrfToken,
  tradeAccountController.updateMemberRole.bind(tradeAccountController)
);

/**
 * DELETE /api/v1/trade-account/team/:id
 * Remove a team member
 */
router.delete(
  '/team/:id',
  requireAuth,
  verifyCsrfToken,
  tradeAccountController.removeTeamMember.bind(tradeAccountController)
);

export default router;
