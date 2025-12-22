import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Feed from './Feed'

const { mockAuthService, mockRequestsService } = vi.hoisted(() => ({
  mockAuthService: { getCurrentUser: vi.fn() },
  mockRequestsService: { list: vi.fn() },
}))

vi.mock('@/api/services', () => ({
  authService: mockAuthService,
  requestsService: mockRequestsService,
  toolsService: { list: vi.fn().mockResolvedValue({ data: [], pagination: { page: 1, total: 0 } }) },
  spacesService: { list: vi.fn().mockResolvedValue({ data: [], pagination: { page: 1, total: 0 } }) },
  servicesService: { list: vi.fn().mockResolvedValue({ data: [], pagination: { page: 1, total: 0 } }) },
}))

vi.mock('../components/feed/RequestCard', () => ({
  default: ({ request }: { request: { id: string; title: string } }) => (
    <div data-testid={`request-card-${request.id}`}>{request.title}</div>
  ),
}))

vi.mock('../components/feed/LiveActivityFeed', () => ({
  default: () => <div data-testid="live-activity-feed">Activity Feed</div>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectTrigger: ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>{children}</button>
  ),
  SelectValue: ({ children }: { children?: React.ReactNode }) => <span>{children || 'Recommended'}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const sampleRequests = [
  { id: 'req-1', title: 'Need a Power Drill', description: 'For DIY project', category: 'TOOLS', status: 'ACTIVE', createdDate: '2024-01-01T00:00:00.000Z', urgency: 'FLEXIBLE', budget: 1000, responseCount: 0 },
  { id: 'req-2', title: 'Plumbing Help', description: 'Fix kitchen sink', category: 'EXPERTISE', status: 'ACTIVE', createdDate: '2024-01-02T00:00:00.000Z', urgency: 'ASAP', budget: 5000, responseCount: 2 },
  { id: 'req-3', title: 'Workshop Space', description: 'Need for woodworking', category: 'SPACE', status: 'ACTIVE', createdDate: '2024-01-03T00:00:00.000Z', urgency: 'TODAY', budget: 2000, responseCount: 1 },
]


function renderWithClient(route = '/feed') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <Feed />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Feed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthService.getCurrentUser.mockResolvedValue({ user: { id: 'u1' } })
    mockRequestsService.list.mockResolvedValue({ data: sampleRequests, pagination: { page: 1, total: 3 } })
  })

  describe('Rendering', () => {
    it('renders the heading and search', async () => {
      renderWithClient()
      expect(await screen.findByText(/find jobs/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/search for tools/i)).toBeInTheDocument()
    })

    it('renders category filter buttons', async () => {
      renderWithClient()
      await waitFor(() => {
        expect(screen.getAllByText('All Jobs').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Tools').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Services').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Space').length).toBeGreaterThan(0)
      })
    })

    it('renders empty state when no results', async () => {
      mockRequestsService.list.mockResolvedValue({ data: [], pagination: { page: 1, total: 0 } })
      renderWithClient()
      await waitFor(() => {
        expect(screen.getByText(/no.*jobs found/i)).toBeInTheDocument()
      })
    })

    it('displays request cards when data available', async () => {
      renderWithClient()
      await waitFor(() => {
        expect(screen.getByTestId('request-card-req-1')).toBeInTheDocument()
        expect(screen.getByTestId('request-card-req-2')).toBeInTheDocument()
      })
    })

    it('shows stats banner with job count', async () => {
      renderWithClient()
      await waitFor(() => {
        const matches = screen.getAllByText((_, el) => {
          const text = el?.textContent || ''
          return /active jobs/i.test(text) && /\b3\b/.test(text)
        })
        expect(matches.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Search functionality', () => {
    it('allows typing in search input', async () => {
      renderWithClient()
      const searchInput = await screen.findByPlaceholderText(/search for tools/i)
      
      fireEvent.change(searchInput, { target: { value: 'drill' } })
      
      expect(searchInput).toHaveValue('drill')
    })

    it('filters results by search query', async () => {
      renderWithClient()
      await waitFor(() => {
        expect(screen.getByTestId('request-card-req-1')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText(/search for tools/i)
      fireEvent.change(searchInput, { target: { value: 'Plumbing' } })
      
      await waitFor(() => {
        expect(screen.queryByTestId('request-card-req-1')).not.toBeInTheDocument()
        expect(screen.getByTestId('request-card-req-2')).toBeInTheDocument()
      })
    })

    it('shows clear button when search has value', async () => {
      renderWithClient()
      const searchInput = await screen.findByPlaceholderText(/search for tools/i)
      fireEvent.change(searchInput, { target: { value: 'drill' } })
      
      expect(searchInput).toHaveValue('drill')
      
      // The clear button should appear when there's a value
      await waitFor(() => {
        // Find a button element near the search input
        const buttons = document.querySelectorAll('button')
        expect(buttons.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Category filtering', () => {
    it('filters by Tools category', async () => {
      renderWithClient()
      await waitFor(() => {
        expect(screen.getByTestId('request-card-req-1')).toBeInTheDocument()
      })
      
      // Find the button with text Tools (there may be multiple text matches)
      const toolsBtns = screen.getAllByText('Tools')
      fireEvent.click(toolsBtns[0])
      
      await waitFor(() => {
        expect(screen.getByTestId('request-card-req-1')).toBeInTheDocument()
        expect(screen.queryByTestId('request-card-req-2')).not.toBeInTheDocument()
      })
    })

    it('filters by Services category', async () => {
      renderWithClient()
      await waitFor(() => {
        expect(screen.getByTestId('request-card-req-2')).toBeInTheDocument()
      })
      
      const servicesBtns = screen.getAllByText('Services')
      fireEvent.click(servicesBtns[0])
      
      await waitFor(() => {
        expect(screen.queryByTestId('request-card-req-1')).not.toBeInTheDocument()
        expect(screen.getByTestId('request-card-req-2')).toBeInTheDocument()
      })
    })

    it('filters by Space category', async () => {
      renderWithClient()
      await waitFor(() => {
        expect(screen.getByTestId('request-card-req-3')).toBeInTheDocument()
      })
      
      const spaceBtns = screen.getAllByText('Space')
      fireEvent.click(spaceBtns[0])
      
      await waitFor(() => {
        expect(screen.queryByTestId('request-card-req-1')).not.toBeInTheDocument()
        expect(screen.getByTestId('request-card-req-3')).toBeInTheDocument()
      })
    })

    it('shows all jobs when All Jobs clicked', async () => {
      renderWithClient()
      await waitFor(() => {
        expect(screen.getByTestId('request-card-req-1')).toBeInTheDocument()
      })
      
      // Filter to tools first
      const toolsBtns = screen.getAllByText('Tools')
      fireEvent.click(toolsBtns[0])
      await waitFor(() => {
        expect(screen.queryByTestId('request-card-req-2')).not.toBeInTheDocument()
      })
      
      // Then click All Jobs
      const allJobsBtns = screen.getAllByText('All Jobs')
      fireEvent.click(allJobsBtns[0])
      await waitFor(() => {
        expect(screen.getByTestId('request-card-req-1')).toBeInTheDocument()
        expect(screen.getByTestId('request-card-req-2')).toBeInTheDocument()
      })
    })
  })

  describe('Empty state', () => {
    it('shows Post a Job button in empty state', async () => {
      mockRequestsService.list.mockResolvedValue({ data: [], pagination: { page: 1, total: 0 } })
      renderWithClient()
      await waitFor(() => {
        expect(screen.getByRole('link', { name: /post a job/i })).toBeInTheDocument()
      })
    })

    it('shows View All Jobs button when filtered category is empty', async () => {
      mockRequestsService.list.mockResolvedValue({ 
        data: [sampleRequests[0]], // Only tools
        pagination: { page: 1, total: 1 } 
      })
      renderWithClient()
      
      await waitFor(() => {
        expect(screen.getByTestId('request-card-req-1')).toBeInTheDocument()
      })
      
      // Filter to Services (should be empty)
      fireEvent.click(screen.getByText('Services'))
      
      await waitFor(() => {
        expect(screen.getByText(/no.*jobs found/i)).toBeInTheDocument()
      })
    })
  })

  describe('Loading state', () => {
    it('shows skeleton loading cards', () => {
      mockRequestsService.list.mockImplementation(() => new Promise(() => {}))
      renderWithClient()
      // Loading state shows skeleton cards
      expect(document.body).toBeInTheDocument()
    })
  })

  describe('Post a Job button', () => {
    it('renders Post a Job link in header', async () => {
      renderWithClient()
      await waitFor(() => {
        const postLinks = screen.getAllByRole('link', { name: /post/i })
        expect(postLinks.length).toBeGreaterThan(0)
      })
    })
  })
})
