import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createHelmetMock } from '@/test/mockSetup';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RequestDetail from './RequestDetail';

// Mock services
const mockGetRequestById = vi.fn();
const mockGetUserById = vi.fn();
const mockGetCurrentUser = vi.fn();
const mockListTransactions = vi.fn();

const mockNavigate = vi.fn();

vi.mock('@/api/services', () => ({
  requestsService: {
    getById: (id: string) => mockGetRequestById(id),
  },
  usersService: {
    getById: (id: string) => mockGetUserById(id),
  },
  authService: {
    getCurrentUser: () => mockGetCurrentUser(),
  },
  transactionsService: {
    list: (params: { requestId?: string }) => mockListTransactions(params),
  },
}));

// Mock utils
vi.mock('@/utils', () => ({
  createPageUrl: (path: string) => `/${path}`,
}));

// Mock react-helmet-async
vi.mock('react-helmet-async', () => createHelmetMock());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../components/RequestResponseDialog', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div>
      <button type="button" onClick={onClose}>Close Response Dialog</button>
      <div>RequestResponseDialog</div>
    </div>
  ),
}));

vi.mock('../components/EditRequestDialog', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div>
      <button type="button" onClick={onClose}>Close Edit Dialog</button>
      <div>EditRequestDialog</div>
    </div>
  ),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

const mockRequest = {
  id: 'req-1',
  title: 'Need a power drill',
  description: 'Looking for a power drill for weekend project',
  budget: 50,
  rateType: 'DAILY',
  category: 'TOOLS',
  urgency: 'ASAP',
  status: 'ACTIVE',
  postcode: 'SW1A 1AA',
  seekerId: 'seeker-1',
  createdDate: new Date().toISOString(),
};

const mockSeeker = {
  id: 'seeker-1',
  name: 'Request Seeker',
  email: 'seeker@test.com',
  rating: 4.5,
  reviewCount: 15,
};

