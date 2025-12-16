import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import RouteNormalizer, { getNormalizedPath, ROUTE_MAP } from './RouteNormalizer';

// Helper component to capture current location
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search + location.hash}</div>;
}

function renderWithRouter(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <RouteNormalizer />
      <Routes>
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RouteNormalizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNormalizedPath', () => {
    it('returns lowercase path for exact matches', () => {
      expect(getNormalizedPath('/Home')).toBe('/');
      expect(getNormalizedPath('/Feed')).toBe('/feed');
      expect(getNormalizedPath('/Profile')).toBe('/profile');
      expect(getNormalizedPath('/CreateRequest')).toBe('/create-request');
    });

    it('handles paths with ID segments', () => {
      expect(getNormalizedPath('/RequestDetail/123')).toBe('/request/123');
      expect(getNormalizedPath('/TransactionDetail/abc')).toBe('/transaction/abc');
      expect(getNormalizedPath('/ToolDetail/tool-1')).toBe('/tool/tool-1');
    });

    it('handles paths with query strings', () => {
      expect(getNormalizedPath('/Feed?filter=tools')).toBe('/feed?filter=tools');
    });

    it('returns null for already lowercase paths', () => {
      expect(getNormalizedPath('/feed')).toBeNull();
      expect(getNormalizedPath('/profile')).toBeNull();
      expect(getNormalizedPath('/')).toBeNull();
    });

    it('normalizes unknown PascalCase paths', () => {
      expect(getNormalizedPath('/SomeNewPage')).toBe('/some-new-page');
      expect(getNormalizedPath('/MyCustomRoute')).toBe('/my-custom-route');
    });

    it('handles multi-word PascalCase paths', () => {
      expect(getNormalizedPath('/HowItWorks')).toBe('/how-it-works');
      expect(getNormalizedPath('/SuccessStories')).toBe('/success-stories');
      expect(getNormalizedPath('/DisputeResolution')).toBe('/dispute-resolution');
    });
  });

  describe('ROUTE_MAP', () => {
    it('contains expected routes', () => {
      expect(ROUTE_MAP['/Home']).toBe('/');
      expect(ROUTE_MAP['/Feed']).toBe('/feed');
      expect(ROUTE_MAP['/Profile']).toBe('/profile');
      expect(ROUTE_MAP['/Admin']).toBe('/admin');
      expect(ROUTE_MAP['/Calendar']).toBe('/calendar');
    });

    it('maps detail pages correctly', () => {
      expect(ROUTE_MAP['/ToolDetail']).toBe('/tool');
      expect(ROUTE_MAP['/SpaceDetail']).toBe('/space');
      expect(ROUTE_MAP['/ServiceDetail']).toBe('/service');
      expect(ROUTE_MAP['/RequestDetail']).toBe('/request');
    });
  });

  describe('component rendering', () => {
    it('redirects PascalCase routes to lowercase', () => {
      const { getByTestId } = renderWithRouter('/Feed');
      expect(getByTestId('location').textContent).toBe('/feed');
    });

    it('redirects /Home to /', () => {
      const { getByTestId } = renderWithRouter('/Home');
      expect(getByTestId('location').textContent).toBe('/');
    });

    it('preserves query strings during redirect', () => {
      const { getByTestId } = renderWithRouter('/Calendar?view=month');
      expect(getByTestId('location').textContent).toBe('/calendar?view=month');
    });

    it('preserves hash during redirect', () => {
      const { getByTestId } = renderWithRouter('/About#team');
      expect(getByTestId('location').textContent).toBe('/about#team');
    });

    it('does not redirect lowercase paths', () => {
      const { getByTestId } = renderWithRouter('/feed');
      expect(getByTestId('location').textContent).toBe('/feed');
    });

    it('does not redirect root path', () => {
      const { getByTestId } = renderWithRouter('/');
      expect(getByTestId('location').textContent).toBe('/');
    });
  });

  describe('edge cases', () => {
    it('handles paths with multiple segments', () => {
      expect(getNormalizedPath('/Admin/users')).toBe('/admin/users');
    });

    it('handles legal pages', () => {
      expect(getNormalizedPath('/Terms')).toBe('/terms');
      expect(getNormalizedPath('/Privacy')).toBe('/privacy');
      expect(getNormalizedPath('/Cookies')).toBe('/cookies');
      expect(getNormalizedPath('/RefundPolicy')).toBe('/refund-policy');
    });
  });
});
