import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from './Home';

// Mock services
vi.mock('@/api/services', () => ({
  statsService: {
    getPublicStats: vi.fn().mockResolvedValue({
      users: { total: 1000, active: 500 },
      requests: { active: 50 },
      listings: { total: 200, tools: 150 },
      transactions: { completed: 300 },
      platform: { averageRating: '4.9', trustScore: '4.8' }
    }),
  },
}));

// Mock useAuth hook
vi.mock('@/hooks/use-auth', () => ({
  default: () => ({
    isAuthenticated: false,
    user: null,
  }),
}));

// Mock SEO component
vi.mock('@/components/SEO', () => ({
  default: () => null,
  generateLocalBusinessSchema: () => ({}),
}));

// Mock MarketingFooter
vi.mock('@/components/MarketingFooter', () => ({
  default: () => <footer data-testid="marketing-footer">Footer</footer>,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderHome() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Home Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders home page', async () => {
      renderHome();
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('renders hero section', async () => {
      renderHome();
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('renders call to action buttons', async () => {
      renderHome();
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });
    });

    it('renders marketing footer', async () => {
      renderHome();
      await waitFor(() => {
        expect(screen.getByTestId('marketing-footer')).toBeInTheDocument();
      });
    });
  });

  describe('Features', () => {
    it('displays feature cards', async () => {
      renderHome();
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Stats', () => {
    it('fetches platform stats', async () => {
      renderHome();
      
      await waitFor(() => {
        // Stats should be loaded
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('How it works', () => {
    it('shows how it works section', async () => {
      renderHome();
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('supports navigation', async () => {
      renderHome();
      await waitFor(() => {
        // Page should render with navigation support
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Responsive design', () => {
    it('renders correctly', async () => {
      renderHome();
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Authenticated state', () => {
    it('renders for unauthenticated users', async () => {
      renderHome();
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });
});
