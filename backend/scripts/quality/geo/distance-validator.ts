/**
 * Geographic Distance Validator
 *
 * Tests distance calculations using Haversine formula.
 * Validates search radius accuracy for UK locations.
 */

import { QualityTestRunner, TestCase, TestResult, assert } from '../core/test-runner.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const EARTH_RADIUS_KM = 6371;
const EARTH_RADIUS_MILES = 3958.8;
const KM_TO_MILES = 0.621371;
const MILES_TO_KM = 1.60934;

// ============================================================================
// UK REFERENCE POINTS (verified coordinates)
// ============================================================================

interface GeoPoint {
  name: string;
  lat: number;
  lng: number;
}

const UK_LOCATIONS: Record<string, GeoPoint> = {
  LONDON_CENTER: { name: 'London (Trafalgar Square)', lat: 51.5074, lng: -0.1278 },
  MANCHESTER: { name: 'Manchester', lat: 53.4808, lng: -2.2426 },
  EDINBURGH: { name: 'Edinburgh', lat: 55.9533, lng: -3.1883 },
  BIRMINGHAM: { name: 'Birmingham', lat: 52.4862, lng: -1.8904 },
  LEEDS: { name: 'Leeds', lat: 53.8008, lng: -1.5491 },
  GLASGOW: { name: 'Glasgow', lat: 55.8642, lng: -4.2518 },
  LIVERPOOL: { name: 'Liverpool', lat: 53.4084, lng: -2.9916 },
  BRISTOL: { name: 'Bristol', lat: 51.4545, lng: -2.5879 },
  CARDIFF: { name: 'Cardiff', lat: 51.4816, lng: -3.1791 },
  BELFAST: { name: 'Belfast', lat: 54.5973, lng: -5.9301 },

  // London landmarks for precision testing
  LONDON_EYE: { name: 'London Eye', lat: 51.5033, lng: -0.1195 },
  BIG_BEN: { name: 'Big Ben', lat: 51.5007, lng: -0.1246 },
  TOWER_BRIDGE: { name: 'Tower Bridge', lat: 51.5055, lng: -0.0754 },
  BUCKINGHAM: { name: 'Buckingham Palace', lat: 51.5014, lng: -0.1419 },
};

// Known approximate distances (miles) between UK cities
const KNOWN_DISTANCES: Array<{ from: string; to: string; miles: number; tolerance: number }> = [
  { from: 'LONDON_CENTER', to: 'MANCHESTER', miles: 163, tolerance: 5 },
  { from: 'LONDON_CENTER', to: 'BIRMINGHAM', miles: 101, tolerance: 5 },
  { from: 'LONDON_CENTER', to: 'EDINBURGH', miles: 332, tolerance: 10 },
  { from: 'LONDON_CENTER', to: 'BRISTOL', miles: 105, tolerance: 5 },
  { from: 'MANCHESTER', to: 'LEEDS', miles: 36, tolerance: 3 },
  { from: 'MANCHESTER', to: 'LIVERPOOL', miles: 31, tolerance: 3 },
  { from: 'EDINBURGH', to: 'GLASGOW', miles: 42, tolerance: 3 },
];

// ============================================================================
// HAVERSINE FORMULA IMPLEMENTATION
// ============================================================================

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance between two points using Haversine formula
 * @returns Distance in kilometers
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Calculate distance in miles
 */
function haversineDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return haversineDistance(lat1, lng1, lat2, lng2) * KM_TO_MILES;
}

/**
 * Check if a point is within a search radius
 */
function isWithinRadius(
  centerLat: number,
  centerLng: number,
  pointLat: number,
  pointLng: number,
  radiusMiles: number
): boolean {
  const distance = haversineDistanceMiles(centerLat, centerLng, pointLat, pointLng);
  return distance <= radiusMiles;
}

// ============================================================================
// TEST CASES
// ============================================================================

