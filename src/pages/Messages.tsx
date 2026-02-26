/**
 * Messages - Completely Redesigned
 *
 * Modern messaging interface with:
 * - Split-view on desktop (conversations + chat)
 * - Real-time typing indicators
 * - Online status
 * - Smooth animations
 * - Mobile-first responsive
 * - Call request system (request → accept/decline → phone number shared)
 */

import { useState, useEffect, useRef, useMemo, ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { authService, messagesService, requestsService, uploadService } from "@/api/services";
import { queryKeys } from "@/lib/queryKeys";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import {
  MessageSquare,
  Search,
  Send,
  Image as ImageIcon,
  ArrowLeft,
  Loader2,
  Check,
  CheckCheck,
  Phone,
  Info,
  Smile,
  Inbox,
  Sparkles,
  Zap,
  Shield,
  X,
  PhoneCall,
  Star,
  MapPin,
  Calendar
} from "lucide-react";
import SEO from "@/components/SEO";
import { User, Conversation, Message, Request } from "@/types";

// Animation variants
const listItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 }
};

const messageVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

// ============================================================================
// Call Request System Types (Voice only - no video)
// ============================================================================

interface CallRequest {
  type: 'CALL_REQUEST';
  status: 'pending' | 'accepted' | 'declined';
  requestId: string;
  phone?: string; // Phone number shared when accepted
}

// Helper to check if a message is a call request
function isCallRequestMessage(content: string): CallRequest | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed.type === 'CALL_REQUEST' && parsed.status) {
      return parsed as CallRequest;
    }
  } catch {
    // Not JSON, not a call request
  }
  return null;
}

// Helper to create a call request message
function createCallRequestContent(status: 'pending' | 'accepted' | 'declined', requestId: string, phone?: string): string {
  return JSON.stringify({
    type: 'CALL_REQUEST',
    status,
    requestId,
    ...(phone && { phone })
  });
}

// ============================================================================
// Address Share System Types
// ============================================================================

interface AddressShare {
  type: 'ADDRESS_SHARE';
  street: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
}

// Helper to check if a message is an address share
function isAddressShareMessage(content: string): AddressShare | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed.type === 'ADDRESS_SHARE' && parsed.street) {
      return parsed as AddressShare;
    }
  } catch {
    // Not JSON, not an address share
  }
  return null;
}

// Helper to create an address share message
function createAddressShareContent(address: Omit<AddressShare, 'type'>): string {
  return JSON.stringify({
    type: 'ADDRESS_SHARE',
    ...address
  });
}

interface MessageReactionsProps {
  reactions?: string[];
  onReact?: (emoji: string) => void;
  isOwn?: boolean;
}

