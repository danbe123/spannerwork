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
import { toolsService } from './tools'

describe('toolsService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('list calls GET /tools with params', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [], total: 0 } })
    const result = await toolsService.list({ search: 'drill' })
    expect(mockClient.get).toHaveBeenCalledWith('/tools', { params: { search: 'drill' } })
    expect(result).toEqual({ items: [], total: 0 })
  })

  it('list works with no params', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [] } })
    await toolsService.list()
    expect(mockClient.get).toHaveBeenCalledWith('/tools', { params: {} })
  })

  it('create calls POST /tools', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { message: 'created', tool: { id: 't1' } } })
    const data = { name: 'Drill', description: 'Power drill', dailyRate: 10 } as Parameters<typeof toolsService.create>[0]
    const result = await toolsService.create(data)
    expect(mockClient.post).toHaveBeenCalledWith('/tools', data)
    expect(result.message).toBe('created')
  })

  it('getById calls GET /tools/:id', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { tool: { id: 't1', name: 'Drill' } } })
    const result = await toolsService.getById('t1')
    expect(mockClient.get).toHaveBeenCalledWith('/tools/t1')
    expect(result.tool.id).toBe('t1')
  })

  it('update calls PATCH /tools/:id', async () => {
    mockClient.patch.mockResolvedValueOnce({ data: { message: 'updated', tool: { id: 't1' } } })
    const result = await toolsService.update('t1', { name: 'Updated Drill' })
    expect(mockClient.patch).toHaveBeenCalledWith('/tools/t1', { name: 'Updated Drill' })
    expect(result.message).toBe('updated')
  })

  it('delete calls DELETE /tools/:id', async () => {
    mockClient.delete.mockResolvedValueOnce({ data: { message: 'deleted' } })
    const result = await toolsService.delete('t1')
    expect(mockClient.delete).toHaveBeenCalledWith('/tools/t1')
    expect(result.message).toBe('deleted')
  })

  it('checkAvailability calls GET /tools/:id/availability', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { available: true } })
    const params = { startDate: '2024-01-01', endDate: '2024-01-05' }
    const result = await toolsService.checkAvailability('t1', params)
    expect(mockClient.get).toHaveBeenCalledWith('/tools/t1/availability', { params })
    expect(result.available).toBe(true)
  })
})

