import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock socket.io-client - use vi.hoisted to avoid hoisting issues
const mockSocket = vi.hoisted(() => ({
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
}));

const mockIo = vi.hoisted(() => vi.fn());

vi.mock('socket.io-client', () => ({
  io: mockIo,
}));

// Mock use-haptics
vi.mock('./use-haptics', () => ({
  useHaptics: () => ({
    notification: vi.fn(),
    success: vi.fn(),
  }),
}));

import { useRealtimeActivity, useProviderNotifications } from './use-realtime-activity';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('useRealtimeActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-configure mocks after clearAllMocks
    mockIo.mockReturnValue(mockSocket);
    mockSocket.on.mockReturnValue(mockSocket);
    mockSocket.off.mockReturnValue(mockSocket);
    mockSocket.emit.mockReturnValue(mockSocket);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('connection management', () => {
    it('connects to socket when enabled', () => {
      renderHook(
        () => useRealtimeActivity({ enabled: true }),
        { wrapper: createWrapper() }
      );

      // Socket should register event handlers
      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('does not connect when disabled', () => {
      renderHook(
        () => useRealtimeActivity({ enabled: false }),
        { wrapper: createWrapper() }
      );

      expect(mockSocket.on).not.toHaveBeenCalled();
    });

    it('disconnects on unmount', () => {
      const { unmount } = renderHook(
        () => useRealtimeActivity({ enabled: true }),
        { wrapper: createWrapper() }
      );

      unmount();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('updates isConnected state on connect', async () => {
      const { result } = renderHook(
        () => useRealtimeActivity({ enabled: true }),
        { wrapper: createWrapper() }
      );

      // Initial state
      expect(result.current.isConnected).toBe(false);

      // Simulate connect event
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1];
      
      if (connectHandler) {
        act(() => {
          connectHandler();
        });
      }

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });
    });
  });

  describe('activity events', () => {
    it('calls onActivity callback when activity event received', async () => {
      const onActivity = vi.fn();
      
      renderHook(
        () => useRealtimeActivity({ enabled: true, onActivity }),
        { wrapper: createWrapper() }
      );

      // Find and call the activity event handler
      const activityHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'activity'
      )?.[1];

      const mockEvent = {
        id: 'event-1',
        type: 'test',
        data: {},
        timestamp: new Date().toISOString(),
      };

      if (activityHandler) {
        act(() => {
          activityHandler(mockEvent);
        });
      }

      expect(onActivity).toHaveBeenCalledWith(mockEvent);
    });

    it('stores activities in state', async () => {
      const { result } = renderHook(
        () => useRealtimeActivity({ enabled: true }),
        { wrapper: createWrapper() }
      );

      // Initial state
      expect(result.current.activities).toEqual([]);

      // Simulate activity event
      const activityHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'activity'
      )?.[1];

      const mockEvent = {
        id: 'event-1',
        type: 'test',
        data: {},
        timestamp: new Date().toISOString(),
      };

      if (activityHandler) {
        act(() => {
          activityHandler(mockEvent);
        });
      }

      await waitFor(() => {
        expect(result.current.activities.length).toBe(1);
        expect(result.current.activities[0]).toEqual(mockEvent);
      });
    });

    it('limits activities to 50', async () => {
      const { result } = renderHook(
        () => useRealtimeActivity({ enabled: true }),
        { wrapper: createWrapper() }
      );

      const activityHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'activity'
      )?.[1];

      if (activityHandler) {
        // Add 60 activities
        act(() => {
          for (let i = 0; i < 60; i++) {
            activityHandler({
              id: `event-${i}`,
              type: 'test',
              data: {},
              timestamp: new Date().toISOString(),
            });
          }
        });
      }

      await waitFor(() => {
        expect(result.current.activities.length).toBe(50);
      });
    });
  });

  describe('room management', () => {
    it('joinRoom emits join event', () => {
      const { result } = renderHook(
        () => useRealtimeActivity({ enabled: true }),
        { wrapper: createWrapper() }
      );

      act(() => {
        result.current.joinRoom('test-room');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('join', 'test-room');
    });

    it('leaveRoom emits leave event', () => {
      const { result } = renderHook(
        () => useRealtimeActivity({ enabled: true }),
        { wrapper: createWrapper() }
      );

      act(() => {
        result.current.leaveRoom('test-room');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('leave', 'test-room');
    });

    it('subscribeToLocal joins local area room', () => {
      const { result } = renderHook(
        () => useRealtimeActivity({ enabled: true }),
        { wrapper: createWrapper() }
      );

      act(() => {
        result.current.subscribeToLocal('SW1A 1AA');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('join', 'local:SW1A');
    });
  });

  describe('stats updates', () => {
    it('updates stats on stats event', async () => {
      const { result } = renderHook(
        () => useRealtimeActivity({ enabled: true }),
        { wrapper: createWrapper() }
      );

      // Initial state
      expect(result.current.stats).toBeNull();

      // Simulate stats event
      const statsHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'stats'
      )?.[1];

      const mockStats = {
        activeUsers: 100,
        activeRequests: 50,
        completedToday: 25,
      };

      if (statsHandler) {
        act(() => {
          statsHandler(mockStats);
        });
      }

      await waitFor(() => {
        expect(result.current.stats).toEqual(mockStats);
      });
    });
  });
});

describe('useProviderNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-configure mocks after clearAllMocks
    mockIo.mockReturnValue(mockSocket);
    mockSocket.on.mockReturnValue(mockSocket);
    mockSocket.off.mockReturnValue(mockSocket);
    mockSocket.emit.mockReturnValue(mockSocket);
    
    // Mock Notification API
    Object.defineProperty(globalThis, 'Notification', {
      value: {
        permission: 'denied',
        requestPermission: vi.fn(),
      },
      writable: true,
    });
  });

  it('subscribes to local area when postcode provided', async () => {
    renderHook(
      () => useProviderNotifications('SW1A 1AA'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith('join', 'local:SW1A');
    });
  });

  it('does not subscribe when no postcode', () => {
    renderHook(
      () => useProviderNotifications(undefined),
      { wrapper: createWrapper() }
    );

    expect(mockSocket.on).not.toHaveBeenCalled();
  });

  it('dismissRequest removes request from list', async () => {
    const { result } = renderHook(
      () => useProviderNotifications('SW1A 1AA'),
      { wrapper: createWrapper() }
    );

    // Add a request
    const newRequestHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'new-request'
    )?.[1];

    if (newRequestHandler) {
      act(() => {
        newRequestHandler({
          id: 'req-1',
          title: 'Test Request',
          budget: 5000,
          category: 'Tool',
          postcode: 'SW1A',
        });
      });
    }

    await waitFor(() => {
      expect(result.current.newRequests.length).toBe(1);
    });

    // Dismiss it
    act(() => {
      result.current.dismissRequest('req-1');
    });

    expect(result.current.newRequests.length).toBe(0);
  });

  it('clearAll removes all requests', async () => {
    const { result } = renderHook(
      () => useProviderNotifications('SW1A 1AA'),
      { wrapper: createWrapper() }
    );

    // Add multiple requests
    const newRequestHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'new-request'
    )?.[1];

    if (newRequestHandler) {
      act(() => {
        newRequestHandler({ id: 'req-1', title: 'Request 1', budget: 1000, category: 'Tool', postcode: 'SW1A' });
        newRequestHandler({ id: 'req-2', title: 'Request 2', budget: 2000, category: 'Space', postcode: 'SW1A' });
      });
    }

    await waitFor(() => {
      expect(result.current.newRequests.length).toBe(2);
    });

    // Clear all
    act(() => {
      result.current.clearAll();
    });

    expect(result.current.newRequests.length).toBe(0);
  });
});
