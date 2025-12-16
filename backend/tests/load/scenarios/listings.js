/**
 * Listings Load Test
 * 
 * Tests browse, search, and geo query endpoints under load.
 * This tests the most common user flow: browsing listings.
 * 
 * Run: k6 run tests/load/scenarios/listings.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { 
  BASE_URL, 
  API_PREFIX, 
  thresholds, 
  loadTest,
  randomPostcode,
  getHeaders 
} from '../k6.config.js';

// Custom metrics
const browseSuccess = new Rate('browse_success');
const geoQuerySuccess = new Rate('geo_query_success');
const searchSuccess = new Rate('search_success');
const browseDuration = new Trend('browse_duration');
const geoQueryDuration = new Trend('geo_query_duration');
const searchDuration = new Trend('search_duration');

export const options = {
  ...loadTest,
  thresholds: {
    ...thresholds,
    browse_success: ['rate>0.99'],
    geo_query_success: ['rate>0.95'],
    search_success: ['rate>0.95'],
    browse_duration: ['p(95)<200'],
    geo_query_duration: ['p(95)<800'],  // Geo queries are heavier
    search_duration: ['p(95)<400'],
  },
};

const CATEGORIES = ['TOOLS', 'SPACE', 'EXPERTISE'];
const URGENCIES = ['ASAP', 'TODAY', 'THIS_WEEKEND', 'FLEXIBLE'];

export default function() {
  const scenario = Math.random();
  
  if (scenario < 0.3) {
    // 30% - Browse tools
    testBrowseTools();
  } else if (scenario < 0.5) {
    // 20% - Browse spaces
    testBrowseSpaces();
  } else if (scenario < 0.7) {
    // 20% - Browse requests
    testBrowseRequests();
  } else if (scenario < 0.85) {
    // 15% - Geo queries (expensive)
    testGeoQuery();
  } else {
    // 15% - Search with filters
    testFilteredSearch();
  }
  
  sleep(Math.random() * 1.5 + 0.5); // 0.5-2 second pause
}

function testBrowseTools() {
  const startTime = Date.now();
  
  const res = http.get(
    `${BASE_URL}${API_PREFIX}/tools?page=1&limit=20`,
    { headers: getHeaders() }
  );
  
  const duration = Date.now() - startTime;
  browseDuration.add(duration);
  
  const success = check(res, {
    'tools status is 200': (r) => r.status === 200,
    'tools returns array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.data) || Array.isArray(body);
      } catch {
        return false;
      }
    },
  });
  
  browseSuccess.add(success);
}

function testBrowseSpaces() {
  const startTime = Date.now();
  
  const res = http.get(
    `${BASE_URL}${API_PREFIX}/spaces?page=1&limit=20`,
    { headers: getHeaders() }
  );
  
  const duration = Date.now() - startTime;
  browseDuration.add(duration);
  
  const success = check(res, {
    'spaces status is 200': (r) => r.status === 200,
    'spaces returns array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.data) || Array.isArray(body);
      } catch {
        return false;
      }
    },
  });
  
  browseSuccess.add(success);
}

function testBrowseRequests() {
  const startTime = Date.now();
  
  const res = http.get(
    `${BASE_URL}${API_PREFIX}/requests?page=1&limit=20&status=ACTIVE`,
    { headers: getHeaders() }
  );
  
  const duration = Date.now() - startTime;
  browseDuration.add(duration);
  
  const success = check(res, {
    'requests status is 200': (r) => r.status === 200,
    'requests returns data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data !== undefined;
      } catch {
        return false;
      }
    },
  });
  
  browseSuccess.add(success);
}

function testGeoQuery() {
  const startTime = Date.now();
  const postcode = randomPostcode();
  const radius = Math.floor(Math.random() * 20) + 5; // 5-25 miles
  
  const res = http.get(
    `${BASE_URL}${API_PREFIX}/requests?postcode=${encodeURIComponent(postcode)}&radius=${radius}&limit=20`,
    { headers: getHeaders() }
  );
  
  const duration = Date.now() - startTime;
  geoQueryDuration.add(duration);
  
  const success = check(res, {
    'geo query status is 200': (r) => r.status === 200,
    'geo query returns data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data !== undefined;
      } catch {
        return false;
      }
    },
  });
  
  geoQuerySuccess.add(success);
}

function testFilteredSearch() {
  const startTime = Date.now();
  
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const urgency = URGENCIES[Math.floor(Math.random() * URGENCIES.length)];
  
  const res = http.get(
    `${BASE_URL}${API_PREFIX}/requests?category=${category}&urgency=${urgency}&limit=20`,
    { headers: getHeaders() }
  );
  
  const duration = Date.now() - startTime;
  searchDuration.add(duration);
  
  const success = check(res, {
    'filtered search status is 200': (r) => r.status === 200,
    'filtered search returns data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data !== undefined;
      } catch {
        return false;
      }
    },
  });
  
  searchSuccess.add(success);
}

export function teardown() {
  console.log('Listings load test completed');
}
