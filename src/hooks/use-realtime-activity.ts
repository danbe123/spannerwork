import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { useHaptics } from './use-haptics';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Real-time Activity Hook
 * 
 * Connects to WebSocket for live platform activity updates.
 * Provides real-time notifications and activity feed updates.
 */

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:3000';

interface ActivityEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

interface RequestEvent {
  id: string;
  title: string;
  budget: number;
  category: string;
  postcode: string;
}

interface RequestAcceptedEvent {
  requestId: string;
  providerId: string;
  providerName: string;
}

interface Stats {
  activeUsers: number;
  activeRequests: number;
  completedToday: number;
}

interface UseRealtimeActivityOptions {
  enabled?: boolean;
  onActivity?: ((event: ActivityEvent) => void) | null;
  onNewRequest?: ((request: RequestEvent) => void) | null;
  onRequestAccepted?: ((data: RequestAcceptedEvent) => void) | null;
  playSound?: boolean;
}

interface UseRealtimeActivityReturn {
  isConnected: boolean;
  activities: ActivityEvent[];
  stats: Stats | null;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  subscribeToLocal: (postcode: string) => void;
}

export function useRealtimeActivity(options: UseRealtimeActivityOptions = {}): UseRealtimeActivityReturn {
  const {
    enabled = true,
    onActivity = null,
    onNewRequest = null,
    onRequestAccepted = null,
    playSound = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();
  const haptics = useHaptics();

  // Connect to socket
  useEffect(() => {
    if (!enabled) return;

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen for activity events
    socket.on('activity', (event: ActivityEvent) => {
      setActivities((prev) => [event, ...prev].slice(0, 50));
      
      if (playSound) {
        haptics.notification({ sound: true, haptic: false });
      }
      
      onActivity?.(event);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed() });
    });

    // Listen for new requests (for providers)
    socket.on('new-request', (request: RequestEvent) => {
      if (playSound) {
        haptics.notification({ sound: true, haptic: true });
      }
      
      onNewRequest?.(request);
      
      // Invalidate requests query
      queryClient.invalidateQueries({ queryKey: queryKeys.requests() });
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingResponses() });
    });

    // Listen for request accepted (for seekers)
    socket.on('request-accepted', (data: RequestAcceptedEvent) => {
      if (playSound) {
        haptics.success({ sound: true, haptic: true });
      }
      
      onRequestAccepted?.(data);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: queryKeys.myRequests() });
    });

    // Listen for live stats
    socket.on('stats', (newStats: Stats) => {
      setStats(newStats);
    });

    // Cleanup
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, playSound, onActivity, onNewRequest, onRequestAccepted, queryClient, haptics]);

  // Join a room (e.g., for local activity)
  const joinRoom = useCallback((room: string) => {
    socketRef.current?.emit('join', room);
  }, []);

  // Leave a room
  const leaveRoom = useCallback((room: string) => {
    socketRef.current?.emit('leave', room);
  }, []);

  // Subscribe to local area activity
  const subscribeToLocal = useCallback((postcode: string) => {
    const area = postcode?.split(' ')[0];
    if (area) {
      joinRoom(`local:${area}`);
    }
  }, [joinRoom]);

  return {
    isConnected,
    activities,
    stats,
    joinRoom,
    leaveRoom,
    subscribeToLocal,
  };
}

interface UseProviderNotificationsReturn {
  isConnected: boolean;
  newRequests: RequestEvent[];
  dismissRequest: (requestId: string) => void;
  clearAll: () => void;
}

/**
 * Hook for providers to receive real-time job notifications
 */
export function useProviderNotifications(postcode: string | undefined): UseProviderNotificationsReturn {
  const [newRequests, setNewRequests] = useState<RequestEvent[]>([]);

  const { isConnected, subscribeToLocal } = useRealtimeActivity({
    enabled: !!postcode,
    onNewRequest: (request) => {
      setNewRequests((prev) => [request, ...prev].slice(0, 10));
      
      // Show browser notification if permitted
      if (Notification.permission === 'granted') {
        new Notification('New Job Near You!', {
          body: `${request.title} - £${request.budget / 100}`,
          icon: '/icon-192.png',
          tag: `request-${request.id}`,
        });
      }
    },
  });

  // Subscribe to local area on mount
  useEffect(() => {
    if (postcode) {
      subscribeToLocal(postcode);
    }
  }, [postcode, subscribeToLocal]);

  const dismissRequest = useCallback((requestId: string) => {
    setNewRequests((prev) => prev.filter((r) => r.id !== requestId));
  }, []);

  const clearAll = useCallback(() => {
    setNewRequests([]);
  }, []);

  return {
    isConnected,
    newRequests,
    dismissRequest,
    clearAll,
  };
}

export default useRealtimeActivity;
