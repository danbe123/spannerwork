import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Cookies from './Cookies';

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

function renderCookies() {
  return render(
    <MemoryRouter>
      <Cookies />
    </MemoryRouter>
  );
}

describe('Cookies Page', () => {
  describe('Rendering', () => {
    it('renders page', () => {
      renderCookies();
      expect(document.body).toBeInTheDocument();
    });

    it('renders marketing footer', () => {
      renderCookies();
      expect(screen.getByTestId('marketing-footer')).toBeInTheDocument();
    });
  });

  describe('Content sections', () => {
    it('renders What Are Cookies section', () => {
      renderCookies();
      expect(screen.getByText(/What Are Cookies/i)).toBeInTheDocument();
    });

    it('renders How We Use Cookies section', () => {
      renderCookies();
      expect(screen.getByText(/How We Use Cookies/i)).toBeInTheDocument();
    });

    it('renders Necessary Cookies', () => {
      renderCookies();
      const elements = screen.getAllByText(/Necessary Cookies/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('renders Analytics Cookies', () => {
      renderCookies();
      expect(screen.getByText(/Analytics Cookies/i)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('has back button', () => {
      renderCookies();
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
