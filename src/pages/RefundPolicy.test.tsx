import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RefundPolicy from './RefundPolicy';

// Mock SEO
vi.mock('@/components/SEO', () => ({
  default: () => null,
}));

function renderRefundPolicy() {
  return render(
    <MemoryRouter>
      <RefundPolicy />
    </MemoryRouter>
  );
}

describe('RefundPolicy Page', () => {
  describe('Rendering', () => {
    it('renders page', () => {
      renderRefundPolicy();
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Content sections', () => {
    it('renders cancellation scenarios', () => {
      renderRefundPolicy();
      expect(screen.getByText(/48\+ hours/i)).toBeInTheDocument();
    });

    it('renders 24-48 hour cancellation', () => {
      renderRefundPolicy();
      expect(screen.getByText(/24-48 hours/i)).toBeInTheDocument();
    });

    it('renders under 24 hour cancellation', () => {
      renderRefundPolicy();
      expect(screen.getByText(/under 24 hours/i)).toBeInTheDocument();
    });

    it('shows refund amounts', () => {
      renderRefundPolicy();
      const refundElements = screen.getAllByText(/refund/i);
      expect(refundElements.length).toBeGreaterThan(0);
    });
  });

  describe('Navigation', () => {
    it('has links', () => {
      renderRefundPolicy();
      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);
    });
  });
});
