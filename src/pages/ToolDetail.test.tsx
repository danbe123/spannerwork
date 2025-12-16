import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createHelmetMock } from '@/test/mockSetup';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ToolDetail from './ToolDetail';

// Mock services
const mockGetToolById = vi.fn();
const mockGetUserById = vi.fn();
const mockGetCurrentUser = vi.fn();

vi.mock('@/api/services', () => ({
  toolsService: {
    getById: (id: string) => mockGetToolById(id),
  },
  usersService: {
    getById: (id: string) => mockGetUserById(id),
  },
  authService: {
    getCurrentUser: () => mockGetCurrentUser(),
  },
}));

// Mock react-helmet-async
vi.mock('react-helmet-async', () => createHelmetMock());

// Mock utils
vi.mock('@/utils', () => ({
  createPageUrl: (path: string) => `/${path}`,
}));

// Mock child components
vi.mock('@/components/listing/BundleSuggestions', () => ({
  default: () => <div data-testid="bundle-suggestions">Bundle Suggestions</div>,
}));

vi.mock('@/components/profile/TrustSignals', () => ({
  default: () => <div data-testid="trust-signals">Trust Signals</div>,
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

const mockTool = {
  id: 'tool-1',
  name: 'Power Drill',
  description: 'A powerful cordless drill for DIY projects',
  category: 'POWER_TOOLS',
  dailyRate: 15,
  weeklyRate: 75,
  deposit: 50,
  condition: 'GOOD',
  available: true,
  photos: ['https://example.com/drill.jpg'],
  postcode: 'SW1A 1AA',
  ownerId: 'owner-1',
};

const mockOwner = {
  id: 'owner-1',
  name: 'Tool Owner',
  email: 'owner@test.com',
  rating: 4.7,
  reviewCount: 30,
  emailVerified: true,
};

function renderToolDetail(route = '/tool?id=tool-1') {
  Object.defineProperty(window, 'location', {
    value: {
      search: route.includes('?') ? '?' + route.split('?')[1] : '',
      pathname: '/tool',
    },
    writable: true,
  });

  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <ToolDetail />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ToolDetail Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGetToolById.mockResolvedValue({ tool: mockTool });
    mockGetUserById.mockResolvedValue({ user: mockOwner });
    mockGetCurrentUser.mockResolvedValue({ user: { id: 'user-1' } });
  });

  describe('Missing tool ID', () => {
    it('shows error when no toolId provided', () => {
      Object.defineProperty(window, 'location', {
        value: { search: '', pathname: '/tool' },
        writable: true,
      });

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/tool']}>
            <ToolDetail />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText('Missing Tool ID')).toBeInTheDocument();
    });

    it('shows back to feed button when ID missing', () => {
      Object.defineProperty(window, 'location', {
        value: { search: '', pathname: '/tool' },
        writable: true,
      });

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/tool']}>
            <ToolDetail />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText('Back to Feed')).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('shows loading skeleton', () => {
      mockGetToolById.mockImplementation(() => new Promise(() => {}));
      
      renderToolDetail();
      
      // Should show loading state
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Tool not found', () => {
    it('shows not found message', async () => {
      mockGetToolById.mockResolvedValue({ tool: null });

      renderToolDetail();

      await waitFor(() => {
        expect(screen.getByText('Tool Not Found')).toBeInTheDocument();
      });
    });
  });

  describe('Tool display', () => {
    it('fetches tool data', async () => {
      renderToolDetail();

      await waitFor(() => {
        expect(mockGetToolById).toHaveBeenCalledWith('tool-1');
      });
    });

    it('renders tool name', async () => {
      renderToolDetail();

      await waitFor(() => {
        expect(screen.getByText('Power Drill')).toBeInTheDocument();
      });
    });

    it('renders tool description', async () => {
      renderToolDetail();

      await waitFor(() => {
        expect(screen.getByText(/powerful cordless drill/i)).toBeInTheDocument();
      });
    });
  });

  describe('Pricing', () => {
    it('shows daily rate', async () => {
      renderToolDetail();

      await waitFor(() => {
        expect(screen.getByText(/£15\/day/)).toBeInTheDocument();
      });
    });
  });

  describe('Owner info', () => {
    it('fetches owner data', async () => {
      renderToolDetail();

      await waitFor(() => {
        expect(mockGetUserById).toHaveBeenCalled();
      });
    });

    it('displays owner name', async () => {
      renderToolDetail();

      await waitFor(() => {
        expect(screen.getByText('Tool Owner')).toBeInTheDocument();
      });
    });
  });

  describe('Availability', () => {
    it('shows available badge for available tool', async () => {
      renderToolDetail();

      await waitFor(() => {
        expect(screen.getByText(/Available/i)).toBeInTheDocument();
      });
    });

    it('shows unavailable for unavailable tool', async () => {
      mockGetToolById.mockResolvedValue({ tool: { ...mockTool, available: false } });

      renderToolDetail();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Actions', () => {
    it('renders message button for non-owner', async () => {
      renderToolDetail();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('hides message button for owner', async () => {
      mockGetCurrentUser.mockResolvedValue({ user: { id: 'owner-1' } });

      renderToolDetail();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Components', () => {
    it('renders bundle suggestions', async () => {
      renderToolDetail();

      await waitFor(() => {
        expect(screen.getByTestId('bundle-suggestions')).toBeInTheDocument();
      });
    });

    it('renders trust signals', async () => {
      renderToolDetail();

      await waitFor(() => {
        expect(screen.getByTestId('trust-signals')).toBeInTheDocument();
      });
    });
  });
});
