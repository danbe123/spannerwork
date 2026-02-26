import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import { vi, describe, it, expect } from 'vitest'

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

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}

describe('App navigation', () => {
  it('renders Home landing page on root path', async () => {
    window.history.pushState({}, '', '/')

    renderWithProviders()

    // The Home page "Sign Up or Login" CTA should be visible by default
    const cta = await screen.findByText(/sign up or login/i)
    expect(cta).toBeInTheDocument()
  })
})
