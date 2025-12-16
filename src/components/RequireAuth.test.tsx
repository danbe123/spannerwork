import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import RequireAuth from './RequireAuth.jsx'

vi.mock('@/api/services/auth', () => ({
  authService: { getCurrentUser: vi.fn() },
}))
const { authService } = await import('@/api/services/auth')

function LocationDebugger() {
  const loc = useLocation()
  return (
    <div data-testid="location">
      {loc.pathname}{loc.search}
    </div>
  )
}

describe('RequireAuth', () => {
  function renderWithClient(children, initial = '/CreateRequest') {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[initial]}>
          <Routes>
            <Route path="/CreateRequest" element={children} />
            <Route path="/profile" element={<LocationDebugger />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('redirects to /profile with encoded redirect param when not authenticated', async () => {
    authService.getCurrentUser.mockRejectedValueOnce({ status: 401 })

    renderWithClient(
      <RequireAuth>
        <div>Protected</div>
      </RequireAuth>,
      '/CreateRequest?foo=bar'
    )

    const loc = await screen.findByTestId('location')
    const text = loc.textContent || ''
    expect(text.startsWith('/profile?')).toBe(true)
    const qs = new URLSearchParams(text.split('?')[1])
    const redirect = qs.get('redirect')
    expect(decodeURIComponent(redirect || '')).toBe('/CreateRequest?foo=bar')
  })

  it('renders children when authenticated', async () => {
    authService.getCurrentUser.mockResolvedValueOnce({ user: { id: 'u1' } })

    renderWithClient(
      <RequireAuth>
        <div data-testid="child">Protected</div>
      </RequireAuth>
    )

    expect(await screen.findByTestId('child')).toBeInTheDocument()
  })
})
