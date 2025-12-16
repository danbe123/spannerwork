const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    get: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}))

vi.mock('../client', () => ({ default: mockClient }))

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { statsService } from './stats'

describe('statsService', () => {
  beforeEach(() => vi.clearAllMocks())
  it('getPublicStats calls GET /stats', async () => {
    // Service unwraps response.data.data
    mockClient.get.mockResolvedValueOnce({ data: { data: { users: { total: 100 } } } })
    const out = await statsService.getPublicStats()
    expect(mockClient.get).toHaveBeenCalledWith('/stats')
    expect(out.users.total).toBe(100)
  })
})
