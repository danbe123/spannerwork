import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Bar: () => <div />,
  PieChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Cell: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}))

const { mockGetCurrentUser, mockListTransactions, mockListTools, mockGetReviewsByUser } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockListTransactions: vi.fn(),
  mockListTools: vi.fn(),
  mockGetReviewsByUser: vi.fn(),
}))

vi.mock('@/api/services', () => ({
  authService: { getCurrentUser: () => mockGetCurrentUser() },
  transactionsService: { list: (params: unknown) => mockListTransactions(params) },
  toolsService: { list: (params: unknown) => mockListTools(params) },
  reviewsService: { getByUser: (id: string) => mockGetReviewsByUser(id) },
}))

import Analytics from './Analytics'

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Analytics />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({ user: { id: 'u1', rating: 4.8 } })
    mockListTransactions.mockResolvedValue({
      data: [
        { id: 't1', status: 'COMPLETED', rentalFee: 100, createdDate: '2025-01-05T00:00:00Z', toolId: 'tool1' },
        { id: 't2', status: 'COMPLETED', rentalFee: 50, createdDate: '2025-01-06T00:00:00Z', toolId: 'tool2' },
        { id: 't3', status: 'IN_PROGRESS', rentalFee: 25, createdDate: '2025-01-07T00:00:00Z', toolId: 'tool1' },
      ],
    })
    mockListTools.mockResolvedValue({ data: [{ id: 'tool1', name: 'Drill' }, { id: 'tool2', name: 'Saw' }] })
    mockGetReviewsByUser.mockResolvedValue({ data: [{ rating: 5 }, { rating: 4 }] })
  })

  it('renders key metrics and computed totals', async () => {
    wrap()

    expect(await screen.findByText(/Provider Analytics/i)).toBeInTheDocument()
    expect(screen.getByText(/Total Earnings/i)).toBeInTheDocument()
    expect(screen.getByText(/Completed Jobs/i)).toBeInTheDocument()
    expect(screen.getByText(/Avg Rating/i)).toBeInTheDocument()

    // Total Earnings card (text is rendered as "£" + number in separate nodes)
    const totalEarningsLabel = screen.getByText(/Total Earnings/i)
    const totalEarningsCard = totalEarningsLabel.closest('div.rounded-xl')
    if (!(totalEarningsCard instanceof HTMLElement)) throw new Error('Total Earnings card not found')
    await waitFor(() => {
      expect(
        within(totalEarningsCard).getByText((_, node) =>
          (node?.textContent || '').replace(/\s+/g, '') === '£150'
        )
      ).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(mockListTransactions).toHaveBeenCalled()
      expect(mockListTools).toHaveBeenCalled()
      expect(mockGetReviewsByUser).toHaveBeenCalled()
    })

    // Completed Jobs card (avoid ambiguous "2" matches)
    const completedJobsLabel = screen.getByText(/Completed Jobs/i)
    const completedJobsCard = completedJobsLabel.closest('div.rounded-xl')
    if (!(completedJobsCard instanceof HTMLElement)) throw new Error('Completed Jobs card not found')
    const completedJobsCardEl: HTMLElement = completedJobsCard
    await waitFor(() => {
      expect(within(completedJobsCardEl).getByText('2')).toBeInTheDocument()
    })

    // Avg Rating card
    const avgRatingLabel = screen.getByText(/Avg Rating/i)
    const avgRatingCard = avgRatingLabel.closest('div.rounded-xl')
    if (!(avgRatingCard instanceof HTMLElement)) throw new Error('Avg Rating card not found')
    const avgRatingCardEl: HTMLElement = avgRatingCard
    await waitFor(() => {
      expect(within(avgRatingCardEl).getByText('4.8')).toBeInTheDocument()
    })
  })

  it('allows switching tabs and shows tool performance + recent activity', async () => {
    const user = userEvent.setup()
    wrap()
    await screen.findByText(/Provider Analytics/i)

    await user.click(screen.getByRole('tab', { name: /tool performance/i }))
    expect(await screen.findByText(/Top Earning Tools/i)).toBeInTheDocument()
    const topEarningToolsHeader = screen.getByText(/Top Earning Tools/i)
    const topEarningToolsCard = topEarningToolsHeader.closest('div.rounded-xl')
    if (!(topEarningToolsCard instanceof HTMLElement)) throw new Error('Top Earning Tools card not found')
    expect(within(topEarningToolsCard).getByText('Drill')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /recent activity/i }))
    expect(await screen.findByText(/Recent Transactions/i)).toBeInTheDocument()
    expect(screen.getByText(/Transaction #t1/i)).toBeInTheDocument()
    const recentTransactionsHeader = screen.getByText(/Recent Transactions/i)
    const recentTransactionsCard = recentTransactionsHeader.closest('div.rounded-xl')
    if (!(recentTransactionsCard instanceof HTMLElement)) throw new Error('Recent Transactions card not found')
    expect(within(recentTransactionsCard).getAllByText('COMPLETED').length).toBeGreaterThan(0)
  })
})
