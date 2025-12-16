const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}))

vi.mock('../client', () => ({ default: mockClient }))

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { messagesService } from './messages'

describe('messagesService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('send posts to /messages', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { message: 'sent', data: { id: 'm1' } } })
    const out = await messagesService.send({ content: 'hi', recipientId: 'u2' })
    expect(mockClient.post).toHaveBeenCalledWith('/messages', { content: 'hi', recipientId: 'u2' })
    expect(out.message).toBe('sent')
  })

  it('listConversations calls GET /messages/conversations', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { conversations: [{ id: 'c1' }] } })
    const result = await messagesService.listConversations()
    expect(mockClient.get).toHaveBeenCalledWith('/messages/conversations')
    expect(result.conversations).toHaveLength(1)
  })

  it('getConversation calls GET /messages/conversation/:userId', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { messages: [], otherUser: { id: 'u2' } } })
    const result = await messagesService.getConversation('u2')
    expect(mockClient.get).toHaveBeenCalledWith('/messages/conversation/u2', { params: {} })
    expect(result.otherUser.id).toBe('u2')
  })

  it('getConversation accepts params', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { messages: [], otherUser: { id: 'u2' } } })
    const params = { page: 2, limit: 20 }
    await messagesService.getConversation('u2', params)
    expect(mockClient.get).toHaveBeenCalledWith('/messages/conversation/u2', { params })
  })

  it('markAsRead calls PATCH /messages/:id/read', async () => {
    mockClient.patch.mockResolvedValueOnce({ data: { message: 'marked as read' } })
    const result = await messagesService.markAsRead('m1')
    expect(mockClient.patch).toHaveBeenCalledWith('/messages/m1/read')
    expect(result.message).toBe('marked as read')
  })

  it('markConversationAsRead calls PATCH /messages/conversation/:userId/read', async () => {
    mockClient.patch.mockResolvedValueOnce({ data: { message: 'conversation marked as read' } })
    const result = await messagesService.markConversationAsRead('u2')
    expect(mockClient.patch).toHaveBeenCalledWith('/messages/conversation/u2/read')
    expect(result.message).toBe('conversation marked as read')
  })

  it('getUnreadCount calls GET /messages/unread/count', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { count: 5 } })
    const result = await messagesService.getUnreadCount()
    expect(mockClient.get).toHaveBeenCalledWith('/messages/unread/count')
    expect(result.count).toBe(5)
  })
})

