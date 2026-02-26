/**
 * StickyRequestCTA - Context-aware action buttons
 *
 * Use variant="desktop" inside sticky sidebar
 * Use variant="mobile" for fixed bottom bar
 *
 * For owners: Edit + View Responses
 * For non-owners: Send a Quote (primary CTA) or View Conversation (if already quoted)
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MessageCircle,
  Edit,
  Eye,
  ArrowLeft,
  MessagesSquare,
  MoreVertical,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { formatPrice } from '@/utils';

interface StickyRequestCTAProps {
  isOwnRequest: boolean;
  isActive: boolean;
  budget?: number | null;
  rateType?: string;
  responseCount: number;
  hasAlreadyQuoted?: boolean;
  seekerId?: string;
  requestId?: string;
  onSendQuote: () => void;
  onEdit: () => void;
  onViewResponses: () => void;
  onBack: () => void;
  onMarkComplete?: () => void;
  onClose?: () => void;
  variant: 'desktop' | 'mobile';
}

export default function StickyRequestCTA({
  isOwnRequest,
  isActive,
  budget,
  rateType,
  responseCount,
  hasAlreadyQuoted,
  seekerId,
  requestId,
  onSendQuote,
  onEdit,
  onViewResponses,
  onBack,
  onMarkComplete,
  onClose,
  variant
}: StickyRequestCTAProps) {
  const navigate = useNavigate();

  const handleViewConversation = () => {
    if (seekerId && requestId) {
      navigate(`/Chat?userId=${seekerId}&requestId=${requestId}`);
    }
  };

  const getRateDisplay = () => {
    if (budget === undefined || budget === null) return null;
    switch(rateType) {
      case 'HOURLY': return `${formatPrice(budget)}/hr`;
      case 'DAILY': return `${formatPrice(budget)}/day`;
      default: return formatPrice(budget);
    }
  };

  const priceDisplay = getRateDisplay();

  // Desktop sidebar version
  if (variant === 'desktop') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
      >
        {isOwnRequest && isActive ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                onClick={onEdit}
                variant="outline"
                className="flex-1 h-12 rounded-xl border-2 font-semibold"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-12 px-3 rounded-xl border-2">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={onMarkComplete} className="cursor-pointer">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                    Mark Complete
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onClose} className="cursor-pointer text-red-600">
                    <XCircle className="w-4 h-4 mr-2" />
                    No Longer Needed
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button
              onClick={onViewResponses}
              className="w-full h-12 rounded-xl bg-gray-900 hover:bg-gray-800 font-semibold"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Responses {responseCount > 0 && `(${responseCount})`}
            </Button>
          </div>
        ) : !isOwnRequest && isActive ? (
          <div className="space-y-4">
            {priceDisplay && (
              <div className="text-center pb-4 border-b border-gray-100">
                <div className="text-sm text-gray-500 mb-1">Budget</div>
                <div className="text-2xl font-bold text-gray-900">{priceDisplay}</div>
              </div>
            )}
            {hasAlreadyQuoted ? (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleViewConversation}
                  className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold shadow-md"
                >
                  <MessagesSquare className="w-5 h-5 mr-2" />
                  View Conversation
                </Button>
              </motion.div>
            ) : (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={onSendQuote}
                  className="w-full h-14 rounded-xl bg-brand-700 hover:bg-brand-800 text-white text-lg font-bold shadow-md"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Send a Quote
                </Button>
              </motion.div>
            )}
            {!hasAlreadyQuoted && responseCount > 0 && (
              <p className="text-center text-sm text-gray-500">
                {responseCount} {responseCount === 1 ? 'person has' : 'people have'} already quoted
              </p>
            )}
          </div>
        ) : (
          <Button
            onClick={onBack}
            variant="outline"
            className="w-full h-12 rounded-xl border-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Feed
          </Button>
        )}
      </motion.div>
    );
  }

  // Mobile fixed bottom version
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-40">
      {isOwnRequest && isActive ? (
        <div className="flex gap-2 max-w-4xl mx-auto">
          <Button
            onClick={onEdit}
            variant="outline"
            className="flex-1 h-12 rounded-xl border-2"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button
            onClick={onViewResponses}
            className="flex-1 h-12 rounded-xl bg-gray-900 hover:bg-gray-800"
          >
            <Eye className="w-4 h-4 mr-2" />
            Responses {responseCount > 0 && `(${responseCount})`}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-12 px-3 rounded-xl border-2">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onMarkComplete} className="cursor-pointer">
                <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                Mark Complete
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onClose} className="cursor-pointer text-red-600">
                <XCircle className="w-4 h-4 mr-2" />
                No Longer Needed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : !isOwnRequest && isActive ? (
        <div className="flex items-center gap-4 max-w-4xl mx-auto">
          {priceDisplay && !hasAlreadyQuoted && (
            <div className="flex-shrink-0">
              <div className="text-xs text-gray-500">Budget</div>
              <div className="text-lg font-bold text-gray-900">{priceDisplay}</div>
            </div>
          )}
          {hasAlreadyQuoted ? (
            <Button
              onClick={handleViewConversation}
              className="flex-1 h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold shadow-md"
            >
              <MessagesSquare className="w-5 h-5 mr-2" />
              View Conversation
            </Button>
          ) : (
            <Button
              onClick={onSendQuote}
              className="flex-1 h-14 rounded-xl bg-brand-700 hover:bg-brand-800 text-white text-lg font-bold shadow-md"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Send a Quote
            </Button>
          )}
        </div>
      ) : (
        <Button
          onClick={onBack}
          variant="outline"
          className="w-full h-12 rounded-xl border-2 max-w-4xl mx-auto"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Feed
        </Button>
      )}
    </div>
  );
}
