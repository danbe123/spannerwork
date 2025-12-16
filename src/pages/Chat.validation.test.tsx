import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Chat from './Chat'

vi.mock('@/api/services', () => ({
  authService: { getCurrentUser: vi.fn().mockResolvedValue({ user: { id: 'u1' } }) },
  messagesService: {
    getConversation: vi.fn().mockResolvedValue({ messages: [] }),
    markConversationAsRead: vi.fn().mockResolvedValue({}),
    send: vi.fn(),
  },
  requestsService: { getById: vi.fn() },
  uploadService: { uploadFile: vi.fn(), uploadFiles: vi.fn() },
}))

function wrap(route = '/Chat') {
  window.history.pushState({}, '', route)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <Chat />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Chat validation', () => {
  it('shows missing user ID message when no userId in URL', async () => {
    wrap('/Chat')
    expect(await screen.findByText(/Invalid conversation - missing user ID in URL/i)).toBeInTheDocument()
  })
})

