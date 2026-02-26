import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LivePreviewCard } from './LivePreviewCard';
import type { NeedData, OfferData } from './types';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

describe('LivePreviewCard', () => {
  const defaultNeedData: NeedData = {
    title: 'Test Need Title',
    description: 'Test description for the need',
    budget: '50',
    rateType: 'HOURLY',
    urgency: 'ASAP',
    broadcastRadius: 10,
    nationwideSearch: false,
    sponsorEnabled: false,
    sponsorCpaPercent: 0,
  };

  const defaultOfferData: OfferData = {
    name: 'Test Tool Name',
    title: 'Test Tool',
    description: 'A great tool for testing',
    dailyRate: '25',
    hourlyRate: '10',
    weeklyRate: '150',
    deposit: '100',
    calloutFee: '15',
    condition: 'excellent',
    toolCategory: 'power-tools',
    features: ['Feature 1', 'Feature 2'],
    specialties: [],
    radius: 20,
    sponsorEnabled: false,
    sponsorCpaPercent: 0,
  };

  describe('Need intent rendering', () => {
    it('renders with need intent and displays title', () => {
      render(
        <LivePreviewCard
          intent="need"
          category="TOOLS"
          data={defaultNeedData}
          photos={[]}
        />
      );

      expect(screen.getByText('Test Need Title')).toBeInTheDocument();
    });

    it('displays description for need', () => {
      render(
        <LivePreviewCard
          intent="need"
          category="TOOLS"
          data={defaultNeedData}
          photos={[]}
        />
      );

      expect(screen.getByText('Test description for the need')).toBeInTheDocument();
    });

    it('displays budget with hourly rate label', () => {
      render(
        <LivePreviewCard
          intent="need"
          category="TOOLS"
          data={defaultNeedData}
          photos={[]}
        />
      );

      expect(screen.getByText('£50/hr')).toBeInTheDocument();
    });

    it('displays budget with daily rate label', () => {
      const dailyNeed = { ...defaultNeedData, rateType: 'DAILY' };
      render(
        <LivePreviewCard
          intent="need"
          category="TOOLS"
          data={dailyNeed}
          photos={[]}
        />
      );

      expect(screen.getByText('£50/day')).toBeInTheDocument();
    });

    it('displays budget with fixed rate (no label)', () => {
      const fixedNeed = { ...defaultNeedData, rateType: 'FIXED' };
      render(
        <LivePreviewCard
          intent="need"
          category="TOOLS"
          data={fixedNeed}
          photos={[]}
        />
      );

      expect(screen.getByText('£50')).toBeInTheDocument();
    });
  });

  describe('Offer intent rendering', () => {
    it('renders with offer intent and displays name', () => {
      render(
        <LivePreviewCard
          intent="offer"
          category="tool"
          data={defaultOfferData}
          photos={[]}
        />
      );

      expect(screen.getByText('Test Tool Name')).toBeInTheDocument();
    });

    it('displays daily rate for tool offers', () => {
      render(
        <LivePreviewCard
          intent="offer"
          category="tool"
          data={defaultOfferData}
          photos={[]}
        />
      );

      expect(screen.getByText('£25/day')).toBeInTheDocument();
    });

    it('displays hourly rate for service offers', () => {
      const serviceData = { ...defaultOfferData, dailyRate: '', hourlyRate: '35' };
      render(
        <LivePreviewCard
          intent="offer"
          category="service"
          data={serviceData}
          photos={[]}
        />
      );

      // Service offers display hourlyRate when dailyRate is empty
      expect(screen.getByText('£35/hr')).toBeInTheDocument();
    });
  });

  describe('Category badge rendering', () => {
    it('displays Tool badge for TOOLS category', () => {
      render(
        <LivePreviewCard
          intent="need"
          category="TOOLS"
          data={defaultNeedData}
          photos={[]}
        />
      );

      expect(screen.getByText('Tool')).toBeInTheDocument();
    });

    it('displays Space badge for SPACE category', () => {
      render(
        <LivePreviewCard
          intent="need"
          category="SPACE"
          data={defaultNeedData}
          photos={[]}
        />
      );

      expect(screen.getByText('Space')).toBeInTheDocument();
    });

    it('displays Service badge for EXPERTISE category', () => {
      render(
        <LivePreviewCard
          intent="need"
          category="EXPERTISE"
          data={defaultNeedData}
          photos={[]}
        />
      );

      expect(screen.getByText('Service')).toBeInTheDocument();
    });

    it('displays Tool badge for lowercase tool category', () => {
      render(
        <LivePreviewCard
          intent="offer"
          category="tool"
          data={defaultOfferData}
          photos={[]}
        />
      );

      expect(screen.getByText('Tool')).toBeInTheDocument();
    });
  });

  describe('Photo handling', () => {
    it('displays placeholder when no photos provided', () => {
      render(
        <LivePreviewCard
          intent="need"
          category="TOOLS"
          data={defaultNeedData}
          photos={[]}
        />
      );

      expect(screen.getByText('Add photos')).toBeInTheDocument();
    });

    it('displays first photo when photos provided', () => {
      const { container } = render(
        <LivePreviewCard
          intent="need"
          category="TOOLS"
          data={defaultNeedData}
          photos={['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg']}
        />
      );

      // Image has empty alt so it has role="presentation", use querySelector instead
      const img = container.querySelector('img');
      expect(img).toHaveAttribute('src', 'https://example.com/photo1.jpg');
    });
  });

  describe('Empty state handling', () => {
    it('displays placeholder title when title is empty', () => {
      const emptyTitleData = { ...defaultNeedData, title: '' };
      render(
        <LivePreviewCard
          intent="need"
          category="TOOLS"
          data={emptyTitleData}
          photos={[]}
        />
      );

      expect(screen.getByText('Your listing title...')).toBeInTheDocument();
    });

    it('displays placeholder description when description is empty', () => {
      const emptyDescData = { ...defaultNeedData, description: '' };
      render(
        <LivePreviewCard
          intent="need"
          category="TOOLS"
          data={emptyDescData}
          photos={[]}
        />
      );

      expect(screen.getByText(/Add a description/)).toBeInTheDocument();
    });
  });

  describe('Interaction buttons', () => {
    it('displays Save button', () => {
      render(
        <LivePreviewCard
          intent="need"
          category="TOOLS"
          data={defaultNeedData}
          photos={[]}
        />
      );

      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('displays Message button', () => {
      render(
        <LivePreviewCard
          intent="need"
          category="TOOLS"
          data={defaultNeedData}
          photos={[]}
        />
      );

      expect(screen.getByText('Message')).toBeInTheDocument();
    });

    it('displays Share button', () => {
      render(
        <LivePreviewCard
          intent="need"
          category="TOOLS"
          data={defaultNeedData}
          photos={[]}
        />
      );

      expect(screen.getByText('Share')).toBeInTheDocument();
    });
  });

  describe('Live Preview header', () => {
    it('displays Live Preview label', () => {
      render(
        <LivePreviewCard
          intent="need"
          category="TOOLS"
          data={defaultNeedData}
          photos={[]}
        />
      );

      expect(screen.getByText('Live Preview')).toBeInTheDocument();
    });

    it('displays help text', () => {
      render(
        <LivePreviewCard
          intent="need"
          category="TOOLS"
          data={defaultNeedData}
          photos={[]}
        />
      );

      expect(screen.getByText('How your listing will look')).toBeInTheDocument();
    });
  });
});
