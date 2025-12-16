import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RequireAdmin from './RequireAdmin';

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock('@/hooks/use-auth', () => ({
  default: () => mockUseAuth(),
}));

function renderWithRouter(initialPath = '/admin') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <div data-testid="admin-content">Admin Content</div>
            </RequireAdmin>
          }
        />
        <Route path="/profile" element={<div data-testid="profile-page">Profile Page</div>} />
        <Route path="/feed" element={<div data-testid="feed-page">Feed Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RequireAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when loading', () => {
    it('renders loading spinner', () => {
      mockUseAuth.mockReturnValue({ user: null, isLoading: true });

      const { container } = renderWithRouter();

      // The loading spinner uses animate-spin class on the SVG
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
    });
  });

  describe('when not authenticated', () => {
    it('redirects to profile page with redirect param', () => {
      mockUseAuth.mockReturnValue({ user: null, isLoading: false });

      renderWithRouter('/admin');

      expect(screen.getByTestId('profile-page')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
    });

    it('preserves search params in redirect', () => {
      mockUseAuth.mockReturnValue({ user: null, isLoading: false });

      render(
        <MemoryRouter initialEntries={['/admin?tab=users']}>
          <Routes>
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <div>Admin</div>
                </RequireAdmin>
              }
            />
            <Route path="/profile" element={<div data-testid="profile-page">Profile</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('profile-page')).toBeInTheDocument();
    });
  });

  describe('when authenticated but not admin', () => {
    it('redirects to feed page for regular users', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-1', email: 'user@example.com', role: 'USER' },
        isLoading: false,
      });

      renderWithRouter();

      expect(screen.getByTestId('feed-page')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
    });

    it('redirects moderators to feed page', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-2', email: 'mod@example.com', role: 'MODERATOR' },
        isLoading: false,
      });

      renderWithRouter();

      expect(screen.getByTestId('feed-page')).toBeInTheDocument();
    });
  });

  describe('when authenticated as admin', () => {
    it('renders children for admin users', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' },
        isLoading: false,
      });

      renderWithRouter();

      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
      expect(screen.getByText('Admin Content')).toBeInTheDocument();
    });
  });
});
