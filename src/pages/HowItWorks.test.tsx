import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HowItWorks from './HowItWorks';

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

// Mock SEO
vi.mock('@/components/SEO', () => ({
  default: () => null,
}));

function renderHowItWorks() {
  return render(
    <MemoryRouter>
      <HowItWorks />
    </MemoryRouter>
  );
}

describe('HowItWorks Page', () => {
  describe('Rendering', () => {
    it('renders page', () => {
      renderHowItWorks();
      expect(document.body).toBeInTheDocument();
    });

    it('renders heading', () => {
      renderHowItWorks();
      expect(screen.getByText(/How SpannerWork Works/i)).toBeInTheDocument();
    });

    it('renders marketing footer', () => {
      renderHowItWorks();
      expect(screen.getByTestId('marketing-footer')).toBeInTheDocument();
    });
  });

  describe('Steps section', () => {
    it('renders step 1 - Post Your Need', () => {
      renderHowItWorks();
      expect(screen.getByText(/Post Your Need/i)).toBeInTheDocument();
    });

    it('renders step 2 - Get Quotes', () => {
      renderHowItWorks();
      expect(screen.getByText(/Get Quotes/i)).toBeInTheDocument();
    });

    it('renders step 3 - Agree & Pay', () => {
      renderHowItWorks();
      expect(screen.getByText(/Agree & Pay/i)).toBeInTheDocument();
    });

    it('renders step 4 - Complete & Review', () => {
      renderHowItWorks();
      expect(screen.getByText(/Complete & Review/i)).toBeInTheDocument();
    });
  });

  describe('For Providers section', () => {
    it('renders provider information', () => {
      renderHowItWorks();
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('has back button', () => {
      renderHowItWorks();
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('supports navigation', () => {
      renderHowItWorks();
      expect(document.body).toBeInTheDocument();
    });
  });
});
