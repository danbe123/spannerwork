/**
 * Messages - Completely Redesigned
 * 
 * Modern messaging interface with:
 * - Split-view on desktop (conversations + chat)
 * - Dark theme with glassmorphism
 * - Real-time typing indicators
 * - Online status
 * - Smooth animations
 * - Mobile-first responsive
 */

import { useState, useEffect, useRef, useMemo, ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { authService, messagesService, requestsService, uploadService } from "@/api/services";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Video,
  Info,
  Smile,
  Inbox,
  Sparkles,
  Zap
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

export default function Messages() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  
  // Get active chat from URL
  const activeUserId = searchParams.get('userId');
  const activeRequestId = searchParams.get('requestId');
  
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Get current user
  const { data: currentUserData } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => authService.getCurrentUser(),
  });
  const currentUser = currentUserData?.user;

  // Get conversations
  const { data: conversationsData, isLoading: loadingConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagesService.listConversations(),
    enabled: !!currentUser,
    refetchInterval: 10000, // Refresh every 10s
  });
  const conversations = (conversationsData?.conversations || []) as ExtendedConversation[];

  // Get active conversation messages
  const { data: conversationData, isLoading: loadingMessages } = useQuery({
    queryKey: ['conversation', activeUserId],
    queryFn: () => activeUserId ? messagesService.getConversation(activeUserId) : Promise.resolve({ messages: [], otherUser: {} as User }),
    enabled: !!currentUser && !!activeUserId,
    refetchInterval: 3000, // Refresh every 3s when chat is open
  });
  
  const messages: Message[] = conversationData?.messages || [];
  const otherUser = conversationData?.otherUser as ExtendedUser | undefined;

  // Get request info if available
  const { data: requestData } = useQuery({
    queryKey: ['request', activeRequestId],
    queryFn: async (): Promise<{ request: Request | undefined }> => 
      activeRequestId 
        ? requestsService.getById(activeRequestId) 
        : { request: undefined },
    enabled: !!activeRequestId,
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
    if (currentUser && activeUserId) {
      messagesService.markConversationAsRead(activeUserId)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        })
        .catch(console.error);
    }
  }, [activeUserId, currentUser, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
        // @ts-expect-error - types need alignment
        requestId: activeRequestId || undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', activeUserId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setMessageText("");
    },
  });

  const handleSendMessage = () => {
    if (!messageText.trim() || !activeUserId) return;
    sendMutation.mutate(messageText);
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
        // @ts-expect-error - types need alignment
        requestId: activeRequestId || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['conversation', activeUserId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (error) {
      console.error('Upload failed:', error);
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

  // Check if message is an image
  const isImageMessage = (content: string) => {
    return typeof content === 'string' && 
           /^https?:\/\/.*\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(content);
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <SEO title="Messages - SpannerWork" description="Your conversations on SpannerWork" />

      {/* Desktop: Split view | Mobile: List or Chat */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversations List */}
        <div className={`
          ${activeUserId ? 'hidden md:flex' : 'flex'} 
          flex-col w-full md:w-96 border-r border-gray-200 bg-white
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
                  // @ts-expect-error - userId exists on conversation in practice
                  const userId = conv.userId || conv.participant?.id;
                  const isActive = userId === activeUserId;
                  const isFromMe = conv.lastMessage?.senderId === currentUser?.id;
                  
                  return (
                    <motion.button
                      key={userId}
                      variants={listItemVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      transition={{ delay: index * 0.05 }}
                      onClick={() => userId && selectConversation(userId, conv.request?.id)}
                      className={`w-full p-4 flex items-center gap-3 transition-all border-b border-gray-100 ${
                        isActive 
                          ? 'bg-orange-50 border-l-2 border-l-brand-800' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="relative">
                        <Avatar className="w-12 h-12 border-2 border-white/10">
                          <AvatarImage src={conv.user?.avatar || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-orange-100 to-orange-200 text-brand-800">
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
                    <AvatarFallback className="bg-gradient-to-br from-orange-100 to-orange-200 text-brand-800">
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
                    <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
                      <Phone className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
                      <Video className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
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
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                      const showAvatar = index === 0 || messages[index - 1]?.senderId !== message.senderId;
                      
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
                                    ? 'bg-gradient-to-br from-brand-800 to-brand-900 text-white rounded-br-sm shadow-lg shadow-orange-500/20' 
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
              <div className="p-4 border-t border-gray-200 bg-white">
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
    </div>
  );
}
