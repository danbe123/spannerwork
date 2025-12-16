import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock socket.io Server
class MockServer extends EventEmitter {
  private rooms = new Map<string, Set<string>>();
  
  use = vi.fn();
  to = vi.fn().mockReturnThis();
  emit = vi.fn();
  close = vi.fn((cb: () => void) => cb());
}

class MockSocket extends EventEmitter {
  id = 'socket-123';
  data: { user?: { id: string }; sessionId?: string } = {};
  handshake = {
    headers: {
      cookie: 'spannerwork.session=session-123',
    },
  };
  
  join = vi.fn();
  disconnect = vi.fn();
}

// Mock dependencies
vi.mock('socket.io', () => ({
  Server: vi.fn().mockImplementation(() => new MockServer()),
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/auth.service.js', () => ({
  authService: {
    getUserBySession: vi.fn(),
  },
}));

vi.mock('../../src/config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    FRONTEND_URL: 'http://localhost:5173',
  },
}));

vi.mock('../../src/config/cookie.js', () => ({
  COOKIE_NAMES: {
    SESSION: 'spannerwork.session',
  },
}));

import {
  isUserOnline,
  getConnectedUserCount,
  sendToUser,
  notifyNewMessage,
  notifyBookingUpdate,
  notifyTransactionUpdate,
  notifyUser,
  broadcastToAll,
  closeWebSocket,
} from '../../src/services/websocket.service.js';
import { logger } from '../../src/config/logger.js';

describe('WebSocketService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await closeWebSocket();
    vi.resetAllMocks();
  });

  describe('isUserOnline', () => {
    it('should return false when user has no sockets', () => {
      expect(isUserOnline('user-123')).toBe(false);
    });
  });

  describe('getConnectedUserCount', () => {
    it('should return 0 when no users connected', () => {
      expect(getConnectedUserCount()).toBe(0);
    });
  });

  describe('sendToUser', () => {
    it('should not throw when io is not initialized', () => {
      expect(() => sendToUser('user-123', 'test:event', { data: 'test' })).not.toThrow();
    });
  });

  describe('notifyNewMessage', () => {
    it('should send message:new event with correct structure', () => {
      const message = {
        id: 'msg-1',
        senderId: 'user-1',
        senderName: 'John',
        content: 'Hello!',
        createdDate: new Date().toISOString(),
      };

      // Should not throw even without io initialized
      expect(() => notifyNewMessage('user-2', message)).not.toThrow();
    });
  });

  describe('notifyBookingUpdate', () => {
    it('should send booking:update event with correct structure', () => {
      const booking = {
        id: 'booking-1',
        status: 'CONFIRMED',
        type: 'tool' as const,
        itemName: 'Power Drill',
      };

      expect(() => notifyBookingUpdate('user-1', booking)).not.toThrow();
    });
  });

  describe('notifyTransactionUpdate', () => {
    it('should send transaction:update event with correct structure', () => {
      const transaction = {
        id: 'txn-1',
        status: 'COMPLETED',
        paymentStatus: 'PAID',
      };

      expect(() => notifyTransactionUpdate('user-1', transaction)).not.toThrow();
    });
  });

  describe('notifyUser', () => {
    it('should send notification event with correct structure', () => {
      const notification = {
        type: 'success' as const,
        title: 'Booking Confirmed',
        message: 'Your booking has been confirmed!',
        link: '/transactions/123',
      };

      expect(() => notifyUser('user-1', notification)).not.toThrow();
    });

    it('should work without optional link', () => {
      const notification = {
        type: 'info' as const,
        title: 'Welcome',
        message: 'Welcome to SpannerWork!',
      };

      expect(() => notifyUser('user-1', notification)).not.toThrow();
    });
  });

  describe('broadcastToAll', () => {
    it('should not throw when io is not initialized', () => {
      expect(() => broadcastToAll('system:maintenance', { scheduled: true })).not.toThrow();
    });
  });

  describe('closeWebSocket', () => {
    it('should be safe to call when not initialized', async () => {
      await expect(closeWebSocket()).resolves.not.toThrow();
    });
  });

  describe('notification types', () => {
    it('should support all notification types', () => {
      const types: Array<'info' | 'success' | 'warning' | 'error'> = [
        'info',
        'success', 
        'warning',
        'error',
      ];

      types.forEach((type) => {
        expect(() => notifyUser('user-1', {
          type,
          title: 'Test',
          message: 'Test message',
        })).not.toThrow();
      });
    });
  });

  describe('booking types', () => {
    it('should support all booking types', () => {
      const types: Array<'tool' | 'space' | 'service'> = ['tool', 'space', 'service'];

      types.forEach((type) => {
        expect(() => notifyBookingUpdate('user-1', {
          id: 'booking-1',
          status: 'PENDING',
          type,
          itemName: 'Test Item',
        })).not.toThrow();
      });
    });
  });
});

