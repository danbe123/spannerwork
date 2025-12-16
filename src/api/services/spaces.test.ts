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
import { spacesService } from './spaces'

describe('spacesService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('list calls GET /spaces with params', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [], total: 0 } })
    const result = await spacesService.list({ search: 'workshop' })
    expect(mockClient.get).toHaveBeenCalledWith('/spaces', { params: { search: 'workshop' } })
    expect(result).toEqual({ items: [], total: 0 })
  })

  it('list works with no params', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [] } })
    await spacesService.list()
    expect(mockClient.get).toHaveBeenCalledWith('/spaces', { params: {} })
  })

  it('create calls POST /spaces', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { message: 'created', space: { id: 's1' } } })
    const data = { name: 'Workshop', description: 'Nice workshop', dailyRate: 50 } as Parameters<typeof spacesService.create>[0]
    const result = await spacesService.create(data)
    expect(mockClient.post).toHaveBeenCalledWith('/spaces', data)
    expect(result.message).toBe('created')
  })

  it('getById calls GET /spaces/:id', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { space: { id: 's1', name: 'Workshop' } } })
    const result = await spacesService.getById('s1')
    expect(mockClient.get).toHaveBeenCalledWith('/spaces/s1')
    expect(result.space.id).toBe('s1')
  })

  it('update calls PATCH /spaces/:id', async () => {
    mockClient.patch.mockResolvedValueOnce({ data: { message: 'updated', space: { id: 's1' } } })
    const result = await spacesService.update('s1', { name: 'Updated Workshop' })
    expect(mockClient.patch).toHaveBeenCalledWith('/spaces/s1', { name: 'Updated Workshop' })
    expect(result.message).toBe('updated')
  })

  it('delete calls DELETE /spaces/:id', async () => {
    mockClient.delete.mockResolvedValueOnce({ data: { message: 'deleted' } })
    const result = await spacesService.delete('s1')
    expect(mockClient.delete).toHaveBeenCalledWith('/spaces/s1')
    expect(result.message).toBe('deleted')
  })

  it('checkAvailability calls GET /spaces/:id/availability', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { available: true } })
    const params = { startDate: '2024-01-01', endDate: '2024-01-05' }
    const result = await spacesService.checkAvailability('s1', params)
    expect(mockClient.get).toHaveBeenCalledWith('/spaces/s1/availability', { params })
    expect(result.available).toBe(true)
  })
})

