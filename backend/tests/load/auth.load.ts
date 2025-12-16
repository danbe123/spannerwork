/**
 * Load Test: Authentication Endpoints
 * 
 * Tests the performance and reliability of authentication endpoints
 * under various load conditions.
 * 
 * Run with: k6 run backend/tests/load/auth.load.ts
 * 
 * Prerequisites:
 * - k6 installed (https://k6.io/docs/getting-started/installation/)
 * - Backend server running
 * - Test database with seed data
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const loginSuccess = new Rate('login_success');
const loginDuration = new Trend('login_duration');

// Test configuration
export const options = {
  stages: [
    // Ramp up to 10 users over 30 seconds
    { duration: '30s', target: 10 },
    // Stay at 10 users for 1 minute
    { duration: '1m', target: 10 },
    // Ramp up to 50 users over 30 seconds
    { duration: '30s', target: 50 },
    // Stay at 50 users for 2 minutes
    { duration: '2m', target: 50 },
    // Ramp down to 0 users
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],   // Less than 1% of requests should fail
    login_success: ['rate>0.95'],     // 95% of logins should succeed
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data
const testUsers = [
  { email: 'loadtest1@example.com', password: 'Password123!' },
  { email: 'loadtest2@example.com', password: 'Password123!' },
  { email: 'loadtest3@example.com', password: 'Password123!' },
];

// Get CSRF token
function getCsrfToken(): string {
  const response = http.get(`${BASE_URL}/api/v1/csrf/token`);
  if (response.status === 200) {
    const body = JSON.parse(response.body as string);
    return body.csrfToken;
  }
  return '';
}

export default function () {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  
  group('Authentication Flow', function () {
    // Get CSRF token first
    const csrfToken = getCsrfToken();
    
    // Attempt login
    group('Login', function () {
      const startTime = Date.now();
      
      const loginResponse = http.post(
        `${BASE_URL}/api/v1/auth/login`,
        JSON.stringify({
          email: user.email,
          password: user.password,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
        }
      );
      
      const duration = Date.now() - startTime;
      loginDuration.add(duration);
      
      const success = check(loginResponse, {
        'login status is 200': (r) => r.status === 200,
        'login returns user': (r) => {
          const body = JSON.parse(r.body as string);
          return body.user !== undefined;
        },
        'login sets session cookie': (r) => {
          const cookies = r.cookies;
          return cookies.sessionId !== undefined;
        },
      });
      
      loginSuccess.add(success ? 1 : 0);
      
      // If login successful, test authenticated endpoint
      if (loginResponse.status === 200) {
        group('Authenticated Request', function () {
          const meResponse = http.get(`${BASE_URL}/api/v1/auth/me`);
          
          check(meResponse, {
            'me returns 200': (r) => r.status === 200,
            'me returns current user': (r) => {
              const body = JSON.parse(r.body as string);
              return body.user && body.user.email === user.email;
            },
          });
        });
        
        // Logout
        group('Logout', function () {
          const logoutResponse = http.post(
            `${BASE_URL}/api/v1/auth/logout`,
            null,
            {
              headers: {
                'X-CSRF-Token': csrfToken,
              },
            }
          );
          
          check(logoutResponse, {
            'logout status is 200': (r) => r.status === 200,
          });
        });
      }
    });
  });
  
  // Think time between iterations
  sleep(1 + Math.random() * 2);
}

// Setup function - runs once before the test
export function setup() {
  console.log('Load test starting...');
  console.log(`Target: ${BASE_URL}`);
  
  // Verify server is reachable
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error('Server is not healthy');
  }
  
  return { startTime: new Date().toISOString() };
}

// Teardown function - runs once after the test
export function teardown(data: { startTime: string }) {
  console.log(`Load test completed. Started at: ${data.startTime}`);
}
