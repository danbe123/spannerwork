import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { Prisma } from '@prisma/client';
import type { AIFeatureType, AIFeedbackAction } from '@prisma/client';

interface TrackGenerationInput {
  userId: string;
  sessionId: string;
  featureType: AIFeatureType;
  inputData: unknown;
  outputData: unknown;
  promptVersion: string;
  modelUsed: string;
  latencyMs: number;
  confidence?: number;
}

interface TrackActionInput {
  feedbackId: string;
  action: AIFeedbackAction;
  selectedFields?: string[];
  modifiedFields?: Record<string, { original: unknown; modified: unknown }>;
  finalData?: unknown;
}

interface PerformanceMetrics {
  totalGenerations: number;
  acceptanceRate: number;
  partialAcceptanceRate: number;
  rejectionRate: number;
  regenerationRate: number;
  avgLatencyMs: number;
  mostModifiedFields: Array<{ field: string; count: number }>;
  byPromptVersion: Record<string, { count: number; acceptanceRate: number }>;
}

/**
 * AI Feedback Service
 * Tracks user interactions with AI-generated suggestions to enable learning and improvement
 */
export class AIFeedbackService {
  /**
   * Check if feedback tracking is enabled
   */
  isEnabled(): boolean {
    return env.AI_FEEDBACK_ENABLED;
  }

