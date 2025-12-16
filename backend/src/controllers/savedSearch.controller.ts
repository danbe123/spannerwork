import { Request, Response } from 'express';
import { savedSearchService } from '../services/savedSearch.service.js';
import { logger } from '../config/logger.js';

export class SavedSearchController {
  /**
   * Create a new saved search
   * POST /api/v1/saved-searches
   */
  async create(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { name, filters } = req.body;

      const savedSearch = await savedSearchService.create({
        userId,
        name,
        filters,
      });

      return res.status(201).json({
        message: 'Saved search created successfully',
        savedSearch,
      });
    } catch (error) {
      logger.error('Error creating saved search:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create saved search',
      });
    }
  }

  /**
   * List all saved searches for the current user
   * GET /api/v1/saved-searches
   */
  async list(req: Request, res: Response) {
    try {
      const userId = req.user!.id;

      const savedSearches = await savedSearchService.list(userId);

      return res.json({ savedSearches });
    } catch (error) {
      logger.error('Error listing saved searches:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to list saved searches',
      });
    }
  }

  /**
   * Get a saved search by ID
   * GET /api/v1/saved-searches/:id
   */
  async getById(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const savedSearch = await savedSearchService.getById(id, userId);

      return res.json({ savedSearch });
    } catch (error) {
      logger.error('Error getting saved search:', error);
      if (error instanceof Error && error.message === 'Saved search not found') {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get saved search',
      });
    }
  }

  /**
   * Update a saved search
   * PATCH /api/v1/saved-searches/:id
   */
  async update(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { name, filters } = req.body;

      const savedSearch = await savedSearchService.update(id, userId, {
        name,
        filters,
      });

      return res.json({
        message: 'Saved search updated successfully',
        savedSearch,
      });
    } catch (error) {
      logger.error('Error updating saved search:', error);
      if (error instanceof Error && error.message === 'Saved search not found') {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update saved search',
      });
    }
  }

  /**
   * Delete a saved search
   * DELETE /api/v1/saved-searches/:id
   */
  async delete(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await savedSearchService.delete(id, userId);

      return res.json({
        message: 'Saved search deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting saved search:', error);
      if (error instanceof Error && error.message === 'Saved search not found') {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete saved search',
      });
    }
  }
}

export const savedSearchController = new SavedSearchController();
