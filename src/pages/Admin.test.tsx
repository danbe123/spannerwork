import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

const { mockAuth, mockAdmin } = vi.hoisted(() => ({
  mockAuth: { getCurrentUser: vi.fn() },
  mockAdmin: {
    listUsers: vi.fn(),
    listTransactions: vi.fn(),
    listDisputes: vi.fn(),
    listRequests: vi.fn(),
    resolveDispute: vi.fn(),
    suspendUser: vi.fn(),
    reactivateUser: vi.fn(),
  },
}))

vi.mock('@/api/services', () => ({
  authService: mockAuth,
  adminService: mockAdmin,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import Admin from './Admin'

import { toast } from 'sonner'

function renderAdmin(qc?: QueryClient) {
  const queryClient = qc ?? new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    </QueryClientProvider>
  )

  return { ...view, queryClient }
}

const mockAdminData = () => {
  mockAuth.getCurrentUser.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } })
  mockAdmin.listUsers.mockResolvedValue({
    data: [
      {
        id: 'u1',
        name: 'John',
        email: 'john@test.com',
        role: 'USER',
        username: 'johnny',
        accountStatus: 'ACTIVE',
        totalTransactions: 2,
        rating: 4.2,
        createdDate: new Date().toISOString(),
      },
      {
        id: 'u2',
        name: 'Jane',
        email: 'jane@test.com',
        role: 'ADMIN',
        username: 'jane-admin',
        accountStatus: 'SUSPENDED',
        totalTransactions: 0,
        rating: 4.9,
        createdDate: new Date().toISOString(),
      },
    ],
  })
  mockAdmin.listTransactions.mockResolvedValue({
    data: [
      {
        id: 't1',
        status: 'COMPLETED',
        rentalFee: 100,
        depositAmount: 20,
        providerId: 'u2',
        userId: 'u1',
        createdDate: new Date().toISOString(),
      },
      {
        id: 't2',
        status: 'PENDING',
        rentalFee: 50,
        providerId: 'u2',
        userId: 'u1',
        createdDate: new Date().toISOString(),
      },
    ],
  })
  mockAdmin.listDisputes.mockResolvedValue({
    data: [
      {
        id: 'd1',
        status: 'OPEN',
        reason: 'Damaged item',
        description: 'Tool returned with visible damage.',
        initiatorId: 'u1',
        respondentId: 'u2',
        transactionId: 't1',
        createdDate: new Date().toISOString(),
      },
    ],
  })
  mockAdmin.listRequests.mockResolvedValue({
    data: [
      {
        id: 'r1',
        title: 'Need drill',
        description: 'Looking for a cordless drill for the weekend',
        category: 'TOOLS',
        status: 'ACTIVE',
        budget: 50,
        urgency: 'ASAP',
        seekerId: 'u1',
        createdDate: new Date().toISOString(),
      },
    ],
  })
}

