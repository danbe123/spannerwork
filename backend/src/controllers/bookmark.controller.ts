import { Request, Response, NextFunction } from 'express';
import { bookmarkService } from '../services/bookmark.service.js';
import { UnauthorizedError } from '../utils/errors.js';

export class BookmarkController {
  /**
   * Get all bookmarks for current user
   * GET /api/v1/bookmarks
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      const bookmarks = await bookmarkService.getUserBookmarks(req.user.id);

      return res.json({
        bookmarks,
        count: bookmarks.length,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get bookmark IDs only (for quick sync)
   * GET /api/v1/bookmarks/ids
   */
  async getIds(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      const ids = await bookmarkService.getUserBookmarkIds(req.user.id);

      return res.json({ ids });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Check if request is bookmarked
   * GET /api/v1/bookmarks/check/:requestId
   */
  async check(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      const { requestId } = req.params;
      const bookmarked = await bookmarkService.isBookmarked(req.user.id, requestId);

      return res.json({ bookmarked });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Add a bookmark
   * POST /api/v1/bookmarks/:requestId
   */
  async add(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      const { requestId } = req.params;
      const bookmark = await bookmarkService.addBookmark(req.user.id, requestId);

      return res.status(201).json({
        message: 'Bookmark added',
        bookmark,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Request not found') {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Request not found',
        });
      }
      return next(error);
    }
  }

  /**
   * Remove a bookmark
   * DELETE /api/v1/bookmarks/:requestId
   */
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      const { requestId } = req.params;
      await bookmarkService.removeBookmark(req.user.id, requestId);

      return res.json({
        message: 'Bookmark removed',
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Toggle a bookmark
   * POST /api/v1/bookmarks/:requestId/toggle
   */
  async toggle(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      const { requestId } = req.params;
      const result = await bookmarkService.toggleBookmark(req.user.id, requestId);

      return res.json({
        message: result.bookmarked ? 'Bookmark added' : 'Bookmark removed',
        ...result,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Request not found') {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Request not found',
        });
      }
      return next(error);
    }
  }

  /**
   * Sync bookmarks from client
   * POST /api/v1/bookmarks/sync
   */
  async sync(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      const { ids } = req.body as { ids: string[] };

      if (!Array.isArray(ids)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'ids must be an array of request IDs',
        });
      }

      const mergedIds = await bookmarkService.syncBookmarks(req.user.id, ids);

      return res.json({
        message: 'Bookmarks synced',
        ids: mergedIds,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const bookmarkController = new BookmarkController();
