const { mockAuthService, mockDisputesService, mockTransactionsService, mockUploadService } = vi.hoisted(() => ({
  mockAuthService: {
    getCurrentUser: vi.fn(),
  },
  mockDisputesService: {
    create: vi.fn(),
    list: vi.fn(),
    resolve: vi.fn(),
  },
  mockTransactionsService: {
    list: vi.fn(),
  },
  mockUploadService: {
    uploadFiles: vi.fn(),
  },
}))

vi.mock('@/api/services', () => ({
  authService: mockAuthService,
  disputesService: mockDisputesService,
  transactionsService: mockTransactionsService,
  uploadService: mockUploadService,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import DisputeResolution from './DisputeResolution'

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  global.ResizeObserver = ResizeObserverStub
})

function renderWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <DisputeResolution />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

const sampleDispute = {
  id: 'dispute-1',
  status: 'OPEN',
  reason: 'Tool damaged',
  transactionId: 'txn-1',
  createdDate: '2024-01-01T00:00:00.000Z',
  description: 'Details here',
}

describe('DisputeResolution', () => {
  beforeEach(() => {
    mockAuthService.getCurrentUser.mockReset()
    mockDisputesService.create.mockReset()
    mockDisputesService.list.mockReset()
    mockDisputesService.resolve.mockReset()
    mockTransactionsService.list.mockReset()
    mockUploadService.uploadFiles.mockReset()
    mockDisputesService.resolve.mockResolvedValue({ success: true })
    mockTransactionsService.list.mockResolvedValue({ data: [] })
    mockUploadService.uploadFiles.mockResolvedValue({ data: { files: [] } })
  })

  it('fetches disputes for the logged-in user', async () => {
    mockAuthService.getCurrentUser.mockResolvedValue({ user: { id: 'user-1', role: 'USER' } })
    mockDisputesService.list.mockResolvedValue({ data: [] })

    renderWithClient()

    await waitFor(() => {
      expect(mockDisputesService.list).toHaveBeenCalled()
    })

    expect(mockDisputesService.list).toHaveBeenCalledWith({})
  })

  it('shows admin resolution controls when user role is ADMIN', async () => {
    mockAuthService.getCurrentUser.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })
    mockDisputesService.list.mockResolvedValue({ data: [sampleDispute] })

    renderWithClient()

    expect(await screen.findByText('Resolution Type')).toBeInTheDocument()
  })

  it('hides admin controls for non-admin users', async () => {
    mockAuthService.getCurrentUser.mockResolvedValue({ user: { id: 'user-2', role: 'USER' } })
    mockDisputesService.list.mockResolvedValue({ data: [sampleDispute] })

    renderWithClient()

    await waitFor(() => {
      expect(mockDisputesService.list).toHaveBeenCalled()
    })

    expect(screen.queryByText('Resolution Type')).not.toBeInTheDocument()
  })

  it('shows empty state when no disputes exist', async () => {
    mockAuthService.getCurrentUser.mockResolvedValue({ user: { id: 'user-1', role: 'USER' } })
    mockDisputesService.list.mockResolvedValue({ data: [] })

    renderWithClient()

    await waitFor(() => {
      expect(screen.getByText(/No Disputes/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/You don't have any active disputes/i)).toBeInTheDocument()
  })

  it('displays dispute details when disputes exist', async () => {
    mockAuthService.getCurrentUser.mockResolvedValue({ user: { id: 'user-1', role: 'USER' } })
    mockDisputesService.list.mockResolvedValue({ data: [sampleDispute] })

    renderWithClient()

    await waitFor(() => {
      expect(screen.getByText('Tool damaged')).toBeInTheDocument()
    })
    expect(screen.getByText('Details here')).toBeInTheDocument()
    expect(screen.getByText(/Transaction ID: txn-1/i)).toBeInTheDocument()
  })

  it('shows pending review message for non-admin users with open disputes', async () => {
    mockAuthService.getCurrentUser.mockResolvedValue({ user: { id: 'user-1', role: 'USER' } })
    mockDisputesService.list.mockResolvedValue({ data: [sampleDispute] })

    renderWithClient()

    await waitFor(() => {
      expect(screen.getByText(/This dispute is under review/i)).toBeInTheDocument()
    })
  })

  it('shows status badge with correct styling', async () => {
    mockAuthService.getCurrentUser.mockResolvedValue({ user: { id: 'user-1', role: 'USER' } })
    mockDisputesService.list.mockResolvedValue({ data: [sampleDispute] })

    renderWithClient()

    await waitFor(() => {
      expect(screen.getByText('OPEN')).toBeInTheDocument()
    })
  })

  it('displays resolved dispute with resolution details', async () => {
    const resolvedDispute = {
      ...sampleDispute,
      status: 'RESOLVED_FOR_INITIATOR',
      resolution: 'Full refund issued',
      resolvedDate: '2024-01-15T00:00:00.000Z',
    }
    mockAuthService.getCurrentUser.mockResolvedValue({ user: { id: 'user-1', role: 'USER' } })
    mockDisputesService.list.mockResolvedValue({ data: [resolvedDispute] })

    renderWithClient()

    await waitFor(() => {
      expect(screen.getByText('Full refund issued')).toBeInTheDocument()
    })
    expect(screen.getByText(/Resolved on Jan 15, 2024/i)).toBeInTheDocument()
  })

  it('allows admin to enter resolution notes', async () => {
    const user = userEvent.setup()
    mockAuthService.getCurrentUser.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })
    mockDisputesService.list.mockResolvedValue({ data: [sampleDispute] })

    renderWithClient()

    await waitFor(() => {
      expect(screen.getByText('Resolution Notes')).toBeInTheDocument()
    })

    const notesInput = screen.getByPlaceholderText(/Explain the resolution/i)
    await user.type(notesInput, 'Issue resolved with refund')
    expect(notesInput).toHaveValue('Issue resolved with refund')
  })

  it('disables resolve button when fields are empty', async () => {
    mockAuthService.getCurrentUser.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })
    mockDisputesService.list.mockResolvedValue({ data: [sampleDispute] })

    renderWithClient()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Resolve Dispute/i })).toBeInTheDocument()
    })

    const resolveButton = screen.getByRole('button', { name: /Resolve Dispute/i })
    expect(resolveButton).toBeDisabled()
  })

  it('displays page title and description', async () => {
    mockAuthService.getCurrentUser.mockResolvedValue({ user: { id: 'user-1', role: 'USER' } })
    mockDisputesService.list.mockResolvedValue({ data: [] })

    renderWithClient()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dispute Resolution', level: 1 })).toBeInTheDocument()
    })
    expect(screen.getByText('View and manage your disputes')).toBeInTheDocument()
  })

  it('shows resolution type select with options for admin', async () => {
    mockAuthService.getCurrentUser.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })
    mockDisputesService.list.mockResolvedValue({ data: [sampleDispute] })

    renderWithClient()

    await waitFor(() => {
      expect(screen.getByText('Resolution Type')).toBeInTheDocument()
    })

    const triggerText = screen.getByText('Select resolution')
    expect(triggerText).toBeInTheDocument()

    const triggerButton = triggerText.closest('button')
    expect(triggerButton).toBeTruthy()
  })
})
