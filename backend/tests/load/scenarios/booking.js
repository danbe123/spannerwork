/**
 * Booking Flow Load Test
 * 
 * Tests the complete booking flow under load.
 * This is the most critical user flow for the platform.
 * 
 * Run: k6 run tests/load/scenarios/booking.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { 
  BASE_URL, 
  API_PREFIX, 
  thresholds,
  getHeaders 
} from '../k6.config.js';

// Custom metrics
const bookingFlowSuccess = new Rate('booking_flow_success');
const bookingFlowDuration = new Trend('booking_flow_duration');
const bookingConflicts = new Counter('booking_conflicts');
const authSuccess = new Rate('auth_success');

// Lower load for booking tests since they're transactional
export const options = {
  stages: [
    { duration: '1m', target: 10 },  // Ramp up to 10 users
    { duration: '3m', target: 10 },  // Stay at 10 users
    { duration: '1m', target: 20 },  // Push to 20 users
    { duration: '3m', target: 20 },  // Stay at 20 users
    { duration: '1m', target: 0 },   // Ramp down
  ],
  thresholds: {
    ...thresholds,
    booking_flow_success: ['rate>0.90'],
    booking_flow_duration: ['p(95)<2000'],
    auth_success: ['rate>0.95'],
  },
};

// Test user credentials
const TEST_USER = {
  email: 'loadtest@example.com',
  password: 'LoadTest123!',
};

let authToken = null;
let availableTools = [];

export function setup() {
  // Login to get auth token
  const loginRes = http.post(
    `${BASE_URL}${API_PREFIX}/auth/login`,
    JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password,
    }),
    { headers: getHeaders() }
  );
  
  if (loginRes.status !== 200) {
    // Try to register first
    http.post(
      `${BASE_URL}${API_PREFIX}/auth/register`,
      JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password,
        name: 'Load Test User',
      }),
      { headers: getHeaders() }
    );
    
    // Login again
    const retryLogin = http.post(
      `${BASE_URL}${API_PREFIX}/auth/login`,
      JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password,
      }),
      { headers: getHeaders() }
    );
    
    if (retryLogin.status === 200) {
      try {
        const body = JSON.parse(retryLogin.body);
        authToken = body.token || body.accessToken;
      } catch (e) {
        console.error('Failed to parse login response');
      }
    }
  } else {
    try {
      const body = JSON.parse(loginRes.body);
      authToken = body.token || body.accessToken;
    } catch (e) {
      console.error('Failed to parse login response');
    }
  }
  
  // Fetch available tools for booking tests
  if (authToken) {
    const toolsRes = http.get(
      `${BASE_URL}${API_PREFIX}/tools?limit=50`,
      { headers: getHeaders(authToken) }
    );
    
    if (toolsRes.status === 200) {
      try {
        const body = JSON.parse(toolsRes.body);
        availableTools = (body.data || body || []).filter(t => t.available);
      } catch (e) {
        console.error('Failed to parse tools response');
      }
    }
  }
  
  return { authToken, availableTools };
}

export default function(data) {
  const { authToken, availableTools } = data;
  
  if (!authToken) {
    // Try to get a new token
    testAuthOnly();
    return;
  }
  
  const scenario = Math.random();
  
  if (scenario < 0.4) {
    // 40% - View tool details (pre-booking)
    testViewToolDetails(authToken, availableTools);
  } else if (scenario < 0.7) {
    // 30% - Check availability
    testCheckAvailability(authToken, availableTools);
  } else {
    // 30% - Full booking flow
    testBookingFlow(authToken, availableTools);
  }
  
  sleep(Math.random() * 2 + 1); // 1-3 second pause
}

function testAuthOnly() {
  const res = http.post(
    `${BASE_URL}${API_PREFIX}/auth/login`,
    JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password,
    }),
    { headers: getHeaders() }
  );
  
  authSuccess.add(res.status === 200);
}

function testViewToolDetails(token, tools) {
  if (!tools || tools.length === 0) {
    return;
  }
  
  const tool = tools[Math.floor(Math.random() * tools.length)];
  
  const res = http.get(
    `${BASE_URL}${API_PREFIX}/tools/${tool.id}`,
    { headers: getHeaders(token) }
  );
  
  check(res, {
    'tool details status is 200': (r) => r.status === 200,
    'tool has required fields': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.id && body.dailyRate !== undefined;
      } catch {
        return false;
      }
    },
  });
}

function testCheckAvailability(token, tools) {
  if (!tools || tools.length === 0) {
    return;
  }
  
  const tool = tools[Math.floor(Math.random() * tools.length)];
  
  // Get next week dates
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 7);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 3);
  
  const res = http.get(
    `${BASE_URL}${API_PREFIX}/tools/${tool.id}/availability?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
    { headers: getHeaders(token) }
  );
  
  check(res, {
    'availability check status is 200 or 404': (r) => r.status === 200 || r.status === 404,
  });
}

function testBookingFlow(token, tools) {
  if (!tools || tools.length === 0) {
    return;
  }
  
  const startTime = Date.now();
  let success = true;
  
  group('booking_flow', function() {
    const tool = tools[Math.floor(Math.random() * tools.length)];
    
    // Step 1: View tool details
    const detailsRes = http.get(
      `${BASE_URL}${API_PREFIX}/tools/${tool.id}`,
      { headers: getHeaders(token) }
    );
    
    if (detailsRes.status !== 200) {
      success = false;
      return;
    }
    
    sleep(0.5); // Simulate user reading details
    
    // Step 2: Create booking (future date to avoid conflicts)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + Math.floor(Math.random() * 30) + 7);
    const startDate = futureDate;
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 3) + 1);
    
    const bookingRes = http.post(
      `${BASE_URL}${API_PREFIX}/transactions`,
      JSON.stringify({
        toolId: tool.id,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        notes: 'Load test booking',
      }),
      { headers: getHeaders(token) }
    );
    
    if (bookingRes.status === 409 || (bookingRes.body && bookingRes.body.includes('conflict'))) {
      bookingConflicts.add(1);
      // Conflict is expected under load, not a failure
      return;
    }
    
    const bookingSuccess = check(bookingRes, {
      'booking status is 201 or 200': (r) => r.status === 201 || r.status === 200,
      'booking returns transaction': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.id !== undefined;
        } catch {
          return false;
        }
      },
    });
    
    if (!bookingSuccess) {
      success = false;
    }
  });
  
  const duration = Date.now() - startTime;
  bookingFlowDuration.add(duration);
  bookingFlowSuccess.add(success);
}

export function teardown(data) {
  console.log('Booking flow load test completed');
  console.log(`Total booking conflicts detected: ${bookingConflicts}`);
}
