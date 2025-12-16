/**
 * k6 Load Testing Configuration
 * 
 * Install k6: https://k6.io/docs/getting-started/installation/
 * Run: k6 run tests/load/k6-config.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const healthCheckDuration = new Trend('health_check_duration');
const listingsDuration = new Trend('listings_duration');

// Test configuration
export const options = {
  // Define load stages
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '2m', target: 50 },    // Stay at 50 users
    { duration: '1m', target: 100 },   // Ramp up to 100 users
    { duration: '2m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 0 },    // Ramp down to 0
  ],
  
  // Thresholds for pass/fail
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],     // Error rate should be below 1%
    errors: ['rate<0.1'],               // Custom error rate below 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

/**
 * Health check test
 */
function healthCheck() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/health`);
  healthCheckDuration.add(Date.now() - start);
  
  const success = check(res, {
    'health check status is 200': (r) => r.status === 200,
    'health check returns ok': (r) => r.json('status') === 'ok',
  });
  
  errorRate.add(!success);
  return success;
}

/**
 * List tools test
 */
function listTools() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/v1/tools?page=1&limit=20`);
  listingsDuration.add(Date.now() - start);
  
  const success = check(res, {
    'tools list status is 200': (r) => r.status === 200,
    'tools list has data': (r) => r.json('tools') !== undefined,
  });
  
  errorRate.add(!success);
  return success;
}

/**
 * List spaces test
 */
function listSpaces() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/v1/spaces?page=1&limit=20`);
  listingsDuration.add(Date.now() - start);
  
  const success = check(res, {
    'spaces list status is 200': (r) => r.status === 200,
    'spaces list has data': (r) => r.json('spaces') !== undefined,
  });
  
  errorRate.add(!success);
  return success;
}

/**
 * List services test
 */
function listServices() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/v1/services?page=1&limit=20`);
  listingsDuration.add(Date.now() - start);
  
  const success = check(res, {
    'services list status is 200': (r) => r.status === 200,
    'services list has data': (r) => r.json('services') !== undefined,
  });
  
  errorRate.add(!success);
  return success;
}

/**
 * List requests test
 */
function listRequests() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/v1/requests?page=1&limit=20`);
  listingsDuration.add(Date.now() - start);
  
  const success = check(res, {
    'requests list status is 200': (r) => r.status === 200,
    'requests list has data': (r) => r.json('requests') !== undefined,
  });
  
  errorRate.add(!success);
  return success;
}

/**
 * Main test scenario
 */
export default function () {
  group('Health Check', () => {
    healthCheck();
  });
  
  sleep(0.5);
  
  group('Listings', () => {
    // Randomly select which listing type to fetch
    const rand = Math.random();
    
    if (rand < 0.25) {
      listTools();
    } else if (rand < 0.5) {
      listSpaces();
    } else if (rand < 0.75) {
      listServices();
    } else {
      listRequests();
    }
  });
  
  sleep(1);
}

/**
 * Setup function - runs once before the test
 */
export function setup() {
  console.log(`Load test starting against: ${BASE_URL}`);
  
  // Verify the server is reachable
  const res = http.get(`${BASE_URL}/health`);
  if (res.status !== 200) {
    throw new Error('Server is not reachable!');
  }
  
  return { startTime: Date.now() };
}

/**
 * Teardown function - runs once after the test
 */
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration}s`);
}
