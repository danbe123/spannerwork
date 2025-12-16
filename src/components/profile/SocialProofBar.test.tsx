import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SocialProofBar from './SocialProofBar';
import type { User, Transaction } from '@/types';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className} {...props}>{children}</div>
    ),
  },
}));

describe('SocialProofBar', () => {
  const createMockUser = (overrides?: Partial<User>): User => ({
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    createdDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year ago
    role: 'USER',
    accountStatus: 'ACTIVE',
    rating: 4.5,
    totalTransactions: 10,
    totalReviews: 5,
    emailVerified: true,
    ...overrides,
  } as User);

  const createMockTransaction = (overrides?: Partial<Transaction>): Transaction => ({
    id: 'txn-' + Math.random().toString(36).slice(2),
    userId: 'user-456',
    status: 'COMPLETED',
    createdDate: new Date().toISOString(),
    ...overrides,
  } as Transaction);

  it('renders trust and performance header', () => {
    render(<SocialProofBar user={createMockUser()} transactions={[]} />);
    
    expect(screen.getByText('Trust & Performance')).toBeInTheDocument();
  });

  it('shows member tenure for new members', () => {
    const user = createMockUser({
      createdDate: new Date().toISOString(), // Created today
    });

    render(<SocialProofBar user={user} transactions={[]} />);
    
    expect(screen.getByText('New member')).toBeInTheDocument();
  });

  it('shows months for members less than a year', () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const user = createMockUser({
      createdDate: sixMonthsAgo.toISOString(),
    });

    render(<SocialProofBar user={user} transactions={[]} />);
    
    expect(screen.getByText('6 months')).toBeInTheDocument();
  });

  it('shows years for members more than a year', () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const user = createMockUser({
      createdDate: twoYearsAgo.toISOString(),
    });

    render(<SocialProofBar user={user} transactions={[]} />);
    
    expect(screen.getByText('2+ years')).toBeInTheDocument();
  });

  it('shows completion rate when there are completed transactions', () => {
    const transactions = [
      createMockTransaction({ status: 'COMPLETED' }),
      createMockTransaction({ status: 'COMPLETED' }),
      createMockTransaction({ status: 'CANCELLED' }),
    ];

    render(<SocialProofBar user={createMockUser()} transactions={transactions} />);
    
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getByText('Success rate')).toBeInTheDocument();
  });

  it('does not show completion rate when no completed transactions', () => {
    const transactions = [
      createMockTransaction({ status: 'PENDING' }),
    ];

    render(<SocialProofBar user={createMockUser()} transactions={transactions} />);
    
    expect(screen.queryByText('Success rate')).not.toBeInTheDocument();
  });

  it('shows repeat customers when applicable', () => {
    const transactions = [
      createMockTransaction({ userId: 'customer-1', status: 'COMPLETED' }),
      createMockTransaction({ userId: 'customer-1', status: 'COMPLETED' }), // Repeat
      createMockTransaction({ userId: 'customer-2', status: 'COMPLETED' }),
    ];

    render(<SocialProofBar user={createMockUser()} transactions={transactions} />);
    
    expect(screen.getByText('Customers who came back')).toBeInTheDocument();
  });

  it('shows completed count when 5 or more completions', () => {
    const transactions = Array.from({ length: 5 }, () =>
      createMockTransaction({ status: 'COMPLETED' })
    );

    render(<SocialProofBar user={createMockUser()} transactions={transactions} />);
    
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Successful transactions')).toBeInTheDocument();
  });

  it('does not show completed count when less than 5 completions', () => {
    const transactions = Array.from({ length: 4 }, () =>
      createMockTransaction({ status: 'COMPLETED' })
    );

    render(<SocialProofBar user={createMockUser()} transactions={transactions} />);
    
    expect(screen.queryByText('Successful transactions')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <SocialProofBar 
        user={createMockUser()} 
        transactions={[]} 
        className="custom-class"
      />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('handles undefined transactions', () => {
    render(<SocialProofBar user={createMockUser()} transactions={undefined as unknown as Transaction[]} />);
    
    expect(screen.getByText('Trust & Performance')).toBeInTheDocument();
  });

  it('shows singular year for 1+ year members', () => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const user = createMockUser({
      createdDate: oneYearAgo.toISOString(),
    });

    render(<SocialProofBar user={user} transactions={[]} />);
    
    expect(screen.getByText('1+ year')).toBeInTheDocument();
  });

  it('shows singular month for 1 month member', () => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const user = createMockUser({
      createdDate: oneMonthAgo.toISOString(),
    });

    render(<SocialProofBar user={user} transactions={[]} />);
    
    expect(screen.getByText('1 month')).toBeInTheDocument();
  });
});
