/**
 * Stripe Provider Component
 *
 * Wraps the application with Stripe Elements provider.
 * Fetches the publishable key from the backend on mount.
 */

import { useState, useEffect, ReactNode } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { paymentsService } from '@/api/services/payments';

interface StripeProviderProps {
  children: ReactNode;
}

// Cache the Stripe promise to avoid re-loading
let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Get or create the Stripe promise
 * Uses the publishable key from the backend
 */
async function getStripePromise(): Promise<Stripe | null> {
  if (stripePromise) {
    return stripePromise;
  }

  try {
    const config = await paymentsService.getConfig();
    if (config.publishableKey) {
      stripePromise = loadStripe(config.publishableKey);
      return stripePromise;
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Failed to load Stripe config:', error);
    }
  }

  return null;
}

/**
 * Stripe Elements Provider
 *
 * Provides Stripe context to child components.
 * Only renders Elements wrapper when Stripe is available.
 */
export function StripeProvider({ children }: StripeProviderProps) {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStripePromise()
      .then(setStripe)
      .finally(() => setLoading(false));
  }, []);

  // If still loading or Stripe unavailable, render children without Elements
  if (loading || !stripe) {
    return <>{children}</>;
  }

  return (
    <Elements
      stripe={stripe}
      options={{
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#2563eb', // Blue-600
            colorBackground: '#ffffff',
            colorText: '#1f2937', // Gray-800
            colorDanger: '#dc2626', // Red-600
            fontFamily: 'system-ui, -apple-system, sans-serif',
            borderRadius: '8px',
            spacingUnit: '4px',
          },
          rules: {
            '.Input': {
              border: '1px solid #d1d5db',
              boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
            },
            '.Input:focus': {
              border: '1px solid #2563eb',
              boxShadow: '0 0 0 3px rgb(37 99 235 / 0.1)',
            },
            '.Label': {
              fontWeight: '500',
              marginBottom: '4px',
            },
          },
        },
        locale: 'en-GB',
      }}
    >
      {children}
    </Elements>
  );
}

export default StripeProvider;
