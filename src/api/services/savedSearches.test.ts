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
import { savedSearchesService } from './savedSearches'

describe('savedSearchesService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('list calls GET /saved-searches', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { savedSearches: [] } })
    const result = await savedSearchesService.list()
    expect(mockClient.get).toHaveBeenCalledWith('/saved-searches')
    expect(result.savedSearches).toEqual([])
  })

  it('create calls POST /saved-searches', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { message: 'created', savedSearch: { id: 's1' } } })
    const data = { name: 'My Search', filters: { category: 'TOOLS' } }
    const result = await savedSearchesService.create(data)
    expect(mockClient.post).toHaveBeenCalledWith('/saved-searches', data)
    expect(result.message).toBe('created')
  })

  it('delete calls DELETE /saved-searches/:id', async () => {
    mockClient.delete.mockResolvedValueOnce({ data: { message: 'deleted' } })
    const result = await savedSearchesService.delete('s1')
    expect(mockClient.delete).toHaveBeenCalledWith('/saved-searches/s1')
    expect(result.message).toBe('deleted')
  })

  it('update calls PATCH /saved-searches/:id', async () => {
    mockClient.patch.mockResolvedValueOnce({ data: { message: 'updated', savedSearch: { id: 's1' } } })
    const data = { name: 'Updated Search' }
    const result = await savedSearchesService.update('s1', data)
    expect(mockClient.patch).toHaveBeenCalledWith('/saved-searches/s1', data)
    expect(result.message).toBe('updated')
  })
})

