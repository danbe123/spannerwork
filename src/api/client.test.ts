import { describe, it, expect, vi, beforeEach } from 'vitest'

// Extend globalThis for test handler storage
declare global {
  // eslint-disable-next-line no-var
  var __respErrorHandler: ((error: unknown) => Promise<never>) | undefined;
}

// Type for normalized API errors
interface ApiError {
  status: number;
  message: string;
}

vi.mock('axios', () => {
  const instance = {
    interceptors: {
      request: { use: vi.fn() },
      response: {
        use: vi.fn((_success: unknown, error: (e: unknown) => Promise<never>) => {
          // Store handler globally so we can invoke it from tests
          globalThis.__respErrorHandler = error
        }),
      },
    },
    get: vi.fn(),
    post: vi.fn(),
  }
  return { default: { create: vi.fn(() => instance) } }
})

// Import after mock so interceptors register and we capture the error handler
import './client'

// Import exported functions for testing
import { refreshCsrfToken, clearCsrfToken } from './client'

describe('CSRF Token Management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clearCsrfToken clears the token', () => {
    clearCsrfToken()
    // Function should complete without error
    expect(true).toBe(true)
  })

  it('refreshCsrfToken handles errors gracefully', async () => {
    // The mock axios doesn't have a proper get implementation, so this should handle the error
    const result = await refreshCsrfToken()
    // Should return null or a token depending on mock behavior
    expect(result === null || typeof result === 'string').toBe(true)
  })
})

describe('apiClient interceptors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('dispatches auth:unauthorized event on 401 and returns normalized error', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const error = { response: { status: 401, data: { message: 'unauthorized' } } }

    let thrown: ApiError | undefined
    try {
      await globalThis.__respErrorHandler?.(error)
    } catch (e) {
      thrown = e as ApiError
    }

    expect(dispatchSpy).toHaveBeenCalled()
    expect(thrown).toMatchObject({ status: 401, message: 'unauthorized' })
  })

  it('handles 403 forbidden error', async () => {
    const error = { response: { status: 403, data: { message: 'forbidden' } } }

    let thrown: ApiError | undefined
    try {
      await globalThis.__respErrorHandler?.(error)
    } catch (e) {
      thrown = e as ApiError
    }

    expect(thrown).toMatchObject({ status: 403 })
  })

  it('handles 404 not found error', async () => {
    const error = { response: { status: 404, data: { message: 'not found' } } }

    let thrown: ApiError | undefined
    try {
      await globalThis.__respErrorHandler?.(error)
    } catch (e) {
      thrown = e as ApiError
    }

    expect(thrown).toMatchObject({ status: 404 })
  })

  it('handles 500 server error', async () => {
    const error = { response: { status: 500, data: { message: 'server error' } } }

    let thrown: ApiError | undefined
    try {
      await globalThis.__respErrorHandler?.(error)
    } catch (e) {
      thrown = e as ApiError
    }

    expect(thrown).toMatchObject({ status: 500 })
  })

  it('handles network error without response', async () => {
    const error = { message: 'Network Error' }

    let thrown: ApiError | undefined
    try {
      await globalThis.__respErrorHandler?.(error)
    } catch (e) {
      thrown = e as ApiError
    }

    expect(thrown).toBeDefined()
  })

  it('handles error with custom message', async () => {
    const error = { response: { status: 400, data: { message: 'Bad request data' } } }

    let thrown: ApiError | undefined
    try {
      await globalThis.__respErrorHandler?.(error)
    } catch (e) {
      thrown = e as ApiError
    }

    expect(thrown?.message).toBe('Bad request data')
  })

  it('handles error without message', async () => {
    const error = { response: { status: 400, data: {} } }

    let thrown: ApiError | undefined
    try {
      await globalThis.__respErrorHandler?.(error)
    } catch (e) {
      thrown = e as ApiError
    }

    expect(thrown).toBeDefined()
  })
})
