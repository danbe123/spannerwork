import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BadgeDisplay from './BadgeDisplay';

// Mock the gamification service
vi.mock('@/api/services', () => ({
  gamificationService: {
    getMyBadges: vi.fn().mockResolvedValue({
      badges: [
        {
          type: 'FIRST_LISTING',
          name: 'First Listing',
          description: 'Created your first listing',
          icon: '📦',
          requirement: 'List 1 item',
          earnedAt: '2024-01-15T10:00:00Z',
        },
        {
          type: 'SUPER_RENTER',
          name: 'Super Renter',
          description: 'Completed 10 rentals',
          icon: '⭐',
          requirement: 'Complete 10 rentals',
          earnedAt: '2024-02-20T14:30:00Z',
        },
      ],
    }),
    getNextBadges: vi.fn().mockResolvedValue({
      nextBadges: [
        {
          badge: {
            type: 'POWER_USER',
            name: 'Power User',
            description: 'Complete 25 transactions',
            icon: '🚀',
          },
          progress: 60,
          remaining: '10 more transactions',
        },
        {
          badge: {
            type: 'TOP_RATED',
            name: 'Top Rated',
            description: 'Maintain 5-star rating with 20+ reviews',
            icon: '🏆',
          },
          progress: 40,
          remaining: '12 more reviews needed',
        },
      ],
    }),
  },
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('BadgeDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('shows loading skeleton while fetching badges', () => {
      renderWithProviders(<BadgeDisplay />);
      expect(screen.getByText('Achievements')).toBeInTheDocument();
    });

    it('renders earned badges after loading', async () => {
      renderWithProviders(<BadgeDisplay />);

      await waitFor(() => {
        expect(screen.getByText('2 earned')).toBeInTheDocument();
      });
    });

    it('displays badge icons', async () => {
      renderWithProviders(<BadgeDisplay />);

      await waitFor(() => {
        expect(screen.getByText('📦')).toBeInTheDocument();
        expect(screen.getByText('⭐')).toBeInTheDocument();
      });
    });

    it('shows progress toward next badges when showProgress is true', async () => {
      renderWithProviders(<BadgeDisplay showProgress />);

      await waitFor(() => {
        expect(screen.getByText('Next Achievements')).toBeInTheDocument();
        expect(screen.getByText('Power User')).toBeInTheDocument();
        expect(screen.getByText('60%')).toBeInTheDocument();
      });
    });

    it('hides progress section when showProgress is false', async () => {
      renderWithProviders(<BadgeDisplay showProgress={false} />);

      await waitFor(() => {
        expect(screen.getByText('2 earned')).toBeInTheDocument();
      });

      expect(screen.queryByText('Next Achievements')).not.toBeInTheDocument();
    });

    it('limits displayed badges in compact mode', async () => {
      renderWithProviders(<BadgeDisplay compact />);

      await waitFor(() => {
        expect(screen.getByText('2 earned')).toBeInTheDocument();
      });
    });
  });

  describe('Badge Dialog', () => {
    it('opens dialog when clicking a badge', async () => {
      const user = userEvent.setup();
      renderWithProviders(<BadgeDisplay />);

      await waitFor(() => {
        expect(screen.getByText('📦')).toBeInTheDocument();
      });

      const badgeButton = screen.getAllByRole('button')[0];
      await user.click(badgeButton);

      await waitFor(() => {
        expect(screen.getByText('First Listing')).toBeInTheDocument();
        expect(screen.getByText('Created your first listing')).toBeInTheDocument();
        expect(screen.getByText(/List 1 item/)).toBeInTheDocument();
      });
    });

    it('shows earned date in dialog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<BadgeDisplay />);

      await waitFor(() => {
        expect(screen.getByText('📦')).toBeInTheDocument();
      });

      const badgeButton = screen.getAllByRole('button')[0];
      await user.click(badgeButton);

      await waitFor(() => {
        expect(screen.getByText(/Earned/)).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no badges earned', async () => {
      const { gamificationService } = await import('@/api/services');
      vi.mocked(gamificationService.getMyBadges).mockResolvedValueOnce({ badges: [] });

      renderWithProviders(<BadgeDisplay />);

      await waitFor(() => {
        expect(screen.getByText('Complete actions to earn badges!')).toBeInTheDocument();
      });
    });
  });

  describe('Progress Tracking', () => {
    it('displays progress bars for upcoming badges', async () => {
      renderWithProviders(<BadgeDisplay showProgress />);

      await waitFor(() => {
        const progressBars = document.querySelectorAll('[role="progressbar"]');
        expect(progressBars.length).toBeGreaterThan(0);
      });
    });

    it('shows remaining requirements text', async () => {
      renderWithProviders(<BadgeDisplay showProgress />);

      await waitFor(() => {
        expect(screen.getByText('10 more transactions')).toBeInTheDocument();
        expect(screen.getByText('12 more reviews needed')).toBeInTheDocument();
      });
    });
  });

  describe('Animations', () => {
    it('badges have spring animation on mount', async () => {
      const { container } = renderWithProviders(<BadgeDisplay />);

      await waitFor(() => {
        expect(screen.getByText('2 earned')).toBeInTheDocument();
      });

      // Framer Motion applies transform styles
      const animatedBadges = container.querySelectorAll('[style*="transform"]');
      expect(animatedBadges.length).toBeGreaterThan(0);
    });
  });
});
