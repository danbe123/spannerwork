import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MyStats from './MyStats';
import type { User, Transaction, Review } from '@/types';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, onClick, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className} onClick={onClick} {...props}>{children}</div>
    ),
    p: ({ children, className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
      <p className={className} {...props}>{children}</p>
    ),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('MyStats', () => {
  const createMockUser = (overrides?: Partial<User>): User => ({
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    createdDate: new Date().toISOString(),
    role: 'USER',
    accountStatus: 'ACTIVE',
    rating: 4.5,
    totalTransactions: 10,
    totalReviews: 5,
    emailVerified: true,
    phoneVerified: true,
    insuranceVerified: true,
    ...overrides,
  } as User);

  const createMockTransaction = (overrides?: Partial<Transaction>): Transaction => ({
    id: 'txn-' + Math.random().toString(36).slice(2),
    userId: 'user-456',
    providerId: 'user-123',
    status: 'COMPLETED',
    createdDate: new Date().toISOString(),
    totalAmount: 50,
    rentalFee: 45,
    ...overrides,
  } as Transaction);

  const createMockReview = (overrides?: Partial<Review>): Review => ({
    id: 'review-' + Math.random().toString(36).slice(2),
    rating: 5,
    comment: 'Great!',
    createdDate: new Date().toISOString(),
    transactionId: 'txn-123',
    reviewerId: 'user-456',
    ...overrides,
  } as Review);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  it('renders stats cards', () => {
    renderWithRouter(
      <MyStats 
        currentUser={createMockUser()} 
        transactions={[]} 
        reviews={[]} 
      />
    );
    
    expect(screen.getByText('Total Earnings')).toBeInTheDocument();
    expect(screen.getByText('Active Transactions')).toBeInTheDocument();
    expect(screen.getByText('Average Rating')).toBeInTheDocument();
    expect(screen.getByText('Reputation Score')).toBeInTheDocument();
  });

  it('displays earnings from completed transactions', () => {
    const transactions = [
      createMockTransaction({ status: 'COMPLETED', rentalFee: 100 }),
      createMockTransaction({ status: 'COMPLETED', rentalFee: 50 }),
    ];

    renderWithRouter(
      <MyStats 
        currentUser={createMockUser()} 
        transactions={transactions} 
        reviews={[]} 
      />
    );
    
    expect(screen.getByText('£150')).toBeInTheDocument();
  });

  it('displays rating', () => {
    renderWithRouter(
      <MyStats 
        currentUser={createMockUser({ rating: 4.8 })} 
        transactions={[]} 
        reviews={[createMockReview()]} 
      />
    );
    
    expect(screen.getByText('4.8')).toBeInTheDocument();
  });

  it('renders quick action buttons', () => {
    renderWithRouter(
      <MyStats 
        currentUser={createMockUser()} 
        transactions={[]} 
        reviews={[]} 
      />
    );
    
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Referrals')).toBeInTheDocument();
    expect(screen.getByText('Saved Searches')).toBeInTheDocument();
  });

  it('navigates to Analytics when clicked', () => {
    renderWithRouter(
      <MyStats 
        currentUser={createMockUser()} 
        transactions={[]} 
        reviews={[]} 
      />
    );
    
    fireEvent.click(screen.getByText('Analytics'));
    expect(mockNavigate).toHaveBeenCalledWith('/Analytics');
  });

  it('navigates to Referrals when clicked', () => {
    renderWithRouter(
      <MyStats 
        currentUser={createMockUser()} 
        transactions={[]} 
        reviews={[]} 
      />
    );
    
    fireEvent.click(screen.getByText('Referrals'));
    expect(mockNavigate).toHaveBeenCalledWith('/Referrals');
  });

  it('shows Admin button for admin users', () => {
    renderWithRouter(
      <MyStats 
        currentUser={createMockUser({ role: 'ADMIN' })} 
        transactions={[]} 
        reviews={[]} 
      />
    );
    
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('hides Admin button for non-admin users', () => {
    renderWithRouter(
      <MyStats 
        currentUser={createMockUser({ role: 'USER' })} 
        transactions={[]} 
        reviews={[]} 
      />
    );
    
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('shows verification prompt for unverified email', () => {
    renderWithRouter(
      <MyStats 
        currentUser={createMockUser({ emailVerified: false })} 
        transactions={[]} 
        reviews={[]} 
      />
    );
    
    expect(screen.getByText('Complete Your Verification')).toBeInTheDocument();
    expect(screen.getByText('Verify Now')).toBeInTheDocument();
  });

  it('does not show verification prompt when all verified', () => {
    renderWithRouter(
      <MyStats 
        currentUser={createMockUser()} 
        transactions={[]} 
        reviews={[]} 
      />
    );
    
    expect(screen.queryByText('Complete Your Verification')).not.toBeInTheDocument();
  });

  it('handles undefined currentUser', () => {
    renderWithRouter(
      <MyStats 
        currentUser={undefined} 
        transactions={[]} 
        reviews={[]} 
      />
    );
    
    expect(screen.getByText('£0')).toBeInTheDocument();
    expect(screen.getByText('0.0')).toBeInTheDocument();
  });

  it('counts active transactions correctly', () => {
    const user = createMockUser();
    const transactions = [
      createMockTransaction({ status: 'PENDING', userId: user.id }),
      createMockTransaction({ status: 'CONFIRMED', providerId: user.id }),
      createMockTransaction({ status: 'COMPLETED', providerId: user.id }),
    ];

    renderWithRouter(
      <MyStats 
        currentUser={user} 
        transactions={transactions} 
        reviews={[]} 
      />
    );
    
    expect(screen.getByText('2')).toBeInTheDocument(); // Active Transactions
  });
});
