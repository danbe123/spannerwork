import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import { vi } from 'vitest'

// Mock axios so apiClient calls don't hit the network
vi.mock('axios', () => {
  const mInstance = {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    defaults: {},
  }

  return {
    default: {
      create: vi.fn(() => mInstance),
    },
  }
})

function renderWithProviders(ui) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>,
  )
}

test('renders App root without crashing', () => {
  renderWithProviders(<App />)
  // Basic smoke assertion: root container exists
  expect(document.body).toBeInTheDocument()
})
