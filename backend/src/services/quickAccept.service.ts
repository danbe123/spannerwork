import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { notificationService } from './notification.service.js';

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
   *
   * FIX: Uses PostGIS for efficient database-level filtering instead of loading all records
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
    const radiusMeters = radius * 1609.34;

    // Use PostGIS to find providers within radius at the database level
    let providers: Array<{
      id: string;
      name: string | null;
      email: string;
      rating: number | null;
      distance_miles: number;
    }> = [];

    if (request.category === 'TOOLS') {
      providers = await prisma.$queryRaw<typeof providers>`
        SELECT DISTINCT ON (u.id)
          u.id,
          u.name,
          u.email,
          u.rating,
          ST_Distance(
            ST_SetSRID(ST_MakePoint(u."locationLng", u."locationLat"), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${request.locationLng}, ${request.locationLat}), 4326)::geography
          ) / 1609.34 as distance_miles
        FROM tools t
        JOIN users u ON t."ownerId" = u.id
        WHERE t.available = true
          AND u.id != ${request.seeker.id}
          AND u."locationLat" IS NOT NULL
          AND u."locationLng" IS NOT NULL
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(u."locationLng", u."locationLat"), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${request.locationLng}, ${request.locationLat}), 4326)::geography,
            ${radiusMeters}
          )
        ORDER BY u.id, distance_miles
        LIMIT ${limit * 3}
      `;
    } else if (request.category === 'EXPERTISE') {
      // For services, the service provider's location matters
      providers = await prisma.$queryRaw<typeof providers>`
        SELECT DISTINCT ON (u.id)
          u.id,
          u.name,
          u.email,
          u.rating,
          ST_Distance(
            ST_SetSRID(ST_MakePoint(s."locationLng", s."locationLat"), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${request.locationLng}, ${request.locationLat}), 4326)::geography
          ) / 1609.34 as distance_miles
        FROM services s
        JOIN users u ON s."providerId" = u.id
        WHERE s.available = true
          AND u.id != ${request.seeker.id}
          AND s."locationLat" IS NOT NULL
          AND s."locationLng" IS NOT NULL
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(s."locationLng", s."locationLat"), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${request.locationLng}, ${request.locationLat}), 4326)::geography,
            s.radius * 1609.34
          )
        ORDER BY u.id, distance_miles
        LIMIT ${limit * 3}
      `;
    } else if (request.category === 'SPACE') {
      providers = await prisma.$queryRaw<typeof providers>`
        SELECT DISTINCT ON (u.id)
          u.id,
          u.name,
          u.email,
          u.rating,
          ST_Distance(
            ST_SetSRID(ST_MakePoint(sp."locationLng", sp."locationLat"), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${request.locationLng}, ${request.locationLat}), 4326)::geography
          ) / 1609.34 as distance_miles
        FROM spaces sp
        JOIN users u ON sp."ownerId" = u.id
        WHERE sp.available = true
          AND u.id != ${request.seeker.id}
          AND sp."locationLat" IS NOT NULL
          AND sp."locationLng" IS NOT NULL
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(sp."locationLng", sp."locationLat"), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${request.locationLng}, ${request.locationLat}), 4326)::geography,
            ${radiusMeters}
          )
        ORDER BY u.id, distance_miles
        LIMIT ${limit * 3}
      `;
    }

    // Calculate match scores and format results
    const matchingProviders: MatchingProvider[] = providers.map(provider => {
      const distance = Number(provider.distance_miles);
      const distanceScore = Math.max(0, 100 - (distance / radius) * 50);
      const ratingScore = (provider.rating || 3) * 10;
      const matchScore = Math.round((distanceScore + ratingScore) / 2);

      return {
        id: provider.id,
        name: provider.name,
        email: provider.email,
        distance: Math.round(distance * 10) / 10,
        rating: provider.rating,
        matchScore,
      };
    });

    // Sort by match score (best first) and limit
    matchingProviders.sort((a, b) => b.matchScore - a.matchScore);
    return matchingProviders.slice(0, limit);
  }

  /**
   * Notify matching providers about a new request
   * @param requestId - The request to notify about
   * @param userId - The user triggering the notification (must be the request owner)
   */
  async notifyMatchingProviders(requestId: string, userId?: string): Promise<number> {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { seeker: { select: { id: true, name: true } } },
    });

    if (!request) return 0;

    // Verify ownership to prevent spam/abuse
    if (userId && request.seeker.id !== userId) {
      logger.warn('Notify attempt by non-owner', { requestId, userId, ownerId: request.seeker.id });
      throw new Error('Not authorized to notify for this request');
    }

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

      // Use database transaction to prevent race conditions
      // (two concurrent quick-accepts from same provider creating duplicates)
      const result = await prisma.$transaction(async (tx) => {
        // Check if provider already responded (inside transaction for atomicity)
        const existingTransaction = await tx.transaction.findFirst({
          where: {
            requestId,
            providerId,
          },
        });

        if (existingTransaction) {
          return { success: false as const, error: 'You have already responded to this request' };
        }

        // Get provider info including plan for correct fee calculation
        const provider = await tx.user.findUnique({
          where: { id: providerId },
          select: { name: true, email: true, providerPlan: true },
        });

        // Calculate platform fee based on provider's plan tier
        // BUSINESS: 2%, PRO: 3%, FREE: 5%
        const rate = proposedRate || request.budget;
        const providerPlan = provider?.providerPlan || 'FREE';
        const platformFeePercent = providerPlan === 'BUSINESS' ? 2 : providerPlan === 'PRO' ? 3 : 5;
        const platformFee = Math.round(rate * (platformFeePercent / 100));

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 1); // Default 1 day

        const transaction = await tx.transaction.create({
          data: {
            requestId,
            userId: request.seekerId,
            providerId,
            startDate,
            endDate,
            rentalFee: rate,
            platformFee,
            totalAmount: rate + platformFee,
            providerPlanAtBooking: providerPlan,
            platformFeePercent,
            applicationFeeAmount: platformFee,
            status: 'PENDING',
            paymentStatus: 'PENDING',
            notes: 'Quick Accept - awaiting seeker confirmation',
          },
        });

        // Update request response count
        await tx.request.update({
          where: { id: requestId },
          data: {
            responseCount: { increment: 1 },
          },
        });

        return { success: true as const, transactionId: transaction.id, provider };
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const { transactionId, provider } = result;

      // Notify the seeker
      await notificationService.sendToUser(request.seekerId, {
        title: '🎉 Someone Accepted Your Request!',
        body: `${provider?.name || 'A provider'} wants to help with "${request.title}"`,
        tag: `accept-${requestId}`,
        data: {
          type: 'request-accepted',
          requestId,
          transactionId,
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
        transactionId,
      });

      return { success: true, transactionId };
    } catch (error) {
      logger.error('Quick accept failed', {
        requestId,
        providerId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
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
        // Only include transactions where the request still exists
        request: {
          isNot: null,
        },
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
            createdDate: true,
            locationAddress: true,
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

    // Filter out any null requests (extra safety) and transform response
    return transactions
      .filter(t => t.request !== null)
      .map(t => ({
        id: t.id,
        createdDate: t.createdDate,
        request: {
          ...t.request,
          // Include transaction createdDate as fallback if request doesn't have one
          createdDate: t.request?.createdDate || t.createdDate,
        },
        user: t.user,
      }));
  }
}

export const quickAcceptService = new QuickAcceptService();
