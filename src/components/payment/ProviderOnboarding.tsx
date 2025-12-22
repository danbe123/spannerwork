/**
 * Provider Onboarding Component
 *
 * Handles Stripe Connect onboarding for service providers.
 * Allows providers to set up their bank account to receive payments.
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { paymentsService } from '@/api/services/payments';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Wallet,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';

interface ProviderOnboardingProps {
  /** Show compact version */
  compact?: boolean;
}

export function ProviderOnboarding({ compact = false }: ProviderOnboardingProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Fetch current account status
  const {
    data: accountData,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.paymentAccountStatus(),
    queryFn: () => paymentsService.getAccountStatus(),
    staleTime: 30000, // 30 seconds
  });

  // Create Connect account mutation
  const createAccountMutation = useMutation({
    mutationFn: () => paymentsService.createConnectAccount(),
    onSuccess: (data) => {
      setIsRedirecting(true);
      // Redirect to Stripe onboarding
      window.location.href = data.onboardingUrl;
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start onboarding');
    },
  });

  // Get dashboard link mutation
  const dashboardMutation = useMutation({
    mutationFn: () => paymentsService.getDashboardLink(),
    onSuccess: (data) => {
      window.open(data.dashboardUrl, '_blank');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to open dashboard');
    },
  });

  const handleStartOnboarding = () => {
    createAccountMutation.mutate();
  };

  const handleOpenDashboard = () => {
    dashboardMutation.mutate();
  };

  const handleContinueOnboarding = () => {
    createAccountMutation.mutate();
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className={compact ? 'border-0 shadow-none' : ''}>
        <CardHeader className={compact ? 'pb-2' : ''}>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={compact ? 'border-0 shadow-none' : ''}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="h-5 w-5" />
            <p>Payment setup unavailable. Please try again later.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasAccount = accountData?.hasAccount;
  const status = accountData?.status;
  const chargesEnabled = status?.chargesEnabled;
  const detailsSubmitted = status?.detailsSubmitted;
  const requirementsCount =
    (status?.requirements?.currentlyDue?.length || 0) +
    (status?.requirements?.pastDue?.length || 0);

  // Determine account state
  const isFullySetup = hasAccount && chargesEnabled && detailsSubmitted;
  const isPending = hasAccount && !chargesEnabled && detailsSubmitted;
  const needsAction = hasAccount && requirementsCount > 0;
  const notStarted = !hasAccount;

  // Render based on state
  if (compact) {
    // Compact version for dashboard widgets
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-gray-500" />
            <span className="font-medium">Payment Setup</span>
          </div>
          {isFullySetup && (
            <Badge variant="default" className="bg-green-100 text-green-800">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Active
            </Badge>
          )}
          {isPending && (
            <Badge variant="secondary">
              <Clock className="h-3 w-3 mr-1" />
              Pending
            </Badge>
          )}
          {needsAction && (
            <Badge variant="destructive">
              <AlertCircle className="h-3 w-3 mr-1" />
              Action Needed
            </Badge>
          )}
          {notStarted && (
            <Badge variant="outline">
              <XCircle className="h-3 w-3 mr-1" />
              Not Set Up
            </Badge>
          )}
        </div>

        {isFullySetup && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleOpenDashboard}
            disabled={dashboardMutation.isPending}
          >
            {dashboardMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            View Payout Dashboard
          </Button>
        )}

        {needsAction && (
          <Button
            size="sm"
            className="w-full"
            onClick={handleContinueOnboarding}
            disabled={createAccountMutation.isPending || isRedirecting}
          >
            {createAccountMutation.isPending || isRedirecting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Complete Setup ({requirementsCount} items)
          </Button>
        )}

        {notStarted && (
          <Button
            size="sm"
            className="w-full"
            onClick={handleStartOnboarding}
            disabled={createAccountMutation.isPending || isRedirecting}
          >
            {createAccountMutation.isPending || isRedirecting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Set Up Payments
          </Button>
        )}
      </div>
    );
  }

  // Full version
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Payment Setup
        </CardTitle>
        <CardDescription>
          Set up your account to receive payments from customers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Display */}
        {isFullySetup && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Payments Active</p>
              <p className="text-sm text-green-600">
                You can receive payments from customers
              </p>
            </div>
          </div>
        )}

        {isPending && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <Clock className="h-6 w-6 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">Verification Pending</p>
              <p className="text-sm text-amber-600">
                Stripe is reviewing your information. This usually takes 1-2 business days.
              </p>
            </div>
          </div>
        )}

        {needsAction && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <div>
              <p className="font-medium text-red-800">Action Required</p>
              <p className="text-sm text-red-600">
                Complete {requirementsCount} remaining item{requirementsCount > 1 ? 's' : ''} to activate payments
              </p>
            </div>
          </div>
        )}

        {notStarted && (
          <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <Wallet className="h-6 w-6 text-gray-500" />
            <div>
              <p className="font-medium text-gray-800">Not Set Up</p>
              <p className="text-sm text-gray-600">
                Set up your payment account to start receiving payments
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          {isFullySetup && (
            <Button
              variant="outline"
              onClick={handleOpenDashboard}
              disabled={dashboardMutation.isPending}
              className="flex-1"
            >
              {dashboardMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              View Payout Dashboard
            </Button>
          )}

          {needsAction && (
            <Button
              onClick={handleContinueOnboarding}
              disabled={createAccountMutation.isPending || isRedirecting}
              className="flex-1"
            >
              {createAccountMutation.isPending || isRedirecting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Complete Setup
            </Button>
          )}

          {notStarted && (
            <Button
              onClick={handleStartOnboarding}
              disabled={createAccountMutation.isPending || isRedirecting}
              className="flex-1"
            >
              {createAccountMutation.isPending || isRedirecting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Set Up Payment Account
            </Button>
          )}
        </div>

        {/* Info */}
        <p className="text-xs text-gray-500 text-center">
          Payments are processed securely by Stripe. You&apos;ll need to provide
          identity verification and bank details.
        </p>
      </CardContent>
    </Card>
  );
}

export default ProviderOnboarding;
