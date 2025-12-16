import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import StartTransaction from './StartTransaction.jsx'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@/api/services', () => ({
  requestsService: { getById: vi.fn().mockResolvedValue({ request: { id: 'r1', title: 'Help', description: 'Desc', budget: 100, rate_type: 'fixed' } }) },
  toolsService: { list: vi.fn().mockResolvedValue({ tools: [] }) },
  transactionsService: { create: vi.fn().mockResolvedValue({ transaction: { id: 'tx-1' } }) },
}))

function wrap(route = '/StartTransaction?requestId=r1&helperId=h1&seekerId=s1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  window.history.pushState({}, '', route)
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <StartTransaction />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('StartTransaction success flow', () => {
  it('submits and navigates to Payment', async () => {
    wrap()

    // Fill required fields
    const rateInput = await screen.findByLabelText(/your rate/i)
    fireEvent.change(rateInput, { target: { value: '50' } })
    const depositInput = screen.getByLabelText(/security deposit/i)
    fireEvent.change(depositInput, { target: { value: '10' } })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /create transaction/i }))

    // Expect redirect to payment with id
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
    expect(mockNavigate).toHaveBeenCalledWith('/payment?transactionId=tx-1')
  })
})
