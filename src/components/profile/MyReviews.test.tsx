import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyReviews from './MyReviews';
import type { Review } from '@/types';

describe('MyReviews', () => {
  const createMockReview = (overrides?: Partial<Review>): Review => ({
    id: 'review-' + Math.random().toString(36).slice(2),
    rating: 5,
    comment: 'Great service!',
    createdDate: new Date().toISOString(),
    reviewer: {
      id: 'reviewer-1',
      name: 'John Doe',
    },
    ...overrides,
  } as Review);

  it('renders empty state when no reviews', () => {
    render(<MyReviews reviews={[]} />);
    
    expect(screen.getByText(/No reviews yet/)).toBeInTheDocument();
  });

  it('renders reviews list', () => {
    const reviews = [
      createMockReview({ comment: 'Excellent!' }),
      createMockReview({ comment: 'Very good!' }),
    ];

    render(<MyReviews reviews={reviews} />);
    
    expect(screen.getByText('Excellent!')).toBeInTheDocument();
    expect(screen.getByText('Very good!')).toBeInTheDocument();
  });

  it('displays reviewer name', () => {
    const reviews = [
      createMockReview({ 
        reviewer: { id: 'user-1', name: 'Alice Smith' } as any 
      }),
    ];

    render(<MyReviews reviews={reviews} />);
    
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  it('displays Anonymous for missing reviewer name', () => {
    const reviews = [
      createMockReview({ 
        reviewer: { id: 'user-1', name: undefined as unknown as string } as any 
      }),
    ];

    render(<MyReviews reviews={reviews} />);
    
    expect(screen.getByText('Anonymous')).toBeInTheDocument();
  });

  it('renders star rating correctly', () => {
    const reviews = [
      createMockReview({ rating: 4 }),
    ];

    const { container } = render(<MyReviews reviews={reviews} />);
    
    // Check that 5 stars are rendered (4 filled, 1 empty)
    const stars = container.querySelectorAll('.lucide-star');
    expect(stars.length).toBe(5);
  });

  it('displays review comment', () => {
    const reviews = [
      createMockReview({ comment: 'This was an amazing experience!' }),
    ];

    render(<MyReviews reviews={reviews} />);
    
    expect(screen.getByText('This was an amazing experience!')).toBeInTheDocument();
  });

  it('handles reviews without comments', () => {
    const reviews = [
      createMockReview({ comment: undefined as unknown as string }),
    ];

    render(<MyReviews reviews={reviews} />);
    
    // Should still render without crashing
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('displays relative time for review', () => {
    const reviews = [
      createMockReview({ 
        createdDate: new Date().toISOString() 
      }),
    ];

    render(<MyReviews reviews={reviews} />);
    
    // Should show something like "less than a minute ago"
    expect(screen.getByText(/ago/)).toBeInTheDocument();
  });

  it('renders reviewer initial in avatar', () => {
    const reviews = [
      createMockReview({ 
        reviewer: { id: 'user-1', name: 'Bob' } as any 
      }),
    ];

    render(<MyReviews reviews={reviews} />);
    
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('renders multiple reviews', () => {
    const reviews = [
      createMockReview({ reviewer: { id: '1', name: 'User One' } as any }),
      createMockReview({ reviewer: { id: '2', name: 'User Two' } as any }),
      createMockReview({ reviewer: { id: '3', name: 'User Three' } as any }),
    ];

    render(<MyReviews reviews={reviews} />);
    
    expect(screen.getByText('User One')).toBeInTheDocument();
    expect(screen.getByText('User Two')).toBeInTheDocument();
    expect(screen.getByText('User Three')).toBeInTheDocument();
  });
});
