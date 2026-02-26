import apiClient from '../client';

// ============================================================================
// Types
// ============================================================================

export interface InvoiceSettings {
  id: string;
  userId: string;
  businessName: string | null;
  logoUrl: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  vatNumber: string | null;
  vatRegistered: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateInvoiceSettingsData {
  businessName?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  city?: string | null;
  postcode?: string | null;
  country?: string | null;
  vatNumber?: string | null;
  vatRegistered?: boolean;
}

export interface LineItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  transactionId: string;
  userId: string;
  type: 'RENTER' | 'PROVIDER';
  recipientName: string;
  recipientAddress: string | null;
  recipientVat: string | null;
  issueDate: string;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  lineItems: LineItem[];
  pdfUrl: string | null;
  purchaseOrder: string | null;
  createdAt: string;
  transaction?: {
    id: string;
    startDate: string;
    endDate: string;
    status: string;
  };
}

export interface ListInvoicesParams {
  type?: 'RENTER' | 'PROVIDER';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface TaxSummary {
  year: number;
  totalIncome: number;
  totalExpenses: number;
  totalVatCollected: number;
  totalVatPaid: number;
  transactionCount: number;
  invoiceCount: number;
  byMonth: Array<{
    month: number;
    income: number;
    expenses: number;
    vatCollected: number;
    vatPaid: number;
  }>;
}

// ============================================================================
// Service
// ============================================================================

export const invoicesService = {
  // Settings
  async getSettings(): Promise<{ settings: InvoiceSettings }> {
    const response = await apiClient.get<{ settings: InvoiceSettings }>('/invoices/settings');
    return response.data;
  },

  async updateSettings(data: UpdateInvoiceSettingsData): Promise<{ message: string; settings: InvoiceSettings }> {
    const response = await apiClient.patch<{ message: string; settings: InvoiceSettings }>(
      '/invoices/settings',
      data
    );
    return response.data;
  },

  // Invoices
  async list(params: ListInvoicesParams = {}): Promise<{
    invoices: Invoice[];
    total: number;
    page: number;
    limit: number;
  }> {
    const response = await apiClient.get<{
      invoices: Invoice[];
      total: number;
      page: number;
      limit: number;
    }>('/invoices', { params });
    return response.data;
  },

  async createForTransaction(
    transactionId: string,
    type: 'RENTER' | 'PROVIDER',
    purchaseOrder?: string
  ): Promise<{ message: string; invoice: Invoice }> {
    const response = await apiClient.post<{ message: string; invoice: Invoice }>(
      `/invoices/transaction/${transactionId}`,
      { type, purchaseOrder }
    );
    return response.data;
  },

  async downloadPdf(invoiceId: string): Promise<Blob> {
    const response = await apiClient.get<Blob>(`/invoices/${invoiceId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  getDownloadUrl(invoiceId: string): string {
    return `/api/v1/invoices/${invoiceId}/download`;
  },

  async exportCsv(startDate?: string, endDate?: string): Promise<Blob> {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const response = await apiClient.get<Blob>('/invoices/export/csv', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  async getTaxSummary(year: number): Promise<{ summary: TaxSummary }> {
    const response = await apiClient.get<{ summary: TaxSummary }>(`/invoices/tax-summary/${year}`);
    return response.data;
  },
};
