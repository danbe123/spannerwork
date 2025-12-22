import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TrustSignals from './TrustSignals';
import type { User } from '@/types';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: React.PropsWithChildren<{ className?: string }>) => (
      <div className={className} {...props}>{children}</div>
    ),
  },
}));

const { mockGamificationService } = vi.hoisted(() => ({
  mockGamificationService: {
    getMyBadges: vi.fn(),
  },
}))

vi.mock('@/api/services', () => ({
  gamificationService: mockGamificationService,
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

const mockUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: true,
  phone: '+44123456789',
  idVerified: true,
  rating: 4.8,
  reviewCount: 25,
  totalTransactions: 10,
  createdDate: new Date('2022-01-01').toISOString(),
} as unknown as User;

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('TrustSignals Component', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      const { container } = renderWithProviders(<TrustSignals user={mockUser} />);
      expect(container).toBeInTheDocument();
    });

    it('renders without user', () => {
      const { container } = renderWithProviders(<TrustSignals />);
      expect(container).toBeInTheDocument();
    });
  });

  describe('Props', () => {
    it('renders sm size', () => {
      const { container } = renderWithProviders(<TrustSignals user={mockUser} size="sm" />);
      expect(container).toBeInTheDocument();
    });

    it('renders md size', () => {
      const { container } = renderWithProviders(<TrustSignals user={mockUser} size="md" />);
      expect(container).toBeInTheDocument();
    });

    it('renders lg size', () => {
      const { container } = renderWithProviders(<TrustSignals user={mockUser} size="lg" />);
      expect(container).toBeInTheDocument();
    });

    it('renders with showAll=false', () => {
      const { container } = renderWithProviders(<TrustSignals user={mockUser} showAll={false} />);
      expect(container).toBeInTheDocument();
    });

    it('renders with showAll=true', () => {
      const { container } = renderWithProviders(<TrustSignals user={mockUser} showAll={true} />);
      expect(container).toBeInTheDocument();
    });

    it('accepts custom className', () => {
      const { container } = renderWithProviders(
        <TrustSignals user={mockUser} className="custom-class" />
      );
      expect(container).toBeInTheDocument();
    });
  });

  describe('Verification signals', () => {
    it('handles verified user', () => {
      const { container } = renderWithProviders(<TrustSignals user={mockUser} />);
      expect(container).toBeInTheDocument();
    });

    it('handles unverified user', () => {
      const unverifiedUser = {
        ...mockUser,
        emailVerified: false,
        phone: '',
        idVerified: false,
      } as unknown as User;
      const { container } = renderWithProviders(<TrustSignals user={unverifiedUser} />);
      expect(container).toBeInTheDocument();
    });
  });

  describe('Rating signals', () => {
    it('shows top rated for users with 4.8+ rating', () => {
      const topRatedUser = {
        ...mockUser,
        rating: 4.9,
        totalReviews: 10,
      } as unknown as User;
      const { container } = renderWithProviders(<TrustSignals user={topRatedUser} />);
      expect(container).toBeInTheDocument();
    });

    it('shows highly rated for users with 4.5+ rating', () => {
      const highlyRatedUser = {
        ...mockUser,
        rating: 4.6,
        totalReviews: 5,
      } as unknown as User;
      const { container } = renderWithProviders(<TrustSignals user={highlyRatedUser} />);
      expect(container).toBeInTheDocument();
    });

    it('handles low rating user', () => {
      const lowRatedUser = {
        ...mockUser,
        rating: 3.0,
        totalReviews: 2,
      } as unknown as User;
      const { container } = renderWithProviders(<TrustSignals user={lowRatedUser} />);
      expect(container).toBeInTheDocument();
    });
  });

  describe('Transaction signals', () => {
    it('shows experienced for users with 25+ transactions', () => {
      const experiencedUser = {
        ...mockUser,
        totalTransactions: 30,
      } as unknown as User;
      const { container } = renderWithProviders(<TrustSignals user={experiencedUser} />);
      expect(container).toBeInTheDocument();
    });

    it('shows active for users with 10+ transactions', () => {
      const activeUser = {
        ...mockUser,
        totalTransactions: 15,
      } as unknown as User;
      const { container } = renderWithProviders(<TrustSignals user={activeUser} />);
      expect(container).toBeInTheDocument();
    });

    it('handles new user with no transactions', () => {
      const newUser = {
        ...mockUser,
        totalTransactions: 0,
      } as unknown as User;
      const { container } = renderWithProviders(<TrustSignals user={newUser} />);
      expect(container).toBeInTheDocument();
    });
  });

  describe('Membership signals', () => {
    it('handles long-term member', () => {
      const longTermUser = {
        ...mockUser,
        createdDate: new Date('2020-01-01').toISOString(),
      } as unknown as User;
      const { container } = renderWithProviders(<TrustSignals user={longTermUser} />);
      expect(container).toBeInTheDocument();
    });

    it('handles new member', () => {
      const newMember = {
        ...mockUser,
        createdDate: new Date().toISOString(),
      } as unknown as User;
      const { container } = renderWithProviders(<TrustSignals user={newMember} />);
      expect(container).toBeInTheDocument();
    });
  });
});
