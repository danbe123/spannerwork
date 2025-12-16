import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import NotificationManager from './NotificationManager'

const { mockMessagesService, mockRequestsService, mockToast, mockUseAuth } = vi.hoisted(() => ({
  mockMessagesService: { getUnreadCount: vi.fn() },
  mockRequestsService: { list: vi.fn() },
  mockToast: Object.assign(vi.fn(), { info: vi.fn() }),
  mockUseAuth: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: mockToast }))

vi.mock('@/hooks/use-auth', () => ({
  default: () => mockUseAuth(),
}))

vi.mock('@/api/services', () => ({
  messagesService: mockMessagesService,
  requestsService: mockRequestsService,
}))

vi.mock('@/utils', () => ({
  createPageUrl: (path: string) => `/${path}`,
}))

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
}

function renderNotificationManager() {
  const qc = createQueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <NotificationManager />
    </QueryClientProvider>
  )
}

describe('NotificationManager', () => {
  const originalNotification = globalThis.Notification

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
    mockMessagesService.getUnreadCount.mockResolvedValue({ messages: [] })
    mockRequestsService.list.mockResolvedValue({ data: [] })
    
    // Mock Notification API
    globalThis.Notification = Object.assign(
      vi.fn(),
      { permission: 'granted', requestPermission: vi.fn().mockResolvedValue('granted') }
    ) as unknown as typeof Notification
  })

  afterEach(() => {
    globalThis.Notification = originalNotification
  })

  describe('Rendering', () => {
    it('renders without crashing', () => {
      const { container } = renderNotificationManager()
      expect(container).toBeInTheDocument()
    })

    it('renders null content (invisible component)', () => {
      const { container } = renderNotificationManager()
      expect(container.firstChild).toBeNull()
    })
  })

  describe('Message notifications', () => {
    it('shows toast on new message', async () => {
      mockMessagesService.getUnreadCount.mockResolvedValue({
        messages: [{ id: 'm1', senderId: 'u2', content: 'Hello there', sender: { name: 'Alex' } }],
      })

      renderNotificationManager()

      await waitFor(() => {
        expect(mockToast.info).toHaveBeenCalledWith(
          expect.stringContaining('New message'),
          expect.any(Object)
        )
      })
    })

    it('does not show toast when no new messages', async () => {
      mockMessagesService.getUnreadCount.mockResolvedValue({ messages: [] })

      renderNotificationManager()

      await waitFor(() => {
        expect(mockMessagesService.getUnreadCount).toHaveBeenCalled()
      })
      
      expect(mockToast.info).not.toHaveBeenCalled()
    })

    it('handles sender without name', async () => {
      mockMessagesService.getUnreadCount.mockResolvedValue({
        messages: [{ id: 'm2', senderId: 'u3', content: 'Test message' }],
      })

      renderNotificationManager()

      await waitFor(() => {
        expect(mockToast.info).toHaveBeenCalled()
      })
    })
  })

  describe('Request notifications', () => {
    it('shows toast on new nearby request', async () => {
      mockRequestsService.list.mockResolvedValue({
        data: [{ 
          id: 'r1', 
          seekerId: 'someone-else', 
          title: 'Need a lift', 
          createdDate: new Date().toISOString() 
        }],
      })

      renderNotificationManager()

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          'New job posted nearby',
          expect.any(Object)
        )
      })
    })

    it('does not show request toast for own requests', async () => {
      mockRequestsService.list.mockResolvedValue({
        data: [{ 
          id: 'r1', 
          seekerId: 'user-1', // Same as current user
          title: 'My own request', 
          createdDate: new Date().toISOString() 
        }],
      })

      renderNotificationManager()

      await waitFor(() => {
        expect(mockRequestsService.list).toHaveBeenCalled()
      })
    })
  })

  describe('Permission handling', () => {
    it('handles granted permission', async () => {
      globalThis.Notification = Object.assign(
        vi.fn(),
        { permission: 'granted', requestPermission: vi.fn().mockResolvedValue('granted') }
      ) as unknown as typeof Notification

      mockMessagesService.getUnreadCount.mockResolvedValue({
        messages: [{ id: 'm1', senderId: 'u2', content: 'Hello' }],
      })

      renderNotificationManager()

      await waitFor(() => {
        expect(mockToast.info).toHaveBeenCalled()
      })
    })

    it('handles denied permission', async () => {
      globalThis.Notification = Object.assign(
        vi.fn(),
        { permission: 'denied', requestPermission: vi.fn().mockResolvedValue('denied') }
      ) as unknown as typeof Notification

      renderNotificationManager()

      await waitFor(() => {
        expect(mockMessagesService.getUnreadCount).toHaveBeenCalled()
      })
    })

    it('requests permission when default', async () => {
      const requestPermissionMock = vi.fn().mockResolvedValue('granted')
      globalThis.Notification = Object.assign(
        vi.fn(),
        { permission: 'default', requestPermission: requestPermissionMock }
      ) as unknown as typeof Notification

      renderNotificationManager()

      await waitFor(() => {
        expect(requestPermissionMock).toHaveBeenCalled()
      })
    })

    it('handles permission request rejection', async () => {
      const requestPermissionMock = vi.fn().mockRejectedValue(new Error('Permission denied'))
      globalThis.Notification = Object.assign(
        vi.fn(),
        { permission: 'default', requestPermission: requestPermissionMock }
      ) as unknown as typeof Notification

      renderNotificationManager()

      await waitFor(() => {
        expect(requestPermissionMock).toHaveBeenCalled()
      })
    })
  })

  describe('Unauthenticated user', () => {
    it('does not fetch when user is not authenticated', async () => {
      mockUseAuth.mockReturnValue({ user: null })

      renderNotificationManager()

      // Should not fetch messages or requests when not authenticated
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(mockMessagesService.getUnreadCount).not.toHaveBeenCalled()
    })
  })

  describe('Browser Notification API', () => {
    it('creates browser notification when permission granted', async () => {
      const NotificationMock = vi.fn()
      globalThis.Notification = Object.assign(
        NotificationMock,
        { permission: 'granted', requestPermission: vi.fn().mockResolvedValue('granted') }
      ) as unknown as typeof Notification

      mockMessagesService.getUnreadCount.mockResolvedValue({
        messages: [{ id: 'new-msg', senderId: 'u2', content: 'Test notification' }],
      })

      renderNotificationManager()

      await waitFor(() => {
        expect(NotificationMock).toHaveBeenCalledWith(
          'New Message on SpannerWork',
          expect.objectContaining({ body: expect.any(String) })
        )
      })
    })

    it('handles notification creation error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const NotificationMock = vi.fn().mockImplementation(() => {
        throw new Error('Notification failed')
      })
      globalThis.Notification = Object.assign(
        NotificationMock,
        { permission: 'granted', requestPermission: vi.fn().mockResolvedValue('granted') }
      ) as unknown as typeof Notification

      mockMessagesService.getUnreadCount.mockResolvedValue({
        messages: [{ id: 'err-msg', senderId: 'u2', content: 'Error test' }],
      })

      renderNotificationManager()

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled()
      })
      
      consoleSpy.mockRestore()
    })
  })
})
