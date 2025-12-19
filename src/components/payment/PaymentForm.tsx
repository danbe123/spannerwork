/**
 * Payment Form Component
 *
 * Handles payment collection using Stripe Elements.
 * Supports both immediate capture and escrow (hold) payments.
 */

import { useState, FormEvent } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { formatPrice } from '@/utils';

interface PaymentFormProps {
  /** Amount in pence */
  amount: number;
  /** Called when payment succeeds */
  onSuccess?: (paymentIntentId: string) => void;
  /** Called when payment fails */
  onError?: (error: string) => void;
  /** Called when user cancels */
  onCancel?: () => void;
  /** Whether this is an escrow payment */
  isEscrow?: boolean;
  /** Description shown to user */
  description?: string;
}

export function PaymentForm({
  amount,
  onSuccess,
  onError,
  onCancel,
  isEscrow = true,
  description,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setErrorMessage('Payment system not ready. Please try again.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment/complete`,
        },
        redirect: 'if_required',
      });

      if (error) {
        // Show error to customer
        setErrorMessage(error.message || 'Payment failed. Please try again.');
        onError?.(error.message || 'Payment failed');
      } else if (paymentIntent) {
        // Payment succeeded or requires capture (escrow)
        if (paymentIntent.status === 'succeeded' || paymentIntent.status === 'requires_capture') {
          onSuccess?.(paymentIntent.id);
        } else {
          setErrorMessage('Payment requires additional action. Please complete the verification.');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setErrorMessage(message);
      onError?.(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Secure Payment
        </CardTitle>
        <CardDescription>
          {description || 'Complete your payment securely'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Amount Display */}
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600">Amount to pay</p>
            <p className="text-3xl font-bold text-gray-900">
              {formatPrice(amount)}
            </p>
            {isEscrow && (
              <p className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                Held securely until job completion
              </p>
            )}
          </div>

          {/* Stripe Payment Element */}
          <PaymentElement
            options={{
              layout: 'tabs',
              paymentMethodOrder: ['card', 'apple_pay', 'google_pay'],
            }}
          />

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p>{errorMessage}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={!stripe || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Pay ${formatPrice(amount)}`
            )}
          </Button>

          {/* Cancel Button */}
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={onCancel}
              disabled={isProcessing}
            >
              Cancel
            </Button>
          )}

          {/* Security Notice */}
          <p className="text-xs text-center text-gray-500">
            Your payment is secured by Stripe. We never store your card details.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default PaymentForm;
