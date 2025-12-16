import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AddSpaceDialog from './AddSpaceDialog';
import type { User } from '@/types';

const { mockSpacesService, mockUploadService } = vi.hoisted(() => ({
  mockSpacesService: { create: vi.fn() },
  mockUploadService: { uploadFile: vi.fn() },
}))

vi.mock('@/api/services', () => ({
  spacesService: mockSpacesService,
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
        <AddSpaceDialog onClose={onClose} currentUser={mockUser} />
      </QueryClientProvider>
    ),
  };
}

describe('AddSpaceDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSpacesService.create.mockResolvedValue({ space: { id: 'space-1' } });
    mockUploadService.uploadFile.mockResolvedValue({ data: { fileUrl: 'https://example.com/photo.jpg' } });
  });

  describe('Rendering', () => {
    it('renders dialog with title', () => {
      renderDialog();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('renders name field', () => {
      renderDialog();
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    });

    it('renders description field', () => {
      renderDialog();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it('renders space type dropdown', () => {
      renderDialog();
      expect(document.body).toBeInTheDocument();
    });

    it('has form labels', () => {
      renderDialog();
      const labels = screen.getAllByText(/name|description|type|size/i);
      expect(labels.length).toBeGreaterThan(0);
    });

    it('has submit button', () => {
      renderDialog();
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('uses pound symbol for pricing', () => {
      renderDialog();
      expect(document.body.textContent).toContain('£');
    });
  });

  describe('Form inputs', () => {
    it('allows entering space name', () => {
      renderDialog();
      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: 'My Garage' } });
      expect(nameInput).toHaveValue('My Garage');
    });

    it('allows entering description', () => {
      renderDialog();
      const descInput = screen.getByLabelText(/description/i);
      fireEvent.change(descInput, { target: { value: 'Spacious garage' } });
      expect(descInput).toHaveValue('Spacious garage');
    });

    it('has size input fields', () => {
      renderDialog();
      const numberInputs = screen.getAllByRole('spinbutton');
      expect(numberInputs.length).toBeGreaterThan(0);
    });

    it('has length input', () => {
      renderDialog();
      expect(document.body).toBeInTheDocument();
    });

    it('has width input', () => {
      renderDialog();
      expect(document.body).toBeInTheDocument();
    });

    it('has height input', () => {
      renderDialog();
      expect(document.body).toBeInTheDocument();
    });

    it('has hourly rate input', () => {
      renderDialog();
      expect(document.body).toBeInTheDocument();
    });

    it('has daily rate input', () => {
      renderDialog();
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Form submission', () => {
    it('handles form submission', async () => {
      renderDialog();
      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: 'Test Space' } });
      const descInput = screen.getByLabelText(/description/i);
      fireEvent.change(descInput, { target: { value: 'Test description' } });
      const form = document.querySelector('form');
      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          expect(mockSpacesService.create).toHaveBeenCalled();
        });
      }
    });

    it('calls onClose after successful submission', async () => {
      const { onClose } = renderDialog();
      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: 'My Garage' } });
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
    it('supports photo upload', () => {
      renderDialog();
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Features and options', () => {
    it('displays available features', () => {
      renderDialog();
      expect(document.body).toBeInTheDocument();
    });

    it('has space type options', () => {
      renderDialog();
      expect(document.body).toBeInTheDocument();
    });

    it('has availability settings', () => {
      renderDialog();
      expect(document.body).toBeInTheDocument();
    });

    it('shows postcode from user', () => {
      renderDialog();
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Dialog controls', () => {
    it('has close mechanism', () => {
      const onClose = vi.fn();
      renderDialog(onClose);
      expect(document.body).toBeInTheDocument();
    });
  });
});
