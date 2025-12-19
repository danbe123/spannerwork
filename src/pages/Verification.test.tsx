import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

const { mockAuthService, mockUploadService, mockInsuranceService, mockToast } = vi.hoisted(() => ({
  mockAuthService: {
    getCurrentUser: vi.fn(),
    sendVerificationEmail: vi.fn(),
    sendPhoneCode: vi.fn(),
    verifyPhone: vi.fn(),
    verifyEmail: vi.fn(),
  },
  mockUploadService: {
    uploadFile: vi.fn(),
  },
  mockInsuranceService: {
    uploadDocument: vi.fn(),
  },
  mockToast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), mockToast) }))

vi.mock('@/api/services', () => ({
  authService: mockAuthService,
  uploadService: mockUploadService,
  usersService: { update: vi.fn() },
}))

vi.mock('@/api/services/insurance', () => ({
  insuranceService: mockInsuranceService,
}))

vi.mock('@/utils', () => ({
  createPageUrl: (page: string) => `/${page.toLowerCase()}`,
}))

import Verification from './Verification'

const unverifiedUser = {
  id: 'u1',
  email: 'test@example.com',
  emailVerified: false,
  phoneVerified: false,
  insuranceVerified: false,
}

const verifiedUser = {
  id: 'u1',
  email: 'verified@example.com',
  phone: '+447123456789',
  emailVerified: true,
  phoneVerified: true,
  insuranceVerified: true,
}

function wrap(route = '/verification') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  Object.defineProperty(window, 'location', {
    value: { search: route.includes('?') ? '?' + route.split('?')[1] : '', pathname: '/verification' },
    writable: true,
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <Verification />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuthService.getCurrentUser.mockResolvedValue({ user: unverifiedUser })
  mockAuthService.sendVerificationEmail.mockResolvedValue({ ok: true })
  mockAuthService.sendPhoneCode.mockResolvedValue({ ok: true })
  mockAuthService.verifyPhone.mockResolvedValue({ ok: true })
  mockAuthService.verifyEmail.mockResolvedValue({ ok: true })
  mockUploadService.uploadFile.mockResolvedValue({ data: { fileUrl: 'https://example.com/doc.pdf' } })
  mockInsuranceService.uploadDocument.mockResolvedValue({ success: true })
})

