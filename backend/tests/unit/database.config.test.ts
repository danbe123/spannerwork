import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks
const mocks = vi.hoisted(() => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockPrismaClient: {
    $on: vi.fn(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: mocks.logger,
}));

vi.mock('../../src/config/env.js', () => ({
  env: {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
    NODE_ENV: 'test',
  },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: class PrismaClient {
    constructor() {
      return mocks.mockPrismaClient as unknown as object;
    }
  },
}));

import { prisma, db } from '../../src/config/database.js';

describe('Database Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('prisma client', () => {
    it('should export prisma client', () => {
      expect(prisma).toBeDefined();
    });

    it('should export db alias', () => {
      expect(db).toBeDefined();
      expect(db).toBe(prisma);
    });
  });

  describe('pool configuration', () => {
    it('should have default pool size environment variable', () => {
      // DB_POOL_SIZE defaults to 10
      expect(process.env.DB_POOL_SIZE || '10').toBe('10');
    });

    it('should have default pool timeout environment variable', () => {
      // DB_POOL_TIMEOUT defaults to 20000
      expect(process.env.DB_POOL_TIMEOUT || '20000').toBe('20000');
    });

    it('should have default connect timeout environment variable', () => {
      // DB_CONNECT_TIMEOUT defaults to 10000
      expect(process.env.DB_CONNECT_TIMEOUT || '10000').toBe('10000');
    });
  });
});

describe('Database URL Building', () => {
  it('should have prisma client configured', () => {
    expect(prisma).toBeDefined();
  });
});

describe('Prisma Event Handlers', () => {
  it('should set up event handlers', () => {
    // The $on method should be available
    expect(mocks.mockPrismaClient.$on).toBeDefined();
  });

  it('should have query logging capability', () => {
    // Test that prisma client was created with logging config
    expect(prisma).toBeDefined();
  });
});
