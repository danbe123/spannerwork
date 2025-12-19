/**
 * Payment Page
 *
 * Handles secure payment collection using Stripe Elements.
 * Supports escrow payments where funds are held until job completion.
 */

import { useState, useEffect } from "react";
import { transactionsService, usersService } from "@/api/services";
import { paymentsService } from "@/api/services/payments";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { createPageUrl, formatPrice } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Shield,
  Lock,
  CheckCircle,
  Loader2,
  AlertTriangle,
  ShieldCheck
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Transaction, User } from "@/types";
import { toast } from "sonner";

// Cache Stripe promise
let stripePromise: ReturnType<typeof loadStripe> | null = null;

async function getStripePromise() {
  if (!stripePromise) {
    try {
      const config = await paymentsService.getConfig();
      if (config.publishableKey) {
        stripePromise = loadStripe(config.publishableKey);
      }
    } catch (error) {
      console.error("Failed to load Stripe:", error);
    }
  }
  return stripePromise;
}

// ============================================================================
// Payment Form Component (uses Stripe Elements)
// ============================================================================

interface PaymentFormProps {
  transaction: Transaction;
  clientSecret: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}

function PaymentFormInner({ transaction, clientSecret, onSuccess, onError }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setError("Payment system not ready. Please refresh and try again.");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment/complete?transactionId=${transaction.id}`,
        },
        redirect: "if_required",
      });

      if (stripeError) {
        setError(stripeError.message || "Payment failed. Please try again.");
        onError(stripeError.message || "Payment failed");
        setProcessing(false);
      } else if (paymentIntent) {
        if (paymentIntent.status === "succeeded" || paymentIntent.status === "requires_capture") {
          onSuccess();
        } else {
          setError("Payment requires additional verification.");
          setProcessing(false);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
      onError(message);
      setProcessing(false);
    }
  };

  const totalAmount = (transaction.rentalFee || 0) + (transaction.platformFee || 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Security Notice */}
      <Alert className="bg-green-50 border-green-200">
        <Shield className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-sm text-green-800">
          Your payment is secure. Funds are held until service completion.
        </AlertDescription>
      </Alert>

      {/* Stripe Payment Element */}
      <div className="p-4 border rounded-lg bg-white">
        <PaymentElement
          options={{
            layout: "tabs",
            paymentMethodOrder: ["card", "apple_pay", "google_pay"],
          }}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-green-600 hover:bg-green-700 text-lg py-6"
      >
        {processing ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Processing Payment...
          </>
        ) : (
          <>
            <Lock className="w-5 h-5 mr-2" />
            Pay {formatPrice(totalAmount)}
          </>
        )}
      </Button>

      <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
        <Shield className="w-4 h-4" />
        <span>Secured by Stripe</span>
      </div>
    </form>
  );
}

// ============================================================================
// Main Payment Page
// ============================================================================

export default function Payment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(window.location.search);
  const transactionId = urlParams.get("transactionId");

  const [stripe, setStripe] = useState<Awaited<ReturnType<typeof loadStripe>>>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Load Stripe on mount
  useEffect(() => {
    getStripePromise().then(setStripe);
  }, []);

  // Fetch transaction
  const { data: transactionData, isLoading: transactionLoading } = useQuery({
    queryKey: ["transaction", transactionId],
    queryFn: async (): Promise<{ transaction: Transaction | undefined }> =>
      transactionId
        ? transactionsService.getById(transactionId)
        : { transaction: undefined },
    enabled: !!transactionId,
  });

  const transaction = transactionData?.transaction;

  // Fetch provider info
  const { data: providerData } = useQuery({
    queryKey: ["provider", transaction?.providerId],
    queryFn: async (): Promise<{ user: User | undefined }> =>
      transaction?.providerId
        ? usersService.getById(transaction.providerId)
        : { user: undefined },
    enabled: !!transaction?.providerId,
  });

  const provider = providerData?.user;

  // Create payment intent when transaction is loaded
  const createPaymentIntentMutation = useMutation({
    mutationFn: (txId: string) => paymentsService.createPaymentIntent(txId),
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
    },
    onError: (error: Error) => {
      setPaymentError(error.message || "Failed to initialize payment");
    },
  });

  // Create payment intent when transaction is available
  useEffect(() => {
    if (transaction?.id && !clientSecret && !createPaymentIntentMutation.isPending) {
      // Only create intent if payment is not already made
      if (transaction.paymentStatus === "PENDING") {
        createPaymentIntentMutation.mutate(transaction.id);
      }
    }
  }, [transaction?.id, transaction?.paymentStatus, clientSecret]);

  const handlePaymentSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["transaction", transactionId] });
    toast.success("Payment successful!");
    navigate(createPageUrl(`TransactionDetail?id=${transactionId}`));
  };

  const handlePaymentError = (message: string) => {
    toast.error(message);
  };

  // Loading states
  if (transactionLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <Skeleton className="h-10 w-24 mb-6" />
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <Skeleton className="h-96 rounded-lg" />
            </div>
            <Skeleton className="h-64 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // Transaction not found
  if (!transaction) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
        <div className="max-w-2xl mx-auto text-center py-12">
          <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Transaction Not Found</h2>
          <Button onClick={() => navigate(createPageUrl("Profile"))}>
            Back to Profile
          </Button>
        </div>
      </div>
    );
  }

  // Already paid
  if (transaction.paymentStatus !== "PENDING") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
        <div className="max-w-2xl mx-auto text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Payment Already Processed</h2>
          <p className="text-gray-600 mb-4">This transaction has already been paid.</p>
          <Button onClick={() => navigate(createPageUrl(`TransactionDetail?id=${transactionId}`))}>
            View Transaction
          </Button>
        </div>
      </div>
    );
  }

  const rentalAmountPence = transaction.rentalFee || 0;
  const platformFeeAmountPence = transaction.platformFee || 0;
  const totalAmountPence = rentalAmountPence + platformFeeAmountPence;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Payment Form */}
          <div className="md:col-span-2">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-green-600" />
                  Secure Payment
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paymentError ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {paymentError}
                      <Button
                        variant="link"
                        className="p-0 h-auto ml-2"
                        onClick={() => {
                          setPaymentError(null);
                          if (transactionId) {
                            createPaymentIntentMutation.mutate(transactionId);
                          }
                        }}
                      >
                        Try again
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : !stripe || !clientSecret ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    <p className="text-gray-500">Initializing secure payment...</p>
                  </div>
                ) : (
                  <Elements
                    stripe={stripe}
                    options={{
                      clientSecret,
                      appearance: {
                        theme: "stripe",
                        variables: {
                          colorPrimary: "#16a34a",
                          colorBackground: "#ffffff",
                          colorText: "#1f2937",
                          colorDanger: "#dc2626",
                          fontFamily: "system-ui, -apple-system, sans-serif",
                          borderRadius: "8px",
                        },
                      },
                      locale: "en-GB",
                    }}
                  >
                    <PaymentFormInner
                      transaction={transaction}
                      clientSecret={clientSecret}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                    />
                  </Elements>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="border-none shadow-lg sticky top-4">
              <CardHeader>
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Provider</p>
                  <p className="font-semibold">
                    {provider?.name || provider?.email || "Provider"}
                  </p>
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Service Fee</span>
                    <span className="font-medium">{formatPrice(rentalAmountPence)}</span>
                  </div>

                  {platformFeeAmountPence > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Platform Fee</span>
                      <span className="font-medium">{formatPrice(platformFeeAmountPence)}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-xl text-brand-800">
                      {formatPrice(totalAmountPence)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Funds held securely until completion
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-start gap-2 text-xs text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <p>
                      Payment protected by SpannerWork. Funds only released when
                      you confirm completion.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
