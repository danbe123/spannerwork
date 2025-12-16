import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createFramerMotionMock, createHelmetMock } from '@/test/mockSetup';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock services
vi.mock('@/api/services', () => ({
  authService: {
    getCurrentUser: vi.fn().mockResolvedValue({
      user: { 
        id: 'user-1', 
        name: 'Test Provider', 
        email: 'provider@example.com',
        role: 'USER',
      },
    }),
  },
  quickAcceptService: {
    getPending: vi.fn().mockResolvedValue({
      responses: [
        {
          id: 'resp-1',
          request: {
            id: 'req-1',
            title: 'Need tool rental',
            category: 'Tool',
            urgency: 'ASAP',
          },
          createdAt: new Date().toISOString(),
        },
      ],
    }),
  },
  gamificationService: {
    getMyStats: vi.fn().mockResolvedValue({
      stats: {
        totalListings: 5,
        totalTransactions: 12,
        rating: 4.8,
        badges: ['FIRST_LISTING', 'FIVE_STAR'],
      },
    }),
    getMyBadges: vi.fn().mockResolvedValue({
      badges: [],
    }),
  },
}));

// Mock components that might cause issues
interface MockQuickAcceptProps {
  response?: { request?: { title?: string } };
}
vi.mock('@/components/provider/QuickAcceptCard', () => ({
  default: ({ response }: MockQuickAcceptProps) => (
    <div data-testid="quick-accept-card">{response?.request?.title}</div>
  ),
}));

vi.mock('@/components/gamification/BadgeDisplay', () => ({
  default: () => <div data-testid="badge-display">Badges</div>,
}));

vi.mock('@/components/feed/LiveActivityFeed', () => ({
  default: () => <div data-testid="live-activity-feed">Activity Feed</div>,
}));

// Mock framer-motion
vi.mock('framer-motion', () => createFramerMotionMock());

// Mock react-helmet-async
vi.mock('react-helmet-async', () => createHelmetMock());

import ProviderDashboard from './ProviderDashboard';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ProviderDashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders provider dashboard', async () => {
    renderWithProviders(<ProviderDashboard />);

    await waitFor(() => {
      expect(document.body).toBeInTheDocument();
    });
  });

  it('displays quick stats', async () => {
    renderWithProviders(<ProviderDashboard />);

    await waitFor(() => {
      // Check for stats labels
      expect(screen.getByText(/My Listings/i)).toBeInTheDocument();
      expect(screen.getByText(/Active Requests/i)).toBeInTheDocument();
      expect(screen.getByText(/Completed Jobs/i)).toBeInTheDocument();
      expect(screen.getByText(/Rating/i)).toBeInTheDocument();
    });
  });

  it('shows listings count from stats', async () => {
    renderWithProviders(<ProviderDashboard />);

    await waitFor(() => {
      // Should show 5 listings
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  it('shows completed jobs count', async () => {
    renderWithProviders(<ProviderDashboard />);

    await waitFor(() => {
      // Should show 12 completed jobs
      expect(screen.getByText('12')).toBeInTheDocument();
    });
  });

  it('shows rating', async () => {
    renderWithProviders(<ProviderDashboard />);

    await waitFor(() => {
      // Should show 4.8 rating
      expect(screen.getByText('4.8')).toBeInTheDocument();
    });
  });

  it('shows pending requests section', async () => {
    renderWithProviders(<ProviderDashboard />);

    await waitFor(() => {
      // Should show quick accept card with pending request
      expect(screen.getByTestId('quick-accept-card')).toBeInTheDocument();
    });
  });

  it('renders tabs', async () => {
    renderWithProviders(<ProviderDashboard />);

    await waitFor(() => {
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });
  });
});
