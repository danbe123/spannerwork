import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Calendar from './Calendar.jsx'

function wrap(route = '/Calendar') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  window.history.pushState({}, '', route)
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <Calendar />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Calendar fallback', () => {
  it('shows tool not found when no toolId query param', async () => {
    wrap()
    expect(await screen.findByText(/tool not found/i)).toBeInTheDocument()
  })
})

