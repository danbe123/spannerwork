/**
 * Swagger/OpenAPI Configuration
 * 
 * This module sets up API documentation using swagger-jsdoc and swagger-ui-express.
 * Documentation is available at /api/v1/docs in non-production environments.
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application, Request, Response } from 'express';
import { env } from './env.js';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SpannerWork API',
      version: '1.0.0',
      description: `
        SpannerWork is a peer-to-peer marketplace for renting tools, spaces, and services.
        
        ## Authentication
        The API uses session-based authentication with httpOnly cookies. 
        Most endpoints require authentication via a valid session.
        
        ## CSRF Protection
        State-changing requests (POST, PUT, PATCH, DELETE) require a CSRF token.
        Get a token from \`GET /api/v1/csrf-token\` and include it in the \`X-CSRF-Token\` header.
        
        ## Rate Limiting
        - General API: 100 requests per 15 minutes
        - Auth endpoints: 5 requests per 15 minutes
        - Upload endpoints: 10 requests per hour
      `,
      contact: {
        name: 'SpannerWork Support',
        email: 'support@spannerwork.co.uk',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'API v1',
      },
    ],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User management' },
      { name: 'Tools', description: 'Tool listings' },
      { name: 'Spaces', description: 'Space listings' },
      { name: 'Services', description: 'Service listings' },
      { name: 'Requests', description: 'Job requests' },
      { name: 'Messages', description: 'Messaging' },
      { name: 'Transactions', description: 'Transactions and bookings' },
      { name: 'Reviews', description: 'Reviews and ratings' },
      { name: 'Admin', description: 'Admin endpoints' },
    ],
    components: {
      securitySchemes: {
        sessionAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'sessionId',
          description: 'Session-based authentication via httpOnly cookie',
        },
        csrfToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-CSRF-Token',
          description: 'CSRF token for state-changing requests',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'User ID' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            username: { type: 'string', nullable: true },
            avatar: { type: 'string', nullable: true },
            bio: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            role: { type: 'string', enum: ['USER', 'ADMIN', 'MODERATOR'] },
            emailVerified: { type: 'boolean' },
            phoneVerified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Tool: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            condition: { type: 'string' },
            dailyRate: { type: 'integer', description: 'Rate in pence' },
            weeklyRate: { type: 'integer', nullable: true },
            deposit: { type: 'integer', description: 'Deposit in pence' },
            available: { type: 'boolean' },
            photos: { type: 'array', items: { type: 'string' } },
            locationLat: { type: 'number' },
            locationLng: { type: 'number' },
            ownerId: { type: 'string' },
          },
        },
        Space: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            hourlyRate: { type: 'integer' },
            dailyRate: { type: 'integer' },
            size: { type: 'integer', nullable: true },
            features: { type: 'array', items: { type: 'string' } },
            available: { type: 'boolean' },
            photos: { type: 'array', items: { type: 'string' } },
            ownerId: { type: 'string' },
          },
        },
        Service: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            specialties: { type: 'array', items: { type: 'string' } },
            hourlyRate: { type: 'integer' },
            radius: { type: 'integer' },
            available: { type: 'boolean' },
            photos: { type: 'array', items: { type: 'string' } },
            providerId: { type: 'string' },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            providerId: { type: 'string' },
            status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED'] },
            rentalFee: { type: 'integer' },
            platformFee: { type: 'integer' },
            totalAmount: { type: 'integer' },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        Forbidden: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        BadRequest: {
          description: 'Invalid request data',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationError' },
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

/**
 * Set up Swagger documentation routes
 */
export function setupSwagger(app: Application): void {
  // Only enable in development or staging
  if (env.NODE_ENV === 'production') {
    return;
  }

  // Serve swagger UI
  app.use(
    '/api/v1/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'SpannerWork API Documentation',
    })
  );

  // Serve raw OpenAPI spec as JSON
  app.get('/api/v1/docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

export { swaggerSpec };
