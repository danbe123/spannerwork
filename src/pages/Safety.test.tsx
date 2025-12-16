import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Safety from './Safety';

// Mock SEO
vi.mock('@/components/SEO', () => ({
  default: () => null,
}));

function renderSafety() {
  return render(
    <MemoryRouter>
      <Safety />
    </MemoryRouter>
  );
}

describe('Safety Page', () => {
  describe('Rendering', () => {
    it('renders page', () => {
      renderSafety();
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Safety features', () => {
    it('renders Verified Users section', () => {
      renderSafety();
      expect(screen.getByText(/Verified Users/i)).toBeInTheDocument();
    });

    it('renders Secure Payments section', () => {
      renderSafety();
      expect(screen.getByText(/Secure Payments/i)).toBeInTheDocument();
    });

    it('renders In-App Messaging section', () => {
      renderSafety();
      expect(screen.getByRole('heading', { name: /In-App Messaging/i })).toBeInTheDocument();
    });

    it('renders Data Protection section', () => {
      renderSafety();
      expect(screen.getByText(/Data Protection/i)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('has links', () => {
      renderSafety();
      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);
    });
  });
});
