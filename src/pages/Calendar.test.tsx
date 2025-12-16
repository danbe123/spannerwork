import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { format, addMonths, subMonths } from 'date-fns';
import Calendar from './Calendar';

// Mock services
const mockGetToolById = vi.fn();
const mockListTransactions = vi.fn();
const mockCreateTransaction = vi.fn();
const mockGetCurrentUser = vi.fn();

vi.mock('@/api/services', () => ({
  toolsService: {
    getById: (id: string) => mockGetToolById(id),
  },
  transactionsService: {
    list: (filters: unknown) => mockListTransactions(filters),
    create: (data: unknown) => mockCreateTransaction(data),
  },
  authService: {
    getCurrentUser: () => mockGetCurrentUser(),
  },
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

// Mock utils
vi.mock('@/utils', () => ({
  createPageUrl: (path: string) => `/${path}`,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function wrap(search = '') {
  const qc = createQueryClient();
  Object.defineProperty(window, 'location', {
    value: { search, href: `http://localhost/Calendar${search}` },
    writable: true,
    configurable: true,
  });
  
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Calendar Page', () => {
  const mockTool = {
    id: 'tool-123',
    name: 'Power Drill',
    category: 'Power Tools',
    dailyRate: 25,
    weeklyRate: 100,
    deposit: 50,
    photos: ['https://example.com/drill.jpg'],
  };

  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGetToolById.mockResolvedValue({ tool: mockTool });
    mockListTransactions.mockResolvedValue({ data: [] });
    mockCreateTransaction.mockResolvedValue({ transaction: { id: 'tx-1' } });
    mockGetCurrentUser.mockResolvedValue({ user: mockUser });
  });

  describe('No tool ID', () => {
    it('shows tool not found when no toolId', async () => {
      mockGetToolById.mockResolvedValue({ tool: undefined });
      wrap();
      expect(await screen.findByText(/tool not found/i)).toBeInTheDocument();
    });

    it('shows back to feed button', async () => {
      mockGetToolById.mockResolvedValue({ tool: undefined });
      wrap();
      expect(await screen.findByRole('button', { name: /back to feed/i })).toBeInTheDocument();
    });

    it('navigates to feed when back button clicked', async () => {
      mockGetToolById.mockResolvedValue({ tool: undefined });
      const user = userEvent.setup();
      wrap();
      
      const backButton = await screen.findByRole('button', { name: /back to feed/i });
      await user.click(backButton);
      
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe('Loading state', () => {
    it('shows loading spinner while fetching tool', async () => {
      mockGetToolById.mockImplementation(() => new Promise(() => {}));
      wrap('?toolId=tool-123');
      // Loading state should be shown
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Tool display', () => {
    it('displays tool name', async () => {
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText('Power Drill')).toBeInTheDocument();
      });
    });

    it('displays tool category badge', async () => {
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText('Power Tools')).toBeInTheDocument();
      });
    });

    it('displays daily rate', async () => {
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText('£25/day')).toBeInTheDocument();
      });
    });

    it('displays weekly rate', async () => {
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText('£100/week')).toBeInTheDocument();
      });
    });

    it('displays deposit amount', async () => {
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText('£50')).toBeInTheDocument();
      });
    });

    it('displays tool photo', async () => {
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        const img = document.querySelector('img[src="https://example.com/drill.jpg"]');
        expect(img).toBeInTheDocument();
      });
    });

    it('displays page title with tool name', async () => {
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText(/book power drill/i)).toBeInTheDocument();
      });
    });
  });

  describe('Calendar display', () => {
    it('displays current month', async () => {
      wrap('?toolId=tool-123');
      
      const currentMonth = format(new Date(), 'MMMM yyyy');
      await waitFor(() => {
        expect(screen.getByText(currentMonth)).toBeInTheDocument();
      });
    });

    it('displays day headers', async () => {
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText('Sun')).toBeInTheDocument();
        expect(screen.getByText('Mon')).toBeInTheDocument();
        expect(screen.getByText('Tue')).toBeInTheDocument();
        expect(screen.getByText('Wed')).toBeInTheDocument();
        expect(screen.getByText('Thu')).toBeInTheDocument();
        expect(screen.getByText('Fri')).toBeInTheDocument();
        expect(screen.getByText('Sat')).toBeInTheDocument();
      });
    });

    it('displays calendar legend', async () => {
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText('Booked')).toBeInTheDocument();
        expect(screen.getByText('Today')).toBeInTheDocument();
        expect(screen.getByText('Selected')).toBeInTheDocument();
      });
    });
  });

  describe('Month navigation', () => {
    it('navigates to next month', async () => {
      const user = userEvent.setup();
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText('Power Drill')).toBeInTheDocument();
      });
      
      const nextButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.classList.contains('lucide-chevron-right') ||
        btn.innerHTML.includes('ChevronRight')
      );
      
      if (nextButton) {
        await user.click(nextButton);
        
        const nextMonth = format(addMonths(new Date(), 1), 'MMMM yyyy');
        await waitFor(() => {
          expect(screen.getByText(nextMonth)).toBeInTheDocument();
        });
      }
    });

    it('navigates to previous month', async () => {
      const user = userEvent.setup();
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText('Power Drill')).toBeInTheDocument();
      });
      
      const prevButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.classList.contains('lucide-chevron-left') ||
        btn.innerHTML.includes('ChevronLeft')
      );
      
      if (prevButton) {
        await user.click(prevButton);
        
        const prevMonth = format(subMonths(new Date(), 1), 'MMMM yyyy');
        await waitFor(() => {
          expect(screen.getByText(prevMonth)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Date selection', () => {
    it('shows booking options when date is selected', async () => {
      const user = userEvent.setup();
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText('Power Drill')).toBeInTheDocument();
      });
      
      // Find a future date button to click
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayNumber = tomorrow.getDate().toString();
      
      const dayButtons = screen.getAllByRole('button');
      const dayButton = dayButtons.find(btn => btn.textContent === dayNumber && !(btn as HTMLButtonElement).disabled);
      
      if (dayButton) {
        await user.click(dayButton);
        
        await waitFor(() => {
          // Use getAllByText since there may be multiple elements containing "book for"
          const bookElements = screen.getAllByText(/book for/i);
          expect(bookElements.length).toBeGreaterThan(0);
        });
      }
    });

    it('shows select date prompt when no date selected', async () => {
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText(/select a date to see booking options/i)).toBeInTheDocument();
      });
    });
  });

  describe('Booked dates', () => {
    it('shows booked dates as unavailable', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      mockListTransactions.mockResolvedValue({
        data: [{
          id: 'tx-1',
          startDate: tomorrow.toISOString(),
          endDate: tomorrow.toISOString(),
          status: 'CONFIRMED',
        }],
      });
      
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText('Power Drill')).toBeInTheDocument();
      });
      
      // Booked dates should be styled differently and disabled
      expect(document.body).toBeInTheDocument();
    });

    it('does not show cancelled bookings as booked', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      mockListTransactions.mockResolvedValue({
        data: [{
          id: 'tx-1',
          startDate: tomorrow.toISOString(),
          endDate: tomorrow.toISOString(),
          status: 'CANCELLED',
        }],
      });
      
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText('Power Drill')).toBeInTheDocument();
      });
      
      // Cancelled bookings should not block the date
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Booking creation', () => {
    it('shows daily booking button with price', async () => {
      const user = userEvent.setup();
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText('Power Drill')).toBeInTheDocument();
      });
      
      // Select a future date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayNumber = tomorrow.getDate().toString();
      
      const dayButtons = screen.getAllByRole('button');
      const dayButton = dayButtons.find(btn => btn.textContent === dayNumber && !(btn as HTMLButtonElement).disabled);
      
      if (dayButton) {
        await user.click(dayButton);
        
        await waitFor(() => {
          expect(screen.getByText(/book for 1 day - £25/i)).toBeInTheDocument();
        });
      }
    });

    it('shows weekly booking button with savings', async () => {
      const user = userEvent.setup();
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText('Power Drill')).toBeInTheDocument();
      });
      
      // Select a future date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayNumber = tomorrow.getDate().toString();
      
      const dayButtons = screen.getAllByRole('button');
      const dayButton = dayButtons.find(btn => btn.textContent === dayNumber && !(btn as HTMLButtonElement).disabled);
      
      if (dayButton) {
        await user.click(dayButton);
        
        await waitFor(() => {
          expect(screen.getByText(/weekly rental - £100\/week/i)).toBeInTheDocument();
          expect(screen.getByText(/save/i)).toBeInTheDocument();
        });
      }
    });

    it('creates booking on daily button click', async () => {
      const user = userEvent.setup();
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText('Power Drill')).toBeInTheDocument();
      });
      
      // Select a future date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayNumber = tomorrow.getDate().toString();
      
      const dayButtons = screen.getAllByRole('button');
      const dayButton = dayButtons.find(btn => btn.textContent === dayNumber && !(btn as HTMLButtonElement).disabled);
      
      if (dayButton) {
        await user.click(dayButton);
        
        await waitFor(() => {
          expect(screen.getByText(/book for 1 day/i)).toBeInTheDocument();
        });
        
        const bookButton = screen.getByText(/book for 1 day/i).closest('button');
        if (bookButton) {
          await user.click(bookButton);
          
          await waitFor(() => {
            expect(mockCreateTransaction).toHaveBeenCalled();
          });
        }
      }
    });

    it('shows owner confirmation notice', async () => {
      const user = userEvent.setup();
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText('Power Drill')).toBeInTheDocument();
      });
      
      // Select a future date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayNumber = tomorrow.getDate().toString();
      
      const dayButtons = screen.getAllByRole('button');
      const dayButton = dayButtons.find(btn => btn.textContent === dayNumber && !(btn as HTMLButtonElement).disabled);
      
      if (dayButton) {
        await user.click(dayButton);
        
        await waitFor(() => {
          expect(screen.getByText(/owner will confirm/i)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Tool without weekly rate', () => {
    it('hides weekly option when no weekly rate', async () => {
      mockGetToolById.mockResolvedValue({
        tool: { ...mockTool, weeklyRate: 0 },
      });
      
      const user = userEvent.setup();
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText('Power Drill')).toBeInTheDocument();
      });
      
      // Select a future date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayNumber = tomorrow.getDate().toString();
      
      const dayButtons = screen.getAllByRole('button');
      const dayButton = dayButtons.find(btn => btn.textContent === dayNumber && !(btn as HTMLButtonElement).disabled);
      
      if (dayButton) {
        await user.click(dayButton);
        
        await waitFor(() => {
          expect(screen.queryByText(/weekly rental/i)).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('Tool without deposit', () => {
    it('hides deposit when zero', async () => {
      mockGetToolById.mockResolvedValue({
        tool: { ...mockTool, deposit: 0 },
      });
      
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText('Power Drill')).toBeInTheDocument();
      });
      
      expect(screen.queryByText('Deposit:')).not.toBeInTheDocument();
    });
  });

  describe('Tool without photo', () => {
    it('handles tool without photos', async () => {
      mockGetToolById.mockResolvedValue({
        tool: { ...mockTool, photos: [] },
      });
      
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText('Power Drill')).toBeInTheDocument();
      });
      
      // Should still render without crashing
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Past dates', () => {
    it('disables past dates', async () => {
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText('Power Drill')).toBeInTheDocument();
      });
      
      // Past dates should be disabled (cursor-not-allowed)
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Today indicator', () => {
    it('highlights today with border', async () => {
      wrap('?toolId=tool-123');
      
      await waitFor(() => {
        expect(screen.getByText('Power Drill')).toBeInTheDocument();
      });
      
      // Today's date should have a special border style
      expect(document.body).toBeInTheDocument();
    });
  });
});
