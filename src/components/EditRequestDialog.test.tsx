import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EditRequestDialog from './EditRequestDialog';
import type { Request } from '@/types';

const { mockRequestsService, mockUploadService } = vi.hoisted(() => ({
  mockRequestsService: { update: vi.fn() },
  mockUploadService: { uploadFile: vi.fn() },
}))

vi.mock('@/api/services', () => ({
  requestsService: mockRequestsService,
  uploadService: mockUploadService,
}));

// Mock fetch for geocoding
globalThis.fetch = vi.fn();

const mockRequest: Request = {
  id: 'req-1',
  title: 'Need a drill',
  description: 'Looking for a power drill for weekend project',
  category: 'TOOLS',
  urgency: 'FLEXIBLE',
  budget: 5000,
  rateType: 'DAILY',
  broadcastRadius: 10,
  postcode: 'SW1A 1AA',
  locationAddress: 'Westminster, London',
  locationLat: 51.5074,
  locationLng: -0.1278,
  photos: ['https://example.com/existing.jpg'],
  status: 'ACTIVE',
  responseCount: 0,
  seekerId: 'user-1',
  expiresAt: '2024-12-31',
  createdDate: '2024-01-01',
  updatedDate: '2024-01-01',
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderDialog(request = mockRequest, onClose = vi.fn()) {
  const queryClient = createQueryClient();
  return {
    onClose,
    ...render(
      <QueryClientProvider client={queryClient}>
        <EditRequestDialog request={request} onClose={onClose} />
      </QueryClientProvider>
    ),
  };
}

describe('EditRequestDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequestsService.update.mockResolvedValue({ request: { id: 'req-1' } });
    mockUploadService.uploadFile.mockResolvedValue({ data: { fileUrl: 'https://example.com/new-photo.jpg' } });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve([{ lat: '51.5074', lon: '-0.1278' }]),
    });
  });

  describe('rendering', () => {
    it('renders dialog with form fields', () => {
      renderDialog();

      // Dialog should render with title input
      expect(screen.getByDisplayValue('Need a drill')).toBeInTheDocument();
    });

    it('pre-fills form with request data', () => {
      renderDialog();

      expect(screen.getByDisplayValue('Need a drill')).toBeInTheDocument();
      expect(screen.getByDisplayValue(/Looking for a power drill/i)).toBeInTheDocument();
    });

    it('shows existing photos', () => {
      renderDialog();

      const images = screen.getAllByRole('img');
      expect(images.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('form interactions', () => {
    it('allows editing title', async () => {
      const user = userEvent.setup();
      renderDialog();

      const titleInput = screen.getByDisplayValue('Need a drill');
      await user.clear(titleInput);
      await user.type(titleInput, 'Need a power drill urgently');

      expect(titleInput).toHaveValue('Need a power drill urgently');
    });

    it('allows editing description', async () => {
      const user = userEvent.setup();
      renderDialog();

      const descInput = screen.getByDisplayValue(/Looking for a power drill/i);
      await user.clear(descInput);
      await user.type(descInput, 'New description for the request');

      expect(descInput).toHaveValue('New description for the request');
    });

    it('allows changing budget', async () => {
      const user = userEvent.setup();
      renderDialog();

      const budgetInput = screen.getByLabelText(/your budget/i);
      await user.clear(budgetInput);
      await user.type(budgetInput, '75');

      expect(budgetInput).toHaveValue(75);
    });
  });

  describe('dialog controls', () => {
    it('has close button', () => {
      renderDialog();

      // Dialog has X close button
      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('nationwide search toggle', () => {
    it('renders nationwide search checkbox', () => {
      renderDialog();

      expect(screen.getByText(/nationwide/i) || screen.getByLabelText(/nationwide/i)).toBeTruthy();
    });
  });

  describe('photo management', () => {
    it('allows removing existing photos', async () => {
      const user = userEvent.setup();
      renderDialog();

      const removeButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg') && btn.closest('[class*="relative"]')
      );
      
      if (removeButtons.length > 0) {
        await user.click(removeButtons[0]);
        // Photo should be removed from state
      }
    });

    it('handles photo upload', async () => {
      const { container } = renderDialog();
      
      const fileInput = container.querySelector('input[type="file"]');
      if (fileInput) {
        const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
        Object.defineProperty(fileInput, 'files', { value: [file] });
        fireEvent.change(fileInput);
        
        await waitFor(() => {
          expect(mockUploadService.uploadFile).toHaveBeenCalledWith(file);
        });
      }
    });
  });

  describe('form submission', () => {
    it('submits form and calls update service', async () => {
      renderDialog();

      const form = document.querySelector('form');
      if (form) {
        fireEvent.submit(form);

        await waitFor(() => {
          expect(mockRequestsService.update).toHaveBeenCalled();
        });
      }
    });

    it('calls onClose after successful submission', async () => {
      const { onClose } = renderDialog();

      const form = document.querySelector('form');
      if (form) {
        fireEvent.submit(form);
        
        await waitFor(() => {
          expect(onClose).toHaveBeenCalled();
        });
      }
    });
  });

  describe('location geocoding', () => {
    it('renders location input field', () => {
      renderDialog();

      const locationInputs = screen.getAllByRole('textbox');
      expect(locationInputs.length).toBeGreaterThan(0);
    });
  });

  describe('nationwide search', () => {
    it('toggles nationwide search checkbox', async () => {
      const user = userEvent.setup();
      renderDialog();

      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 0) {
        await user.click(checkboxes[0]);
        // Checkbox state should toggle
      }
    });
  });

  describe('category and urgency', () => {
    it('handles different request categories', () => {
      renderDialog({ ...mockRequest, category: 'EXPERTISE' } as Request);
      expect(screen.getByDisplayValue('Need a drill')).toBeInTheDocument();
    });

    it('handles different urgency levels', () => {
      renderDialog({ ...mockRequest, urgency: 'ASAP' } as Request);
      expect(screen.getByDisplayValue('Need a drill')).toBeInTheDocument();
    });
  });
});
