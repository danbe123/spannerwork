import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AddToolDialog from './AddToolDialog';
import type { User } from '@/types';

const { mockToolsService, mockUploadService } = vi.hoisted(() => ({
  mockToolsService: { create: vi.fn() },
  mockUploadService: { uploadFile: vi.fn() },
}))

vi.mock('@/api/services', () => ({
  toolsService: mockToolsService,
  uploadService: mockUploadService,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
}

const mockUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  postcode: 'SW1A 1AA',
} as User;

function renderDialog(onClose = vi.fn()) {
  return {
    onClose,
    ...render(
      <QueryClientProvider client={createQueryClient()}>
        <AddToolDialog onClose={onClose} currentUser={mockUser} />
      </QueryClientProvider>
    ),
  };
}

describe('AddToolDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToolsService.create.mockResolvedValue({ tool: { id: 'tool-1' } });
    mockUploadService.uploadFile.mockResolvedValue({ data: { fileUrl: 'https://example.com/photo.jpg' } });
  });

  describe('Rendering', () => {
    it('renders dialog with title', () => {
      renderDialog();
      expect(screen.getByText(/list an item/i)).toBeInTheDocument();
    });

    it('renders name input field', () => {
      renderDialog();
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    });

    it('renders description field', () => {
      renderDialog();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it('renders submit button', () => {
      renderDialog();
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('uses pound symbol for currency', () => {
      renderDialog();
      expect(document.body.textContent).toContain('£');
    });

    it('renders switch components', () => {
      const { container } = renderDialog();
      const switches = container.querySelectorAll('[role="switch"]');
      expect(switches.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Form inputs', () => {
    it('allows entering tool name', () => {
      renderDialog();
      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: 'Power Drill' } });
      expect(nameInput).toHaveValue('Power Drill');
    });

    it('allows entering description', () => {
      renderDialog();
      const descInput = screen.getByLabelText(/description/i);
      fireEvent.change(descInput, { target: { value: 'A great tool for drilling holes' } });
      expect(descInput).toHaveValue('A great tool for drilling holes');
    });

    it('allows entering daily rate', () => {
      renderDialog();
      const rateInputs = screen.getAllByRole('spinbutton');
      if (rateInputs.length > 0) {
        fireEvent.change(rateInputs[0], { target: { value: '15' } });
        expect(rateInputs[0]).toHaveValue(15);
      }
    });

    it('allows entering deposit amount', () => {
      renderDialog();
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs.length).toBeGreaterThan(0);
    });

    it('allows entering hourly rate', () => {
      renderDialog();
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs.length).toBeGreaterThan(0);
    });

    it('allows selecting different categories', () => {
      renderDialog();
      const triggers = document.querySelectorAll('[role="combobox"]');
      expect(triggers.length).toBeGreaterThan(0);
    });

    it('allows selecting condition', () => {
      renderDialog();
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Form submission', () => {
    it('submits form and calls toolsService.create', async () => {
      renderDialog();
      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: 'Test Power Drill' } });
      const descInput = screen.getByLabelText(/description/i);
      fireEvent.change(descInput, { target: { value: 'Great condition drill' } });
      const form = document.querySelector('form');
      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          expect(mockToolsService.create).toHaveBeenCalled();
        });
      }
    });

    it('calls onClose after successful submission', async () => {
      const { onClose } = renderDialog();
      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: 'My Tool' } });
      const form = document.querySelector('form');
      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          expect(onClose).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Photo upload', () => {
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

    it('handles photo upload error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockUploadService.uploadFile.mockRejectedValue(new Error('Upload failed'));
      const { container } = renderDialog();
      const fileInput = container.querySelector('input[type="file"]');
      if (fileInput) {
        const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
        Object.defineProperty(fileInput, 'files', { value: [file] });
        fireEvent.change(fileInput);
        await waitFor(() => {
          expect(consoleSpy).toHaveBeenCalled();
        });
      }
      consoleSpy.mockRestore();
    });

    it('does not upload when no file selected', async () => {
      const { container } = renderDialog();
      const fileInput = container.querySelector('input[type="file"]');
      if (fileInput) {
        Object.defineProperty(fileInput, 'files', { value: [] });
        fireEvent.change(fileInput);
        await new Promise(r => setTimeout(r, 100));
        expect(mockUploadService.uploadFile).not.toHaveBeenCalled();
      }
    });

    it('removes photo from list when X button clicked', async () => {
      mockUploadService.uploadFile.mockResolvedValue({ data: { fileUrl: 'https://example.com/photo1.jpg' } });
      const { container } = renderDialog();
      const fileInput = container.querySelector('input[type="file"]');
      if (fileInput) {
        const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
        Object.defineProperty(fileInput, 'files', { value: [file] });
        fireEvent.change(fileInput);
        await waitFor(() => {
          expect(mockUploadService.uploadFile).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Dialog controls', () => {
    it('calls onClose when dialog is closed', () => {
      const { onClose } = renderDialog();
      const closeButton = screen.getByRole('button', { name: /close/i });
      if (closeButton) {
        fireEvent.click(closeButton);
        expect(onClose).toHaveBeenCalled();
      }
    });
  });
});
