import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    tool: {
      findUnique: vi.fn(),
    },
    space: {
      findUnique: vi.fn(),
    },
    service: {
      findUnique: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    booking: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../src/config/env.js', () => ({
  env: {
    PLATFORM_FEE_PERCENTAGE: '5',
  },
}));

vi.mock('../../src/services/sms.service.js', () => ({
  smsService: {
    sendSms: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { TransactionService } from '../../src/services/transaction.service.js';
import { prisma } from '../../src/config/database.js';

describe('TransactionService', () => {
  let transactionService: TransactionService;

  beforeEach(() => {
    transactionService = new TransactionService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('create', () => {
    it('should create a transaction for a tool rental with server-side fee calculation', async () => {
      const tool = {
        id: 'tool-123',
        name: 'Power Drill',
        ownerId: 'owner-123',
        available: true,
        dailyRate: 2000, // £20/day in pence
        weeklyRate: 10000, // £100/week in pence
      };
      
      const transactionData = {
        userId: 'user-123',
        toolId: 'tool-123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-02'), // 1 day rental
        // Note: rentalFee is no longer passed - calculated server-side
      };

      const createdTransaction = {
        id: 'txn-123',
        ...transactionData,
        rentalFee: 2000, // Calculated from dailyRate
        platformFee: 100, // 5% of £20
        totalAmount: 2100,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        providerId: 'owner-123',
        tool,
      };

      // Tool lookup now happens INSIDE $transaction
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          tool: { findUnique: vi.fn().mockResolvedValue(tool as any) },
          transaction: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(createdTransaction),
          },
          booking: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-123',
        phone: '+447123456789',
        name: 'Test User',
      } as any);

      const result = await transactionService.create(transactionData);

      expect(result).toEqual(createdTransaction);
    });

    it('should calculate rental fee based on tool daily rate', async () => {
      const tool = {
        id: 'tool-123',
        ownerId: 'owner-123',
        available: true,
        dailyRate: 5000, // £50/day in pence
        weeklyRate: null,
      };

      // Tool lookup now happens INSIDE $transaction
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          tool: { findUnique: vi.fn().mockResolvedValue(tool as any) },
          transaction: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation((args) => {
              // Verify the rental fee is calculated from dailyRate (2 days)
              expect(args.data.rentalFee).toBe(10000); // 2 days * £50
              expect(args.data.platformFee).toBe(500); // 5% of 10000
              expect(args.data.totalAmount).toBe(10500);
              return Promise.resolve({ id: 'txn-123' });
            }),
          },
          booking: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await transactionService.create({
        userId: 'user-123',
        toolId: 'tool-123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-03'), // 2 days
      });
    });

    it('should use weekly rate for rentals >= 7 days', async () => {
      const tool = {
        id: 'tool-123',
        ownerId: 'owner-123',
        available: true,
        dailyRate: 2000, // £20/day
        weeklyRate: 10000, // £100/week (cheaper than 7 * £20 = £140)
      };

      // Tool lookup now happens INSIDE $transaction
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          tool: { findUnique: vi.fn().mockResolvedValue(tool as any) },
          transaction: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation((args) => {
              // Should use weekly rate: 1 week = £100
              expect(args.data.rentalFee).toBe(10000);
              return Promise.resolve({ id: 'txn-123' });
            }),
          },
          booking: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await transactionService.create({
        userId: 'user-123',
        toolId: 'tool-123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-08'), // 7 days
      });
    });

    it('should throw error for unavailable tool', async () => {
      const tool = {
        id: 'tool-123',
        ownerId: 'owner-123',
        available: false, // Not available
        dailyRate: 2000,
      };

      // Tool lookup now happens INSIDE $transaction
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          tool: { findUnique: vi.fn().mockResolvedValue(tool as any) },
        };
        return callback(mockTx);
      });

      await expect(
        transactionService.create({
          userId: 'user-123',
          toolId: 'tool-123',
          startDate: new Date(),
          endDate: new Date(),
        })
      ).rejects.toThrow('Tool is not available');
    });

    it('should throw error for non-existent tool', async () => {
      // Tool lookup now happens INSIDE $transaction
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          tool: { findUnique: vi.fn().mockResolvedValue(null) },
        };
        return callback(mockTx);
      });

      await expect(
        transactionService.create({
          userId: 'user-123',
          toolId: 'nonexistent-tool',
          startDate: new Date(),
          endDate: new Date(),
        })
      ).rejects.toThrow('Tool not found');
    });

    it('should throw error for booking conflict', async () => {
      const tool = {
        id: 'tool-123',
        ownerId: 'owner-123',
        available: true,
        dailyRate: 2000,
      };

      const existingTransaction = {
        id: 'existing-txn',
        toolId: 'tool-123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-03'),
      };

      // Tool lookup now happens INSIDE $transaction
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          tool: { findUnique: vi.fn().mockResolvedValue(tool as any) },
          transaction: { findFirst: vi.fn().mockResolvedValue(existingTransaction) },
          booking: { create: vi.fn() },
        };
        return callback(mockTx);
      });

      await expect(
        transactionService.create({
          userId: 'user-123',
          toolId: 'tool-123',
          startDate: new Date('2024-01-02'),
          endDate: new Date('2024-01-04'),
        })
      ).rejects.toThrow('Booking conflict');
    });
  });

  describe('checkBookingConflict', () => {
    it('should return true when conflict exists', async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
        id: 'existing-txn',
      } as any);

      const result = await transactionService.checkBookingConflict({
        toolId: 'tool-123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-02'),
      });

      expect(result).toBe(true);
    });

    it('should return false when no conflict', async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null);

      const result = await transactionService.checkBookingConflict({
        toolId: 'tool-123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-02'),
      });

      expect(result).toBe(false);
    });

    it('should exclude specified transaction from conflict check', async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null);

      await transactionService.checkBookingConflict({
        toolId: 'tool-123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-02'),
        excludeTransactionId: 'txn-to-exclude',
      });

      expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: { not: 'txn-to-exclude' },
        }),
      });
    });
  });

  describe('list', () => {
    it('should list user transactions with pagination', async () => {
      const transactions = [
        { id: 'txn-1', userId: 'user-123' },
        { id: 'txn-2', userId: 'user-123' },
      ];

      vi.mocked(prisma.transaction.findMany).mockResolvedValue(transactions as any);
      vi.mocked(prisma.transaction.count).mockResolvedValue(2);

      const result = await transactionService.list('user-123', {
        page: 1,
        limit: 10,
      });

      expect(result.transactions).toEqual(transactions);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });
    });

    it('should filter by status', async () => {
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
      vi.mocked(prisma.transaction.count).mockResolvedValue(0);

      await transactionService.list('user-123', {
        status: 'COMPLETED',
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'COMPLETED',
          }),
        })
      );
    });

    it('should list as provider when specified', async () => {
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
      vi.mocked(prisma.transaction.count).mockResolvedValue(0);

      await transactionService.list('user-123', {
        asProvider: true,
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { providerId: 'user-123' },
        })
      );
    });
  });

  describe('getById', () => {
    it('should return transaction by ID', async () => {
      const transaction = {
        id: 'txn-123',
        userId: 'user-123',
        tool: { id: 'tool-123', name: 'Drill' },
      };

      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(transaction as any);

      const result = await transactionService.getById('txn-123');

      expect(result).toEqual(transaction);
    });

    it('should throw error for non-existent transaction', async () => {
      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(null);

      await expect(
        transactionService.getById('nonexistent-txn')
      ).rejects.toThrow('Transaction not found');
    });
  });

  describe('updateStatus', () => {
    it('should allow provider to confirm booking', async () => {
      const transaction = {
        userId: 'customer-123',
        providerId: 'provider-123',
        status: 'PENDING',
      };

      vi.mocked(prisma.transaction.findUnique)
        .mockResolvedValueOnce(transaction as any); // First call for auth check

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          transaction: {
            update: vi.fn().mockResolvedValue({ ...transaction, status: 'CONFIRMED' }),
          },
          booking: { updateMany: vi.fn().mockResolvedValue({}) },
          user: { update: vi.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await transactionService.updateStatus(
        'txn-123',
        'provider-123',
        'CONFIRMED'
      );

      expect(result.status).toBe('CONFIRMED');
    });

    it('should not allow customer to confirm booking', async () => {
      const transaction = {
        userId: 'customer-123',
        providerId: 'provider-123',
        status: 'PENDING',
      };

      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(transaction as any);

      await expect(
        transactionService.updateStatus('txn-123', 'customer-123', 'CONFIRMED')
      ).rejects.toThrow('Only the provider can confirm bookings');
    });

    it('should allow customer to mark as completed', async () => {
      const transaction = {
        userId: 'customer-123',
        providerId: 'provider-123',
        status: 'IN_PROGRESS',
      };

      vi.mocked(prisma.transaction.findUnique)
        .mockResolvedValueOnce(transaction as any);

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          transaction: {
            update: vi.fn().mockResolvedValue({ ...transaction, status: 'COMPLETED' }),
          },
          booking: { updateMany: vi.fn().mockResolvedValue({}) },
          user: { update: vi.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await transactionService.updateStatus(
        'txn-123',
        'customer-123',
        'COMPLETED'
      );

      expect(result.status).toBe('COMPLETED');
    });

    it('should not allow provider to mark as completed', async () => {
      const transaction = {
        userId: 'customer-123',
        providerId: 'provider-123',
        status: 'IN_PROGRESS',
      };

      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(transaction as any);

      await expect(
        transactionService.updateStatus('txn-123', 'provider-123', 'COMPLETED')
      ).rejects.toThrow('Only the customer can mark transaction as completed');
    });

    it('should reject unauthorized users', async () => {
      const transaction = {
        userId: 'customer-123',
        providerId: 'provider-123',
        status: 'PENDING',
      };

      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(transaction as any);

      await expect(
        transactionService.updateStatus('txn-123', 'unauthorized-user', 'CONFIRMED')
      ).rejects.toThrow('Not authorized to update this transaction');
    });
  });

  describe('cancel', () => {
    it('should allow user to cancel pending transaction', async () => {
      const transaction = {
        userId: 'user-123',
        providerId: 'provider-123',
        status: 'PENDING',
      };

      vi.mocked(prisma.transaction.findUnique)
        .mockResolvedValueOnce(transaction as any) // For cancel()
        .mockResolvedValueOnce(transaction as any); // For updateStatus()

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          transaction: {
            update: vi.fn().mockResolvedValue({ ...transaction, status: 'CANCELLED' }),
          },
          booking: { updateMany: vi.fn().mockResolvedValue({}) },
          user: { update: vi.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await transactionService.cancel('txn-123', 'user-123');

      expect(result.status).toBe('CANCELLED');
    });

    it('should not allow cancellation of in-progress transaction', async () => {
      const transaction = {
        userId: 'user-123',
        status: 'IN_PROGRESS',
      };

      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(transaction as any);

      await expect(
        transactionService.cancel('txn-123', 'user-123')
      ).rejects.toThrow('Cannot cancel a transaction that is already in progress or completed');
    });

    it('should allow provider to cancel pending transaction', async () => {
      const transaction = {
        userId: 'user-123',
        providerId: 'provider-123',
        status: 'PENDING',
      };

      vi.mocked(prisma.transaction.findUnique)
        .mockResolvedValueOnce(transaction as any) // For cancel()
        .mockResolvedValueOnce(transaction as any); // For updateStatus()

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          transaction: {
            update: vi.fn().mockResolvedValue({ ...transaction, status: 'CANCELLED' }),
          },
          booking: { updateMany: vi.fn().mockResolvedValue({}) },
          user: { update: vi.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      // Provider should be able to cancel
      const result = await transactionService.cancel('txn-123', 'provider-123');

      expect(result.status).toBe('CANCELLED');
    });

    it('should not allow unauthorized user to cancel', async () => {
      const transaction = {
        userId: 'user-123',
        providerId: 'provider-123',
        status: 'PENDING',
      };

      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(transaction as any);

      // Neither customer nor provider - should fail
      await expect(
        transactionService.cancel('txn-123', 'other-user')
      ).rejects.toThrow('Not authorized to cancel this transaction');
    });
  });

  describe('optimistic locking', () => {
    it('should increment version on status update', async () => {
      const transaction = {
        userId: 'customer-123',
        providerId: 'provider-123',
        status: 'PENDING',
        version: 1,
      };

      let updateArgs: any = null;

      vi.mocked(prisma.transaction.findUnique)
        .mockResolvedValueOnce(transaction as any);

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          transaction: {
            update: vi.fn().mockImplementation((args) => {
              updateArgs = args;
              return Promise.resolve({ ...transaction, status: 'CONFIRMED', version: 2 });
            }),
          },
          booking: { updateMany: vi.fn().mockResolvedValue({}) },
          user: { update: vi.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await transactionService.updateStatus('txn-123', 'provider-123', 'CONFIRMED');

      // Verify version increment was requested
      expect(updateArgs.data.version).toEqual({ increment: 1 });
    });

    it('should use expectedVersion in where clause when provided', async () => {
      const transaction = {
        userId: 'customer-123',
        providerId: 'provider-123',
        status: 'PENDING',
        version: 5,
      };

      let updateArgs: any = null;

      vi.mocked(prisma.transaction.findUnique)
        .mockResolvedValueOnce(transaction as any);

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          transaction: {
            update: vi.fn().mockImplementation((args) => {
              updateArgs = args;
              return Promise.resolve({ ...transaction, status: 'CONFIRMED', version: 6 });
            }),
          },
          booking: { updateMany: vi.fn().mockResolvedValue({}) },
          user: { update: vi.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await transactionService.updateStatus('txn-123', 'provider-123', 'CONFIRMED', 5);

      // Verify expectedVersion was used in where clause
      expect(updateArgs.where).toEqual({ id: 'txn-123', version: 5 });
    });

    it('should throw error on optimistic locking conflict', async () => {
      const transaction = {
        userId: 'customer-123',
        providerId: 'provider-123',
        status: 'PENDING',
        version: 1,
      };

      vi.mocked(prisma.transaction.findUnique)
        .mockResolvedValueOnce(transaction as any);

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          transaction: {
            update: vi.fn().mockRejectedValue({ code: 'P2025' }), // Prisma "not found" error (version mismatch)
          },
        };
        return callback(mockTx);
      });

      await expect(
        transactionService.updateStatus('txn-123', 'provider-123', 'CONFIRMED', 1)
      ).rejects.toThrow('Transaction was modified by another request. Please refresh and try again.');
    });
  });

  describe('space booking', () => {
    it('should create a transaction for a space rental with hourly rate', async () => {
      const space = {
        id: 'space-123',
        ownerId: 'owner-123',
        available: true,
        hourlyRate: 1000, // £10/hour
        dailyRate: 5000, // £50/day
        weeklyRate: 25000, // £250/week
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          space: { findUnique: vi.fn().mockResolvedValue(space as any) },
          transaction: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation((args) => {
              // For a 1-day rental, should use daily rate
              expect(args.data.rentalFee).toBe(5000); // £50/day
              expect(args.data.platformFee).toBe(250); // 5% of £50
              expect(args.data.providerId).toBe('owner-123');
              return Promise.resolve({ id: 'txn-123', ...args.data });
            }),
          },
          booking: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await transactionService.create({
        userId: 'user-123',
        spaceId: 'space-123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-02'), // 1 day
      });
    });

    it('should use weekly rate for space rentals >= 7 days', async () => {
      const space = {
        id: 'space-123',
        ownerId: 'owner-123',
        available: true,
        hourlyRate: 1000,
        dailyRate: 5000,
        weeklyRate: 25000, // Weekly is cheaper than 7 * daily
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          space: { findUnique: vi.fn().mockResolvedValue(space as any) },
          transaction: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation((args) => {
              // Should use weekly rate: 1 week = £250
              expect(args.data.rentalFee).toBe(25000);
              return Promise.resolve({ id: 'txn-123' });
            }),
          },
          booking: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await transactionService.create({
        userId: 'user-123',
        spaceId: 'space-123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-08'), // 7 days
      });
    });

    it('should throw error for unavailable space', async () => {
      const space = {
        id: 'space-123',
        ownerId: 'owner-123',
        available: false,
        dailyRate: 5000,
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          space: { findUnique: vi.fn().mockResolvedValue(space as any) },
        };
        return callback(mockTx);
      });

      await expect(
        transactionService.create({
          userId: 'user-123',
          spaceId: 'space-123',
          startDate: new Date(),
          endDate: new Date(),
        })
      ).rejects.toThrow('Space is not available');
    });
  });

  describe('service booking', () => {
    it('should create a transaction for a service with hourly rate and callout fee', async () => {
      const service = {
        id: 'service-123',
        providerId: 'provider-123',
        available: true,
        hourlyRate: 3000, // £30/hour
        calloutFee: 2000, // £20 callout
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          service: { findUnique: vi.fn().mockResolvedValue(service as any) },
          transaction: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation((args) => {
              // 2 hours * £30 + £20 callout = £80
              expect(args.data.rentalFee).toBe(8000);
              expect(args.data.platformFee).toBe(400); // 5% of £80
              expect(args.data.providerId).toBe('provider-123');
              return Promise.resolve({ id: 'txn-123', ...args.data });
            }),
          },
          booking: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await transactionService.create({
        userId: 'user-123',
        serviceId: 'service-123',
        startDate: new Date('2024-01-01T10:00:00'),
        endDate: new Date('2024-01-01T12:00:00'), // 2 hours
      });
    });

    it('should handle service without callout fee', async () => {
      const service = {
        id: 'service-123',
        providerId: 'provider-123',
        available: true,
        hourlyRate: 5000, // £50/hour
        calloutFee: null, // No callout fee
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          service: { findUnique: vi.fn().mockResolvedValue(service as any) },
          transaction: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation((args) => {
              // 3 hours * £50 = £150
              expect(args.data.rentalFee).toBe(15000);
              return Promise.resolve({ id: 'txn-123' });
            }),
          },
          booking: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await transactionService.create({
        userId: 'user-123',
        serviceId: 'service-123',
        startDate: new Date('2024-01-01T10:00:00'),
        endDate: new Date('2024-01-01T13:00:00'), // 3 hours
      });
    });

    it('should throw error for unavailable service', async () => {
      const service = {
        id: 'service-123',
        providerId: 'provider-123',
        available: false,
        hourlyRate: 5000,
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          service: { findUnique: vi.fn().mockResolvedValue(service as any) },
        };
        return callback(mockTx);
      });

      await expect(
        transactionService.create({
          userId: 'user-123',
          serviceId: 'service-123',
          startDate: new Date(),
          endDate: new Date(),
        })
      ).rejects.toThrow('Service is not available');
    });
  });

  describe('status validation', () => {
    it('should ignore invalid status values in list query', async () => {
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
      vi.mocked(prisma.transaction.count).mockResolvedValue(0);

      // Pass invalid status - should be ignored (no filter applied)
      await transactionService.list('user-123', {
        status: 'INVALID_STATUS',
      });

      // Should NOT have status in where clause (invalid status ignored)
      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123' }, // No status filter
        })
      );
    });
  });
});
