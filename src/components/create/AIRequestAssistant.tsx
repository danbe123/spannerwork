/**
 * AIRequestAssistant - AI-powered job request generation
 *
 * Allows users to describe their job needs in natural language,
 * upload photos for context, and get AI-generated optimized request content.
 */

import { useState, ChangeEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { aiService, GeneratedRequest } from '@/api/services/ai';
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

interface AIRequestAssistantProps {
  category: 'TOOLS' | 'EXPERTISE' | 'SPACE';
  onSuggestionsGenerated: (suggestions: GeneratedRequest, photos: string[]) => void;
  className?: string;
}

export function AIRequestAssistant({
  category,
  onSuggestionsGenerated,
  className = ''
}: AIRequestAssistantProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [rawDescription, setRawDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const generateMutation = useMutation({
    mutationFn: () => aiService.generateRequest(rawDescription, category, photos),
    onSuccess: (data) => {
      onSuggestionsGenerated(data.request, photos);
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
    if (!rawDescription.trim() || rawDescription.trim().length < 10) {
      toast.error('Please describe what you need in at least 10 characters');
      return;
    }
    generateMutation.mutate();
  };

  const getPlaceholderText = () => {
    switch (category) {
      case 'TOOLS':
        return "e.g., Need to borrow a diagnostic scanner for my BMW E90, want to read fault codes and reset service light...";
      case 'EXPERTISE':
        return "e.g., Looking for a mobile mechanic to help with timing belt change on my Ford Focus 2015, have the parts already...";
      case 'SPACE':
        return "e.g., Need a workshop with a lift for the weekend to do a clutch swap on my MX-5, have all tools and parts...";
      default:
        return "Describe what you need...";
    }
  };

  const getCategoryLabel = () => {
    switch (category) {
      case 'TOOLS':
        return 'tool or equipment';
      case 'EXPERTISE':
        return 'help or service';
      case 'SPACE':
        return 'workspace';
      default:
        return 'item';
    }
  };

  return (
    <motion.div
      className={`rounded-xl border-2 border-dashed border-blue-200 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 overflow-hidden ${className}`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header - Always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 text-sm">Let AI write your request</h3>
            <p className="text-xs text-gray-500">Describe what you need - AI optimizes your post</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
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
                  <Camera className="w-4 h-4 text-blue-500" />
                  Photos help others understand what you need (optional)
                </label>
                <div className="flex gap-2 flex-wrap">
                  {photoPreviews.map((preview, index) => (
                    <div key={index} className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-blue-200 group">
                      <img src={preview} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ))}
                  {photoPreviews.length < 5 && (
                    <label className={`w-16 h-16 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${
                      isUploading ? 'border-blue-400 bg-blue-50' : 'border-blue-200 hover:border-blue-400 hover:bg-blue-50'
                    }`}>
                      {isUploading ? (
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                      ) : (
                        <>
                          <ImagePlus className="w-5 h-5 text-blue-400" />
                          <span className="text-[9px] text-blue-500 mt-0.5">{5 - photoPreviews.length} left</span>
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
                  Describe the {getCategoryLabel()} you need
                </label>
                <Textarea
                  placeholder={getPlaceholderText()}
                  value={rawDescription}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setRawDescription(e.target.value)}
                  className="min-h-[80px] resize-none border-blue-200 focus:border-blue-400 focus:ring-blue-400"
                  disabled={generateMutation.isPending}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {rawDescription.length}/500 - Be specific: make, model, what you're trying to do
                </p>
              </div>

              {/* Generate Button */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-gray-500">
                  {photos.length > 0 && (
                    <span className="text-blue-600 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {photos.length} photo{photos.length > 1 ? 's' : ''} will help clarify your request
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending || rawDescription.trim().length < 10}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      Generate Request
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
