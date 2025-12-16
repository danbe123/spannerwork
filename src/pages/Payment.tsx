import { useState, ChangeEvent, FormEvent } from "react";
import { transactionsService, usersService } from "@/api/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, 
  CreditCard,
  Shield,
  Lock,
  CheckCircle,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Transaction, User } from "@/types";

export default function Payment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const urlParams = new URLSearchParams(window.location.search);
  const transactionId = urlParams.get('transactionId');

  const [cardDetails, setCardDetails] = useState({
    number: "",
    expiry: "",
    cvc: "",
    name: "",
  });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: transactionData, isLoading } = useQuery({
    queryKey: ['transaction', transactionId],
    queryFn: async (): Promise<{ transaction: Transaction | undefined }> => 
      transactionId 
        ? transactionsService.getById(transactionId) 
        : { transaction: undefined },
    enabled: !!transactionId,
  });

  const transaction = transactionData?.transaction as Transaction | undefined;

  const { data: providerData } = useQuery({
    queryKey: ['provider', transaction?.providerId],
    queryFn: async (): Promise<{ user: User | undefined }> => 
      transaction?.providerId 
        ? usersService.getById(transaction.providerId) 
        : { user: undefined },
    enabled: !!transaction?.providerId,
  });

  const provider = providerData?.user as User | undefined;

  const rentalAmountPence = transaction?.rentalFee || 0;
  const platformFeeAmountPence = transaction?.platformFee || 0;
  const finalAmountPence = rentalAmountPence + platformFeeAmountPence;

  const formatPounds = (pence: number | undefined) => (pence || 0) / 100;

  const processPaymentMutation = useMutation({
    mutationFn: async () => {
      setProcessing(true);
      setError(null);

      await new Promise(resolve => setTimeout(resolve, 2000));

      if (!transactionId) throw new Error("No transaction ID");
      await transactionsService.updateStatus(transactionId, 'CONFIRMED');

      // Backend handles email confirmations automatically

      return transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction', transactionId] });
      navigate(createPageUrl(`TransactionDetail?id=${transactionId}`));
    },
    onError: () => {
      setError("Payment failed. Please try again or contact support.");
      setProcessing(false);
    },
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!cardDetails.number || !cardDetails.expiry || !cardDetails.cvc || !cardDetails.name) {
      setError("Please fill in all card details");
      return;
    }

    if (cardDetails.number.replace(/\s/g, '').length !== 16) {
      setError("Please enter a valid 16-digit card number");
      return;
    }

    processPaymentMutation.mutate();
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-800" />
      </div>
    );
  }

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
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Security Notice */}
                  <Alert className="bg-green-50 border-green-200">
                    <Shield className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-sm text-green-800">
                      Your payment is secure. Funds are held until service completion.
                    </AlertDescription>
                  </Alert>

                  {/* Card Details */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="cardName">Cardholder Name</Label>
                      <Input
                        id="cardName"
                        placeholder="John Smith"
                        value={cardDetails.name}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setCardDetails({...cardDetails, name: e.target.value})}
                        className="mt-2"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="cardNumber">Card Number</Label>
                      <div className="relative mt-2">
                        <Input
                          id="cardNumber"
                          placeholder="1234 5678 9012 3456"
                          value={cardDetails.number}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setCardDetails({...cardDetails, number: formatCardNumber(e.target.value)})}
                          maxLength={19}
                          required
                        />
                        <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="expiry">Expiry Date</Label>
                        <Input
                          id="expiry"
                          placeholder="MM/YY"
                          value={cardDetails.expiry}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            let value = e.target.value.replace(/\D/g, '');
                            if (value.length >= 2) {
                              value = value.slice(0, 2) + '/' + value.slice(2, 4);
                            }
                            setCardDetails({...cardDetails, expiry: value});
                          }}
                          maxLength={5}
                          className="mt-2"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="cvc">CVC</Label>
                        <Input
                          id="cvc"
                          placeholder="123"
                          value={cardDetails.cvc}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setCardDetails({...cardDetails, cvc: e.target.value.replace(/\D/g, '')})}
                          maxLength={3}
                          className="mt-2"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    disabled={processing}
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
                        Pay £{formatPounds(finalAmountPence).toFixed(2)}
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                    <Shield className="w-4 h-4" />
                    <span>256-bit SSL encrypted</span>
                  </div>
                </form>
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
                  <p className="font-semibold">{provider?.name || provider?.email || 'Provider'}</p>
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Service Fee</span>
                    <span className="font-medium">£{formatPounds(rentalAmountPence).toFixed(2)}</span>
                  </div>

                  {platformFeeAmountPence > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Platform Fee</span>
                      <span className="font-medium">£{formatPounds(platformFeeAmountPence).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-xl text-brand-800">
                      £{formatPounds(finalAmountPence).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Funds held securely until completion
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-start gap-2 text-xs text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <p>Payment protected by SpannerWork. Funds only released when you confirm completion.</p>
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
