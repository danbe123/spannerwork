import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../config/logger.js';
import { NotFoundError } from '../utils/errors.js';

const prisma = new PrismaClient();

interface SavedSearchFilters {
  category?: string;
  urgency?: string;
  budget?: number;
  postcode?: string;
  radius?: number;
  [key: string]: unknown; // Index signature for Prisma JsonValue compatibility
}

interface CreateSavedSearchInput {
  userId: string;
  name: string;
  filters: SavedSearchFilters;
}

interface UpdateSavedSearchInput {
  name?: string;
  filters?: SavedSearchFilters;
}

class SavedSearchService {
  /**
   * Create a new saved search
   */
  async create(input: CreateSavedSearchInput) {
    try {
      const savedSearch = await prisma.savedSearch.create({
        data: {
          userId: input.userId,
          name: input.name,
          filters: input.filters as Prisma.InputJsonValue,
        },
      });

      logger.info(`Saved search created: ${savedSearch.id} by user ${input.userId}`);
      return savedSearch;
    } catch (error) {
      logger.error('Error creating saved search:', error);
      throw error;
    }
  }

  /**
   * List all saved searches for a user
   */
  async list(userId: string) {
    try {
      const savedSearches = await prisma.savedSearch.findMany({
        where: { userId },
        orderBy: { createdDate: 'desc' },
      });

      return savedSearches;
    } catch (error) {
      logger.error('Error listing saved searches:', error);
      throw error;
    }
  }

  /**
   * Get a saved search by ID
   */
  async getById(id: string, userId: string) {
    try {
      const savedSearch = await prisma.savedSearch.findFirst({
        where: { id, userId },
      });

      if (!savedSearch) {
        throw new NotFoundError('Saved search not found');
      }

      return savedSearch;
    } catch (error) {
      logger.error('Error getting saved search:', error);
      throw error;
    }
  }

  /**
   * Update a saved search
   */
  async update(id: string, userId: string, input: UpdateSavedSearchInput) {
    try {
      // Verify ownership
      const existing = await prisma.savedSearch.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        throw new NotFoundError('Saved search not found');
      }

      const updateData: Prisma.SavedSearchUpdateInput = {};
      if (input.name) updateData.name = input.name;
      if (input.filters) updateData.filters = input.filters as Prisma.InputJsonValue;

      const savedSearch = await prisma.savedSearch.update({
        where: { id },
        data: updateData,
      });

      logger.info(`Saved search updated: ${id} by user ${userId}`);
      return savedSearch;
    } catch (error) {
      logger.error('Error updating saved search:', error);
      throw error;
    }
  }

  /**
   * Delete a saved search
   */
  async delete(id: string, userId: string) {
    try {
      // Verify ownership
      const existing = await prisma.savedSearch.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        throw new NotFoundError('Saved search not found');
      }

      await prisma.savedSearch.delete({
        where: { id },
      });

      logger.info(`Saved search deleted: ${id} by user ${userId}`);
      return { success: true };
    } catch (error) {
      logger.error('Error deleting saved search:', error);
      throw error;
    }
  }
}

export const savedSearchService = new SavedSearchService();
