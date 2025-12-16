/**
 * Virus Scanning Service
 * 
 * Optional integration for scanning uploaded files for viruses/malware.
 * Supports ClamAV via clamdscan socket connection.
 * 
 * To enable:
 * 1. Install ClamAV: apt-get install clamav clamav-daemon
 * 2. Start the daemon: systemctl start clamav-daemon
 * 3. Set ENABLE_VIRUS_SCAN=true in environment
 * 
 * For production, consider:
 * - Using a dedicated ClamAV container
 * - Cloud-based scanning APIs (VirusTotal, MetaDefender)
 */

import { spawn } from 'child_process';
import { logger } from '../config/logger.js';
import env from '../config/env.js';

export interface ScanResult {
  clean: boolean;
  virus?: string;
  error?: string;
}

// Check if virus scanning is enabled
const VIRUS_SCAN_ENABLED = process.env.ENABLE_VIRUS_SCAN === 'true';
const SCAN_TIMEOUT = 30000; // 30 seconds

/**
 * Virus Scanning Service
 */
class VirusScanService {
  private enabled: boolean;

  constructor() {
    this.enabled = VIRUS_SCAN_ENABLED;
    if (this.enabled) {
      logger.info('Virus scanning enabled');
    } else {
      logger.info('Virus scanning disabled (set ENABLE_VIRUS_SCAN=true to enable)');
    }
  }

  /**
   * Check if virus scanning is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Scan a file for viruses using ClamAV
   * 
   * @param filePath - Absolute path to the file to scan
   * @returns Scan result indicating if file is clean or infected
   */
  async scanFile(filePath: string): Promise<ScanResult> {
    if (!this.enabled) {
      // If scanning is disabled, allow all files
      return { clean: true };
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          clean: false,
          error: 'Virus scan timeout',
        });
      }, SCAN_TIMEOUT);

      try {
        // Use clamdscan for faster scanning via the daemon
        const clamscan = spawn('clamdscan', [
          '--no-summary',
          '--infected',
          filePath,
        ]);

        let output = '';
        let errorOutput = '';

        clamscan.stdout.on('data', (data) => {
          output += data.toString();
        });

        clamscan.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        clamscan.on('close', (code) => {
          clearTimeout(timeout);

          // Exit code 0 = clean, 1 = virus found, 2 = error
          if (code === 0) {
            resolve({ clean: true });
          } else if (code === 1) {
            // Extract virus name from output
            const match = output.match(/: (.+) FOUND/);
            const virusName = match ? match[1] : 'Unknown malware';
            
            logger.warn(`Virus detected in file: ${filePath}`, { virus: virusName });
            
            resolve({
              clean: false,
              virus: virusName,
            });
          } else {
            logger.error('Virus scan error:', { error: errorOutput });
            resolve({
              clean: false,
              error: errorOutput || 'Scan failed',
            });
          }
        });

        clamscan.on('error', (err) => {
          clearTimeout(timeout);
          logger.error('Failed to run virus scan:', err);
          
          // If ClamAV is not available, we can choose to:
          // 1. Fail closed (reject file) - more secure
          // 2. Fail open (allow file) - more permissive
          // Default: fail open with warning
          if (env.NODE_ENV === 'production') {
            resolve({
              clean: false,
              error: 'Virus scanner unavailable',
            });
          } else {
            logger.warn('Virus scanner not available, allowing file in non-production');
            resolve({ clean: true });
          }
        });
      } catch (error) {
        clearTimeout(timeout);
        logger.error('Virus scan exception:', error);
        resolve({
          clean: false,
          error: error instanceof Error ? error.message : 'Scan exception',
        });
      }
    });
  }

  /**
   * Scan multiple files
   */
  async scanFiles(filePaths: string[]): Promise<Map<string, ScanResult>> {
    const results = new Map<string, ScanResult>();

    await Promise.all(
      filePaths.map(async (filePath) => {
        const result = await this.scanFile(filePath);
        results.set(filePath, result);
      })
    );

    return results;
  }

  /**
   * Check if ClamAV daemon is available
   */
  async checkAvailability(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    return new Promise((resolve) => {
      const clamscan = spawn('clamdscan', ['--version']);

      clamscan.on('close', (code) => {
        resolve(code === 0);
      });

      clamscan.on('error', () => {
        resolve(false);
      });
    });
  }
}

export const virusScanService = new VirusScanService();
export default virusScanService;
