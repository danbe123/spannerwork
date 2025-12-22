import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { messagesService, requestsService } from '@/api/services';
import useAuth from '@/hooks/use-auth';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Message, Request } from '@/types';
import { queryKeys } from '@/lib/queryKeys';

export default function NotificationManager() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(result => {
        setPermission(result);
      }).catch(() => {
        setPermission('denied');
      });
    }
  }, []);

  const { data: messagesData } = useQuery({
    queryKey: queryKeys.unreadMessages(),
    queryFn: () => messagesService.getUnreadCount(),
    enabled: !!currentUser,
    refetchInterval: 5000,
  });

  // @ts-expect-error - API returns messages array
  const messages: Message[] = messagesData?.messages || [];

  const { data: newRequestsData } = useQuery({
    queryKey: queryKeys.newRequests(),
    queryFn: () => requestsService.list({ status: 'ACTIVE', limit: 5 }),
    enabled: !!currentUser,
    refetchInterval: 30000,
  });

  const newRequests: Request[] = (newRequestsData?.data || [])
    .filter((r: Request) => r.seekerId !== currentUser?.id);

  useEffect(() => {
    if (messages.length > 0) {
      const latestMessage = messages[0];
      
      if (lastMessageId !== latestMessage.id) {
        setLastMessageId(latestMessage.id);
        
        if (typeof window !== 'undefined' && 'Notification' in window && permission === 'granted') {
          try {
            new Notification('New Message on SpannerWork', {
              body: latestMessage.content.substring(0, 100),
              icon: '/favicon.ico',
              tag: latestMessage.id,
            });
          } catch (error) {
            console.error('Failed to show notification:', error);
          }
        }

        const chatUrl = createPageUrl(
          `Chat?userId=${latestMessage.senderId}`
        );

        const senderName = latestMessage.sender?.name || 'Someone';
        toast.info(`New message from ${senderName}`, {
          description: latestMessage.content.substring(0, 50) + '...',
          action: {
            label: 'View',
            onClick: () => window.location.href = chatUrl
          }
        });
      }
    }
  }, [messages, permission, lastMessageId]);

  useEffect(() => {
    if (newRequests.length > 0) {
      const latestRequest = newRequests[0];
      
      if (lastRequestId !== latestRequest.id && 
          new Date(latestRequest.createdDate) > new Date(Date.now() - 60000)) {
        setLastRequestId(latestRequest.id);
        
        toast('New job posted nearby', {
          description: latestRequest.title,
          action: {
            label: 'View',
            onClick: () => window.location.href = createPageUrl(`RequestDetail?id=${latestRequest.id}`)
          }
        });
      }
    }
  }, [newRequests, lastRequestId]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && permission === 'default') {
      const timer = setTimeout(() => {
        toast('Enable notifications?', {
          description: 'Get notified of new messages and nearby jobs',
          action: {
            label: 'Enable',
            onClick: () => {
              Notification.requestPermission().then(result => {
                setPermission(result);
                if (result === 'granted') {
                  toast.success('Notifications enabled!');
                }
              }).catch(() => {
                setPermission('denied');
                toast.error('Notifications not available');
              });
            }
          }
        });
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [permission]);

  return null;
}
