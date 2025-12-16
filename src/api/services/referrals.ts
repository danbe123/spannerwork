import apiClient from '../client';
import type { Referral } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface CreateReferralData {
  referredEmail?: string;
  referralCode: string;
}

export interface SendSmsReferralData {
  phone: string;
  referralCode: string;
}

export interface CompleteReferralData {
  referralCode: string;
  referredUserId: string;
}

export interface ReferralStats {
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalRewards: number;
}

// ============================================================================
// Service
// ============================================================================

export const referralsService = {
  /**
   * Create a referral invitation
   */
  async createReferral(data: CreateReferralData): Promise<{ message: string; referral: Referral }> {
    const response = await apiClient.post<{ message: string; referral: Referral }>('/referrals', data);
    return response.data;
  },

  /**
   * Send a referral invitation via SMS
   */
  async sendSmsReferral(data: SendSmsReferralData): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>('/referrals/sms', data);
    return response.data;
  },

  /**
   * Get current user's referrals
   */
  async getMyReferrals(): Promise<{ referrals: Referral[] }> {
    const response = await apiClient.get<{ referrals: Referral[] }>('/referrals/my');
    return response.data;
  },

  /**
   * Get referral statistics
   */
  async getStats(): Promise<{ stats: ReferralStats }> {
    const response = await apiClient.get<{ stats: ReferralStats }>('/referrals/stats');
    return response.data;
  },

  /**
   * Get referral by code
   */
  async getByCode(code: string): Promise<{ referral: Referral }> {
    const response = await apiClient.get<{ referral: Referral }>(`/referrals/code/${code}`);
    return response.data;
  },

  /**
   * Complete a referral
   */
  async completeReferral(data: CompleteReferralData): Promise<{ message: string; referral: Referral }> {
    const response = await apiClient.post<{ message: string; referral: Referral }>('/referrals/complete', data);
    return response.data;
  },
};
