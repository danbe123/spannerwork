import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock dependencies before imports
vi.mock('../../src/config/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../src/config/env.js', () => ({
  default: {
    NODE_ENV: 'test',
  },
  env: {
    NODE_ENV: 'test',
  },
}));

// Mock child_process spawn
const mockSpawn = vi.fn();
vi.mock('child_process', () => ({
  spawn: mockSpawn,
}));

// Create mock process helper
function createMockProcess() {
  const process = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  process.stdout = new EventEmitter();
  process.stderr = new EventEmitter();
  return process;
}

describe('Virus Scan Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module cache to get fresh instance
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('when scanning is disabled', () => {
    it('returns clean result without scanning', async () => {
      // Ensure ENABLE_VIRUS_SCAN is not set
      delete process.env.ENABLE_VIRUS_SCAN;
      
      const { virusScanService } = await import('../../src/services/virusScan.service.js');
      
      const result = await virusScanService.scanFile('/path/to/file.txt');

      expect(result.clean).toBe(true);
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('isEnabled returns false', async () => {
      delete process.env.ENABLE_VIRUS_SCAN;
      
      const { virusScanService } = await import('../../src/services/virusScan.service.js');
      
      expect(virusScanService.isEnabled()).toBe(false);
    });
  });

  describe('when scanning is enabled', () => {
    beforeEach(() => {
      process.env.ENABLE_VIRUS_SCAN = 'true';
    });

    afterEach(() => {
      delete process.env.ENABLE_VIRUS_SCAN;
    });

    it('isEnabled returns true', async () => {
      const { virusScanService } = await import('../../src/services/virusScan.service.js');
      
      expect(virusScanService.isEnabled()).toBe(true);
    });

    it('returns clean for clean files', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const { virusScanService } = await import('../../src/services/virusScan.service.js');
      
      const scanPromise = virusScanService.scanFile('/path/to/clean-file.txt');

      // Simulate clean file (exit code 0)
      setTimeout(() => mockProcess.emit('close', 0), 10);

      const result = await scanPromise;

      expect(result.clean).toBe(true);
      expect(result.virus).toBeUndefined();
    });

    it('returns infected result with virus name', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const { virusScanService } = await import('../../src/services/virusScan.service.js');
      
      const scanPromise = virusScanService.scanFile('/path/to/infected-file.exe');

      // Simulate infected file (exit code 1)
      setTimeout(() => {
        mockProcess.stdout.emit('data', '/path/to/infected-file.exe: Eicar-Test-Signature FOUND\n');
        mockProcess.emit('close', 1);
      }, 10);

      const result = await scanPromise;

      expect(result.clean).toBe(false);
      expect(result.virus).toBe('Eicar-Test-Signature');
    });

    it('returns error on scan failure', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const { virusScanService } = await import('../../src/services/virusScan.service.js');
      
      const scanPromise = virusScanService.scanFile('/path/to/file.txt');

      // Simulate error (exit code 2)
      setTimeout(() => {
        mockProcess.stderr.emit('data', 'Scan error occurred');
        mockProcess.emit('close', 2);
      }, 10);

      const result = await scanPromise;

      expect(result.clean).toBe(false);
      expect(result.error).toBe('Scan error occurred');
    });

    it('handles spawn error gracefully', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const { virusScanService } = await import('../../src/services/virusScan.service.js');
      
      const scanPromise = virusScanService.scanFile('/path/to/file.txt');

      // Simulate spawn error (ClamAV not installed)
      setTimeout(() => {
        mockProcess.emit('error', new Error('spawn clamdscan ENOENT'));
      }, 10);

      const result = await scanPromise;

      // In test mode, should allow file
      expect(result.clean).toBe(true);
    });
  });

  describe('scanFiles', () => {
    it('scans multiple files and returns results map', async () => {
      delete process.env.ENABLE_VIRUS_SCAN;
      
      const { virusScanService } = await import('../../src/services/virusScan.service.js');
      
      const results = await virusScanService.scanFiles([
        '/path/to/file1.txt',
        '/path/to/file2.txt',
      ]);

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(2);
      expect(results.get('/path/to/file1.txt')?.clean).toBe(true);
      expect(results.get('/path/to/file2.txt')?.clean).toBe(true);
    });
  });

  describe('checkAvailability', () => {
    it('returns false when scanning is disabled', async () => {
      delete process.env.ENABLE_VIRUS_SCAN;
      
      const { virusScanService } = await import('../../src/services/virusScan.service.js');
      
      const available = await virusScanService.checkAvailability();

      expect(available).toBe(false);
    });

    it('returns true when ClamAV is available', async () => {
      process.env.ENABLE_VIRUS_SCAN = 'true';
      
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const { virusScanService } = await import('../../src/services/virusScan.service.js');
      
      const availabilityPromise = virusScanService.checkAvailability();

      setTimeout(() => mockProcess.emit('close', 0), 10);

      const available = await availabilityPromise;

      expect(available).toBe(true);

      delete process.env.ENABLE_VIRUS_SCAN;
    });

    it('returns false when ClamAV is not available', async () => {
      process.env.ENABLE_VIRUS_SCAN = 'true';
      
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const { virusScanService } = await import('../../src/services/virusScan.service.js');
      
      const availabilityPromise = virusScanService.checkAvailability();

      setTimeout(() => mockProcess.emit('error', new Error('Not found')), 10);

      const available = await availabilityPromise;

      expect(available).toBe(false);

      delete process.env.ENABLE_VIRUS_SCAN;
    });
  });
});
