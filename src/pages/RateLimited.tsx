/**
 * RateLimited - User-friendly rate limit page
 *
 * Displays when the user has exceeded API rate limits.
 * Keeps them engaged with:
 * - Friendly explanation
 * - Countdown timer to retry
 * - Fun facts about SpannerWork
 * - Automatic retry when countdown finishes
 *
 * Also triggers admin notification on mount
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Coffee, Clock, Wrench, RefreshCw, Home, MessageCircle } from 'lucide-react';

// Fun facts to cycle through while waiting
const FUN_FACTS = [
  "Did you know? The average UK garage has over £1,000 worth of unused tools.",
  "SpannerWork helps reduce waste by connecting people who need tools with those who have them.",
  "Over 90% of tools in a typical garage are used less than once a year.",
  "Sharing tools is not just economical - it's great for the environment!",
  "The most commonly shared tool on SpannerWork is the pressure washer.",
  "Many professional mechanics started by borrowing tools from friends and family.",
  "A well-maintained tool can last for generations if properly cared for.",
  "The UK tool rental market is worth over £2 billion annually.",
];

interface RateLimitedProps {
  retryAfter?: number; // seconds until retry is allowed
}

export default function RateLimited({ retryAfter: propRetryAfter = 60 }: RateLimitedProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Get state from navigation
  const locationState = location.state as { returnTo?: string; retryAfter?: number } | null;
  const returnPath = locationState?.returnTo || '/';
  const retryAfter = locationState?.retryAfter || propRetryAfter;

  const [countdown, setCountdown] = useState(retryAfter);
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  // Cycle through fun facts every 8 seconds
  useEffect(() => {
    const factTimer = setInterval(() => {
      setCurrentFactIndex((prev) => (prev + 1) % FUN_FACTS.length);
    }, 8000);

    return () => clearInterval(factTimer);
  }, []);

  // Notify admin when this page is visited
  useEffect(() => {
    const notifyAdmin = async () => {
      try {
        // Fire-and-forget notification to backend
        await fetch('/api/v1/notifications/rate-limit-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timestamp: new Date().toISOString(),
            returnPath,
            userAgent: navigator.userAgent,
          }),
          credentials: 'include',
        });
      } catch {
        // Ignore errors - this is fire-and-forget
      }
    };

    notifyAdmin();
  }, [returnPath]);

  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    // Navigate back to where they came from
    setTimeout(() => {
      navigate(returnPath, { replace: true });
    }, 500);
  }, [navigate, returnPath]);

  const handleGoHome = useCallback(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <Card className="shadow-xl border-0">
          <CardContent className="p-8 text-center space-y-6">
            {/* Icon */}
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              className="mx-auto w-20 h-20 bg-brand-100 rounded-full flex items-center justify-center"
            >
              <Coffee className="w-10 h-10 text-brand-600" />
            </motion.div>

            {/* Title */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900">
                Taking a Quick Break
              </h1>
              <p className="text-gray-600">
                You've been super active! Our servers need a moment to catch up.
              </p>
            </div>

            {/* Countdown or Ready state */}
            {countdown > 0 ? (
              <motion.div
                key="countdown"
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="bg-gray-100 rounded-2xl p-6"
              >
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Clock className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-600">Ready in</span>
                </div>
                <div className="text-4xl font-bold text-brand-600">
                  {formatTime(countdown)}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="ready"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-green-100 rounded-2xl p-6"
              >
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <RefreshCw className="w-5 h-5" />
                  <span className="font-semibold">Ready to go!</span>
                </div>
              </motion.div>
            )}

            {/* Fun fact */}
            <motion.div
              key={currentFactIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-brand-50 rounded-xl p-4 text-left"
            >
              <div className="flex gap-3">
                <Wrench className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-brand-800">
                  {FUN_FACTS[currentFactIndex]}
                </p>
              </div>
            </motion.div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleRetry}
                disabled={countdown > 0 || isRetrying}
                className="flex-1 h-12 bg-brand-600 hover:bg-brand-700 disabled:opacity-50"
              >
                {isRetrying ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {isRetrying ? 'Retrying...' : countdown > 0 ? `Wait ${formatTime(countdown)}` : 'Try Again'}
              </Button>
              <Button
                onClick={handleGoHome}
                variant="outline"
                className="flex-1 h-12"
              >
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </div>

            {/* Help link */}
            <p className="text-sm text-gray-500">
              Need help?{' '}
              <a
                href="/contact"
                className="text-brand-600 hover:underline inline-flex items-center gap-1"
              >
                <MessageCircle className="w-3 h-3" />
                Contact Support
              </a>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
