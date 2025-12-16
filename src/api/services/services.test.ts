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
import { servicesService } from './services'

describe('servicesService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('list calls GET /services with params', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [], total: 0 } })
    const result = await servicesService.list({ search: 'welding' })
    expect(mockClient.get).toHaveBeenCalledWith('/services', { params: { search: 'welding' } })
    expect(result).toEqual({ items: [], total: 0 })
  })

  it('list works with no params', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [] } })
    await servicesService.list()
    expect(mockClient.get).toHaveBeenCalledWith('/services', { params: {} })
  })

  it('create calls POST /services', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { message: 'created', service: { id: 'svc1' } } })
    const data = { name: 'Welding', description: 'Expert welding', hourlyRate: 30 } as Parameters<typeof servicesService.create>[0]
    const result = await servicesService.create(data)
    expect(mockClient.post).toHaveBeenCalledWith('/services', data)
    expect(result.message).toBe('created')
  })

  it('getById calls GET /services/:id', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { service: { id: 'svc1', name: 'Welding' } } })
    const result = await servicesService.getById('svc1')
    expect(mockClient.get).toHaveBeenCalledWith('/services/svc1')
    expect(result.service.id).toBe('svc1')
  })

  it('update calls PATCH /services/:id', async () => {
    mockClient.patch.mockResolvedValueOnce({ data: { message: 'updated', service: { id: 'svc1' } } })
    const result = await servicesService.update('svc1', { name: 'Updated Service' })
    expect(mockClient.patch).toHaveBeenCalledWith('/services/svc1', { name: 'Updated Service' })
    expect(result.message).toBe('updated')
  })

  it('delete calls DELETE /services/:id', async () => {
    mockClient.delete.mockResolvedValueOnce({ data: { message: 'deleted' } })
    const result = await servicesService.delete('svc1')
    expect(mockClient.delete).toHaveBeenCalledWith('/services/svc1')
    expect(result.message).toBe('deleted')
  })

  it('checkAvailability calls GET /services/:id/availability', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { available: true } })
    const params = { startDate: '2024-01-01', endDate: '2024-01-05' }
    const result = await servicesService.checkAvailability('svc1', params)
    expect(mockClient.get).toHaveBeenCalledWith('/services/svc1/availability', { params })
    expect(result.available).toBe(true)
  })
})

