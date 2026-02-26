/**
 * ImageGallerySection - Displays all job images as expandable thumbnails
 *
 * Features:
 * - Grid of thumbnails from all job listings
 * - Click to expand in lightbox
 * - Keyboard navigation in lightbox
 * - Links to parent job on hover
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { OptimizedImage } from '@/components/ui/optimized-image';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Expand,
  ZoomIn
} from 'lucide-react';
import { Request } from '@/types';

interface ImageItem {
  url: string;
  requestId: string;
  requestTitle: string;
  index: number;
}

interface ImageGallerySectionProps {
  requests: Request[];
  maxImages?: number;
  className?: string;
}

export default function ImageGallerySection({
  requests,
  maxImages = 12,
  className = ''
}: ImageGallerySectionProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Flatten all images from requests into a single array
  const allImages = useMemo((): ImageItem[] => {
    const images: ImageItem[] = [];
    for (const request of requests) {
      if (request.photos && request.photos.length > 0) {
        request.photos.forEach((url, idx) => {
          images.push({
            url,
            requestId: request.id,
            requestTitle: request.title,
            index: idx,
          });
        });
      }
    }
    return images;
  }, [requests]);

  const displayedImages = showAll ? allImages : allImages.slice(0, maxImages);
  const hasMore = allImages.length > maxImages;
  const selectedImage = selectedIndex !== null ? allImages[selectedIndex] : null;

  // Keyboard navigation
  useEffect(() => {
    if (selectedIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIndex(null);
      } else if (e.key === 'ArrowRight') {
        setSelectedIndex(prev =>
          prev !== null && prev < allImages.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowLeft') {
        setSelectedIndex(prev =>
          prev !== null && prev > 0 ? prev - 1 : prev
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [selectedIndex, allImages.length]);

  const goToPrevious = useCallback(() => {
    setSelectedIndex(prev =>
      prev !== null && prev > 0 ? prev - 1 : prev
    );
  }, []);

  const goToNext = useCallback(() => {
    setSelectedIndex(prev =>
      prev !== null && prev < allImages.length - 1 ? prev + 1 : prev
    );
  }, [allImages.length]);

  if (allImages.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900">Job Photos</h3>
          <span className="text-sm text-gray-500">({allImages.length})</span>
        </div>
        {hasMore && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            View all
          </button>
        )}
      </div>

      {/* Thumbnail Grid */}
      <div className="grid grid-cols-4 gap-2">
        {displayedImages.map((image, idx) => {
          const globalIndex = showAll ? idx : allImages.findIndex(img => img.url === image.url);
          return (
            <button
              key={`${image.requestId}-${image.index}`}
              onClick={() => setSelectedIndex(globalIndex)}
              className="group relative aspect-square rounded-lg overflow-hidden bg-gray-100 hover:ring-2 hover:ring-brand-500 hover:ring-offset-2 transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
              aria-label={`View photo from ${image.requestTitle}`}
            >
              <OptimizedImage
                src={image.url}
                alt={`${image.requestTitle} - photo ${image.index + 1}`}
                sizes="thumbnail"
                className="w-full h-full group-hover:scale-105 transition-transform duration-200"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          );
        })}

        {/* Show more button inline */}
        {hasMore && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="aspect-square rounded-lg bg-gray-100 hover:bg-gray-200 flex flex-col items-center justify-center text-gray-600 transition-colors"
          >
            <Expand className="w-5 h-5 mb-1" />
            <span className="text-xs font-medium">+{allImages.length - maxImages}</span>
          </button>
        )}
      </div>

      {/* Collapse button */}
      {showAll && hasMore && (
        <button
          onClick={() => setShowAll(false)}
          className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 py-2"
        >
          Show less
        </button>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={() => setSelectedIndex(null)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/90" />

            {/* Content */}
            <div
              className="relative z-10 w-full h-full flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top bar */}
              <div className="flex items-center justify-between p-4 text-white">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">
                    {selectedIndex !== null ? selectedIndex + 1 : 0} / {allImages.length}
                  </span>
                  <Link
                    to={`/request/${selectedImage.requestId}`}
                    className="flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="max-w-[200px] truncate">{selectedImage.requestTitle}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <button
                  onClick={() => setSelectedIndex(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  aria-label="Close lightbox"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Image container */}
              <div className="flex-1 flex items-center justify-center px-4 pb-4 relative">
                {/* Previous button */}
                {selectedIndex !== null && selectedIndex > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
                    className="absolute left-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-20"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-6 h-6 text-white" />
                  </button>
                )}

                {/* Main image */}
                <motion.div
                  key={selectedImage.url}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-full max-h-full"
                >
                  <img
                    src={selectedImage.url}
                    alt={`${selectedImage.requestTitle} - photo ${selectedImage.index + 1}`}
                    className="max-w-full max-h-[calc(100vh-140px)] object-contain rounded-lg"
                  />
                </motion.div>

                {/* Next button */}
                {selectedIndex !== null && selectedIndex < allImages.length - 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); goToNext(); }}
                    className="absolute right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-20"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-6 h-6 text-white" />
                  </button>
                )}
              </div>

              {/* Thumbnail strip */}
              <div className="px-4 pb-4">
                <div className="flex gap-2 justify-center overflow-x-auto py-2 max-w-full">
                  {allImages.slice(
                    Math.max(0, (selectedIndex ?? 0) - 4),
                    Math.min(allImages.length, (selectedIndex ?? 0) + 5)
                  ).map((image, idx) => {
                    const actualIndex = Math.max(0, (selectedIndex ?? 0) - 4) + idx;
                    return (
                      <button
                        key={`thumb-${image.requestId}-${image.index}`}
                        onClick={(e) => { e.stopPropagation(); setSelectedIndex(actualIndex); }}
                        className={`w-12 h-12 rounded-md overflow-hidden flex-shrink-0 transition-all ${
                          actualIndex === selectedIndex
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-black'
                            : 'opacity-50 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={image.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Keyboard hint */}
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-gray-500 text-xs">
                Use ← → to navigate • ESC to close
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