// Message reactions component
function MessageReactions({ reactions, onReact, isOwn }: MessageReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  
  return (
    <div className="relative">
      <motion.button
        onClick={() => setShowPicker(!showPicker)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded-full"
        whileTap={{ scale: 0.9 }}
      >
        <Smile className="w-4 h-4 text-gray-400" />
      </motion.button>
      
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            className={`absolute ${isOwn ? 'right-0' : 'left-0'} bottom-full mb-2 bg-white rounded-full shadow-xl border border-gray-100 px-2 py-1 flex gap-1 z-10`}
          >
            {quickReactions.map((emoji) => (
              <motion.button
                key={emoji}
                onClick={() => { onReact?.(emoji); setShowPicker(false); }}
                className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full text-lg"
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              >
                {emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      
      {reactions && reactions.length > 0 && (
        <div className={`absolute -bottom-3 ${isOwn ? 'right-2' : 'left-2'} flex bg-white rounded-full shadow-md px-1 py-0.5 border border-gray-100`}>
          {reactions.slice(0, 3).map((r, i) => (
            <span key={i} className="text-xs">{r}</span>
          ))}
          {reactions.length > 3 && (
            <span className="text-xs text-gray-500 ml-1">+{reactions.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}

interface OnlineStatusProps {
  isOnline: boolean;
  lastSeen?: string | null;
}

// Online status badge
function OnlineStatus({ isOnline, lastSeen }: OnlineStatusProps) {
  if (isOnline) {
    return (
      <div className="flex items-center gap-1 text-emerald-500">
        <motion.div 
          className="w-2 h-2 bg-emerald-500 rounded-full"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        />
        <span className="text-xs font-medium">Online</span>
      </div>
    );
  }
  return (
    <span className="text-xs text-gray-500">
      {lastSeen ? `Active ${formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}` : 'Offline'}
    </span>
  );
}

// Extended User interface to include online status if missing in core types
interface ExtendedUser extends User {
  isOnline?: boolean;
  lastSeen?: string | null;
}

interface ExtendedConversation extends Conversation {
  user?: ExtendedUser;
  request?: Request;
}

// ============================================================================
// Call Request Card Component
// ============================================================================

interface CallRequestCardProps {
  callRequest: CallRequest;
  isOwnMessage: boolean;
  currentUserId: string;
  senderId: string;
  onAccept?: (requestId: string) => void;
  onDecline?: (requestId: string) => void;
  createdDate: string;
  isMobile: boolean;
}

function CallRequestCard({
  callRequest,
  isOwnMessage,
  onAccept,
  onDecline,
  createdDate,
  isMobile
}: CallRequestCardProps) {
  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div className={`max-w-[85%] rounded-2xl overflow-hidden ${
        isOwnMessage
          ? 'bg-gradient-to-br from-brand-800 to-brand-900'
          : 'bg-white border border-gray-200'
      }`}>
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isOwnMessage ? 'bg-white/20' : 'bg-brand-100'
            }`}>
              <PhoneCall className={`w-5 h-5 ${isOwnMessage ? 'text-white' : 'text-brand-800'}`} />
            </div>
            <div>
              <p className={`font-semibold ${isOwnMessage ? 'text-white' : 'text-gray-900'}`}>
                Call Request
              </p>
              <p className={`text-xs ${isOwnMessage ? 'text-white/70' : 'text-gray-500'}`}>
                {callRequest.status === 'pending' && (isOwnMessage ? 'Waiting for response...' : 'Tap to respond')}
                {callRequest.status === 'accepted' && 'Request accepted'}
                {callRequest.status === 'declined' && 'Request declined'}
              </p>
            </div>
          </div>

          {/* Action buttons for pending requests (only for recipient) */}
          {callRequest.status === 'pending' && !isOwnMessage && (
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => onAccept?.(callRequest.requestId)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <Check className="w-4 h-4 mr-1" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDecline?.(callRequest.requestId)}
                className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                <X className="w-4 h-4 mr-1" />
                Decline
              </Button>
            </div>
          )}

          {/* Phone number display when accepted */}
          {callRequest.status === 'accepted' && callRequest.phone && (
            <div className={`mt-3 p-3 rounded-lg ${
              isOwnMessage ? 'bg-white/10' : 'bg-green-50'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Check className={`w-4 h-4 ${isOwnMessage ? 'text-green-300' : 'text-green-600'}`} />
                <span className={`text-sm font-medium ${isOwnMessage ? 'text-green-200' : 'text-green-700'}`}>
                  Call request accepted
                </span>
              </div>
              {isMobile ? (
                <a
                  href={`tel:${callRequest.phone}`}
                  className={`flex items-center gap-2 p-2 rounded-lg ${
                    isOwnMessage
                      ? 'bg-white/20 text-white hover:bg-white/30'
                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                  } transition-colors`}
                >
                  <Phone className="w-5 h-5" />
                  <span className="font-semibold">{callRequest.phone}</span>
                  <span className="text-xs opacity-70 ml-auto">Tap to call</span>
                </a>
              ) : (
                <div className={`flex items-center gap-2 p-2 rounded-lg ${
                  isOwnMessage ? 'bg-white/20' : 'bg-green-100'
                }`}>
                  <Phone className={`w-5 h-5 ${isOwnMessage ? 'text-white' : 'text-green-700'}`} />
                  <span className={`font-semibold ${isOwnMessage ? 'text-white' : 'text-green-800'}`}>
                    {callRequest.phone}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Accepted but no phone (shouldn't happen normally) */}
          {callRequest.status === 'accepted' && !callRequest.phone && (
            <div className={`flex items-center gap-2 mt-3 p-2 rounded-lg ${
              isOwnMessage ? 'bg-white/10' : 'bg-green-50'
            }`}>
              <Check className={`w-4 h-4 ${isOwnMessage ? 'text-green-300' : 'text-green-600'}`} />
              <span className={`text-sm ${isOwnMessage ? 'text-green-200' : 'text-green-700'}`}>
                Call request accepted
              </span>
            </div>
          )}

          {callRequest.status === 'declined' && (
            <div className={`flex items-center gap-2 mt-3 p-2 rounded-lg ${
              isOwnMessage ? 'bg-white/10' : 'bg-red-50'
            }`}>
              <X className={`w-4 h-4 ${isOwnMessage ? 'text-red-300' : 'text-red-600'}`} />
              <span className={`text-sm ${isOwnMessage ? 'text-red-200' : 'text-red-700'}`}>
                Request was declined
              </span>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className={`px-4 pb-2 text-xs ${isOwnMessage ? 'text-white/50' : 'text-gray-400'}`}>
          {formatDistanceToNow(new Date(createdDate), { addSuffix: true })}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Address Share Card Component
// ============================================================================

interface AddressShareCardProps {
  address: AddressShare;
  isOwnMessage: boolean;
  createdDate: string;
}

function AddressShareCard({
  address,
  isOwnMessage,
  createdDate,
}: AddressShareCardProps) {
  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div className={`max-w-[85%] rounded-2xl overflow-hidden ${
        isOwnMessage
          ? 'bg-gradient-to-br from-brand-800 to-brand-900'
          : 'bg-white border border-gray-200'
      }`}>
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isOwnMessage ? 'bg-white/20' : 'bg-brand-100'
            }`}>
              <MapPin className={`w-5 h-5 ${isOwnMessage ? 'text-white' : 'text-brand-800'}`} />
            </div>
            <div>
              <p className={`font-semibold ${isOwnMessage ? 'text-white' : 'text-gray-900'}`}>
                Address Shared
              </p>
              <p className={`text-xs ${isOwnMessage ? 'text-white/70' : 'text-gray-500'}`}>
                {isOwnMessage ? 'You shared your address' : 'Shared their address with you'}
              </p>
            </div>
          </div>

          {/* Address display */}
          <div className={`p-3 rounded-lg ${
            isOwnMessage ? 'bg-white/10' : 'bg-gray-50'
          }`}>
            <p className={`text-sm font-medium ${isOwnMessage ? 'text-white' : 'text-gray-900'}`}>
              {address.street}
            </p>
            <p className={`text-sm ${isOwnMessage ? 'text-white/80' : 'text-gray-600'}`}>
              {address.city}{address.county ? `, ${address.county}` : ''}
            </p>
            <p className={`text-sm font-semibold ${isOwnMessage ? 'text-white' : 'text-gray-900'}`}>
              {address.postcode}
            </p>
          </div>
        </div>

        {/* Timestamp */}
        <div className={`px-4 pb-2 text-xs ${isOwnMessage ? 'text-white/50' : 'text-gray-400'}`}>
          {formatDistanceToNow(new Date(createdDate), { addSuffix: true })}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// User Info Panel Component
// ============================================================================

interface UserInfoPanelProps {
  user: ExtendedUser;
  onClose: () => void;
}

function UserInfoPanel({ user, onClose }: UserInfoPanelProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-2xl z-50 overflow-y-auto"
    >
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">User Info</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="p-6">
        {/* Profile Header */}
        <div className="text-center mb-6">
          <Avatar className="w-24 h-24 mx-auto mb-4 border-4 border-white shadow-lg">
            <AvatarImage src={user.avatar || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-brand-100 to-brand-200 text-brand-800 text-2xl">
              {user.name?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-bold text-gray-900">{user.name || 'User'}</h2>
          {user.bio && (
            <p className="text-sm text-gray-600 mt-2">{user.bio}</p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="font-bold text-gray-900">{user.rating?.toFixed(1) || '—'}</span>
            </div>
            <p className="text-xs text-gray-500">Rating</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <span className="font-bold text-gray-900">{user.totalTransactions || 0}</span>
            <p className="text-xs text-gray-500">Transactions</p>
          </div>
        </div>

        {/* Info List */}
        <div className="space-y-4">
          {user.locationAddress && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Location</p>
                <p className="text-sm text-gray-500">{user.locationAddress}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">Member since</p>
              <p className="text-sm text-gray-500">
                {new Date(user.createdDate).toLocaleDateString('en-GB', {
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Verification Badges */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Verifications</h4>
          <div className="flex flex-wrap gap-2">
            {user.emailVerified && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs">
                <Check className="w-3 h-3" />
                Email verified
              </span>
            )}
            {user.phoneVerified && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs">
                <Check className="w-3 h-3" />
                Phone verified
              </span>
            )}
            {user.idVerified && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs">
                <Check className="w-3 h-3" />
                ID verified
              </span>
            )}
            {!user.emailVerified && !user.phoneVerified && !user.idVerified && (
              <span className="text-sm text-gray-500">No verifications yet</span>
            )}
          </div>
        </div>

        {/* View Profile Button */}
        <Button
          onClick={() => navigate(`/user/${user.id}`)}
          className="w-full mt-6 bg-brand-800 hover:bg-brand-900"
        >
          View Full Profile
        </Button>
      </div>
    </motion.div>
  );
}

export default function Messages() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Get active chat from URL
  const activeUserId = searchParams.get('userId');
  const activeRequestId = searchParams.get('requestId');

  const activeUserIdKey = activeUserId ?? '';
  const activeRequestIdKey = activeRequestId ?? '';

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Get current user
  const { data: currentUserData } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () => authService.getCurrentUser(),
  });
  const currentUser = currentUserData?.user;

  const requiresVerification = currentUser?.emailVerified === false;

  // Get conversations
  const { data: conversationsData, isLoading: loadingConversations } = useQuery({
    queryKey: queryKeys.conversations(),
    queryFn: () => messagesService.listConversations(),
    enabled: !!currentUser && !requiresVerification,
    // Always fetch fresh data - no caching
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    // Poll for updates
    refetchInterval: 30000,
  });
  const conversations = useMemo(() => (conversationsData?.conversations || []) as ExtendedConversation[], [conversationsData?.conversations]);

  // Get active conversation messages
  const { data: conversationData, isLoading: loadingMessages } = useQuery({
    queryKey: queryKeys.conversation(activeUserIdKey),
    queryFn: () => activeUserId ? messagesService.getConversation(activeUserId) : Promise.resolve({ messages: [], otherUser: {} as User }),
    enabled: !!currentUser && !!activeUserId && !requiresVerification,
    // Always fetch fresh data - no caching
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    // Poll for updates
    refetchInterval: 15000,
  });
  
  const messages: Message[] = useMemo(() => conversationData?.messages || [], [conversationData?.messages]);
  const otherUser = conversationData?.otherUser as ExtendedUser | undefined;

  // Get request info if available
  const { data: requestData } = useQuery({
    queryKey: queryKeys.request(activeRequestIdKey),
    queryFn: async (): Promise<{ request: Request | undefined }> => 
      activeRequestId 
        ? requestsService.getById(activeRequestId) 
        : { request: undefined },
    enabled: !!activeRequestId && !requiresVerification,
  });
  const request = requestData?.request;

  // Filter conversations
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    return conversations.filter(conv => {
      const userName = conv.user?.name || conv.user?.email || '';
      const lastMessage = conv.lastMessage?.content || '';
      return userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
             lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [conversations, searchQuery]);

  // Mark as read when opening conversation
  useEffect(() => {
    if (currentUser && activeUserId && !requiresVerification) {
      messagesService.markConversationAsRead(activeUserId)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.conversations() });
        })
        .catch((error: Error) => {
          // Silently handle mark-as-read failures - not critical to user experience
          if (import.meta.env.DEV) {
            console.error('Failed to mark conversation as read:', error.message);
          }
        });
    }
  }, [activeUserId, currentUser, queryClient, requiresVerification]);

  // Scroll to bottom only when new messages are added (not on initial load)
  const prevMessageCount = useRef(0);
  useEffect(() => {
    // Only scroll if we have more messages than before (new message added)
    // or if this is initial load with messages and content overflows
    if (messages.length > prevMessageCount.current && prevMessageCount.current > 0) {
      // New message added - scroll to bottom
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCount.current = messages.length;
  }, [messages]);

  // Show mobile chat when user selected
  useEffect(() => {
    // Mobile chat visibility handled by CSS classes based on activeUserId
  }, [activeUserId]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: (content: string) => {
      if (!activeUserId) throw new Error("No recipient");
      return messagesService.send({
        recipientId: activeUserId,
        content,
        requestId: activeRequestId || undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversation(activeUserIdKey), refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations(), refetchType: 'all' });
      setMessageText("");
    },
  });

  const handleSendMessage = () => {
    if (!messageText.trim() || !activeUserId) return;
    sendMutation.mutate(messageText);
  };

  // ============================================================================
  // Call Request Handlers (Voice only)
  // ============================================================================

  // Check if there's a pending call request from the current user
  const pendingCallRequest = useMemo(() => {
    for (const message of messages) {
      if (message.senderId === currentUser?.id) {
        const callRequest = isCallRequestMessage(message.content);
        if (callRequest && callRequest.status === 'pending') {
          return callRequest;
        }
      }
    }
    return null;
  }, [messages, currentUser?.id]);

  // Send a call request
  const handleCallRequest = () => {
    if (!activeUserId || !currentUser) return;

    // Check if there's already a pending request from this user
    if (pendingCallRequest) {
      toast.info('You already have a pending call request. Please wait for a response.');
      return;
    }

    // Check if user has a phone number to share
    if (!currentUser.phone) {
      toast.error('Please add a phone number to your profile before requesting a call.');
      return;
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const content = createCallRequestContent('pending', requestId);

    sendMutation.mutate(content, {
      onSuccess: () => {
        toast.success('Call request sent! They will see your number when they accept.');
      }
    });
  };

  // Accept a call request - share your phone number
  const handleAcceptCallRequest = (requestId: string) => {
    if (!activeUserId || !currentUser) return;

    // Check if user has a phone number to share
    if (!currentUser.phone) {
      toast.error('Please add a phone number to your profile to accept call requests.');
      return;
    }

    const content = createCallRequestContent('accepted', requestId, currentUser.phone);
    sendMutation.mutate(content, {
      onSuccess: () => {
        toast.success('Call request accepted! Your phone number has been shared.');
      }
    });
  };

  // Decline a call request
  const handleDeclineCallRequest = (requestId: string) => {
    if (!activeUserId) return;

    const content = createCallRequestContent('declined', requestId);
    sendMutation.mutate(content, {
      onSuccess: () => {
        toast.info('Call request declined');
      }
    });
  };

  // Share your address with the other user
  const handleShareAddress = () => {
    if (!activeUserId || !currentUser) return;

    // Check if user has an address set - extend User type to include new fields
    const extendedUser = currentUser as User & { street?: string; city?: string; county?: string; country?: string };

    if (!extendedUser.street || !extendedUser.postcode) {
      toast.error('Please add your address in your profile first.');
      return;
    }

    const content = createAddressShareContent({
      street: extendedUser.street,
      city: extendedUser.city || '',
      county: extendedUser.county || '',
      postcode: extendedUser.postcode || '',
      country: extendedUser.country || 'GB',
    });

    sendMutation.mutate(content, {
      onSuccess: () => {
        toast.success('Address shared successfully!');
      }
    });
  };

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUserId) return;

    setUploadingPhoto(true);
    try {
      const result = await uploadService.uploadFile(file);
      await messagesService.send({
        recipientId: activeUserId,
        content: result.data.fileUrl,
        requestId: activeRequestId || undefined,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversation(activeUserIdKey), refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations(), refetchType: 'all' });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Upload failed:', error);
      }
    }
    setUploadingPhoto(false);
    e.target.value = '';
  };

  const selectConversation = (userId: string, requestId?: string) => {
    const params = new URLSearchParams();
    params.set('userId', userId);
    if (requestId) params.set('requestId', requestId);
    setSearchParams(params);
  };

  const closeChat = () => {
    setSearchParams({});
  };

  const handleStartTransaction = () => {
    if (currentUser && request && activeUserId) {
      const isOwner = currentUser.id === request.seekerId;
      navigate(`/StartTransaction?requestId=${activeRequestId}&helperId=${isOwner ? activeUserId : currentUser.id}&seekerId=${isOwner ? currentUser.id : request.seekerId}`);
    }
  };

  // Check if message is an image (relative paths or full URLs)
  const isImageMessage = (content: string) => {
    if (typeof content !== 'string') return false;
    // Match relative paths starting with /uploads/
    if (/^\/uploads\/.*\.(png|jpe?g|gif|webp|bmp|svg)($|\?)/i.test(content)) return true;
    // Match full URLs with image extensions
    if (/^https?:\/\/.*\.(png|jpe?g|gif|webp|bmp|svg)($|\?)/i.test(content)) return true;
    // Match CDN/storage patterns
    if (/^https?:\/\/.*(images|uploads|storage).*\.(png|jpe?g|gif|webp|bmp|svg)/i.test(content)) return true;
    return false;
  };

  return requiresVerification ? (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <SEO title="Verification Required - SpannerWork" description="Verify your account to use messaging" />
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-6">
          <Shield className="w-8 h-8 text-brand-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Verification Required</h1>
        <p className="text-gray-600 mb-6">
          To protect our community, please verify your email address before messaging other users.
        </p>
        <div className="space-y-3">
          <Button onClick={() => navigate('/verification')} className="w-full bg-brand-800 hover:bg-brand-900">
            <Shield className="w-4 h-4 mr-2" />
            Go to Verification
          </Button>
          <Button variant="ghost" onClick={() => navigate(-1)} className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  ) : (
    <div className="messages-container bg-gray-50 flex flex-col overflow-hidden">
      <SEO title="Messages - SpannerWork" description="Your conversations on SpannerWork" />

      {/* Desktop: Split view | Mobile: List or Chat */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversations List */}
        <div className={`
          ${activeUserId ? 'hidden md:flex' : 'flex'}
          flex-col w-full md:w-96 border-r border-gray-200 bg-white z-30 relative
        `}>
          {/* Search */}
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-50 border-gray-200 text-gray-900 pl-10 placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-brand-800 animate-spin" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Inbox className="w-8 h-8 text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {searchQuery ? "No matches found" : "No messages yet"}
                </h3>
                <p className="text-sm text-gray-500">
                  {searchQuery 
                    ? "Try different search terms"
                    : "Start a conversation by responding to a job"}
                </p>
              </div>
            ) : (
              <AnimatePresence>
                {filteredConversations.map((conv, index) => {
                  // userId may be at different nesting levels depending on API response
                  const userId = (conv as { userId?: string }).userId || conv.participant?.id || conv.user?.id;
                  const isActive = userId === activeUserId;
                  const isFromMe = conv.lastMessage?.senderId === currentUser?.id;
                  
                  return (
                    <motion.button
                      key={conv.id}
                      variants={listItemVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      transition={{ delay: index * 0.05 }}
                      onClick={() => userId && selectConversation(userId, conv.request?.id)}
                      className={`w-full p-4 flex items-center gap-3 transition-all border-b border-gray-100 ${
                        isActive 
                          ? 'bg-brand-50 border-l-2 border-l-brand-800' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="relative">
                        <Avatar className="w-12 h-12 border-2 border-white/10">
                          <AvatarImage src={conv.user?.avatar || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-brand-100 to-brand-200 text-brand-800">
                            {conv.user?.name?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        {/* Online indicator - only show if user is online */}
                        {conv.user?.isOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-semibold truncate ${
                            conv.unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'
                          }`}>
                            {conv.user?.name || 'Unknown User'}
                          </span>
                          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                            {conv.lastMessage?.createdDate && formatDistanceToNow(new Date(conv.lastMessage.createdDate), { addSuffix: false })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isFromMe && (
                            <CheckCheck className="w-3 h-3 text-blue-400 flex-shrink-0" />
                          )}
                          <p className={`text-sm truncate ${
                            conv.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'
                          }`}>
                            {isImageMessage(conv.lastMessage?.content) ? '📷 Photo' : conv.lastMessage?.content}
                          </p>
                        </div>
                        {conv.request && (
                          <p className="text-xs text-brand-800 truncate mt-1">
                            Re: {conv.request.title}
                          </p>
                        )}
                      </div>

                      {conv.unreadCount > 0 && (
                        <div className="w-5 h-5 rounded-full bg-brand-800 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs text-white font-bold">{conv.unreadCount}</span>
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`
          ${activeUserId ? 'flex' : 'hidden md:flex'} 
          flex-col flex-1 bg-gray-50
        `}>
          {activeUserId && otherUser ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 bg-white">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={closeChat}
                    className="md:hidden text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>

                  <Avatar className="w-10 h-10">
                    <AvatarImage src={otherUser.avatar || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-brand-100 to-brand-200 text-brand-800">
                      {otherUser.name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-gray-900 truncate">{otherUser.name || 'User'}</h2>
                    <OnlineStatus 
                      isOnline={otherUser?.isOnline || false} 
                      lastSeen={otherUser?.lastSeen} 
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Request Call button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCallRequest}
                      className={`text-gray-500 hover:text-gray-900 hover:bg-gray-100 ${
                        pendingCallRequest ? 'animate-pulse text-amber-500' : ''
                      }`}
                      title={pendingCallRequest ? 'Call request pending...' : 'Request a call'}
                    >
                      <Phone className="w-4 h-4" />
                    </Button>
                    {/* Share Address button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleShareAddress}
                      className="text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                      title="Share your address"
                    >
                      <MapPin className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowUserInfo(true)}
                      className="text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                    >
                      <Info className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Request context */}
                {request && (
                  <div className="mt-3 p-3 rounded-xl bg-brand-800/10 border border-brand-800/30">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-brand-800 font-medium">About this job</p>
                        <p className="text-sm text-gray-900 truncate">{request.title}</p>
                      </div>
                      {request.status === 'ACTIVE' && (
                        <Button
                          size="sm"
                          onClick={handleStartTransaction}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white ml-3"
                        >
                          <Zap className="w-3 h-3 mr-1" />
                          Start Deal
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-brand-800 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8 text-brand-800" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Start the conversation</h3>
                    <p className="text-sm text-gray-500">Say hello and discuss the job details</p>
                  </div>
                ) : (
                  <>
                    {messages.map((message, index) => {
                      const isOwn = message.senderId === currentUser?.id;
                      const isImage = isImageMessage(message.content);
                      const callRequest = isCallRequestMessage(message.content);
                      const addressShare = isAddressShareMessage(message.content);
                      const showAvatar = index === 0 || messages[index - 1]?.senderId !== message.senderId;

                      // Render call request messages with special card
                      if (callRequest) {
                        return (
                          <CallRequestCard
                            key={message.id}
                            callRequest={callRequest}
                            isOwnMessage={isOwn}
                            currentUserId={currentUser?.id || ''}
                            senderId={message.senderId}
                            onAccept={handleAcceptCallRequest}
                            onDecline={handleDeclineCallRequest}
                            createdDate={message.createdDate}
                            isMobile={isMobile}
                          />
                        );
                      }

                      // Render address share messages with special card
                      if (addressShare) {
                        return (
                          <AddressShareCard
                            key={message.id}
                            address={addressShare}
                            isOwnMessage={isOwn}
                            createdDate={message.createdDate}
                          />
                        );
                      }

                      return (
                        <motion.div
                          key={message.id}
                          variants={messageVariants}
                          initial="hidden"
                          animate="visible"
                          transition={{ delay: index * 0.03 }}
                          className={`flex gap-3 group ${isOwn ? 'flex-row-reverse' : ''}`}
                        >
                          {showAvatar ? (
                            <Avatar className="w-8 h-8 flex-shrink-0">
                              <AvatarImage src={isOwn ? currentUser?.avatar || undefined : otherUser?.avatar || undefined} />
                              <AvatarFallback className={isOwn ? 'bg-brand-800 text-white' : 'bg-gray-200 text-gray-700'}>
                                {isOwn ? currentUser?.name?.[0] : otherUser?.name?.[0] || 'U'}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="w-8 flex-shrink-0" />
                          )}

                          <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%]`}>
                            <div className="flex items-center gap-2">
                              {isOwn && <MessageReactions reactions={message.reactions} isOwn={isOwn} />}
                              <motion.div
                                className={`rounded-2xl px-4 py-2.5 relative ${
                                  isOwn
                                    ? 'bg-gradient-to-br from-brand-800 to-brand-900 text-white rounded-br-sm shadow-lg shadow-brand-500/20'
                                    : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm shadow-sm'
                                }`}
                                whileHover={{ scale: 1.01 }}
                              >
                                {isImage ? (
                                  <img
                                    src={message.content}
                                    alt="Shared"
                                    className="rounded-lg max-w-full max-h-64 object-cover"
                                  />
                                ) : (
                                  <p className="whitespace-pre-wrap break-words text-[15px]">{message.content}</p>
                                )}
                              </motion.div>
                              {!isOwn && <MessageReactions reactions={message.reactions} isOwn={isOwn} />}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 px-1">
                              <span className="text-xs text-gray-400">
                                {formatDistanceToNow(new Date(message.createdDate), { addSuffix: true })}
                              </span>
                              {isOwn && (
                                <span className="flex items-center gap-0.5">
                                  {message.read ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5 text-gray-400" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                    
                    {/* Typing indicator - wired up to socket events in future */}
                    {/* {isTyping && <TypingIndicator />} */}
                    
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Message Input */}
              <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    id="chat-photo-upload"
                    disabled={uploadingPhoto}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => document.getElementById('chat-photo-upload')?.click()}
                    disabled={uploadingPhoto}
                    className="text-gray-400 hover:text-white hover:bg-white/10 flex-shrink-0"
                  >
                    {uploadingPhoto ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ImageIcon className="w-5 h-5" />
                    )}
                  </Button>

                  <div className="flex-1 relative">
                    <Input
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                      placeholder="Type a message..."
                      className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 pr-10"
                      maxLength={1000}
                    />
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      <Smile className="w-5 h-5" />
                    </button>
                  </div>

                  <Button
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() || sendMutation.isPending}
                    className="bg-gradient-to-r from-brand-800 to-brand-900 hover:from-brand-900 hover:to-[#8D2B0B] flex-shrink-0"
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            /* Empty state for desktop when no chat selected */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
                  <MessageSquare className="w-12 h-12 text-gray-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Messages</h2>
                <p className="text-gray-500 max-w-sm">
                  Select a conversation from the list to start chatting
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Info Panel Overlay */}
      <AnimatePresence>
        {showUserInfo && otherUser && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUserInfo(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            {/* Panel */}
            <UserInfoPanel user={otherUser} onClose={() => setShowUserInfo(false)} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
