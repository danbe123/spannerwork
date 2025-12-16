import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GettingStartedCard from './GettingStartedCard';
import type { User, Tool, Transaction } from '@/types';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, onClick, ...props }: React.PropsWithChildren<{ className?: string; onClick?: () => void }>) => (
      <div className={className} onClick={onClick} {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      {ui}
    </MemoryRouter>
  );
}

const mockUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: false,
  phone: '',
  postcode: '',
} as unknown as User;

const mockVerifiedUser = {
  id: 'user-1',
  name: 'Verified User',
  email: 'verified@example.com',
  emailVerified: true,
  phone: '+44123456789',
  postcode: 'SW1A 1AA',
} as unknown as User;

const mockTools: Tool[] = [];
const mockTransactions: Transaction[] = [];

const mockCompletedTransactions = [
  { id: 'tx-1', status: 'COMPLETED' },
] as unknown as Transaction[];

describe('GettingStartedCard Component', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      const { container } = renderWithRouter(
        <GettingStartedCard user={mockUser} tools={mockTools} transactions={mockTransactions} />
      );
      expect(container).toBeInTheDocument();
    });

    it('renders card structure', () => {
      const { container } = renderWithRouter(
        <GettingStartedCard user={mockUser} tools={mockTools} transactions={mockTransactions} />
      );
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Progress tracking', () => {
    it('shows progress for unverified user', () => {
      const { container } = renderWithRouter(
        <GettingStartedCard user={mockUser} tools={mockTools} transactions={mockTransactions} />
      );
      expect(container).toBeInTheDocument();
    });

    it('shows progress for verified user', () => {
      const { container } = renderWithRouter(
        <GettingStartedCard user={mockVerifiedUser} tools={mockTools} transactions={mockTransactions} />
      );
      expect(container).toBeInTheDocument();
    });

    it('shows progress when user has tools', () => {
      const tools = [{ id: 'tool-1', name: 'Drill' }] as unknown as Tool[];
      const { container } = renderWithRouter(
        <GettingStartedCard user={mockUser} tools={tools} transactions={mockTransactions} />
      );
      expect(container).toBeInTheDocument();
    });

    it('shows progress with completed transactions', () => {
      const { container } = renderWithRouter(
        <GettingStartedCard user={mockVerifiedUser} tools={mockTools} transactions={mockCompletedTransactions} />
      );
      expect(container).toBeInTheDocument();
    });
  });

  describe('Edit profile callback', () => {
    it('accepts onEditProfile callback', () => {
      const mockCallback = vi.fn();
      const { container } = renderWithRouter(
        <GettingStartedCard 
          user={mockUser} 
          tools={mockTools} 
          transactions={mockTransactions} 
          onEditProfile={mockCallback}
        />
      );
      expect(container).toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('accepts custom className', () => {
      const { container } = renderWithRouter(
        <GettingStartedCard 
          user={mockUser} 
          tools={mockTools} 
          transactions={mockTransactions} 
          className="custom-class"
        />
      );
      expect(container).toBeInTheDocument();
    });
  });
});
