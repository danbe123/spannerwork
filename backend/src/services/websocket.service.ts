/**
 * WebSocket Service
 *
 * Provides real-time communication for:
 * - New messages
 * - Booking status updates
 * - Notifications
 *
 * Security features:
 * - Per-user connection limits (prevents resource exhaustion)
 * - Per-IP connection limits (prevents DoS from single source)
 * - Global connection limit (protects server resources)
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from '../config/logger.js';
import { authService } from './auth.service.js';
import { env } from '../config/env.js';
import cookie from 'cookie';
import { COOKIE_NAMES } from '../config/cookie.js';

// Connection limit constants
const MAX_CONNECTIONS_PER_USER = 5;   // Max devices/tabs per user
const MAX_CONNECTIONS_PER_IP = 20;    // Max connections from single IP
const MAX_TOTAL_CONNECTIONS = 10000;  // Global connection limit

// Track connected users by userId -> Set of socketIds
const userSockets = new Map<string, Set<string>>();

// Track connections by IP address
const ipConnections = new Map<string, Set<string>>();

// Socket.io server instance
let io: Server | null = null;

/**
 * Get client IP address from socket
 */
function getClientIP(socket: Socket): string {
  // Check X-Forwarded-For header (when behind proxy/load balancer)
  const forwardedFor = socket.handshake.headers['x-forwarded-for'];
  if (forwardedFor) {
    // Take the first IP in the chain (original client)
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0];
    return ips.trim();
  }
  // Fall back to direct connection address
  return socket.handshake.address;
}

/**
 * Get current connection counts for monitoring
 */
export function getConnectionStats(): {
  totalConnections: number;
  uniqueUsers: number;
  uniqueIPs: number;
} {
  let totalConnections = 0;
  userSockets.forEach(sockets => {
    totalConnections += sockets.size;
  });

  return {
    totalConnections,
    uniqueUsers: userSockets.size,
    uniqueIPs: ipConnections.size,
  };
}

/**
 * Initialize WebSocket server
 */
export function initializeWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.NODE_ENV === 'development'
        ? true
        : env.FRONTEND_URL,
      credentials: true,
    },
    // Use WebSocket transport primarily, fallback to polling
    transports: ['websocket', 'polling'],
    // Ping timeout and interval for connection health
    pingTimeout: 60000,
    pingInterval: 25000,
    // Connection limits at transport level
    maxHttpBufferSize: 1e6, // 1MB max message size
  });

  // Authentication middleware
  io.use(async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const clientIP = getClientIP(socket);

      // Check global connection limit
      const stats = getConnectionStats();
      if (stats.totalConnections >= MAX_TOTAL_CONNECTIONS) {
        logger.warn(`WebSocket connection rejected: global limit reached (${stats.totalConnections})`);
        return next(new Error('Server at capacity. Please try again later.'));
      }

      // Check per-IP connection limit
      const ipSocketCount = ipConnections.get(clientIP)?.size || 0;
      if (ipSocketCount >= MAX_CONNECTIONS_PER_IP) {
        logger.warn(`WebSocket connection rejected: IP limit reached for ${clientIP} (${ipSocketCount})`);
        return next(new Error('Too many connections from this address'));
      }

      // Parse cookies from handshake
      const cookies = cookie.parse(socket.handshake.headers.cookie || '');
      const sessionId = cookies[COOKIE_NAMES.SESSION];

      if (!sessionId) {
        return next(new Error('Authentication required'));
      }

      // Verify session
      const user = await authService.getUserBySession(sessionId);
      if (!user) {
        return next(new Error('Invalid session'));
      }

      // Check per-user connection limit
      const userSocketCount = userSockets.get(user.id)?.size || 0;
      if (userSocketCount >= MAX_CONNECTIONS_PER_USER) {
        logger.warn(`WebSocket connection rejected: user limit reached for ${user.id} (${userSocketCount})`);
        return next(new Error('Too many active connections. Please close other tabs or devices.'));
      }

      // Attach user and IP to socket
      socket.data.user = user;
      socket.data.sessionId = sessionId;
      socket.data.clientIP = clientIP;

      next();
    } catch (error) {
      logger.error('WebSocket auth error:', error);
      next(new Error('Authentication failed'));
    }
  });

  // Connection handler
  io.on('connection', (socket: Socket) => {
    const userId = socket.data.user?.id;
    const clientIP = socket.data.clientIP;

    if (!userId) {
      socket.disconnect();
      return;
    }

    logger.info(`WebSocket connected: user=${userId}, socket=${socket.id}, ip=${clientIP}`);

    // Track user socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    // Track IP connection
    if (clientIP) {
      if (!ipConnections.has(clientIP)) {
        ipConnections.set(clientIP, new Set());
      }
      ipConnections.get(clientIP)!.add(socket.id);
    }

    // Join user-specific room for targeted messages
    socket.join(`user:${userId}`);

    // Handle ping for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Handle disconnect
    socket.on('disconnect', (reason: string) => {
      logger.info(`WebSocket disconnected: user=${userId}, socket=${socket.id}, reason=${reason}`);

      // Clean up user socket tracking
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
        }
      }

      // Clean up IP connection tracking
      if (clientIP) {
        const ipSockets = ipConnections.get(clientIP);
        if (ipSockets) {
          ipSockets.delete(socket.id);
          if (ipSockets.size === 0) {
            ipConnections.delete(clientIP);
          }
        }
      }
    });

    // Handle errors
    socket.on('error', (error: Error) => {
      logger.error(`WebSocket error: user=${userId}, socket=${socket.id}`, error);
    });
  });

  logger.info('✅ WebSocket server initialized');
  return io;
}

