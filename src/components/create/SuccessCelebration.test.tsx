import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SuccessCelebration } from './SuccessCelebration';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: React.PropsWithChildren<{ className?: string }>) => (
      <div className={className} {...props}>{children}</div>
    ),
    h2: ({ children, className, ...props }: React.PropsWithChildren<{ className?: string }>) => (
      <h2 className={className} {...props}>{children}</h2>
    ),
    p: ({ children, className, ...props }: React.PropsWithChildren<{ className?: string }>) => (
      <p className={className} {...props}>{children}</p>
    ),
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

describe('SuccessCelebration', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onReset: vi.fn(),
    intent: 'need',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderWithRouter(ui: React.ReactElement) {
    return render(
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    );
  }

  describe('Visibility', () => {
    it('renders when isOpen is true', () => {
      renderWithRouter(<SuccessCelebration {...defaultProps} />);
      
      expect(screen.getByText('Job Posted!')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      renderWithRouter(<SuccessCelebration {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('Job Posted!')).not.toBeInTheDocument();
    });
  });

  describe('Need intent rendering', () => {
    it('shows Job Posted title for need intent', () => {
      renderWithRouter(<SuccessCelebration {...defaultProps} intent="need" />);
      
      expect(screen.getByText('Job Posted!')).toBeInTheDocument();
    });

    it('shows appropriate subtitle for need intent', () => {
      renderWithRouter(<SuccessCelebration {...defaultProps} intent="need" />);
      
      expect(screen.getByText(/Your job is now live/)).toBeInTheDocument();
    });

    it('shows View Feed button for need intent', () => {
      renderWithRouter(<SuccessCelebration {...defaultProps} intent="need" />);
      
      expect(screen.getByText('View Feed')).toBeInTheDocument();
    });
  });

  describe('Offer intent rendering', () => {
    it('shows Listing Created title for offer intent', () => {
      renderWithRouter(<SuccessCelebration {...defaultProps} intent="offer" />);
      
      expect(screen.getByText('Listing Created!')).toBeInTheDocument();
    });

    it('shows appropriate subtitle for offer intent', () => {
      renderWithRouter(<SuccessCelebration {...defaultProps} intent="offer" />);
      
      expect(screen.getByText(/Your listing is now visible/)).toBeInTheDocument();
    });

    it('shows View My Listings button for offer intent', () => {
      renderWithRouter(<SuccessCelebration {...defaultProps} intent="offer" />);
      
      expect(screen.getByText('View My Listings')).toBeInTheDocument();
    });
  });

  describe('Button actions', () => {
    it('navigates to feed when View Feed is clicked (need intent)', () => {
      renderWithRouter(<SuccessCelebration {...defaultProps} intent="need" />);
      
      fireEvent.click(screen.getByText('View Feed'));
      
      expect(mockNavigate).toHaveBeenCalledWith('/feed');
    });

    it('navigates to profile when View My Listings is clicked (offer intent)', () => {
      renderWithRouter(<SuccessCelebration {...defaultProps} intent="offer" />);
      
      fireEvent.click(screen.getByText('View My Listings'));
      
      expect(mockNavigate).toHaveBeenCalledWith('/profile');
    });

    it('calls onClose and onReset when Create Another is clicked', () => {
      const onClose = vi.fn();
      const onReset = vi.fn();
      
      renderWithRouter(
        <SuccessCelebration {...defaultProps} onClose={onClose} onReset={onReset} />
      );
      
      fireEvent.click(screen.getByText('Create Another'));
      
      expect(onClose).toHaveBeenCalled();
      expect(onReset).toHaveBeenCalled();
    });
  });

  describe('Info section', () => {
    it('displays Instant visibility text', () => {
      renderWithRouter(<SuccessCelebration {...defaultProps} />);
      
      expect(screen.getByText('Instant visibility')).toBeInTheDocument();
    });

    it('displays Local providers text', () => {
      renderWithRouter(<SuccessCelebration {...defaultProps} />);
      
      expect(screen.getByText('Local providers')).toBeInTheDocument();
    });

    it('displays Protected text', () => {
      renderWithRouter(<SuccessCelebration {...defaultProps} />);
      
      expect(screen.getByText('Protected')).toBeInTheDocument();
    });
  });

  describe('Confetti', () => {
    it('renders confetti particles', () => {
      const { container } = renderWithRouter(<SuccessCelebration {...defaultProps} />);
      
      // Check that confetti container exists
      const confettiContainer = container.querySelector('.overflow-hidden.pointer-events-none');
      expect(confettiContainer).toBeInTheDocument();
    });
  });

  describe('Create Another button', () => {
    it('renders Create Another button', () => {
      renderWithRouter(<SuccessCelebration {...defaultProps} />);
      
      expect(screen.getByText('Create Another')).toBeInTheDocument();
    });
  });
});
