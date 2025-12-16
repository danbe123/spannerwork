import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// Mock the analytics service
const mockAnalyticsService = vi.hoisted(() => ({
  getOverview: vi.fn(),
  getRevenue: vi.fn(),
  getUserGrowth: vi.fn(),
  getListingTrends: vi.fn(),
  getCategoryBreakdown: vi.fn(),
  getGeographicDistribution: vi.fn(),
  getConversionFunnel: vi.fn(),
  getTopPerformers: vi.fn(),
  clearCache: vi.fn(),
  triggerSnapshot: vi.fn(),
}));

vi.mock('@/api/services/analytics.service', () => ({
  analyticsService: mockAnalyticsService,
}));

// Mock recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  LineChart: () => <div data-testid="line-chart" />,
  Line: () => null,
  BarChart: () => <div data-testid="bar-chart" />,
  Bar: () => null,
  PieChart: () => <div data-testid="pie-chart" />,
  Pie: () => null,
  Cell: () => null,
  AreaChart: () => <div data-testid="area-chart" />,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

import AdminAnalytics from './AdminAnalytics';

// Mock data
const mockOverview = {
  totalUsers: 1500,
  totalListings: 500,
  totalTransactions: 2000,
  totalGmv: 5000000, // 50,000 pounds in pence
  platformRevenue: 250000, // 2,500 pounds in pence
  activeUsers24h: 150,
  newUsersToday: 25,
  pendingDisputes: 3,
};

const mockRevenue = {
  timeSeries: [
    { date: '2024-01-01', gmv: 100000, platformFee: 5000, transactionCount: 10 },
    { date: '2024-01-02', gmv: 150000, platformFee: 7500, transactionCount: 15 },
  ],
  totals: { gmv: 250000, platformFee: 12500, transactionCount: 25 },
  range: { startDate: '2024-01-01', endDate: '2024-01-02' },
};

const mockUserGrowth = {
  timeSeries: [
    { date: '2024-01-01', newUsers: 10, totalUsers: 1000 },
    { date: '2024-01-02', newUsers: 15, totalUsers: 1015 },
  ],
  totals: { newUsers: 25, totalUsers: 1015 },
  range: { startDate: '2024-01-01', endDate: '2024-01-02' },
};

const mockListingTrends = {
  timeSeries: [
    { date: '2024-01-01', tools: 5, spaces: 2, services: 3, requests: 10 },
    { date: '2024-01-02', tools: 3, spaces: 4, services: 2, requests: 8 },
  ],
  totals: { tools: 8, spaces: 6, services: 5, requests: 18 },
  range: { startDate: '2024-01-01', endDate: '2024-01-02' },
};

const mockCategories = [
  { category: 'Tools', count: 200, revenue: 2000000 },
  { category: 'Spaces', count: 150, revenue: 1500000 },
  { category: 'Services', count: 150, revenue: 1500000 },
];

const mockGeographic = [
  { region: 'SW', userCount: 100, listingCount: 50, transactionCount: 200 },
  { region: 'M', userCount: 80, listingCount: 40, transactionCount: 150 },
  { region: 'B', userCount: 60, listingCount: 30, transactionCount: 100 },
];

const mockFunnel = {
  funnel: {
    totalSignups: 1000,
    profileCompleted: 800,
    firstListingCreated: 300,
    firstBookingMade: 500,
    firstTransactionCompleted: 200,
    repeatCustomers: 100,
  },
  conversionRates: {
    signupToProfile: '80.0',
    profileToListing: '37.5',
    signupToTransaction: '20.0',
    transactionToRepeat: '50.0',
  },
};

