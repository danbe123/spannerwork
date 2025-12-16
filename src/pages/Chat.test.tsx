import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Chat from './Chat';

// Mock services
const mockGetCurrentUser = vi.fn();
const mockGetConversation = vi.fn();
const mockMarkAsRead = vi.fn();
const mockSend = vi.fn();
const mockGetById = vi.fn();
const mockUploadFile = vi.fn();
const mockUploadFiles = vi.fn();

vi.mock('@/api/services', () => ({
  authService: {
    getCurrentUser: () => mockGetCurrentUser(),
  },
  messagesService: {
    getConversation: (userId: string) => mockGetConversation(userId),
    markConversationAsRead: (userId: string) => mockMarkAsRead(userId),
    send: (data: unknown) => mockSend(data),
  },
  requestsService: {
    getById: (id: string) => mockGetById(id),
  },
  uploadService: {
    uploadFile: (file: File) => mockUploadFile(file),
    uploadFiles: (files: File[]) => mockUploadFiles(files),
  },
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function setUrl(url: string) {
  window.history.pushState({}, '', url);
}

function renderChat(route = '/chat?userId=user-2') {
  setUrl(route);

  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Chat />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

describe('Chat Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockGetCurrentUser.mockResolvedValue({
      user: { id: 'user-1', name: 'Current User', email: 'current@test.com' },
    });
    
    mockGetConversation.mockResolvedValue({
      messages: [
        { id: 'msg-1', senderId: 'user-1', recipientId: 'user-2', content: 'Hello', createdDate: new Date().toISOString() },
        { id: 'msg-2', senderId: 'user-2', recipientId: 'user-1', content: 'Hi there', createdDate: new Date().toISOString() },
      ],
      otherUser: { id: 'user-2', name: 'Other User', email: 'other@test.com' },
    });
    
    mockMarkAsRead.mockResolvedValue({});
    mockSend.mockResolvedValue({ message: { id: 'new-msg' } });
    mockGetById.mockResolvedValue({ request: null });
    mockUploadFile.mockResolvedValue({ data: { fileUrl: 'https://example.com/photo.jpg' } });
    mockUploadFiles.mockResolvedValue({
      data: {
        files: [{ fileUrl: 'https://example.com/a.jpg' }, { fileUrl: 'https://example.com/b.jpg' }],
      },
    });
  });

  it('shows validation error when missing userId and navigates back to Messages', async () => {
    const user = userEvent.setup();
    renderChat('/chat');

    expect(await screen.findByText(/Invalid conversation - missing user ID in URL/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /back to messages/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/Messages');
  });

  it('shows validation error when attempting to chat with yourself', async () => {
    mockGetCurrentUser.mockResolvedValue({
      user: { id: 'user-2', name: 'Current User', email: 'current@test.com' },
    });

    renderChat('/chat?userId=user-2');
    expect(await screen.findByText(/Cannot chat with yourself/i)).toBeInTheDocument();
  });

  it('fetches conversation and marks as read when userId is present', async () => {
    renderChat('/chat?userId=user-2');

    await waitFor(() => {
      expect(mockGetConversation).toHaveBeenCalledWith('user-2');
      expect(mockMarkAsRead).toHaveBeenCalledWith('user-2');
    });
  });

  it('sends a message on button click and clears the input', async () => {
    const user = userEvent.setup();
    renderChat('/chat?userId=user-2');

    await screen.findByText('Hello');

    const input = screen.getByPlaceholderText(/type a message/i);
    await user.type(input, 'Test message');

    const sendIcon = document.querySelector('svg.lucide-send');
    const sendButton = sendIcon?.closest('button');
    if (!sendButton) throw new Error('Send button not found');
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith({
        recipientId: 'user-2',
        content: 'Test message',
        requestId: undefined,
      });
    });

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe('');
    });
  });

  it('sends a message when pressing Enter', async () => {
    const user = userEvent.setup();
    renderChat('/chat?userId=user-2');
    await screen.findByText('Hello');

    const input = screen.getByPlaceholderText(/type a message/i);
    await user.type(input, 'Enter message{enter}');

    await waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith({
        recipientId: 'user-2',
        content: 'Enter message',
        requestId: undefined,
      });
    });
  });

  it('uploads a single photo and sends it as a message', async () => {
    const user = userEvent.setup();
    renderChat('/chat?userId=user-2');
    await screen.findByText('Hello');

    const fileInput = document.getElementById('photo-upload') as HTMLInputElement;
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });

    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(mockUploadFile).toHaveBeenCalledWith(file);
    });

    await waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith({
        recipientId: 'user-2',
        content: 'https://example.com/photo.jpg',
      });
    });
  });

  it('uploads multiple photos and sends each as a message', async () => {
    const user = userEvent.setup();
    renderChat('/chat?userId=user-2');
    await screen.findByText('Hello');

    const fileInput = document.getElementById('photo-upload') as HTMLInputElement;
    const a = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    const b = new File(['b'], 'b.jpg', { type: 'image/jpeg' });

    await user.upload(fileInput, [a, b]);

    await waitFor(() => {
      expect(mockUploadFiles).toHaveBeenCalledWith([a, b]);
    });

    await waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith({ recipientId: 'user-2', content: 'https://example.com/a.jpg' });
      expect(mockSend).toHaveBeenCalledWith({ recipientId: 'user-2', content: 'https://example.com/b.jpg' });
    });
  });

  it('fetches request when requestId is present and starts transaction (request owner branch)', async () => {
    const user = userEvent.setup();
    mockGetById.mockResolvedValue({
      request: {
        id: 'req-1',
        title: 'Need help',
        description: 'Fix my car',
        status: 'ACTIVE',
        seekerId: 'user-1',
      },
    });

    renderChat('/chat?userId=user-2&requestId=req-1');
    expect(await screen.findByText(/About: Need help/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /start transaction/i }));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/StartTransaction?requestId=req-1&helperId=user-2&seekerId=user-1'
    );
  });

  it('starts transaction (helper branch when current user is not request owner)', async () => {
    const user = userEvent.setup();
    mockGetById.mockResolvedValue({
      request: {
        id: 'req-1',
        title: 'Need help',
        description: 'Fix my car',
        status: 'ACTIVE',
        seekerId: 'user-3',
      },
    });

    renderChat('/chat?userId=user-2&requestId=req-1');
    expect(await screen.findByText(/About: Need help/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /start transaction/i }));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/StartTransaction?requestId=req-1&helperId=user-1&seekerId=user-3'
    );
  });
});