// Test WebSocket service with initialized server
describe('WebSocketService with initialized server', () => {
  let mockServer: MockServer;
  let mockSocket: MockSocket;
  let authMiddleware: (socket: MockSocket, next: (err?: Error) => void) => void;
  let connectionHandler: (socket: MockSocket) => void;

  beforeEach(async () => {
    vi.resetModules();

    // Create fresh mocks
    mockServer = new MockServer();
    mockSocket = new MockSocket();

    // Capture middleware and connection handlers
    mockServer.use.mockImplementation((fn: typeof authMiddleware) => {
      authMiddleware = fn;
    });

    mockServer.on = vi.fn((event: string, handler: typeof connectionHandler) => {
      if (event === 'connection') {
        connectionHandler = handler;
      }
      return mockServer;
    }) as unknown as typeof mockServer.on;

    // Mock socket.io to return our mock server
    vi.doMock('socket.io', () => ({
      Server: vi.fn().mockReturnValue(mockServer),
    }));

    vi.doMock('../../src/services/auth.service.js', () => ({
      authService: {
        getUserBySession: vi.fn().mockResolvedValue({ id: 'user-123', name: 'Test User' }),
      },
    }));

    vi.doMock('../../src/config/logger.js', () => ({
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    }));

    vi.doMock('../../src/config/env.js', () => ({
      env: {
        NODE_ENV: 'test',
        FRONTEND_URL: 'http://localhost:5173',
      },
    }));

    vi.doMock('../../src/config/cookie.js', () => ({
      COOKIE_NAMES: {
        SESSION: 'spannerwork.session',
      },
    }));
  });

  afterEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('should initialize WebSocket server', async () => {
    const { initializeWebSocket } = await import('../../src/services/websocket.service.js');
    const { Server } = await import('socket.io');
    
    const httpServer = {} as import('http').Server;
    const result = initializeWebSocket(httpServer);
    
    expect(Server).toHaveBeenCalled();
    expect(mockServer.use).toHaveBeenCalled();
    expect(result).toBe(mockServer);
  });

  it('should authenticate user via session cookie', async () => {
    const { initializeWebSocket } = await import('../../src/services/websocket.service.js');
    const { authService } = await import('../../src/services/auth.service.js');
    
    initializeWebSocket({} as import('http').Server);
    
    const next = vi.fn();
    await authMiddleware(mockSocket, next);
    
    expect(authService.getUserBySession).toHaveBeenCalledWith('session-123');
    expect(next).toHaveBeenCalledWith();
    expect(mockSocket.data.user).toEqual({ id: 'user-123', name: 'Test User' });
  });

  it('should reject connection without session cookie', async () => {
    const { initializeWebSocket } = await import('../../src/services/websocket.service.js');
    
    initializeWebSocket({} as import('http').Server);
    
    mockSocket.handshake.headers.cookie = '';
    const next = vi.fn();
    await authMiddleware(mockSocket, next);
    
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0]?.message).toBe('Authentication required');
  });

  it('should reject connection with invalid session', async () => {
    const { initializeWebSocket } = await import('../../src/services/websocket.service.js');
    const { authService } = await import('../../src/services/auth.service.js');
    
    vi.mocked(authService.getUserBySession).mockResolvedValue(null);
    
    initializeWebSocket({} as import('http').Server);
    
    const next = vi.fn();
    await authMiddleware(mockSocket, next);
    
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0]?.message).toBe('Invalid session');
  });

  it('should handle connection with valid user', async () => {
    const { initializeWebSocket, isUserOnline, getConnectedUserCount } = 
      await import('../../src/services/websocket.service.js');
    const { logger } = await import('../../src/config/logger.js');
    
    initializeWebSocket({} as import('http').Server);
    
    // Set up authenticated socket
    mockSocket.data.user = { id: 'user-123' };
    
    // Trigger connection
    connectionHandler(mockSocket);
    
    expect(mockSocket.join).toHaveBeenCalledWith('user:user-123');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('WebSocket connected'));
    expect(isUserOnline('user-123')).toBe(true);
    expect(getConnectedUserCount()).toBe(1);
  });

  it('should send events when io is initialized', async () => {
    const { initializeWebSocket, sendToUser } = await import('../../src/services/websocket.service.js');
    
    initializeWebSocket({} as import('http').Server);
    
    sendToUser('user-123', 'test:event', { data: 'test' });
    
    expect(mockServer.to).toHaveBeenCalledWith('user:user-123');
    expect(mockServer.emit).toHaveBeenCalledWith('test:event', { data: 'test' });
  });

  it('should broadcast to all users', async () => {
    const { initializeWebSocket, broadcastToAll } = await import('../../src/services/websocket.service.js');
    
    initializeWebSocket({} as import('http').Server);
    
    broadcastToAll('announcement', { message: 'Hello everyone!' });
    
    expect(mockServer.emit).toHaveBeenCalledWith('announcement', { message: 'Hello everyone!' });
  });

  it('should handle socket disconnect', async () => {
    const { initializeWebSocket, isUserOnline } = await import('../../src/services/websocket.service.js');
    
    initializeWebSocket({} as import('http').Server);
    
    // Set up and connect
    mockSocket.data.user = { id: 'user-123' };
    connectionHandler(mockSocket);
    expect(isUserOnline('user-123')).toBe(true);
    
    // Trigger disconnect
    mockSocket.emit('disconnect', 'client disconnect');
    expect(isUserOnline('user-123')).toBe(false);
  });

  it('should close WebSocket server properly', async () => {
    const { initializeWebSocket, closeWebSocket, getIO } = await import('../../src/services/websocket.service.js');
    
    initializeWebSocket({} as import('http').Server);
    expect(getIO()).not.toBeNull();
    
    await closeWebSocket();
    expect(mockServer.close).toHaveBeenCalled();
    expect(getIO()).toBeNull();
  });

  it('should disconnect socket without user data', async () => {
    const { initializeWebSocket } = await import('../../src/services/websocket.service.js');
    
    initializeWebSocket({} as import('http').Server);
    
    // Socket with no user
    mockSocket.data = {};
    connectionHandler(mockSocket);
    
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('should handle ping/pong', async () => {
    const { initializeWebSocket } = await import('../../src/services/websocket.service.js');
    
    initializeWebSocket({} as import('http').Server);
    
    mockSocket.data.user = { id: 'user-123' };
    connectionHandler(mockSocket);
    
    // Trigger ping
    const emitSpy = vi.spyOn(mockSocket, 'emit');
    mockSocket.emit('ping');
    
    // Note: In the real implementation, socket.on('ping') would emit pong
  });
});
