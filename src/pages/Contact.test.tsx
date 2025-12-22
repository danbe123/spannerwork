import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Contact from './Contact';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock services with hoisted mocks for better control
const { mockSubmitContactForm } = vi.hoisted(() => ({
  mockSubmitContactForm: vi.fn(),
}));

vi.mock('@/api/services', () => ({
  contactService: {
    submitContactForm: mockSubmitContactForm,
  },
}));

// Mock MarketingFooter
vi.mock('../components/MarketingFooter', () => ({
  default: () => <footer data-testid="marketing-footer">Footer</footer>,
}));

function renderContact() {
  return render(
    <MemoryRouter>
      <Contact />
    </MemoryRouter>
  );
}

describe('Contact Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmitContactForm.mockResolvedValue({ success: true });
  });

  describe('Rendering', () => {
    it('renders page', () => {
      renderContact();
      expect(document.body).toBeInTheDocument();
    });

    it('renders marketing footer', () => {
      renderContact();
      expect(screen.getByTestId('marketing-footer')).toBeInTheDocument();
    });
  });

  describe('Form fields', () => {
    it('renders name input', () => {
      renderContact();
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    });

    it('renders email input', () => {
      renderContact();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    it('renders subject input', () => {
      renderContact();
      expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
    });

    it('renders message textarea', () => {
      renderContact();
      expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    });
  });

  describe('Form interactions', () => {
    it('allows entering name', () => {
      renderContact();
      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: 'John Doe' } });
      expect(nameInput).toHaveValue('John Doe');
    });

    it('allows entering email', () => {
      renderContact();
      const emailInput = screen.getByLabelText(/email/i);
      fireEvent.change(emailInput, { target: { value: 'john@test.com' } });
      expect(emailInput).toHaveValue('john@test.com');
    });

    it('allows entering message', () => {
      renderContact();
      const messageInput = screen.getByLabelText(/message/i);
      fireEvent.change(messageInput, { target: { value: 'Test message' } });
      expect(messageInput).toHaveValue('Test message');
    });
  });

  describe('Form submission', () => {
    it('has submit button', () => {
      renderContact();
      const submitButton = screen.getByRole('button', { name: /send/i });
      expect(submitButton).toBeInTheDocument();
    });

    it('submits form and shows success message', async () => {
      renderContact();

      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'John Doe' } });
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@test.com' } });
      fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'Test Subject' } });
      fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Test message' } });

      const form = document.querySelector('form');
      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          expect(mockSubmitContactForm).toHaveBeenCalledWith({
            name: 'John Doe',
            email: 'john@test.com',
            subject: 'Test Subject',
            message: 'Test message',
          });
        });

        // Success message should appear
        await waitFor(() => {
          expect(screen.getByText(/message sent/i)).toBeInTheDocument();
        });
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
        expect(screen.getByText(/john@test.com/i)).toBeInTheDocument();
      }
    });

    it('shows error message when submission fails', async () => {
      mockSubmitContactForm.mockRejectedValueOnce(new Error('Network error'));
      renderContact();

      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'Subject' } });
      fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Message' } });

      const form = document.querySelector('form');
      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          expect(screen.getByText(/failed to send message/i)).toBeInTheDocument();
        });
      }
    });

    it('allows sending another message after success', async () => {
      renderContact();

      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'Subject' } });
      fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Message' } });

      const form = document.querySelector('form');
      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          expect(screen.getByText(/message sent/i)).toBeInTheDocument();
        });

        // Click "Send Another Message"
        fireEvent.click(screen.getByRole('button', { name: /send another message/i }));

        // Form should be visible again with empty fields
        await waitFor(() => {
          expect(screen.getByLabelText(/name/i)).toHaveValue('');
        });
      }
    });
  });

  describe('Navigation', () => {
    it('navigates back to home when back button clicked', () => {
      renderContact();
      const backButton = screen.getByRole('button', { name: /back to home/i });
      fireEvent.click(backButton);
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('navigates to resources page', () => {
      renderContact();
      const resourcesButton = screen.getByRole('button', { name: /view resources/i });
      fireEvent.click(resourcesButton);
      expect(mockNavigate).toHaveBeenCalledWith('/resources');
    });

    it('navigates home after success via Back to Home button', async () => {
      renderContact();

      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'Subject' } });
      fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Message' } });

      const form = document.querySelector('form');
      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          expect(screen.getByText(/message sent/i)).toBeInTheDocument();
        });

        // Click Back to Home in success state
        const homeButtons = screen.getAllByRole('button', { name: /back to home/i });
        fireEvent.click(homeButtons[homeButtons.length - 1]);
        expect(mockNavigate).toHaveBeenCalledWith('/');
      }
    });
  });
});
