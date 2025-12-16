import { useState, useEffect, useRef, ChangeEvent, KeyboardEvent, Fragment } from "react";
import { authService, messagesService, requestsService, uploadService } from "@/api/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft, 
  Send, 
  Image as ImageIcon, 
  CheckCircle,
  Loader2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { User, Message, Request } from "@/types";

interface SendMessageData {
  message: string;
}

export default function Chat() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const urlParams = new URLSearchParams(window.location.search);
  const otherUserId = urlParams.get('userId');
  const requestId = urlParams.get('requestId');

  const [messageText, setMessageText] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // All hooks must be called before any conditional returns
  const { data: currentUserData, isLoading: loadingCurrentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => authService.getCurrentUser(),
  });

  const currentUser = currentUserData?.user;

  const { data: conversationData, isLoading } = useQuery({
    queryKey: ['conversation', otherUserId],
    queryFn: () => messagesService.getConversation(otherUserId!),
    enabled: !!currentUser && !!otherUserId,
    refetchInterval: 3000,
  });

  const messages: Message[] = conversationData?.messages || [];
  const otherUserInfo: User | null = conversationData?.otherUser || null;

  const { data: requestData } = useQuery({
    queryKey: ['request', requestId],
    queryFn: () => requestsService.getById(requestId as string),
    enabled: !!requestId,
  });

  const request: Request | null = requestData?.request || null;

  useEffect(() => {
    if (!currentUser || !otherUserId) return;

    messagesService.markConversationAsRead(otherUserId)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['conversation', otherUserId] });
      })
      .catch(err => console.error('Failed to mark conversation as read:', err));
  }, [otherUserId, currentUser, queryClient]);

  const sendMessageMutation = useMutation({
    mutationFn: async (data: SendMessageData) => {
      return messagesService.send({
        recipientId: otherUserId,
        content: data.message,
        requestId: requestId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', otherUserId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setMessageText("");
    },
    onError: (error) => {
      console.error('Failed to send message:', error);
    }
  });

  const handleSendMessage = () => {
    if (!messageText.trim() || !currentUser) return;
    sendMessageMutation.mutate({ message: messageText });
  };

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !currentUser || !otherUserId) return;

    setUploadingPhoto(true);
    try {
      let fileUrls: string[] = [];

      if (files.length === 1) {
        const result = await uploadService.uploadFile(files[0]);
        const singleUrl = result?.data?.fileUrl;
        if (singleUrl) fileUrls.push(singleUrl);
      } else {
        const result = await uploadService.uploadFiles(files);
        const uploadedFiles = result?.data?.files || [];
        fileUrls = uploadedFiles
          .map((file: { fileUrl?: string }) => file.fileUrl)
          .filter(Boolean) as string[];
      }

      for (const url of fileUrls) {
        await messagesService.send({
          recipientId: otherUserId,
          content: url,
        });
      }

      if (fileUrls.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['conversation', otherUserId] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
    } catch (error) {
      console.error('Error uploading photo(s):', error);
    } finally {
      setUploadingPhoto(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleStartTransaction = () => {
    if (currentUser && request) {
      const isRequestOwner = currentUser.id === request.seekerId;
      
      if (isRequestOwner) {
        navigate(`/StartTransaction?requestId=${requestId}&helperId=${otherUserId}&seekerId=${currentUser.id}`);
      } else {
        navigate(`/StartTransaction?requestId=${requestId}&helperId=${currentUser.id}&seekerId=${request.seekerId}`);
      }
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSendMessage();
    }
  };

  if (loadingCurrentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-800" />
      </div>
    );
  }

  if (!otherUserId || !currentUser || otherUserId === currentUser.id) {
    if (import.meta.env.DEV) {
      console.error('Chat validation failed - otherUserId:', otherUserId, 'currentUserId:', currentUser?.id);
    }
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-gray-600 mb-4">
            {!otherUserId ? "Invalid conversation - missing user ID in URL" : "Cannot chat with yourself"}
          </p>
          {import.meta.env.DEV && (
            <p className="text-sm text-gray-500 mb-4">
              Debug: URL = {window.location.href}<br />
              otherUserId = {otherUserId || 'null'}, currentUserId = {currentUser?.id || 'null'}
            </p>
          )}
          <Button onClick={() => navigate("/Messages")}>
            Back to Messages
          </Button>
        </div>
      </div>
    );
  }

  // Check if message content is an image URL
  const isImageMessage = (content: string): boolean => {
    return /^https?:\/\/.*\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(content);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 flex flex-col">
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/Messages")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>

            {otherUserInfo ? (
              <Fragment>
                <Avatar className="w-10 h-10">
                  <AvatarImage src={otherUserInfo.avatar || undefined} />
                  <AvatarFallback className="bg-orange-100 text-brand-800">
                    {otherUserInfo.name?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold">{otherUserInfo.name || 'User'}</p>
                  <p className="text-xs text-gray-500">Active</p>
                </div>
              </Fragment>
            ) : (
              <div className="flex-1">
                <p className="font-semibold text-gray-400">Loading conversation...</p>
              </div>
            )}
          </div>

          {request && (
            <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-sm font-medium text-gray-900">About: {request.title}</p>
              <p className="text-xs text-gray-600 mt-1 line-clamp-1">{request.description}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-brand-800" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(() => {
                const items: JSX.Element[] = [];

                for (let i = 0; i < messages.length; i++) {
                  const message = messages[i];
                  const isOwnMessage = message.senderId === currentUser?.id;
                  const previous = i > 0 ? messages[i - 1] : null;
                  const showAvatar = !previous || previous.senderId !== message.senderId;
                  const msgIsImage = isImageMessage(message.content);

                  // Group consecutive image messages from the same sender
                  if (msgIsImage) {
                    const group: Message[] = [message];
                    let j = i + 1;
                    while (
                      j < messages.length &&
                      messages[j].senderId === message.senderId &&
                      isImageMessage(messages[j].content)
                    ) {
                      group.push(messages[j]);
                      j++;
                    }

                    if (group.length > 1) {
                      const groupKey = group.map((m) => m.id).join('-');
                      const lastMessageInGroup = group[group.length - 1];

                      items.push(
                        <div
                          key={groupKey}
                          className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                        >
                          {showAvatar ? (
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={isOwnMessage ? currentUser?.avatar || undefined : otherUserInfo?.avatar || undefined} />
                              <AvatarFallback className={isOwnMessage ? 'bg-brand-800 text-white' : 'bg-gray-200'}>
                                {isOwnMessage
                                  ? currentUser?.name?.[0]?.toUpperCase()
                                  : otherUserInfo?.name?.[0]?.toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="w-8" />
                          )}

                          <div className={`flex-1 max-w-md ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                            <div
                              className={`rounded-2xl px-4 py-2 ${
                                isOwnMessage
                                  ? 'bg-brand-800 text-white rounded-br-none'
                                  : 'bg-white border rounded-bl-none'
                              }`}
                            >
                              <div className="grid grid-cols-2 gap-2">
                                {group.map((imgMessage) => (
                                  <img
                                    key={imgMessage.id}
                                    src={imgMessage.content}
                                    alt="Shared image"
                                    className="rounded-lg max-w-xs max-h-64 object-cover"
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 px-2">
                              {formatDistanceToNow(new Date(lastMessageInGroup.createdDate), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      );

                      i = j - 1;
                      continue;
                    }
                  }

                  // Single message (text or single image)
                  items.push(
                    <div
                      key={message.id}
                      className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                    >
                      {showAvatar ? (
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={isOwnMessage ? currentUser?.avatar || undefined : otherUserInfo?.avatar || undefined} />
                          <AvatarFallback className={isOwnMessage ? 'bg-brand-800 text-white' : 'bg-gray-200'}>
                            {isOwnMessage
                              ? currentUser?.name?.[0]?.toUpperCase()
                              : otherUserInfo?.name?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-8" />
                      )}

                      <div className={`flex-1 max-w-md ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                        <div
                          className={`rounded-2xl px-4 py-2 ${
                            isOwnMessage
                              ? 'bg-brand-800 text-white rounded-br-none'
                              : 'bg-white border rounded-bl-none'
                          }`}
                        >
                          {msgIsImage ? (
                            <img
                              src={message.content}
                              alt="Shared image"
                              className="rounded-lg max-w-xs max-h-64 object-cover"
                            />
                          ) : (
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 px-2">
                          {formatDistanceToNow(new Date(message.createdDate), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                }

                return items;
              })()}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {request && request.status === 'ACTIVE' && (
        <div className="bg-green-50 border-t border-green-200 py-3">
          <div className="max-w-4xl mx-auto px-4">
            <Button
              onClick={handleStartTransaction}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Start Transaction
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white border-t shadow-lg sticky bottom-0">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex gap-3">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
              id="photo-upload"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => document.getElementById('photo-upload')?.click()}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ImageIcon className="w-5 h-5" />
              )}
            </Button>

            <Input
              value={messageText}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1"
              maxLength={1000}
            />

            <Button
              onClick={handleSendMessage}
              disabled={!messageText.trim() || sendMessageMutation.isPending || !currentUser}
              className="bg-brand-800 hover:bg-brand-900"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
