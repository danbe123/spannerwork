import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { quickAcceptService } from '@/api/services';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  X, 
  MapPin, 
  Banknote, 
  Star,
  ChevronDown,
  ChevronUp,
  Loader2,
  Zap,
  MessageCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Request, User, Urgency, Category } from '@/types';

// Partial types for data coming from quickAcceptService.getPending()
type PartialRequest = Pick<Request, 'id' | 'title' | 'description' | 'budget'> & {
  category: string;
  urgency: string;
  // Optional fields that may or may not be present
  locationAddress?: string | null;
  createdDate?: string;
};

type PartialUser = {
  id: string;
  name: string | null;
  rating: number | null;
  avatar: string | null;
};

interface QuickAcceptCardProps {
  request: Request | PartialRequest;
  seeker?: User | PartialUser | null;
  onAccept?: (data: unknown) => void;
  onDecline?: () => void;
  showCounterOffer?: boolean;
}

export default function QuickAcceptCard({ 
  request, 
  seeker,
  onAccept,
  onDecline,
  showCounterOffer = true 
}: QuickAcceptCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCounterOfferInput, setShowCounterOfferInput] = useState(false);
  const [counterOfferAmount, setCounterOfferAmount] = useState(request?.budget || 0);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  
  const queryClient = useQueryClient();

  const acceptMutation = useMutation({
    mutationFn: ({ requestId, proposedRate }: { requestId: string; proposedRate?: number }) => 
      quickAcceptService.accept(requestId, proposedRate),
    onSuccess: (data) => {
      toast.success('Request accepted!', {
        description: 'The seeker has been notified.',
      });
      queryClient.invalidateQueries({ queryKey: ['pendingResponses'] });
      onAccept?.(data);
    },
    onError: (error: Error) => {
      toast.error('Failed to accept', {
        description: error.message || 'Please try again',
      });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (requestId: string) => quickAcceptService.decline(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingResponses'] });
      onDecline?.();
    },
  });

  const handleAccept = async (useCounterOffer = false) => {
    setIsAccepting(true);
    await acceptMutation.mutateAsync({
      requestId: request.id,
      proposedRate: useCounterOffer ? counterOfferAmount * 100 : undefined,
    });
    setIsAccepting(false);
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    await declineMutation.mutateAsync(request.id);
    setIsDeclining(false);
  };

  const urgencyColors: Record<Urgency, string> = {
    ASAP: 'bg-red-100 text-red-700 border-red-200',
    TODAY: 'bg-orange-100 text-orange-700 border-orange-200',
    THIS_WEEKEND: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    FLEXIBLE: 'bg-green-100 text-green-700 border-green-200',
  };

  const categoryIcons: Record<Category, string> = {
    TOOLS: '🔧',
    EXPERTISE: '👨‍🔧',
    SPACE: '🏠',
  };

  if (!request) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -100, scale: 0.9 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden border-2 hover:border-orange-300 transition-colors">
        {request.urgency === 'ASAP' && (
          <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-medium py-1 px-3 text-center">
            <Zap className="w-3 h-3 inline mr-1" />
            Urgent Request - Respond ASAP
          </div>
        )}

        <CardContent className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <Avatar className="w-12 h-12 border-2 border-orange-200">
              <AvatarImage src={seeker?.avatar || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-orange-100 to-amber-100 text-orange-700 font-semibold">
                {seeker?.name?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold truncate">
                  {seeker?.name || 'Someone'}
                </span>
                {seeker?.rating && (
                  <div className="flex items-center text-amber-500">
                    <Star className="w-3 h-3 fill-current" />
                    <span className="text-xs ml-0.5">{seeker.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(request.createdDate || Date.now()), { addSuffix: true })}
              </p>
            </div>

            <div className="flex flex-col items-end gap-1">
              <Badge className={urgencyColors[request.urgency as Urgency] || urgencyColors.FLEXIBLE}>
                {request.urgency?.replace('_', ' ') || 'Flexible'}
              </Badge>
              <span className="text-2xl">{categoryIcons[request.category as Category] || '📋'}</span>
            </div>
          </div>

          <div className="mb-3">
            <h3 className="font-semibold text-lg leading-tight mb-1">
              {request.title}
            </h3>
            <p className={`text-sm text-muted-foreground ${isExpanded ? '' : 'line-clamp-2'}`}>
              {request.description}
            </p>
            {request.description?.length > 100 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-orange-600 hover:text-orange-700 mt-1 flex items-center"
              >
                {isExpanded ? (
                  <>Show less <ChevronUp className="w-3 h-3 ml-1" /></>
                ) : (
                  <>Show more <ChevronDown className="w-3 h-3 ml-1" /></>
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 mb-4 text-sm">
            <div className="flex items-center gap-1 text-green-600 font-semibold">
              <Banknote className="w-4 h-4" />
              <span>£{(request.budget / 100).toFixed(0)}</span>
            </div>
            {request.locationAddress && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span className="truncate max-w-[120px]">{request.locationAddress}</span>
              </div>
            )}
          </div>

          <AnimatePresence>
            {showCounterOfferInput && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mb-4 overflow-hidden"
              >
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Your rate:</span>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                    <Input
                      type="number"
                      value={counterOfferAmount}
                      onChange={(e) => setCounterOfferAmount(Number(e.target.value))}
                      className="pl-7"
                      min={1}
                    />
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => handleAccept(true)}
                    disabled={isAccepting}
                  >
                    {isAccepting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={handleDecline}
              disabled={isDeclining || isAccepting}
            >
              {isDeclining ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <X className="w-4 h-4 mr-1" />
                  Pass
                </>
              )}
            </Button>
            
            {showCounterOffer && !showCounterOfferInput && (
              <Button
                variant="outline"
                className="border-orange-200 text-orange-600 hover:bg-orange-50"
                onClick={() => setShowCounterOfferInput(true)}
                disabled={isAccepting || isDeclining}
              >
                <MessageCircle className="w-4 h-4 mr-1" />
                Counter
              </Button>
            )}
            
            <Button
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg"
              onClick={() => handleAccept(false)}
              disabled={isAccepting || isDeclining}
            >
              {isAccepting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Accept £{(request.budget / 100).toFixed(0)}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
