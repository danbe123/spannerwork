const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}))

vi.mock('../client', () => ({ default: mockClient }))

import { vi, describe, it, beforeEach, expect } from 'vitest'
import { adminService } from './admin'

describe('adminService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getAnalytics calls GET /admin/analytics', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { users: { total: 100 } } })
    const result = await adminService.getAnalytics()
    expect(mockClient.get).toHaveBeenCalledWith('/admin/analytics')
    expect(result).toEqual({ users: { total: 100 } })
  })

  it('listUsers calls GET /admin/users with params', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [], total: 0 } })
    const params = { page: 1, limit: 10, status: 'active' }
    const result = await adminService.listUsers(params)
    expect(mockClient.get).toHaveBeenCalledWith('/admin/users', { params })
    expect(result).toEqual({ items: [], total: 0 })
  })

  it('listUsers works with no params', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [] } })
    await adminService.listUsers()
    expect(mockClient.get).toHaveBeenCalledWith('/admin/users', { params: {} })
  })

  it('suspendUser calls POST /admin/users/:id/suspend', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { message: 'suspended', user: { id: 'u1' } } })
    const result = await adminService.suspendUser('u1', 'violation')
    expect(mockClient.post).toHaveBeenCalledWith('/admin/users/u1/suspend', { reason: 'violation' })
    expect(result.message).toBe('suspended')
  })

  it('reactivateUser calls POST /admin/users/:id/reactivate', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { message: 'reactivated', user: { id: 'u1' } } })
    const result = await adminService.reactivateUser('u1')
    expect(mockClient.post).toHaveBeenCalledWith('/admin/users/u1/reactivate')
    expect(result.message).toBe('reactivated')
  })

  it('changeUserRole calls PATCH /admin/users/:id/role', async () => {
    mockClient.patch.mockResolvedValueOnce({ data: { message: 'role changed', user: { id: 'u1', role: 'ADMIN' } } })
    const result = await adminService.changeUserRole('u1', 'ADMIN')
    expect(mockClient.patch).toHaveBeenCalledWith('/admin/users/u1/role', { role: 'ADMIN' })
    expect(result.message).toBe('role changed')
  })

  it('listTransactions calls GET /admin/transactions', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [], total: 0 } })
    const params = { page: 1, status: 'pending' }
    const result = await adminService.listTransactions(params)
    expect(mockClient.get).toHaveBeenCalledWith('/admin/transactions', { params })
    expect(result).toEqual({ items: [], total: 0 })
  })

  it('listTransactions works with no params', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [] } })
    await adminService.listTransactions()
    expect(mockClient.get).toHaveBeenCalledWith('/admin/transactions', { params: {} })
  })

  it('listDisputes calls GET /admin/disputes', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [], total: 0 } })
    const params = { status: 'open' }
    const result = await adminService.listDisputes(params)
    expect(mockClient.get).toHaveBeenCalledWith('/admin/disputes', { params })
    expect(result).toEqual({ items: [], total: 0 })
  })

  it('listDisputes works with no params', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [] } })
    await adminService.listDisputes()
    expect(mockClient.get).toHaveBeenCalledWith('/admin/disputes', { params: {} })
  })

  it('resolveDispute calls POST /admin/disputes/:id/resolve', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { message: 'resolved', dispute: { id: 'd1' } } })
    const data = { status: 'resolved', resolution: 'refund', refundAmountInitiator: 50, refundAmountRespondent: 0 }
    const result = await adminService.resolveDispute('d1', data)
    expect(mockClient.post).toHaveBeenCalledWith('/admin/disputes/d1/resolve', data)
    expect(result.message).toBe('resolved')
  })

  it('listRequests calls GET /admin/requests', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [], total: 0 } })
    const params = { page: 1, category: 'TOOLS' as const }
    const result = await adminService.listRequests(params)
    expect(mockClient.get).toHaveBeenCalledWith('/admin/requests', { params })
    expect(result).toEqual({ items: [], total: 0 })
  })

  it('listRequests works with no params', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { items: [] } })
    await adminService.listRequests()
    expect(mockClient.get).toHaveBeenCalledWith('/admin/requests', { params: {} })
  })
})

