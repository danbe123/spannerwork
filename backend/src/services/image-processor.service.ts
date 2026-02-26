/**
 * Image Processor Service
 *
 * Processes uploaded images into multiple optimized sizes and formats.
 * Generates responsive srcset-ready images for optimal delivery on any device.
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../config/logger.js';

// Image size presets
export const IMAGE_SIZES = {
  thumbnail: { width: 150, height: 150, fit: 'cover' as const },
  small: { width: 400, height: 300, fit: 'inside' as const },
  medium: { width: 800, height: 600, fit: 'inside' as const },
  large: { width: 1200, height: 900, fit: 'inside' as const },
  original: null, // Keep original dimensions but optimize
} as const;

export type ImageSizeKey = keyof typeof IMAGE_SIZES;

// Quality settings - AVIF can be lower quality due to better compression
const JPEG_QUALITY = 85;
const WEBP_QUALITY = 82;
const AVIF_QUALITY = 65; // AVIF achieves similar visual quality at lower numbers

export interface ProcessedImage {
  original: string;
  avif: {
    thumbnail: string;
    small: string;
    medium: string;
    large: string;
  };
  webp: {
    thumbnail: string;
    small: string;
    medium: string;
    large: string;
  };
  fallback: {
    thumbnail: string;
    small: string;
    medium: string;
    large: string;
  };
  blurhash?: string;
  width: number;
  height: number;
  aspectRatio: number;
}

export interface ImageVariant {
  url: string;
  width: number;
  height: number;
  format: string;
}

class ImageProcessorService {
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
  }

  /**
   * Process an uploaded image into multiple sizes and formats
   */
  async processImage(
    filePath: string,
    filename: string
  ): Promise<ProcessedImage> {
    const startTime = Date.now();
    const baseName = path.parse(filename).name;

    try {
      // Get original image metadata
      const metadata = await sharp(filePath).metadata();
      const originalWidth = metadata.width || 800;
      const originalHeight = metadata.height || 600;
      const aspectRatio = originalWidth / originalHeight;

      // Create optimized directory structure
      const optimizedDir = path.join(this.uploadsDir, 'optimized', baseName);
      await fs.mkdir(optimizedDir, { recursive: true });

      // Process all sizes in parallel
      const processingTasks: Promise<void>[] = [];
      const results: ProcessedImage = {
        original: `/uploads/${filename}`,
        avif: {
          thumbnail: '',
          small: '',
          medium: '',
          large: '',
        },
        webp: {
          thumbnail: '',
          small: '',
          medium: '',
          large: '',
        },
        fallback: {
          thumbnail: '',
          small: '',
          medium: '',
          large: '',
        },
        width: originalWidth,
        height: originalHeight,
        aspectRatio,
      };

      // Process each size
      for (const [sizeName, sizeConfig] of Object.entries(IMAGE_SIZES)) {
        if (sizeName === 'original' || !sizeConfig) continue;

        const sizeKey = sizeName as Exclude<ImageSizeKey, 'original'>;

        // Calculate dimensions maintaining aspect ratio
        let targetWidth: number = sizeConfig.width;
        let targetHeight: number = sizeConfig.height;

        if (sizeConfig.fit === 'inside') {
          // Fit inside the box while maintaining aspect ratio
          if (aspectRatio > targetWidth / targetHeight) {
            targetHeight = Math.round(targetWidth / aspectRatio);
          } else {
            targetWidth = Math.round(targetHeight * aspectRatio);
          }
        }

        // Skip if original is smaller than target
        if (originalWidth < targetWidth && originalHeight < targetHeight) {
          targetWidth = originalWidth;
          targetHeight = originalHeight;
        }

        // Generate AVIF version (best compression, modern browsers)
        const avifFilename = `${sizeName}.avif`;
        const avifPath = path.join(optimizedDir, avifFilename);
        results.avif[sizeKey] = `/uploads/optimized/${baseName}/${avifFilename}`;

        processingTasks.push(
          sharp(filePath)
            .resize(targetWidth, targetHeight, {
              fit: sizeConfig.fit,
              withoutEnlargement: true,
            })
            .avif({ quality: AVIF_QUALITY })
            .toFile(avifPath)
            .then(() => {})
        );

        // Generate WebP version (good compression, wide support)
        const webpFilename = `${sizeName}.webp`;
        const webpPath = path.join(optimizedDir, webpFilename);
        results.webp[sizeKey] = `/uploads/optimized/${baseName}/${webpFilename}`;

        processingTasks.push(
          sharp(filePath)
            .resize(targetWidth, targetHeight, {
              fit: sizeConfig.fit,
              withoutEnlargement: true,
            })
            .webp({ quality: WEBP_QUALITY })
            .toFile(webpPath)
            .then(() => {})
        );

        // Generate fallback JPEG version (universal support)
        const jpegFilename = `${sizeName}.jpg`;
        const jpegPath = path.join(optimizedDir, jpegFilename);
        results.fallback[sizeKey] = `/uploads/optimized/${baseName}/${jpegFilename}`;

        processingTasks.push(
          sharp(filePath)
            .resize(targetWidth, targetHeight, {
              fit: sizeConfig.fit,
              withoutEnlargement: true,
            })
            .jpeg({ quality: JPEG_QUALITY, progressive: true })
            .toFile(jpegPath)
            .then(() => {})
        );
      }

      // Generate tiny blur placeholder (for LQIP - Low Quality Image Placeholder)
      const placeholderFilename = 'placeholder.webp';
      const placeholderPath = path.join(optimizedDir, placeholderFilename);

      processingTasks.push(
        sharp(filePath)
          .resize(20, 20, { fit: 'inside' })
          .blur(2)
          .webp({ quality: 20 })
          .toFile(placeholderPath)
          .then(() => {})
      );

      // Wait for all processing to complete
      await Promise.all(processingTasks);

      const elapsed = Date.now() - startTime;
      logger.info(`Processed image ${filename} in ${elapsed}ms`);

      return results;
    } catch (error) {
      logger.error(`Error processing image ${filename}:`, error);
      throw new Error('Failed to process image');
    }
  }

  /**
   * Generate srcset string for responsive images
   */
  generateSrcSet(processed: ProcessedImage, format: 'avif' | 'webp' | 'fallback' = 'webp'): string {
    const sizes = format === 'avif' ? processed.avif : format === 'webp' ? processed.webp : processed.fallback;
    const srcset = [
      `${sizes.thumbnail} 150w`,
      `${sizes.small} 400w`,
      `${sizes.medium} 800w`,
      `${sizes.large} 1200w`,
    ];
    return srcset.join(', ');
  }

  /**
   * Get the best image URL for a given width
   */
  getBestSize(processed: ProcessedImage, targetWidth: number, format: 'avif' | 'webp' | 'fallback' = 'webp'): string {
    const sizes = format === 'avif' ? processed.avif : format === 'webp' ? processed.webp : processed.fallback;

    if (targetWidth <= 150) return sizes.thumbnail;
    if (targetWidth <= 400) return sizes.small;
    if (targetWidth <= 800) return sizes.medium;
    return sizes.large;
  }

  /**
   * Check if an image has been processed (optimized versions exist)
   */
  async isProcessed(filename: string): Promise<boolean> {
    const baseName = path.parse(filename).name;
    const optimizedDir = path.join(this.uploadsDir, 'optimized', baseName);

    try {
      await fs.access(optimizedDir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get processed image data from filename
   */
  getProcessedImageData(filename: string): ProcessedImage | null {
    const baseName = path.parse(filename).name;
    const baseUrl = `/uploads/optimized/${baseName}`;

    // Return the expected structure (caller should verify files exist)
    return {
      original: `/uploads/${filename}`,
      avif: {
        thumbnail: `${baseUrl}/thumbnail.avif`,
        small: `${baseUrl}/small.avif`,
        medium: `${baseUrl}/medium.avif`,
        large: `${baseUrl}/large.avif`,
      },
      webp: {
        thumbnail: `${baseUrl}/thumbnail.webp`,
        small: `${baseUrl}/small.webp`,
        medium: `${baseUrl}/medium.webp`,
        large: `${baseUrl}/large.webp`,
      },
      fallback: {
        thumbnail: `${baseUrl}/thumbnail.jpg`,
        small: `${baseUrl}/small.jpg`,
        medium: `${baseUrl}/medium.jpg`,
        large: `${baseUrl}/large.jpg`,
      },
      width: 0,
      height: 0,
      aspectRatio: 1,
    };
  }

  /**
   * Delete all optimized versions of an image
   */
  async deleteOptimizedVersions(filename: string): Promise<void> {
    const baseName = path.parse(filename).name;
    const optimizedDir = path.join(this.uploadsDir, 'optimized', baseName);

    try {
      await fs.rm(optimizedDir, { recursive: true, force: true });
      logger.info(`Deleted optimized versions for ${filename}`);
    } catch (error) {
      logger.error(`Error deleting optimized versions for ${filename}:`, error);
    }
  }

  /**
   * Process existing unoptimized images (for migration)
   */
  async processExistingImages(): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      const files = await fs.readdir(this.uploadsDir);
      const imageFiles = files.filter(f =>
        /\.(jpg|jpeg|png|gif|webp)$/i.test(f) && !f.startsWith('.')
      );

      for (const file of imageFiles) {
        const isAlreadyProcessed = await this.isProcessed(file);
        if (isAlreadyProcessed) continue;

        try {
          const filePath = path.join(this.uploadsDir, file);
          await this.processImage(filePath, file);
          processed++;
        } catch {
          errors++;
        }
      }

      logger.info(`Processed ${processed} existing images with ${errors} errors`);
    } catch (error) {
      logger.error('Error processing existing images:', error);
    }

    return { processed, errors };
  }
}

export const imageProcessorService = new ImageProcessorService();
