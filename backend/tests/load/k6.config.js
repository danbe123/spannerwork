/**
 * k6 Load Testing Configuration
 * 
 * This file contains shared configuration for all k6 load test scenarios.
 * 
 * Installation:
 *   brew install k6  (macOS)
 *   sudo apt install k6  (Ubuntu)
 *   choco install k6  (Windows)
 * 
 * Usage:
 *   k6 run tests/load/scenarios/auth.js
 *   k6 run tests/load/scenarios/listings.js
 *   k6 run tests/load/scenarios/booking.js
 *   
 * With custom options:
 *   k6 run --vus 50 --duration 5m tests/load/scenarios/auth.js
 */

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:5001';
export const API_PREFIX = '/api';

// Standard thresholds for all tests
export const thresholds = {
  // 95% of requests should complete within 500ms
  http_req_duration: ['p(95)<500'],
  // Less than 1% error rate
  http_req_failed: ['rate<0.01'],
  // 99% of requests should complete within 1.5s
  'http_req_duration{scenario:default}': ['p(99)<1500'],
};

// Smoke test: minimal load to verify system works
export const smokeTest = {
  vus: 1,
  duration: '30s',
};

// Load test: average expected load
export const loadTest = {
  stages: [
    { duration: '2m', target: 20 },  // Ramp up to 20 users
    { duration: '5m', target: 20 },  // Stay at 20 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
};

// Stress test: beyond normal load
export const stressTest = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Push to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
};

// Spike test: sudden traffic surge
export const spikeTest = {
  stages: [
    { duration: '10s', target: 100 }, // Sudden spike
    { duration: '1m', target: 100 },  // Stay at spike
    { duration: '10s', target: 0 },   // Quick recovery
  ],
};

// Soak test: extended duration
export const soakTest = {
  stages: [
    { duration: '2m', target: 30 },   // Ramp up
    { duration: '30m', target: 30 },  // Stay at load for 30 mins
    { duration: '2m', target: 0 },    // Ramp down
  ],
};

// Helper to generate random email
export function randomEmail() {
  return `loadtest_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
}

// Helper to generate random string
export function randomString(length = 10) {
  return Math.random().toString(36).substring(2, 2 + length);
}

// Helper to generate UK postcode
export function randomPostcode() {
  const areas = ['SW1A', 'EC1A', 'W1A', 'SE1', 'N1', 'E1', 'NW1'];
  const area = areas[Math.floor(Math.random() * areas.length)];
  const num = Math.floor(Math.random() * 9) + 1;
  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  const suffix = letters[Math.floor(Math.random() * letters.length)] + 
                 letters[Math.floor(Math.random() * letters.length)];
  return `${area} ${num}${suffix}`;
}

// Standard headers
export function getHeaders(token = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}
