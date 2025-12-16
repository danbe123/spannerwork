import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ComponentErrorFallbackProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

/**
 * Compact error fallback for inline component errors
 */
export function ComponentErrorFallback({ 
  title = 'Something went wrong',
  message = 'Unable to load this section',
  onRetry,
  compact = false 
}: ComponentErrorFallbackProps) {
  if (compact) {
    return (
      <div 
        className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm"
        role="alert"
        aria-live="polite"
      >
        <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        <span>{message}</span>
        {onRetry && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onRetry}
            className="ml-auto h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-100"
            aria-label="Retry loading"
          >
            <RefreshCw className="w-3 h-3" aria-hidden="true" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card 
      className="border-red-200 bg-red-50"
      role="alert"
      aria-live="polite"
    >
      <CardContent className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6 text-red-500" aria-hidden="true" />
        </div>
        <h3 className="font-semibold text-red-800 mb-1">{title}</h3>
        <p className="text-sm text-red-600 mb-4">{message}</p>
        {onRetry && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRetry}
            className="border-red-200 text-red-600 hover:bg-red-100"
          >
            <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default ComponentErrorFallback;
