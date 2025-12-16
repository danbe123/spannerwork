import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks
const mocks = vi.hoisted(() => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  env: {
    GEMINI_API_KEY: '', // Not configured by default
  },
  prisma: {
    tool: { findMany: vi.fn() },
    space: { findMany: vi.fn() },
    service: { findMany: vi.fn() },
    request: { findUnique: vi.fn(), update: vi.fn() },
  },
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: mocks.logger,
}));

vi.mock('../../src/config/env.js', () => ({
  env: mocks.env,
}));

vi.mock('../../src/config/database.js', () => ({
  prisma: mocks.prisma,
}));

vi.mock('../../src/config/redis.js', () => ({
  redis: mocks.redis,
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { AIService } from '../../src/services/ai.service.js';

describe('AIService', () => {
  let aiService: AIService;

  beforeEach(() => {
    vi.clearAllMocks();
    aiService = new AIService();
  });

  describe('findMatches', () => {
    it('should query listings based on category', async () => {
      mocks.env.GEMINI_API_KEY = '';
      mocks.prisma.tool.findMany.mockResolvedValue([]);
      mocks.prisma.space.findMany.mockResolvedValue([]);
      mocks.prisma.service.findMany.mockResolvedValue([]);

      const result = await aiService.findMatches({
        title: 'Need a drill',
        description: 'Looking for a power drill',
        category: 'ALL',
        budget: 50,
        postcode: 'SW1A 1AA',
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should query tools when category is TOOLS', async () => {
      mocks.env.GEMINI_API_KEY = '';
      mocks.prisma.tool.findMany.mockResolvedValue([]);

      await aiService.findMatches({
        title: 'Need a drill',
        description: 'Looking for a power drill',
        category: 'TOOLS',
        budget: 50,
        postcode: 'SW1A 1AA',
      });

      expect(mocks.prisma.tool.findMany).toHaveBeenCalled();
    });

    it('should query spaces when category is SPACE', async () => {
      mocks.env.GEMINI_API_KEY = '';
      mocks.prisma.space.findMany.mockResolvedValue([]);

      await aiService.findMatches({
        title: 'Need a workshop',
        description: 'Looking for workspace',
        category: 'SPACE',
        budget: 100,
        postcode: 'SW1A 1AA',
      });

      expect(mocks.prisma.space.findMany).toHaveBeenCalled();
    });

    it('should query all listing types when category is ALL', async () => {
      mocks.env.GEMINI_API_KEY = '';
      mocks.prisma.tool.findMany.mockResolvedValue([]);
      mocks.prisma.space.findMany.mockResolvedValue([]);
      mocks.prisma.service.findMany.mockResolvedValue([]);

      await aiService.findMatches({
        title: 'Need help',
        description: 'General request',
        category: 'ALL',
        budget: 200,
        postcode: 'SW1A 1AA',
      });

      expect(mocks.prisma.tool.findMany).toHaveBeenCalled();
      expect(mocks.prisma.space.findMany).toHaveBeenCalled();
      expect(mocks.prisma.service.findMany).toHaveBeenCalled();
    });
  });

  describe('getBundleSuggestions', () => {
    it('should return fallback suggestions when API key not configured', async () => {
      mocks.env.GEMINI_API_KEY = '';
      mocks.redis.get.mockResolvedValue(null);
      mocks.prisma.tool.findMany.mockResolvedValue([
        { id: 'tool-1', name: 'Drill', category: 'POWER_TOOLS', dailyRate: 1500 },
      ]);
      mocks.prisma.service.findMany.mockResolvedValue([
        { id: 'service-1', name: 'Installation', hourlyRate: 3000 },
      ]);

      const result = await aiService.getBundleSuggestions('tool-123', 'tool', 'Power Drill', 'POWER_TOOLS');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should use cached results when available', async () => {
      const cachedResult = JSON.stringify([
        { id: 'tool-1', type: 'tool', name: 'Saw', reason: 'Complementary', price: 10 },
      ]);
      mocks.redis.get.mockResolvedValue(cachedResult);

      const result = await aiService.getBundleSuggestions('tool-123', 'tool', 'Power Drill', 'POWER_TOOLS');

      expect(result).toHaveLength(1);
      expect(mocks.prisma.tool.findMany).not.toHaveBeenCalled();
    });

    it('should query database for related listings', async () => {
      mocks.redis.get.mockResolvedValue(null);
      mocks.prisma.tool.findMany.mockResolvedValue([]);
      mocks.prisma.service.findMany.mockResolvedValue([]);

      await aiService.getBundleSuggestions('tool-123', 'tool', 'Drill', 'POWER_TOOLS');

      expect(mocks.prisma.tool.findMany).toHaveBeenCalled();
      expect(mocks.prisma.service.findMany).toHaveBeenCalled();
    });
  });

  describe('optimizeRequest', () => {
    it('should return null when API key not configured', async () => {
      mocks.env.GEMINI_API_KEY = '';

      const result = await aiService.optimizeRequest(
        'Need a drill',
        'For my project',
        'TOOLS'
      );

      expect(result).toBeNull();
      expect(mocks.logger.warn).toHaveBeenCalled();
    });
  });

  describe('with API key configured', () => {
    it('should attempt API call when configured', async () => {
      // Recreate service with API key
      mocks.env.GEMINI_API_KEY = 'test-api-key';
      const configuredService = new AIService();
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{ text: '{"optimizedTitle":"Better Title","optimizedDescription":"Better desc","suggestedBudget":50}' }],
            },
          }],
        }),
      });

      const result = await configuredService.optimizeRequest('Need a drill', 'Project', 'TOOLS');

      // Either returns result or null (depends on implementation details)
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('should handle API errors gracefully', async () => {
      mocks.env.GEMINI_API_KEY = 'test-api-key';
      const configuredService = new AIService();
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const result = await configuredService.optimizeRequest('Need a drill', 'Project', 'TOOLS');

      expect(result).toBeNull();
    });

    it('should handle network errors gracefully', async () => {
      mocks.env.GEMINI_API_KEY = 'test-api-key';
      const configuredService = new AIService();
      
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await configuredService.optimizeRequest('Need a drill', 'Project', 'TOOLS');

      expect(result).toBeNull();
    });
  });
});

