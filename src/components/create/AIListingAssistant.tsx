/**
 * AIListingAssistant - AI-powered listing generation
 *
 * Allows users to describe their item in natural language,
 * upload photos for context, and get AI-generated optimized listing content.
 */

import { useState, ChangeEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { aiService, GeneratedListing } from '@/api/services/ai';
import { uploadService } from '@/api/services';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Sparkles,
  Loader2,
  Wand2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ImagePlus,
  X,
  Camera
} from 'lucide-react';
import { toast } from 'sonner';

interface AIListingAssistantProps {
  listingType: 'tool' | 'space' | 'service';
  onSuggestionsGenerated: (suggestions: GeneratedListing, photos: string[]) => void;
  className?: string;
}

export function AIListingAssistant({
  listingType,
  onSuggestionsGenerated,
  className = ''
}: AIListingAssistantProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [rawDescription, setRawDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const generateMutation = useMutation({
    mutationFn: () => aiService.generateListing(rawDescription, listingType, photos),
    onSuccess: (data) => {
      onSuggestionsGenerated(data.listing, photos);
      toast.success('AI suggestions generated!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to generate suggestions. Please try again.');
    }
  });

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const availableSlots = 5 - photos.length;
    if (availableSlots <= 0) {
      toast.error('Maximum 5 photos allowed');
      return;
    }

    const filesToUpload = files.slice(0, availableSlots);
    setIsUploading(true);

    try {
      for (const file of filesToUpload) {
        const preview = URL.createObjectURL(file);
        setPhotoPreviews(prev => [...prev, preview].slice(0, 5));

        const result = await uploadService.uploadFile(file);
        setPhotos(prev => [...prev, result.data.fileUrl].slice(0, 5));
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Upload failed:', error);
      }
      toast.error('Failed to upload photo. Please try again.');
    }
    setIsUploading(false);
  };

  const removePhoto = (index: number) => {
    if (photoPreviews[index]) URL.revokeObjectURL(photoPreviews[index]);
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = () => {
    // Allow generation if:
    // 1. User provided photos (AI can analyze them), OR
    // 2. User provided text description (at least 10 chars)
    const hasPhotos = photos.length > 0;
    const hasText = rawDescription.trim().length >= 10;

    if (!hasPhotos && !hasText) {
      toast.error('Please add photos or describe your item in at least 10 characters');
      return;
    }

    // For text-only, still need minimum length
    if (!hasPhotos && rawDescription.trim().length > 0 && rawDescription.trim().length < 10) {
      toast.error('Description needs at least 10 characters, or add photos instead');
      return;
    }

    generateMutation.mutate();
  };

  // Check if we can generate - either photos or sufficient text
  const canGenerate = photos.length > 0 || rawDescription.trim().length >= 10;

  const placeholderText = listingType === 'tool'
    ? "e.g., DeWalt 20V Max cordless drill, 2 years old in good condition, includes 2 batteries, charger, and hard case. Great for DIY and light construction work..."
    : listingType === 'space'
    ? "e.g., 400 sqft garage with 2-post vehicle lift, air compressor, parts washer, basic hand tools. 24/7 key access, well-lit with concrete floor..."
    : "e.g., Qualified mechanic with 12 years experience. Specialise in German vehicles (BMW, Audi, VW). Full diagnostic equipment, mobile service available...";

  return (
    <motion.div
      className={`rounded-xl border-2 border-dashed border-purple-200 bg-gradient-to-r from-purple-50/50 to-pink-50/50 overflow-hidden ${className}`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header - Always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-purple-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 text-sm">Create your listing with AI</h3>
            <p className="text-xs text-gray-500">Upload photos or describe your item and AI writes a professional listing</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
            Free
          </span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Photo Upload Section */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-purple-500" />
                  Upload photos for AI to analyse brand, model, and condition
                </label>
                <div className="flex gap-2 flex-wrap">
                  {photoPreviews.map((preview, index) => (
                    <div key={index} className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-purple-200 group">
                      <img src={preview} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                      {index === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-purple-600 text-white text-[8px] text-center py-0.5">
                          Main
                        </div>
                      )}
                    </div>
                  ))}
                  {photoPreviews.length < 5 && (
                    <label className={`w-16 h-16 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${
                      isUploading ? 'border-purple-400 bg-purple-50' : 'border-purple-200 hover:border-purple-400 hover:bg-purple-50'
                    }`}>
                      {isUploading ? (
                        <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                      ) : (
                        <>
                          <ImagePlus className="w-5 h-5 text-purple-400" />
                          <span className="text-[9px] text-purple-500 mt-0.5">{5 - photoPreviews.length} left</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoUpload}
                        className="hidden"
                        disabled={isUploading || generateMutation.isPending}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Description Input */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Describe your {listingType} {photos.length > 0 ? '(optional with photos)' : 'in your own words'}
                </label>
                <Textarea
                  placeholder={photos.length > 0
                    ? "Optional: Add details the photos don't show (accessories, condition notes)..."
                    : placeholderText}
                  value={rawDescription}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setRawDescription(e.target.value)}
                  className="min-h-[80px] resize-none border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                  disabled={generateMutation.isPending}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {photos.length > 0
                    ? `${rawDescription.length}/500 - AI will analyse your photos for ${listingType === 'space' ? 'equipment, lifts, and available features' : 'brand, model, condition, and accessories'}`
                    : `${rawDescription.length}/500 - Include ${listingType === 'space' ? 'size, equipment, access hours, and amenities' : 'brand, model, condition, and what\'s included'}`}
                </p>
              </div>

              {/* Generate Button */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-gray-500">
                  {photos.length > 0 && (
                    <span className="text-purple-600 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {photos.length} photo{photos.length > 1 ? 's' : ''} will be analyzed
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending || !canGenerate}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/25"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      Generate Listing
                    </>
                  )}
                </Button>
              </div>

              {generateMutation.isError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Failed to generate. Please try again or fill in manually.</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
