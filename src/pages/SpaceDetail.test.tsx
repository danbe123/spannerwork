import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SpaceDetail from './SpaceDetail';

// Mock services
const mockGetSpaceById = vi.fn();
const mockGetUserById = vi.fn();
const mockGetCurrentUser = vi.fn();

vi.mock('@/api/services', () => ({
  spacesService: {
    getById: (id: string) => mockGetSpaceById(id),
  },
  usersService: {
    getById: (id: string) => mockGetUserById(id),
  },
  authService: {
    getCurrentUser: () => mockGetCurrentUser(),
  },
  reviewsService: {
    getForItem: vi.fn().mockResolvedValue({ reviews: [] }),
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

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

const mockSpace = {
  id: 'space-1',
  name: 'Workshop Space',
  description: 'A large workshop with power tools',
  hourlyRate: 15,
  dailyRate: 80,
  deposit: 100,
  photos: ['https://example.com/space.jpg', 'https://example.com/space2.jpg'],
  postcode: 'SW1A 1AA',
  sizeSqft: 100,
  vehicleCapacity: 2,
  maxVehicleHeight: 6,
  electricityAvailable: true,
  toolsAvailable: true,
  supervisionRequired: true,
  insuranceRequired: true,
  features: ['Power', 'WiFi', 'Parking'],
  available: true,
  ownerId: 'owner-1',
};

const mockOwner = {
  id: 'owner-1',
  name: 'Space Owner',
  email: 'owner@test.com',
  rating: 4.8,
  reviewCount: 25,
};

function setUrl(url: string) {
  window.history.pushState({}, '', url);
}

function renderSpaceDetail(url = '/space-detail?id=space-1') {
  setUrl(url);
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <SpaceDetail />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SpaceDetail Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGetSpaceById.mockResolvedValue({ space: mockSpace });
    mockGetUserById.mockResolvedValue({ user: mockOwner });
    mockGetCurrentUser.mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('shows missing-id state and navigates back to feed', async () => {
    const user = userEvent.setup();
    renderSpaceDetail('/space-detail');

    expect(await screen.findByText(/Missing Space ID/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /back to feed/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/feed');
  });

  it('renders details, fetches owner, and exposes contact link when visitor and available', async () => {
    renderSpaceDetail('/space-detail?id=space-1');

    expect(await screen.findByRole('heading', { level: 1, name: mockSpace.name })).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetSpaceById).toHaveBeenCalledWith('space-1');
      expect(mockGetUserById).toHaveBeenCalledWith('owner-1');
    });

    expect(screen.getByText(/Available Now/i)).toBeInTheDocument();
    expect(screen.getByText(/£15\/hr/i)).toBeInTheDocument();
    expect(screen.getByText(/£80\/day/i)).toBeInTheDocument();
    expect(screen.getByText(/£100 refundable deposit/i)).toBeInTheDocument();

    // Space Details conditional branches
    expect(screen.getByText(/100 square feet/i)).toBeInTheDocument();
    expect(screen.getByText(/Fits 2 vehicles/i)).toBeInTheDocument();
    expect(screen.getByText(/Max height: 6 feet/i)).toBeInTheDocument();
    expect(screen.getByText(/Electricity available/i)).toBeInTheDocument();
    expect(screen.getByText(/Basic tools provided/i)).toBeInTheDocument();
    expect(screen.getByText(/Owner supervision required/i)).toBeInTheDocument();
    expect(screen.getByText(/Insurance required/i)).toBeInTheDocument();

    // Features
    expect(screen.getByText(/Features & Amenities/i)).toBeInTheDocument();
    expect(screen.getByText(/WiFi/i)).toBeInTheDocument();

    const contactLink = screen.getByRole('link', { name: /contact owner/i });
    expect(contactLink).toHaveAttribute('href', '/chat?userId=owner-1');
  });

  it('hides contact CTA and shows owner message when viewing own space', async () => {
    mockGetCurrentUser.mockResolvedValue({ user: { id: 'owner-1' } });
    renderSpaceDetail('/space-detail?id=space-1');

    expect(await screen.findByRole('heading', { level: 1, name: mockSpace.name })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /contact owner/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Your Listing:/i)).toBeInTheDocument();
  });

  it('does not show contact CTA when space is unavailable', async () => {
    mockGetSpaceById.mockResolvedValue({ space: { ...mockSpace, available: false } });
    renderSpaceDetail('/space-detail?id=space-1');

    expect(await screen.findByRole('heading', { level: 1, name: mockSpace.name })).toBeInTheDocument();
    expect(screen.getByText(/Currently Booked/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /contact owner/i })).not.toBeInTheDocument();
  });

  it('shows "Contact for pricing" when hourlyRate and dailyRate are zero', async () => {
    mockGetSpaceById.mockResolvedValue({ space: { ...mockSpace, hourlyRate: 0, dailyRate: 0 } });
    renderSpaceDetail('/space-detail?id=space-1');

    expect(await screen.findByRole('heading', { level: 1, name: mockSpace.name })).toBeInTheDocument();
    expect(screen.getByText(/Contact for pricing/i)).toBeInTheDocument();
  });

  it('shows not-found state and navigates back to feed', async () => {
    const user = userEvent.setup();
    mockGetSpaceById.mockResolvedValue({ space: undefined });

    renderSpaceDetail('/space-detail?id=missing');
    expect(await screen.findByText(/Space Not Found/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /back to feed/i }));
    expect(mockNavigate).toHaveBeenCalled();
  });
});
