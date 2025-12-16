const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}))

vi.mock('../client', () => ({ default: mockClient }))

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { referralsService } from './referrals'

describe('referralsService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createReferral calls POST /referrals', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { message: 'created', referral: { id: 'ref1' } } })
    const data = { referredEmail: 'a@b.com', referralCode: 'ABC123' }
    const result = await referralsService.createReferral(data)
    expect(mockClient.post).toHaveBeenCalledWith('/referrals', data)
    expect(result.message).toBe('created')
  })

  it('sendSmsReferral calls POST /referrals/sms', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { message: 'SMS sent' } })
    const data = { phone: '+447123456789', referralCode: 'ABC123' }
    const result = await referralsService.sendSmsReferral(data)
    expect(mockClient.post).toHaveBeenCalledWith('/referrals/sms', data)
    expect(result.message).toBe('SMS sent')
  })

  it('getMyReferrals calls GET /referrals/my', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { referrals: [{ id: 'ref1' }] } })
    const result = await referralsService.getMyReferrals()
    expect(mockClient.get).toHaveBeenCalledWith('/referrals/my')
    expect(result.referrals).toHaveLength(1)
  })

  it('getStats calls GET /referrals/stats', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { stats: { totalReferrals: 10 } } })
    const result = await referralsService.getStats()
    expect(mockClient.get).toHaveBeenCalledWith('/referrals/stats')
    expect(result.stats.totalReferrals).toBe(10)
  })

  it('getByCode calls GET /referrals/code/:code', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { referral: { id: 'ref1', code: 'ABC123' } } })
    const result = await referralsService.getByCode('ABC123')
    expect(mockClient.get).toHaveBeenCalledWith('/referrals/code/ABC123')
    expect(result.referral.code).toBe('ABC123')
  })

  it('completeReferral calls POST /referrals/complete', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { message: 'completed', referral: { id: 'ref1' } } })
    const data = { referralCode: 'ABC123', referredUserId: 'u2' }
    const result = await referralsService.completeReferral(data)
    expect(mockClient.post).toHaveBeenCalledWith('/referrals/complete', data)
    expect(result.message).toBe('completed')
  })
})

