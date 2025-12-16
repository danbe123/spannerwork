/**
 * Spatial Query Service
 * 
 * Provides PostGIS-powered spatial queries for location-based searches.
 * Uses native geography columns for accurate distance calculations.
 * 
 * Note: Requires the PostGIS migration to be applied.
 */

import { prisma } from '../config/database.js';
import { Prisma } from '@prisma/client';
import { logger } from '../config/logger.js';

// Conversion constants
const MILES_TO_METERS = 1609.34;

export interface LocationPoint {
  lat: number;
  lng: number;
}

export interface SpatialSearchOptions {
  /** Center point for the search */
  center: LocationPoint;
  /** Radius in miles */
  radiusMiles: number;
  /** Maximum results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

export interface SpatialResult<T> {
  item: T;
  /** Distance from center point in meters */
  distanceMeters: number;
  /** Distance from center point in miles */
  distanceMiles: number;
}

/**
 * Spatial Query Service
 */
class SpatialService {
  /**
   * Convert miles to meters
   */
  milesToMeters(miles: number): number {
    return miles * MILES_TO_METERS;
  }

  /**
   * Convert meters to miles
   */
  metersToMiles(meters: number): number {
    return meters / MILES_TO_METERS;
  }

  /**
   * Find tools within a radius of a point
   * Uses PostGIS ST_DWithin for efficient spatial queries
   */
  async findToolsWithinRadius(options: SpatialSearchOptions): Promise<SpatialResult<Prisma.ToolGetPayload<Prisma.ToolDefaultArgs>>[]> {
    const { center, radiusMiles, limit = 50, offset = 0 } = options;
    const radiusMeters = this.milesToMeters(radiusMiles);

    try {
      const results = await prisma.$queryRaw<Array<Prisma.ToolGetPayload<Prisma.ToolDefaultArgs> & { distance_meters: number }>>`
        SELECT 
          t.*,
          ST_Distance(
            t.location,
            ST_SetSRID(ST_MakePoint(${center.lng}, ${center.lat}), 4326)::geography
          ) as distance_meters
        FROM tools t
        WHERE t.available = true
          AND t.location IS NOT NULL
          AND ST_DWithin(
            t.location,
            ST_SetSRID(ST_MakePoint(${center.lng}, ${center.lat}), 4326)::geography,
            ${radiusMeters}
          )
        ORDER BY distance_meters ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      return results.map(({ distance_meters, ...item }) => ({
        item: item as Prisma.ToolGetPayload<Prisma.ToolDefaultArgs>,
        distanceMeters: distance_meters,
        distanceMiles: this.metersToMiles(distance_meters),
      }));
    } catch (error) {
      logger.error('Spatial query error (tools):', error);
      // Fallback to non-spatial query if PostGIS is not available
      return this.fallbackToolSearch(options);
    }
  }

  /**
   * Find spaces within a radius of a point
   */
  async findSpacesWithinRadius(options: SpatialSearchOptions): Promise<SpatialResult<Prisma.SpaceGetPayload<Prisma.SpaceDefaultArgs>>[]> {
    const { center, radiusMiles, limit = 50, offset = 0 } = options;
    const radiusMeters = this.milesToMeters(radiusMiles);

    try {
      const results = await prisma.$queryRaw<Array<Prisma.SpaceGetPayload<Prisma.SpaceDefaultArgs> & { distance_meters: number }>>`
        SELECT 
          s.*,
          ST_Distance(
            s.location,
            ST_SetSRID(ST_MakePoint(${center.lng}, ${center.lat}), 4326)::geography
          ) as distance_meters
        FROM spaces s
        WHERE s.available = true
          AND s.location IS NOT NULL
          AND ST_DWithin(
            s.location,
            ST_SetSRID(ST_MakePoint(${center.lng}, ${center.lat}), 4326)::geography,
            ${radiusMeters}
          )
        ORDER BY distance_meters ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      return results.map(({ distance_meters, ...item }) => ({
        item: item as Prisma.SpaceGetPayload<Prisma.SpaceDefaultArgs>,
        distanceMeters: distance_meters,
        distanceMiles: this.metersToMiles(distance_meters),
      }));
    } catch (error) {
      logger.error('Spatial query error (spaces):', error);
      return [];
    }
  }

