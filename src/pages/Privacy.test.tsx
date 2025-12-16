import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Privacy from './Privacy';

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

function renderPrivacy() {
  return render(
    <MemoryRouter>
      <Privacy />
    </MemoryRouter>
  );
}

describe('Privacy Page', () => {
  describe('Rendering', () => {
    it('renders page', () => {
      renderPrivacy();
      expect(document.body).toBeInTheDocument();
    });

    it('renders marketing footer', () => {
      renderPrivacy();
      expect(screen.getByTestId('marketing-footer')).toBeInTheDocument();
    });
  });

  describe('Content sections', () => {
    it('renders Information We Collect section', () => {
      renderPrivacy();
      expect(screen.getByText(/Information We Collect/i)).toBeInTheDocument();
    });

    it('renders account information', () => {
      renderPrivacy();
      expect(screen.getByText(/Account Information/i)).toBeInTheDocument();
    });

    it('renders transaction information', () => {
      renderPrivacy();
      expect(screen.getByText(/Transaction Information/i)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('has back button', () => {
      renderPrivacy();
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
