import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmptyState from './EmptyState';

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      {ui}
    </MemoryRouter>
  );
}

describe('EmptyState Component', () => {
  const mockOnReset = vi.fn();

  describe('Rendering', () => {
    it('renders No Jobs Found heading', () => {
      renderWithRouter(<EmptyState onReset={mockOnReset} />);
      expect(screen.getByText('No Jobs Found')).toBeInTheDocument();
    });

    it('renders default message for all category', () => {
      renderWithRouter(<EmptyState category="all" onReset={mockOnReset} />);
      expect(screen.getByText('No active jobs match your search criteria')).toBeInTheDocument();
    });

    it('renders category-specific message', () => {
      renderWithRouter(<EmptyState category="tools" onReset={mockOnReset} />);
      expect(screen.getByText('No tools jobs available right now')).toBeInTheDocument();
    });
  });

  describe('Buttons', () => {
    it('renders Post a Job button', () => {
      renderWithRouter(<EmptyState onReset={mockOnReset} />);
      expect(screen.getByText('Post a Job')).toBeInTheDocument();
    });

    it('renders Reset Filters button', () => {
      renderWithRouter(<EmptyState onReset={mockOnReset} />);
      expect(screen.getByText('Reset Filters')).toBeInTheDocument();
    });

    it('calls onReset when Reset Filters is clicked', () => {
      renderWithRouter(<EmptyState onReset={mockOnReset} />);
      fireEvent.click(screen.getByText('Reset Filters'));
      expect(mockOnReset).toHaveBeenCalled();
    });

    it('Post a Job links to CreateRequest', () => {
      renderWithRouter(<EmptyState onReset={mockOnReset} />);
      const postJobButton = screen.getByText('Post a Job').closest('a');
      expect(postJobButton).toHaveAttribute('href', '/CreateRequest');
    });
  });

  describe('Suggestions', () => {
    it('renders Post your own job suggestion', () => {
      renderWithRouter(<EmptyState onReset={mockOnReset} />);
      expect(screen.getByText('Post your own job')).toBeInTheDocument();
    });

    it('renders Try different filters suggestion', () => {
      renderWithRouter(<EmptyState onReset={mockOnReset} />);
      expect(screen.getByText('Try different filters')).toBeInTheDocument();
    });

    it('renders Check back later suggestion', () => {
      renderWithRouter(<EmptyState onReset={mockOnReset} />);
      expect(screen.getByText('Check back later')).toBeInTheDocument();
    });

    it('renders all three suggestions', () => {
      const { container } = renderWithRouter(<EmptyState onReset={mockOnReset} />);
      const suggestionDivs = container.querySelectorAll('.bg-gray-50.rounded-lg');
      expect(suggestionDivs.length).toBe(3);
    });
  });

  describe('Icons', () => {
    it('renders icons in suggestions', () => {
      const { container } = renderWithRouter(<EmptyState onReset={mockOnReset} />);
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Layout', () => {
    it('renders card structure', () => {
      const { container } = renderWithRouter(<EmptyState onReset={mockOnReset} />);
      // Check for Card structure
      expect(container.querySelector('.shadow-lg')).toBeInTheDocument();
    });

    it('centers content', () => {
      const { container } = renderWithRouter(<EmptyState onReset={mockOnReset} />);
      expect(container.querySelector('.text-center')).toBeInTheDocument();
    });
  });

  describe('Default props', () => {
    it('uses "all" as default category', () => {
      renderWithRouter(<EmptyState onReset={mockOnReset} />);
      expect(screen.getByText('No active jobs match your search criteria')).toBeInTheDocument();
    });
  });
});
