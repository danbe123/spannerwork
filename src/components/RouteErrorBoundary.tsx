import React, { Component, ReactNode } from 'react';
import { useRouteError, Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface RouteError {
  status?: number;
  statusText?: string;
  message?: string;
  stack?: string;
}

export function RouteErrorBoundary() {
  const error = useRouteError() as RouteError;
  const navigate = useNavigate();

  const isNotFound = error?.status === 404;
  const errorMessage = error?.message || error?.statusText || 'An unexpected error occurred';
  const errorStatus = error?.status;

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  if (isNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="text-6xl font-bold text-gray-300 mb-4">404</div>
            <CardTitle className="text-xl text-gray-900">
              Page Not Found
            </CardTitle>
            <CardDescription className="text-gray-600">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <Link to="/">
                <Button className="w-full bg-brand-800 hover:bg-brand-900">
                  <Home className="w-4 h-4 mr-2" />
                  Go to Home
                </Button>
              </Link>
              <Button 
                onClick={handleGoBack}
                variant="outline"
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-xl text-gray-900">
            {errorStatus ? `Error ${errorStatus}` : 'Something went wrong'}
          </CardTitle>
          <CardDescription className="text-gray-600">
            {errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {import.meta.env.DEV && error?.stack && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-red-800 mb-1">Stack Trace:</p>
              <pre className="text-xs text-red-600 overflow-auto max-h-32 whitespace-pre-wrap">
                {error.stack}
              </pre>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button 
              onClick={handleRefresh}
              className="w-full bg-brand-800 hover:bg-brand-900"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button 
              onClick={handleGoBack}
              variant="outline"
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
            <Link to="/">
              <Button 
                variant="ghost"
                className="w-full text-gray-600"
              >
                <Home className="w-4 h-4 mr-2" />
                Go to Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface RouteErrorBoundaryClassProps {
  children: ReactNode;
  fallback?: ReactNode;
  onRetry?: () => void;
}

interface RouteErrorBoundaryClassState {
  hasError: boolean;
  error: Error | null;
}

declare global {
  interface Window {
    Sentry?: {
      captureException: (error: Error, context?: { extra?: unknown }) => void;
    };
  }
}

class RouteErrorBoundaryClass extends Component<RouteErrorBoundaryClassProps, RouteErrorBoundaryClassState> {
  constructor(props: RouteErrorBoundaryClassProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryClassState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('Route Error:', error, errorInfo);
    }

    if (import.meta.env.PROD && window.Sentry) {
      window.Sentry.captureException(error, { extra: errorInfo });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-2" />
              <CardTitle className="text-lg">Failed to load this section</CardTitle>
              <CardDescription>
                {this.state.error?.message || 'An error occurred'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  this.props.onRetry?.();
                }}
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export { RouteErrorBoundaryClass };
export default RouteErrorBoundary;
