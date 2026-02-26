/**
 * RateLimitRedirect - Listens for rate limit events and redirects to the rate limit page
 *
 * This component should be mounted once at the app root level.
 * It listens for the 'api:rate-limited' custom event dispatched by the API client
 * and redirects to the rate limit page with appropriate state.
 */

import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// Debounce rate limit redirects to prevent rapid-fire redirects
const DEBOUNCE_MS = 1000;

export default function RateLimitRedirect(): null {
  const navigate = useNavigate();
  const location = useLocation();
  const lastRedirectRef = useRef<number>(0);

  useEffect(() => {
    const handleRateLimited = (event: CustomEvent<{ retryAfter: number; path: string }>) => {
      const now = Date.now();

      // Don't redirect if we're already on the rate limit page
      if (location.pathname === '/rate-limited') {
        return;
      }

      // Debounce redirects
      if (now - lastRedirectRef.current < DEBOUNCE_MS) {
        return;
      }

      lastRedirectRef.current = now;

      // Store the current path so we can return after the rate limit expires
      const returnTo = location.pathname + location.search;

      navigate('/rate-limited', {
        replace: true,
        state: {
          returnTo,
          retryAfter: event.detail?.retryAfter || 60,
        },
      });
    };

    // Type assertion for custom event
    window.addEventListener('api:rate-limited', handleRateLimited as EventListener);

    return () => {
      window.removeEventListener('api:rate-limited', handleRateLimited as EventListener);
    };
  }, [navigate, location]);

  // This component doesn't render anything
  return null;
}
