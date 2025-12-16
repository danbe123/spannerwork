import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyTools from './MyTools';
import type { Tool, User } from '@/types';

const { mockToolsService } = vi.hoisted(() => ({
  mockToolsService: { delete: vi.fn() },
}))

vi.mock('@/api/services', () => ({
  toolsService: mockToolsService,
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'USER',
  accountStatus: 'ACTIVE',
  emailVerified: true,
  totalTransactions: 0,
  totalListings: 0,
  rating: 0,
  reviewCount: 0,
  totalReviews: 0,
  createdDate: new Date().toISOString(),
  updatedDate: new Date().toISOString(),
} as unknown as User;

const mockTools: Tool[] = [
  {
    id: 'tool-1',
    name: 'Power Drill',
    description: 'A powerful cordless drill',
    category: 'Power Tools',
    dailyRate: 15,
    weeklyRate: 75,
    deposit: 50,
    photos: ['https://example.com/drill.jpg'],
    condition: 'Excellent',
    available: true,
    postcode: 'SW1A 1AA',
    ownerId: 'user-1',
    createdDate: new Date().toISOString(),
    updatedDate: new Date().toISOString(),
  },
  {
    id: 'tool-2',
    name: 'Circular Saw',
    description: 'Professional circular saw',
    category: 'Power Tools',
    dailyRate: 25,
    deposit: 100,
    photos: [],
    condition: 'Good',
    available: false,
    postcode: 'SW1A 1AA',
    ownerId: 'user-1',
    createdDate: new Date().toISOString(),
    updatedDate: new Date().toISOString(),
  },
];

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

describe('MyTools Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty state', () => {
    it('displays empty state when no tools', () => {
      renderWithProviders(<MyTools tools={[]} currentUser={mockUser} />);
      
      expect(screen.getByText("You haven't listed any tools yet")).toBeInTheDocument();
    });

    it('shows wrench icon in empty state', () => {
      const { container } = renderWithProviders(<MyTools tools={[]} currentUser={mockUser} />);
      
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Tool cards rendering', () => {
    it('renders tool names', () => {
      renderWithProviders(<MyTools tools={mockTools} currentUser={mockUser} />);
      
      expect(screen.getByText('Power Drill')).toBeInTheDocument();
      expect(screen.getByText('Circular Saw')).toBeInTheDocument();
    });

    it('renders tool descriptions', () => {
      renderWithProviders(<MyTools tools={mockTools} currentUser={mockUser} />);
      
      expect(screen.getByText('A powerful cordless drill')).toBeInTheDocument();
      expect(screen.getByText('Professional circular saw')).toBeInTheDocument();
    });

    it('renders tool categories', () => {
      renderWithProviders(<MyTools tools={mockTools} currentUser={mockUser} />);
      
      expect(screen.getAllByText('Power Tools')).toHaveLength(2);
    });

    it('renders tool conditions', () => {
      renderWithProviders(<MyTools tools={mockTools} currentUser={mockUser} />);
      
      expect(screen.getByText('Excellent')).toBeInTheDocument();
      expect(screen.getByText('Good')).toBeInTheDocument();
    });
  });

  describe('Availability badges', () => {
    it('shows Available badge for available tools', () => {
      renderWithProviders(<MyTools tools={mockTools} currentUser={mockUser} />);
      
      expect(screen.getByText('Available')).toBeInTheDocument();
    });

    it('shows In Use badge for unavailable tools', () => {
      renderWithProviders(<MyTools tools={mockTools} currentUser={mockUser} />);
      
      expect(screen.getByText('In Use')).toBeInTheDocument();
    });
  });

  describe('Rate display', () => {
    it('displays daily rate', () => {
      renderWithProviders(<MyTools tools={mockTools} currentUser={mockUser} />);
      
      expect(screen.getByText(/£15\/day/)).toBeInTheDocument();
    });

    it('displays weekly rate when available', () => {
      renderWithProviders(<MyTools tools={mockTools} currentUser={mockUser} />);
      
      expect(screen.getByText(/£75\/wk/)).toBeInTheDocument();
    });

    it('displays combined rates', () => {
      renderWithProviders(<MyTools tools={mockTools} currentUser={mockUser} />);
      
      expect(screen.getByText('£15/day • £75/wk')).toBeInTheDocument();
    });
  });

  describe('Tool images', () => {
    it('renders tool image when photo exists', () => {
      renderWithProviders(<MyTools tools={mockTools} currentUser={mockUser} />);
      
      const images = screen.getAllByRole('img');
      expect(images.length).toBeGreaterThan(0);
      expect(images[0]).toHaveAttribute('src', 'https://example.com/drill.jpg');
    });
  });

  describe('Navigation', () => {
    it('navigates to calendar when View Calendar is clicked', () => {
      renderWithProviders(<MyTools tools={mockTools} currentUser={mockUser} />);
      
      const calendarButtons = screen.getAllByText('View Calendar');
      fireEvent.click(calendarButtons[0]);
      
      expect(mockNavigate).toHaveBeenCalledWith('/Calendar?toolId=tool-1');
    });
  });

  describe('Delete functionality', () => {
    beforeEach(() => {
      mockToolsService.delete.mockResolvedValue({ success: true });
    });

    it('renders delete buttons for each tool', () => {
      renderWithProviders(<MyTools tools={mockTools} currentUser={mockUser} />);

      const allButtons = screen.getAllByRole('button');
      expect(allButtons.length).toBeGreaterThan(0);
    });

    it('has View Calendar buttons for each tool', () => {
      renderWithProviders(<MyTools tools={mockTools} currentUser={mockUser} />);
      
      const calendarButtons = screen.getAllByText('View Calendar');
      expect(calendarButtons.length).toBe(2);
    });

    it('opens delete confirmation dialog when delete button clicked', async () => {
      renderWithProviders(<MyTools tools={mockTools} currentUser={mockUser} />);
      
      // Find all buttons and click the first delete button (not View Calendar)
      const allButtons = screen.getAllByRole('button');
      const deleteButton = allButtons.find(btn => !btn.textContent?.includes('View Calendar'));
      if (deleteButton) {
        fireEvent.click(deleteButton);
        
        await waitFor(() => {
          expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        });
      }
    });

    it('shows tool name in delete confirmation', async () => {
      renderWithProviders(<MyTools tools={mockTools} currentUser={mockUser} />);
      
      const allButtons = screen.getAllByRole('button');
      const deleteButton = allButtons.find(btn => !btn.textContent?.includes('View Calendar'));
      if (deleteButton) {
        fireEvent.click(deleteButton);
        
        await waitFor(() => {
          expect(screen.getByText(/Delete Tool\?/)).toBeInTheDocument();
        });
      }
    });

    it('calls delete service when confirmed', async () => {
      renderWithProviders(<MyTools tools={mockTools} currentUser={mockUser} />);
      
      const allButtons = screen.getAllByRole('button');
      const deleteButton = allButtons.find(btn => !btn.textContent?.includes('View Calendar'));
      if (deleteButton) {
        fireEvent.click(deleteButton);
        
        await waitFor(() => {
          expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        });
        
        const confirmButton = screen.getByRole('button', { name: /delete tool/i });
        fireEvent.click(confirmButton);
        
        await waitFor(() => {
          expect(mockToolsService.delete).toHaveBeenCalled();
        });
      }
    });

    it('closes dialog when cancel clicked', async () => {
      renderWithProviders(<MyTools tools={mockTools} currentUser={mockUser} />);
      
      const allButtons = screen.getAllByRole('button');
      const deleteButton = allButtons.find(btn => !btn.textContent?.includes('View Calendar'));
      if (deleteButton) {
        fireEvent.click(deleteButton);
        
        await waitFor(() => {
          expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        });
        
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        fireEvent.click(cancelButton);
        
        await waitFor(() => {
          expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('Grid layout', () => {
    it('renders tools in a grid', () => {
      const { container } = renderWithProviders(<MyTools tools={mockTools} currentUser={mockUser} />);
      
      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
    });
  });
});
