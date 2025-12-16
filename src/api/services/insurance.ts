import apiClient from '../client';

// ============================================================================
// Types
// ============================================================================

export type InsuranceStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export type InsuranceType = 'PUBLIC_LIABILITY' | 'PROFESSIONAL_INDEMNITY' | 'EMPLOYERS_LIABILITY' | 'TOOL_COVER' | 'OTHER';

export interface InsuranceDocument {
  id: string;
  userId: string;
  documentUrl: string;
  documentType: InsuranceType;
  provider: string | null;
  policyNumber: string | null;
  coverageAmount: number | null;
  expiryDate: string | null;
  status: InsuranceStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
  };
}

export interface InsuranceStatusSummary {
  hasValidInsurance: boolean;
  canListServices: boolean;
  documents: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
  };
  validPublicLiability: InsuranceDocument | null;
  expiringSoon: InsuranceDocument[];
  latestDocument: InsuranceDocument | null;
}

export interface PaginatedInsuranceResponse {
  success: boolean;
  data: InsuranceDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Provider Insurance Service (for mechanics uploading their docs)
// ============================================================================

export const insuranceService = {
  async uploadDocument(data: {
    documentUrl: string;
    documentType?: InsuranceType;
    provider?: string;
    policyNumber?: string;
    coverageAmount?: number;
    expiryDate?: string;
  }): Promise<{ success: boolean; data: InsuranceDocument; message: string }> {
    const response = await apiClient.post('/insurance/upload', data);
    return response.data;
  },

  async getMyDocuments(): Promise<{ success: boolean; data: InsuranceDocument[] }> {
    const response = await apiClient.get('/insurance/my-documents');
    return response.data;
  },

  async getMyStatus(): Promise<{ success: boolean; data: InsuranceStatusSummary }> {
    const response = await apiClient.get('/insurance/status');
    return response.data;
  },

  async deleteDocument(id: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(`/insurance/${id}`);
    return response.data;
  },
};

// ============================================================================
// Admin Insurance Service (for reviewing/approving docs)
// ============================================================================

export const adminInsuranceService = {
  async getPendingDocuments(params: { page?: number; limit?: number } = {}): Promise<PaginatedInsuranceResponse> {
    const response = await apiClient.get('/admin/insurance/pending', { params });
    return response.data;
  },

  async getExpiringDocuments(days: number = 30): Promise<{ success: boolean; data: InsuranceDocument[]; count: number }> {
    const response = await apiClient.get('/admin/insurance/expiring', { params: { days } });
    return response.data;
  },

  async getDocumentById(id: string): Promise<{ success: boolean; data: InsuranceDocument }> {
    const response = await apiClient.get(`/admin/insurance/${id}`);
    return response.data;
  },

  async getUserDocuments(userId: string): Promise<{ 
    success: boolean; 
    data: { 
      documents: InsuranceDocument[]; 
      status: InsuranceStatusSummary;
    } 
  }> {
    const response = await apiClient.get(`/admin/insurance/user/${userId}`);
    return response.data;
  },

  async approveDocument(id: string): Promise<{ success: boolean; data: InsuranceDocument; message: string }> {
    const response = await apiClient.post(`/admin/insurance/${id}/approve`);
    return response.data;
  },

  async rejectDocument(id: string, reason: string): Promise<{ success: boolean; data: InsuranceDocument; message: string }> {
    const response = await apiClient.post(`/admin/insurance/${id}/reject`, { reason });
    return response.data;
  },
};
