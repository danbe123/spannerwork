import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import ToolDetail from './ToolDetail'

vi.mock('@/api/services', () => ({
  authService: { getCurrentUser: vi.fn().mockResolvedValue({ user: { id: 'viewer' } }) },
  toolsService: { getById: vi.fn() },
  usersService: { getById: vi.fn().mockResolvedValue({ user: { id: 'owner', displayName: 'Alex', averageRating: 4.5, totalTransactions: 12 } }) },
}))

const { toolsService } = await import('@/api/services') as unknown as { toolsService: { getById: ReturnType<typeof vi.fn> } }

function wrap(route = '/ToolDetail?id=tool-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  window.history.pushState({}, '', route)
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <ToolDetail />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ToolDetail display', () => {
  it('renders deposit and rate summary for a tool', async () => {
    toolsService.getById.mockResolvedValueOnce({
      tool: {
        id: 'tool-1',
        name: 'Cordless Drill',
        category: 'TOOLS',
        description: 'A nice drill',
        ownerId: 'owner',
        available: true,
        hourlyRate: 10,
        dailyRate: 40,
        weeklyRate: 200,
        monthlyRate: 600,
        depositAmount: 50,
        condition: 'good',
        photos: [],
      },
    })

    wrap()

    expect(await screen.findByText(/Cordless Drill/)).toBeInTheDocument()
    // Check that pricing info is displayed (format may vary)
    expect(screen.getByText(/£40\/day/)).toBeInTheDocument()
  })
})
