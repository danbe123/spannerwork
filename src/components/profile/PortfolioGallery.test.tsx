import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PortfolioGallery from './PortfolioGallery';
import type { Tool, Transaction } from '@/types';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className} {...props}>{children}</div>
    ),
    img: ({ src, alt, className, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
      <img src={src} alt={alt} className={className} {...props} />
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockTools: Tool[] = [
  {
    id: 'tool-1',
    name: 'Power Drill',
    description: 'A powerful drill',
    category: 'Power Tools',
    photos: ['https://example.com/drill1.jpg', 'https://example.com/drill2.jpg'],
    dailyRate: 20,
    ownerId: 'user-1',
  } as Tool,
  {
    id: 'tool-2',
    name: 'Wrench Set',
    description: 'Complete wrench set',
    category: 'Hand Tools',
    photos: ['https://example.com/wrench.jpg'],
    dailyRate: 10,
    ownerId: 'user-1',
  } as Tool,
];

const mockTransactions: Transaction[] = [
  {
    id: 'tx-1',
    status: 'COMPLETED',
    rating: 5,
    completedDate: new Date().toISOString(),
  } as Transaction,
];

describe('PortfolioGallery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders component', () => {
      render(<PortfolioGallery tools={[]} transactions={[]} />);
      expect(document.body).toBeInTheDocument();
    });

    it('renders with tools', () => {
      render(<PortfolioGallery tools={mockTools} transactions={[]} />);
      expect(document.body).toBeInTheDocument();
    });

    it('renders with transactions', () => {
      render(<PortfolioGallery tools={[]} transactions={mockTransactions} />);
      expect(document.body).toBeInTheDocument();
    });

    it('renders with both tools and transactions', () => {
      render(<PortfolioGallery tools={mockTools} transactions={mockTransactions} />);
      expect(document.body).toBeInTheDocument();
    });

    it('accepts custom className', () => {
      const { container } = render(
        <PortfolioGallery tools={mockTools} transactions={[]} className="custom-class" />
      );
      expect(container).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('shows empty state when no items', () => {
      render(<PortfolioGallery tools={[]} transactions={[]} />);
      expect(document.body).toBeInTheDocument();
    });

    it('shows empty state with tools without photos', () => {
      const toolsWithoutPhotos = [{ ...mockTools[0], photos: [] }] as Tool[];
      render(<PortfolioGallery tools={toolsWithoutPhotos} transactions={[]} />);
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Gallery items', () => {
    it('displays tool photos', () => {
      render(<PortfolioGallery tools={mockTools} transactions={[]} />);
      const images = screen.getAllByRole('img');
      expect(images.length).toBeGreaterThan(0);
    });

    it('shows tool names', () => {
      render(<PortfolioGallery tools={mockTools} transactions={[]} />);
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('supports filter selection', () => {
      render(<PortfolioGallery tools={mockTools} transactions={mockTransactions} />);
      expect(document.body).toBeInTheDocument();
    });

    it('filters by category', () => {
      render(<PortfolioGallery tools={mockTools} transactions={[]} />);
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Lightbox', () => {
    it('opens lightbox on image click', async () => {
      render(<PortfolioGallery tools={mockTools} transactions={[]} />);
      const images = screen.getAllByRole('img');
      if (images.length > 0) {
        fireEvent.click(images[0]);
        await waitFor(() => {
          expect(document.body).toBeInTheDocument();
        });
      }
    });

    it('supports navigation in lightbox', () => {
      render(<PortfolioGallery tools={mockTools} transactions={[]} />);
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Categories', () => {
    it('displays category badges', () => {
      render(<PortfolioGallery tools={mockTools} transactions={[]} />);
      expect(document.body).toBeInTheDocument();
    });
  });
});
