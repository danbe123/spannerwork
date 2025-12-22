import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  sendPhoneCodeSchema,
  verifyPhoneCodeSchema,
  createRequestSchema,
  createToolSchema,
  createSpaceSchema as _createSpaceSchema,
  createServiceSchema,
  createReviewSchema,
  sendMessageSchema,
  updateUserSchema,
} from '../../src/utils/validation.schemas.js';

describe('Validation Schemas', () => {
  describe('registerSchema', () => {
    it('should accept valid registration data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'TestPass123!', // Requires special character
        name: 'Test User',
      };

      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'not-an-email',
        password: 'TestPass123',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject weak password (no uppercase)', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'testpass123',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject weak password (no lowercase)', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'TESTPASS123',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject weak password (no number)', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'TestPassword',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject password shorter than 8 characters', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'Test1',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should accept valid login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'anypassword',
      };

      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: '',
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('sendPhoneCodeSchema', () => {
    it('should accept valid phone number', () => {
      const validData = { phone: '+447123456789' };

      const result = sendPhoneCodeSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept phone with spaces and hyphens', () => {
      const validData = { phone: '+44 7123-456-789' };

      const result = sendPhoneCodeSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject phone number too short', () => {
      const invalidData = { phone: '12345' };

      const result = sendPhoneCodeSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 10');
      }
    });

    it('should reject phone with invalid characters', () => {
      const invalidData = { phone: '07123abc456' };

      const result = sendPhoneCodeSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('verifyPhoneCodeSchema', () => {
    it('should accept valid verification data', () => {
      const validData = {
        phone: '+447123456789',
        code: '123456',
      };

      const result = verifyPhoneCodeSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject code too short', () => {
      const invalidData = {
        phone: '+447123456789',
        code: '123',
      };

      const result = verifyPhoneCodeSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('createRequestSchema', () => {
    it('should accept valid request data', () => {
      const validData = {
        title: 'Need a power drill',
        description: 'I need a power drill for a home improvement project this weekend.',
        category: 'TOOLS',
        urgency: 'THIS_WEEKEND',
        budget: 50,
        rateType: 'DAILY',
        broadcastRadius: 10,
        postcode: 'SW1A 1AA',
      };

      const result = createRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject title too short', () => {
      const invalidData = {
        title: 'Hi',
        description: 'I need a power drill for a home improvement project.',
        category: 'TOOLS',
        urgency: 'ASAP',
        budget: 50,
        rateType: 'DAILY',
        broadcastRadius: 10,
        postcode: 'SW1A 1AA',
      };

      const result = createRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid postcode format', () => {
      const invalidData = {
        title: 'Need a power drill',
        description: 'I need a power drill for a home improvement project.',
        category: 'TOOLS',
        urgency: 'ASAP',
        budget: 50,
        rateType: 'DAILY',
        broadcastRadius: 10,
        postcode: '12345', // US format, not UK
      };

      const result = createRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept various UK postcode formats', () => {
      const postcodes = ['SW1A 1AA', 'M1 1AA', 'B33 8TH', 'CR2 6XH', 'DN55 1PT'];

      postcodes.forEach((postcode) => {
        const data = {
          title: 'Need a power drill',
          description: 'I need a power drill for a home improvement project.',
          category: 'TOOLS',
          urgency: 'ASAP',
          budget: 50,
          rateType: 'DAILY',
          broadcastRadius: 10,
          postcode,
        };

        const result = createRequestSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('createToolSchema', () => {
    it('should accept valid tool data', () => {
      const validData = {
        name: 'Power Drill',
        description: 'Professional grade power drill, great for home projects.',
        category: 'Power Tools',
        dailyRate: 2500, // £25 in pence
        deposit: 5000, // £50 in pence
        photos: ['https://example.com/photo1.jpg'],
        condition: 'Excellent',
        postcode: 'SW1A 1AA',
      };

      const result = createToolSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require at least one photo', () => {
      const invalidData = {
        name: 'Power Drill',
        description: 'Professional grade power drill, great for home projects.',
        category: 'Power Tools',
        dailyRate: 2500,
        deposit: 5000,
        photos: [], // Empty
        condition: 'Excellent',
        postcode: 'SW1A 1AA',
      };

      const result = createToolSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('createServiceSchema', () => {
    it('should accept valid service data', () => {
      const validData = {
        name: 'Mobile Mechanic',
        description: 'Professional mobile mechanic service for all car repairs.',
        specialties: ['Engine Repair', 'Brake Service'],
        hourlyRate: 5000, // £50 in pence
        radius: 20,
        postcode: 'SW1A 1AA',
      };

      const result = createServiceSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require at least one specialty', () => {
      const invalidData = {
        name: 'Mobile Mechanic',
        description: 'Professional mobile mechanic service for all car repairs.',
        specialties: [], // Empty
        hourlyRate: 5000,
        radius: 20,
        postcode: 'SW1A 1AA',
      };

      const result = createServiceSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('createReviewSchema', () => {
    it('should accept valid review data', () => {
      const validData = {
        transactionId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
        reviewedUserId: 'clyyyyyyyyyyyyyyyyyyyyyyyyy',
        rating: 5,
        comment: 'Great service!',
      };

      const result = createReviewSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject rating below 1', () => {
      const invalidData = {
        transactionId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
        reviewedUserId: 'clyyyyyyyyyyyyyyyyyyyyyyyyy',
        rating: 0,
      };

      const result = createReviewSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject rating above 5', () => {
      const invalidData = {
        transactionId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
        reviewedUserId: 'clyyyyyyyyyyyyyyyyyyyyyyyyy',
        rating: 6,
      };

      const result = createReviewSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('sendMessageSchema', () => {
    it('should accept valid message data', () => {
      const validData = {
        recipientId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
        content: 'Hello, I am interested in your listing!',
      };

      const result = sendMessageSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty message', () => {
      const invalidData = {
        recipientId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
        content: '',
      };

      const result = sendMessageSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject message over 5000 characters', () => {
      const invalidData = {
        recipientId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
        content: 'a'.repeat(5001),
      };

      const result = sendMessageSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('updateUserSchema', () => {
    it('should accept valid username', () => {
      const validData = {
        username: 'john_doe_123',
      };

      const result = updateUserSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject username with special characters', () => {
      const invalidData = {
        username: 'john@doe',
      };

      const result = updateUserSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject username too short', () => {
      const invalidData = {
        username: 'ab',
      };

      const result = updateUserSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
