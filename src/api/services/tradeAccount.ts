import apiClient from '../client';

// ============================================================================
// Types
// ============================================================================

export type AccountType = 'INDIVIDUAL' | 'COMPANY';
export type TeamRole = 'ADMIN' | 'MEMBER';
export type MemberStatus = 'PENDING' | 'ACTIVE' | 'REMOVED';

export interface TeamMember {
  id: string;
  tradeAccountId: string;
  userId: string;
  email: string;
  role: TeamRole;
  status: MemberStatus;
  invitedAt: string;
  acceptedAt: string | null;
  user?: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
}

export interface TradeAccount {
  id: string;
  userId: string;
  accountType: AccountType;
  companyName: string | null;
  companyRegistrationNo: string | null;
  vatNumber: string | null;
  billingAddress: string | null;
  billingCity: string | null;
  billingPostcode: string | null;
  billingCountry: string | null;
  bulkDiscountPercent: number;
  createdAt: string;
  updatedAt: string;
  teamMembers?: TeamMember[];
}

export interface CreateTradeAccountData {
  accountType?: AccountType;
  companyName?: string;
  companyRegistrationNo?: string;
  vatNumber?: string;
  billingAddress?: string;
  billingCity?: string;
  billingPostcode?: string;
  billingCountry?: string;
}

export interface UpdateTradeAccountData extends CreateTradeAccountData {
  bulkDiscountPercent?: number;
}

export interface TeamInvitation extends TeamMember {
  tradeAccount?: {
    id: string;
    companyName: string | null;
    user?: {
      name: string | null;
      email: string;
    };
  };
}

export interface DiscountResult {
  discount: number;
  finalAmount: number;
}

// ============================================================================
// Service
// ============================================================================

export const tradeAccountService = {
  // Account management
  async get(): Promise<{ account: TradeAccount }> {
    const response = await apiClient.get<{ account: TradeAccount }>('/trade-account');
    return response.data;
  },

  async create(data: CreateTradeAccountData): Promise<{ message: string; account: TradeAccount }> {
    const response = await apiClient.post<{ message: string; account: TradeAccount }>(
      '/trade-account',
      data
    );
    return response.data;
  },

  async update(data: UpdateTradeAccountData): Promise<{ message: string; account: TradeAccount }> {
    const response = await apiClient.patch<{ message: string; account: TradeAccount }>(
      '/trade-account',
      data
    );
    return response.data;
  },

  async getMyAccount(): Promise<{ account: TradeAccount }> {
    const response = await apiClient.get<{ account: TradeAccount }>('/trade-account/my-account');
    return response.data;
  },

  // Team management
  async getTeam(): Promise<{ members: TeamMember[] }> {
    const response = await apiClient.get<{ members: TeamMember[] }>('/trade-account/team');
    return response.data;
  },

  async inviteTeamMember(
    email: string,
    role: TeamRole = 'MEMBER'
  ): Promise<{ message: string; member: TeamMember }> {
    const response = await apiClient.post<{ message: string; member: TeamMember }>(
      '/trade-account/team/invite',
      { email, role }
    );
    return response.data;
  },

  async acceptInvitation(memberId: string): Promise<{ message: string; member: TeamMember }> {
    const response = await apiClient.post<{ message: string; member: TeamMember }>(
      `/trade-account/team/${memberId}/accept`
    );
    return response.data;
  },

  async updateMemberRole(
    memberId: string,
    role: TeamRole
  ): Promise<{ message: string; member: TeamMember }> {
    const response = await apiClient.patch<{ message: string; member: TeamMember }>(
      `/trade-account/team/${memberId}/role`,
      { role }
    );
    return response.data;
  },

  async removeTeamMember(memberId: string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(
      `/trade-account/team/${memberId}`
    );
    return response.data;
  },

  async getPendingInvitations(): Promise<{ invitations: TeamInvitation[] }> {
    const response = await apiClient.get<{ invitations: TeamInvitation[] }>(
      '/trade-account/invitations'
    );
    return response.data;
  },

  // Discount calculation
  async calculateDiscount(amountPence: number): Promise<DiscountResult> {
    const response = await apiClient.get<DiscountResult>('/trade-account/discount', {
      params: { amount: amountPence },
    });
    return response.data;
  },
};
