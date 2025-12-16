import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGet = vi.fn()
const mockPost = vi.fn()

vi.mock('../client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}))

import { analyticsService } from './analytics.service'

describe('analyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getOverview calls GET /admin/analytics/overview and returns data', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: { totalUsers: 1 } } })

    const result = await analyticsService.getOverview()

    expect(mockGet).toHaveBeenCalledWith('/admin/analytics/overview')
    expect(result).toEqual({ totalUsers: 1 })
  })

  it('getRevenue calls GET /admin/analytics/revenue with params and returns data', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: { timeSeries: [], totals: {}, range: {} } } })

    const params = { startDate: '2025-01-01', endDate: '2025-01-31' }
    const result = await analyticsService.getRevenue(params)

    expect(mockGet).toHaveBeenCalledWith('/admin/analytics/revenue', { params })
    expect(result).toEqual({ timeSeries: [], totals: {}, range: {} })
  })

  it('getUserGrowth calls GET /admin/analytics/users with params and returns data', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: { timeSeries: [], totals: {}, range: {} } } })

    const params = { startDate: '2025-01-01', endDate: '2025-01-31' }
    const result = await analyticsService.getUserGrowth(params)

    expect(mockGet).toHaveBeenCalledWith('/admin/analytics/users', { params })
    expect(result).toEqual({ timeSeries: [], totals: {}, range: {} })
  })

  it('getListingTrends calls GET /admin/analytics/listings with params and returns data', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: { timeSeries: [], totals: {}, range: {} } } })

    const params = { startDate: '2025-01-01', endDate: '2025-01-31' }
    const result = await analyticsService.getListingTrends(params)

    expect(mockGet).toHaveBeenCalledWith('/admin/analytics/listings', { params })
    expect(result).toEqual({ timeSeries: [], totals: {}, range: {} })
  })

  it('getCategoryBreakdown calls GET /admin/analytics/categories and returns data', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: [{ category: 'TOOLS', count: 1, revenue: 100 }] } })

    const result = await analyticsService.getCategoryBreakdown()

    expect(mockGet).toHaveBeenCalledWith('/admin/analytics/categories')
    expect(result).toEqual([{ category: 'TOOLS', count: 1, revenue: 100 }])
  })

  it('getGeographicDistribution calls GET /admin/analytics/geographic and returns data', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: [{ region: 'London', userCount: 1, listingCount: 2, transactionCount: 3 }] } })

    const result = await analyticsService.getGeographicDistribution()

    expect(mockGet).toHaveBeenCalledWith('/admin/analytics/geographic')
    expect(result).toEqual([{ region: 'London', userCount: 1, listingCount: 2, transactionCount: 3 }])
  })

  it('getConversionFunnel calls GET /admin/analytics/funnel and returns data', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: { funnel: {}, conversionRates: {} } } })

    const result = await analyticsService.getConversionFunnel()

    expect(mockGet).toHaveBeenCalledWith('/admin/analytics/funnel')
    expect(result).toEqual({ funnel: {}, conversionRates: {} })
  })

  it('getTopPerformers calls GET /admin/analytics/top-performers with limit param and returns data', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: { topProviders: [], topEarners: [] } } })

    const result = await analyticsService.getTopPerformers(10)

    expect(mockGet).toHaveBeenCalledWith('/admin/analytics/top-performers', { params: { limit: 10 } })
    expect(result).toEqual({ topProviders: [], topEarners: [] })
  })

  it('clearCache calls POST /admin/analytics/cache/clear', async () => {
    mockPost.mockResolvedValue({ data: { success: true } })

    await analyticsService.clearCache()

    expect(mockPost).toHaveBeenCalledWith('/admin/analytics/cache/clear')
  })

  it('triggerSnapshot calls POST /admin/analytics/snapshot', async () => {
    mockPost.mockResolvedValue({ data: { success: true } })

    await analyticsService.triggerSnapshot()

    expect(mockPost).toHaveBeenCalledWith('/admin/analytics/snapshot')
  })
})
