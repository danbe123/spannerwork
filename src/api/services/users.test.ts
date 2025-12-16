const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    get: vi.fn(),
    patch: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}))

vi.mock('../client', () => ({ default: mockClient }))

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { usersService } from './users'

describe('usersService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getById calls GET /users/:id', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    const result = await usersService.getById('u1')
    expect(mockClient.get).toHaveBeenCalledWith('/users/u1')
    expect(result.user.id).toBe('u1')
  })

  it('update calls PATCH /users/:id', async () => {
    mockClient.patch.mockResolvedValueOnce({ data: { message: 'updated', user: { id: 'u1' } } })
    const data = { name: 'Updated Name', bio: 'New bio' }
    const result = await usersService.update('u1', data)
    expect(mockClient.patch).toHaveBeenCalledWith('/users/u1', data)
    expect(result.message).toBe('updated')
  })

  it('getReviews calls GET /users/:id/reviews', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [], total: 0 } })
    const result = await usersService.getReviews('u1')
    expect(mockClient.get).toHaveBeenCalledWith('/users/u1/reviews', { params: {} })
    expect(result).toEqual({ items: [], total: 0 })
  })

  it('getReviews accepts params', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [] } })
    await usersService.getReviews('u1', { page: 2, limit: 10 })
    expect(mockClient.get).toHaveBeenCalledWith('/users/u1/reviews', { params: { page: 2, limit: 10 } })
  })

  it('getListings calls GET /users/:id/listings', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { tools: [], spaces: [], services: [] } })
    const result = await usersService.getListings('u1')
    expect(mockClient.get).toHaveBeenCalledWith('/users/u1/listings')
    expect(result.tools).toEqual([])
  })
})

