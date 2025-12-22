import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Terms from './Terms';

// Mock navigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// Mock MarketingFooter
vi.mock('../components/MarketingFooter', () => ({
  default: () => <footer data-testid="marketing-footer">Footer</footer>,
}));

function renderTerms() {
  return render(
    <MemoryRouter>
      <Terms />
    </MemoryRouter>
  );
}

describe('Terms Page', () => {
  describe('Rendering', () => {
    it('renders page', () => {
      renderTerms();
      expect(document.body).toBeInTheDocument();
    });

    it('renders marketing footer', () => {
      renderTerms();
      expect(screen.getByTestId('marketing-footer')).toBeInTheDocument();
    });
  });

  describe('Content sections', () => {
    it('renders Acceptance of Terms section', () => {
      renderTerms();
      expect(screen.getByText(/Acceptance of Terms/i)).toBeInTheDocument();
    });

    it('renders Use of Service section', () => {
      renderTerms();
      expect(screen.getByText(/Use of Service/i)).toBeInTheDocument();
    });

    it('renders User Responsibilities section', () => {
      renderTerms();
      expect(screen.getByText(/User Responsibilities/i)).toBeInTheDocument();
    });

    it('renders Provider responsibilities', () => {
      renderTerms();
      expect(screen.getByText(/For Providers \(Tool Owners\/Service Providers\)/i)).toBeInTheDocument();
    });

    it('renders Renter responsibilities', () => {
      renderTerms();
      expect(screen.getByText(/For Renters/i)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('has back button', () => {
      renderTerms();
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
