import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { notificationService } from './notification.service.js';
// Email notifications can be added here if needed
import { geocodingService } from './geocoding.service.js';

/**
 * Quick Accept Service
 * 
 * Enables providers to quickly respond to job requests via push notifications.
 * Flow:
 * 1. New request posted → Find matching providers
 * 2. Send push notification with Accept/View actions
 * 3. Provider taps Accept → Auto-create transaction
 * 4. Seeker is notified → Proceeds to payment
 */

interface MatchingProvider {
  id: string;
  name: string | null;
  email: string;
  distance: number;
  rating: number | null;
  matchScore: number;
}

interface QuickAcceptResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

class QuickAcceptService {
  /**
   * Find providers matching a request based on:
   * - Location proximity
   * - Category match (tools/services/spaces)
   * - Availability
   * - Rating
   */
  async findMatchingProviders(requestId: string, limit = 10): Promise<MatchingProvider[]> {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { seeker: { select: { id: true } } },
    });

    if (!request || !request.locationLat || !request.locationLng) {
      return [];
    }

    const radius = request.broadcastRadius || 10; // miles

    // Get providers based on category
    let providers: Array<{
      id: string;
      name: string | null;
      email: string;
      lat: number | null;
      lng: number | null;
      rating: number | null;
      postcode: string | null;
    }> = [];

    if (request.category === 'TOOLS') {
      const tools = await prisma.tool.findMany({
        where: { available: true },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              rating: true,
              postcode: true,
              locationLat: true,
              locationLng: true,
            },
          },
        },
      });
      providers = tools.map(t => ({
        id: t.owner.id,
        name: t.owner.name,
        email: t.owner.email,
        lat: t.owner.locationLat,
        lng: t.owner.locationLng,
        rating: t.owner.rating,
        postcode: t.owner.postcode,
      }));
    } else if (request.category === 'EXPERTISE') {
      const services = await prisma.service.findMany({
        where: { available: true },
        include: {
          provider: {
            select: {
              id: true,
              name: true,
              email: true,
              rating: true,
              postcode: true,
              locationLat: true,
              locationLng: true,
            },
          },
        },
      });
      providers = services.map(s => ({
        id: s.provider.id,
        name: s.provider.name,
        email: s.provider.email,
        lat: s.provider.locationLat,
        lng: s.provider.locationLng,
        rating: s.provider.rating,
        postcode: s.provider.postcode,
      }));
    } else if (request.category === 'SPACE') {
      const spaces = await prisma.space.findMany({
        where: { available: true },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              rating: true,
              postcode: true,
              locationLat: true,
              locationLng: true,
            },
          },
        },
      });
      providers = spaces.map(s => ({
        id: s.owner.id,
        name: s.owner.name,
        email: s.owner.email,
        lat: s.owner.locationLat,
        lng: s.owner.locationLng,
        rating: s.owner.rating,
        postcode: s.owner.postcode,
      }));
    }

    // Filter out the seeker (can't accept own request)
    providers = providers.filter(p => p.id !== request.seeker.id);

    // Dedupe by user id
    const uniqueProviders = new Map<string, typeof providers[0]>();
    for (const p of providers) {
      if (!uniqueProviders.has(p.id)) {
        uniqueProviders.set(p.id, p);
      }
    }

    // Calculate distances and filter by radius
    const matchingProviders: MatchingProvider[] = [];

    for (const provider of uniqueProviders.values()) {
      let distance = 999;

      if (provider.lat && provider.lng) {
        distance = geocodingService.calculateDistance(
          request.locationLat,
          request.locationLng,
          provider.lat,
          provider.lng
        );
      }

      if (distance <= radius || radius >= 999) {
        // Calculate match score (0-100)
        const distanceScore = Math.max(0, 100 - (distance / radius) * 50);
        const ratingScore = (provider.rating || 3) * 10;
        const matchScore = Math.round((distanceScore + ratingScore) / 2);

        matchingProviders.push({
          id: provider.id,
          name: provider.name,
          email: provider.email,
          distance: Math.round(distance * 10) / 10,
          rating: provider.rating,
          matchScore,
        });
      }
    }

    // Sort by match score (best first)
    matchingProviders.sort((a, b) => b.matchScore - a.matchScore);

    return matchingProviders.slice(0, limit);
  }

  /**
   * Notify matching providers about a new request
   */
  async notifyMatchingProviders(requestId: string): Promise<number> {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { seeker: { select: { name: true } } },
    });

    if (!request) return 0;

    const providers = await this.findMatchingProviders(requestId);
    
    if (providers.length === 0) {
      logger.info('No matching providers found for request', { requestId });
      return 0;
    }

    // Send push notifications
    const notificationPromises = providers.map(async (provider) => {
      await notificationService.sendToUser(provider.id, {
        title: '🔔 New Job Near You!',
        body: `${request.seeker.name || 'Someone'} needs help: "${request.title}" - £${request.budget}`,
        tag: `request-${requestId}`,
        data: {
          type: 'quick-accept',
          requestId,
          budget: request.budget,
          category: request.category,
        },
        actions: [
          { action: 'accept', title: '✓ Accept' },
          { action: 'view', title: 'View Details' },
        ],
      });
    });

    await Promise.allSettled(notificationPromises);

    logger.info('Notified matching providers', {
      requestId,
      providerCount: providers.length,
    });

    return providers.length;
  }

  /**
   * Quick accept a request (creates pending transaction)
   */
  async quickAccept(
    requestId: string,
    providerId: string,
    proposedRate?: number
  ): Promise<QuickAcceptResult> {
    try {
      const request = await prisma.request.findUnique({
        where: { id: requestId },
        include: { seeker: { select: { id: true, name: true, email: true } } },
      });

      if (!request) {
        return { success: false, error: 'Request not found' };
      }

      if (request.status !== 'ACTIVE') {
        return { success: false, error: 'Request is no longer active' };
      }

      if (request.seekerId === providerId) {
        return { success: false, error: 'Cannot accept your own request' };
      }

      // Check if provider already responded
      const existingTransaction = await prisma.transaction.findFirst({
        where: {
          requestId,
          providerId,
        },
      });

      if (existingTransaction) {
        return { success: false, error: 'You have already responded to this request' };
      }

      // Get provider info
      const provider = await prisma.user.findUnique({
        where: { id: providerId },
        select: { name: true, email: true },
      });

      // Create pending transaction
      const rate = proposedRate || request.budget;
      const platformFee = Math.round(rate * 0.1); // 10% platform fee

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1); // Default 1 day

      const transaction = await prisma.transaction.create({
        data: {
          requestId,
          userId: request.seekerId,
          providerId,
          startDate,
          endDate,
          rentalFee: rate,
          platformFee,
          totalAmount: rate + platformFee,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          notes: 'Quick Accept - awaiting seeker confirmation',
        },
      });

      // Update request response count
      await prisma.request.update({
        where: { id: requestId },
        data: {
          responseCount: { increment: 1 },
        },
      });

      // Notify the seeker
      await notificationService.sendToUser(request.seekerId, {
        title: '🎉 Someone Accepted Your Request!',
        body: `${provider?.name || 'A provider'} wants to help with "${request.title}"`,
        tag: `accept-${requestId}`,
        data: {
          type: 'request-accepted',
          requestId,
          transactionId: transaction.id,
          providerId,
        },
        actions: [
          { action: 'confirm', title: 'Confirm & Pay' },
          { action: 'view', title: 'View Profile' },
        ],
      });

      logger.info('Quick accept successful', {
        requestId,
        providerId,
        transactionId: transaction.id,
      });

      return { success: true, transactionId: transaction.id };
    } catch (error) {
      logger.error('Quick accept failed', { requestId, providerId, error });
      return { success: false, error: 'Failed to accept request' };
    }
  }

  /**
   * Decline a request (mark as not interested)
   */
  async quickDecline(requestId: string, providerId: string): Promise<boolean> {
    try {
      // For now, just log the decline (could store for better matching in future)
      logger.info('Provider declined request', { requestId, providerId });
      return true;
    } catch (error) {
      logger.error('Quick decline failed', { requestId, providerId, error });
      return false;
    }
  }

  /**
   * Get pending responses for a provider
   */
  async getPendingResponses(providerId: string) {
    const transactions = await prisma.transaction.findMany({
      where: {
        providerId,
        status: 'PENDING',
      },
      include: {
        request: {
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            budget: true,
            urgency: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            rating: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdDate: 'desc' },
      take: 20,
    });

    return transactions;
  }
}

export const quickAcceptService = new QuickAcceptService();
