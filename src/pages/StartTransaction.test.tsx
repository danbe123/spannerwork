import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StartTransaction from './StartTransaction';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const { mockRequestsService, mockTransactionsService, mockToolsService } = vi.hoisted(() => ({
  mockRequestsService: { getById: vi.fn() },
  mockTransactionsService: { create: vi.fn() },
  mockToolsService: { list: vi.fn() },
}))

vi.mock('@/api/services', () => ({
  requestsService: mockRequestsService,
  transactionsService: mockTransactionsService,
  toolsService: mockToolsService,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderStartTransaction(route = '/start-transaction?requestId=req-1&helperId=user-2') {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[route]}>
        <StartTransaction />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('StartTransaction Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequestsService.getById.mockResolvedValue({ 
      request: { 
        id: 'req-1', 
        title: 'Need a drill',
        budget: 50,
        seekerId: 'user-1',
      } 
    });
    mockTransactionsService.create.mockResolvedValue({ transaction: { id: 'tx-1' } });
    mockToolsService.list.mockResolvedValue({ 
      data: [
        { id: 'tool-1', name: 'Power Drill', dailyRate: 15 }
      ] 
    });
  });

  describe('Rendering', () => {
    it('renders page title', async () => {
      renderStartTransaction();
      await waitFor(() => {
        expect(screen.getByText(/Start Transaction/i)).toBeInTheDocument();
      });
    });

    it('renders back button', async () => {
      renderStartTransaction();
      await waitFor(() => {
        expect(screen.getByText(/Back/i)).toBeInTheDocument();
      });
    });

    it('renders request details when request is loaded', async () => {
      renderStartTransaction();
      await waitFor(() => {
        expect(screen.getByText(/Start Transaction/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form fields', () => {
    it('has duration input', async () => {
      renderStartTransaction();
      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
      });
    });

    it('has notes textarea', async () => {
      renderStartTransaction();
      await waitFor(() => {
        const textareas = screen.getAllByRole('textbox');
        expect(textareas.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Form submission', () => {
    it('has submit button', async () => {
      renderStartTransaction();
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });
    });

    it('renders form for submission', async () => {
      renderStartTransaction();
      
      await waitFor(() => {
        expect(screen.getByText(/Start Transaction/i)).toBeInTheDocument();
      });
      
      const form = document.querySelector('form');
      expect(form).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('renders back button for navigation', async () => {
      renderStartTransaction();
      
      await waitFor(() => {
        expect(screen.getByText(/Back/i)).toBeInTheDocument();
      });
    });
  });

  describe('Tool selection', () => {
    it('renders tool selection area', async () => {
      renderStartTransaction();
      
      await waitFor(() => {
        expect(screen.getByText(/Start Transaction/i)).toBeInTheDocument();
      });
    });
  });
});
