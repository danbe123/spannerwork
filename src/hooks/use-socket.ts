/**
 * WebSocket Hook
 * 
 * Provides real-time connection for:
 * - New messages
 * - Booking status updates
 * - Notifications
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from './use-auth';
import { queryKeys } from '@/lib/queryKeys';

// Prefer dedicated SOCKET_URL, fallback to deriving from API_URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 
  import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

// Event types for type safety
interface NewMessageEvent {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdDate: string;
}

interface BookingUpdateEvent {
  id: string;
  status: string;
  type: 'tool' | 'space' | 'service';
  itemName: string;
}

interface TransactionUpdateEvent {
  id: string;
  status: string;
  paymentStatus: string;
}

interface NotificationEvent {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  link?: string;
}

export interface UseSocketReturn {
  isConnected: boolean;
  socket: Socket | null;
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Stable ref for queryClient to avoid callback recreation
  const queryClientRef = useRef(queryClient);
  useEffect(() => {
    queryClientRef.current = queryClient;
  }, [queryClient]);

  // Handle new message - stable callback with no dependencies
  const handleNewMessage = useCallback((message: NewMessageEvent) => {
    // Invalidate messages query to refresh
    queryClientRef.current.invalidateQueries({ queryKey: queryKeys.messages() });
    queryClientRef.current.invalidateQueries({ queryKey: queryKeys.conversations() });

    // Show toast notification
    toast.info(`New message from ${message.senderName}`, {
      description: message.content.substring(0, 100),
      action: {
        label: 'View',
        onClick: () => {
          window.location.href = `/messages?user=${message.senderId}`;
        },
      },
    });
  }, []);

  // Handle booking update - stable callback with no dependencies
  const handleBookingUpdate = useCallback((booking: BookingUpdateEvent) => {
    // Invalidate relevant queries
    queryClientRef.current.invalidateQueries({ queryKey: queryKeys.bookings() });
    queryClientRef.current.invalidateQueries({ queryKey: queryKeys.calendar() });
    queryClientRef.current.invalidateQueries({ queryKey: queryKeys.transactions() });

    const statusMessages: Record<string, string> = {
      CONFIRMED: `Your ${booking.type} booking for "${booking.itemName}" has been confirmed!`,
      CANCELLED: `Your ${booking.type} booking for "${booking.itemName}" has been cancelled.`,
      COMPLETED: `Your ${booking.type} booking for "${booking.itemName}" is now complete.`,
    };

    const message = statusMessages[booking.status] || `Booking status updated to ${booking.status}`;

    if (booking.status === 'CANCELLED') {
      toast.warning(message);
    } else {
      toast.success(message);
    }
  }, []);

  // Handle transaction update - stable callback with no dependencies
  const handleTransactionUpdate = useCallback((transaction: TransactionUpdateEvent) => {
    // Invalidate relevant queries
    queryClientRef.current.invalidateQueries({ queryKey: queryKeys.transactions() });
    queryClientRef.current.invalidateQueries({ queryKey: queryKeys.transaction(transaction.id) });

    toast.info(`Transaction ${transaction.id.slice(0, 8)}... status: ${transaction.status}`);
  }, []);

  // Handle notification - stable callback with no dependencies
  const handleNotification = useCallback((notification: NotificationEvent) => {
    const toastFn = {
      info: toast.info,
      success: toast.success,
      warning: toast.warning,
      error: toast.error,
    }[notification.type] || toast.info;

    const link = notification.link;
    toastFn(notification.title, {
      description: notification.message,
      action: link ? {
        label: 'View',
        onClick: () => {
          window.location.href = link;
        },
      } : undefined,
    });
  }, []);

  useEffect(() => {
    // Only connect if authenticated
    if (!isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Create socket connection
    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', (_reason: string) => {
      setIsConnected(false);
    });

    socket.on('connect_error', (error: Error) => {
      if (import.meta.env.DEV) {
        console.error('WebSocket connection error:', error.message);
      }
      setIsConnected(false);
    });

    // Business events - callbacks are stable (no deps) so can be called directly
    socket.on('message:new', handleNewMessage);
    socket.on('booking:update', handleBookingUpdate);
    socket.on('transaction:update', handleTransactionUpdate);
    socket.on('notification', handleNotification);

    // Cleanup on unmount
    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [isAuthenticated, handleNewMessage, handleBookingUpdate, handleTransactionUpdate, handleNotification]);

  return {
    isConnected,
    socket: socketRef.current,
  };
}

export default useSocket;
