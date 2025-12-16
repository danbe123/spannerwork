import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ActivityTimeline from './ActivityTimeline';
import type { Tool, Space, Transaction, Review } from '@/types';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: React.PropsWithChildren<{ className?: string }>) => (
      <div className={className} {...props}>{children}</div>
    ),
  },
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      {ui}
    </MemoryRouter>
  );
}

const mockTools: Tool[] = [];
const mockSpaces: Space[] = [];
const mockTransactions: Transaction[] = [];
const mockReviews: Review[] = [];

// Create valid dates
const now = new Date();
const validDateString = now.toISOString();

const mockCompletedTransaction = {
  id: 'tx-1',
  status: 'COMPLETED',
  rentalFee: 5000,
  createdDate: validDateString,
  updatedDate: validDateString,
} as unknown as Transaction;

const mockTool = {
  id: 'tool-1',
  name: 'Power Drill',
  createdDate: validDateString,
  updatedDate: validDateString,
  photos: ['https://example.com/drill.jpg'],
} as unknown as Tool;

const mockReview = {
  id: 'rev-1',
  rating: 5,
  comment: 'Great service!',
  createdDate: validDateString,
} as unknown as Review;

describe('ActivityTimeline Component', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      const { container } = renderWithRouter(
        <ActivityTimeline 
          tools={mockTools} 
          spaces={mockSpaces} 
          transactions={mockTransactions} 
          reviews={mockReviews} 
        />
      );
      expect(container).toBeInTheDocument();
    });

    it('renders component structure', () => {
      const { container } = renderWithRouter(
        <ActivityTimeline 
          tools={mockTools} 
          spaces={mockSpaces} 
          transactions={mockTransactions} 
          reviews={mockReviews} 
        />
      );
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('With activity data', () => {
    it('handles transactions', () => {
      const { container } = renderWithRouter(
        <ActivityTimeline 
          tools={mockTools} 
          spaces={mockSpaces} 
          transactions={[mockCompletedTransaction]} 
          reviews={mockReviews} 
        />
      );
      expect(container).toBeInTheDocument();
    });

    it('handles tools', () => {
      const { container } = renderWithRouter(
        <ActivityTimeline 
          tools={[mockTool]} 
          spaces={mockSpaces} 
          transactions={mockTransactions} 
          reviews={mockReviews} 
        />
      );
      expect(container).toBeInTheDocument();
    });

    it('handles reviews', () => {
      const { container } = renderWithRouter(
        <ActivityTimeline 
          tools={mockTools} 
          spaces={mockSpaces} 
          transactions={mockTransactions} 
          reviews={[mockReview]} 
        />
      );
      expect(container).toBeInTheDocument();
    });
  });

  describe('Props', () => {
    it('accepts limit prop', () => {
      const { container } = renderWithRouter(
        <ActivityTimeline 
          tools={mockTools} 
          spaces={mockSpaces} 
          transactions={mockTransactions} 
          reviews={mockReviews}
          limit={5}
        />
      );
      expect(container).toBeInTheDocument();
    });

    it('accepts badges prop', () => {
      const { container } = renderWithRouter(
        <ActivityTimeline 
          tools={mockTools} 
          spaces={mockSpaces} 
          transactions={mockTransactions} 
          reviews={mockReviews}
          badges={[{ type: 'first_listing', earnedAt: new Date().toISOString() }]}
        />
      );
      expect(container).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('handles empty activities', () => {
      const { container } = renderWithRouter(
        <ActivityTimeline 
          tools={[]} 
          spaces={[]} 
          transactions={[]} 
          reviews={[]} 
        />
      );
      expect(container).toBeInTheDocument();
    });
  });
});
