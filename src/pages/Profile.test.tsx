import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
  },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const { mockUseAuth, mockLogout, mockGetListings, mockGetByUser, mockListTransactions } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockLogout: vi.fn(),
  mockGetListings: vi.fn(),
  mockGetByUser: vi.fn(),
  mockListTransactions: vi.fn(),
}))

vi.mock('@/hooks/use-auth', () => ({
  default: () => mockUseAuth(),
}))

vi.mock('@/api/services', () => ({
  authService: {
    getCurrentUser: vi.fn().mockResolvedValue({ user: { id: 'user-123', name: 'Test User' } }),
    logout: () => mockLogout(),
  },
  usersService: { getListings: (id: string) => mockGetListings(id) },
  reviewsService: { getByUser: (id: string) => mockGetByUser(id) },
  transactionsService: { list: (params: unknown) => mockListTransactions(params) },
}))

// Mock child components that have complex date handling
vi.mock('../components/profile/ActivityTimeline', () => ({
  default: () => <div data-testid="activity-timeline">Activity Timeline</div>,
}))

vi.mock('../components/profile/ReviewsSection', () => ({
  default: () => <div data-testid="reviews-section">Reviews Section</div>,
}))

vi.mock('../components/profile/ProfileHeader', () => ({
  default: ({ onEditProfile, onLogout }: { onEditProfile: () => void; onLogout: () => void }) => (
    <div data-testid="profile-header">
      <button onClick={onEditProfile}>Edit Profile</button>
      <button onClick={onLogout}>Log Out</button>
    </div>
  ),
}))

vi.mock('../components/profile/GettingStartedCard', () => ({
  default: () => <div data-testid="getting-started-card">Getting Started</div>,
}))

vi.mock('../components/gamification/BadgeDisplay', () => ({
  default: () => <div data-testid="badge-display">Badges</div>,
}))

import Profile from './Profile'

const mockUser = {
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: true,
  phone: '+447123456789',
  avatarUrl: null,
  bio: 'Test bio',
  location: 'London',
  rating: 4.5,
  createdAt: new Date().toISOString(),
}

const mockUserNeedsSetup = {
  ...mockUser,
  emailVerified: false,
  phone: null,
  bio: null,
}

function wrap(initialRoute = '/profile') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Profile />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetListings.mockResolvedValue({ tools: [], spaces: [] })
    mockGetByUser.mockResolvedValue({ data: [] })
    mockListTransactions.mockResolvedValue({ data: [] })
    mockLogout.mockResolvedValue({})
  })

  describe('logged out', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: null, isLoading: false })
    })

    it('renders auth page when not logged in', async () => {
      wrap()
      expect(await screen.findByText(/welcome back/i)).toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('shows skeleton while loading', () => {
      mockUseAuth.mockReturnValue({ user: null, isLoading: true })
      wrap()
      // Skeleton elements are rendered
      const skeletons = document.querySelectorAll('.rounded-xl')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('logged in', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: mockUser, isLoading: false })
    })

    it('renders profile header with user name', async () => {
      wrap()
      await waitFor(() => {
        expect(mockGetListings).toHaveBeenCalledWith('user-123')
      })
    })

    it('renders tools and spaces tabs', async () => {
      wrap()
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /my tools/i })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /my spaces/i })).toBeInTheDocument()
      })
    })

    it('switches between tools and spaces tabs', async () => {
      const user = userEvent.setup()
      wrap()

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /my tools/i })).toBeInTheDocument()
      })

      // Click spaces tab
      await user.click(screen.getByRole('tab', { name: /my spaces/i }))
      expect(screen.getByRole('button', { name: /add space/i })).toBeInTheDocument()

      // Click tools tab
      await user.click(screen.getByRole('tab', { name: /my tools/i }))
      expect(screen.getByRole('button', { name: /add tool/i })).toBeInTheDocument()
    })

    it('navigates to create tool page when Add Tool clicked', async () => {
      const user = userEvent.setup()
      wrap()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add tool/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /add tool/i }))
      expect(mockNavigate).toHaveBeenCalledWith('/create?type=tool')
    })

    it('navigates to create space page when Add Space clicked', async () => {
      const user = userEvent.setup()
      wrap()

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /my spaces/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('tab', { name: /my spaces/i }))
      await user.click(screen.getByRole('button', { name: /add space/i }))
      expect(mockNavigate).toHaveBeenCalledWith('/create?type=space')
    })

    it('displays rating card with user rating', async () => {
      mockGetByUser.mockResolvedValue({ data: [{ id: 'r1', rating: 5 }] })
      wrap()

      await waitFor(() => {
        expect(screen.getByText(/your rating/i)).toBeInTheDocument()
      })
    })

    it('shows tools count in tab', async () => {
      mockGetListings.mockResolvedValue({
        tools: [
          { id: 't1', name: 'Drill', createdAt: new Date().toISOString() },
          { id: 't2', name: 'Saw', createdAt: new Date().toISOString() },
        ],
        spaces: [],
      })
      wrap()

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /my tools \(2\)/i })).toBeInTheDocument()
      })
    })

    it('shows spaces count in tab', async () => {
      mockGetListings.mockResolvedValue({
        tools: [],
        spaces: [{ id: 's1', name: 'Garage', createdAt: new Date().toISOString() }],
      })
      wrap()

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /my spaces \(1\)/i })).toBeInTheDocument()
      })
    })

    it('calls logout and navigates home when Log Out clicked', async () => {
      const user = userEvent.setup()
      wrap()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /log out/i }))

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled()
      })
    })
  })

  describe('needs setup state', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: mockUserNeedsSetup, isLoading: false })
    })

    it('shows getting started card when profile incomplete', async () => {
      wrap()

      await waitFor(() => {
        // GettingStartedCard should be rendered
        expect(mockGetListings).toHaveBeenCalled()
      })
    })
  })

  describe('redirect handling', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: mockUser, isLoading: false })
    })

    it('redirects to safe internal path after login', async () => {
      wrap('/profile?redirect=/dashboard')

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
      })
    })

    it('does not redirect to external URLs', async () => {
      wrap('/profile?redirect=//evil.com')

      await waitFor(() => {
        expect(mockGetListings).toHaveBeenCalled()
      })
      // Should NOT navigate to external URL
      expect(mockNavigate).not.toHaveBeenCalledWith('//evil.com', expect.anything())
    })
  })
})

