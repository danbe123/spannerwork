/**
 * RequestPhotoGallery - Airbnb-style photo grid with lightbox
 *
 * Desktop: 1 large image (spans 2x2) + 4 small images in a grid
 * Mobile: Full-width carousel with thumbnail strip
 * Click any image to open fullscreen lightbox
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OptimizedImage } from '@/components/ui/optimized-image';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Wrench,
  GraduationCap,
  Warehouse,
  LucideIcon
} from 'lucide-react';

interface RequestPhotoGalleryProps {
  photos: string[];
  title: string;
  category?: string;
}

// Category icons for fallback
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  TOOLS: Wrench,
  EXPERTISE: GraduationCap,
  SPACE: Warehouse,
};

export default function RequestPhotoGallery({
  photos,
  title,
  category = 'TOOLS'
}: RequestPhotoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [mobileIndex, setMobileIndex] = useState(0);

  const hasPhotos = photos && photos.length > 0;
  const photoCount = photos?.length || 0;
  const CategoryIcon = CATEGORY_ICONS[category] || Wrench;

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (selectedIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIndex(null);
      } else if (e.key === 'ArrowRight') {
        setSelectedIndex(prev =>
          prev !== null && prev < photoCount - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowLeft') {
        setSelectedIndex(prev =>
          prev !== null && prev > 0 ? prev - 1 : prev
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [selectedIndex, photoCount]);

  const goToPrevious = useCallback(() => {
    setSelectedIndex(prev => prev !== null && prev > 0 ? prev - 1 : prev);
  }, []);

  const goToNext = useCallback(() => {
    setSelectedIndex(prev => prev !== null && prev < photoCount - 1 ? prev + 1 : prev);
  }, [photoCount]);


  // No photos fallback
  if (!hasPhotos) {
    return (
      <div className="w-full aspect-[16/9] md:aspect-[21/9] bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 relative overflow-hidden rounded-xl md:rounded-2xl">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 blur-3xl bg-white/10 rounded-full scale-150" />
            <CategoryIcon className="w-24 h-24 md:w-32 md:h-32 text-white/60 relative z-10" />
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </div>
    );
  }

  // Track which thumbnail is being hovered for preview
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const displayIndex = hoveredIndex !== null ? hoveredIndex : 0;

  // Render desktop layout: Hero image + thumbnail strip
  const renderDesktopGrid = () => {
    // Single photo - just show it full width
    if (photoCount === 1) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="h-[400px] lg:h-[450px] overflow-hidden"
        >
          <button
            onClick={() => setSelectedIndex(0)}
            className="w-full h-full relative group cursor-pointer"
          >
            <OptimizedImage
              src={photos[0]}
              alt={title}
              sizes="hero"
              priority
              className="w-full h-full transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

            {/* Zoom indicator */}
            <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm text-white p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn className="w-5 h-5" />
            </div>
          </button>
        </motion.div>
      );
    }

    // Multiple photos - Hero + Thumbnail strip layout
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        {/* Hero Image - Shows hovered thumbnail or first image */}
        <div className="h-[350px] lg:h-[400px] overflow-hidden relative">
          <button
            onClick={() => setSelectedIndex(displayIndex)}
            className="w-full h-full relative group cursor-pointer"
          >
            <OptimizedImage
              src={photos[displayIndex]}
              alt={`${title} - photo ${displayIndex + 1}`}
              sizes="hero"
              priority
              className="w-full h-full transition-all duration-300 group-hover:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

            {/* Photo counter badge */}
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white text-sm px-3 py-1.5 rounded-full font-medium">
              {displayIndex + 1} / {photoCount}
            </div>

            {/* Zoom indicator */}
            <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm text-white p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
              <ZoomIn className="w-5 h-5" />
              <span className="text-sm font-medium pr-1">Click to expand</span>
            </div>
          </button>
        </div>

        {/* Thumbnail Strip - Shows ALL photos */}
        <div className="flex gap-3 py-1 px-1">
          {photos.map((photo, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedIndex(idx)}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`relative overflow-hidden rounded-xl transition-all duration-200 flex-1 aspect-[4/3] max-w-[140px] ${
                idx === displayIndex
                  ? 'ring-2 ring-brand-500 ring-offset-2'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              <OptimizedImage
                src={photo}
                alt={`${title} - thumbnail ${idx + 1}`}
                sizes="thumbnail"
                className="w-full h-full transition-transform duration-200 hover:scale-105"
              />
            </button>
          ))}
        </div>
      </motion.div>
    );
  };

  return (
    <>
      {/* Desktop Layout - Hero + Thumbnail Strip */}
      <div className="hidden md:block">
        {renderDesktopGrid()}
      </div>

      {/* Mobile Layout - Thumbnails on left, main image on right */}
      <div className="md:hidden relative">
        <div className="flex gap-2">
          {/* Vertical thumbnail strip on left */}
          {photoCount > 1 && (
            <div className="flex flex-col gap-1.5 py-0.5">
              {photos.map((photo, idx) => (
                <button
                  key={idx}
                  onClick={() => setMobileIndex(idx)}
                  className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden transition-all ${
                    idx === mobileIndex
                      ? 'ring-2 ring-brand-500 ring-offset-1'
                      : 'opacity-50'
                  }`}
                >
                  <OptimizedImage
                    src={photo}
                    alt=""
                    sizes="thumbnail"
                    className="w-full h-full"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Main image */}
          <div className="flex-1 aspect-[4/3] relative overflow-hidden rounded-xl">
            <OptimizedImage
              src={photos[mobileIndex]}
              alt={`${title} - photo ${mobileIndex + 1}`}
              sizes="full"
              priority
              className="w-full h-full"
            />

            {/* Counter badge */}
            {photoCount > 1 && (
              <div className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full">
                {mobileIndex + 1} / {photoCount}
              </div>
            )}

            {/* Tap to expand */}
            <button
              onClick={() => setSelectedIndex(mobileIndex)}
              className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white px-3 py-2 rounded-full text-xs font-medium flex items-center gap-1.5"
            >
              <ZoomIn className="w-4 h-4" />
              Expand
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={() => setSelectedIndex(null)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/95" />

            {/* Content */}
            <div
              className="relative z-10 w-full h-full flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top bar */}
              <div className="flex items-center justify-between p-4 text-white">
                <span className="text-sm text-gray-400">
                  {selectedIndex + 1} / {photoCount}
                </span>
                <button
                  onClick={() => setSelectedIndex(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Image container */}
              <div className="flex-1 flex items-center justify-center px-4 pb-4 relative">
                {/* Previous button */}
                {selectedIndex > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
                    className="absolute left-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-20"
                  >
                    <ChevronLeft className="w-6 h-6 text-white" />
                  </button>
                )}

                {/* Main image */}
                <motion.div
                  key={photos[selectedIndex]}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-full max-h-full"
                >
                  <img
                    src={photos[selectedIndex]}
                    alt={`${title} - photo ${selectedIndex + 1}`}
                    className="max-w-full max-h-[calc(100vh-180px)] object-contain rounded-lg"
                  />
                </motion.div>

                {/* Next button */}
                {selectedIndex < photoCount - 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); goToNext(); }}
                    className="absolute right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-20"
                  >
                    <ChevronRight className="w-6 h-6 text-white" />
                  </button>
                )}
              </div>

              {/* Thumbnail strip */}
              <div className="px-4 pb-4">
                <div className="flex gap-2 justify-center overflow-x-auto py-2">
                  {photos.map((photo, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => { e.stopPropagation(); setSelectedIndex(idx); }}
                      className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 transition-all ${
                        idx === selectedIndex
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-black'
                          : 'opacity-50 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={photo}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Keyboard hint */}
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-gray-500 text-xs hidden md:block">
                Use ← → to navigate • ESC to close
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
