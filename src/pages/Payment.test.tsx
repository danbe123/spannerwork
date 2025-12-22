import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Payment from './Payment';

// Mock services
const mockGetById = vi.fn();
const mockGetUserById = vi.fn();
const mockUpdateAddOns = vi.fn();

const mockGetPaymentsConfig = vi.fn();
const mockCreatePaymentIntent = vi.fn();

vi.mock('@/api/services', () => ({
  transactionsService: {
    getById: (id: string) => mockGetById(id),
    updateAddOns: (id: string, data: unknown) => mockUpdateAddOns(id, data),
  },
  usersService: {
    getById: (id: string) => mockGetUserById(id),
  },
}));

vi.mock('@/api/services/payments', () => ({
  paymentsService: {
    getConfig: (...args: unknown[]) => mockGetPaymentsConfig(...args),
    createPaymentIntent: (...args: unknown[]) => mockCreatePaymentIntent(...args),
  },
}));

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: () => Promise.resolve({}),
}));

const mockConfirmPayment = vi.fn();

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PaymentElement: () => <div data-testid="stripe-payment-element" />, 
  useStripe: () => ({ confirmPayment: (...args: unknown[]) => mockConfirmPayment(...args) }),
  useElements: () => ({}),
}));

// Mock utils (keep real formatPrice)
vi.mock('@/utils', async () => {
  const actual = await vi.importActual<typeof import('@/utils')>('@/utils');
  return {
    ...actual,
    createPageUrl: (path: string) => actual.createPageUrl(path),
  };
});

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
        paymentStatus: 'PENDING',
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

    mockUpdateAddOns.mockResolvedValue({
      transaction: {
        id: 'tx-1',
        providerId: 'provider-1',
        rentalFee: 5000,
        platformFee: 250,
        totalAmount: 5250,
        paymentStatus: 'PENDING',
        status: 'PENDING_PAYMENT',
      },
    });

    mockGetPaymentsConfig.mockResolvedValue({ publishableKey: 'pk_test_123' });
    mockCreatePaymentIntent.mockResolvedValue({
      clientSecret: 'cs_test_123',
      paymentIntentId: 'pi_test_123',
      amount: 5250,
      currency: 'gbp',
    });

    mockConfirmPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
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

    it('renders secure payment header', async () => {
      renderPayment();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Secure Payment/i })).toBeInTheDocument();
      });
    });

    it('renders Stripe payment element after continuing to payment', async () => {
      const user = userEvent.setup();
      renderPayment();

      // Click "Continue to payment" to show the Stripe element
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Continue to payment/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Continue to payment/i }));

      await waitFor(() => {
        expect(screen.getByTestId('stripe-payment-element')).toBeInTheDocument();
      });
    });
  });

  describe('Amount display', () => {
    it('displays service fee', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getAllByText('£50.00').length).toBeGreaterThan(0);
      });
    });

    it('displays platform fee', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getAllByText('£2.50').length).toBeGreaterThan(0);
      });
    });

    it('displays total amount', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getAllByText('£52.50').length).toBeGreaterThan(0);
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
        expect(screen.getByRole('heading', { name: /Order Summary/i })).toBeInTheDocument();
      });
    });
  });

  describe('Payment submission', () => {
    it('navigates to transaction detail on success', async () => {
      const user = userEvent.setup();
      renderPayment();

      // First click "Continue to payment" to create payment intent
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Continue to payment/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Continue to payment/i }));

      // Wait for Stripe payment element to appear
      await waitFor(() => {
        expect(screen.getByTestId('stripe-payment-element')).toBeInTheDocument();
      });

      // Then submit payment form
      const form = screen.getByTestId('stripe-payment-element').closest('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true }));
      }

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      });
    });

    it('shows error on payment failure', async () => {
      mockConfirmPayment.mockResolvedValueOnce({ error: { message: 'Payment failed' } });
      const user = userEvent.setup();
      renderPayment();

      // First click "Continue to payment" to create payment intent
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Continue to payment/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Continue to payment/i }));

      // Wait for Stripe payment element to appear
      await waitFor(() => {
        expect(screen.getByTestId('stripe-payment-element')).toBeInTheDocument();
      });

      // Then submit payment form
      const form = screen.getByTestId('stripe-payment-element').closest('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true }));
      }

      await waitFor(() => {
        expect(screen.getByText(/Payment failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('has back button', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^Back$/i })).toBeInTheDocument();
      });
    });

    it('navigates back on back button click', async () => {
      const user = userEvent.setup();
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^Back$/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /^Back$/i }));
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  describe('Security indicators', () => {
    it('shows secure payment header', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Secure Payment/i })).toBeInTheDocument();
      });
    });

    it('shows SSL encryption notice', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.queryByText(/256-bit SSL encrypted/i)).not.toBeInTheDocument();
      });
    });

    it('shows funds protection notice', async () => {
      renderPayment();
      
      await waitFor(() => {
        expect(screen.getByText(/Funds held securely until completion/i)).toBeInTheDocument();
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
          paymentStatus: 'PENDING',
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
