const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}))

vi.mock('../client', () => ({ default: mockClient }))

import { vi, describe, it, beforeEach } from 'vitest'
import { contactService } from './contact'

describe('contactService', () => {
  beforeEach(() => vi.clearAllMocks())
  it('submitContactForm posts to /contact', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { success: true } })
    await contactService.submitContactForm({ name: 'A', email: 'a@b.com', subject: 'S', message: 'M' })
    expect(mockClient.post).toHaveBeenCalledWith('/contact', { name: 'A', email: 'a@b.com', subject: 'S', message: 'M' })
  })
})

