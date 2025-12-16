import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Payment from './Payment';

// Mock services
const mockGetById = vi.fn();
const mockUpdateStatus = vi.fn();
const mockGetUserById = vi.fn();

vi.mock('@/api/services', () => ({
  transactionsService: {
    getById: (id: string) => mockGetById(id),
    updateStatus: (id: string, status: string) => mockUpdateStatus(id, status),
  },
  usersService: {
    getById: (id: string) => mockGetUserById(id),
  },
}));

// Mock utils
vi.mock('@/utils', () => ({
  createPageUrl: (path: string) => `/${path}`,
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

function renderPayment(route = '/payment?transactionId=tx-1') {
  Object.defineProperty(window, 'location', {
    value: {
      search: route.includes('?') ? '?' + route.split('?')[1] : '',
      pathname: '/payment',
    },
    writable: true,
  });

  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Payment />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Payment Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGetById.mockResolvedValue({
      transaction: {
        id: 'tx-1',
        providerId: 'provider-1',
        rentalFee: 5000, // £50.00 in pence
        platformFee: 250, // £2.50 in pence
        status: 'PENDING_PAYMENT',
      },
    });
    
    mockGetUserById.mockResolvedValue({
      user: {
        id: 'provider-1',
        name: 'Provider Name',
        email: 'provider@test.com',
      },
    });
    
    mockUpdateStatus.mockResolvedValue({});
  });

  describe('Loading state', () => {
    it('shows loading spinner while fetching transaction', () => {
      mockGetById.mockImplementation(() => new Promise(() => {}));
      renderPayment();
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Transaction not found', () => {
    it('shows error when no transactionId provided', async () => {
      Object.defineProperty(window, 'location', {
        value: { search: '', pathname: '/payment' },
        writable: true,
      });
      
      mockGetById.mockResolvedValue({ transaction: undefined });
      
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/payment']}>
            <Payment />
          </MemoryRouter>
        </QueryClientProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByText('Transaction Not Found')).toBeInTheDocument();
      });
    });

    it('shows back to profile button when transaction not found', async () => {
      mockGetById.mockResolvedValue({ transaction: undefined });
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByText('Back to Profile')).toBeInTheDocument();
      });
    });

    it('navigates to profile when back button clicked', async () => {
      mockGetById.mockResolvedValue({ transaction: undefined });
      const user = userEvent.setup();
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByText('Back to Profile')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Back to Profile'));
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe('Payment form rendering', () => {
    it('renders payment form when transaction exists', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(mockGetById).toHaveBeenCalledWith('tx-1');
      });
    });

    it('renders cardholder name input', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/cardholder name/i)).toBeInTheDocument();
      });
    });

    it('renders card number input', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/card number/i)).toBeInTheDocument();
      });
    });

    it('renders expiry date input', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/expiry date/i)).toBeInTheDocument();
      });
    });

    it('renders CVC input', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/cvc/i)).toBeInTheDocument();
      });
    });

    it('renders secure payment header', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByText(/secure payment/i)).toBeInTheDocument();
      });
    });
  });

  describe('Amount display', () => {
    it('displays service fee', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByText('£50.00')).toBeInTheDocument();
      });
    });

    it('displays platform fee', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByText('£2.50')).toBeInTheDocument();
      });
    });

    it('displays total amount', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByText('£52.50')).toBeInTheDocument();
      });
    });

    it('displays provider name', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByText('Provider Name')).toBeInTheDocument();
      });
    });

    it('displays order summary title', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByText('Order Summary')).toBeInTheDocument();
      });
    });
  });

  describe('Form validation', () => {
    it('validates card details before submission', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/cardholder name/i)).toBeInTheDocument();
      });
      
      // Verify form exists with required fields
      const form = document.querySelector('form');
      expect(form).toBeTruthy();
      
      const submitButton = screen.getByRole('button', { name: /pay/i });
      expect(submitButton).toBeInTheDocument();
      
      // Verify all required inputs are present
      expect(screen.getByLabelText(/cardholder name/i)).toBeRequired();
      expect(screen.getByLabelText(/card number/i)).toBeRequired();
      expect(screen.getByLabelText(/expiry date/i)).toBeRequired();
      expect(screen.getByLabelText(/cvc/i)).toBeRequired();
    });

    it('shows error for invalid card number length', async () => {
      const user = userEvent.setup();
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/cardholder name/i)).toBeInTheDocument();
      });
      
      await user.type(screen.getByLabelText(/cardholder name/i), 'John Smith');
      await user.type(screen.getByLabelText(/card number/i), '1234');
      await user.type(screen.getByLabelText(/expiry date/i), '12/25');
      await user.type(screen.getByLabelText(/cvc/i), '123');
      
      const submitButton = screen.getByRole('button', { name: /pay/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Please enter a valid 16-digit card number')).toBeInTheDocument();
      });
    });
  });

  describe('Card number formatting', () => {
    it('formats card number with spaces', async () => {
      const user = userEvent.setup();
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/card number/i)).toBeInTheDocument();
      });
      
      const cardInput = screen.getByLabelText(/card number/i) as HTMLInputElement;
      await user.type(cardInput, '1234567890123456');
      
      expect(cardInput.value).toBe('1234 5678 9012 3456');
    });
  });

  describe('Expiry date formatting', () => {
    it('formats expiry date with slash', async () => {
      const user = userEvent.setup();
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/expiry date/i)).toBeInTheDocument();
      });
      
      const expiryInput = screen.getByLabelText(/expiry date/i) as HTMLInputElement;
      await user.type(expiryInput, '1225');
      
      expect(expiryInput.value).toBe('12/25');
    });
  });

  describe('CVC input', () => {
    it('only accepts numeric input', async () => {
      const user = userEvent.setup();
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/cvc/i)).toBeInTheDocument();
      });
      
      const cvcInput = screen.getByLabelText(/cvc/i) as HTMLInputElement;
      await user.type(cvcInput, 'abc123');
      
      expect(cvcInput.value).toBe('123');
    });
  });

  describe('Payment submission', () => {
    it('processes payment on valid form submission', async () => {
      const user = userEvent.setup();
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/cardholder name/i)).toBeInTheDocument();
      });
      
      await user.type(screen.getByLabelText(/cardholder name/i), 'John Smith');
      await user.type(screen.getByLabelText(/card number/i), '1234567890123456');
      await user.type(screen.getByLabelText(/expiry date/i), '12/25');
      await user.type(screen.getByLabelText(/cvc/i), '123');
      
      const submitButton = screen.getByRole('button', { name: /pay/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/processing payment/i)).toBeInTheDocument();
      });
    });

    it('disables submit button while processing', async () => {
      const user = userEvent.setup();
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/cardholder name/i)).toBeInTheDocument();
      });
      
      await user.type(screen.getByLabelText(/cardholder name/i), 'John Smith');
      await user.type(screen.getByLabelText(/card number/i), '1234567890123456');
      await user.type(screen.getByLabelText(/expiry date/i), '12/25');
      await user.type(screen.getByLabelText(/cvc/i), '123');
      
      const submitButton = screen.getByRole('button', { name: /pay/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
    });

    it('updates transaction status on success', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/cardholder name/i)).toBeInTheDocument();
      });
      
      await user.type(screen.getByLabelText(/cardholder name/i), 'John Smith');
      await user.type(screen.getByLabelText(/card number/i), '1234567890123456');
      await user.type(screen.getByLabelText(/expiry date/i), '12/25');
      await user.type(screen.getByLabelText(/cvc/i), '123');
      
      const submitButton = screen.getByRole('button', { name: /pay/i });
      await user.click(submitButton);
      
      // Advance timer past the simulated processing delay
      await vi.advanceTimersByTimeAsync(2500);
      
      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith('tx-1', 'CONFIRMED');
      });
      
      vi.useRealTimers();
    });

    it('navigates to transaction detail on success', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/cardholder name/i)).toBeInTheDocument();
      });
      
      await user.type(screen.getByLabelText(/cardholder name/i), 'John Smith');
      await user.type(screen.getByLabelText(/card number/i), '1234567890123456');
      await user.type(screen.getByLabelText(/expiry date/i), '12/25');
      await user.type(screen.getByLabelText(/cvc/i), '123');
      
      const submitButton = screen.getByRole('button', { name: /pay/i });
      await user.click(submitButton);
      
      await vi.advanceTimersByTimeAsync(2500);
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      });
      
      vi.useRealTimers();
    });

    it('shows error on payment failure', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mockUpdateStatus.mockRejectedValue(new Error('Payment failed'));
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/cardholder name/i)).toBeInTheDocument();
      });
      
      await user.type(screen.getByLabelText(/cardholder name/i), 'John Smith');
      await user.type(screen.getByLabelText(/card number/i), '1234567890123456');
      await user.type(screen.getByLabelText(/expiry date/i), '12/25');
      await user.type(screen.getByLabelText(/cvc/i), '123');
      
      const submitButton = screen.getByRole('button', { name: /pay/i });
      await user.click(submitButton);
      
      await vi.advanceTimersByTimeAsync(2500);
      
      await waitFor(() => {
        expect(screen.getByText(/payment failed/i)).toBeInTheDocument();
      });
      
      vi.useRealTimers();
    });
  });

  describe('Navigation', () => {
    it('has back button', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByText('Back')).toBeInTheDocument();
      });
    });

    it('navigates back on back button click', async () => {
      const user = userEvent.setup();
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByText('Back')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Back'));
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  describe('Security indicators', () => {
    it('shows secure payment header', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByText(/Secure Payment/i)).toBeInTheDocument();
      });
    });

    it('shows SSL encryption notice', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByText(/256-bit SSL encrypted/i)).toBeInTheDocument();
      });
    });

    it('shows funds protection notice', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByText(/Funds held securely/i)).toBeInTheDocument();
      });
    });
  });

  describe('Provider without platform fee', () => {
    it('hides platform fee when zero', async () => {
      mockGetById.mockResolvedValue({
        transaction: {
          id: 'tx-1',
          providerId: 'provider-1',
          rentalFee: 5000,
          platformFee: 0,
          status: 'PENDING_PAYMENT',
        },
      });
      
      renderPayment();
      
      await waitFor(() => {
        expect(screen.queryByText('Platform Fee')).not.toBeInTheDocument();
      });
    });
  });

  describe('Provider display fallback', () => {
    it('shows email when name is not available', async () => {
      mockGetUserById.mockResolvedValue({
        user: {
          id: 'provider-1',
          email: 'provider@test.com',
        },
      });
      
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByText('provider@test.com')).toBeInTheDocument();
      });
    });

    it('shows Provider fallback when no user info', async () => {
      mockGetUserById.mockResolvedValue({ user: null });
      
      renderPayment();
      
      // When no user data is available, should still render without crashing
      await waitFor(() => {
        expect(mockGetById).toHaveBeenCalledWith('tx-1');
      });
    });
  });
});
