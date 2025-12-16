import React from 'react';
import { RouteErrorBoundaryClass } from './RouteErrorBoundary';

interface PageErrorBoundaryProps {
  children: React.ReactNode;
  onRetry?: () => void;
}

export const PageErrorBoundary: React.FC<PageErrorBoundaryProps> = ({ children, onRetry }) => {
  return (
    <RouteErrorBoundaryClass onRetry={onRetry}>
      {children}
    </RouteErrorBoundaryClass>
  );
};

export default PageErrorBoundary;
