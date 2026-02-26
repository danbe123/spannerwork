/**
 * CardErrorFallback - Compact error state for failed RequestCards
 * Prevents entire feed from crashing when a single card fails
 */

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface CardErrorFallbackProps {
  error?: Error;
  resetErrorBoundary?: () => void;
  viewMode?: 'grid' | 'list';
}

export default function CardErrorFallback({
  resetErrorBoundary,
  viewMode = 'grid'
}: CardErrorFallbackProps) {
  if (viewMode === 'list') {
    return (
      <Card className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-4 p-4">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700">Unable to load this job</p>
            <p className="text-xs text-gray-500">Something went wrong displaying this card</p>
          </div>
          {resetErrorBoundary && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetErrorBoundary}
              className="text-gray-600 hover:text-gray-900"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden min-h-[320px] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-red-500" />
      </div>
      <h3 className="font-semibold text-gray-700 mb-1">Unable to load</h3>
      <p className="text-sm text-gray-500 mb-4">Something went wrong with this job card</p>
      {resetErrorBoundary && (
        <Button
          variant="outline"
          size="sm"
          onClick={resetErrorBoundary}
          className="rounded-full"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      )}
    </Card>
  );
}
