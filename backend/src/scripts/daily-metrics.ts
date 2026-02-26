#!/usr/bin/env node
/**
 * Daily Metrics Snapshot Script
 *
 * Run via PM2 cron at midnight UTC:
 * pm2 start dist/scripts/daily-metrics.js --cron "0 0 * * *" --no-autorestart
 */

import { snapshotDailyMetrics } from '../services/analytics.service.js';
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';

async function main() {
  logger.info('Starting daily metrics snapshot...');

  try {
    await snapshotDailyMetrics();
    logger.info('Daily metrics snapshot completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Daily metrics snapshot failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
