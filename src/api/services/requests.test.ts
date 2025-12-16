const { mockInstance } = vi.hoisted(() => ({
  mockInstance: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}))

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockInstance),
  },
}))

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { requestsService } from './requests'

describe('requestsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('list calls GET /requests with params', async () => {
    mockInstance.get.mockResolvedValueOnce({ data: { items: [], total: 0 } })
    const result = await requestsService.list({ status: 'ACTIVE' })
    expect(mockInstance.get).toHaveBeenCalledWith('/requests', { params: { status: 'ACTIVE' } })
    expect(result).toEqual({ items: [], total: 0 })
  })

  it('list works with no params', async () => {
    mockInstance.get.mockResolvedValueOnce({ data: { items: [] } })
    await requestsService.list()
    expect(mockInstance.get).toHaveBeenCalledWith('/requests', { params: {} })
  })

  it('create calls POST /requests', async () => {
    mockInstance.post.mockResolvedValueOnce({ data: { message: 'created', request: { id: 'r1' } } })
    const data = { 
      title: 'Test', 
      description: 'Desc', 
      category: 'TOOLS',
      urgency: 'FLEXIBLE',
      budget: 50,
      rateType: 'FIXED',
      broadcastRadius: 10,
      postcode: 'B1 1AA'
    } as Parameters<typeof requestsService.create>[0]
    const result = await requestsService.create(data)
    expect(mockInstance.post).toHaveBeenCalledWith('/requests', data)
    expect(result.message).toBe('created')
  })

  it('getById calls GET /requests/:id', async () => {
    mockInstance.get.mockResolvedValueOnce({ data: { request: { id: 'r1', title: 'Test' } } })
    const result = await requestsService.getById('r1')
    expect(mockInstance.get).toHaveBeenCalledWith('/requests/r1')
    expect(result.request.id).toBe('r1')
  })

  it('update calls PATCH /requests/:id', async () => {
    mockInstance.patch.mockResolvedValueOnce({ data: { message: 'updated', request: { id: 'r1' } } })
    const result = await requestsService.update('r1', { title: 'Updated Title' })
    expect(mockInstance.patch).toHaveBeenCalledWith('/requests/r1', { title: 'Updated Title' })
    expect(result.message).toBe('updated')
  })

  it('delete calls DELETE /requests/:id', async () => {
    mockInstance.delete.mockResolvedValueOnce({ data: { message: 'deleted' } })
    const result = await requestsService.delete('r1')
    expect(mockInstance.delete).toHaveBeenCalledWith('/requests/r1')
    expect(result.message).toBe('deleted')
  })

  it('cancel calls POST /requests/:id/cancel', async () => {
    mockInstance.post.mockResolvedValueOnce({ data: { message: 'cancelled', request: { id: 'r1', status: 'CANCELLED' } } })
    const result = await requestsService.cancel('r1')
    expect(mockInstance.post).toHaveBeenCalledWith('/requests/r1/cancel')
    expect(result.message).toBe('cancelled')
  })
})
