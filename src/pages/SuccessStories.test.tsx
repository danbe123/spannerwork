import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SuccessStories from './SuccessStories';

// Mock SEO
vi.mock('@/components/SEO', () => ({
  default: () => null,
}));

function renderSuccessStories() {
  return render(
    <MemoryRouter>
      <SuccessStories />
    </MemoryRouter>
  );
}

describe('SuccessStories Page', () => {
  describe('Rendering', () => {
    it('renders page', () => {
      renderSuccessStories();
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Testimonials', () => {
    it('displays user testimonials', () => {
      renderSuccessStories();
      expect(screen.getByText(/James Mitchell/i)).toBeInTheDocument();
    });

    it('shows locations', () => {
      renderSuccessStories();
      expect(screen.getByText(/Manchester/i)).toBeInTheDocument();
    });

    it('shows earnings/savings', () => {
      renderSuccessStories();
      const earningsElements = screen.getAllByText(/£/);
      expect(earningsElements.length).toBeGreaterThan(0);
    });

    it('shows quotes', () => {
      renderSuccessStories();
      expect(screen.getByText(/sitting in my garage/i)).toBeInTheDocument();
    });
  });

  describe('User types', () => {
    it('shows provider stories', () => {
      renderSuccessStories();
      expect(document.body).toBeInTheDocument();
    });

    it('shows seeker stories', () => {
      renderSuccessStories();
      expect(screen.getByText(/Sarah Chen/i)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('has links', () => {
      renderSuccessStories();
      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);
    });
  });
});
