import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { createHelmetMock } from '@/test/mockSetup';
import { MemoryRouter } from 'react-router-dom';

// Mock react-helmet-async
vi.mock('react-helmet-async', () => createHelmetMock());

// Mock MarketingFooter
vi.mock('../../components/MarketingFooter', () => ({
  default: () => <footer data-testid="marketing-footer">Footer</footer>,
}));

import PricingGuide from './PricingGuide';
import ProviderGuide from './ProviderGuide';
import RenterGuide from './RenterGuide';
import SafetyGuide from './SafetyGuide';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('Guide Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PricingGuide', () => {
    it('renders without crashing', () => {
      const { container } = renderWithRouter(<PricingGuide />);
      expect(container).toBeDefined();
    });

    it('has content', () => {
      renderWithRouter(<PricingGuide />);
      expect(document.body.textContent?.length).toBeGreaterThan(0);
    });
  });

  describe('ProviderGuide', () => {
    it('renders without crashing', () => {
      const { container } = renderWithRouter(<ProviderGuide />);
      expect(container).toBeDefined();
    });

    it('has content', () => {
      renderWithRouter(<ProviderGuide />);
      expect(document.body.textContent?.length).toBeGreaterThan(0);
    });
  });

  describe('RenterGuide', () => {
    it('renders without crashing', () => {
      const { container } = renderWithRouter(<RenterGuide />);
      expect(container).toBeDefined();
    });

    it('has content', () => {
      renderWithRouter(<RenterGuide />);
      expect(document.body.textContent?.length).toBeGreaterThan(0);
    });
  });

  describe('SafetyGuide', () => {
    it('renders without crashing', () => {
      const { container } = renderWithRouter(<SafetyGuide />);
      expect(container).toBeDefined();
    });

    it('has content', () => {
      renderWithRouter(<SafetyGuide />);
      expect(document.body.textContent?.length).toBeGreaterThan(0);
    });
  });
});
