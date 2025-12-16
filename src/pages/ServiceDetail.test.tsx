import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ServiceDetail from './ServiceDetail';

// Mock services
const mockGetServiceById = vi.fn();
const mockGetUserById = vi.fn();
const mockGetCurrentUser = vi.fn();

vi.mock('@/api/services', () => ({
  servicesService: {
    getById: (id: string) => mockGetServiceById(id),
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

const mockService = {
  id: 'service-1',
  title: 'Plumbing Services',
  description: 'Professional plumbing and heating services',
  category: 'PLUMBING',
  hourlyRate: 45,
  photos: ['https://example.com/service.jpg'],
  postcode: 'SW1A 1AA',
  mobileService: true,
  responseTime: '1_HOUR',
  yearsExperience: 10,
  serviceRadius: 15,
  calloutFee: 20,
  weekendAvailability: true,
  eveningAvailability: false,
  emergencyCallout: true,
  offersFreeQuote: true,
  certifications: ['City & Guilds'],
  hasInsurance: true,
  available: true,
  providerId: 'provider-1',
};

const mockProvider = {
  id: 'provider-1',
  name: 'Service Provider',
  email: 'provider@test.com',
  rating: 4.9,
  reviewCount: 50,
};

function setUrl(url: string) {
  window.history.pushState({}, '', url);
}

function renderServiceDetail(url = '/service-detail?id=service-1') {
  setUrl(url);
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <ServiceDetail />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ServiceDetail Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGetServiceById.mockResolvedValue({ service: mockService });
    mockGetUserById.mockResolvedValue({ user: mockProvider });
    mockGetCurrentUser.mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('shows missing-id state and navigates back to feed', async () => {
    const user = userEvent.setup();
    renderServiceDetail('/service-detail');

    expect(await screen.findByText(/Missing Service ID/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /back to feed/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/feed');
  });

  it('renders details, fetches provider, and exposes contact link when visitor and available', async () => {
    renderServiceDetail('/service-detail?id=service-1');

    expect(await screen.findByRole('heading', { level: 1, name: mockService.title })).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetServiceById).toHaveBeenCalledWith('service-1');
      expect(mockGetUserById).toHaveBeenCalledWith('provider-1');
    });

    expect(screen.getByText(/About This Service/i)).toBeInTheDocument();
    expect(screen.getByText(mockService.description)).toBeInTheDocument();

    // Branch coverage: badges + credentials
    expect(screen.getByText(/Mobile Service/i)).toBeInTheDocument();
    expect(screen.getByText(/1 HOUR/i)).toBeInTheDocument();
    expect(screen.getByText(/Call-out Fee/i)).toBeInTheDocument();
    expect(screen.getByText(/£20/i)).toBeInTheDocument();
    expect(screen.getByText(/Available 24\/7/i)).toBeInTheDocument();
    expect(screen.getByText(/Public Liability Insurance/i)).toBeInTheDocument();

    const contactLink = screen.getByRole('link', { name: /contact service provider/i });
    expect(contactLink).toHaveAttribute('href', '/chat?userId=provider-1');
  });

  it('hides contact CTA and shows owner message when viewing own service', async () => {
    mockGetCurrentUser.mockResolvedValue({ user: { id: 'provider-1' } });
    renderServiceDetail('/service-detail?id=service-1');

    expect(await screen.findByRole('heading', { level: 1, name: mockService.title })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /contact service provider/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Your Service:/i)).toBeInTheDocument();
  });

  it('does not show contact CTA when service is unavailable', async () => {
    mockGetServiceById.mockResolvedValue({ service: { ...mockService, available: false } });
    renderServiceDetail('/service-detail?id=service-1');

    expect(await screen.findByRole('heading', { level: 1, name: mockService.title })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /contact service provider/i })).not.toBeInTheDocument();
  });

  it('shows not-found state and navigates back to feed', async () => {
    const user = userEvent.setup();
    mockGetServiceById.mockResolvedValue({ service: undefined });

    renderServiceDetail('/service-detail?id=missing');
    expect(await screen.findByText(/Service Not Found/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /back to feed/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/feed');
  });

  it('shows "By Quote" when hourlyRate is missing', async () => {
    mockGetServiceById.mockResolvedValue({ service: { ...mockService, hourlyRate: undefined } });
    renderServiceDetail('/service-detail?id=service-1');

    expect(await screen.findByRole('heading', { level: 1, name: mockService.title })).toBeInTheDocument();
    expect(screen.getByText(/By Quote/i)).toBeInTheDocument();
  });
});