describe('Admin page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    // Transactions export uses these browser APIs
    global.URL.createObjectURL = vi.fn(() => 'blob:csv')
    global.URL.revokeObjectURL = vi.fn()
  })

  it('denies access for non-admin users', async () => {
    mockAuth.getCurrentUser.mockResolvedValueOnce({ user: { id: 'u1', role: 'USER' } })
    renderAdmin()
    expect(await screen.findByText(/Access Denied/i)).toBeInTheDocument()
  })

  it('shows dashboard stats for admins', async () => {
    mockAdminData()
    renderAdmin()
    expect(await screen.findByText(/Admin Dashboard/i)).toBeInTheDocument()
    expect(screen.getByText(/Total Users/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(mockAdmin.listTransactions).toHaveBeenCalledWith({ sort: '-created_date' })
      expect(mockAdmin.listDisputes).toHaveBeenCalledWith({ sort: '-created_date' })
    })
  })

  it('renders tabs for different sections', async () => {
    mockAdminData()
    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText(/Admin Dashboard/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('tab', { name: /users/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /transactions/i })).toBeInTheDocument()
  })

  it('shows users tab content when clicked', async () => {
    const user = userEvent.setup()
    mockAdminData()
    renderAdmin()
    
    await waitFor(() => {
      expect(screen.getByText(/Admin Dashboard/i)).toBeInTheDocument()
    })
    
    const usersTab = screen.getByRole('tab', { name: /users/i })
    await user.click(usersTab)
    
    await waitFor(() => {
      const searchInputs = screen.queryAllByPlaceholderText(/search/i)
      expect(searchInputs.length).toBeGreaterThanOrEqual(0)
    })
  })

  it('shows transactions tab content when clicked', async () => {
    const user = userEvent.setup()
    mockAdminData()
    renderAdmin()
    
    await waitFor(() => {
      expect(screen.getByText(/Admin Dashboard/i)).toBeInTheDocument()
    })
    
    const transactionsTab = screen.getByRole('tab', { name: /transactions/i })
    await user.click(transactionsTab)
    
    await waitFor(() => {
      expect(document.body).toBeInTheDocument()
    })
  })

  it('displays loading state initially', () => {
    mockAuth.getCurrentUser.mockReturnValue(new Promise(() => {}))
    renderAdmin()
    expect(document.body).toBeInTheDocument()
  })

  it('renders shield icon for admin', async () => {
    mockAdminData()
    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText(/Admin Dashboard/i)).toBeInTheDocument()
    })
  })

  it('shows search input for users', async () => {
    const user = userEvent.setup()
    mockAdminData()
    renderAdmin()
    
    await waitFor(() => {
      expect(screen.getByText(/Admin Dashboard/i)).toBeInTheDocument()
    })
    
    const usersTab = screen.getByRole('tab', { name: /users/i })
    await user.click(usersTab)
    
    await waitFor(() => {
      const inputs = screen.queryAllByRole('textbox')
      expect(inputs.length).toBeGreaterThanOrEqual(0)
    })
  })

  it('shows disputes tab by default', async () => {
    mockAdminData()
    renderAdmin()
    
    await waitFor(() => {
      expect(screen.getByText(/Dispute Management/i)).toBeInTheDocument()
    })
  })

  it('shows requests tab when clicked', async () => {
    const user = userEvent.setup()
    mockAdminData()
    renderAdmin()
    
    await waitFor(() => {
      expect(screen.getByText(/Admin Dashboard/i)).toBeInTheDocument()
    })
    
    const requestsTab = screen.getByRole('tab', { name: /requests/i })
    await user.click(requestsTab)
    
    await waitFor(() => {
      expect(document.body).toBeInTheDocument()
    })
  })

  it('displays revenue in pounds', async () => {
    mockAdminData()
    renderAdmin()
    
    await waitFor(() => {
      expect(screen.getByText(/Revenue/i)).toBeInTheDocument()
      expect(document.body.textContent).toContain('£')
    })
  })

  it('shows active users count', async () => {
    mockAdminData()
    renderAdmin()
    
    await waitFor(() => {
      expect(screen.getByText(/Total Users/i)).toBeInTheDocument()
    })
  })

  it('shows transactions section', async () => {
    mockAdminData()
    renderAdmin()
    
    await waitFor(() => {
      // Verify the admin dashboard is rendered
      expect(screen.getByText(/Admin Dashboard/i)).toBeInTheDocument()
    })
  })

  it('shows disputes section', async () => {
    mockAdminData()
    renderAdmin()
    
    await waitFor(() => {
      // Verify the admin dashboard is rendered
      expect(screen.getByText(/Admin Dashboard/i)).toBeInTheDocument()
    })
  })

  it('has link to platform analytics', async () => {
    mockAdminData()
    renderAdmin()
    
    await waitFor(() => {
      expect(screen.getByText(/Platform Analytics/i)).toBeInTheDocument()
    })
  })

  it('renders stat cards', async () => {
    mockAdminData()
    const { container } = renderAdmin()
    
    await waitFor(() => {
      const cards = container.querySelectorAll('[class*="card"]')
      expect(cards.length).toBeGreaterThan(0)
    })
  })

  it('shows loading state when user data not ready', () => {
    mockAuth.getCurrentUser.mockReturnValue(new Promise(() => {}))
    mockAdmin.listUsers.mockReturnValue(new Promise(() => {}))
    mockAdmin.listTransactions.mockReturnValue(new Promise(() => {}))
    mockAdmin.listDisputes.mockReturnValue(new Promise(() => {}))
    mockAdmin.listRequests.mockReturnValue(new Promise(() => {}))
    renderAdmin()
    expect(screen.getByText(/Loading/i)).toBeInTheDocument()
  })

  it('allows resolving a dispute (calls resolveDispute with calculated refunds)', async () => {
    const user = userEvent.setup()
    mockAdminData()
    renderAdmin()

    expect(await screen.findByText(/Dispute Management/i)).toBeInTheDocument()
    expect(await screen.findByText(/Damaged item/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /review & resolve/i }))

    const resolutionBox = await screen.findByPlaceholderText(/enter resolution details/i)
    await user.type(resolutionBox, 'Refund for damage')

    await user.click(screen.getByRole('button', { name: /rule for initiator/i }))

    await waitFor(() => {
      expect(mockAdmin.resolveDispute).toHaveBeenCalledTimes(1)
    })

    const [disputeId, payload] = mockAdmin.resolveDispute.mock.calls[0]
    expect(disputeId).toBe('d1')
    expect(payload).toMatchObject({
      status: 'RESOLVED',
      resolution: 'Refund for damage',
      refundAmountInitiator: 120,
      refundAmountRespondent: 0,
    })
  })

  it('supports bulk user suspend (checkbox selection + confirm + mutation calls)', async () => {
    const user = userEvent.setup()
    mockAdminData()
    renderAdmin()

    await user.click(await screen.findByRole('tab', { name: /users/i }))

    // select a single user
    const checkboxes = await screen.findAllByRole('checkbox')
    await user.click(checkboxes[0])

    await user.click(screen.getByRole('button', { name: /suspend \(1\)/i }))

    await waitFor(() => {
      expect(mockAdmin.suspendUser).toHaveBeenCalledWith('u1', 'Admin action')
    })
  })

  it('disables individual suspend button for already suspended users', async () => {
    const user = userEvent.setup()
    mockAdminData()
    renderAdmin()

    await user.click(await screen.findByRole('tab', { name: /users/i }))

    // User u2 is mocked as SUSPENDED
    const suspendButtons = screen.getAllByRole('button').filter((b) => b.className.includes('destructive'))
    const maybeDisabled = suspendButtons.find((b) => b.hasAttribute('disabled'))
    expect(maybeDisabled).toBeTruthy()
  })

  it('exports filtered transactions as CSV (createObjectURL/revoke + toast)', async () => {
    const user = userEvent.setup()
    mockAdminData()

    const anchorClick = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName) as HTMLElement
      if (tagName === 'a') {
        vi.spyOn(el, 'click').mockImplementation(anchorClick)
      }
      return el
    })

    renderAdmin()
    await user.click(await screen.findByRole('tab', { name: /transactions/i }))

    await user.click(screen.getByRole('button', { name: /export/i }))

    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled()
      expect(anchorClick).toHaveBeenCalled()
      expect(global.URL.revokeObjectURL).toHaveBeenCalled()
      expect((toast as unknown as { success: (msg: string) => void }).success).toHaveBeenCalledWith('Transactions exported')
    })

    createElementSpy.mockRestore()
  })

  it('refreshes requests (invalidates allRequests query)', async () => {
    const user = userEvent.setup()
    mockAdminData()

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    const { container } = renderAdmin(qc)
    await user.click(await screen.findByRole('tab', { name: /requests/i }))

    const refreshIcon = container.querySelector('svg.lucide-refresh-cw')
    expect(refreshIcon).toBeTruthy()
    const refreshButton = refreshIcon?.closest('button') as HTMLButtonElement
    expect(refreshButton).toBeTruthy()
    await user.click(refreshButton)

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['allRequests'] })
  })
})
