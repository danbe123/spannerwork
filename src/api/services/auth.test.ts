const { mockClient, mockClearCsrfToken } = vi.hoisted(() => ({
  mockClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
  mockClearCsrfToken: vi.fn(),
}))

vi.mock('../client', () => ({
  default: mockClient,
  clearCsrfToken: mockClearCsrfToken,
}))

import { vi, describe, it, expect, beforeEach } from 'vitest'
import authService from './auth'

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('login calls POST /auth/login with credentials and returns data', async () => {
    const responseData = { user: { id: 'user-1' } }
    mockClient.post.mockResolvedValueOnce({ data: responseData })

    const credentials = { email: 'test@example.com', password: 'password123' }
    const result = await authService.login(credentials)

    expect(mockClient.post).toHaveBeenCalledWith('/auth/login', credentials)
    expect(result).toEqual(responseData)
  })

  it('logout calls POST /auth/logout and clears CSRF token', async () => {
    const responseData = { message: 'ok' }
    mockClient.post.mockResolvedValueOnce({ data: responseData })

    const result = await authService.logout()

    expect(mockClient.post).toHaveBeenCalledWith('/auth/logout')
    expect(mockClearCsrfToken).toHaveBeenCalled()
    expect(result).toEqual(responseData)
  })

  it('getCurrentUser calls GET /auth/me and returns data', async () => {
    const responseData = { user: { id: 'user-1' } }
    mockClient.get.mockResolvedValueOnce({ data: responseData })

    const result = await authService.getCurrentUser()

    expect(mockClient.get).toHaveBeenCalledWith('/auth/me')
    expect(result).toEqual(responseData)
  })

  it('me calls GET /auth/me and returns user field', async () => {
    const responseData = { user: { id: 'user-1' } }
    mockClient.get.mockResolvedValueOnce({ data: responseData })

    const result = await authService.me()

    expect(mockClient.get).toHaveBeenCalledWith('/auth/me')
    expect(result).toEqual(responseData.user)
  })

  it('register calls POST /auth/register with data', async () => {
    const responseData = { user: { id: 'new-user' } }
    mockClient.post.mockResolvedValueOnce({ data: responseData })

    const registerData = { email: 'new@example.com', password: 'pass123', name: 'New User' }
    const result = await authService.register(registerData)

    expect(mockClient.post).toHaveBeenCalledWith('/auth/register', registerData)
    expect(result).toEqual(responseData)
  })

  it('verifyEmail calls POST /auth/verify-email with token', async () => {
    const responseData = { message: 'Email verified' }
    mockClient.post.mockResolvedValueOnce({ data: responseData })

    const result = await authService.verifyEmail('verify-token-123')

    expect(mockClient.post).toHaveBeenCalledWith('/auth/verify-email', { token: 'verify-token-123' })
    expect(result).toEqual(responseData)
  })

  it('forgotPassword calls POST /auth/forgot-password with email', async () => {
    const responseData = { message: 'Reset email sent' }
    mockClient.post.mockResolvedValueOnce({ data: responseData })

    const result = await authService.forgotPassword('user@example.com')

    expect(mockClient.post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'user@example.com' })
    expect(result).toEqual(responseData)
  })

  it('resetPassword calls POST /auth/reset-password with token and password', async () => {
    const responseData = { message: 'Password reset' }
    mockClient.post.mockResolvedValueOnce({ data: responseData })

    const result = await authService.resetPassword('reset-token', 'newPassword123')

    expect(mockClient.post).toHaveBeenCalledWith('/auth/reset-password', { token: 'reset-token', password: 'newPassword123' })
    expect(result).toEqual(responseData)
  })

  it('sendVerificationEmail calls POST /auth/send-verification', async () => {
    const responseData = { message: 'Verification email sent' }
    mockClient.post.mockResolvedValueOnce({ data: responseData })

    const result = await authService.sendVerificationEmail()

    expect(mockClient.post).toHaveBeenCalledWith('/auth/send-verification')
    expect(result).toEqual(responseData)
  })

  it('sendPhoneCode calls POST /auth/send-phone-code with phone', async () => {
    const responseData = { message: 'Code sent' }
    mockClient.post.mockResolvedValueOnce({ data: responseData })

    const result = await authService.sendPhoneCode('+441234567890')

    expect(mockClient.post).toHaveBeenCalledWith('/auth/send-phone-code', { phone: '+441234567890' })
    expect(result).toEqual(responseData)
  })

  it('verifyPhone calls POST /auth/verify-phone with phone and code', async () => {
    const responseData = { message: 'Phone verified', user: { id: 'user-1' } }
    mockClient.post.mockResolvedValueOnce({ data: responseData })

    const result = await authService.verifyPhone('+441234567890', '123456')

    expect(mockClient.post).toHaveBeenCalledWith('/auth/verify-phone', { phone: '+441234567890', code: '123456' })
    expect(result).toEqual(responseData)
  })
})
