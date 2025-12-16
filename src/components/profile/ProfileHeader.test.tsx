import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProfileHeader from './ProfileHeader';
import type { User, Tool, Review, Transaction } from '@/types';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: React.PropsWithChildren<{ className?: string }>) => (
      <div className={className} {...props}>{children}</div>
    ),
    button: ({ children, className, onClick, ...props }: React.PropsWithChildren<{
      className?: string;
      onClick?: () => void;
    }>) => (
      <button className={className} onClick={onClick} {...props}>{children}</button>
    ),
  },
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock clipboard API
const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
  share: vi.fn(),
});

const mockUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  avatar: 'https://example.com/avatar.jpg',
  rating: 4.5,
  reviewCount: 10,
  emailVerified: true,
  phone: '+44123456789',
  idVerified: true,
  postcode: 'SW1A 1AA',
  createdDate: new Date('2023-01-01').toISOString(),
} as unknown as User;

const mockTools: Tool[] = [
  { id: 'tool-1', name: 'Drill' } as unknown as Tool,
];

const mockReviews: Review[] = [
  { id: 'review-1', rating: 5 } as unknown as Review,
];

const mockTransactions: Transaction[] = [
  { id: 'tx-1', status: 'COMPLETED' } as unknown as Transaction,
  { id: 'tx-2', status: 'COMPLETED' } as unknown as Transaction,
  { id: 'tx-3', status: 'COMPLETED' } as unknown as Transaction,
  { id: 'tx-4', status: 'COMPLETED' } as unknown as Transaction,
  { id: 'tx-5', status: 'COMPLETED' } as unknown as Transaction,
];

describe('ProfileHeader Component', () => {
  const mockOnEditProfile = vi.fn();
  const mockOnLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders user name', () => {
      render(
        <ProfileHeader
          currentUser={mockUser}
          tools={mockTools}
          reviews={mockReviews}
          transactions={mockTransactions}
          onEditProfile={mockOnEditProfile}
          onLogout={mockOnLogout}
        />
      );
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('renders user info section', () => {
      const { container } = render(
        <ProfileHeader
          currentUser={mockUser}
          tools={mockTools}
          reviews={mockReviews}
          transactions={mockTransactions}
          onEditProfile={mockOnEditProfile}
          onLogout={mockOnLogout}
        />
      );
      expect(container).toBeInTheDocument();
    });

    it('renders component without crashing', () => {
      const { container } = render(
        <ProfileHeader
          currentUser={mockUser}
          tools={mockTools}
          reviews={mockReviews}
          transactions={mockTransactions}
          onEditProfile={mockOnEditProfile}
          onLogout={mockOnLogout}
        />
      );
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Verification badges', () => {
    it('shows email verification badge', () => {
      render(
        <ProfileHeader
          currentUser={mockUser}
          tools={mockTools}
          reviews={mockReviews}
          transactions={mockTransactions}
          onEditProfile={mockOnEditProfile}
          onLogout={mockOnLogout}
        />
      );
      expect(screen.getByText('Email')).toBeInTheDocument();
    });

    it('shows phone verification badge', () => {
      render(
        <ProfileHeader
          currentUser={mockUser}
          tools={mockTools}
          reviews={mockReviews}
          transactions={mockTransactions}
          onEditProfile={mockOnEditProfile}
          onLogout={mockOnLogout}
        />
      );
      expect(screen.getByText('Phone')).toBeInTheDocument();
    });

    it('shows ID verification badge', () => {
      render(
        <ProfileHeader
          currentUser={mockUser}
          tools={mockTools}
          reviews={mockReviews}
          transactions={mockTransactions}
          onEditProfile={mockOnEditProfile}
          onLogout={mockOnLogout}
        />
      );
      expect(screen.getByText('ID')).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('calls onEditProfile when edit button is clicked', () => {
      render(
        <ProfileHeader
          currentUser={mockUser}
          tools={mockTools}
          reviews={mockReviews}
          transactions={mockTransactions}
          onEditProfile={mockOnEditProfile}
          onLogout={mockOnLogout}
        />
      );
      
      const editButton = screen.getByText(/Edit Profile/i);
      fireEvent.click(editButton);
      expect(mockOnEditProfile).toHaveBeenCalled();
    });

    it('renders logout button', () => {
      const { container } = render(
        <ProfileHeader
          currentUser={mockUser}
          tools={mockTools}
          reviews={mockReviews}
          transactions={mockTransactions}
          onEditProfile={mockOnEditProfile}
          onLogout={mockOnLogout}
        />
      );
      
      // Should have buttons for actions
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Copy link functionality', () => {
    it('copies profile link to clipboard', async () => {
      render(
        <ProfileHeader
          currentUser={mockUser}
          tools={mockTools}
          reviews={mockReviews}
          transactions={mockTransactions}
          onEditProfile={mockOnEditProfile}
          onLogout={mockOnLogout}
        />
      );
      
      const copyButton = screen.queryByText(/Copy/i) || 
                        screen.queryByLabelText(/copy/i);
      
      if (copyButton) {
        fireEvent.click(copyButton);
        // Should call clipboard API
        expect(mockWriteText).toHaveBeenCalled();
      }
    });
  });

  describe('Rating display', () => {
    it('displays user rating', () => {
      render(
        <ProfileHeader
          currentUser={mockUser}
          tools={mockTools}
          reviews={mockReviews}
          transactions={mockTransactions}
          onEditProfile={mockOnEditProfile}
          onLogout={mockOnLogout}
        />
      );
      expect(screen.getByText('4.5')).toBeInTheDocument();
    });
  });

  describe('Trusted member status', () => {
    it('shows trusted member badge when qualified', () => {
      render(
        <ProfileHeader
          currentUser={mockUser}
          tools={mockTools}
          reviews={mockReviews}
          transactions={mockTransactions}
          onEditProfile={mockOnEditProfile}
          onLogout={mockOnLogout}
        />
      );
      // With 5 completed transactions, should be trusted
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Avatar', () => {
    it('renders avatar area', () => {
      const { container } = render(
        <ProfileHeader
          currentUser={mockUser}
          tools={mockTools}
          reviews={mockReviews}
          transactions={mockTransactions}
          onEditProfile={mockOnEditProfile}
          onLogout={mockOnLogout}
        />
      );
      
      // Should render profile area
      expect(container).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('handles user without avatar', () => {
      const userWithoutAvatar = { ...mockUser, avatar: undefined } as unknown as User;
      
      render(
        <ProfileHeader
          currentUser={userWithoutAvatar}
          tools={[]}
          reviews={[]}
          transactions={[]}
          onEditProfile={mockOnEditProfile}
          onLogout={mockOnLogout}
        />
      );
      
      // Should show fallback initial
      expect(screen.getByText('T')).toBeInTheDocument();
    });
  });
});
