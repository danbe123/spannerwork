import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tradeAccountService } from '@/api/services';
import type { CreateTradeAccountData, UpdateTradeAccountData, AccountType, TeamRole } from '@/api/services';
import useAuth from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Building2,
  Users,
  UserPlus,
  Mail,
  Loader2,
  Crown,
  User,
  Trash2,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import SEO from '@/components/SEO';

export default function TradeAccount(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('MEMBER');

  // Fetch trade account
  const { data: accountData, isLoading: accountLoading } = useQuery({
    queryKey: ['trade-account'],
    queryFn: () => tradeAccountService.get(),
    enabled: !!user,
    retry: false,
  });

  // Fetch pending invitations
  const { data: invitationsData } = useQuery({
    queryKey: ['trade-account-invitations'],
    queryFn: () => tradeAccountService.getPendingInvitations(),
    enabled: !!user,
  });

  const account = accountData?.account;
  const pendingInvitations = invitationsData?.invitations ?? [];
  const hasAccount = !!account;

  // Form state for creating/updating account
  const [formData, setFormData] = useState<CreateTradeAccountData>({});

  const currentFormData = {
    accountType: (formData.accountType ?? account?.accountType ?? 'INDIVIDUAL') as AccountType,
    companyName: formData.companyName ?? account?.companyName ?? '',
    companyRegistrationNo: formData.companyRegistrationNo ?? account?.companyRegistrationNo ?? '',
    vatNumber: formData.vatNumber ?? account?.vatNumber ?? '',
    billingAddress: formData.billingAddress ?? account?.billingAddress ?? '',
    billingCity: formData.billingCity ?? account?.billingCity ?? '',
    billingPostcode: formData.billingPostcode ?? account?.billingPostcode ?? '',
  };

  // Create account mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateTradeAccountData) => tradeAccountService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-account'] });
      toast.success('Trade account created');
      setFormData({});
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create account');
    },
  });

  // Update account mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateTradeAccountData) => tradeAccountService.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-account'] });
      toast.success('Trade account updated');
      setFormData({});
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update account');
    },
  });

  // Invite member mutation
  const inviteMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: TeamRole }) =>
      tradeAccountService.inviteTeamMember(email, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-account'] });
      toast.success('Invitation sent');
      setShowInviteDialog(false);
      setInviteEmail('');
      setInviteRole('MEMBER');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send invitation');
    },
  });

  // Remove member mutation
  const removeMutation = useMutation({
    mutationFn: (memberId: string) => tradeAccountService.removeTeamMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-account'] });
      toast.success('Team member removed');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove member');
    },
  });

  // Accept invitation mutation
  const acceptMutation = useMutation({
    mutationFn: (memberId: string) => tradeAccountService.acceptInvitation(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-account'] });
      queryClient.invalidateQueries({ queryKey: ['trade-account-invitations'] });
      toast.success('Invitation accepted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to accept invitation');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const data = {
        accountType: currentFormData.accountType,
        companyName: currentFormData.companyName || undefined,
        companyRegistrationNo: currentFormData.companyRegistrationNo || undefined,
        vatNumber: currentFormData.vatNumber || undefined,
        billingAddress: currentFormData.billingAddress || undefined,
        billingCity: currentFormData.billingCity || undefined,
        billingPostcode: currentFormData.billingPostcode || undefined,
      };

      if (hasAccount) {
        await updateMutation.mutateAsync(data);
      } else {
        await createMutation.mutateAsync(data);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof CreateTradeAccountData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    await inviteMutation.mutateAsync({ email: inviteEmail.trim(), role: inviteRole });
  };

  if (authLoading || accountLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-gray-100 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    navigate('/profile');
    return <></>;
  }

  return (
    <>
      <SEO title="Trade Account" description="Manage your B2B trade account" />

      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-gray-100 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Trade Account</h1>
              <p className="text-gray-600">
                {hasAccount ? 'Manage your B2B trade account' : 'Set up your B2B trade account'}
              </p>
            </div>
          </div>

          {/* Pending Invitations */}
          {pendingInvitations.length > 0 && (
            <Card className="mb-6 border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="text-yellow-800 flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Pending Invitations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-3 bg-white rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        {invitation.tradeAccount?.companyName || 'Trade Account'}
                      </p>
                      <p className="text-sm text-gray-500">
                        Invited by {invitation.tradeAccount?.user?.name || 'Unknown'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => acceptMutation.mutate(invitation.id)}
                        disabled={acceptMutation.isPending}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Account Type Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Account Type
                </CardTitle>
                <CardDescription>Choose between individual or company account</CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={currentFormData.accountType}
                  onValueChange={(value) => handleChange('accountType', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDIVIDUAL">Individual / Sole Trader</SelectItem>
                    <SelectItem value="COMPANY">Limited Company</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Company Details Card */}
            {currentFormData.accountType === 'COMPANY' && (
              <Card>
                <CardHeader>
                  <CardTitle>Company Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      placeholder="Your company name"
                      value={currentFormData.companyName}
                      onChange={(e) => handleChange('companyName', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyRegistrationNo">Company Registration Number</Label>
                    <Input
                      id="companyRegistrationNo"
                      placeholder="e.g., 12345678"
                      value={currentFormData.companyRegistrationNo}
                      onChange={(e) => handleChange('companyRegistrationNo', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vatNumber">VAT Number</Label>
                    <Input
                      id="vatNumber"
                      placeholder="GB123456789"
                      value={currentFormData.vatNumber}
                      onChange={(e) =>
                        handleChange('vatNumber', e.target.value.toUpperCase().replace(/\s/g, ''))
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Billing Address Card */}
            <Card>
              <CardHeader>
                <CardTitle>Billing Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="billingAddress">Address</Label>
                  <Input
                    id="billingAddress"
                    placeholder="Street address"
                    value={currentFormData.billingAddress}
                    onChange={(e) => handleChange('billingAddress', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="billingCity">City</Label>
                    <Input
                      id="billingCity"
                      placeholder="City"
                      value={currentFormData.billingCity}
                      onChange={(e) => handleChange('billingCity', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billingPostcode">Postcode</Label>
                    <Input
                      id="billingPostcode"
                      placeholder="AB12 3CD"
                      value={currentFormData.billingPostcode}
                      onChange={(e) => handleChange('billingPostcode', e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Members Card (only shown if account exists) */}
            {hasAccount && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Team Members
                    </CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowInviteDialog(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Invite
                    </Button>
                  </div>
                  <CardDescription>
                    Team members can make bookings on behalf of the trade account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {account?.teamMembers && account.teamMembers.length > 0 ? (
                    <div className="space-y-3">
                      {account.teamMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={member.user?.avatar || undefined} />
                              <AvatarFallback>
                                {member.user?.name?.charAt(0) || member.email.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">
                                {member.user?.name || member.email}
                              </p>
                              <p className="text-sm text-gray-500">{member.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={member.status === 'ACTIVE' ? 'default' : 'secondary'}
                              className={
                                member.status === 'ACTIVE'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }
                            >
                              {member.status === 'PENDING' ? 'Pending' : member.role}
                            </Badge>
                            {member.role === 'ADMIN' && (
                              <Crown className="h-4 w-4 text-yellow-500" />
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => removeMutation.mutate(member.id)}
                              disabled={removeMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>No team members yet</p>
                      <p className="text-sm">Invite team members to collaborate</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {hasAccount ? 'Updating...' : 'Creating...'}
                </>
              ) : hasAccount ? (
                'Update Trade Account'
              ) : (
                'Create Trade Account'
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your trade account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Email Address</Label>
              <Input
                id="inviteEmail"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteRole">Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as TeamRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Member
                    </div>
                  </SelectItem>
                  <SelectItem value="ADMIN">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4" />
                      Admin
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Invitation'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
