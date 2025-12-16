import apiClient from '../client';
import type { Transaction, CreateTransactionData, TransactionStatus, PaginatedResponse } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ListTransactionsParams {
  page?: number;
  limit?: number;
  status?: TransactionStatus;
  asProvider?: boolean;
  requestId?: string;
}

// ============================================================================
// Service
// ============================================================================

export const transactionsService = {
  async list(params: ListTransactionsParams = {}): Promise<PaginatedResponse<Transaction>> {
    const response = await apiClient.get<PaginatedResponse<Transaction>>('/transactions', { params });
    return response.data;
  },

  async create(data: CreateTransactionData): Promise<{ message: string; transaction: Transaction }> {
    const response = await apiClient.post<{ message: string; transaction: Transaction }>('/transactions', data);
    return response.data;
  },

  async getById(id: string): Promise<{ transaction: Transaction }> {
    const response = await apiClient.get<{ transaction: Transaction }>(`/transactions/${id}`);
    return response.data;
  },

  async updateStatus(id: string, status: TransactionStatus): Promise<{ message: string; transaction: Transaction }> {
    const response = await apiClient.patch<{ message: string; transaction: Transaction }>(
      `/transactions/${id}/status`, 
      { status }
    );
    return response.data;
  },

  async complete(id: string): Promise<{ message: string; transaction: Transaction }> {
    const response = await apiClient.post<{ message: string; transaction: Transaction }>(
      `/transactions/${id}/complete`
    );
    return response.data;
  },

  async cancel(id: string): Promise<{ message: string; transaction: Transaction }> {
    const response = await apiClient.post<{ message: string; transaction: Transaction }>(
      `/transactions/${id}/cancel`
    );
    return response.data;
  },
};
