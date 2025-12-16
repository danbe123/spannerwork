/**
 * S3 Client Singleton Configuration
 * 
 * Provides a singleton S3 client instance to avoid recreating the client
 * on every request (e.g., health checks). Supports both AWS S3 and S3-compatible
 * storage (R2, MinIO, etc.) via custom endpoint.
 */

import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { env } from './env.js';
import { logger } from './logger.js';

// Singleton instance
let s3Client: S3Client | null = null;

/**
 * Check if S3 is configured with required credentials
 */
export function isS3Configured(): boolean {
  return !!(
    env.AWS_ACCESS_KEY_ID &&
    env.AWS_SECRET_ACCESS_KEY &&
    env.S3_BUCKET_PUBLIC
  );
}

/**
 * Get or create the singleton S3 client instance
 * Returns null if S3 is not configured
 */
export function getS3Client(): S3Client | null {
  if (!isS3Configured()) {
    return null;
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: env.AWS_REGION,
      endpoint: env.AWS_ENDPOINT,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
      },
      // Force path style for S3-compatible services (R2, MinIO)
      forcePathStyle: !!env.AWS_ENDPOINT,
    });

    logger.info('S3 client initialized', {
      region: env.AWS_REGION,
      endpoint: env.AWS_ENDPOINT || 'AWS default',
      bucket: env.S3_BUCKET_PUBLIC,
    });
  }

  return s3Client;
}

/**
 * Check S3 connectivity by attempting to access the configured bucket
 * @returns 'ok' | 'error' | 'unconfigured'
 */
export async function checkS3Health(): Promise<'ok' | 'error' | 'unconfigured'> {
  if (!isS3Configured()) {
    return 'unconfigured';
  }

  const client = getS3Client();
  if (!client) {
    return 'unconfigured';
  }

  try {
    await client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET_PUBLIC }));
    return 'ok';
  } catch (error) {
    logger.warn('S3 health check failed', { error });
    return 'error';
  }
}

/**
 * Reset the S3 client (useful for testing)
 */
export function resetS3Client(): void {
  if (s3Client) {
    s3Client.destroy();
    s3Client = null;
  }
}

export default {
  getS3Client,
  isS3Configured,
  checkS3Health,
  resetS3Client,
};
