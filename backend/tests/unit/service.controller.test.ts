import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock dependencies
vi.mock('../../src/services/service.service.js', () => ({
  serviceService: {
    list: vi.fn(),
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getAvailability: vi.fn(),
  },
}));

vi.mock('../../src/services/insurance.service.js', () => ({
  insuranceService: {
    hasValidInsurance: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { serviceController } from '../../src/controllers/service.controller.js';
import { serviceService } from '../../src/services/service.service.js';
import { insuranceService } from '../../src/services/insurance.service.js';

describe('ServiceController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure insurance check passes by default for service creation tests
    vi.mocked(insuranceService.hasValidInsurance).mockResolvedValue(true);

    jsonMock = vi.fn().mockReturnThis();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      query: {},
      params: {},
      body: {},
      user: { id: 'user-123' },
    };
    mockRes = {
      json: jsonMock,
      status: statusMock,
    };
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('list', () => {
    it('should list services with default pagination', async () => {
      const mockResult = {
        services: [{ id: 'service-1', name: 'Plumbing' }],
        total: 1,
        page: 1,
        limit: 10,
      };
      vi.mocked(serviceService.list).mockResolvedValue(mockResult);

      await serviceController.list(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(serviceService.list).toHaveBeenCalledWith({
        page: undefined,
        limit: undefined,
        specialty: undefined,
        minHourlyRate: undefined,
        maxHourlyRate: undefined,
        postcode: undefined,
        radius: undefined,
      });
      expect(jsonMock).toHaveBeenCalledWith(mockResult);
    });

    it('should list services with filters', async () => {
      mockReq.query = {
        page: '2',
        limit: '20',
        specialty: 'plumbing',
        minHourlyRate: '25',
        maxHourlyRate: '100',
        postcode: 'SW1A 1AA',
        radius: '10',
      };

      const mockResult = { services: [], total: 0, page: 2, limit: 20 };
      vi.mocked(serviceService.list).mockResolvedValue(mockResult);

      await serviceController.list(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(serviceService.list).toHaveBeenCalledWith({
        page: 2,
        limit: 20,
        specialty: 'plumbing',
        minHourlyRate: 25,
        maxHourlyRate: 100,
        postcode: 'SW1A 1AA',
        radius: 10,
      });
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      vi.mocked(serviceService.list).mockRejectedValue(error);

      await serviceController.list(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('create', () => {
    it('should create a new service', async () => {
      mockReq.body = {
        name: 'Plumbing Service',
        description: 'Professional plumbing',
        hourlyRate: 50,
        specialty: 'plumbing',
      };

      const mockService = { id: 'service-123', ...mockReq.body };
      vi.mocked(serviceService.create).mockResolvedValue(mockService);

      await serviceController.create(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(serviceService.create).toHaveBeenCalledWith('user-123', mockReq.body);
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Service listing created successfully',
        service: mockService,
      });
    });

    it('should return 401 when not authenticated', async () => {
      mockReq.user = undefined;

      await serviceController.create(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    });

    it('should return 400 for invalid postcode', async () => {
      const error = new Error('Invalid postcode format');
      vi.mocked(serviceService.create).mockRejectedValue(error);

      await serviceController.create(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'Invalid postcode format',
      });
    });

    it('should pass other errors to next', async () => {
      const error = new Error('Unknown error');
      vi.mocked(serviceService.create).mockRejectedValue(error);

      await serviceController.create(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getById', () => {
    it('should return service by ID', async () => {
      mockReq.params = { id: 'service-123' };
      const mockService = { id: 'service-123', name: 'Plumbing' };
      vi.mocked(serviceService.getById).mockResolvedValue(mockService);

      await serviceController.getById(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(serviceService.getById).toHaveBeenCalledWith('service-123');
      expect(jsonMock).toHaveBeenCalledWith({ service: mockService });
    });

    it('should return 404 when service not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      vi.mocked(serviceService.getById).mockResolvedValue(null);

      await serviceController.getById(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'Service not found',
      });
    });

    it('should handle errors', async () => {
      mockReq.params = { id: 'service-123' };
      const error = new Error('Database error');
      vi.mocked(serviceService.getById).mockRejectedValue(error);

      await serviceController.getById(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('update', () => {
    it('should update service', async () => {
      mockReq.params = { id: 'service-123' };
      mockReq.body = { name: 'Updated Service' };

      const mockService = { id: 'service-123', name: 'Updated Service' };
      vi.mocked(serviceService.update).mockResolvedValue(mockService);

      await serviceController.update(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(serviceService.update).toHaveBeenCalledWith(
        'service-123',
        'user-123',
        mockReq.body
      );
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Service listing updated successfully',
        service: mockService,
      });
    });

    it('should return 401 when not authenticated', async () => {
      mockReq.user = undefined;
      mockReq.params = { id: 'service-123' };

      await serviceController.update(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should return 404 when service not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      const error = new Error('Service not found');
      vi.mocked(serviceService.update).mockRejectedValue(error);

      await serviceController.update(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'Service not found',
      });
    });

    it('should return 400 when updating others service', async () => {
      mockReq.params = { id: 'service-123' };
      const error = new Error('You can only update your own services');
      vi.mocked(serviceService.update).mockRejectedValue(error);

      await serviceController.update(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should return 400 for invalid postcode', async () => {
      mockReq.params = { id: 'service-123' };
      const error = new Error('Invalid postcode format');
      vi.mocked(serviceService.update).mockRejectedValue(error);

      await serviceController.update(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe('delete', () => {
    it('should delete service', async () => {
      mockReq.params = { id: 'service-123' };
      vi.mocked(serviceService.delete).mockResolvedValue(undefined);

      await serviceController.delete(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(serviceService.delete).toHaveBeenCalledWith('service-123', 'user-123');
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Service listing deleted successfully',
      });
    });

    it('should return 401 when not authenticated', async () => {
      mockReq.user = undefined;
      mockReq.params = { id: 'service-123' };

      await serviceController.delete(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should return 404 when service not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      const error = new Error('Service not found');
      vi.mocked(serviceService.delete).mockRejectedValue(error);

      await serviceController.delete(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('should return 400 when deleting others service', async () => {
      mockReq.params = { id: 'service-123' };
      const error = new Error('You can only delete your own services');
      vi.mocked(serviceService.delete).mockRejectedValue(error);

      await serviceController.delete(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should return 400 when service has active bookings', async () => {
      mockReq.params = { id: 'service-123' };
      const error = new Error('Cannot delete service with active or pending bookings');
      vi.mocked(serviceService.delete).mockRejectedValue(error);

      await serviceController.delete(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe('checkAvailability', () => {
    it('should return availability', async () => {
      mockReq.params = { id: 'service-123' };
      mockReq.query = {
        startDate: '2024-01-15',
        endDate: '2024-01-16',
      };

      const mockAvailability = { available: true, conflicts: [] };
      vi.mocked(serviceService.getAvailability).mockResolvedValue(mockAvailability);

      await serviceController.checkAvailability(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(serviceService.getAvailability).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(mockAvailability);
    });

    it('should return 400 when dates missing', async () => {
      mockReq.params = { id: 'service-123' };
      mockReq.query = {};

      await serviceController.checkAvailability(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'startDate and endDate are required',
      });
    });

    it('should return 400 for invalid date format', async () => {
      mockReq.params = { id: 'service-123' };
      mockReq.query = {
        startDate: 'invalid',
        endDate: '2024-01-16',
      };

      await serviceController.checkAvailability(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'Invalid date format',
      });
    });

    it('should return 400 when start date after end date', async () => {
      mockReq.params = { id: 'service-123' };
      mockReq.query = {
        startDate: '2024-01-20',
        endDate: '2024-01-15',
      };

      await serviceController.checkAvailability(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'startDate must be before endDate',
      });
    });

    it('should handle errors', async () => {
      mockReq.params = { id: 'service-123' };
      mockReq.query = {
        startDate: '2024-01-15',
        endDate: '2024-01-16',
      };
      const error = new Error('Database error');
      vi.mocked(serviceService.getAvailability).mockRejectedValue(error);

      await serviceController.checkAvailability(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
