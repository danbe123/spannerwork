// Initialize Trusted Types policy FIRST - before any DOM manipulation
import '@/lib/trusted-types'

import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import App from '@/App'
import ErrorBoundary from '@/components/ErrorBoundary'
import { toast } from 'sonner'
import '@/index.css'

// Initialize Sentry for error tracking in production
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
	Sentry.init({
		dsn: import.meta.env.VITE_SENTRY_DSN,
		environment: import.meta.env.MODE,
		integrations: [
			Sentry.browserTracingIntegration(),
			Sentry.replayIntegration(),
		],
		// Performance Monitoring
		tracesSampleRate: 0.1, // Capture 10% of transactions
		// Session Replay
		replaysSessionSampleRate: 0.1, // Sample 10% of sessions
		replaysOnErrorSampleRate: 1.0, // Sample 100% of sessions with errors
	});
}

interface ApiError extends Error {
	status?: number;
}

/**
 * Type guard to check if an error is an ApiError
 */
function isApiError(error: unknown): error is ApiError {
	return error instanceof Error && 'status' in error;
}

/**
 * Global error handler for React Query
 * Displays toast notifications for API errors
 */
function handleGlobalError(error: unknown): void {
	const message = isApiError(error) ? error.message : 'An unexpected error occurred';
	const status = isApiError(error) ? error.status : undefined;
	
	// Don't show toast for 401 errors (handled by auth redirect)
	if (status === 401) {
		return;
	}
	
	// Show error toast for other errors
	toast.error(message);
}

const queryClient = new QueryClient({
	queryCache: new QueryCache({
		onError: (error, query) => {
			// Only show error toast if the query has already been loaded
			// This prevents showing errors for initial loads that are handled by the UI
			if (query.state.data !== undefined) {
				handleGlobalError(error)
			}
		},
	}),
	mutationCache: new MutationCache({
		onError: (error) => {
			handleGlobalError(error)
		},
	}),
	defaultOptions: {
		queries: {
			// Data is considered fresh for 5 minutes
			staleTime: 5 * 60 * 1000,
			// Keep unused data in cache for 30 minutes
			gcTime: 30 * 60 * 1000,
			// Only retry failed requests once
			retry: 1,
			// Don't refetch on window focus by default (can be overridden per query)
			refetchOnWindowFocus: false,
			// Refetch on reconnect
			refetchOnReconnect: true,
		},
		mutations: {
			// Don't retry failed mutations by default
			retry: 0,
		},
	},
})

const rootElement = document.getElementById('root')
if (!rootElement) {
	throw new Error('Root element not found')
}

ReactDOM.createRoot(rootElement).render(
	<StrictMode>
		<ErrorBoundary>
			<QueryClientProvider client={queryClient}>
				<App />
			</QueryClientProvider>
		</ErrorBoundary>
	</StrictMode>
)
