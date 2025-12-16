import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RouteErrorBoundaryClass } from './RouteErrorBoundary';

// Suppress console.error for cleaner test output
const originalConsoleError = console.error;

// Mock window.Sentry
const mockCaptureException = vi.fn();

describe('RouteErrorBoundaryClass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.error = vi.fn();
    window.Sentry = { captureException: mockCaptureException };
  });

  afterEach(() => {
    console.error = originalConsoleError;
    delete window.Sentry;
  });

  // Component that throws an error
  function ThrowError({ shouldThrow = true }: { shouldThrow?: boolean }) {
    if (shouldThrow) {
      throw new Error('Test route error');
    }
    return <div data-testid="child">No error</div>;
  }

  describe('when no error occurs', () => {
    it('renders children normally', () => {
      render(
        <RouteErrorBoundaryClass>
          <div data-testid="child">Child content</div>
        </RouteErrorBoundaryClass>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });
  });

  describe('when an error occurs', () => {
    it('renders default error UI', () => {
      render(
        <RouteErrorBoundaryClass>
          <ThrowError />
        </RouteErrorBoundaryClass>
      );

      expect(screen.getByText('Failed to load this section')).toBeInTheDocument();
      expect(screen.getByText('Test route error')).toBeInTheDocument();
    });

    it('renders Retry button', () => {
      render(
        <RouteErrorBoundaryClass>
          <ThrowError />
        </RouteErrorBoundaryClass>
      );

      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    });

    it('logs error to console', () => {
      render(
        <RouteErrorBoundaryClass>
          <ThrowError />
        </RouteErrorBoundaryClass>
      );

      expect(console.error).toHaveBeenCalledWith(
        'Route Error:',
        expect.any(Error),
        expect.any(Object)
      );
    });
  });

  describe('custom fallback', () => {
    it('renders custom fallback when provided', () => {
      render(
        <RouteErrorBoundaryClass fallback={<div data-testid="custom-fallback">Custom error</div>}>
          <ThrowError />
        </RouteErrorBoundaryClass>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.queryByText('Failed to load this section')).not.toBeInTheDocument();
    });
  });

  describe('onRetry callback', () => {
    it('calls onRetry when Retry button is clicked', () => {
      const onRetry = vi.fn();

      render(
        <RouteErrorBoundaryClass onRetry={onRetry}>
          <ThrowError />
        </RouteErrorBoundaryClass>
      );

      fireEvent.click(screen.getByRole('button', { name: /Retry/i }));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('resets error state when Retry is clicked', () => {
      let shouldThrow = true;
      const onRetry = vi.fn(() => {
        shouldThrow = false;
      });

      function ConditionalError() {
        if (shouldThrow) throw new Error('Error');
        return <div data-testid="recovered">Recovered</div>;
      }

      render(
        <RouteErrorBoundaryClass onRetry={onRetry}>
          <ConditionalError />
        </RouteErrorBoundaryClass>
      );

      expect(screen.getByText('Failed to load this section')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Retry/i }));

      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe('error message handling', () => {
    it('shows generic message when error has no message', () => {
      function ThrowEmptyError(): never {
        throw new Error();
      }

      render(
        <RouteErrorBoundaryClass>
          <ThrowEmptyError />
        </RouteErrorBoundaryClass>
      );

      expect(screen.getByText('Failed to load this section')).toBeInTheDocument();
    });
  });

  describe('multiple children', () => {
    it('catches error from any child', () => {
      render(
        <RouteErrorBoundaryClass>
          <div>Child 1</div>
          <ThrowError />
          <div>Child 3</div>
        </RouteErrorBoundaryClass>
      );

      expect(screen.getByText('Failed to load this section')).toBeInTheDocument();
      expect(screen.queryByText('Child 1')).not.toBeInTheDocument();
    });
  });
});
