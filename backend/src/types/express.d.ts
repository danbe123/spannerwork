// Extend Express Request type to include user and custom properties
import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
      apiVersion?: string;
      resourceOwnerId?: string;
      correlationId?: string;
    }
  }
}

export {};
