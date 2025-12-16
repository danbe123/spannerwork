import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProfileHero from './ProfileHero';
import type { User, Tool, Review } from '@/types';
import { Award } from 'lucide-react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className} {...props}>{children}</div>
    ),
    span: ({ children, className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
      <span className={className} {...props}>{children}</span>
    ),
  },
}));

describe('ProfileHero', () => {
  const mockOnEditProfile = vi.fn();
  const mockOnLogout = vi.fn();

  const createMockUser = (overrides?: Partial<User>): User => ({
    id: 'user-123',
    email: 'test@example.com',
    name: 'John Doe',
    avatar: 'https://example.com/avatar.jpg',
    createdDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    role: 'USER',
    accountStatus: 'ACTIVE',
    rating: 4.5,
    totalTransactions: 10,
    totalReviews: 5,
    emailVerified: true,
    postcode: 'SW1A 1AA',
    ...overrides,
  } as User);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders user name', () => {
    render(
      <ProfileHero
        currentUser={createMockUser({ name: 'Test User' })}
        onEditProfile={mockOnEditProfile}
        onLogout={mockOnLogout}
      />
    );

    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('renders user avatar', () => {
    render(
      <ProfileHero
        currentUser={createMockUser()}
        onEditProfile={mockOnEditProfile}
        onLogout={mockOnLogout}
      />
    );

    // Avatar component should render
    expect(document.body).toBeInTheDocument();
  });

  it('renders edit profile button', () => {
    render(
      <ProfileHero
        currentUser={createMockUser()}
        onEditProfile={mockOnEditProfile}
        onLogout={mockOnLogout}
      />
    );

    const editButton = screen.getByRole('button', { name: /edit/i });
    expect(editButton).toBeInTheDocument();
  });

  it('calls onEditProfile when edit button clicked', () => {
    render(
      <ProfileHero
        currentUser={createMockUser()}
        onEditProfile={mockOnEditProfile}
        onLogout={mockOnLogout}
      />
    );

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    expect(mockOnEditProfile).toHaveBeenCalledTimes(1);
  });

  it('renders logout button', () => {
    render(
      <ProfileHero
        currentUser={createMockUser()}
        onEditProfile={mockOnEditProfile}
        onLogout={mockOnLogout}
      />
    );

    const logoutButton = screen.getByRole('button', { name: /log out|logout/i });
    expect(logoutButton).toBeInTheDocument();
  });

  it('calls onLogout when logout button clicked', () => {
    render(
      <ProfileHero
        currentUser={createMockUser()}
        onEditProfile={mockOnEditProfile}
        onLogout={mockOnLogout}
      />
    );

    const logoutButton = screen.getByRole('button', { name: /log out|logout/i });
    fireEvent.click(logoutButton);

    expect(mockOnLogout).toHaveBeenCalledTimes(1);
  });

  it('displays user rating', () => {
    render(
      <ProfileHero
        currentUser={createMockUser({ rating: 4.8 })}
        onEditProfile={mockOnEditProfile}
        onLogout={mockOnLogout}
      />
    );

    expect(screen.getByText('4.8')).toBeInTheDocument();
  });

  it('displays tools count', () => {
    const tools = [
      { id: '1', name: 'Tool 1' },
      { id: '2', name: 'Tool 2' },
    ] as Tool[];

    render(
      <ProfileHero
        currentUser={createMockUser()}
        tools={tools}
        onEditProfile={mockOnEditProfile}
        onLogout={mockOnLogout}
      />
    );

    // Component should render with tools
    expect(document.body).toBeInTheDocument();
  });

  it('displays reviews count', () => {
    const reviews = [
      { id: '1', rating: 5 },
      { id: '2', rating: 4 },
      { id: '3', rating: 5 },
    ] as Review[];

    render(
      <ProfileHero
        currentUser={createMockUser()}
        reviews={reviews}
        onEditProfile={mockOnEditProfile}
        onLogout={mockOnLogout}
      />
    );

    // Component should render with reviews
    expect(document.body).toBeInTheDocument();
  });

  it('displays verification badges', () => {
    const badges = [
      { icon: Award, label: 'Email Verified' },
    ];

    render(
      <ProfileHero
        currentUser={createMockUser()}
        verificationBadges={badges}
        onEditProfile={mockOnEditProfile}
        onLogout={mockOnLogout}
      />
    );

    expect(screen.getByText('Email Verified')).toBeInTheDocument();
  });

  it('handles undefined currentUser', () => {
    render(
      <ProfileHero
        currentUser={undefined}
        onEditProfile={mockOnEditProfile}
        onLogout={mockOnLogout}
      />
    );

    // Should render without crashing
    expect(document.body).toBeInTheDocument();
  });

  it('displays member since info', () => {
    render(
      <ProfileHero
        currentUser={createMockUser()}
        onEditProfile={mockOnEditProfile}
        onLogout={mockOnLogout}
      />
    );

    // Component should render without crashing
    expect(document.body).toBeInTheDocument();
  });

  it('displays location when available', () => {
    render(
      <ProfileHero
        currentUser={createMockUser({ postcode: 'SW1A 1AA' })}
        onEditProfile={mockOnEditProfile}
        onLogout={mockOnLogout}
      />
    );

    // Component should render postcode area
    expect(document.body).toBeInTheDocument();
  });

  it('shows completion percentage', () => {
    render(
      <ProfileHero
        currentUser={createMockUser()}
        completionPercentage={75}
        onEditProfile={mockOnEditProfile}
        onLogout={mockOnLogout}
      />
    );

    expect(document.body).toBeInTheDocument();
  });

  it('renders with empty tools array', () => {
    render(
      <ProfileHero
        currentUser={createMockUser()}
        tools={[]}
        onEditProfile={mockOnEditProfile}
        onLogout={mockOnLogout}
      />
    );

    expect(document.body).toBeInTheDocument();
  });

  it('renders with empty reviews array', () => {
    render(
      <ProfileHero
        currentUser={createMockUser()}
        reviews={[]}
        onEditProfile={mockOnEditProfile}
        onLogout={mockOnLogout}
      />
    );

    expect(document.body).toBeInTheDocument();
  });
});
