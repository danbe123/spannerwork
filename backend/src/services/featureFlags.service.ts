/**
 * Feature Flags Service
 * 
 * Simple feature flag system for gradual rollouts and A/B testing.
 * Flags can be enabled/disabled globally, by percentage, or by user ID.
 * 
 * Usage:
 *   import { featureFlags } from './services/featureFlags.service.js';
 *   
 *   if (await featureFlags.isEnabled('new_checkout_flow', userId)) {
 *     // Use new checkout
 *   }
 */

import { safeGet, safeSetex } from '../config/redis.js';
import { logger } from '../config/logger.js';

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
  // Percentage of users who should see this feature (0-100)
  percentage?: number;
  // Specific user IDs that should always see this feature
  allowedUsers?: string[];
  // Specific user IDs that should never see this feature
  blockedUsers?: string[];
  // Start date for the feature (optional)
  startDate?: Date;
  // End date for the feature (optional)
  endDate?: Date;
}

// Default feature flags - can be overridden via Redis
const DEFAULT_FLAGS: Record<string, FeatureFlag> = {
  // Example flags - add your own as needed
  new_booking_flow: {
    name: 'new_booking_flow',
    enabled: false,
    description: 'New booking UI with improved UX',
    percentage: 0,
  },
  enhanced_search: {
    name: 'enhanced_search',
    enabled: false,
    description: 'Enhanced search with fuzzy matching',
    percentage: 0,
  },
  real_time_messaging: {
    name: 'real_time_messaging',
    enabled: true,
    description: 'WebSocket-based real-time messaging',
    percentage: 100,
  },
};

const REDIS_KEY_PREFIX = 'feature-flag:';
const CACHE_TTL = 60; // Cache flags for 60 seconds

export class FeatureFlagsService {
  private localCache: Map<string, { flag: FeatureFlag; expiresAt: number }> = new Map();

  /**
   * Get a feature flag by name
   */
  async getFlag(name: string): Promise<FeatureFlag | null> {
    // Check local cache first
    const cached = this.localCache.get(name);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.flag;
    }

    // Try Redis
    const redisData = await safeGet(`${REDIS_KEY_PREFIX}${name}`);
    if (redisData) {
      try {
        const flag = JSON.parse(redisData) as FeatureFlag;
        this.localCache.set(name, { flag, expiresAt: Date.now() + CACHE_TTL * 1000 });
        return flag;
      } catch {
        logger.warn(`Invalid feature flag data in Redis for ${name}`);
      }
    }

    // Fall back to defaults
    const defaultFlag = DEFAULT_FLAGS[name];
    if (defaultFlag) {
      this.localCache.set(name, { flag: defaultFlag, expiresAt: Date.now() + CACHE_TTL * 1000 });
      return defaultFlag;
    }

    return null;
  }

  /**
   * Check if a feature is enabled for a specific user
   */
  async isEnabled(name: string, userId?: string): Promise<boolean> {
    const flag = await this.getFlag(name);

    if (!flag) {
      return false;
    }

    if (!flag.enabled) {
      return false;
    }

    // Check date range
    const now = new Date();
    if (flag.startDate && now < new Date(flag.startDate)) {
      return false;
    }
    if (flag.endDate && now > new Date(flag.endDate)) {
      return false;
    }

    // Check if user is explicitly blocked
    if (userId && flag.blockedUsers?.includes(userId)) {
      return false;
    }

    // Check if user is explicitly allowed
    if (userId && flag.allowedUsers?.includes(userId)) {
      return true;
    }

    // Check percentage rollout
    if (flag.percentage !== undefined && flag.percentage < 100) {
      if (!userId) {
        // No user ID - use percentage as probability
        return Math.random() * 100 < flag.percentage;
      }

      // Deterministic rollout based on user ID hash
      const hash = this.hashUserId(userId);
      return hash < flag.percentage;
    }

    return true;
  }

  /**
   * Set a feature flag value
   */
  async setFlag(flag: FeatureFlag): Promise<void> {
    await safeSetex(
      `${REDIS_KEY_PREFIX}${flag.name}`,
      3600, // 1 hour TTL in Redis
      JSON.stringify(flag)
    );

    // Update local cache
    this.localCache.set(flag.name, { flag, expiresAt: Date.now() + CACHE_TTL * 1000 });

    logger.info(`Feature flag updated: ${flag.name}`, { enabled: flag.enabled, percentage: flag.percentage });
  }

  /**
   * Enable a feature flag for all users
   */
  async enable(name: string): Promise<void> {
    const existingFlag = await this.getFlag(name) || DEFAULT_FLAGS[name];
    if (!existingFlag) {
      throw new Error(`Feature flag ${name} not found`);
    }

    await this.setFlag({ ...existingFlag, enabled: true, percentage: 100 });
  }

  /**
   * Disable a feature flag for all users
   */
  async disable(name: string): Promise<void> {
    const existingFlag = await this.getFlag(name) || DEFAULT_FLAGS[name];
    if (!existingFlag) {
      throw new Error(`Feature flag ${name} not found`);
    }

    await this.setFlag({ ...existingFlag, enabled: false });
  }

  /**
   * Set rollout percentage for a feature flag
   */
  async setRolloutPercentage(name: string, percentage: number): Promise<void> {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }

    const existingFlag = await this.getFlag(name) || DEFAULT_FLAGS[name];
    if (!existingFlag) {
      throw new Error(`Feature flag ${name} not found`);
    }

    await this.setFlag({ ...existingFlag, enabled: true, percentage });
  }

  /**
   * Get all feature flags
   */
  async getAllFlags(): Promise<FeatureFlag[]> {
    const flags: FeatureFlag[] = [];

    // Start with defaults
    for (const name of Object.keys(DEFAULT_FLAGS)) {
      const flag = await this.getFlag(name);
      if (flag) {
        flags.push(flag);
      }
    }

    return flags;
  }

  /**
   * Clear local cache (for testing)
   */
  clearCache(): void {
    this.localCache.clear();
  }

  /**
   * Generate a deterministic hash (0-99) from a user ID
   * This ensures the same user always gets the same result for percentage rollouts
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) % 100;
  }
}

export const featureFlags = new FeatureFlagsService();
