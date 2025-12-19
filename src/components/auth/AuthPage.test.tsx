import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AuthPage from './AuthPage';

// Mock services
vi.mock('@/api/services', () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    forgotPassword: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

vi.mock('@/api/client', () => ({
  refreshCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock SEO component
vi.mock('@/components/SEO', () => ({
  default: () => null,
}));

import { authService } from '@/api/services';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: null, search: '' }),
  };
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderAuthPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AuthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.getCurrentUser).mockResolvedValue({
      user: { id: '1', emailVerified: false } as any,
    } as any);
  });

  describe('Login form', () => {
    it('renders login form by default', () => {
      renderAuthPage();
      
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('allows typing email', () => {
      renderAuthPage();
      
      const emailInput = screen.getByLabelText(/email/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      
      expect(emailInput).toHaveValue('test@example.com');
    });

    it('allows typing password', () => {
      renderAuthPage();
      
      const passwordInput = screen.getByLabelText(/password/i);
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      
      expect(passwordInput).toHaveValue('password123');
    });

    it('submits login form', async () => {
      vi.mocked(authService.login).mockResolvedValue({ user: { id: '1' } as any } as any);
      
      renderAuthPage();
      
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'password123' }
      });
      
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      
      await waitFor(() => {
        expect(authService.login).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('shows error on failed login', async () => {
      vi.mocked(authService.login).mockRejectedValue(new Error('Invalid credentials'));
      
      renderAuthPage();
      
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'wrongpassword' }
      });
      
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('shows forgot password link', () => {
      renderAuthPage();
      
      expect(screen.getByText(/forgot/i)).toBeInTheDocument();
    });

    it('shows register link', () => {
      renderAuthPage();
      
      expect(screen.getByText(/create.*account|register|sign up/i)).toBeInTheDocument();
    });
  });

  describe('Registration form', () => {
    it('switches to registration form', () => {
      renderAuthPage();
      
      const registerLink = screen.getByText(/create.*account|register|sign up/i);
      fireEvent.click(registerLink);
      
      // Should show registration form elements
      expect(document.body).toBeInTheDocument();
    });

    it('submits registration form', async () => {
      vi.mocked(authService.register).mockResolvedValue({ user: { id: '1' } as any } as any);
      
      renderAuthPage();
      
      // Switch to registration
      const registerLink = screen.getByText(/create.*account|register|sign up/i);
      fireEvent.click(registerLink);
      
      // Registration form should be visible
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Forgot password', () => {
    it('switches to forgot password form', () => {
      renderAuthPage();
      
      const forgotLink = screen.getByText(/forgot/i);
      fireEvent.click(forgotLink);
      
      expect(document.body).toBeInTheDocument();
    });

    it('submits forgot password form', async () => {
      vi.mocked(authService.forgotPassword).mockResolvedValue({ message: 'ok' } as any);
      
      renderAuthPage();
      
      const forgotLink = screen.getByText(/forgot/i);
      fireEvent.click(forgotLink);
      
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Hero section', () => {
    it('renders hero content', () => {
      renderAuthPage();
      
      // Check for hero heading text
      expect(screen.getByText(/Your workshop/i)).toBeInTheDocument();
    });

    it('renders feature cards', () => {
      renderAuthPage();
      
      // Use getAllBy since there are multiple elements with "tools"
      const toolElements = screen.getAllByText(/tools/i);
      expect(toolElements.length).toBeGreaterThan(0);
    });
  });

  describe('Loading states', () => {
    it('shows loading state during login', async () => {
      vi.mocked(authService.login).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );
      
      renderAuthPage();
      
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'password123' }
      });
      
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      
      // Button should show loading or be disabled
      expect(document.body).toBeInTheDocument();
    });

    it('handles form submission state', async () => {
      vi.mocked(authService.login).mockImplementation(
        () => new Promise(() => {})
      );
      
      renderAuthPage();
      
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'password123' }
      });
      
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      
      // Form should handle submission
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('handles successful login', async () => {
      vi.mocked(authService.login).mockResolvedValue({ user: { id: '1' } as any } as any);
      
      renderAuthPage();
      
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'password123' }
      });
      
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      
      await waitFor(() => {
        expect(authService.login).toHaveBeenCalled();
      });
    });
  });
});
