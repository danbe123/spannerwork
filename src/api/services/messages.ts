import apiClient from '../client';
import type { Message, Conversation, CreateMessageData, User } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ConversationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface UnreadCountResponse {
  count: number;
}

export interface GetConversationResponse {
  messages: Message[];
  otherUser: User;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Service
// ============================================================================

export const messagesService = {
  async send(data: CreateMessageData): Promise<{ message: string; data: Message }> {
    const response = await apiClient.post<{ message: string; data: Message }>('/messages', data);
    return response.data;
  },

  async listConversations(): Promise<{ conversations: Conversation[] }> {
    const response = await apiClient.get<{ conversations: Conversation[] }>('/messages/conversations');
    return response.data;
  },

  async getConversation(userId: string, params: ConversationParams = {}): Promise<GetConversationResponse> {
    const response = await apiClient.get<GetConversationResponse>(
      `/messages/conversation/${userId}`, 
      { params }
    );
    return response.data;
  },

  async markAsRead(messageId: string): Promise<{ message: string }> {
    const response = await apiClient.patch<{ message: string }>(`/messages/${messageId}/read`);
    return response.data;
  },

  async markConversationAsRead(userId: string): Promise<{ message: string }> {
    const response = await apiClient.patch<{ message: string }>(`/messages/conversation/${userId}/read`);
    return response.data;
  },

  async getUnreadCount(): Promise<UnreadCountResponse> {
    const response = await apiClient.get<UnreadCountResponse>('/messages/unread/count');
    return response.data;
  },
};