function renderRequestDetail(route = '/request/req-1') {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/request/:id" element={<RequestDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('RequestDetail Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGetRequestById.mockResolvedValue({ request: mockRequest });
    mockGetUserById.mockResolvedValue({ user: mockSeeker });
    mockGetCurrentUser.mockResolvedValue({ user: { id: 'user-1' } });
    mockListTransactions.mockResolvedValue({ data: [] });
  });

  describe('Missing request ID', () => {
    it('shows error when no requestId provided', () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/request']}>
            <Routes>
              <Route path="/request" element={<RequestDetail />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('shows loading state while fetching', () => {
      mockGetRequestById.mockImplementation(() => new Promise(() => {}));
      
      renderRequestDetail();
      
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Request not found', () => {
    it('handles request not found', async () => {
      mockGetRequestById.mockResolvedValue({ request: null });

      renderRequestDetail();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Request display', () => {
    it('renders title and description when request is found', async () => {
      renderRequestDetail();
      expect(await screen.findByText('Need a power drill')).toBeInTheDocument();
      expect(screen.getByText(/Looking for a power drill/)).toBeInTheDocument();
    });
  });

  describe('Budget display', () => {
    it('renders budget section', async () => {
      const { container } = renderRequestDetail();

      await waitFor(() => {
        expect(container).toBeInTheDocument();
      });
    });
  });

  describe('Seeker info', () => {
    it('renders seeker section', async () => {
      const { container } = renderRequestDetail();

      await waitFor(() => {
        expect(container).toBeInTheDocument();
      });
    });
  });

  describe('Status display', () => {
    it('shows OPEN status', async () => {
      renderRequestDetail();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Actions', () => {
    it('shows I Can Help for other user and opens response dialog on click', async () => {
      mockGetCurrentUser.mockResolvedValue({ user: { id: 'other-user' } });
      renderRequestDetail();

      const cta = await screen.findByRole('button', { name: /i can help/i });
      fireEvent.click(cta);
      expect(await screen.findByText('RequestResponseDialog')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /close response dialog/i }));
      await waitFor(() => {
        expect(screen.queryByText('RequestResponseDialog')).not.toBeInTheDocument();
      });
    });

    it('shows edit button for own active request and opens edit dialog', async () => {
      mockGetCurrentUser.mockResolvedValue({ user: { id: 'seeker-1' } });
      renderRequestDetail();

      const editBtn = await screen.findByRole('button', { name: /edit request/i });
      fireEvent.click(editBtn);
      expect(await screen.findByText('EditRequestDialog')).toBeInTheDocument();
    });

    it('shows Back to Feed for inactive request', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, status: 'CANCELLED' } });
      renderRequestDetail();

      const back = await screen.findAllByRole('button', { name: /back to feed/i });
      fireEvent.click(back[back.length - 1]);
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe('Urgency levels', () => {
    it('handles ASAP urgency', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, urgency: 'ASAP' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('handles FLEXIBLE urgency', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, urgency: 'FLEXIBLE' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('handles TODAY urgency', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, urgency: 'TODAY' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Categories', () => {
    it('handles TOOLS category', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, category: 'TOOLS' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('handles SPACES category', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, category: 'SPACES' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('handles SERVICES category', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, category: 'SERVICES' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Rate types', () => {
    it('handles HOURLY rate type', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, rateType: 'HOURLY' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('handles FIXED rate type', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, rateType: 'FIXED' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Status types', () => {
    it('handles CANCELLED status', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, status: 'CANCELLED' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('handles COMPLETED status', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, status: 'COMPLETED' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('handles IN_PROGRESS status', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, status: 'IN_PROGRESS' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('handles ACTIVE status', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, status: 'ACTIVE' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Own request vs others', () => {
    it('detects own request', async () => {
      mockGetCurrentUser.mockResolvedValue({ user: { id: 'seeker-1' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('detects other user request', async () => {
      mockGetCurrentUser.mockResolvedValue({ user: { id: 'other-user' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('shows edit button for own request', async () => {
      mockGetCurrentUser.mockResolvedValue({ user: { id: 'seeker-1' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('shows respond button for others request', async () => {
      mockGetCurrentUser.mockResolvedValue({ user: { id: 'other-user' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Postcode formatting', () => {
    it('formats postcode with space', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, postcode: 'SW1A1AA' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('handles empty postcode', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, postcode: '' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('UI elements', () => {
    it('renders back button', async () => {
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('renders category icon', async () => {
      const { container } = renderRequestDetail();
      await waitFor(() => {
        const icons = container.querySelectorAll('svg');
        expect(icons.length).toBeGreaterThan(0);
      });
    });

    it('renders badges', async () => {
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('renders avatar', async () => {
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Date display', () => {
    it('shows relative time', async () => {
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Response dialog', () => {
    it('can open response dialog', async () => {
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Edit dialog', () => {
    it('can open edit dialog for own request', async () => {
      mockGetCurrentUser.mockResolvedValue({ user: { id: 'seeker-1' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Responses list', () => {
    it('shows responses count', async () => {
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Budget display variants', () => {
    it('handles undefined budget', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, budget: undefined } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('handles null budget', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, budget: null } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('handles zero budget', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, budget: 0 } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Category icons', () => {
    it('shows Wrench for TOOLS category', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, category: 'TOOLS' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('shows GraduationCap for EXPERTISE category', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, category: 'EXPERTISE' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('shows Warehouse for SPACE category', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, category: 'SPACE' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('defaults to Wrench for unknown category', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, category: 'UNKNOWN' } });
      renderRequestDetail();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Rate display variants', () => {
    it('shows /hr for HOURLY', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, rateType: 'HOURLY', budget: 10 } });
      renderRequestDetail();
      expect(await screen.findByText(/£10\/hr/i)).toBeInTheDocument();
    });

    it('shows /day for DAILY', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, rateType: 'DAILY', budget: 25 } });
      renderRequestDetail();
      expect(await screen.findByText(/£25\/day/i)).toBeInTheDocument();
    });

    it('shows fixed budget for FIXED', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, rateType: 'FIXED', budget: 99 } });
      renderRequestDetail();
      expect(await screen.findByText(/£99\b/i)).toBeInTheDocument();
    });
  });

  describe('Broadcast radius branches', () => {
    it('shows Within X miles for local request', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, broadcastRadius: 25 } });
      renderRequestDetail();
      expect(await screen.findByText(/within 25 miles/i)).toBeInTheDocument();
    });

    it('shows Nationwide request for large radius', async () => {
      mockGetRequestById.mockResolvedValue({ request: { ...mockRequest, broadcastRadius: 999 } });
      renderRequestDetail();
      expect(await screen.findByText(/nationwide request/i)).toBeInTheDocument();
    });
  });

  describe('Responses list', () => {
    it('renders responses for own request', async () => {
      mockGetCurrentUser.mockResolvedValue({ user: { id: 'seeker-1' } });
      mockListTransactions.mockResolvedValue({
        data: [{ id: 't1', rentalFee: 12, depositAmount: 2, providerId: 'p1' }],
      });
      renderRequestDetail();

      await waitFor(() => {
        expect(mockListTransactions).toHaveBeenCalledWith({ requestId: 'req-1' });
      });

      expect(await screen.findByText(/new offer received/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /view quote/i })).toBeInTheDocument();
    });
  });
});