  /**
   * Track when AI generates a suggestion
   * Call this immediately after AI generates output, before returning to user
   */
  async trackGeneration(data: TrackGenerationInput): Promise<string | null> {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const feedback = await prisma.aIFeedback.create({
        data: {
          userId: data.userId,
          sessionId: data.sessionId,
          featureType: data.featureType,
          inputData: data.inputData as Prisma.JsonObject,
          outputData: data.outputData as Prisma.JsonObject,
          promptVersion: data.promptVersion,
          modelUsed: data.modelUsed,
          latencyMs: data.latencyMs,
          confidence: data.confidence,
          action: 'PENDING',
          selectedFields: [],
        },
      });

      logger.debug('AI feedback tracked', {
        feedbackId: feedback.id,
        featureType: data.featureType,
        latencyMs: data.latencyMs
      });

      return feedback.id;
    } catch (error) {
      logger.error('Failed to track AI generation:', error);
      return null;
    }
  }

  /**
   * Update when user takes action on AI suggestion
   * Call this when user accepts, modifies, rejects, or regenerates
   */
  async trackAction(data: TrackActionInput): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    try {
      await prisma.aIFeedback.update({
        where: { id: data.feedbackId },
        data: {
          action: data.action,
          selectedFields: data.selectedFields || [],
          modifiedFields: data.modifiedFields as Prisma.JsonObject | undefined,
          finalData: data.finalData as Prisma.JsonObject | undefined,
        },
      });

      logger.debug('AI feedback action tracked', {
        feedbackId: data.feedbackId,
        action: data.action,
        selectedFieldsCount: data.selectedFields?.length || 0
      });

      return true;
    } catch (error) {
      logger.error('Failed to track AI action:', error);
      return false;
    }
  }

  /**
   * Get performance metrics for AI features
   * Used for monitoring and optimization
   */
  async getPerformanceMetrics(options: {
    featureType?: AIFeatureType;
    promptVersion?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<PerformanceMetrics> {
    const where: Prisma.AIFeedbackWhereInput = {
      action: { not: 'PENDING' }, // Only completed interactions
    };

    if (options.featureType) {
      where.featureType = options.featureType;
    }

    if (options.promptVersion) {
      where.promptVersion = options.promptVersion;
    }

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    // Get all feedback matching criteria
    const feedback = await prisma.aIFeedback.findMany({
      where,
      select: {
        action: true,
        latencyMs: true,
        modifiedFields: true,
        promptVersion: true,
      },
    });

    const totalGenerations = feedback.length;

    if (totalGenerations === 0) {
      return {
        totalGenerations: 0,
        acceptanceRate: 0,
        partialAcceptanceRate: 0,
        rejectionRate: 0,
        regenerationRate: 0,
        avgLatencyMs: 0,
        mostModifiedFields: [],
        byPromptVersion: {},
      };
    }

    // Calculate action rates
    const actionCounts = {
      ACCEPTED_FULL: 0,
      ACCEPTED_PARTIAL: 0,
      REJECTED: 0,
      REGENERATED: 0,
    };

    let totalLatency = 0;
    const fieldModifications: Record<string, number> = {};
    const byPromptVersion: Record<string, { count: number; accepted: number }> = {};

    for (const fb of feedback) {
      // Count actions
      if (fb.action in actionCounts) {
        actionCounts[fb.action as keyof typeof actionCounts]++;
      }

      // Sum latency
      totalLatency += fb.latencyMs;

      // Track modified fields
      if (fb.modifiedFields && typeof fb.modifiedFields === 'object') {
        for (const field of Object.keys(fb.modifiedFields)) {
          fieldModifications[field] = (fieldModifications[field] || 0) + 1;
        }
      }

      // Track by prompt version
      if (!byPromptVersion[fb.promptVersion]) {
        byPromptVersion[fb.promptVersion] = { count: 0, accepted: 0 };
      }
      byPromptVersion[fb.promptVersion].count++;
      if (fb.action === 'ACCEPTED_FULL' || fb.action === 'ACCEPTED_PARTIAL') {
        byPromptVersion[fb.promptVersion].accepted++;
      }
    }

    // Calculate rates
    const acceptanceRate = (actionCounts.ACCEPTED_FULL / totalGenerations) * 100;
    const partialAcceptanceRate = (actionCounts.ACCEPTED_PARTIAL / totalGenerations) * 100;
    const rejectionRate = (actionCounts.REJECTED / totalGenerations) * 100;
    const regenerationRate = (actionCounts.REGENERATED / totalGenerations) * 100;

    // Sort modified fields by count
    const mostModifiedFields = Object.entries(fieldModifications)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([field, count]) => ({ field, count }));

    // Calculate per-version acceptance rates
    const byPromptVersionFormatted: Record<string, { count: number; acceptanceRate: number }> = {};
    for (const [version, data] of Object.entries(byPromptVersion)) {
      byPromptVersionFormatted[version] = {
        count: data.count,
        acceptanceRate: (data.accepted / data.count) * 100,
      };
    }

    return {
      totalGenerations,
      acceptanceRate: Math.round(acceptanceRate * 10) / 10,
      partialAcceptanceRate: Math.round(partialAcceptanceRate * 10) / 10,
      rejectionRate: Math.round(rejectionRate * 10) / 10,
      regenerationRate: Math.round(regenerationRate * 10) / 10,
      avgLatencyMs: Math.round(totalLatency / totalGenerations),
      mostModifiedFields,
      byPromptVersion: byPromptVersionFormatted,
    };
  }

  /**
   * Get common modification patterns for a feature type
   * Used to identify where AI suggestions consistently need correction
   */
  async getModificationPatterns(featureType: AIFeatureType, limit = 100): Promise<{
    commonChanges: Array<{
      field: string;
      originalPattern: string;
      modifiedPattern: string;
      count: number;
    }>;
    suggestions: string[];
  }> {
    const feedback = await prisma.aIFeedback.findMany({
      where: {
        featureType,
        action: 'ACCEPTED_PARTIAL',
        modifiedFields: { not: Prisma.AnyNull },
      },
      select: {
        modifiedFields: true,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    // Analyze modification patterns
    const fieldChanges: Record<string, Array<{ original: string; modified: string }>> = {};

    for (const fb of feedback) {
      if (fb.modifiedFields && typeof fb.modifiedFields === 'object') {
        for (const [field, change] of Object.entries(fb.modifiedFields as Record<string, { original: unknown; modified: unknown }>)) {
          if (!fieldChanges[field]) {
            fieldChanges[field] = [];
          }
          fieldChanges[field].push({
            original: String(change.original || ''),
            modified: String(change.modified || ''),
          });
        }
      }
    }

    // Find common changes (simplified - could be enhanced with more sophisticated pattern matching)
    const commonChanges: Array<{
      field: string;
      originalPattern: string;
      modifiedPattern: string;
      count: number;
    }> = [];

    for (const [field, changes] of Object.entries(fieldChanges)) {
      if (changes.length >= 3) {
        // For simplicity, take the most recent example as representative
        commonChanges.push({
          field,
          originalPattern: changes[0].original.substring(0, 100),
          modifiedPattern: changes[0].modified.substring(0, 100),
          count: changes.length,
        });
      }
    }

    // Sort by count
    commonChanges.sort((a, b) => b.count - a.count);

    // Generate improvement suggestions
    const suggestions: string[] = [];
    for (const change of commonChanges.slice(0, 5)) {
      suggestions.push(
        `Field "${change.field}" is frequently modified (${change.count} times). ` +
        `Consider adjusting the prompt to better match user expectations.`
      );
    }

    return {
      commonChanges: commonChanges.slice(0, 10),
      suggestions,
    };
  }

  /**
   * Get recent feedback for a user (for debugging/support)
   */
  async getUserFeedback(userId: string, limit = 20) {
    return prisma.aIFeedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        featureType: true,
        action: true,
        latencyMs: true,
        promptVersion: true,
        createdAt: true,
      },
    });
  }

  /**
   * Clean up old pending feedback (garbage collection)
   * Pending feedback older than 24 hours is likely abandoned
   */
  async cleanupPendingFeedback(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await prisma.aIFeedback.deleteMany({
      where: {
        action: 'PENDING',
        createdAt: { lt: cutoff },
      },
    });

    if (result.count > 0) {
      logger.info('Cleaned up pending AI feedback', { count: result.count });
    }

    return result.count;
  }
}

export const aiFeedbackService = new AIFeedbackService();
