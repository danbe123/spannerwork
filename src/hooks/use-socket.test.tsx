import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

// Mock socket.io-client before importing the hook
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  disconnect: vi.fn(),
  emit: vi.fn(),
  connected: false,
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}))

// Mock useAuth hook
vi.mock('./use-auth', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: false,
    user: null,
    isLoading: false,
  })),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}))

import { useSocket } from './use-socket'
import { useAuth } from './use-auth'
import { io } from 'socket.io-client'
import { toast } from 'sonner'

describe('useSocket', () => {
  let queryClient: QueryClient
  
  const createWrapper = () => {
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    
    // Reset mock socket
    mockSocket.on.mockClear()
    mockSocket.disconnect.mockClear()
    mockSocket.connected = false
  })

  afterEach(() => {
    queryClient.clear()
  })

  describe('when not authenticated', () => {
    it('does not connect to socket', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      })

      const { result } = renderHook(() => useSocket(), { wrapper: createWrapper() })

      expect(io).not.toHaveBeenCalled()
      expect(result.current.isConnected).toBe(false)
      expect(result.current.socket).toBeNull()
    })
  })

  describe('when authenticated', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        user: { id: 'user-1', email: 'test@example.com', name: 'Test User' } as any,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      })
    })

    it('connects to socket server', () => {
      renderHook(() => useSocket(), { wrapper: createWrapper() })

      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          withCredentials: true,
          transports: ['websocket', 'polling'],
          reconnection: true,
        })
      )
    })

    it('registers event listeners', () => {
      renderHook(() => useSocket(), { wrapper: createWrapper() })

      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('message:new', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('booking:update', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('transaction:update', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('notification', expect.any(Function))
    })

    it('sets isConnected to true on connect event', async () => {
      const { result } = renderHook(() => useSocket(), { wrapper: createWrapper() })

      // Get the connect handler
      const connectCall = mockSocket.on.mock.calls.find(call => call[0] === 'connect')
      const connectHandler = connectCall?.[1]
      
      // Trigger connect
      connectHandler?.()

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })
    })

    it('sets isConnected to false on disconnect event', async () => {
      const { result } = renderHook(() => useSocket(), { wrapper: createWrapper() })

      // Simulate connect then disconnect
      const connectCall = mockSocket.on.mock.calls.find(call => call[0] === 'connect')
      const disconnectCall = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')
      
      connectCall?.[1]?.()
      
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })
      
      disconnectCall?.[1]?.('io server disconnect')
      
      await waitFor(() => {
        expect(result.current.isConnected).toBe(false)
      })
    })

    it('disconnects socket on unmount', () => {
      const { unmount } = renderHook(() => useSocket(), { wrapper: createWrapper() })

      unmount()

      expect(mockSocket.disconnect).toHaveBeenCalled()
    })

    describe('message:new event', () => {
      it('invalidates message queries and shows toast', async () => {
        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
        
        renderHook(() => useSocket(), { wrapper: createWrapper() })

        const messageNewCall = mockSocket.on.mock.calls.find(call => call[0] === 'message:new')
        const handler = messageNewCall?.[1]

        handler?.({
          id: 'msg-1',
          senderId: 'sender-1',
          senderName: 'John Doe',
          content: 'Hello there!',
          createdDate: new Date().toISOString(),
        })

        await waitFor(() => {
          expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['messages'] })
          expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['conversations'] })
          expect(toast.info).toHaveBeenCalledWith(
            'New message from John Doe',
            expect.objectContaining({
              description: 'Hello there!',
            })
          )
        })
      })
    })

    describe('booking:update event', () => {
      it('invalidates booking queries and shows success toast for confirmed', async () => {
        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
        
        renderHook(() => useSocket(), { wrapper: createWrapper() })

        const bookingUpdateCall = mockSocket.on.mock.calls.find(call => call[0] === 'booking:update')
        const handler = bookingUpdateCall?.[1]

        handler?.({
          id: 'booking-1',
          status: 'CONFIRMED',
          type: 'tool',
          itemName: 'Power Drill',
        })

        await waitFor(() => {
          expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] })
          expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['calendar'] })
          expect(toast.success).toHaveBeenCalled()
        })
      })

      it('shows warning toast for cancelled booking', async () => {
        renderHook(() => useSocket(), { wrapper: createWrapper() })

        const bookingUpdateCall = mockSocket.on.mock.calls.find(call => call[0] === 'booking:update')
        const handler = bookingUpdateCall?.[1]

        handler?.({
          id: 'booking-1',
          status: 'CANCELLED',
          type: 'space',
          itemName: 'Workshop',
        })

        await waitFor(() => {
          expect(toast.warning).toHaveBeenCalled()
        })
      })
    })

    describe('transaction:update event', () => {
      it('invalidates transaction queries and shows toast', async () => {
        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
        
        renderHook(() => useSocket(), { wrapper: createWrapper() })

        const transactionUpdateCall = mockSocket.on.mock.calls.find(call => call[0] === 'transaction:update')
        const handler = transactionUpdateCall?.[1]

        handler?.({
          id: 'txn-12345678',
          status: 'COMPLETED',
          paymentStatus: 'PAID',
        })

        await waitFor(() => {
          expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['transactions'] })
          expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['transaction', 'txn-12345678'] })
          expect(toast.info).toHaveBeenCalled()
        })
      })
    })

    describe('notification event', () => {
      it('shows info toast for info notification', async () => {
        renderHook(() => useSocket(), { wrapper: createWrapper() })

        const notificationCall = mockSocket.on.mock.calls.find(call => call[0] === 'notification')
        const handler = notificationCall?.[1]

        handler?.({
          type: 'info',
          title: 'New Feature',
          message: 'Check out our new booking system!',
        })

        await waitFor(() => {
          expect(toast.info).toHaveBeenCalledWith('New Feature', expect.objectContaining({
            description: 'Check out our new booking system!',
          }))
        })
      })

      it('shows success toast for success notification', async () => {
        renderHook(() => useSocket(), { wrapper: createWrapper() })

        const notificationCall = mockSocket.on.mock.calls.find(call => call[0] === 'notification')
        const handler = notificationCall?.[1]

        handler?.({
          type: 'success',
          title: 'Payment Received',
          message: 'Your payment was successful',
        })

        await waitFor(() => {
          expect(toast.success).toHaveBeenCalledWith('Payment Received', expect.any(Object))
        })
      })

      it('shows warning toast for warning notification', async () => {
        renderHook(() => useSocket(), { wrapper: createWrapper() })

        const notificationCall = mockSocket.on.mock.calls.find(call => call[0] === 'notification')
        const handler = notificationCall?.[1]

        handler?.({
          type: 'warning',
          title: 'Booking Reminder',
          message: 'Your booking starts in 1 hour',
        })

        await waitFor(() => {
          expect(toast.warning).toHaveBeenCalledWith('Booking Reminder', expect.any(Object))
        })
      })

      it('shows error toast for error notification', async () => {
        renderHook(() => useSocket(), { wrapper: createWrapper() })

        const notificationCall = mockSocket.on.mock.calls.find(call => call[0] === 'notification')
        const handler = notificationCall?.[1]

        handler?.({
          type: 'error',
          title: 'Payment Failed',
          message: 'Your card was declined',
        })

        await waitFor(() => {
          expect(toast.error).toHaveBeenCalledWith('Payment Failed', expect.any(Object))
        })
      })

      it('includes link action when provided', async () => {
        renderHook(() => useSocket(), { wrapper: createWrapper() })

        const notificationCall = mockSocket.on.mock.calls.find(call => call[0] === 'notification')
        const handler = notificationCall?.[1]

        handler?.({
          type: 'info',
          title: 'New Message',
          message: 'You have a new message',
          link: '/messages',
        })

        await waitFor(() => {
          expect(toast.info).toHaveBeenCalledWith('New Message', expect.objectContaining({
            action: expect.objectContaining({
              label: 'View',
            }),
          }))
        })
      })
    })
  })

  describe('when authentication changes', () => {
    it('disconnects socket when user logs out', async () => {
      // Start authenticated
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        user: { id: 'user-1' } as any,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      })

      const { rerender } = renderHook(() => useSocket(), { wrapper: createWrapper() })

      // Log out
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      })

      rerender()

      await waitFor(() => {
        expect(mockSocket.disconnect).toHaveBeenCalled()
      })
    })
  })
})
