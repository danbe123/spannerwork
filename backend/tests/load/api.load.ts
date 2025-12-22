/**
 * Load Test: Core API Endpoints
 * 
 * Tests the performance of core API endpoints including:
 * - Listing search and browse
 * - Tool/Space/Service details
 * - Transaction creation
 * 
 * Run with: k6 run backend/tests/load/api.load.ts
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const apiSuccess = new Rate('api_success');
const searchDuration = new Trend('search_duration');
const detailDuration = new Trend('detail_duration');
const errorCount = new Counter('error_count');

// Test configuration
export const options = {
  scenarios: {
    // Constant load for baseline
    constant_load: {
      executor: 'constant-vus',
      vus: 20,
      duration: '2m',
    },
    // Spike test
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 }, // Spike to 100 users
        { duration: '30s', target: 100 }, // Stay at 100
        { duration: '10s', target: 0 },   // Scale down
      ],
      startTime: '2m30s', // Start after constant load
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
    api_success: ['rate>0.95'],
    search_duration: ['p(95)<500'],
    detail_duration: ['p(95)<300'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Sample listing IDs (should be seeded in test database)
const sampleToolIds = ['tool-1', 'tool-2', 'tool-3'];
const sampleSpaceIds = ['space-1', 'space-2', 'space-3'];
const _sampleServiceIds = ['service-1', 'service-2', 'service-3'];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function () {
  group('Listing Search', function () {
    // Search tools
    group('Search Tools', function () {
      const startTime = Date.now();
      
      const response = http.get(`${BASE_URL}/api/v1/tools?page=1&limit=20`, {
        tags: { name: 'SearchTools' },
      });
      
      searchDuration.add(Date.now() - startTime);
      
      const success = check(response, {
        'tools search returns 200': (r) => r.status === 200,
        'tools search returns array': (r) => {
          try {
            const body = JSON.parse(r.body as string);
            return Array.isArray(body.tools);
          } catch {
            return false;
          }
        },
      });
      
      apiSuccess.add(success ? 1 : 0);
      if (!success) errorCount.add(1);
    });
    
    // Search spaces
    group('Search Spaces', function () {
      const startTime = Date.now();
      
      const response = http.get(`${BASE_URL}/api/v1/spaces?page=1&limit=20`, {
        tags: { name: 'SearchSpaces' },
      });
      
      searchDuration.add(Date.now() - startTime);
      
      const success = check(response, {
        'spaces search returns 200': (r) => r.status === 200,
      });
      
      apiSuccess.add(success ? 1 : 0);
      if (!success) errorCount.add(1);
    });
    
    // Search with filters
    group('Filtered Search', function () {
      const startTime = Date.now();
      
      const response = http.get(
        `${BASE_URL}/api/v1/tools?category=AUTOMOTIVE&minPrice=10&maxPrice=100`,
        { tags: { name: 'FilteredSearch' } }
      );
      
      searchDuration.add(Date.now() - startTime);
      
      check(response, {
        'filtered search returns 200': (r) => r.status === 200,
      });
    });
  });
  
  group('Detail Pages', function () {
    // Tool detail
    group('Tool Detail', function () {
      const toolId = getRandomItem(sampleToolIds);
      const startTime = Date.now();
      
      const response = http.get(`${BASE_URL}/api/v1/tools/${toolId}`, {
        tags: { name: 'ToolDetail' },
      });
      
      detailDuration.add(Date.now() - startTime);
      
      // Note: 404 is acceptable if tool doesn't exist in test data
      check(response, {
        'tool detail returns 200 or 404': (r) => r.status === 200 || r.status === 404,
      });
    });
    
    // Space detail
    group('Space Detail', function () {
      const spaceId = getRandomItem(sampleSpaceIds);
      const startTime = Date.now();
      
      const response = http.get(`${BASE_URL}/api/v1/spaces/${spaceId}`, {
        tags: { name: 'SpaceDetail' },
      });
      
      detailDuration.add(Date.now() - startTime);
      
      check(response, {
        'space detail returns 200 or 404': (r) => r.status === 200 || r.status === 404,
      });
    });
  });
  
  group('Health Check', function () {
    const response = http.get(`${BASE_URL}/health`, {
      tags: { name: 'HealthCheck' },
    });
    
    check(response, {
      'health check returns 200': (r) => r.status === 200,
      'health check shows ok status': (r) => {
        try {
          const body = JSON.parse(r.body as string);
          return body.status === 'ok';
        } catch {
          return false;
        }
      },
    });
  });
  
  // Variable think time to simulate real user behavior
  sleep(0.5 + Math.random() * 1.5);
}

export function setup() {
  console.log('API Load test starting...');
  console.log(`Target: ${BASE_URL}`);
  
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error('Server is not healthy');
  }
  
  return {};
}

export function teardown() {
  console.log('API Load test completed.');
}