describe('Verification page', () => {
  describe('Email Verification', () => {
    it('sends verification email', async () => {
      wrap()
      const btn = await screen.findByRole('button', { name: /send verification email/i })
      fireEvent.click(btn)
      await waitFor(() => {
        expect(mockAuthService.sendVerificationEmail).toHaveBeenCalled()
      })
    })

    it('shows verified badge when email is verified', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue({ user: verifiedUser })
      wrap()
      await waitFor(() => {
        expect(screen.getByText('Your email is verified')).toBeInTheDocument()
      })
    })

    it('shows user email when verified', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue({ user: verifiedUser })
      wrap()
      await waitFor(() => {
        expect(screen.getByText('verified@example.com')).toBeInTheDocument()
      })
    })
  })

  describe('Phone Verification', () => {
    it('sends phone code when a number is entered', async () => {
      wrap()
      const phone = await screen.findByLabelText(/phone number/i)
      fireEvent.change(phone, { target: { value: '+447000000000' } })
      const send = screen.getByRole('button', { name: /send code via sms/i })
      fireEvent.click(send)
      await waitFor(() => {
        expect(mockAuthService.sendPhoneCode).toHaveBeenCalledWith('+447000000000')
      })
    })

    it('verifies phone when 6-digit code entered after sending', async () => {
      wrap()
      const phone = await screen.findByLabelText(/phone number/i)
      fireEvent.change(phone, { target: { value: '+447000000000' } })
      fireEvent.click(screen.getByRole('button', { name: /send code via sms/i }))
      await screen.findByText(/verification code sent via sms/i)
      const codeInput = screen.getByLabelText(/verification code/i)
      fireEvent.change(codeInput, { target: { value: '123456' } })
      fireEvent.click(screen.getByRole('button', { name: /verify phone/i }))
      await waitFor(() => {
        expect(mockAuthService.verifyPhone).toHaveBeenCalledWith('+447000000000', '123456')
      })
    })

    it('shows verified badge when phone is verified', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue({ user: verifiedUser })
      wrap()
      await waitFor(() => {
        expect(screen.getByText('Your phone is verified')).toBeInTheDocument()
      })
    })

    it('allows using different number after code sent', async () => {
      wrap()
      const phone = await screen.findByLabelText(/phone number/i)
      fireEvent.change(phone, { target: { value: '+447000000000' } })
      fireEvent.click(screen.getByRole('button', { name: /send code via sms/i }))
      await screen.findByText(/verification code sent via sms/i)
      
      const differentBtn = screen.getByRole('button', { name: /use different number/i })
      fireEvent.click(differentBtn)
      
      // Should show phone input again
      await waitFor(() => {
        expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument()
      })
    })

    it('disables verify button when code is less than 6 digits', async () => {
      wrap()
      const phone = await screen.findByLabelText(/phone number/i)
      fireEvent.change(phone, { target: { value: '+447000000000' } })
      fireEvent.click(screen.getByRole('button', { name: /send code via sms/i }))
      await screen.findByText(/verification code sent via sms/i)
      
      const codeInput = screen.getByLabelText(/verification code/i)
      fireEvent.change(codeInput, { target: { value: '123' } })
      
      const verifyBtn = screen.getByRole('button', { name: /verify phone/i })
      expect(verifyBtn).toBeDisabled()
    })
  })

  describe('Insurance Verification', () => {
    it('shows upload button for unverified insurance', async () => {
      wrap()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /upload insurance document/i })).toBeInTheDocument()
      })
    })

    it('shows verified badge when insurance is verified', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue({ user: verifiedUser })
      wrap()
      await waitFor(() => {
        expect(screen.getByText('Your insurance is verified')).toBeInTheDocument()
      })
    })

    it('handles insurance document upload', async () => {
      wrap()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /upload insurance document/i })).toBeInTheDocument()
      })
      
      const file = new File(['test'], 'insurance.pdf', { type: 'application/pdf' })
      const input = document.getElementById('insurance-upload') as HTMLInputElement
      
      Object.defineProperty(input, 'files', { value: [file] })
      fireEvent.change(input)
      
      await waitFor(() => {
        expect(mockUploadService.uploadFile).toHaveBeenCalledWith(file)
      })

      await waitFor(() => {
        expect(mockInsuranceService.uploadDocument).toHaveBeenCalledWith({
          documentUrl: 'https://example.com/doc.pdf',
        })
      })
    })
  })

  describe('URL Token Verification', () => {
    it('verifies email when token is in URL', async () => {
      Object.defineProperty(window, 'location', {
        value: { search: '?token=test-token-123', pathname: '/verification' },
        writable: true,
      })
      wrap('/verification?token=test-token-123')
      
      await waitFor(() => {
        expect(mockAuthService.verifyEmail).toHaveBeenCalledWith('test-token-123')
      })
    })

    it('shows error toast when email verification fails', async () => {
      mockAuthService.verifyEmail.mockRejectedValue(new Error('Invalid token'))
      Object.defineProperty(window, 'location', {
        value: { search: '?token=bad-token', pathname: '/verification' },
        writable: true,
      })
      wrap('/verification?token=bad-token')
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled()
      })
    })
  })

  describe('Navigation', () => {
    it('shows back to profile button', async () => {
      wrap()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to profile/i })).toBeInTheDocument()
      })
    })

    it('displays page title', async () => {
      wrap()
      await waitFor(() => {
        expect(screen.getByText('Verification Center')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('shows error when phone code sending fails', async () => {
      mockAuthService.sendPhoneCode.mockRejectedValue(new Error('Failed to send'))
      wrap()
      
      const phone = await screen.findByLabelText(/phone number/i)
      fireEvent.change(phone, { target: { value: '+447000000000' } })
      fireEvent.click(screen.getByRole('button', { name: /send code via sms/i }))
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled()
      })
    })

    it('shows error when phone verification fails', async () => {
      mockAuthService.verifyPhone.mockRejectedValue(new Error('Invalid code'))
      wrap()
      
      const phone = await screen.findByLabelText(/phone number/i)
      fireEvent.change(phone, { target: { value: '+447000000000' } })
      fireEvent.click(screen.getByRole('button', { name: /send code via sms/i }))
      await screen.findByText(/verification code sent via sms/i)
      
      const codeInput = screen.getByLabelText(/verification code/i)
      fireEvent.change(codeInput, { target: { value: '123456' } })
      fireEvent.click(screen.getByRole('button', { name: /verify phone/i }))
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled()
      })
    })
  })
})
