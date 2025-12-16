/**
 * Authentication Load Test
 * 
 * Tests login, registration, and token refresh endpoints under load.
 * 
 * Run: k6 run tests/load/scenarios/auth.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { 
  BASE_URL, 
  API_PREFIX, 
  thresholds, 
  loadTest, 
  randomEmail, 
  randomString,
  getHeaders 
} from '../k6.config.js';

// Custom metrics
const loginSuccess = new Rate('login_success');
const registerSuccess = new Rate('register_success');
const loginDuration = new Trend('login_duration');
const registerDuration = new Trend('register_duration');

export const options = {
  ...loadTest,
  thresholds: {
    ...thresholds,
    login_success: ['rate>0.95'],
    register_success: ['rate>0.90'],
    login_duration: ['p(95)<300'],
    register_duration: ['p(95)<500'],
  },
};

// Shared test user for login tests
const TEST_USER = {
  email: 'loadtest@example.com',
  password: 'LoadTest123!',
};

export function setup() {
  // Create a test user for login tests if it doesn't exist
  const registerRes = http.post(
    `${BASE_URL}${API_PREFIX}/auth/register`,
    JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password,
      name: 'Load Test User',
    }),
    { headers: getHeaders() }
  );
  
  // User might already exist, that's fine
  return { testUser: TEST_USER };
}

export default function(data) {
  const scenario = Math.random();
  
  if (scenario < 0.6) {
    // 60% - Login attempts (most common operation)
    testLogin(data.testUser);
  } else if (scenario < 0.8) {
    // 20% - Register new users
    testRegister();
  } else {
    // 20% - Token refresh
    testTokenRefresh(data.testUser);
  }
  
  sleep(Math.random() * 2 + 1); // 1-3 second pause
}

function testLogin(user) {
  const startTime = Date.now();
  
  const res = http.post(
    `${BASE_URL}${API_PREFIX}/auth/login`,
    JSON.stringify({
      email: user.email,
      password: user.password,
    }),
    { headers: getHeaders() }
  );
  
  const duration = Date.now() - startTime;
  loginDuration.add(duration);
  
  const success = check(res, {
    'login status is 200': (r) => r.status === 200,
    'login returns token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token || body.accessToken;
      } catch {
        return false;
      }
    },
  });
  
  loginSuccess.add(success);
}

function testRegister() {
  const startTime = Date.now();
  
  const res = http.post(
    `${BASE_URL}${API_PREFIX}/auth/register`,
    JSON.stringify({
      email: randomEmail(),
      password: 'TestPass123!',
      name: `Load Test ${randomString(5)}`,
    }),
    { headers: getHeaders() }
  );
  
  const duration = Date.now() - startTime;
  registerDuration.add(duration);
  
  const success = check(res, {
    'register status is 201 or 200': (r) => r.status === 201 || r.status === 200,
    'register returns user': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.user && body.user.id;
      } catch {
        return false;
      }
    },
  });
  
  registerSuccess.add(success);
}

function testTokenRefresh(user) {
  // First login to get a token
  const loginRes = http.post(
    `${BASE_URL}${API_PREFIX}/auth/login`,
    JSON.stringify({
      email: user.email,
      password: user.password,
    }),
    { headers: getHeaders() }
  );
  
  if (loginRes.status !== 200) {
    return;
  }
  
  let refreshToken;
  try {
    const body = JSON.parse(loginRes.body);
    refreshToken = body.refreshToken;
  } catch {
    return;
  }
  
  if (!refreshToken) {
    return;
  }
  
  // Now test refresh
  const refreshRes = http.post(
    `${BASE_URL}${API_PREFIX}/auth/refresh`,
    JSON.stringify({ refreshToken }),
    { headers: getHeaders() }
  );
  
  check(refreshRes, {
    'refresh status is 200': (r) => r.status === 200,
    'refresh returns new token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token || body.accessToken;
      } catch {
        return false;
      }
    },
  });
}

export function teardown(data) {
  // Cleanup can be done here if needed
  console.log('Auth load test completed');
}
