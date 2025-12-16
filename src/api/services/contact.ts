import apiClient from '../client';

// ============================================================================
// Types
// ============================================================================

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// Service
// ============================================================================

export const contactService = {
  /**
   * Submit contact form
   */
  async submitContactForm(data: ContactFormData): Promise<ContactResponse> {
    const response = await apiClient.post<ContactResponse>('/contact', data);
    return response.data;
  },
};
