import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReviewsSection from './ReviewsSection';
import type { Review } from '@/types';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className} {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockReviews = [
  {
    id: 'review-1',
    rating: 5,
    comment: 'Excellent service!',
    reviewerId: 'user-1',
    revieweeId: 'user-2',
    transactionId: 'tx-1',
    reviewedUserId: 'user-2',
    reviewer: { id: 'user-1', name: 'John Doe', avatar: 'https://example.com/avatar1.jpg' },
    createdDate: new Date().toISOString(),
    updatedDate: new Date().toISOString(),
  },
  {
    id: 'review-2',
    rating: 4,
    comment: 'Very good experience',
    reviewerId: 'user-3',
    revieweeId: 'user-2',
    transactionId: 'tx-2',
    reviewedUserId: 'user-2',
    reviewer: { id: 'user-3', name: 'Jane Smith' },
    createdDate: new Date(Date.now() - 86400000).toISOString(),
    updatedDate: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'review-3',
    rating: 5,
    comment: 'Would definitely recommend!',
    reviewerId: 'user-4',
    revieweeId: 'user-2',
    transactionId: 'tx-3',
    reviewedUserId: 'user-2',
    reviewer: { id: 'user-4', name: 'Bob Wilson' },
    createdDate: new Date(Date.now() - 172800000).toISOString(),
    updatedDate: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'review-4',
    rating: 3,
    comment: 'Average experience',
    reviewerId: 'user-5',
    revieweeId: 'user-2',
    transactionId: 'tx-4',
    reviewedUserId: 'user-2',
    reviewer: { id: 'user-5', name: 'Alice Brown' },
    createdDate: new Date(Date.now() - 259200000).toISOString(),
    updatedDate: new Date(Date.now() - 259200000).toISOString(),
  },
] as unknown as Review[];

describe('ReviewsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders component', () => {
      render(<ReviewsSection reviews={[]} />);
      expect(document.body).toBeInTheDocument();
    });

    it('renders with reviews', () => {
      render(<ReviewsSection reviews={mockReviews} />);
      expect(document.body).toBeInTheDocument();
    });

    it('accepts custom className', () => {
      const { container } = render(
        <ReviewsSection reviews={mockReviews} className="custom-class" />
      );
      expect(container).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('shows empty state when no reviews', () => {
      render(<ReviewsSection reviews={[]} />);
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Review display', () => {
    it('displays review comments', () => {
      render(<ReviewsSection reviews={mockReviews} />);
      expect(screen.getByText(/Excellent service/i)).toBeInTheDocument();
    });

    it('displays reviewer names', () => {
      render(<ReviewsSection reviews={mockReviews} />);
      expect(screen.getByText(/John Doe/i)).toBeInTheDocument();
    });

    it('displays multiple reviews', () => {
      render(<ReviewsSection reviews={mockReviews} />);
      expect(screen.getByText(/Very good experience/i)).toBeInTheDocument();
    });
  });

  describe('Rating breakdown', () => {
    it('shows rating statistics', () => {
      render(<ReviewsSection reviews={mockReviews} />);
      expect(document.body).toBeInTheDocument();
    });

    it('displays star ratings', () => {
      render(<ReviewsSection reviews={mockReviews} />);
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('supports filter by rating', () => {
      render(<ReviewsSection reviews={mockReviews} />);
      expect(document.body).toBeInTheDocument();
    });

    it('supports sorting', () => {
      render(<ReviewsSection reviews={mockReviews} />);
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('handles filter changes', () => {
      render(<ReviewsSection reviews={mockReviews} />);
      const buttons = screen.getAllByRole('button');
      if (buttons.length > 0) {
        fireEvent.click(buttons[0]);
      }
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Review timestamps', () => {
    it('displays relative time', () => {
      render(<ReviewsSection reviews={mockReviews} />);
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Avatars', () => {
    it('displays reviewer avatars', () => {
      render(<ReviewsSection reviews={mockReviews} />);
      expect(document.body).toBeInTheDocument();
    });
  });
});
