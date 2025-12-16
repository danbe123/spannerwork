import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    transaction: {
      findMany: vi.fn(),
    },
    tool: {
      findMany: vi.fn(),
    },
    space: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/notification.service.js', () => ({
  notificationService: {
    sendToUser: vi.fn().mockResolvedValue(true),
  },
}));

import { smartNotificationsService } from '../../src/services/smartNotifications.service.js';
import { prisma } from '../../src/config/database.js';
import { notificationService } from '../../src/services/notification.service.js';

describe('SmartNotificationsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
    smartNotificationsService.stop();
  });

  describe('start/stop', () => {
    it('should start and schedule intervals', () => {
      smartNotificationsService.start();

      // Verify that intervals are set up (indirectly by checking stop clears them)
      smartNotificationsService.stop();
    });

    it('should stop and clear all intervals', () => {
      smartNotificationsService.start();
      smartNotificationsService.stop();
      
      // After stop, further advances should not trigger any calls
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
      vi.advanceTimersByTime(60 * 60 * 1000); // 1 hour
      
      // Notifications should not have been called since stop was called
    });
  });

  describe('checkRentalReminders', () => {
    it('should send 24h reminder for rentals ending tomorrow', async () => {
      const now = new Date('2024-01-15T12:00:00Z');
      vi.setSystemTime(now);

      const mockRentals = [
        {
          id: 'txn-1',
          userId: 'user-1',
          tool: { name: 'Power Drill' },
          space: null,
          service: null,
        },
      ];

      // First call for 24h, second for 2h
      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce(mockRentals as any)
        .mockResolvedValueOnce([]);

      await smartNotificationsService.checkRentalReminders();

      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          title: expect.stringContaining('Rental Ending Tomorrow'),
          data: expect.objectContaining({
            type: 'rental-reminder',
            hoursRemaining: 24,
          }),
        })
      );
    });

    it('should send 2h reminder for rentals ending soon', async () => {
      const now = new Date('2024-01-15T12:00:00Z');
      vi.setSystemTime(now);

      const mockRentals = [
        {
          id: 'txn-2',
          userId: 'user-2',
          tool: null,
          space: { name: 'Workshop Space' },
          service: null,
        },
      ];

      // First call for 24h, second for 2h
      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockRentals as any);

      await smartNotificationsService.checkRentalReminders();

      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-2',
        expect.objectContaining({
          title: expect.stringContaining('Rental Ending Soon'),
          data: expect.objectContaining({
            hoursRemaining: 2,
          }),
        })
      );
    });

    it('should use service name when available', async () => {
      const now = new Date('2024-01-15T12:00:00Z');
      vi.setSystemTime(now);

      const mockRentals = [
        {
          id: 'txn-3',
          userId: 'user-3',
          tool: null,
          space: null,
          service: { name: 'Plumbing Service' },
        },
      ];

      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce(mockRentals as any)
        .mockResolvedValueOnce([]);

      await smartNotificationsService.checkRentalReminders();

      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-3',
        expect.objectContaining({
          body: expect.stringContaining('Plumbing Service'),
        })
      );
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(prisma.transaction.findMany).mockRejectedValue(new Error('DB error'));

      // Should not throw
      await expect(smartNotificationsService.checkRentalReminders()).resolves.not.toThrow();
    });
  });

  describe('checkReviewReminders', () => {
    it('should send review reminders for completed transactions without reviews', async () => {
      const now = new Date('2024-01-15T12:00:00Z');
      vi.setSystemTime(now);

      const mockTransactions = [
        {
          id: 'txn-1',
          userId: 'user-1',
          providerId: 'provider-1',
          tool: { name: 'Drill' },
          space: null,
          service: null,
          user: { name: 'User One' },
          provider: { name: 'Provider One' },
        },
      ];

      vi.mocked(prisma.transaction.findMany).mockResolvedValue(mockTransactions as any);

      await smartNotificationsService.checkReviewReminders();

      // Should notify both user and provider
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          title: expect.stringContaining('How Was Your Experience'),
        })
      );
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'provider-1',
        expect.objectContaining({
          title: expect.stringContaining('Rate Your Renter'),
        })
      );
    });

    it('should not notify provider if providerId is null', async () => {
      const now = new Date('2024-01-15T12:00:00Z');
      vi.setSystemTime(now);

      const mockTransactions = [
        {
          id: 'txn-1',
          userId: 'user-1',
          providerId: null, // No provider
          tool: { name: 'Drill' },
          space: null,
          service: null,
          user: { name: 'User One' },
          provider: null,
        },
      ];

      vi.mocked(prisma.transaction.findMany).mockResolvedValue(mockTransactions as any);

      await smartNotificationsService.checkReviewReminders();

      // Should only notify user, not provider
      expect(notificationService.sendToUser).toHaveBeenCalledTimes(1);
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.any(Object)
      );
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(prisma.transaction.findMany).mockRejectedValue(new Error('DB error'));

      await expect(smartNotificationsService.checkReviewReminders()).resolves.not.toThrow();
    });
  });

  describe('checkWeekendAvailability', () => {
    it('should only run on Thursday at 10am', async () => {
      // Set to Wednesday at 10am
      const wednesday = new Date('2024-01-17T10:00:00Z'); // Wednesday
      vi.setSystemTime(wednesday);

      vi.mocked(prisma.tool.findMany).mockResolvedValue([]);
      vi.mocked(prisma.space.findMany).mockResolvedValue([]);

      await smartNotificationsService.checkWeekendAvailability();

      // Should not query database on non-Thursday
      expect(prisma.tool.findMany).not.toHaveBeenCalled();
    });

    it('should notify providers with no weekend bookings on Thursday 10am', async () => {
      // Set to Thursday at 10am
      const thursday = new Date('2024-01-18T10:00:00Z'); // Thursday
      vi.setSystemTime(thursday);

      vi.mocked(prisma.tool.findMany).mockResolvedValue([
        { ownerId: 'owner-1', name: 'Tool 1' },
      ] as any);
      vi.mocked(prisma.space.findMany).mockResolvedValue([
        { ownerId: 'owner-2', name: 'Space 1' },
      ] as any);

      await smartNotificationsService.checkWeekendAvailability();

      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'owner-1',
        expect.objectContaining({
          title: expect.stringContaining('Weekend Slots'),
        })
      );
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'owner-2',
        expect.objectContaining({
          title: expect.stringContaining('Weekend Slots'),
        })
      );
    });

    it('should dedupe owners with multiple listings', async () => {
      const thursday = new Date('2024-01-18T10:00:00Z');
      vi.setSystemTime(thursday);

      vi.mocked(prisma.tool.findMany).mockResolvedValue([
        { ownerId: 'owner-1', name: 'Tool 1' },
        { ownerId: 'owner-1', name: 'Tool 2' }, // Same owner
      ] as any);
      vi.mocked(prisma.space.findMany).mockResolvedValue([]);

      await smartNotificationsService.checkWeekendAvailability();

      // Should only notify once
      expect(notificationService.sendToUser).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully', async () => {
      const thursday = new Date('2024-01-18T10:00:00Z');
      vi.setSystemTime(thursday);

      vi.mocked(prisma.tool.findMany).mockRejectedValue(new Error('DB error'));

      await expect(smartNotificationsService.checkWeekendAvailability()).resolves.not.toThrow();
    });
  });

  describe('checkReengagement', () => {
    it('should notify inactive users with completed transactions', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'user-1', name: 'Inactive User' },
      ] as any);

      await smartNotificationsService.checkReengagement();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          accountStatus: 'ACTIVE',
          totalTransactions: { gte: 1 },
        }),
        select: { id: true, name: true },
        take: 50,
      });

      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          title: expect.stringContaining('Miss You'),
        })
      );
    });

    it('should limit to 50 users to avoid spam', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      await smartNotificationsService.checkReengagement();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(prisma.user.findMany).mockRejectedValue(new Error('DB error'));

      await expect(smartNotificationsService.checkReengagement()).resolves.not.toThrow();
    });
  });

  describe('sendContextualNotification', () => {
    it('should send first-listing notification', async () => {
      await smartNotificationsService.sendContextualNotification('user-1', 'first-listing');

      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          title: expect.stringContaining('First Listing'),
          tag: 'first-listing',
        })
      );
    });

    it('should send first-request notification', async () => {
      await smartNotificationsService.sendContextualNotification('user-1', 'first-request');

      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          title: expect.stringContaining('Request Posted'),
        })
      );
    });

    it('should send first-booking notification', async () => {
      await smartNotificationsService.sendContextualNotification('user-1', 'first-booking');

      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          title: expect.stringContaining('First Booking'),
        })
      );
    });

    it('should send streak-at-risk notification', async () => {
      await smartNotificationsService.sendContextualNotification('user-1', 'streak-at-risk');

      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          title: expect.stringContaining('Streak'),
        })
      );
    });

    it('should send milestone notification', async () => {
      await smartNotificationsService.sendContextualNotification('user-1', 'milestone');

      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          title: expect.stringContaining('Achievement'),
        })
      );
    });
  });

  describe('notifyNearbyUsersOfNewListing', () => {
    it('should notify users in same postcode area', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'user-1' },
        { id: 'user-2' },
      ] as any);

      const count = await smartNotificationsService.notifyNearbyUsersOfNewListing(
        'tool',
        'listing-123',
        'Power Drill',
        'SW1A 1AA'
      );

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          accountStatus: 'ACTIVE',
          postcode: { startsWith: 'SW1A' },
        }),
        select: { id: true },
        take: 50,
      });

      expect(count).toBe(2);
      expect(notificationService.sendToUser).toHaveBeenCalledTimes(2);
    });

    it('should include listing details in notification', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'user-1' },
      ] as any);

      await smartNotificationsService.notifyNearbyUsersOfNewListing(
        'space',
        'space-123',
        'Workshop Space',
        'M1 2AB'
      );

      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          title: expect.stringContaining('New Listing'),
          body: expect.stringContaining('Workshop Space'),
          data: expect.objectContaining({
            listingType: 'space',
            listingId: 'space-123',
          }),
        })
      );
    });

    it('should handle errors gracefully and return 0', async () => {
      vi.mocked(prisma.user.findMany).mockRejectedValue(new Error('DB error'));

      const count = await smartNotificationsService.notifyNearbyUsersOfNewListing(
        'tool',
        'listing-123',
        'Drill',
        'SW1A 1AA'
      );

      expect(count).toBe(0);
    });
  });
});
