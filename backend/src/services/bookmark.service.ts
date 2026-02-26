import prisma from '../config/database.js';
import { logger } from '../config/logger.js';

interface BookmarkWithRequest {
  id: string;
  requestId: string;
  createdAt: Date;
  request: {
    id: string;
    title: string;
    description: string;
    category: string;
    urgency: string;
    budget: number;
    rateType: string;
    photos: string[];
    postcode: string;
    locationAddress: string | null;
    locationLat: number | null;
    locationLng: number | null;
    status: string;
    responseCount: number;
    createdDate: Date;
    seekerId: string;
  };
}

class BookmarkService {
  /**
   * Get all bookmarks for a user
   */
  async getUserBookmarks(userId: string): Promise<BookmarkWithRequest[]> {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId },
      include: {
        request: {
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            urgency: true,
            budget: true,
            rateType: true,
            photos: true,
            postcode: true,
            locationAddress: true,
            locationLat: true,
            locationLng: true,
            status: true,
            responseCount: true,
            createdDate: true,
            seekerId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return bookmarks as BookmarkWithRequest[];
  }

  /**
   * Get bookmark IDs only (for quick sync)
   */
  async getUserBookmarkIds(userId: string): Promise<string[]> {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId },
      select: { requestId: true },
    });

    return bookmarks.map((b) => b.requestId);
  }

  /**
   * Check if a specific request is bookmarked
   */
  async isBookmarked(userId: string, requestId: string): Promise<boolean> {
    const bookmark = await prisma.bookmark.findUnique({
      where: {
        userId_requestId: { userId, requestId },
      },
    });

    return !!bookmark;
  }

  /**
   * Add a bookmark
   */
  async addBookmark(userId: string, requestId: string): Promise<{ id: string; requestId: string; createdAt: Date }> {
    // Verify request exists
    const request = await prisma.request.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error('Request not found');
    }

    // Check if already bookmarked
    const existing = await prisma.bookmark.findUnique({
      where: {
        userId_requestId: { userId, requestId },
      },
    });

    if (existing) {
      return existing;
    }

    const bookmark = await prisma.bookmark.create({
      data: {
        userId,
        requestId,
      },
    });

    logger.info(`Bookmark added: user ${userId} bookmarked request ${requestId}`);

    return bookmark;
  }

  /**
   * Remove a bookmark
   */
  async removeBookmark(userId: string, requestId: string): Promise<void> {
    const bookmark = await prisma.bookmark.findUnique({
      where: {
        userId_requestId: { userId, requestId },
      },
    });

    if (!bookmark) {
      return;
    }

    await prisma.bookmark.delete({
      where: {
        userId_requestId: { userId, requestId },
      },
    });

    logger.info(`Bookmark removed: user ${userId} unbookmarked request ${requestId}`);
  }

  /**
   * Toggle a bookmark (add if not exists, remove if exists)
   */
  async toggleBookmark(userId: string, requestId: string): Promise<{ bookmarked: boolean }> {
    const isCurrentlyBookmarked = await this.isBookmarked(userId, requestId);

    if (isCurrentlyBookmarked) {
      await this.removeBookmark(userId, requestId);
      return { bookmarked: false };
    } else {
      await this.addBookmark(userId, requestId);
      return { bookmarked: true };
    }
  }

  /**
   * Sync bookmarks from client (merge with server)
   * Used when user logs in with existing localStorage bookmarks
   */
  async syncBookmarks(userId: string, clientBookmarkIds: string[]): Promise<string[]> {
    // Get existing server bookmarks
    const serverBookmarkIds = await this.getUserBookmarkIds(userId);
    const serverSet = new Set(serverBookmarkIds);

    // Add any client bookmarks that don't exist on server
    const toAdd = clientBookmarkIds.filter((id) => !serverSet.has(id));

    for (const requestId of toAdd) {
      try {
        await this.addBookmark(userId, requestId);
      } catch {
        // Skip invalid request IDs silently
      }
    }

    // Return merged list
    return await this.getUserBookmarkIds(userId);
  }
}

export const bookmarkService = new BookmarkService();
