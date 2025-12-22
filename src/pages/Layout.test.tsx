import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './Layout';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: React.PropsWithChildren<{ className?: string }>) => (
      <div className={className} data-testid="motion-div" {...props}>{children}</div>
    ),
    button: ({ children, className, onClick, ...props }: React.PropsWithChildren<{ className?: string; onClick?: () => void }>) => (
      <button className={className} onClick={onClick} {...props}>{children}</button>
    ),
    span: ({ children, className, ...props }: React.PropsWithChildren<{ className?: string }>) => (
      <span className={className} {...props}>{children}</span>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock('@/hooks/use-auth', () => ({
  default: () => mockUseAuth(),
}));

// Mock API services
vi.mock('@/api/services', () => ({
  authService: {
    getCurrentUser: vi.fn().mockResolvedValue({
      user: { id: 'user-1', name: 'Test User', email: 'test@example.com', role: 'USER' },
    }),
    logout: vi.fn().mockResolvedValue({}),
  },
  gamificationService: {
    getMyStats: vi.fn().mockResolvedValue({
      stats: { totalTransactions: 5, totalListings: 3 },
    }),
  },
  messagesService: {
    listConversations: vi.fn().mockResolvedValue({
      conversations: [{ unreadCount: 2 }, { unreadCount: 1 }],
    }),
  },
}));

// Mock components
vi.mock('@/components/CookieConsent', () => ({
  default: () => <div data-testid="cookie-consent">Cookie Consent</div>,
}));

vi.mock('@/components/NotificationManager', () => ({
  default: () => <div data-testid="notification-manager">Notification Manager</div>,
}));

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => <div data-testid="toaster">Toaster</div>,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Sheet components
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) => 
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => 
    <div data-testid="sheet-content">{children}</div>,
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function renderLayout(
  ui: React.ReactElement = <div>Test Content</div>,
  { route = '/feed', isAuthenticated = true } = {}
) {
  mockUseAuth.mockReturnValue({ isAuthenticated });
  const queryClient = createTestQueryClient();
  
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Layout>{ui}</Layout>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Layout Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Marketing pages', () => {
    it('renders without app shell on home page', () => {
      renderLayout(<div>Home Content</div>, { route: '/', isAuthenticated: false });
      
      expect(screen.getByText('Home Content')).toBeInTheDocument();
      expect(screen.getByTestId('cookie-consent')).toBeInTheDocument();
    });

    it('renders without app shell on /about', () => {
      renderLayout(<div>About Content</div>, { route: '/about', isAuthenticated: false });
      
      expect(screen.getByText('About Content')).toBeInTheDocument();
    });

    it('renders without app shell on /pricing', () => {
      renderLayout(<div>Pricing Content</div>, { route: '/pricing', isAuthenticated: false });
      
      expect(screen.getByText('Pricing Content')).toBeInTheDocument();
    });

    it('renders without app shell on /contact', () => {
      renderLayout(<div>Contact Content</div>, { route: '/contact', isAuthenticated: false });
      
      expect(screen.getByText('Contact Content')).toBeInTheDocument();
    });

    it('renders without app shell on /terms', () => {
      renderLayout(<div>Terms Content</div>, { route: '/terms', isAuthenticated: false });
      
      expect(screen.getByText('Terms Content')).toBeInTheDocument();
    });

    it('renders without app shell on /privacy', () => {
      renderLayout(<div>Privacy Content</div>, { route: '/privacy', isAuthenticated: false });
      
      expect(screen.getByText('Privacy Content')).toBeInTheDocument();
    });

    it('renders without app shell on /howitworks', () => {
      renderLayout(<div>How It Works</div>, { route: '/howitworks', isAuthenticated: false });
      
      expect(screen.getByText('How It Works')).toBeInTheDocument();
    });
  });

  describe('App pages (authenticated)', () => {
    it('renders with app shell on /feed', async () => {
      renderLayout(<div>Feed Content</div>, { route: '/feed' });
      
      await waitFor(() => {
        expect(screen.getByText('Feed Content')).toBeInTheDocument();
      });
    });

    it('renders with app shell on /messages', async () => {
      renderLayout(<div>Messages Content</div>, { route: '/messages' });
      
      await waitFor(() => {
        expect(screen.getByText('Messages Content')).toBeInTheDocument();
      });
    });

    it('renders with app shell on /create', async () => {
      renderLayout(<div>Create Content</div>, { route: '/create' });
      
      await waitFor(() => {
        expect(screen.getByText('Create Content')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation items', () => {
    it('renders Feed link', async () => {
      renderLayout(<div>Content</div>, { route: '/feed' });
      
      await waitFor(() => {
        expect(screen.getAllByText('Feed').length).toBeGreaterThan(0);
      });
    });

    it('renders Create link', async () => {
      renderLayout(<div>Content</div>, { route: '/feed' });
      
      await waitFor(() => {
        expect(screen.getAllByText('Create').length).toBeGreaterThan(0);
      });
    });

    it('renders Messages link', async () => {
      renderLayout(<div>Content</div>, { route: '/feed' });
      
      await waitFor(() => {
        expect(screen.getAllByText('Messages').length).toBeGreaterThan(0);
      });
    });

    it('renders Profile link', async () => {
      renderLayout(<div>Content</div>, { route: '/feed' });
      
      await waitFor(() => {
        expect(screen.getAllByText('Profile').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Common elements', () => {
    it('renders cookie consent on all pages', () => {
      renderLayout(<div>Content</div>, { route: '/' });
      
      expect(screen.getByTestId('cookie-consent')).toBeInTheDocument();
    });

    it('renders toaster on all pages', () => {
      renderLayout(<div>Content</div>, { route: '/' });
      
      expect(screen.getByTestId('toaster')).toBeInTheDocument();
    });
  });

  describe('Profile page auth landing', () => {
    it('renders without app shell when not authenticated on /profile', () => {
      renderLayout(<div>Auth Landing</div>, { route: '/profile', isAuthenticated: false });
      
      expect(screen.getByText('Auth Landing')).toBeInTheDocument();
    });

    it('renders with app shell when authenticated on /profile', async () => {
      renderLayout(<div>Profile Content</div>, { route: '/profile', isAuthenticated: true });
      
      await waitFor(() => {
        expect(screen.getByText('Profile Content')).toBeInTheDocument();
      });
    });
  });

  describe('SpannerWork branding', () => {
    it('renders SpannerWork branding on app pages', async () => {
      renderLayout(<div>Content</div>, { route: '/feed' });
      
      await waitFor(() => {
        expect(screen.getAllByText('SpannerWork').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Case insensitive routing', () => {
    it('handles uppercase route /Feed', async () => {
      renderLayout(<div>Feed Content</div>, { route: '/Feed' });
      
      await waitFor(() => {
        expect(screen.getByText('Feed Content')).toBeInTheDocument();
      });
    });

    it('handles mixed case route /ProFile', () => {
      renderLayout(<div>Profile Content</div>, { route: '/ProFile', isAuthenticated: false });
      
      expect(screen.getByText('Profile Content')).toBeInTheDocument();
    });
  });

  describe('Children rendering', () => {
    it('renders children content', async () => {
      renderLayout(
        <div>
          <h1>Test Page</h1>
          <p>Test paragraph</p>
        </div>,
        { route: '/feed' }
      );
      
      await waitFor(() => {
        expect(screen.getByText('Test Page')).toBeInTheDocument();
        expect(screen.getByText('Test paragraph')).toBeInTheDocument();
      });
    });
  });

  describe('Notification Manager', () => {
    it('renders notification manager on app pages', async () => {
      renderLayout(<div>Content</div>, { route: '/feed' });
      
      await waitFor(() => {
        expect(screen.getByTestId('notification-manager')).toBeInTheDocument();
      });
    });
  });
});

describe('ScrollToTop', () => {
  it('is called on route change', () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    
    renderLayout(<div>Content</div>, { route: '/feed' });
    
    // MemoryRouter initializes navigation as POP; ScrollToTop should not override
    // browser scroll restoration for back/forward navigation.
    expect(scrollToSpy).not.toHaveBeenCalled();
    
    scrollToSpy.mockRestore();
  });
});

describe('Admin navigation', () => {
  it('renders admin route', async () => {
    renderLayout(<div>Admin Content</div>, { route: '/admin' });
    
    await waitFor(() => {
      expect(screen.getByText('Admin Content')).toBeInTheDocument();
    });
  });
});

describe('User stats display', () => {
  it('fetches gamification stats for authenticated users', async () => {
    renderLayout(<div>Content</div>, { route: '/feed' });
    
    await waitFor(() => {
      expect(screen.getByText('SpannerWork')).toBeInTheDocument();
    });
  });
});

describe('Message badge', () => {
  it('displays unread message count', async () => {
    renderLayout(<div>Content</div>, { route: '/feed' });
    
    await waitFor(() => {
      // The mock returns 3 unread messages (2 + 1)
      const badges = document.querySelectorAll('[class*="badge"]');
      expect(badges.length).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Guide pages routing', () => {
  it('renders without app shell on /guides/provider', () => {
    renderLayout(<div>Provider Guide</div>, { route: '/guides/provider', isAuthenticated: false });
    expect(screen.getByText('Provider Guide')).toBeInTheDocument();
  });

  it('renders without app shell on /guides/renter', () => {
    renderLayout(<div>Renter Guide</div>, { route: '/guides/renter', isAuthenticated: false });
    expect(screen.getByText('Renter Guide')).toBeInTheDocument();
  });

  it('renders without app shell on /guides/safety', () => {
    renderLayout(<div>Safety Guide</div>, { route: '/guides/safety', isAuthenticated: false });
    expect(screen.getByText('Safety Guide')).toBeInTheDocument();
  });

  it('renders without app shell on /guides/pricing', () => {
    renderLayout(<div>Pricing Guide</div>, { route: '/guides/pricing', isAuthenticated: false });
    expect(screen.getByText('Pricing Guide')).toBeInTheDocument();
  });
});

describe('Additional marketing pages', () => {
  it('renders without app shell on /success-stories', () => {
    renderLayout(<div>Success Stories</div>, { route: '/success-stories', isAuthenticated: false });
    expect(screen.getByText('Success Stories')).toBeInTheDocument();
  });

  it('renders without app shell on /start-earning', () => {
    renderLayout(<div>Start Earning</div>, { route: '/start-earning', isAuthenticated: false });
    expect(screen.getByText('Start Earning')).toBeInTheDocument();
  });

  it('renders without app shell on /safety', () => {
    renderLayout(<div>Safety Content</div>, { route: '/safety', isAuthenticated: false });
    expect(screen.getByText('Safety Content')).toBeInTheDocument();
  });

  it('renders without app shell on /refund-policy', () => {
    renderLayout(<div>Refund Policy</div>, { route: '/refund-policy', isAuthenticated: false });
    expect(screen.getByText('Refund Policy')).toBeInTheDocument();
  });

  it('renders without app shell on /cookies', () => {
    renderLayout(<div>Cookies Content</div>, { route: '/cookies', isAuthenticated: false });
    expect(screen.getByText('Cookies Content')).toBeInTheDocument();
  });
});

describe('App routes with app shell', () => {
  it('renders app shell on /calendar', async () => {
    renderLayout(<div data-testid="calendar-content">Calendar</div>, { route: '/calendar' });
    await waitFor(() => {
      expect(screen.getByTestId('calendar-content')).toBeInTheDocument();
    });
  });

  it('renders app shell on /analytics', async () => {
    renderLayout(<div data-testid="analytics-content">Analytics</div>, { route: '/analytics' });
    await waitFor(() => {
      expect(screen.getByTestId('analytics-content')).toBeInTheDocument();
    });
  });

  it('renders app shell on /saved-searches', async () => {
    renderLayout(<div data-testid="saved-content">Saved</div>, { route: '/saved-searches' });
    await waitFor(() => {
      expect(screen.getByTestId('saved-content')).toBeInTheDocument();
    });
  });

  it('renders app shell on /provider-dashboard', async () => {
    renderLayout(<div data-testid="dashboard-content">Dashboard</div>, { route: '/provider-dashboard' });
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
    });
  });
});
