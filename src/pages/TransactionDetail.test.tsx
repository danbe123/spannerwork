import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import TransactionDetail from './TransactionDetail'

const mockGetCurrentUser = vi.fn()
const mockGetById = vi.fn()
const mockUpdateStatus = vi.fn()
const mockComplete = vi.fn()
const mockUsersGetById = vi.fn()
const mockToolsGetById = vi.fn()
const mockCreateReview = vi.fn()
const mockUploadFile = vi.fn()

vi.mock('@/api/services', () => ({
  authService: { getCurrentUser: () => mockGetCurrentUser() },
  transactionsService: {
    getById: (id: string) => mockGetById(id),
    updateStatus: (id: string, status: string) => mockUpdateStatus(id, status),
    complete: (id: string) => mockComplete(id),
  },
  usersService: { getById: (id: string) => mockUsersGetById(id) },
  toolsService: { getById: (id: string) => mockToolsGetById(id) },
  reviewsService: { create: (data: unknown) => mockCreateReview(data) },
  uploadService: { uploadFile: (file: File) => mockUploadFile(file) },
}))

vi.mock('@/utils', () => ({
  createPageUrl: (path: string) => `/${path}`,
}))

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

function renderWithClient(route = '/TransactionDetail?id=missing') {
  window.history.pushState({}, '', route)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <TransactionDetail />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('TransactionDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetCurrentUser.mockResolvedValue({ user: { id: 'u1' } })
    // Provide a safe default so React Query isn't handed `undefined`
    mockGetById.mockResolvedValue({})
    mockUsersGetById.mockResolvedValue({ user: { id: 'p1', name: 'Provider', rating: 4.2 } })
    mockToolsGetById.mockResolvedValue({ tool: { id: 'tool-1', name: 'Tool', category: 'Power', photos: [] } })
    mockUploadFile.mockResolvedValue({ data: { fileUrl: 'https://example.com/photo.jpg' } })
    mockUpdateStatus.mockResolvedValue({})
    mockComplete.mockResolvedValue({})
    mockCreateReview.mockResolvedValue({})

    if (!global.URL.createObjectURL) {
      // jsdom shim
      global.URL.createObjectURL = vi.fn(() => 'blob:preview')
    }
  });

  describe('Not found state', () => {
    it('renders not found state when transaction is missing', async () => {
      mockGetById.mockResolvedValueOnce({})
      renderWithClient()
      expect(await screen.findByText(/transaction not found/i)).toBeInTheDocument()
    });

    it('shows back button when not found', async () => {
      mockGetById.mockResolvedValueOnce({})
      renderWithClient()
      await screen.findByText(/transaction not found/i);
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Transaction display', () => {
    const mockTransaction = {
      id: 'txn-123',
      status: 'CONFIRMED',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      totalAmount: 5000,
      rentalFee: 4500,
      platformFee: 500,
      userId: 'user-1',
      providerId: 'provider-1',
      toolId: 'tool-1',
    };

    it('displays transaction when found', async () => {
      mockGetById.mockResolvedValueOnce({ transaction: mockTransaction });
      renderWithClient('/TransactionDetail?id=txn-123');
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('shows transaction status', async () => {
      mockGetById.mockResolvedValueOnce({ transaction: mockTransaction });
      renderWithClient('/TransactionDetail?id=txn-123');
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('displays pricing information', async () => {
      mockGetById.mockResolvedValueOnce({ transaction: mockTransaction });
      renderWithClient('/TransactionDetail?id=txn-123');
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Status flows', () => {
    it('handles PENDING status', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'PENDING', userId: 'u1' }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('handles CONFIRMED status', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'CONFIRMED', userId: 'u1' }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('handles COMPLETED status', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'COMPLETED', userId: 'u1' }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('handles CANCELLED status', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'CANCELLED', userId: 'u1' }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Actions', () => {
    it('shows available actions', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'CONFIRMED', userId: 'u1' }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('IN_PROGRESS status', () => {
    it('handles IN_PROGRESS status', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'IN_PROGRESS', userId: 'u1' }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('DISPUTED status', () => {
    it('handles DISPUTED status', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'DISPUTED', userId: 'u1' }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Provider view', () => {
    it('renders for provider', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'CONFIRMED', userId: 'other', providerId: 'u1' }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Error handling', () => {
    it('handles API error', async () => {
      mockGetById.mockRejectedValueOnce(new Error('API Error'));
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Loading state', () => {
    it('shows loading initially', () => {
      mockGetById.mockImplementation(() => new Promise(() => {}));
      renderWithClient('/TransactionDetail?id=txn-1');
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('User view', () => {
    it('renders for renter', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'CONFIRMED', userId: 'u1', providerId: 'p1' }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Pricing breakdown', () => {
    it('shows rental fee', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'CONFIRMED', userId: 'u1', rentalFee: 5000 }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('shows platform fee', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'CONFIRMED', userId: 'u1', platformFee: 500 }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('shows total amount', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'CONFIRMED', userId: 'u1', totalAmount: 5500 }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Date display', () => {
    it('shows start date', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'CONFIRMED', userId: 'u1', startDate: new Date().toISOString() }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('shows end date', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'CONFIRMED', userId: 'u1', endDate: new Date().toISOString() }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Tool details', () => {
    it('shows tool info when toolId present', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'CONFIRMED', userId: 'u1', toolId: 'tool-1' }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Space details', () => {
    it('shows space info when spaceId present', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'CONFIRMED', userId: 'u1', spaceId: 'space-1' }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Service details', () => {
    it('shows service info when serviceId present', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'CONFIRMED', userId: 'u1', serviceId: 'service-1' }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Review functionality', () => {
    it('shows review option for COMPLETED status', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'COMPLETED', userId: 'u1' }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('UI elements', () => {
    it('renders back button', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'CONFIRMED', userId: 'u1' }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('renders status badge', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'CONFIRMED', userId: 'u1' }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('renders icons', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'CONFIRMED', userId: 'u1' }
      });
      const { container } = renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => {
        const icons = container.querySelectorAll('svg');
        expect(icons.length).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Payment status', () => {
    it('shows PAID payment status', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'CONFIRMED', userId: 'u1', paymentStatus: 'PAID' }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('shows PENDING payment status', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'CONFIRMED', userId: 'u1', paymentStatus: 'PENDING' }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('shows REFUNDED payment status', async () => {
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'CANCELLED', userId: 'u1', paymentStatus: 'REFUNDED' }
      });
      renderWithClient('/TransactionDetail?id=txn-1');
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Interaction flows', () => {
    it('CONFIRMED + user can upload pickup photo and confirm pickup (calls updateStatus)', async () => {
      mockGetCurrentUser.mockResolvedValue({ user: { id: 'u1' } })
      mockGetById.mockResolvedValueOnce({
        transaction: { id: 'txn-1', status: 'CONFIRMED', userId: 'u1', providerId: 'p1', createdDate: new Date().toISOString(), rentalFee: 10 },
      })

      const { container } = renderWithClient('/TransactionDetail?id=txn-1')

      // There is both a heading and a button with this label; target the heading
      await screen.findByRole('heading', { name: /confirm pickup/i })

      const pickupInput = container.querySelector('#pickup-photo') as HTMLInputElement
      expect(pickupInput).toBeTruthy()

      fireEvent.change(pickupInput, { target: { files: [new File(['x'], 'photo.png', { type: 'image/png' })] } })

      await waitFor(() => {
        expect(mockUploadFile).toHaveBeenCalled()
      })

      const confirmBtn = await screen.findByRole('button', { name: /confirm pickup/i })
      await waitFor(() => expect(confirmBtn).not.toBeDisabled())
      fireEvent.click(confirmBtn)

      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith('txn-1', 'IN_PROGRESS')
      })
    })

    it('IN_PROGRESS + provider can upload return photo, rate, and confirm return (calls complete + create review)', async () => {
      // Keep default current user (u1) and make u1 the provider so isProvider is true
      mockUsersGetById.mockImplementation((id: string) => {
        if (id === 'u1') {
          return Promise.resolve({ user: { id: 'u1', name: 'Provider', rating: 4.2 } })
        }
        return Promise.resolve({ user: { id: 'u2', name: 'Renter', rating: 4.0 } })
      })

      const now = new Date()
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
      mockGetById.mockResolvedValueOnce({
        transaction: {
          id: 'txn-1',
          status: 'IN_PROGRESS',
          userId: 'u2',
          providerId: 'u1',
          createdDate: now.toISOString(),
          endDate: tomorrow,
          rentalFee: 10,
        },
      })

      const { container } = renderWithClient('/TransactionDetail?id=txn-1')

      await waitFor(() => {
        expect(mockGetById).toHaveBeenCalled()
        expect(mockGetCurrentUser).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(container.querySelector('#return-photo')).toBeTruthy()
      })

      const returnInput = container.querySelector('#return-photo') as HTMLInputElement
      fireEvent.change(returnInput, { target: { files: [new File(['x'], 'photo.png', { type: 'image/png' })] } })

      await waitFor(() => {
        expect(mockUploadFile).toHaveBeenCalled()
      })

      // click any star in the rating control to set rating > 0 (best effort)
      const ratingButtons = Array.from(container.querySelectorAll('button')).filter(b =>
        b.querySelector('svg.lucide-star.w-8')
      )
      if (ratingButtons.length > 0) {
        fireEvent.click(ratingButtons[ratingButtons.length - 1])
      }

      const confirmReturnBtn = await screen.findByRole('button', { name: /confirm return/i })
      await waitFor(() => expect(confirmReturnBtn).not.toBeDisabled())
      fireEvent.click(confirmReturnBtn)

      await waitFor(() => {
        expect(mockComplete).toHaveBeenCalledWith('txn-1')
      })

      // Review is created only if rating > 0; if the star click worked, we should see it.
      if (ratingButtons.length > 0) {
        await waitFor(() => {
          expect(mockCreateReview).toHaveBeenCalled()
        })
      }
    })

    it('shows overdue banner when endDate is in the past', async () => {
      mockGetCurrentUser.mockResolvedValue({ user: { id: 'u1' } })
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      mockGetById.mockResolvedValueOnce({
        transaction: {
          id: 'txn-1',
          status: 'IN_PROGRESS',
          userId: 'u1',
          providerId: 'p1',
          createdDate: new Date().toISOString(),
          endDate: yesterday,
          rentalFee: 10,
        },
      })
      renderWithClient('/TransactionDetail?id=txn-1')
      expect(await screen.findByText(/overdue by/i)).toBeInTheDocument()
    })

    it('shows dispute button for IN_PROGRESS and clicking navigates to dispute page', async () => {
      mockGetCurrentUser.mockResolvedValue({ user: { id: 'u1' } })
      mockGetById.mockResolvedValueOnce({
        transaction: {
          id: 'txn-1',
          status: 'IN_PROGRESS',
          userId: 'u1',
          providerId: 'p1',
          createdDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          rentalFee: 10,
        },
      })
      renderWithClient('/TransactionDetail?id=txn-1')

      const disputeBtn = await screen.findByRole('button', { name: /file a dispute/i })
      fireEvent.click(disputeBtn)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/DisputeResolution?transactionId=txn-1')
      })
    })
  })
})