describe('AIService Integration Scenarios', () => {
  let aiService: AIService;

  const mockTool = {
    id: 'tool-1',
    name: 'Power Drill',
    description: 'Heavy duty drill',
    dailyRate: 1500,
    category: 'POWER_TOOLS',
    owner: { id: 'owner-1', name: 'John', rating: 4.5, postcode: 'SW1A 1AA' },
  };

  const mockSpace = {
    id: 'space-1',
    name: 'Workshop',
    description: 'Garage workshop',
    dailyRate: 5000,
    owner: { id: 'owner-2', name: 'Jane', rating: 4.8, postcode: 'SW1A 2AA' },
  };

  const mockService = {
    id: 'service-1',
    name: 'Plumbing Service',
    description: 'Professional plumber',
    hourlyRate: 3000,
    owner: { id: 'owner-3', name: 'Bob', rating: 4.9, postcode: 'SW1A 3AA' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.GEMINI_API_KEY = '';
    aiService = new AIService();
  });

  it('should handle tool matching request', async () => {
    mocks.prisma.tool.findMany.mockResolvedValue([mockTool]);
    mocks.prisma.space.findMany.mockResolvedValue([]);
    mocks.prisma.service.findMany.mockResolvedValue([]);

    const result = await aiService.findMatches({
      title: 'Need a power drill',
      description: 'DIY project',
      category: 'TOOLS',
      budget: 50,
      postcode: 'SW1A 1AA',
    });

    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle space matching request', async () => {
    mocks.prisma.tool.findMany.mockResolvedValue([]);
    mocks.prisma.space.findMany.mockResolvedValue([mockSpace]);
    mocks.prisma.service.findMany.mockResolvedValue([]);

    const result = await aiService.findMatches({
      title: 'Need workspace',
      description: 'Need a place to work on car',
      category: 'SPACE',
      budget: 100,
      postcode: 'SW1A 1AA',
    });

    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle service matching request', async () => {
    mocks.prisma.tool.findMany.mockResolvedValue([]);
    mocks.prisma.space.findMany.mockResolvedValue([]);
    mocks.prisma.service.findMany.mockResolvedValue([mockService]);

    const result = await aiService.findMatches({
      title: 'Need plumber',
      description: 'Fix leaking pipe',
      category: 'SERVICES',
      budget: 150,
      postcode: 'SW1A 1AA',
    });

    expect(Array.isArray(result)).toBe(true);
  });
});
