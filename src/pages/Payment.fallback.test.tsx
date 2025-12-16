import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Payment from './Payment.jsx'

vi.mock('@/api/services', () => ({
  authService: { getCurrentUser: vi.fn().mockResolvedValue({ user: { id: 'u1' } }) },
  transactionsService: { getById: vi.fn() },
  usersService: { getById: vi.fn() },
}))

function renderWithClient(route = '/Payment') {
  window.history.pushState({}, '', route)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <Payment />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Payment (fallback)', () => {
  it('shows not found when missing transaction id', async () => {
    renderWithClient()
    expect(await screen.findByText(/transaction not found/i)).toBeInTheDocument()
  })
})
