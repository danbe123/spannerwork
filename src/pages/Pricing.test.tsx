import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Pricing from './Pricing';

// Mock SEO
vi.mock('@/components/SEO', () => ({
  default: () => null,
}));

function renderPricing() {
  return render(
    <MemoryRouter>
      <Pricing />
    </MemoryRouter>
  );
}

describe('Pricing Page', () => {
  describe('Rendering', () => {
    it('renders page', () => {
      renderPricing();
      expect(document.body).toBeInTheDocument();
    });

    it('renders pricing heading', () => {
      renderPricing();
      expect(screen.getByRole('heading', { name: /Simple, Transparent Pricing/i })).toBeInTheDocument();
    });
  });

  describe('Pricing tiers', () => {
    it('renders Seekers tier', () => {
      renderPricing();
      expect(screen.getByText(/Seekers/i)).toBeInTheDocument();
    });

    it('renders Providers tier', () => {
      renderPricing();
      const providerElements = screen.getAllByText(/Providers/i);
      expect(providerElements.length).toBeGreaterThan(0);
    });

    it('shows free pricing', () => {
      renderPricing();
      const freeElements = screen.getAllByText(/Free/i);
      expect(freeElements.length).toBeGreaterThan(0);
    });

    it('shows platform fee information', () => {
      renderPricing();
      const feeElements = screen.getAllByText(/platform fee/i);
      expect(feeElements.length).toBeGreaterThan(0);
    });
  });

  describe('Features list', () => {
    it('shows browse listings feature', () => {
      renderPricing();
      expect(screen.getByText(/Browse all listings/i)).toBeInTheDocument();
    });

    it('shows unlimited requests feature', () => {
      renderPricing();
      expect(screen.getByText(/Post unlimited requests/i)).toBeInTheDocument();
    });

    it('shows secure payments feature', () => {
      renderPricing();
      const secureElements = screen.getAllByText(/Secure payment/i);
      expect(secureElements.length).toBeGreaterThan(0);
    });
  });

  describe('CTA buttons', () => {
    it('has call to action buttons', () => {
      renderPricing();
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('shows Start Searching CTA', () => {
      renderPricing();
      expect(screen.getByText(/Start Searching/i)).toBeInTheDocument();
    });
  });

  describe('Links', () => {
    it('has navigation links', () => {
      renderPricing();
      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);
    });
  });
});
