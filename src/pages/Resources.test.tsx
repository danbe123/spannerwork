import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Resources from './Resources';

// Mock SEO
vi.mock('@/components/SEO', () => ({
  default: () => null,
}));

function renderResources() {
  return render(
    <MemoryRouter>
      <Resources />
    </MemoryRouter>
  );
}

describe('Resources Page', () => {
  describe('Rendering', () => {
    it('renders page', () => {
      renderResources();
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Resource categories', () => {
    it('renders Getting Started section', () => {
      renderResources();
      expect(screen.getByText(/Getting Started/i)).toBeInTheDocument();
    });

    it('renders How SpannerWork Works link', () => {
      renderResources();
      expect(screen.getByText(/How SpannerWork Works/i)).toBeInTheDocument();
    });

    it('renders profile setup link', () => {
      renderResources();
      expect(screen.getByText(/Setting Up Your Profile/i)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('has resource links', () => {
      renderResources();
      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);
    });
  });
});