const geoTests: TestCase[] = [
  // -------------------------------------------------------------------------
  // BASIC DISTANCE CALCULATIONS
  // -------------------------------------------------------------------------
  {
    name: 'Same point = 0 distance',
    description: 'Distance from a point to itself should be 0',
    category: 'Basic Distance',
    run: async (): Promise<TestResult> => {
      const { lat, lng } = UK_LOCATIONS.LONDON_CENTER;
      const distance = haversineDistanceMiles(lat, lng, lat, lng);
      return assert.closeTo(distance, 0, 0.001, 'Same point should have 0 distance');
    },
  },
  {
    name: 'Very close points (<0.1 miles)',
    description: 'Big Ben to London Eye distance',
    category: 'Basic Distance',
    run: async (): Promise<TestResult> => {
      const bigBen = UK_LOCATIONS.BIG_BEN;
      const londonEye = UK_LOCATIONS.LONDON_EYE;
      const distance = haversineDistanceMiles(bigBen.lat, bigBen.lng, londonEye.lat, londonEye.lng);
      // Actual distance is about 0.25 miles
      return assert.closeTo(distance, 0.25, 0.1, `Big Ben to London Eye: ${distance.toFixed(2)} miles`);
    },
  },
  {
    name: 'London to Manchester',
    description: 'Known intercity distance check',
    category: 'Basic Distance',
    run: async (): Promise<TestResult> => {
      const london = UK_LOCATIONS.LONDON_CENTER;
      const manchester = UK_LOCATIONS.MANCHESTER;
      const distance = haversineDistanceMiles(london.lat, london.lng, manchester.lat, manchester.lng);
      // Straight-line distance ~163 miles
      return assert.closeTo(distance, 163, 5, `London to Manchester: ${distance.toFixed(1)} miles`);
    },
  },
  {
    name: 'London to Edinburgh',
    description: 'Long distance UK calculation',
    category: 'Basic Distance',
    run: async (): Promise<TestResult> => {
      const london = UK_LOCATIONS.LONDON_CENTER;
      const edinburgh = UK_LOCATIONS.EDINBURGH;
      const distance = haversineDistanceMiles(london.lat, london.lng, edinburgh.lat, edinburgh.lng);
      // Straight-line distance ~332 miles
      return assert.closeTo(distance, 332, 10, `London to Edinburgh: ${distance.toFixed(1)} miles`);
    },
  },

  // -------------------------------------------------------------------------
  // KNOWN UK DISTANCES VALIDATION
  // -------------------------------------------------------------------------
  ...KNOWN_DISTANCES.map(({ from, to, miles, tolerance }) => ({
    name: `Known: ${UK_LOCATIONS[from].name} → ${UK_LOCATIONS[to].name}`,
    description: `Expected ~${miles} miles (±${tolerance})`,
    category: 'Known Distances',
    run: async (): Promise<TestResult> => {
      const fromPoint = UK_LOCATIONS[from];
      const toPoint = UK_LOCATIONS[to];
      const distance = haversineDistanceMiles(fromPoint.lat, fromPoint.lng, toPoint.lat, toPoint.lng);
      return assert.closeTo(
        distance,
        miles,
        tolerance,
        `${fromPoint.name} to ${toPoint.name}: ${distance.toFixed(1)} miles`
      );
    },
  })),

  // -------------------------------------------------------------------------
  // SEARCH RADIUS TESTS
  // -------------------------------------------------------------------------
  {
    name: 'Radius: 1 mile precision',
    description: 'Points just inside and outside 1 mile radius',
    category: 'Search Radius',
    run: async (): Promise<TestResult> => {
      const center = UK_LOCATIONS.LONDON_CENTER;
      // Create a point roughly 0.9 miles away (should be inside)
      const insidePoint = { lat: center.lat + 0.013, lng: center.lng }; // ~0.9 miles north
      // Create a point roughly 1.1 miles away (should be outside)
      const outsidePoint = { lat: center.lat + 0.016, lng: center.lng }; // ~1.1 miles north

      const insideResult = isWithinRadius(center.lat, center.lng, insidePoint.lat, insidePoint.lng, 1);
      const outsideResult = isWithinRadius(center.lat, center.lng, outsidePoint.lat, outsidePoint.lng, 1);

      if (!insideResult) {
        return {
          passed: false,
          score: 0,
          details: 'Point at ~0.9 miles should be inside 1 mile radius',
          error: 'Inside point was marked as outside',
        };
      }
      if (outsideResult) {
        return {
          passed: false,
          score: 50,
          details: 'Point at ~1.1 miles should be outside 1 mile radius',
          error: 'Outside point was marked as inside',
        };
      }
      return {
        passed: true,
        score: 100,
        details: '1 mile radius boundary correctly detected',
      };
    },
  },
  {
    name: 'Radius: 5 mile typical search',
    description: 'Typical search radius validation',
    category: 'Search Radius',
    run: async (): Promise<TestResult> => {
      const center = UK_LOCATIONS.LONDON_CENTER;
      // Tower Bridge is about 2.5 miles from Trafalgar Square
      const towerBridge = UK_LOCATIONS.TOWER_BRIDGE;

      const isInside = isWithinRadius(center.lat, center.lng, towerBridge.lat, towerBridge.lng, 5);
      return assert.true(isInside, 'Tower Bridge should be within 5 miles of central London');
    },
  },
  {
    name: 'Radius: 50 mile wide search',
    description: 'Wide area search includes nearby cities',
    category: 'Search Radius',
    run: async (): Promise<TestResult> => {
      const center = UK_LOCATIONS.LONDON_CENTER;
      // Bristol is about 105 miles away - should be outside 50 mile radius
      const bristol = UK_LOCATIONS.BRISTOL;

      const isOutside = !isWithinRadius(center.lat, center.lng, bristol.lat, bristol.lng, 50);
      return assert.true(isOutside, 'Bristol should be outside 50 mile radius of London');
    },
  },
  {
    name: 'Radius: 0 mile (exact location)',
    description: 'Zero radius should only match exact point',
    category: 'Search Radius',
    run: async (): Promise<TestResult> => {
      const center = UK_LOCATIONS.LONDON_CENTER;
      const nearbyPoint = { lat: center.lat + 0.001, lng: center.lng };

      const exactMatch = isWithinRadius(center.lat, center.lng, center.lat, center.lng, 0);
      const nearbyNotMatch = !isWithinRadius(center.lat, center.lng, nearbyPoint.lat, nearbyPoint.lng, 0);

      return assert.true(
        exactMatch && nearbyNotMatch,
        '0 radius should only match exact coordinates'
      );
    },
  },

  // -------------------------------------------------------------------------
  // EDGE CASES
  // -------------------------------------------------------------------------
  {
    name: 'Symmetry: A→B = B→A',
    description: 'Distance should be same both directions',
    category: 'Edge Cases',
    run: async (): Promise<TestResult> => {
      const london = UK_LOCATIONS.LONDON_CENTER;
      const manchester = UK_LOCATIONS.MANCHESTER;

      const d1 = haversineDistanceMiles(london.lat, london.lng, manchester.lat, manchester.lng);
      const d2 = haversineDistanceMiles(manchester.lat, manchester.lng, london.lat, london.lng);

      return assert.closeTo(d1, d2, 0.001, 'Distance should be symmetric');
    },
  },
  {
    name: 'Negative longitude (UK)',
    description: 'UK uses negative longitude (west of Prime Meridian)',
    category: 'Edge Cases',
    run: async (): Promise<TestResult> => {
      const manchester = UK_LOCATIONS.MANCHESTER;
      // Manchester is at -2.24 longitude
      if (manchester.lng >= 0) {
        return {
          passed: false,
          score: 0,
          details: 'Manchester should have negative longitude',
          error: `Got longitude ${manchester.lng}`,
        };
      }
      // Distance calculation should still work with negative values
      const london = UK_LOCATIONS.LONDON_CENTER;
      const distance = haversineDistanceMiles(london.lat, london.lng, manchester.lat, manchester.lng);
      return assert.true(
        distance > 100 && distance < 200,
        `Negative longitude calculation works: ${distance.toFixed(1)} miles`
      );
    },
  },
  {
    name: 'Extreme: UK to antipodal point',
    description: 'Distance to opposite side of Earth',
    category: 'Edge Cases',
    run: async (): Promise<TestResult> => {
      const london = UK_LOCATIONS.LONDON_CENTER;
      // Antipodal point of London is roughly in Pacific Ocean near New Zealand
      const antipode = { lat: -london.lat, lng: 180 + london.lng };

      const distance = haversineDistanceMiles(london.lat, london.lng, antipode.lat, antipode.lng);
      // Half Earth circumference is ~12,451 miles
      return assert.closeTo(distance, 12451, 100, `Antipodal distance: ${distance.toFixed(0)} miles`);
    },
  },
  {
    name: 'Equator crossing',
    description: 'Distance calculation across equator',
    category: 'Edge Cases',
    run: async (): Promise<TestResult> => {
      const northPoint = { lat: 1, lng: 0 };
      const southPoint = { lat: -1, lng: 0 };

      const distance = haversineDistanceMiles(northPoint.lat, northPoint.lng, southPoint.lat, southPoint.lng);
      // 2 degrees of latitude ≈ 138 miles
      return assert.closeTo(distance, 138, 5, `Equator crossing: ${distance.toFixed(1)} miles`);
    },
  },
  {
    name: 'Prime Meridian crossing',
    description: 'Distance across 0° longitude',
    category: 'Edge Cases',
    run: async (): Promise<TestResult> => {
      const london = UK_LOCATIONS.LONDON_CENTER;
      // Point east of Prime Meridian (e.g., Paris area)
      const paris = { lat: 48.8566, lng: 2.3522 };

      const distance = haversineDistanceMiles(london.lat, london.lng, paris.lat, paris.lng);
      // London to Paris ≈ 213 miles
      return assert.closeTo(distance, 213, 15, `London to Paris: ${distance.toFixed(1)} miles`);
    },
  },

  // -------------------------------------------------------------------------
  // ROUNDING AND PRECISION
  // -------------------------------------------------------------------------
  {
    name: 'Precision: 6 decimal places',
    description: 'GPS-level coordinate precision',
    category: 'Precision',
    run: async (): Promise<TestResult> => {
      // Two points that differ only in 6th decimal place (about 11cm)
      const p1 = { lat: 51.507400, lng: -0.127800 };
      const p2 = { lat: 51.507401, lng: -0.127801 };

      const distance = haversineDistanceMiles(p1.lat, p1.lng, p2.lat, p2.lng);
      // Should be very small (< 0.001 miles = ~5 feet)
      return assert.true(
        distance < 0.001,
        `Sub-meter precision: ${(distance * 5280).toFixed(1)} feet`
      );
    },
  },
  {
    name: 'Precision: 2 decimal places',
    description: 'Coarse coordinate precision (~1km)',
    category: 'Precision',
    run: async (): Promise<TestResult> => {
      // Two points that differ in 2nd decimal place (~1km)
      const p1 = { lat: 51.50, lng: -0.12 };
      const p2 = { lat: 51.51, lng: -0.13 };

      const distance = haversineDistanceMiles(p1.lat, p1.lng, p2.lat, p2.lng);
      // Should be around 0.5-1 mile
      return assert.closeTo(distance, 0.8, 0.3, `Coarse precision: ${distance.toFixed(2)} miles`);
    },
  },
];

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runGeoTests(): Promise<void> {
  const runner = new QualityTestRunner('Geographic Distance Validator');
  runner.addTests(geoTests);
  await runner.runAll();
}

export { geoTests, runGeoTests };

if (process.argv[1]?.includes('distance-validator')) {
  runGeoTests().catch(console.error);
}
