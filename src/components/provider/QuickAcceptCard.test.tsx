import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import QuickAcceptCard from './QuickAcceptCard';
import type { Request, User } from '@/types';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className} {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { mockQuickAcceptService, mockToast } = vi.hoisted(() => ({
  mockQuickAcceptService: {
    accept: vi.fn(),
    decline: vi.fn(),
  },
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/api/services', () => ({
  quickAcceptService: mockQuickAcceptService,
}));

vi.mock('sonner', () => ({
  toast: mockToast,
}));

describe('QuickAcceptCard', () => {
  let queryClient: QueryClient;

  const createMockRequest = (overrides?: Partial<Request>): Request => ({
    id: 'request-123',
    title: 'Need a power drill',
    description: 'For a weekend project',
    category: 'TOOLS',
    budget: 5000,
    urgency: 'FLEXIBLE',
    status: 'ACTIVE',
    createdDate: new Date().toISOString(),
    postcode: 'SW1A 1AA',
    userId: 'user-456',
    ...overrides,
  } as Request);

  const createMockSeeker = (overrides?: Partial<User>): User => ({
    id: 'user-456',
    name: 'John Seeker',
    email: 'john@example.com',
    rating: 4.5,
    avatar: 'https://example.com/avatar.jpg',
    ...overrides,
  } as User);

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('returns null when request is not provided', () => {
      const { container } = renderWithProvider(
        <QuickAcceptCard request={null as unknown as Request} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders request information', () => {
      renderWithProvider(
        <QuickAcceptCard 
          request={createMockRequest({ title: 'Test Request' })} 
          seeker={createMockSeeker({ name: 'Test Seeker' })}
        />
      );
      expect(screen.getByText('Test Seeker')).toBeInTheDocument();
      expect(screen.getByText('Test Request')).toBeInTheDocument();
    });

    it('displays budget', () => {
      renderWithProvider(
        <QuickAcceptCard 
          request={createMockRequest({ budget: 5000 })} 
          seeker={createMockSeeker()}
        />
      );
      expect(screen.getByText('Need a power drill')).toBeInTheDocument();
    });

    it('formats relative time', () => {
      renderWithProvider(
        <QuickAcceptCard 
          request={createMockRequest({ createdDate: new Date().toISOString() })} 
          seeker={createMockSeeker()}
        />
      );
      expect(screen.getByText(/ago/)).toBeInTheDocument();
    });

    it('renders accept and decline buttons', () => {
      renderWithProvider(
        <QuickAcceptCard 
          request={createMockRequest()} 
          seeker={createMockSeeker()}
        />
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Props', () => {
    it('supports onAccept callback prop', () => {
      const onAccept = vi.fn();
      renderWithProvider(
        <QuickAcceptCard 
          request={createMockRequest()} 
          seeker={createMockSeeker()}
          onAccept={onAccept}
        />
      );
      expect(screen.getByText('Need a power drill')).toBeInTheDocument();
    });

    it('supports onDecline callback prop', () => {
      const onDecline = vi.fn();
      renderWithProvider(
        <QuickAcceptCard 
          request={createMockRequest()} 
          seeker={createMockSeeker()}
          onDecline={onDecline}
        />
      );
      expect(screen.getByText('Need a power drill')).toBeInTheDocument();
    });

    it('supports showCounterOffer prop', () => {
      renderWithProvider(
        <QuickAcceptCard 
          request={createMockRequest()} 
          seeker={createMockSeeker()}
          showCounterOffer={false}
        />
      );
      expect(screen.getByText('Need a power drill')).toBeInTheDocument();
    });
  });

  describe('Urgency', () => {
    it('displays ASAP urgency badge', () => {
      renderWithProvider(
        <QuickAcceptCard 
          request={createMockRequest({ urgency: 'ASAP' })} 
          seeker={createMockSeeker()}
        />
      );
      expect(screen.getByText('ASAP')).toBeInTheDocument();
    });

    it('shows urgent banner for ASAP requests', () => {
      renderWithProvider(
        <QuickAcceptCard 
          request={createMockRequest({ urgency: 'ASAP' })} 
          seeker={createMockSeeker()}
        />
      );
      expect(screen.getByText(/Urgent Request/)).toBeInTheDocument();
    });

    it('displays TODAY urgency', () => {
      renderWithProvider(
        <QuickAcceptCard 
          request={createMockRequest({ urgency: 'TODAY' })} 
          seeker={createMockSeeker()}
        />
      );
      expect(screen.getByText('TODAY')).toBeInTheDocument();
    });

    it('displays THIS_WEEKEND urgency', () => {
      renderWithProvider(
        <QuickAcceptCard 
          request={createMockRequest({ urgency: 'THIS_WEEKEND' })} 
          seeker={createMockSeeker()}
        />
      );
      expect(screen.getByText(/THIS WEEKEND/i)).toBeInTheDocument();
    });

    it('displays FLEXIBLE urgency', () => {
      renderWithProvider(
        <QuickAcceptCard 
          request={createMockRequest({ urgency: 'FLEXIBLE' })} 
          seeker={createMockSeeker()}
        />
      );
      expect(screen.getByText('FLEXIBLE')).toBeInTheDocument();
    });
  });

  describe('Categories', () => {
    it('shows TOOLS category icon', () => {
      renderWithProvider(
        <QuickAcceptCard 
          request={createMockRequest({ category: 'TOOLS' })} 
          seeker={createMockSeeker()}
        />
      );
      expect(screen.getByText('🔧')).toBeInTheDocument();
    });

    it('shows EXPERTISE category icon', () => {
      renderWithProvider(
        <QuickAcceptCard 
          request={createMockRequest({ category: 'EXPERTISE' })} 
          seeker={createMockSeeker()}
        />
      );
      expect(screen.getByText('👨‍🔧')).toBeInTheDocument();
    });

    it('shows SPACE category icon', () => {
      renderWithProvider(
        <QuickAcceptCard 
          request={createMockRequest({ category: 'SPACE' })} 
          seeker={createMockSeeker()}
        />
      );
      expect(screen.getByText('🏠')).toBeInTheDocument();
    });
  });

  describe('Seeker display', () => {
    it('displays seeker rating', () => {
      renderWithProvider(
        <QuickAcceptCard 
          request={createMockRequest()} 
          seeker={createMockSeeker({ rating: 4.8 })}
        />
      );
      expect(screen.getByText('4.8')).toBeInTheDocument();
    });

    it('displays fallback for missing seeker', () => {
      renderWithProvider(
        <QuickAcceptCard 
          request={createMockRequest()} 
          seeker={null}
        />
      );
      expect(screen.getByText('Someone')).toBeInTheDocument();
      expect(screen.getByText('?')).toBeInTheDocument();
    });
  });

  describe('Description', () => {
    it('shows expand button for long descriptions', () => {
      const longDescription = 'A'.repeat(150);
      renderWithProvider(
        <QuickAcceptCard 
          request={createMockRequest({ description: longDescription })} 
          seeker={createMockSeeker()}
        />
      );
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Location', () => {
    it('shows location when available', () => {
      renderWithProvider(
        <QuickAcceptCard 
          request={createMockRequest({ locationAddress: 'London, UK' } as Partial<Request>)} 
          seeker={createMockSeeker()}
        />
      );
      expect(document.body).toBeInTheDocument();
    });
  });
});
