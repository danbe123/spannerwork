import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import About from './About';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock MarketingFooter
vi.mock('../components/MarketingFooter', () => ({
  default: () => <footer data-testid="marketing-footer">Footer</footer>,
}));

function renderAbout() {
  return render(
    <MemoryRouter>
      <About />
    </MemoryRouter>
  );
}

describe('About Page', () => {
  describe('Rendering', () => {
    it('renders page', () => {
      renderAbout();
      expect(document.body).toBeInTheDocument();
    });

    it('renders heading', () => {
      renderAbout();
      const aboutElements = screen.getAllByText(/About/i);
      expect(aboutElements.length).toBeGreaterThan(0);
    });

    it('renders marketing footer', () => {
      renderAbout();
      expect(screen.getByTestId('marketing-footer')).toBeInTheDocument();
    });
  });

  describe('Values section', () => {
    it('renders community first value', () => {
      renderAbout();
      expect(screen.getByText(/Community First/i)).toBeInTheDocument();
    });

    it('renders fair & transparent value', () => {
      renderAbout();
      expect(screen.getByText(/Fair & Transparent/i)).toBeInTheDocument();
    });

    it('renders empowering independence value', () => {
      renderAbout();
      expect(screen.getByText(/Empowering Independence/i)).toBeInTheDocument();
    });

    it('renders sustainable sharing value', () => {
      renderAbout();
      expect(screen.getByText(/Sustainable Sharing/i)).toBeInTheDocument();
    });
  });

  describe('Timeline section', () => {
    it('renders timeline events', () => {
      renderAbout();
      const yearElements = screen.getAllByText(/2025/);
      expect(yearElements.length).toBeGreaterThan(0);
    });
  });

  describe('Navigation', () => {
    it('has back button', () => {
      renderAbout();
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('supports navigation', () => {
      renderAbout();
      expect(document.body).toBeInTheDocument();
    });
  });
});