  /**
   * Find services within a radius of a point
   */
  async findServicesWithinRadius(options: SpatialSearchOptions): Promise<SpatialResult<Prisma.ServiceGetPayload<Prisma.ServiceDefaultArgs>>[]> {
    const { center, radiusMiles, limit = 50, offset = 0 } = options;
    const radiusMeters = this.milesToMeters(radiusMiles);

    try {
      const results = await prisma.$queryRaw<Array<Prisma.ServiceGetPayload<Prisma.ServiceDefaultArgs> & { distance_meters: number }>>`
        SELECT 
          s.*,
          ST_Distance(
            s.location,
            ST_SetSRID(ST_MakePoint(${center.lng}, ${center.lat}), 4326)::geography
          ) as distance_meters
        FROM services s
        WHERE s.available = true
          AND s.location IS NOT NULL
          AND ST_DWithin(
            s.location,
            ST_SetSRID(ST_MakePoint(${center.lng}, ${center.lat}), 4326)::geography,
            ${radiusMeters}
          )
        ORDER BY distance_meters ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      return results.map(({ distance_meters, ...item }) => ({
        item: item as Prisma.ServiceGetPayload<Prisma.ServiceDefaultArgs>,
        distanceMeters: distance_meters,
        distanceMiles: this.metersToMiles(distance_meters),
      }));
    } catch (error) {
      logger.error('Spatial query error (services):', error);
      return [];
    }
  }

  /**
   * Find requests within a radius of a point
   */
  async findRequestsWithinRadius(options: SpatialSearchOptions): Promise<SpatialResult<Prisma.RequestGetPayload<Prisma.RequestDefaultArgs>>[]> {
    const { center, radiusMiles, limit = 50, offset = 0 } = options;
    const radiusMeters = this.milesToMeters(radiusMiles);

    try {
      const results = await prisma.$queryRaw<Array<Prisma.RequestGetPayload<Prisma.RequestDefaultArgs> & { distance_meters: number }>>`
        SELECT 
          r.*,
          ST_Distance(
            r.location,
            ST_SetSRID(ST_MakePoint(${center.lng}, ${center.lat}), 4326)::geography
          ) as distance_meters
        FROM requests r
        WHERE r.status = 'ACTIVE'
          AND r.location IS NOT NULL
          AND ST_DWithin(
            r.location,
            ST_SetSRID(ST_MakePoint(${center.lng}, ${center.lat}), 4326)::geography,
            ${radiusMeters}
          )
        ORDER BY distance_meters ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      return results.map(({ distance_meters, ...item }) => ({
        item: item as Prisma.RequestGetPayload<Prisma.RequestDefaultArgs>,
        distanceMeters: distance_meters,
        distanceMiles: this.metersToMiles(distance_meters),
      }));
    } catch (error) {
      logger.error('Spatial query error (requests):', error);
      return [];
    }
  }

  /**
   * Fallback search using bounding box when PostGIS is not available
   * Uses simple lat/lng range filtering
   */
  private async fallbackToolSearch(options: SpatialSearchOptions): Promise<SpatialResult<Prisma.ToolGetPayload<Prisma.ToolDefaultArgs>>[]> {
    const { center, radiusMiles, limit = 50, offset = 0 } = options;
    
    // Approximate bounding box (not accurate for large distances)
    // 1 degree latitude ≈ 69 miles
    // 1 degree longitude ≈ 54.6 miles (at 51° latitude - UK)
    const latDelta = radiusMiles / 69;
    const lngDelta = radiusMiles / 54.6;

    const tools = await prisma.tool.findMany({
      where: {
        available: true,
        locationLat: {
          gte: center.lat - latDelta,
          lte: center.lat + latDelta,
        },
        locationLng: {
          gte: center.lng - lngDelta,
          lte: center.lng + lngDelta,
        },
      },
      take: limit,
      skip: offset,
    });

    // Calculate approximate distance using Haversine formula
    return tools.map(tool => {
      const distanceMeters = this.haversineDistance(
        center.lat, center.lng,
        tool.locationLat!, tool.locationLng!
      );
      return {
        item: tool,
        distanceMeters,
        distanceMiles: this.metersToMiles(distanceMeters),
      };
    }).sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  /**
   * Calculate distance between two points using Haversine formula
   * Returns distance in meters
   */
  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export const spatialService = new SpatialService();
export default spatialService;
