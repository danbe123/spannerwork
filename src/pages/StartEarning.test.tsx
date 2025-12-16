import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StartEarning from './StartEarning';

// Mock SEO
vi.mock('@/components/SEO', () => ({
  default: () => null,
}));

function renderStartEarning() {
  return render(
    <MemoryRouter>
      <StartEarning />
    </MemoryRouter>
  );
}

describe('StartEarning Page', () => {
  describe('Rendering', () => {
    it('renders page', () => {
      renderStartEarning();
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Earning categories', () => {
    it('renders tool rental section', () => {
      renderStartEarning();
      expect(screen.getByText(/Rent Out Your Tools/i)).toBeInTheDocument();
    });

    it('renders space sharing section', () => {
      renderStartEarning();
      expect(screen.getByText(/Share Your Space/i)).toBeInTheDocument();
    });

    it('shows earning potential', () => {
      renderStartEarning();
      const earningElements = screen.getAllByText(/day/i);
      expect(earningElements.length).toBeGreaterThan(0);
    });
  });

  describe('CTAs', () => {
    it('has call to action links', () => {
      renderStartEarning();
      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);
    });
  });
});
