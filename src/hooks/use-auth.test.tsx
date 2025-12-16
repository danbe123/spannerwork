import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import useAuth from './use-auth'

vi.mock('@/api/services/auth', () => ({
  authService: {
    getCurrentUser: vi.fn(),
  },
}))

const { authService } = await import('@/api/services/auth')
const mockGetCurrentUser = authService.getCurrentUser as Mock

function AuthProbe(): JSX.Element {
  const { user, isAuthenticated, isLoading, isError, error, refetch } = useAuth()
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="authed">{String(isAuthenticated)}</div>
      <div data-testid="user">{user ? user.id : 'null'}</div>
      <div data-testid="error">{String(isError)}</div>
      <div data-testid="errorMsg">{error?.message || 'none'}</div>
      <button data-testid="refetch" onClick={() => refetch()}>Refetch</button>
    </div>
  )
}

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
}

function renderWithClient(qc?: QueryClient): ReturnType<typeof render> & { queryClient: QueryClient } {
  const queryClient = qc || createQueryClient()
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthProbe />
      </QueryClientProvider>
    ),
  }
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authentication state', () => {
    it('treats 401 as logged out (no error)', async () => {
      const axiosError = new AxiosError('Unauthorized')
      axiosError.response = { status: 401 } as AxiosError['response']
      mockGetCurrentUser.mockRejectedValueOnce(axiosError)

      renderWithClient()
      await waitFor(() => expect(screen.getByTestId('authed').textContent).toBe('false'))
      expect(screen.getByTestId('user').textContent).toBe('null')
    })

    it('returns user when authenticated', async () => {
      mockGetCurrentUser.mockResolvedValueOnce({ user: { id: 'user-1', name: 'Test User' } })

      renderWithClient()
      await waitFor(() => expect(screen.getByTestId('authed').textContent).toBe('true'))
      expect(screen.getByTestId('user').textContent).toBe('user-1')
    })

    it('shows loading state initially', () => {
      mockGetCurrentUser.mockImplementation(() => new Promise(() => {}))

      renderWithClient()
      expect(screen.getByTestId('loading').textContent).toBe('true')
    })

    it('handles null user response', async () => {
      mockGetCurrentUser.mockResolvedValueOnce({ user: null })

      renderWithClient()
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
      expect(screen.getByTestId('authed').textContent).toBe('false')
    })
  })

  describe('error handling', () => {
    it('sets error state on non-401 errors', async () => {
      mockGetCurrentUser.mockRejectedValueOnce(new Error('Network error'))

      renderWithClient()
      await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('true'))
    })

    it('throws non-401 errors', async () => {
      const error = new Error('Server error')
      mockGetCurrentUser.mockRejectedValueOnce(error)

      renderWithClient()
      await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('true'))
    })
  })

  describe('refetch functionality', () => {
    it('refetches user data when refetch is called', async () => {
      mockGetCurrentUser.mockResolvedValue({ user: { id: 'user-1' } })

      renderWithClient()
      await waitFor(() => expect(screen.getByTestId('authed').textContent).toBe('true'))

      mockGetCurrentUser.mockResolvedValue({ user: { id: 'user-2' } })
      
      await act(async () => {
        screen.getByTestId('refetch').click()
      })

      await waitFor(() => expect(mockGetCurrentUser).toHaveBeenCalledTimes(2))
    })
  })

  describe('auth:unauthorized event', () => {
    it('handles unauthorized event dispatch', async () => {
      mockGetCurrentUser.mockResolvedValueOnce({ user: { id: 'user-1' } })

      renderWithClient()
      await waitFor(() => expect(screen.getByTestId('authed').textContent).toBe('true'))

      // Dispatch unauthorized event - should not throw
      await act(async () => {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'))
      })

      // Component should still be mounted
      expect(screen.getByTestId('authed')).toBeInTheDocument()
    })
  })

  describe('isAuthenticated', () => {
    it('returns false when user is null', async () => {
      mockGetCurrentUser.mockResolvedValueOnce({ user: null })

      renderWithClient()
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
      expect(screen.getByTestId('authed').textContent).toBe('false')
    })

    it('returns true when user exists', async () => {
      mockGetCurrentUser.mockResolvedValueOnce({ user: { id: 'u1' } })

      renderWithClient()
      await waitFor(() => expect(screen.getByTestId('authed').textContent).toBe('true'))
    })
  })
})