/**
 * Get Socket.io server instance
 */
export function getIO(): Server | null {
  return io;
}

/**
 * Check if a user is online (has active connections)
 */
export function isUserOnline(userId: string): boolean {
  const sockets = userSockets.get(userId);
  return sockets ? sockets.size > 0 : false;
}

/**
 * Get count of connected users
 */
export function getConnectedUserCount(): number {
  return userSockets.size;
}

/**
 * Send event to a specific user (all their connected devices)
 */
export function sendToUser(userId: string, event: string, data: unknown): void {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
    logger.debug(`Sent ${event} to user ${userId}`);
  }
}

/**
 * Send new message notification
 */
export function notifyNewMessage(recipientId: string, message: {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdDate: string;
}): void {
  sendToUser(recipientId, 'message:new', message);
}

/**
 * Send booking status update
 */
export function notifyBookingUpdate(userId: string, booking: {
  id: string;
  status: string;
  type: 'tool' | 'space' | 'service';
  itemName: string;
}): void {
  sendToUser(userId, 'booking:update', booking);
}

/**
 * Send transaction status update
 */
export function notifyTransactionUpdate(userId: string, transaction: {
  id: string;
  status: string;
  paymentStatus: string;
}): void {
  sendToUser(userId, 'transaction:update', transaction);
}

/**
 * Send generic notification
 */
export function notifyUser(userId: string, notification: {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  link?: string;
}): void {
  sendToUser(userId, 'notification', notification);
}

/**
 * Broadcast to all connected users (use sparingly)
 */
export function broadcastToAll(event: string, data: unknown): void {
  if (io) {
    io.emit(event, data);
    logger.debug(`Broadcast ${event} to all users`);
  }
}

/**
 * Broadcast activity event to all connected users
 */
export function broadcastActivity(activity: {
  id: string;
  type: string;
  message: string;
  icon: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  targetType?: string | null;
  targetId?: string | null;
}): void {
  broadcastToAll('activity', activity);
}

/**
 * Broadcast new request to providers in a local area
 */
export function broadcastNewRequest(postcodeArea: string, request: {
  id: string;
  title: string;
  category: string;
  budget: number;
  urgency: string;
  seekerName: string;
}): void {
  if (io) {
    io.to(`local:${postcodeArea}`).emit('new-request', request);
    logger.debug(`Broadcast new-request to local:${postcodeArea}`);
  }
}

/**
 * Notify seeker that their request was accepted
 */
export function notifyRequestAccepted(seekerId: string, data: {
  requestId: string;
  transactionId: string;
  providerName: string;
  providerAvatar?: string;
}): void {
  sendToUser(seekerId, 'request-accepted', data);
}

/**
 * Broadcast live stats update
 */
export function broadcastStats(stats: {
  activeListings: number;
  activeRequests: number;
  recentTransactions: number;
}): void {
  broadcastToAll('stats', { ...stats, updatedAt: new Date().toISOString() });
}

/**
 * Close WebSocket server
 */
export async function closeWebSocket(): Promise<void> {
  if (io) {
    await new Promise<void>((resolve) => {
      io!.close(() => {
        logger.info('WebSocket server closed');
        resolve();
      });
    });
    io = null;
    userSockets.clear();
    ipConnections.clear();
  }
}

export default {
  initializeWebSocket,
  getIO,
  isUserOnline,
  getConnectedUserCount,
  getConnectionStats,
  sendToUser,
  notifyNewMessage,
  notifyBookingUpdate,
  notifyTransactionUpdate,
  notifyUser,
  broadcastToAll,
  broadcastActivity,
  broadcastNewRequest,
  notifyRequestAccepted,
  broadcastStats,
  closeWebSocket,
};
