import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock localStorage
const mockLocalStorage = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => mockLocalStorage.store[key] || null),
  setItem: vi.fn((key: string, value: string) => { mockLocalStorage.store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockLocalStorage.store[key]; }),
  clear: vi.fn(() => { mockLocalStorage.store = {}; }),
};

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Import after mocking
import { 
  getVariant, 
  forceVariant,
  clearExperiments,
  trackConversion,
  useExperiment,
  EXPERIMENTS,
  ABTest,
  type Experiment,
} from './ab-testing';

describe('A/B Testing Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.store = {};
  });

  describe('getVariant', () => {
    it('returns a variant for BADGE_PLACEMENT experiment', () => {
      const variant = getVariant(EXPERIMENTS.BADGE_PLACEMENT);
      expect(['header', 'sidebar', 'inline', 'floating']).toContain(variant);
    });

    it('returns a variant for ACTIVITY_FEED_POSITION experiment', () => {
      const variant = getVariant(EXPERIMENTS.ACTIVITY_FEED_POSITION);
      expect(['right_sidebar', 'bottom_panel', 'floating_widget']).toContain(variant);
    });

    it('returns a variant for QUICK_ACCEPT_STYLE experiment', () => {
      const variant = getVariant(EXPERIMENTS.QUICK_ACCEPT_STYLE);
      expect(['swipe', 'buttons', 'gradient']).toContain(variant);
    });

    it('returns a variant for TRUST_SIGNALS_STYLE experiment', () => {
      const variant = getVariant(EXPERIMENTS.TRUST_SIGNALS_STYLE);
      expect(['badges', 'text', 'icons_only', 'compact']).toContain(variant);
    });

    it('returns a variant for BUNDLE_SUGGESTIONS experiment', () => {
      const variant = getVariant(EXPERIMENTS.BUNDLE_SUGGESTIONS);
      expect(['always', 'on_scroll', 'collapsed', 'hidden']).toContain(variant);
    });
  });

  describe('EXPERIMENTS object', () => {
    it('is defined', () => {
      expect(EXPERIMENTS).toBeDefined();
      expect(typeof EXPERIMENTS).toBe('object');
    });

    it('has BADGE_PLACEMENT experiment', () => {
      expect(EXPERIMENTS.BADGE_PLACEMENT).toBeDefined();
      expect(EXPERIMENTS.BADGE_PLACEMENT.id).toBe('badge_placement');
    });

    it('has ACTIVITY_FEED_POSITION experiment', () => {
      expect(EXPERIMENTS.ACTIVITY_FEED_POSITION).toBeDefined();
      expect(EXPERIMENTS.ACTIVITY_FEED_POSITION.id).toBe('activity_feed_position');
    });

    it('experiments have required properties', () => {
      Object.values(EXPERIMENTS).forEach((experiment: Experiment) => {
        expect(experiment.id).toBeDefined();
        expect(Array.isArray(experiment.variants)).toBe(true);
        expect(experiment.variants.length).toBeGreaterThan(0);
        expect(experiment.default).toBeDefined();
      });
    });
  });

  describe('ABTest component', () => {
    it('is defined', () => {
      expect(ABTest).toBeDefined();
    });

    it('renders children when no variants provided', () => {
      render(
        React.createElement(ABTest, { experiment: EXPERIMENTS.BADGE_PLACEMENT }, 
          React.createElement('div', { 'data-testid': 'child' }, 'Child Content')
        )
      );
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('renders function children with variant', () => {
      render(
        React.createElement(ABTest, { 
          experiment: EXPERIMENTS.BADGE_PLACEMENT,
          children: (variant: string) => React.createElement('div', { 'data-testid': 'variant' }, variant)
        })
      );
      expect(screen.getByTestId('variant')).toBeInTheDocument();
    });

    it('renders matching variant when variants object provided', () => {
      // Force a specific variant first
      forceVariant(EXPERIMENTS.BADGE_PLACEMENT, 'header');
      
      render(
        React.createElement(ABTest, { 
          experiment: EXPERIMENTS.BADGE_PLACEMENT,
          variants: {
            header: React.createElement('div', { 'data-testid': 'header-variant' }, 'Header'),
            sidebar: React.createElement('div', { 'data-testid': 'sidebar-variant' }, 'Sidebar'),
          },
          children: React.createElement('div', null, 'Default')
        })
      );
      expect(screen.getByTestId('header-variant')).toBeInTheDocument();
    });
  });

  describe('forceVariant', () => {
    it('forces a specific variant for an experiment', () => {
      forceVariant(EXPERIMENTS.BADGE_PLACEMENT, 'sidebar');
      const variant = getVariant(EXPERIMENTS.BADGE_PLACEMENT);
      expect(variant).toBe('sidebar');
    });

    it('overwrites existing variant assignment', () => {
      getVariant(EXPERIMENTS.QUICK_ACCEPT_STYLE); // Get initial assignment
      forceVariant(EXPERIMENTS.QUICK_ACCEPT_STYLE, 'swipe');
      const variant = getVariant(EXPERIMENTS.QUICK_ACCEPT_STYLE);
      expect(variant).toBe('swipe');
    });
  });

  describe('clearExperiments', () => {
    it('clears all experiment assignments', () => {
      getVariant(EXPERIMENTS.BADGE_PLACEMENT);
      getVariant(EXPERIMENTS.ACTIVITY_FEED_POSITION);
      
      clearExperiments();
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('sw_ab_tests');
    });
  });

  describe('trackConversion', () => {
    it('tracks conversion for existing experiment', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // First assign a variant
      getVariant(EXPERIMENTS.BADGE_PLACEMENT);
      
      // Then track conversion
      trackConversion('badge_placement', 'click');
      
      // In DEV mode, it should log
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('does nothing when experiment not assigned', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Track conversion without assigning variant first
      clearExperiments();
      trackConversion('nonexistent', 'click');
      
      // Should not log since no variant assigned
      consoleSpy.mockRestore();
    });
  });

  describe('useExperiment hook', () => {
    it('returns variant and helper functions', () => {
      const { result } = renderHook(() => useExperiment(EXPERIMENTS.TRUST_SIGNALS_STYLE));
      
      expect(result.current.variant).toBeDefined();
      expect(typeof result.current.isVariant).toBe('function');
      expect(typeof result.current.trackConversion).toBe('function');
    });

    it('isVariant returns true for matching variant', () => {
      forceVariant(EXPERIMENTS.BUNDLE_SUGGESTIONS, 'always');
      const { result } = renderHook(() => useExperiment(EXPERIMENTS.BUNDLE_SUGGESTIONS));
      
      expect(result.current.isVariant('always')).toBe(true);
      expect(result.current.isVariant('hidden')).toBe(false);
    });

    it('trackConversion calls trackConversion with experiment id', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { result } = renderHook(() => useExperiment(EXPERIMENTS.QUICK_ACCEPT_STYLE));
      
      result.current.trackConversion('button_click');
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getVariant persistence', () => {
    it('returns same variant on subsequent calls', () => {
      const variant1 = getVariant(EXPERIMENTS.BADGE_PLACEMENT);
      const variant2 = getVariant(EXPERIMENTS.BADGE_PLACEMENT);
      expect(variant1).toBe(variant2);
    });

    it('stores variant in localStorage', () => {
      getVariant(EXPERIMENTS.ACTIVITY_FEED_POSITION);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });
  });
});
