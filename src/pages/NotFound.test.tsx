import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from './NotFound';

describe('NotFound Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderWithRouter(initialRoute = '/not-found') {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <NotFound />
      </MemoryRouter>
    );
  }

  describe('Rendering', () => {
    it('renders the 404 text', () => {
      renderWithRouter();
      expect(screen.getByText('404')).toBeInTheDocument();
    });

    it('renders the Page Not Found heading', () => {
      renderWithRouter();
      expect(screen.getByText('Page Not Found')).toBeInTheDocument();
    });

    it('renders the description text', () => {
      renderWithRouter();
      expect(screen.getByText(/Sorry, we couldn't find the page/)).toBeInTheDocument();
    });

    it('renders the help text', () => {
      renderWithRouter();
      expect(screen.getByText(/Need help\?/)).toBeInTheDocument();
    });
  });

  describe('Navigation buttons', () => {
    it('renders Go Home button', () => {
      renderWithRouter();
      expect(screen.getByText('Go Home')).toBeInTheDocument();
    });

    it('renders Go Back button', () => {
      renderWithRouter();
      expect(screen.getByText('Go Back')).toBeInTheDocument();
    });

    it('renders Browse Feed button', () => {
      renderWithRouter();
      expect(screen.getByText('Browse Feed')).toBeInTheDocument();
    });

    it('Go Home links to root', () => {
      renderWithRouter();
      const homeLink = screen.getByText('Go Home').closest('a');
      expect(homeLink).toHaveAttribute('href', '/');
    });

    it('Browse Feed links to /feed', () => {
      renderWithRouter();
      const feedLink = screen.getByText('Browse Feed').closest('a');
      expect(feedLink).toHaveAttribute('href', '/feed');
    });
  });

  describe('Go Back functionality', () => {
    it('calls history.back when Go Back is clicked', () => {
      const mockBack = vi.spyOn(window.history, 'back').mockImplementation(() => {});
      
      renderWithRouter();
      const backButton = screen.getByText('Go Back');
      fireEvent.click(backButton);
      
      expect(mockBack).toHaveBeenCalled();
      mockBack.mockRestore();
    });
  });

  describe('Contact link', () => {
    it('renders contact support link', () => {
      renderWithRouter();
      expect(screen.getByText('Contact our support team')).toBeInTheDocument();
    });

    it('contact link points to /contact', () => {
      renderWithRouter();
      const contactLink = screen.getByText('Contact our support team');
      expect(contactLink).toHaveAttribute('href', '/contact');
    });
  });

  describe('Icons', () => {
    it('renders all navigation icons', () => {
      const { container } = renderWithRouter();
      // Check for SVG icons (Home, ArrowLeft, Search)
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThanOrEqual(3);
    });
  });
});
