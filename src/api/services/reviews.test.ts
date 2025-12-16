const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}))

vi.mock('../client', () => ({ default: mockClient }))

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { reviewsService } from './reviews'

describe('reviewsService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('create calls POST /reviews', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { message: 'created', review: { id: 'r1' } } })
    const data = { transactionId: 't1', rating: 5, comment: 'Great!' } as Parameters<typeof reviewsService.create>[0]
    const result = await reviewsService.create(data)
    expect(mockClient.post).toHaveBeenCalledWith('/reviews', data)
    expect(result.message).toBe('created')
  })

  it('getById calls GET /reviews/:id', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { review: { id: 'r1', rating: 5 } } })
    const result = await reviewsService.getById('r1')
    expect(mockClient.get).toHaveBeenCalledWith('/reviews/r1')
    expect(result.review.id).toBe('r1')
  })

  it('getByUser calls GET /reviews/user/:userId', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [], total: 0 } })
    const result = await reviewsService.getByUser('u1')
    expect(mockClient.get).toHaveBeenCalledWith('/reviews/user/u1', { params: {} })
    expect(result).toEqual({ items: [], total: 0 })
  })

  it('getByUser accepts params', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [] } })
    await reviewsService.getByUser('u1', { page: 2 })
    expect(mockClient.get).toHaveBeenCalledWith('/reviews/user/u1', { params: { page: 2 } })
  })

  it('update calls PATCH /reviews/:id', async () => {
    mockClient.patch.mockResolvedValueOnce({ data: { message: 'updated', review: { id: 'r1' } } })
    const result = await reviewsService.update('r1', { rating: 4 })
    expect(mockClient.patch).toHaveBeenCalledWith('/reviews/r1', { rating: 4 })
    expect(result.message).toBe('updated')
  })

  it('delete calls DELETE /reviews/:id', async () => {
    mockClient.delete.mockResolvedValueOnce({ data: { message: 'deleted' } })
    const result = await reviewsService.delete('r1')
    expect(mockClient.delete).toHaveBeenCalledWith('/reviews/r1')
    expect(result.message).toBe('deleted')
  })
})

