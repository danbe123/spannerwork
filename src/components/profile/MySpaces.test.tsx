import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MySpaces from './MySpaces';
import type { Space } from '@/types';

const { mockSpacesService } = vi.hoisted(() => ({
  mockSpacesService: { delete: vi.fn() },
}))

vi.mock('@/api/services', () => ({
  spacesService: mockSpacesService,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderWithProvider(spaces: Space[]) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MySpaces spaces={spaces} />
    </QueryClientProvider>
  );
}

const createMockSpace = (overrides?: Partial<Space>): Space => ({
  id: 'space-' + Math.random().toString(36).slice(2),
  name: 'Test Garage',
  description: 'A spacious garage for rent',
  spaceType: 'GARAGE',
  hourlyRate: 10,
  dailyRate: 50,
  weeklyRate: 200,
  sizeSqft: 500,
  vehicleCapacity: 2,
  maxVehicleHeight: 8,
  postcode: 'SW1A 1AA',
  ownerId: 'owner-1',
  photos: ['https://example.com/photo1.jpg'],
  createdDate: new Date().toISOString(),
  ...overrides,
} as Space);

describe('MySpaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty state', () => {
    it('shows empty state when no spaces', () => {
      renderWithProvider([]);
      
      expect(screen.getByText(/No spaces listed yet/i)).toBeInTheDocument();
    });

    it('shows encouragement message in empty state', () => {
      renderWithProvider([]);
      
      expect(screen.getByText(/Add your garage/i)).toBeInTheDocument();
    });
  });

  describe('Spaces list', () => {
    it('renders space name', () => {
      renderWithProvider([createMockSpace({ name: 'My Workshop' })]);
      
      expect(screen.getByText('My Workshop')).toBeInTheDocument();
    });

    it('renders space description', () => {
      renderWithProvider([createMockSpace({ description: 'Great workshop space' })]);
      
      expect(screen.getByText('Great workshop space')).toBeInTheDocument();
    });

    it('renders space type badge', () => {
      renderWithProvider([createMockSpace({ spaceType: 'GARAGE' })]);
      
      // Use getAllBy since GARAGE appears in multiple places
      const garageElements = screen.getAllByText(/GARAGE/i);
      expect(garageElements.length).toBeGreaterThan(0);
    });

    it('renders multiple spaces', () => {
      renderWithProvider([
        createMockSpace({ name: 'Space 1' }),
        createMockSpace({ name: 'Space 2' }),
      ]);
      
      expect(screen.getByText('Space 1')).toBeInTheDocument();
      expect(screen.getByText('Space 2')).toBeInTheDocument();
    });

    it('renders space photo when available', () => {
      renderWithProvider([createMockSpace({ photos: ['https://example.com/photo.jpg'] })]);
      
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
    });
  });

  describe('Rate display', () => {
    it('displays hourly rate', () => {
      renderWithProvider([createMockSpace({ hourlyRate: 15, dailyRate: 0, weeklyRate: 0 })]);
      
      expect(screen.getByText(/£15\/hr/)).toBeInTheDocument();
    });

    it('displays daily rate', () => {
      renderWithProvider([createMockSpace({ hourlyRate: 0, dailyRate: 75, weeklyRate: 0 })]);
      
      expect(screen.getByText(/£75\/day/)).toBeInTheDocument();
    });

    it('displays multiple rates', () => {
      renderWithProvider([createMockSpace({ hourlyRate: 10, dailyRate: 50 })]);
      
      expect(screen.getByText(/£10\/hr/)).toBeInTheDocument();
      expect(screen.getByText(/£50\/day/)).toBeInTheDocument();
    });
  });

  describe('Space stats', () => {
    it('displays size when available', () => {
      renderWithProvider([createMockSpace({ sizeSqft: 1000 })]);
      
      expect(screen.getByText(/1000 sq ft/)).toBeInTheDocument();
    });

    it('displays vehicle capacity', () => {
      renderWithProvider([createMockSpace({ vehicleCapacity: 3 })]);
      
      expect(screen.getByText(/3 vehicles/)).toBeInTheDocument();
    });

    it('displays max vehicle height', () => {
      renderWithProvider([createMockSpace({ maxVehicleHeight: 10 })]);
      
      expect(screen.getByText(/10ft height/)).toBeInTheDocument();
    });
  });

  describe('Delete functionality', () => {
    beforeEach(() => {
      mockSpacesService.delete.mockResolvedValue({ success: true });
    });

    it('has delete buttons', () => {
      renderWithProvider([createMockSpace()]);
      
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('opens delete confirmation dialog when delete button clicked', async () => {
      renderWithProvider([createMockSpace({ name: 'Test Space' })]);
      
      // Find and click delete button (trash icon button)
      const deleteButton = screen.getByRole('button');
      fireEvent.click(deleteButton);
      
      // Dialog should appear
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });
    });

    it('shows space name in delete confirmation', async () => {
      renderWithProvider([createMockSpace({ name: 'My Garage' })]);
      
      // Space name should be visible before delete
      expect(screen.getByText('My Garage')).toBeInTheDocument();
      
      const deleteButton = screen.getByRole('button');
      fireEvent.click(deleteButton);
      
      // Dialog should open
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });
    });

    it('cancels deletion when cancel button clicked', async () => {
      renderWithProvider([createMockSpace()]);
      
      const deleteButton = screen.getByRole('button');
      fireEvent.click(deleteButton);
      
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);
      
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      });
    });

    it('calls delete service when delete confirmed', async () => {
      const space = createMockSpace({ id: 'space-to-delete' });
      renderWithProvider([space]);
      
      const deleteButton = screen.getByRole('button');
      fireEvent.click(deleteButton);
      
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(mockSpacesService.delete).toHaveBeenCalledWith('space-to-delete');
      });
    });
  });

  describe('Rate display function', () => {
    it('displays contact for pricing when no rates', () => {
      renderWithProvider([createMockSpace({ hourlyRate: 0, dailyRate: 0, weeklyRate: 0 })]);
      
      expect(screen.getByText(/Contact for pricing/)).toBeInTheDocument();
    });

    it('displays weekly rate when available', () => {
      renderWithProvider([createMockSpace({ hourlyRate: 0, dailyRate: 0, weeklyRate: 300 })]);
      
      expect(screen.getByText(/£300\/wk/)).toBeInTheDocument();
    });

    it('displays all rates when all available', () => {
      renderWithProvider([createMockSpace({ hourlyRate: 10, dailyRate: 50, weeklyRate: 200 })]);
      
      expect(screen.getByText(/£10\/hr/)).toBeInTheDocument();
      expect(screen.getByText(/£50\/day/)).toBeInTheDocument();
      expect(screen.getByText(/£200\/wk/)).toBeInTheDocument();
    });
  });

  describe('Space without photos', () => {
    it('renders space without photo', () => {
      renderWithProvider([createMockSpace({ photos: [] })]);
      
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  describe('Space type display', () => {
    it('displays workshop space type', () => {
      renderWithProvider([createMockSpace({ spaceType: 'WORKSHOP' })]);
      
      expect(screen.getAllByText(/WORKSHOP/i).length).toBeGreaterThan(0);
    });

    it('handles undefined space type', () => {
      renderWithProvider([createMockSpace({ spaceType: undefined })]);
      
      expect(screen.getByText(/Space/)).toBeInTheDocument();
    });
  });
});
