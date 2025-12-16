import request from 'supertest'
import { app } from '../../src/app.js'
import { authService } from '../../src/services/auth.service.js'
import { transactionService } from '../../src/services/transaction.service.js'
import { vi, describe, it, expect, beforeEach } from 'vitest'

describe('Transaction routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('GET /api/v1/transactions returns list for authenticated user', async () => {
    vi.spyOn(authService, 'getUserBySession').mockResolvedValueOnce({
      id: 'user-1',
    } as any)

    const listMock = vi.spyOn(transactionService, 'list').mockResolvedValueOnce({
      transactions: [
        {
          id: 'tx-1',
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    } as any)

    const res = await request(app)
      .get('/api/v1/transactions')
      .set('Cookie', ['sessionId=session-1'])

    expect(res.status).toBe(200)
    expect(listMock).toHaveBeenCalledWith('user-1', {
      page: undefined,
      limit: undefined,
      status: undefined,
      asProvider: false,
    })
    expect(res.body.transactions[0].id).toBe('tx-1')
  })

  it('GET /api/v1/transactions/:id returns 403 when user not authorized', async () => {
    // Use a valid CUID format for transaction ID
    const txId = 'clxxxxxxxxxxxxxxxxxxxxxxxxx'

    vi.spyOn(authService, 'getUserBySession').mockResolvedValueOnce({
      id: 'user-1',
    } as any)

    vi.spyOn(transactionService, 'getById').mockResolvedValueOnce({
      id: txId,
      userId: 'other-user',
      providerId: 'other-provider',
    } as any)

    const res = await request(app)
      .get(`/api/v1/transactions/${txId}`)
      .set('Cookie', ['sessionId=session-1'])

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Forbidden')
  })
})
