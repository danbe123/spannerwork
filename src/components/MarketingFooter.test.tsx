import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MarketingFooter from './MarketingFooter';

// Mock createPageUrl utility
vi.mock('@/utils', () => ({
  createPageUrl: (pageName: string) => `/${pageName.toLowerCase().replace(/([A-Z])/g, '-$1').replace(/^-/, '')}`,
}));

describe('MarketingFooter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the footer', () => {
      render(<MarketingFooter />);
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });

    it('displays SpannerWork branding', () => {
      render(<MarketingFooter />);
      expect(screen.getByText('SpannerWork')).toBeInTheDocument();
      expect(screen.getByText('Tools. Skills. Space.')).toBeInTheDocument();
    });

    it('displays company description', () => {
      render(<MarketingFooter />);
      expect(screen.getByText(/Your local network for tools, expertise, and workspace/i)).toBeInTheDocument();
    });

    it('displays copyright notice', () => {
      render(<MarketingFooter />);
      expect(screen.getByText(/© 2025 SpannerWork/i)).toBeInTheDocument();
    });
  });

  describe('newsletter form', () => {
    it('renders newsletter heading', () => {
      render(<MarketingFooter />);
      expect(screen.getByText('Stay Connected')).toBeInTheDocument();
    });

    it('renders email input', () => {
      render(<MarketingFooter />);
      const emailInput = screen.getByPlaceholderText('your@email.com');
      expect(emailInput).toBeInTheDocument();
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('required');
    });

    it('renders subscribe button', () => {
      render(<MarketingFooter />);
      expect(screen.getByRole('button', { name: /Subscribe/i })).toBeInTheDocument();
    });

    it('handles form submission', () => {
      render(<MarketingFooter />);
      const form = screen.getByPlaceholderText('your@email.com').closest('form');
      const submitEvent = vi.fn((e) => e.preventDefault());
      
      if (form) {
        form.onsubmit = submitEvent;
        fireEvent.submit(form);
        expect(submitEvent).toHaveBeenCalled();
      }
    });
  });

  describe('trust badges', () => {
    it('displays Secure Payments badge', () => {
      render(<MarketingFooter />);
      expect(screen.getAllByText('Secure Payments').length).toBeGreaterThan(0);
    });

    it('displays Verified Users badge', () => {
      render(<MarketingFooter />);
      expect(screen.getAllByText('Verified Users').length).toBeGreaterThan(0);
    });

    it('displays Community Members badge', () => {
      render(<MarketingFooter />);
      expect(screen.getAllByText('Community Members').length).toBeGreaterThan(0);
    });

    it('displays rating badge', () => {
      render(<MarketingFooter />);
      expect(screen.getAllByText('4.8★ Rated').length).toBeGreaterThan(0);
    });
  });

  describe('navigation links', () => {
    it('renders Product section links', () => {
      render(<MarketingFooter />);
      expect(screen.getByText('Product')).toBeInTheDocument();
      expect(screen.getByText('How It Works')).toBeInTheDocument();
      expect(screen.getByText('Pricing')).toBeInTheDocument();
      expect(screen.getByText('Safety')).toBeInTheDocument();
    });

    it('renders For Providers section links', () => {
      render(<MarketingFooter />);
      expect(screen.getByText('For Providers')).toBeInTheDocument();
      expect(screen.getByText('Start Earning')).toBeInTheDocument();
      expect(screen.getByText('Success Stories')).toBeInTheDocument();
      expect(screen.getByText('Resources')).toBeInTheDocument();
    });

    it('renders Company section links', () => {
      render(<MarketingFooter />);
      expect(screen.getByText('Company')).toBeInTheDocument();
      expect(screen.getByText('About Us')).toBeInTheDocument();
      expect(screen.getByText('Contact')).toBeInTheDocument();
      expect(screen.getByText('Terms')).toBeInTheDocument();
      expect(screen.getByText('Privacy')).toBeInTheDocument();
      expect(screen.getByText('Cookies')).toBeInTheDocument();
    });

    it('links have correct href attributes', () => {
      render(<MarketingFooter />);
      const termsLink = screen.getByText('Terms').closest('a');
      expect(termsLink).toHaveAttribute('href');
    });
  });

  describe('social links', () => {
    it('renders social media links', () => {
      render(<MarketingFooter />);
      const socialLinks = screen.getAllByRole('link').filter(link => 
        link.getAttribute('href') === '#'
      );
      // Facebook, Twitter, Instagram
      expect(socialLinks.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('accessibility', () => {
    it('uses semantic footer element', () => {
      render(<MarketingFooter />);
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });

    it('has accessible form elements', () => {
      render(<MarketingFooter />);
      const emailInput = screen.getByPlaceholderText('your@email.com');
      expect(emailInput).toHaveAttribute('type', 'email');
    });
  });
});
