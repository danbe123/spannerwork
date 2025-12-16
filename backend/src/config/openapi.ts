export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'SpannerWork API',
    version: '1.0.0',
    description: 'Backend API for SpannerWork marketplace',
  },
  servers: [
    {
      url: 'http://localhost:3000/api/v1',
      description: 'Development',
    },
    {
      url: 'https://api.spannerwork.co.uk/api/v1',
      description: 'Production',
    },
  ],
  paths: {
    '/auth/register': {
      post: {
        summary: 'Register a new user',
        responses: {
          '201': {
            description: 'Registration successful',
          },
          '409': {
            description: 'User with this email already exists',
          },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Login a user',
        responses: {
          '200': {
            description: 'Login successful',
          },
          '401': {
            description: 'Invalid credentials or suspended account',
          },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Logout current user',
        responses: {
          '200': {
            description: 'Logout successful',
          },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get current authenticated user',
        responses: {
          '200': {
            description: 'Current user returned',
          },
          '401': {
            description: 'Not authenticated',
          },
        },
      },
    },
    '/requests': {
      get: {
        summary: 'List job requests',
        responses: {
          '200': {
            description: 'List of requests',
          },
        },
      },
      post: {
        summary: 'Create a job request',
        responses: {
          '201': {
            description: 'Request created',
          },
          '400': {
            description: 'Validation error',
          },
        },
      },
    },
    '/tools': {
      get: {
        summary: 'List tools',
        responses: {
          '200': {
            description: 'List of tools',
          },
        },
      },
      post: {
        summary: 'Create a tool listing',
        responses: {
          '201': {
            description: 'Tool created',
          },
          '400': {
            description: 'Validation error',
          },
        },
      },
    },
    '/transactions': {
      get: {
        summary: "List user's transactions",
        responses: {
          '200': {
            description: 'List of transactions',
          },
          '401': {
            description: 'Authentication required',
          },
        },
      },
      post: {
        summary: 'Create a transaction',
        responses: {
          '201': {
            description: 'Transaction created',
          },
          '400': {
            description: 'Bad request or booking conflict',
          },
        },
      },
    },
  },
}

export default openApiSpec
