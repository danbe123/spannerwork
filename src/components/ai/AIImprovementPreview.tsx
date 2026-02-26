/**
 * AIImprovementPreview - Modal to preview and accept AI improvements
 *
 * Shows original vs improved content with options to:
 * - Accept all improvements
 * - Accept title only
 * - Accept description only
 * - Cancel
 */

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sparkles,
  Check,
  X,
  ArrowRight,
  FileText,
  Lightbulb,
  TrendingUp
} from 'lucide-react';
import type { ImprovedContent } from './AIImproveButton';

interface AIImprovementPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  original: { title: string; description: string };
  improved: ImprovedContent | null;
  onAccept: (accepted: { title?: string; description?: string }) => void;
}

export function AIImprovementPreview({
  isOpen,
  onClose,
  original,
  improved,
  onAccept
}: AIImprovementPreviewProps) {
  if (!improved) return null;

  const handleAcceptAll = () => {
    onAccept({
      title: improved.title,
      description: improved.description
    });
    onClose();
  };

  const handleAcceptTitleOnly = () => {
    onAccept({ title: improved.title });
    onClose();
  };

  const handleAcceptDescriptionOnly = () => {
    onAccept({ description: improved.description });
    onClose();
  };

  const titleChanged = original.title !== improved.title;
  const descriptionChanged = original.description !== improved.description;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            AI Improved Content
          </DialogTitle>
          <DialogDescription>
            Review the AI improvements below. You can accept all changes or select specific fields.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* SEO Score (if available) */}
          {improved.seoScore !== undefined && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-green-50 to-teal-50 border border-green-200">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700">SEO Score</div>
                <div className="text-lg font-bold text-green-600">{improved.seoScore}/100</div>
              </div>
            </div>
          )}

          {/* Title Comparison */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-sm">Title</span>
                {titleChanged && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                    Improved
                  </Badge>
                )}
              </div>
              {titleChanged && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAcceptTitleOnly}
                  className="h-7 text-xs"
                >
                  Accept title only
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div className="text-xs text-gray-500 mb-1">Original</div>
                <p className="text-sm text-gray-700">{original.title || <span className="italic text-gray-400">Empty</span>}</p>
              </div>
              <div className={`p-3 rounded-lg ${titleChanged ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'} border`}>
                <div className="text-xs text-gray-500 mb-1">Improved</div>
                <p className={`text-sm ${titleChanged ? 'text-green-800 font-medium' : 'text-gray-700'}`}>
                  {improved.title || <span className="italic text-gray-400">No change</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Description Comparison */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-sm">Description</span>
                {descriptionChanged && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                    Improved
                  </Badge>
                )}
              </div>
              {descriptionChanged && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAcceptDescriptionOnly}
                  className="h-7 text-xs"
                >
                  Accept description only
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div className="text-xs text-gray-500 mb-1">Original</div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {original.description || <span className="italic text-gray-400">Empty</span>}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${descriptionChanged ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'} border`}>
                <div className="text-xs text-gray-500 mb-1">Improved</div>
                <p className={`text-sm whitespace-pre-wrap ${descriptionChanged ? 'text-green-800' : 'text-gray-700'}`}>
                  {improved.description || <span className="italic text-gray-400">No change</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Suggestions */}
          {improved.suggestions && improved.suggestions.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-200 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-600" />
                <span className="font-medium text-sm text-amber-900">Additional Suggestions</span>
              </div>
              <div className="p-4">
                <ul className="space-y-2">
                  {improved.suggestions.map((suggestion, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                      <span className="text-amber-600 mt-0.5">•</span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* No Changes Warning */}
          {!titleChanged && !descriptionChanged && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-center"
            >
              <p className="text-sm text-gray-600">
                Your content is already well-written! No changes suggested.
              </p>
            </motion.div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAcceptAll}
            disabled={!titleChanged && !descriptionChanged}
            className="flex-1 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white"
          >
            <Check className="w-4 h-4 mr-2" />
            Accept All
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
