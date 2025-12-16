import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Profile from './Profile'

vi.mock('@/hooks/use-auth', () => ({ default: () => ({ user: null, isLoading: false }) }))

vi.mock('@/api/services', () => ({
  authService: { login: vi.fn(), register: vi.fn(), forgotPassword: vi.fn(), logout: vi.fn() },
  usersService: { getListings: vi.fn() },
  reviewsService: { getByUser: vi.fn() },
  transactionsService: { list: vi.fn() },
}))

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Profile auth', () => {
  it('shows auth page when user is not logged in', async () => {
    wrap()

    // AuthPage should be rendered, showing the marketing content
    expect(await screen.findByText(/Your workshop/i)).toBeInTheDocument()
    expect(screen.getByText(/Always earning/i)).toBeInTheDocument()
  })
})

