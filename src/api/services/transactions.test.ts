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
import { transactionsService } from './transactions'

describe('transactionsService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('list calls GET /transactions with params', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [], total: 0 } })
    const result = await transactionsService.list({ status: 'PENDING' })
    expect(mockClient.get).toHaveBeenCalledWith('/transactions', { params: { status: 'PENDING' } })
    expect(result).toEqual({ items: [], total: 0 })
  })

  it('list works with no params', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [] } })
    await transactionsService.list()
    expect(mockClient.get).toHaveBeenCalledWith('/transactions', { params: {} })
  })

  it('create calls POST /transactions', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { message: 'created', transaction: { id: 't1' } } })
    const data = { 
      requestId: 'r1', 
      providerId: 'u2', 
      amount: 100,
      startDate: '2024-01-01',
      endDate: '2024-01-05'
    } as Parameters<typeof transactionsService.create>[0]
    const result = await transactionsService.create(data)
    expect(mockClient.post).toHaveBeenCalledWith('/transactions', data)
    expect(result.message).toBe('created')
  })

  it('getById calls GET /transactions/:id', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { transaction: { id: 't1' } } })
    const result = await transactionsService.getById('t1')
    expect(mockClient.get).toHaveBeenCalledWith('/transactions/t1')
    expect(result.transaction.id).toBe('t1')
  })

  it('updateStatus calls PATCH /transactions/:id/status', async () => {
    mockClient.patch.mockResolvedValueOnce({ data: { message: 'status updated', transaction: { id: 't1' } } })
    const result = await transactionsService.updateStatus('t1', 'COMPLETED')
    expect(mockClient.patch).toHaveBeenCalledWith('/transactions/t1/status', { status: 'COMPLETED' })
    expect(result.message).toBe('status updated')
  })

  it('complete calls POST /transactions/:id/complete', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { message: 'completed', transaction: { id: 't1' } } })
    const result = await transactionsService.complete('t1')
    expect(mockClient.post).toHaveBeenCalledWith('/transactions/t1/complete')
    expect(result.message).toBe('completed')
  })

  it('cancel calls POST /transactions/:id/cancel', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { message: 'cancelled', transaction: { id: 't1' } } })
    const result = await transactionsService.cancel('t1')
    expect(mockClient.post).toHaveBeenCalledWith('/transactions/t1/cancel')
    expect(result.message).toBe('cancelled')
  })
})

