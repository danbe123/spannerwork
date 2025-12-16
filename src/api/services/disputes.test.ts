const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}))

vi.mock('../client', () => ({ default: mockClient }))

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { disputesService } from './disputes'

describe('disputesService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('create calls POST /disputes', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { message: 'created', dispute: { id: 'd1' } } })
    const data = { transactionId: 't1', reason: 'Item damaged' } as Parameters<typeof disputesService.create>[0]
    const result = await disputesService.create(data)
    expect(mockClient.post).toHaveBeenCalledWith('/disputes', data)
    expect(result.message).toBe('created')
  })

  it('list calls GET /disputes with params', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [], total: 0 } })
    const result = await disputesService.list({ status: 'OPEN' })
    expect(mockClient.get).toHaveBeenCalledWith('/disputes', { params: { status: 'OPEN' } })
    expect(result).toEqual({ items: [], total: 0 })
  })

  it('list works with no params', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [] } })
    await disputesService.list()
    expect(mockClient.get).toHaveBeenCalledWith('/disputes', { params: {} })
  })

  it('getById calls GET /disputes/:id', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { dispute: { id: 'd1', reason: 'Damaged' } } })
    const result = await disputesService.getById('d1')
    expect(mockClient.get).toHaveBeenCalledWith('/disputes/d1')
    expect(result.dispute.id).toBe('d1')
  })

  it('resolve calls POST /disputes/:id/resolve', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { message: 'resolved', dispute: { id: 'd1' } } })
    const data = { resolution: 'Full refund', refundAmountInitiator: 50 }
    const result = await disputesService.resolve('d1', data)
    expect(mockClient.post).toHaveBeenCalledWith('/disputes/d1/resolve', data)
    expect(result.message).toBe('resolved')
  })

  it('updateStatus calls PATCH /disputes/:id/status', async () => {
    mockClient.patch.mockResolvedValueOnce({ data: { message: 'status updated', dispute: { id: 'd1' } } })
    const result = await disputesService.updateStatus('d1', 'RESOLVED')
    expect(mockClient.patch).toHaveBeenCalledWith('/disputes/d1/status', { status: 'RESOLVED' })
    expect(result.message).toBe('status updated')
  })
})
