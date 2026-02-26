/**
 * OptimizedImage Component
 *
 * Responsive image component that:
 * - Uses AVIF (best) → WebP → JPEG fallback via <picture>
 * - Serves different sizes via srcset for optimal bandwidth
 * - Shows blur placeholder while loading
 * - Handles external URLs gracefully (no optimization)
 * - Supports different aspect ratios and presets
 */

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

// Size breakpoints for srcset
const SIZE_WIDTHS = {
  thumbnail: 150,
  small: 400,
  medium: 800,
  large: 1200,
};

type ImageSize = keyof typeof SIZE_WIDTHS;

// Common sizes attribute patterns
const SIZES_PRESETS = {
  // Full width on mobile, half on tablet, third on desktop
  card: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  // Full width on mobile, 2/3 on larger
  hero: '(max-width: 640px) 100vw, 66vw',
  // Small fixed size
  avatar: '150px',
  // Full width always
  full: '100vw',
  // Medium card
  thumbnail: '(max-width: 640px) 50vw, 200px',
};

type SizesPreset = keyof typeof SIZES_PRESETS;

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Image source URL - can be optimized (/uploads/...) or external */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Preset sizes for srcset (or custom sizes string) */
  sizes?: SizesPreset | string;
  /** Aspect ratio for placeholder (e.g., "16/9", "4/3", "1/1") */
  aspectRatio?: string;
  /** Show blur placeholder while loading */
  showPlaceholder?: boolean;
  /** Object fit style */
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  /** Priority loading (disables lazy load) */
  priority?: boolean;
  /** Callback when image loads */
  onLoad?: () => void;
  /** Callback when image fails to load */
  onError?: () => void;
}

/**
 * Check if a URL is an internal upload that may have optimized versions
 */
function isOptimizedUrl(src: string): boolean {
  return src.startsWith('/uploads/') && !src.includes('/optimized/');
}

/**
 * Get the base filename without extension from an upload URL
 */
function getBaseName(src: string): string {
  const filename = src.split('/').pop() || '';
  return filename.replace(/\.[^/.]+$/, '');
}

/**
 * Generate optimized image URLs from an upload path
 */
function getOptimizedUrls(src: string) {
  if (!isOptimizedUrl(src)) return null;

  const baseName = getBaseName(src);
  const baseUrl = `/uploads/optimized/${baseName}`;

  return {
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
    placeholder: `${baseUrl}/placeholder.webp`,
  };
}

/**
 * Generate srcset string from optimized URLs
 */
function generateSrcSet(urls: Record<ImageSize, string>): string {
  return Object.entries(urls)
    .map(([size, url]) => `${url} ${SIZE_WIDTHS[size as ImageSize]}w`)
    .join(', ');
}

export function OptimizedImage({
  src,
  alt,
  sizes = 'card',
  aspectRatio,
  showPlaceholder = true,
  objectFit = 'cover',
  priority = false,
  className,
  onLoad,
  onError,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [useOptimized, setUseOptimized] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);

  // Get optimized URLs if available
  const optimized = getOptimizedUrls(src);

  // Resolve sizes preset or use custom string
  const sizesAttr = SIZES_PRESETS[sizes as SizesPreset] || sizes;

  // Reset state when src changes
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    setUseOptimized(true);
  }, [src]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    // If optimized version failed, fall back to original
    if (useOptimized && optimized) {
      setUseOptimized(false);
      return;
    }
    setHasError(true);
    onError?.();
  };

  // Error state - show placeholder
  if (hasError) {
    return (
      <div
        className={cn(
          'bg-gray-100 flex items-center justify-center text-gray-400',
          className
        )}
        style={{ aspectRatio }}
        {...props}
      >
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  // If we have optimized versions and should use them
  if (optimized && useOptimized) {
    return (
      <div className={cn('relative overflow-hidden', className)} style={{ aspectRatio }}>
        {/* Blur placeholder */}
        {showPlaceholder && !isLoaded && (
          <img
            src={optimized.placeholder}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full blur-lg scale-110"
            style={{ objectFit }}
          />
        )}

        {/* Main image with picture element for format selection */}
        <picture>
          {/* AVIF sources (best compression, modern browsers) */}
          <source
            type="image/avif"
            srcSet={generateSrcSet(optimized.avif)}
            sizes={sizesAttr}
          />
          {/* WebP sources (good compression, wide support) */}
          <source
            type="image/webp"
            srcSet={generateSrcSet(optimized.webp)}
            sizes={sizesAttr}
          />
          {/* JPEG fallback (universal support) */}
          <source
            type="image/jpeg"
            srcSet={generateSrcSet(optimized.fallback)}
            sizes={sizesAttr}
          />
          {/* Fallback img */}
          <img
            ref={imgRef}
            src={optimized.fallback.medium}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            decoding={priority ? 'sync' : 'async'}
            onLoad={handleLoad}
            onError={handleError}
            className={cn(
              'w-full h-full transition-opacity duration-300',
              isLoaded ? 'opacity-100' : 'opacity-0'
            )}
            style={{ objectFit }}
            {...props}
          />
        </picture>
      </div>
    );
  }

  // Fallback for external URLs or when optimized versions don't exist
  return (
    <div className={cn('relative overflow-hidden', className)} style={{ aspectRatio }}>
      {/* Simple loading state */}
      {showPlaceholder && !isLoaded && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse" />
      )}

      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          'w-full h-full transition-opacity duration-300',
          isLoaded ? 'opacity-100' : 'opacity-0'
        )}
        style={{ objectFit }}
        {...props}
      />
    </div>
  );
}

export default OptimizedImage;
