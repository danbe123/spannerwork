/**
 * A/B Testing Utility
 *
 * Simple client-side A/B testing with persistence.
 * Assigns users to cohorts and tracks which variant they see.
 */

import type { ReactNode } from 'react';

const STORAGE_KEY = 'sw_ab_tests';

// Get or generate user ID for consistent assignment
function getUserId(): string {
  let userId = localStorage.getItem('sw_user_id');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('sw_user_id', userId);
  }
  return userId;
}

// Simple hash function for consistent assignment
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Get stored test assignments
function getStoredTests(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

// Save test assignments
function saveTests(tests: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tests));
  } catch {
    // Storage might be full or disabled
  }
}

export interface Experiment {
  id: string;
  variants: string[];
  default: string;
}

/**
 * Define available experiments
 */
export const EXPERIMENTS: Record<string, Experiment> = {
  // Badge placement experiment
  BADGE_PLACEMENT: {
    id: 'badge_placement',
    variants: ['header', 'sidebar', 'inline', 'floating'],
    default: 'inline',
  },
  // Activity feed position
  ACTIVITY_FEED_POSITION: {
    id: 'activity_feed_position',
    variants: ['right_sidebar', 'bottom_panel', 'floating_widget'],
    default: 'right_sidebar',
  },
  // Quick accept button style
  QUICK_ACCEPT_STYLE: {
    id: 'quick_accept_style',
    variants: ['swipe', 'buttons', 'gradient'],
    default: 'gradient',
  },
  // Trust signals display
  TRUST_SIGNALS_STYLE: {
    id: 'trust_signals_style',
    variants: ['badges', 'text', 'icons_only', 'compact'],
    default: 'badges',
  },
  // Bundle suggestions visibility
  BUNDLE_SUGGESTIONS: {
    id: 'bundle_suggestions',
    variants: ['always', 'on_scroll', 'collapsed', 'hidden'],
    default: 'always',
  },
};

/**
 * Get the variant for a specific experiment
 */
export function getVariant(experiment: Experiment): string {
  const userId = getUserId();
  const tests = getStoredTests();
  
  // Check if user already has an assignment
  if (tests[experiment.id]) {
    return tests[experiment.id];
  }
  
  // Assign user to a variant based on hash
  const hash = hashCode(`${userId}_${experiment.id}`);
  const variantIndex = hash % experiment.variants.length;
  const variant = experiment.variants[variantIndex];
  
  // Store assignment
  tests[experiment.id] = variant;
  saveTests(tests);
  
  // Track assignment (could send to analytics)
  trackExperiment(experiment.id, variant);
  
  return variant;
}

/**
 * Force a specific variant (for debugging/testing)
 */
export function forceVariant(experiment: Experiment, variant: string): void {
  const tests = getStoredTests();
  tests[experiment.id] = variant;
  saveTests(tests);
}

/**
 * Clear all experiment assignments (reset user)
 */
export function clearExperiments(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Track experiment exposure (for analytics)
 */
function trackExperiment(experimentId: string, variant: string): void {
  // Log to console in development
  if (import.meta.env.DEV) {
    console.log(`[A/B Test] ${experimentId}: ${variant}`);
  }
  
  // Could send to analytics service
  // analytics.track('experiment_exposure', { experimentId, variant });
}

/**
 * Track experiment conversion
 */
export function trackConversion(experimentId: string, action: string): void {
  const tests = getStoredTests();
  const variant = tests[experimentId];
  
  if (variant) {
    if (import.meta.env.DEV) {
      console.log(`[A/B Test] Conversion: ${experimentId}/${variant} - ${action}`);
    }
    
    // Could send to analytics service
    // analytics.track('experiment_conversion', { experimentId, variant, action });
  }
}

export interface UseExperimentReturn {
  variant: string;
  isVariant: (v: string) => boolean;
  trackConversion: (action: string) => void;
}

/**
 * React hook for A/B testing
 */
export function useExperiment(experiment: Experiment): UseExperimentReturn {
  // Get variant on first render (stable across re-renders)
  const variant = getVariant(experiment);
  
  return {
    variant,
    isVariant: (v: string) => variant === v,
    trackConversion: (action: string) => trackConversion(experiment.id, action),
  };
}

interface ABTestProps {
  experiment: Experiment;
  variants?: Record<string, ReactNode>;
  children: ReactNode | ((variant: string) => ReactNode);
}

/**
 * Component wrapper for A/B tests
 */
export function ABTest({ experiment, variants, children }: ABTestProps): ReactNode {
  const { variant } = useExperiment(experiment);
  
  // If children is a function, call it with variant
  if (typeof children === 'function') {
    return children(variant);
  }
  
  // If variants object provided, render the matching variant
  if (variants && variants[variant]) {
    return variants[variant];
  }
  
  // Default: render children
  return children;
}

export default {
  EXPERIMENTS,
  getVariant,
  forceVariant,
  clearExperiments,
  trackConversion,
  useExperiment,
  ABTest,
};
