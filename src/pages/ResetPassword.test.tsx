import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import ResetPassword from './ResetPassword.jsx'

vi.mock('@/api/services', () => ({
  authService: { resetPassword: vi.fn().mockResolvedValue({ ok: true }) },
}))

const { authService } = await import('@/api/services')

function wrap(route: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  window.history.pushState({}, '', route)
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <ResetPassword />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ResetPassword', () => {
  it('shows error when token missing after filling required fields', async () => {
    wrap('/reset-password')
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }))
    expect(await screen.findByText(/reset link is invalid/i)).toBeInTheDocument()
  })

  it('validates matching passwords and calls service', async () => {
    wrap('/reset-password?token=abc')
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }))
    await new Promise((r) => setTimeout(r, 0))
    expect(authService.resetPassword).toHaveBeenCalledWith('abc', 'password123')
  })
})
