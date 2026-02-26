/**
 * AIImproveButton - Reusable button to trigger AI improvement for existing content
 *
 * Works for both listings (tools, spaces, services) and requests.
 * Uses optimizeRequest for requests and improveListing for offers.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { aiService } from '@/api/services/ai';

export interface ImprovedContent {
  title: string;
  description: string;
  suggestions: string[];
  seoScore?: number;
}

interface AIImproveButtonProps {
  title: string;
  description: string;
  category: string;
  listingType: 'tool' | 'space' | 'service' | 'request';
  onImproved: (improved: ImprovedContent) => void;
  className?: string;
  disabled?: boolean;
}

export function AIImproveButton({
  title,
  description,
  category,
  listingType,
  onImproved,
  className = '',
  disabled = false
}: AIImproveButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleImprove = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error('Title and description are required to improve');
      return;
    }

    if (description.length < 10) {
      toast.error('Description must be at least 10 characters');
      return;
    }

    setIsLoading(true);
    try {
      if (listingType === 'request') {
        // Use optimizeRequest for requests
        const result = await aiService.optimizeRequest(title, description, category);
        onImproved({
          title: result.optimizedTitle,
          description: result.optimizedDescription,
          suggestions: [], // optimizeRequest doesn't return suggestions
          seoScore: undefined,
        });
      } else {
        // Use improveListing for offers
        const { improved } = await aiService.improveListing(title, description, category);
        onImproved({
          title: improved.improvedTitle,
          description: improved.improvedDescription,
          suggestions: improved.suggestions || [],
          seoScore: improved.seoScore,
        });
      }
      toast.success('AI improvements generated!');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('AI improve failed:', error);
      }
      toast.error('Failed to generate improvements. Please try again.');
    }
    setIsLoading(false);
  };

  const isDisabled = disabled || isLoading || !title.trim() || description.length < 10;

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleImprove}
      disabled={isDisabled}
      className={`text-sm border-green-200 bg-green-50/50 hover:bg-green-100 text-green-700 hover:text-green-800 ${className}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Improving...
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4 mr-2" />
          Improve with AI
        </>
      )}
    </Button>
  );
}