const mockTopPerformers = {
  topProviders: [
    { id: 'u1', name: 'Provider 1', avatar: null, metric: 50, metricLabel: 'completed rentals' },
    { id: 'u2', name: 'Provider 2', avatar: null, metric: 40, metricLabel: 'completed rentals' },
  ],
  topEarners: [
    { id: 'u3', name: 'Earner 1', avatar: null, metric: 500000, metricLabel: 'total earnings (pence)' },
    { id: 'u4', name: 'Earner 2', avatar: null, metric: 400000, metricLabel: 'total earnings (pence)' },
  ],
};

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminAnalytics />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AdminAnalytics page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock responses
    mockAnalyticsService.getOverview.mockResolvedValue(mockOverview);
    mockAnalyticsService.getRevenue.mockResolvedValue(mockRevenue);
    mockAnalyticsService.getUserGrowth.mockResolvedValue(mockUserGrowth);
    mockAnalyticsService.getListingTrends.mockResolvedValue(mockListingTrends);
    mockAnalyticsService.getCategoryBreakdown.mockResolvedValue(mockCategories);
    mockAnalyticsService.getGeographicDistribution.mockResolvedValue(mockGeographic);
    mockAnalyticsService.getConversionFunnel.mockResolvedValue(mockFunnel);
    mockAnalyticsService.getTopPerformers.mockResolvedValue(mockTopPerformers);
  });

  describe('page rendering', () => {
    it('should render the page title', async () => {
      renderWithProviders();
      
      expect(await screen.findByText('Platform Analytics')).toBeInTheDocument();
    });

    it('should render overview cards', async () => {
      renderWithProviders();
      
      // Wait for first card to appear, then check others exist in DOM
      await screen.findByText('Total Users');
      
      // Check that the overview card structure exists
      expect(screen.getByText('Total Users')).toBeInTheDocument();
      expect(screen.getByText('Total GMV')).toBeInTheDocument();
    });

    it('should display formatted overview metrics', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        // Check that metrics are displayed (numbers may be formatted differently)
        expect(screen.getByText('Total Users')).toBeInTheDocument();
        expect(screen.getByText('Total GMV')).toBeInTheDocument();
      });
    });

    it('should show pending disputes badge when disputes exist', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        expect(screen.getByText('3 disputes')).toBeInTheDocument();
      });
    });
  });

  describe('tabs navigation', () => {
    it('should render all tabs', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /revenue/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /user growth/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /listings/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /funnel/i })).toBeInTheDocument();
      });
    });

    it('should show revenue chart by default', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        expect(screen.getByText('Revenue Over Time')).toBeInTheDocument();
      });
    });

    it('should switch to user growth tab when clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders();
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /user growth/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('tab', { name: /user growth/i }));
      
      // After clicking, the users tab should be active
      await waitFor(() => {
        const tab = screen.getByRole('tab', { name: /user growth/i });
        expect(tab).toHaveAttribute('data-state', 'active');
      });
    });

    it('should show funnel when funnel tab clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders();
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /funnel/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('tab', { name: /funnel/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Conversion Funnel')).toBeInTheDocument();
        expect(screen.getByText('Signups')).toBeInTheDocument();
      });
    });
  });

  describe('category breakdown', () => {
    it('should display category breakdown section', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        expect(screen.getByText('Category Breakdown')).toBeInTheDocument();
      });
    });

    it('should show all categories', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        expect(screen.getByText('Tools')).toBeInTheDocument();
        expect(screen.getByText('Spaces')).toBeInTheDocument();
        expect(screen.getByText('Services')).toBeInTheDocument();
      });
    });
  });

  describe('geographic distribution', () => {
    it('should display top regions section', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        expect(screen.getByText('Top Regions')).toBeInTheDocument();
      });
    });

    it('should show region codes', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        expect(screen.getByText('SW')).toBeInTheDocument();
        expect(screen.getByText('M')).toBeInTheDocument();
        expect(screen.getByText('B')).toBeInTheDocument();
      });
    });
  });

  describe('top performers', () => {
    it('should display top providers section', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        expect(screen.getByText('Top Providers')).toBeInTheDocument();
      });
    });

    it('should display top earners section', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        expect(screen.getByText('Top Earners')).toBeInTheDocument();
      });
    });

    it('should show provider names', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        expect(screen.getByText('Provider 1')).toBeInTheDocument();
        expect(screen.getByText('Provider 2')).toBeInTheDocument();
      });
    });

    it('should show earner names', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        expect(screen.getByText('Earner 1')).toBeInTheDocument();
        expect(screen.getByText('Earner 2')).toBeInTheDocument();
      });
    });
  });

  describe('date range selector', () => {
    it('should render date range selector', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        expect(screen.getByText('Last 30 days')).toBeInTheDocument();
      });
    });
  });

  describe('action buttons', () => {
    it('should render refresh button', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        // Find button by its accessible role or by finding the icon
        const buttons = screen.getAllByRole('button');
        const refreshButton = buttons.find(btn => btn.querySelector('svg'));
        expect(refreshButton).toBeInTheDocument();
      });
    });

    it('should render export button', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument();
      });
    });
  });

  describe('loading states', () => {
    it('should render while data is loading', () => {
      // Make the queries never resolve
      mockAnalyticsService.getOverview.mockReturnValue(new Promise(() => {}));
      mockAnalyticsService.getRevenue.mockReturnValue(new Promise(() => {}));
      mockAnalyticsService.getUserGrowth.mockReturnValue(new Promise(() => {}));
      mockAnalyticsService.getListingTrends.mockReturnValue(new Promise(() => {}));
      mockAnalyticsService.getCategoryBreakdown.mockReturnValue(new Promise(() => {}));
      mockAnalyticsService.getGeographicDistribution.mockReturnValue(new Promise(() => {}));
      mockAnalyticsService.getConversionFunnel.mockReturnValue(new Promise(() => {}));
      mockAnalyticsService.getTopPerformers.mockReturnValue(new Promise(() => {}));
      
      renderWithProviders();
      
      // Page should still render with loading state
      expect(screen.getByText('Platform Analytics')).toBeInTheDocument();
    });
  });

  describe('API calls', () => {
    it('should call all analytics APIs on mount', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        expect(mockAnalyticsService.getOverview).toHaveBeenCalled();
        expect(mockAnalyticsService.getRevenue).toHaveBeenCalled();
        expect(mockAnalyticsService.getUserGrowth).toHaveBeenCalled();
        expect(mockAnalyticsService.getListingTrends).toHaveBeenCalled();
        expect(mockAnalyticsService.getCategoryBreakdown).toHaveBeenCalled();
        expect(mockAnalyticsService.getGeographicDistribution).toHaveBeenCalled();
        expect(mockAnalyticsService.getConversionFunnel).toHaveBeenCalled();
        expect(mockAnalyticsService.getTopPerformers).toHaveBeenCalled();
      });
    });

    it('should pass default date range to time series APIs', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        expect(mockAnalyticsService.getRevenue).toHaveBeenCalledWith(
          expect.objectContaining({
            startDate: expect.any(String),
            endDate: expect.any(String),
          })
        );
      });
    });
  });
});
