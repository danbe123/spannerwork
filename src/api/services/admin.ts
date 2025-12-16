import apiClient from '../client';
import type { User, Transaction, Dispute, Role, PaginatedResponse, Request, Category, Urgency } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface AdminAnalytics {
  users: {
    total: number;
    active: number;
    suspended: number;
    newThisMonth: number;
  };
  transactions: {
    total: number;
    pending: number;
    completed: number;
    totalRevenue: number;
  };
  listings: {
    tools: number;
    spaces: number;
    services: number;
  };
  disputes: {
    open: number;
    resolved: number;
  };
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  status?: string;
  role?: Role;
  search?: string;
  sort?: string;
}

export interface ListTransactionsParams {
  page?: number;
  limit?: number;
  status?: string;
  userId?: string;
  sort?: string;
}

export interface ListDisputesParams {
  page?: number;
  limit?: number;
  status?: string;
  sort?: string;
}

export interface ListAdminRequestsParams {
  page?: number;
  limit?: number;
  status?: string;
  category?: Category;
  urgency?: Urgency;
  userId?: string;
  sort?: string;
}

// ============================================================================
// Service
// ============================================================================

export const adminService = {
  async getAnalytics(): Promise<AdminAnalytics> {
    const response = await apiClient.get<AdminAnalytics>('/admin/analytics');
    return response.data;
  },

  async listUsers(params: ListUsersParams = {}): Promise<PaginatedResponse<User>> {
    const response = await apiClient.get<PaginatedResponse<User>>('/admin/users', { params });
    return response.data;
  },

  async suspendUser(userId: string, reason: string): Promise<{ message: string; user: User }> {
    const response = await apiClient.post<{ message: string; user: User }>(
      `/admin/users/${userId}/suspend`, 
      { reason }
    );
    return response.data;
  },

  async reactivateUser(userId: string): Promise<{ message: string; user: User }> {
    const response = await apiClient.post<{ message: string; user: User }>(
      `/admin/users/${userId}/reactivate`
    );
    return response.data;
  },

  async changeUserRole(userId: string, role: Role): Promise<{ message: string; user: User }> {
    const response = await apiClient.patch<{ message: string; user: User }>(
      `/admin/users/${userId}/role`, 
      { role }
    );
    return response.data;
  },

  async listTransactions(params: ListTransactionsParams = {}): Promise<PaginatedResponse<Transaction>> {
    const response = await apiClient.get<PaginatedResponse<Transaction>>('/admin/transactions', { params });
    return response.data;
  },

  async listDisputes(params: ListDisputesParams = {}): Promise<PaginatedResponse<Dispute>> {
    const response = await apiClient.get<PaginatedResponse<Dispute>>('/admin/disputes', { params });
    return response.data;
  },

  async resolveDispute(id: string, data: { status: string; resolution: string; refundAmountInitiator: number; refundAmountRespondent: number }): Promise<{ message: string; dispute: Dispute }> {
    const response = await apiClient.post<{ message: string; dispute: Dispute }>(
      `/admin/disputes/${id}/resolve`,
      data
    );
    return response.data;
  },

  async listRequests(params: ListAdminRequestsParams = {}): Promise<PaginatedResponse<Request>> {
    const response = await apiClient.get<PaginatedResponse<Request>>('/admin/requests', { params });
    return response.data;
  },
};
