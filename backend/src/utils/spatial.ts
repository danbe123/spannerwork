/**
 * Spatial Query Utilities
 * 
 * Helper functions for PostGIS-based location queries.
 * Uses the spatial indices for efficient distance-based searches.
 */

import { prisma } from '../config/database.js';
import { Prisma } from '@prisma/client';

/**
 * Calculate distance between two points in miles
 * Uses Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Generate a bounding box for efficient pre-filtering
 * Returns min/max lat/lng for a given radius around a point
 */
export function getBoundingBox(
  lat: number,
  lng: number,
  radiusMiles: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  // Approximate degrees per mile
  const latDegPerMile = 1 / 69;
  const lngDegPerMile = 1 / (69 * Math.cos(toRad(lat)));

  const latOffset = radiusMiles * latDegPerMile;
  const lngOffset = radiusMiles * lngDegPerMile;

  return {
    minLat: lat - latOffset,
    maxLat: lat + latOffset,
    minLng: lng - lngOffset,
    maxLng: lng + lngOffset,
  };
}

/**
 * Build a Prisma where clause for location-based filtering
 * Uses bounding box for efficient pre-filtering
 */
export function buildLocationFilter(
  lat: number,
  lng: number,
  radiusMiles: number
): { locationLat: object; locationLng: object } {
  const bbox = getBoundingBox(lat, lng, radiusMiles);

  return {
    locationLat: {
      gte: bbox.minLat,
      lte: bbox.maxLat,
    },
    locationLng: {
      gte: bbox.minLng,
      lte: bbox.maxLng,
    },
  };
}

/**
 * Find nearby items using PostGIS spatial index (raw SQL)
 * This is more accurate than bounding box but requires PostGIS
 * Returns IDs of items within the radius
 */
export async function findNearbyIds(
  table: 'tools' | 'spaces' | 'services' | 'requests' | 'users',
  lat: number,
  lng: number,
  radiusMiles: number,
  limit = 100
): Promise<string[]> {
  // Convert miles to meters (PostGIS uses meters)
  const radiusMeters = radiusMiles * 1609.34;

  const result = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM ${Prisma.raw(table)}
    WHERE "locationLat" IS NOT NULL
      AND "locationLng" IS NOT NULL
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint("locationLng", "locationLat"), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusMeters}
      )
    ORDER BY ST_Distance(
      ST_SetSRID(ST_MakePoint("locationLng", "locationLat"), 4326)::geography,
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
    )
    LIMIT ${limit}
  `;

  return result.map((r) => r.id);
}

/**
 * Sort results by distance from a point
 * Use after fetching with bounding box filter for accurate distance sorting
 */
export function sortByDistance<T extends { locationLat?: number | null; locationLng?: number | null }>(
  items: T[],
  lat: number,
  lng: number
): T[] {
  return [...items].sort((a, b) => {
    if (!a.locationLat || !a.locationLng) return 1;
    if (!b.locationLat || !b.locationLng) return -1;

    const distA = calculateDistance(lat, lng, a.locationLat, a.locationLng);
    const distB = calculateDistance(lat, lng, b.locationLat, b.locationLng);

    return distA - distB;
  });
}

export default {
  calculateDistance,
  getBoundingBox,
  buildLocationFilter,
  findNearbyIds,
  sortByDistance,
};
