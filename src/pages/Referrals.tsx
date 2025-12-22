import { useState, ChangeEvent } from "react";
import { authService, referralsService } from "@/api/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Gift, 
  Users, 
  Copy, 
  Check, 
  Mail,
  Banknote,
  Share2,
  Trophy,
  Send,
  Phone
} from "lucide-react";
import { toast } from "sonner";
import { Referral, User } from "@/types";
import { queryKeys } from "@/lib/queryKeys";

export default function Referrals() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [phone, setPhone] = useState("");

  const { data: currentUserData } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () => authService.getCurrentUser(),
  });

  const currentUser: User | undefined = currentUserData?.user;
  const currentUserIdKey = currentUser?.id ?? '';

  // Generate referral code
  const referralCode = currentUser?.id ? 
    `SW${currentUser.id.substring(0, 6).toUpperCase()}` : 
    "";
  const referralLink = `${window.location.origin}/?ref=${referralCode}`;

  const { data: referralsData } = useQuery({
    queryKey: queryKeys.myReferrals(currentUserIdKey),
    queryFn: () => referralsService.getMyReferrals(),
    enabled: !!currentUser?.id,
  });

  const referrals: Referral[] = referralsData?.referrals || [];

  const sendInviteMutation = useMutation({
    mutationFn: async (email: string) => {
      await referralsService.createReferral({
        referredEmail: email,
        referralCode: referralCode,
      });
      return { email };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myReferralsRoot() });
      setEmail("");
      toast.success("Invitation sent!");
    },
  });

  const sendSmsInviteMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      await referralsService.sendSmsReferral({
        phone: phoneNumber,
        referralCode,
      });
      return { phone: phoneNumber };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myReferralsRoot() });
      setPhone("");
      toast.success("SMS invitation sent!");
    },
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendInvite = () => {
    if (!email) return;
    sendInviteMutation.mutate(email);
  };

  const handleSendSmsInvite = () => {
    if (!phone) return;
    sendSmsInviteMutation.mutate(phone);
  };

  const totalEarned = referrals
    .filter(r => r.status === 'COMPLETED')
    .reduce((sum, r) => sum + (r.reward || 0), 0);

  const pendingRewards = referrals
    .filter(r => r.status === 'PENDING')
    .reduce((sum, r) => sum + (r.reward || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-brand-800 to-brand-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Gift className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-2">Refer Friends, Get Rewarded</h1>
          <p className="text-gray-600 text-lg">
            You and your friends each get £10 credit when they complete their first transaction
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="border-none shadow-lg">
            <CardContent className="p-6 text-center">
              <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900">{referrals.length}</p>
              <p className="text-sm text-gray-600">Friends Invited</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardContent className="p-6 text-center">
              <Banknote className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-green-600">£{totalEarned}</p>
              <p className="text-sm text-gray-600">Total Earned</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardContent className="p-6 text-center">
              <Trophy className="w-8 h-8 text-[#FFC107] mx-auto mb-2" />
              <p className="text-3xl font-bold text-[#FFC107]">£{pendingRewards}</p>
              <p className="text-sm text-gray-600">Pending Rewards</p>
            </CardContent>
          </Card>
        </div>

        {/* Share Options */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader>
            <CardTitle>Share Your Referral Link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Your Referral Code</label>
              <div className="flex gap-2">
                <Input
                  value={referralCode}
                  readOnly
                  className="flex-1 font-mono text-lg"
                />
                <Button
                  onClick={handleCopyLink}
                  className={`${copied ? 'bg-green-600' : 'bg-brand-800'} hover:bg-brand-900`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Your Referral Link</label>
              <div className="flex gap-2">
                <Input
                  value={referralLink}
                  readOnly
                  className="flex-1 text-sm"
                />
                <Button
                  onClick={handleCopyLink}
                  variant="outline"
                >
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t">
              <label className="text-sm font-medium mb-2 block">Invite by Email</label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="friend@example.com"
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendInvite}
                  disabled={!email || sendInviteMutation.isPending}
                  className="bg-brand-800 hover:bg-brand-900"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </Button>
              </div>
            </div>

            <div className="pt-4">
              <label className="text-sm font-medium mb-2 block">Invite by SMS</label>
              <div className="flex gap-2">
                <Input
                  type="tel"
                  placeholder="e.g. +447911123456"
                  value={phone}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendSmsInvite}
                  disabled={!phone || sendSmsInviteMutation.isPending}
                  className="bg-brand-800 hover:bg-brand-900"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Text
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-bold">1</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Share Your Link</h4>
                  <p className="text-sm text-gray-600">
                    Send your unique referral link to friends via email, text, or social media
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-green-600 font-bold">2</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">They Sign Up</h4>
                  <p className="text-sm text-gray-600">
                    Your friend creates an account using your referral link
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-brand-800 font-bold">3</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">First Transaction</h4>
                  <p className="text-sm text-gray-600">
                    When they complete their first rental or service, you both get £10 credit!
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referral History */}
        {referrals.length > 0 && (
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle>Your Referrals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {referrals.map((referral) => (
                  <div key={referral.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-orange-50 rounded-full flex items-center justify-center">
                        <Mail className="w-5 h-5 text-brand-800" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {referral.referredId ? 'Signed Up' : referral.email}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(referral.createdDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge className={
                      referral.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      referral.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }>
                      {referral.status === 'COMPLETED' && `£${referral.reward} Earned`}
                      {referral.status === 'PENDING' && 'Pending'}
                      {referral.status === 'EXPIRED' && 'Expired'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
