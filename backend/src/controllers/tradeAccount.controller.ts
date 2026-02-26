import { Request, Response, NextFunction } from 'express';
import { tradeAccountService } from '../services/tradeAccount.service.js';
import { logger } from '../config/logger.js';

export class TradeAccountController {
  /**
   * Get trade account
   * GET /api/v1/trade-account
   */
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const account = await tradeAccountService.get(req.user.id);

      if (!account) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Trade account not found',
        });
      }

      return res.json({ account });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Create trade account
   * POST /api/v1/trade-account
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const account = await tradeAccountService.create(req.user.id, req.body);
      logger.info('Trade account created', { userId: req.user.id, accountType: account.accountType });

      return res.status(201).json({
        message: 'Trade account created successfully',
        account,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already has')) {
          return res.status(409).json({
            error: 'Conflict',
            message: error.message,
          });
        }
        if (error.message.includes('required')) {
          return res.status(400).json({
            error: 'Bad Request',
            message: error.message,
          });
        }
      }
      return next(error);
    }
  }

  /**
   * Update trade account
   * PATCH /api/v1/trade-account
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const account = await tradeAccountService.update(req.user.id, req.body);
      logger.info('Trade account updated', { userId: req.user.id });

      return res.json({
        message: 'Trade account updated successfully',
        account,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Trade account not found',
          });
        }
        if (error.message.includes('required')) {
          return res.status(400).json({
            error: 'Bad Request',
            message: error.message,
          });
        }
      }
      return next(error);
    }
  }

  /**
   * Get team members
   * GET /api/v1/trade-account/team
   */
  async getTeam(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const members = await tradeAccountService.getTeamMembers(req.user.id);
      return res.json({ members });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Trade account not found',
        });
      }
      return next(error);
    }
  }

  /**
   * Invite team member
   * POST /api/v1/trade-account/team/invite
   */
  async inviteTeamMember(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const { email, role } = req.body;

      if (!email) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Email is required',
        });
      }

      const member = await tradeAccountService.inviteTeamMember(
        req.user.id,
        email,
        role || 'MEMBER'
      );

      logger.info('Team member invited', { accountOwnerId: req.user.id, invitedEmail: email });

      return res.status(201).json({
        message: 'Team member invited successfully',
        member,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({
            error: 'Not Found',
            message: error.message,
          });
        }
        if (error.message.includes('cannot invite yourself') ||
            error.message.includes('already a team member') ||
            error.message.includes('already owns')) {
          return res.status(400).json({
            error: 'Bad Request',
            message: error.message,
          });
        }
      }
      return next(error);
    }
  }

  /**
   * Accept team invitation
   * POST /api/v1/trade-account/team/:id/accept
   */
  async acceptInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const { id } = req.params;
      const member = await tradeAccountService.acceptInvitation(req.user.id, id);

      logger.info('Team invitation accepted', { memberId: id, userId: req.user.id });

      return res.json({
        message: 'Invitation accepted successfully',
        member,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Invitation not found',
          });
        }
        if (error.message.includes('not for you')) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'This invitation is not for you',
          });
        }
        if (error.message.includes('already accepted') || error.message.includes('revoked')) {
          return res.status(400).json({
            error: 'Bad Request',
            message: error.message,
          });
        }
      }
      return next(error);
    }
  }

  /**
   * Remove team member
   * DELETE /api/v1/trade-account/team/:id
   */
  async removeTeamMember(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const { id } = req.params;
      await tradeAccountService.removeTeamMember(req.user.id, id);

      logger.info('Team member removed', { memberId: id, accountOwnerId: req.user.id });

      return res.json({
        message: 'Team member removed successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({
            error: 'Not Found',
            message: error.message,
          });
        }
        if (error.message.includes('only remove')) {
          return res.status(403).json({
            error: 'Forbidden',
            message: error.message,
          });
        }
      }
      return next(error);
    }
  }

  /**
   * Update team member role
   * PATCH /api/v1/trade-account/team/:id/role
   */
  async updateMemberRole(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const { id } = req.params;
      const { role } = req.body;

      if (!role || (role !== 'ADMIN' && role !== 'MEMBER')) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Role must be ADMIN or MEMBER',
        });
      }

      const member = await tradeAccountService.updateMemberRole(req.user.id, id, role);

      logger.info('Team member role updated', { memberId: id, role });

      return res.json({
        message: 'Team member role updated successfully',
        member,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({
            error: 'Not Found',
            message: error.message,
          });
        }
        if (error.message.includes('only update')) {
          return res.status(403).json({
            error: 'Forbidden',
            message: error.message,
          });
        }
      }
      return next(error);
    }
  }

  /**
   * Get pending invitations for current user
   * GET /api/v1/trade-account/invitations
   */
  async getPendingInvitations(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const invitations = await tradeAccountService.getPendingInvitations(req.user.id);
      return res.json({ invitations });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get the trade account the user is part of (either as owner or team member)
   * GET /api/v1/trade-account/my-account
   */
  async getMyTradeAccount(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const account = await tradeAccountService.getUserTradeAccount(req.user.id);

      if (!account) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'You are not part of any trade account',
        });
      }

      return res.json({ account });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Calculate bulk discount for an amount
   * GET /api/v1/trade-account/discount
   */
  async calculateDiscount(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const amount = parseInt(req.query.amount as string, 10);

      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Amount must be a positive number (in pence)',
        });
      }

      const result = await tradeAccountService.calculateBulkDiscount(req.user.id, amount);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }
}

export const tradeAccountController = new TradeAccountController();
