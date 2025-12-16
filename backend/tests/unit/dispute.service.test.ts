import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    transaction: {
      findUnique: vi.fn(),
    },
    dispute: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
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

import { DisputeService } from '../../src/services/dispute.service.js';
import { prisma } from '../../src/config/database.js';

describe('DisputeService', () => {
  let disputeService: DisputeService;

  beforeEach(() => {
    vi.clearAllMocks();
    disputeService = new DisputeService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('create', () => {
    it('should create a dispute when user is part of transaction', async () => {
      const mockTransaction = {
        id: 'tx-1',
        userId: 'user-1',
        providerId: 'provider-1',
        status: 'COMPLETED',
      };

      const mockDispute = {
        id: 'dispute-1',
        transactionId: 'tx-1',
        initiatorId: 'user-1',
        respondentId: 'provider-1',
        reason: 'Item damaged',
        description: 'The item was damaged on return',
        status: 'OPEN',
      };

      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(mockTransaction as any);
      vi.mocked(prisma.dispute.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.dispute.create).mockResolvedValue(mockDispute as any);

      const result = await disputeService.create({
        initiatorId: 'user-1',
        transactionId: 'tx-1',
        reason: 'Item damaged',
        description: 'The item was damaged on return',
      });

      expect(prisma.transaction.findUnique).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        select: expect.any(Object),
      });
      expect(prisma.dispute.findFirst).toHaveBeenCalled();
      expect(prisma.dispute.create).toHaveBeenCalled();
      expect(result).toEqual(mockDispute);
    });

    it('should throw error when transaction not found', async () => {
      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(null);

      await expect(
        disputeService.create({
          initiatorId: 'user-1',
          transactionId: 'tx-nonexistent',
          reason: 'Test',
          description: 'Test description',
        })
      ).rejects.toThrow('Transaction not found');
    });

    it('should throw error when user is not part of transaction', async () => {
      const mockTransaction = {
        id: 'tx-1',
        userId: 'other-user',
        providerId: 'other-provider',
        status: 'COMPLETED',
      };

      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(mockTransaction as any);

      await expect(
        disputeService.create({
          initiatorId: 'user-1',
          transactionId: 'tx-1',
          reason: 'Test',
          description: 'Test description',
        })
      ).rejects.toThrow('You can only dispute transactions you were part of');
    });

    it('should throw error when active dispute already exists', async () => {
      const mockTransaction = {
        id: 'tx-1',
        userId: 'user-1',
        providerId: 'provider-1',
        status: 'COMPLETED',
      };

      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(mockTransaction as any);
      vi.mocked(prisma.dispute.findFirst).mockResolvedValue({ id: 'existing-dispute' } as any);

      await expect(
        disputeService.create({
          initiatorId: 'user-1',
          transactionId: 'tx-1',
          reason: 'Test',
          description: 'Test description',
        })
      ).rejects.toThrow('An active dispute already exists for this transaction');
    });
  });

  describe('list', () => {
    it('should list disputes with pagination', async () => {
      const mockDisputes = [
        { id: 'dispute-1', status: 'OPEN' },
        { id: 'dispute-2', status: 'UNDER_REVIEW' },
      ];

      vi.mocked(prisma.dispute.findMany).mockResolvedValue(mockDisputes as any);
      vi.mocked(prisma.dispute.count).mockResolvedValue(2);

      const result = await disputeService.list({ page: 1, limit: 10 });

      expect(result.disputes).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter disputes by status', async () => {
      vi.mocked(prisma.dispute.findMany).mockResolvedValue([]);
      vi.mocked(prisma.dispute.count).mockResolvedValue(0);

      await disputeService.list({ status: 'OPEN' });

      expect(prisma.dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'OPEN' }),
        })
      );
    });

    it('should filter by user in non-admin view', async () => {
      vi.mocked(prisma.dispute.findMany).mockResolvedValue([]);
      vi.mocked(prisma.dispute.count).mockResolvedValue(0);

      await disputeService.list({ userId: 'user-1', adminView: false });

      expect(prisma.dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ initiatorId: 'user-1' }, { respondentId: 'user-1' }],
          }),
        })
      );
    });
  });

  describe('getById', () => {
    it('should return dispute when found', async () => {
      const mockDispute = {
        id: 'dispute-1',
        initiatorId: 'user-1',
        respondentId: 'provider-1',
      };

      vi.mocked(prisma.dispute.findUnique).mockResolvedValue(mockDispute as any);

      const result = await disputeService.getById('dispute-1');

      expect(result).toEqual(mockDispute);
    });

    it('should throw error when dispute not found', async () => {
      vi.mocked(prisma.dispute.findUnique).mockResolvedValue(null);

      await expect(disputeService.getById('nonexistent')).rejects.toThrow('Dispute not found');
    });

    it('should throw error when user not authorized', async () => {
      const mockDispute = {
        id: 'dispute-1',
        initiatorId: 'other-user',
        respondentId: 'another-user',
      };

      vi.mocked(prisma.dispute.findUnique).mockResolvedValue(mockDispute as any);

      await expect(disputeService.getById('dispute-1', 'user-1')).rejects.toThrow(
        'Not authorized to view this dispute'
      );
    });
  });

  describe('resolve', () => {
    it('should resolve a dispute', async () => {
      const mockDispute = {
        id: 'dispute-1',
        status: 'OPEN',
      };

      const resolvedDispute = {
        id: 'dispute-1',
        status: 'RESOLVED',
        resolution: 'Issue was resolved',
        refundAmountInitiator: 50,
      };

      vi.mocked(prisma.dispute.findUnique).mockResolvedValue(mockDispute as any);
      vi.mocked(prisma.dispute.update).mockResolvedValue(resolvedDispute as any);

      const result = await disputeService.resolve('dispute-1', {
        resolution: 'Issue was resolved',
        refundAmountInitiator: 50,
      });

      expect(result.status).toBe('RESOLVED');
      expect(prisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dispute-1' },
          data: expect.objectContaining({
            status: 'RESOLVED',
            resolution: 'Issue was resolved',
          }),
        })
      );
    });

    it('should throw error when dispute not found', async () => {
      vi.mocked(prisma.dispute.findUnique).mockResolvedValue(null);

      await expect(
        disputeService.resolve('nonexistent', { resolution: 'Test' })
      ).rejects.toThrow('Dispute not found');
    });

    it('should throw error when dispute already resolved', async () => {
      vi.mocked(prisma.dispute.findUnique).mockResolvedValue({
        id: 'dispute-1',
        status: 'RESOLVED',
      } as any);

      await expect(
        disputeService.resolve('dispute-1', { resolution: 'Test' })
      ).rejects.toThrow('Dispute is already resolved or closed');
    });
  });

  describe('updateStatus', () => {
    it('should update dispute status', async () => {
      vi.mocked(prisma.dispute.findUnique).mockResolvedValue({ id: 'dispute-1' } as any);
      vi.mocked(prisma.dispute.update).mockResolvedValue({
        id: 'dispute-1',
        status: 'UNDER_REVIEW',
      } as any);

      const result = await disputeService.updateStatus('dispute-1', 'UNDER_REVIEW');

      expect(result.status).toBe('UNDER_REVIEW');
    });

    it('should throw error when dispute not found', async () => {
      vi.mocked(prisma.dispute.findUnique).mockResolvedValue(null);

      await expect(disputeService.updateStatus('nonexistent', 'CLOSED')).rejects.toThrow(
        'Dispute not found'
      );
    });
  });

  describe('close', () => {
    it('should close a dispute', async () => {
      vi.mocked(prisma.dispute.findUnique).mockResolvedValue({ id: 'dispute-1' } as any);
      vi.mocked(prisma.dispute.update).mockResolvedValue({
        id: 'dispute-1',
        status: 'CLOSED',
      } as any);

      const result = await disputeService.close('dispute-1');

      expect(result.status).toBe('CLOSED');
    });
  });
});
