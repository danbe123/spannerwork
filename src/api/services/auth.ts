import apiClient, { clearCsrfToken, refreshCsrfToken } from '../client';
import type { User, AuthResponse, LoginCredentials, RegisterData } from '@/types';

export interface CurrentUserResponse {
  user: User;
}

export interface CheckEmailResponse {
  exists: boolean;
  firstName?: string | null;
  avatarUrl?: string | null;
}

export const authService = {
  /**
   * Check if email exists (for email-first auth flow)
   */
  async checkEmail(email: string): Promise<CheckEmailResponse> {
    const response = await apiClient.post<CheckEmailResponse>('/auth/check-email', { email });
    return response.data;
  },

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    clearCsrfToken();
    void refreshCsrfToken();
    return response.data;
  },

  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    clearCsrfToken();
    void refreshCsrfToken();
    return response.data;
  },

  /**
   * Logout user
   */
  async logout(): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>('/auth/logout');
    clearCsrfToken();
    return response.data;
  },

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<CurrentUserResponse> {
    const response = await apiClient.get<CurrentUserResponse>('/auth/me');
    return response.data;
  },

  /**
   * Get current user (returns user object directly)
   */
  async me(): Promise<User> {
    const response = await apiClient.get<CurrentUserResponse>('/auth/me');
    return response.data.user;
  },

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>('/auth/verify-email', { token });
    return response.data;
  },

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>('/auth/forgot-password', { email });
    return response.data;
  },

  /**
   * Reset password with token
   */
  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>('/auth/reset-password', { token, password });
    return response.data;
  },

  /**
   * Send email verification link to current user
   */
  async sendVerificationEmail(): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>('/auth/send-verification');
    return response.data;
  },

  /**
   * Send phone verification code
   */
  async sendPhoneCode(phone: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>('/auth/send-phone-code', { phone });
    return response.data;
  },

  /**
   * Verify phone number with code
   */
  async verifyPhone(phone: string, code: string): Promise<{ message: string; user: User }> {
    const response = await apiClient.post<{ message: string; user: User }>('/auth/verify-phone', { phone, code });
    return response.data;
  },

  /**
   * Send magic link email for passwordless login
   */
  async sendMagicLink(email: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>('/auth/send-magic-link', { email });
    return response.data;
  },

  /**
   * Verify magic link and login
   */
  async verifyMagicLink(token: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/verify-magic-link', { token });
    clearCsrfToken();
    void refreshCsrfToken();
    return response.data;
  },

  /**
   * Get enabled OAuth providers
   */
  async getOAuthProviders(): Promise<{ providers: { google: boolean; facebook: boolean; apple: boolean } }> {
    const response = await apiClient.get<{ providers: { google: boolean; facebook: boolean; apple: boolean } }>('/auth/oauth/providers');
    return response.data;
  },
};

export default authService;
