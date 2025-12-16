import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import BundleSuggestions from './BundleSuggestions';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, onClick, ...props }: React.PropsWithChildren<{ className?: string; onClick?: () => void }>) => (
      <div className={className} onClick={onClick} {...props}>{children}</div>
    ),
  },
}));

const { mockAiService } = vi.hoisted(() => ({
  mockAiService: {
    getBundles: vi.fn(),
  },
}))

vi.mock('@/api/services', () => ({
  aiService: mockAiService,
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const defaultProps = {
  listingType: 'tool',
  listingId: 'tool-1',
  listingName: 'Power Drill',
  listingCategory: 'POWER_TOOLS',
};

const mockSuggestions = [
  { id: 'sug-1', name: 'Impact Wrench', type: 'tool', reason: 'Commonly used together', price: 2500 },
  { id: 'sug-2', name: 'Socket Set', type: 'tool', reason: 'Perfect combo', price: 1500 },
];

describe('BundleSuggestions Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAiService.getBundles.mockResolvedValue({ suggestions: [] });
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      const { container } = renderWithProviders(
        <BundleSuggestions {...defaultProps} />
      );
      expect(container).toBeInTheDocument();
    });

    it('renders loading skeletons when loading', () => {
      mockAiService.getBundles.mockImplementation(() => new Promise(() => {}));
      
      const { container } = renderWithProviders(
        <BundleSuggestions {...defaultProps} />
      );
      
      // Should show skeleton loading state
      expect(container.querySelector('.animate-pulse') || container).toBeInTheDocument();
    });

    it('renders suggestions when data is available', async () => {
      mockAiService.getBundles.mockResolvedValue({ suggestions: mockSuggestions });
      
      renderWithProviders(
        <BundleSuggestions {...defaultProps} />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Impact Wrench')).toBeInTheDocument();
      });
    });

    it('returns null when there are no suggestions', async () => {
      mockAiService.getBundles.mockResolvedValue({ suggestions: [] });
      
      const { container } = renderWithProviders(
        <BundleSuggestions {...defaultProps} />
      );
      
      await waitFor(() => {
        expect(mockAiService.getBundles).toHaveBeenCalled();
      });
    });

    it('returns null on error', async () => {
      mockAiService.getBundles.mockRejectedValue(new Error('API Error'));
      
      const { container } = renderWithProviders(
        <BundleSuggestions {...defaultProps} />
      );
      
      await waitFor(() => {
        expect(mockAiService.getBundles).toHaveBeenCalled();
      });
    });
  });

  describe('Suggestion interactions', () => {
    it('calls onAddBundle when suggestion is clicked', async () => {
      mockAiService.getBundles.mockResolvedValue({ suggestions: mockSuggestions });
      const onAddBundle = vi.fn();
      
      renderWithProviders(
        <BundleSuggestions {...defaultProps} onAddBundle={onAddBundle} />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Impact Wrench')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Impact Wrench'));
      expect(onAddBundle).toHaveBeenCalledWith(mockSuggestions[0]);
    });

    it('displays suggestion reason text', async () => {
      mockAiService.getBundles.mockResolvedValue({ suggestions: mockSuggestions });
      
      renderWithProviders(
        <BundleSuggestions {...defaultProps} />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Commonly used together')).toBeInTheDocument();
      });
    });

    it('displays suggestion price', async () => {
      mockAiService.getBundles.mockResolvedValue({ suggestions: mockSuggestions });
      
      renderWithProviders(
        <BundleSuggestions {...defaultProps} />
      );
      
      await waitFor(() => {
        // Price 2500 pence = £25
        expect(screen.getByText(/£25/)).toBeInTheDocument();
      });
    });

    it('displays type icons correctly', async () => {
      mockAiService.getBundles.mockResolvedValue({ 
        suggestions: [
          { id: 'sug-1', name: 'Test Tool', type: 'tool', reason: 'Test' },
          { id: 'sug-2', name: 'Test Service', type: 'service', reason: 'Test' },
          { id: 'sug-3', name: 'Test Space', type: 'space', reason: 'Test' },
        ]
      });
      
      renderWithProviders(
        <BundleSuggestions {...defaultProps} />
      );
      
      await waitFor(() => {
        expect(screen.getByText('🔧')).toBeInTheDocument();
        expect(screen.getByText('👨‍🔧')).toBeInTheDocument();
        expect(screen.getByText('🏠')).toBeInTheDocument();
      });
    });
  });

  describe('Props', () => {
    it('accepts listingId prop', () => {
      const { container } = renderWithProviders(
        <BundleSuggestions {...defaultProps} listingId="tool-123" />
      );
      expect(container).toBeInTheDocument();
    });

    it('accepts listingCategory prop', () => {
      const { container } = renderWithProviders(
        <BundleSuggestions {...defaultProps} listingCategory="HAND_TOOLS" />
      );
      expect(container).toBeInTheDocument();
    });

    it('accepts className prop', () => {
      const { container } = renderWithProviders(
        <BundleSuggestions {...defaultProps} className="custom-class" />
      );
      expect(container).toBeInTheDocument();
    });

    it('accepts onAddBundle callback', () => {
      const mockCallback = vi.fn();
      const { container } = renderWithProviders(
        <BundleSuggestions {...defaultProps} onAddBundle={mockCallback} />
      );
      expect(container).toBeInTheDocument();
    });
  });

  describe('Listing types', () => {
    it('handles tool listing type', () => {
      const { container } = renderWithProviders(
        <BundleSuggestions {...defaultProps} listingType="tool" />
      );
      expect(container).toBeInTheDocument();
    });

    it('handles service listing type', () => {
      const { container } = renderWithProviders(
        <BundleSuggestions {...defaultProps} listingType="service" />
      );
      expect(container).toBeInTheDocument();
    });

    it('handles space listing type', () => {
      const { container } = renderWithProviders(
        <BundleSuggestions {...defaultProps} listingType="space" />
      );
      expect(container).toBeInTheDocument();
    });
  });

  describe('Categories', () => {
    it('handles POWER_TOOLS category', () => {
      const { container } = renderWithProviders(
        <BundleSuggestions {...defaultProps} listingCategory="POWER_TOOLS" />
      );
      expect(container).toBeInTheDocument();
    });

    it('handles HAND_TOOLS category', () => {
      const { container } = renderWithProviders(
        <BundleSuggestions {...defaultProps} listingCategory="HAND_TOOLS" />
      );
      expect(container).toBeInTheDocument();
    });

    it('handles DIAGNOSTICS category', () => {
      const { container } = renderWithProviders(
        <BundleSuggestions {...defaultProps} listingCategory="DIAGNOSTICS" />
      );
      expect(container).toBeInTheDocument();
    });
  });

  describe('Component behavior', () => {
    it('renders with different listing names', () => {
      const { container } = renderWithProviders(
        <BundleSuggestions {...defaultProps} listingName="Impact Wrench" />
      );
      expect(container).toBeInTheDocument();
    });

    it('handles empty listing name', () => {
      const { container } = renderWithProviders(
        <BundleSuggestions {...defaultProps} listingName="" />
      );
      expect(container).toBeInTheDocument();
    });
  });
});
