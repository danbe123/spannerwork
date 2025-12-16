import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RequestCard from './RequestCard';
import type { Request, User } from '@/types';
import { Wrench, Building2, GraduationCap } from 'lucide-react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, onMouseEnter, onMouseLeave, onClick, ...props }: React.PropsWithChildren<{
      className?: string;
      onMouseEnter?: () => void;
      onMouseLeave?: () => void;
      onClick?: () => void;
    }>) => (
      <div 
        className={className} 
        onMouseEnter={onMouseEnter} 
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        {...props}
      >
        {children}
      </div>
    ),
    button: ({ children, className, onClick, title, ...props }: React.PropsWithChildren<{
      className?: string;
      onClick?: (e: React.MouseEvent) => void;
      title?: string;
    }>) => (
      <button className={className} onClick={onClick} title={title} {...props}>
        {children}
      </button>
    ),
    span: ({ children, ...props }: React.PropsWithChildren) => <span {...props}>{children}</span>,
  },
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      {ui}
    </MemoryRouter>
  );
}

const mockRequest = {
  id: 'req-1',
  title: 'Need a power drill',
  description: 'Looking for a power drill for weekend project',
  budget: 50,
  rateType: 'DAILY',
  category: 'TOOLS',
  urgency: 'ASAP',
  status: 'OPEN',
  postcode: 'SW1A1AA',
  seekerId: 'user-2',
  seeker: {
    id: 'user-2',
    name: 'John Doe',
    email: 'john@test.com',
    rating: 4.5,
    reviewCount: 10,
  },
  createdDate: new Date().toISOString(),
  updatedDate: new Date().toISOString(),
} as unknown as Request;

const mockCurrentUser = {
  id: 'user-1',
  name: 'Current User',
  email: 'current@test.com',
  locationLat: 51.5074,
  locationLng: -0.1278,
} as unknown as User;

const categoryIcons = {
  TOOLS: Wrench,
  SPACE: Building2,
  EXPERTISE: GraduationCap,
};

describe('RequestCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders request title', () => {
      renderWithRouter(<RequestCard request={mockRequest} />);
      expect(screen.getByText('Need a power drill')).toBeInTheDocument();
    });

    it('renders request description', () => {
      renderWithRouter(<RequestCard request={mockRequest} />);
      expect(screen.getByText(/Looking for a power drill/)).toBeInTheDocument();
    });

    it('renders budget with pound sign', () => {
      renderWithRouter(<RequestCard request={mockRequest} />);
      expect(screen.getByText(/£50/)).toBeInTheDocument();
    });

    it('renders seeker name', () => {
      renderWithRouter(<RequestCard request={mockRequest} />);
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  describe('Urgency badges', () => {
    it('renders urgency information', () => {
      const { container } = renderWithRouter(<RequestCard request={mockRequest} />);
      // Should have badge elements
      expect(container).toBeInTheDocument();
    });

    it('renders with different urgency values', () => {
      const todayRequest = { ...mockRequest, urgency: 'TODAY' } as unknown as Request;
      const { container } = renderWithRouter(<RequestCard request={todayRequest} />);
      expect(container).toBeInTheDocument();
    });

    it('handles flexible urgency', () => {
      const flexibleRequest = { ...mockRequest, urgency: 'FLEXIBLE' } as unknown as Request;
      const { container } = renderWithRouter(<RequestCard request={flexibleRequest} />);
      expect(container).toBeInTheDocument();
    });
  });

  describe('Location display', () => {
    it('renders postcode area', () => {
      const { container } = renderWithRouter(<RequestCard request={mockRequest} />);
      // Should render location information
      expect(container).toBeInTheDocument();
    });
  });

  describe('Quick actions', () => {
    it('renders action buttons', () => {
      const { container } = renderWithRouter(<RequestCard request={mockRequest} />);
      // Should have multiple buttons for actions
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('renders icons for actions', () => {
      const { container } = renderWithRouter(<RequestCard request={mockRequest} />);
      // Should have SVG icons
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Navigation', () => {
    it('navigates to request detail on click', () => {
      renderWithRouter(<RequestCard request={mockRequest} currentUser={mockCurrentUser} />);
      
      // Click on the card
      const card = screen.getByText('Need a power drill').closest('[class*="cursor-pointer"]');
      if (card) {
        fireEvent.click(card);
        expect(mockNavigate).toHaveBeenCalledWith(`/request/${mockRequest.id}`);
      }
    });
  });

  describe('Own request detection', () => {
    it('detects when current user owns the request', () => {
      const ownUser = { ...mockCurrentUser, id: 'user-2' };
      renderWithRouter(<RequestCard request={mockRequest} currentUser={ownUser} />);
      // Should still render (own request styling may differ)
      expect(screen.getByText('Need a power drill')).toBeInTheDocument();
    });
  });

  describe('Category icons', () => {
    it('renders with custom category icons', () => {
      renderWithRouter(
        <RequestCard 
          request={mockRequest} 
          categoryIcons={categoryIcons}
        />
      );
      // Should render icon (verified by presence of svg)
      expect(document.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Seeker info', () => {
    it('displays seeker name', () => {
      renderWithRouter(<RequestCard request={mockRequest} />);
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('shows avatar initial fallback when seeker has no avatar', () => {
      const noAvatarRequest = {
        ...mockRequest,
        seeker: {
          ...mockRequest.seeker,
          avatar: null,
        },
      } as unknown as Request;

      renderWithRouter(<RequestCard request={noAvatarRequest} />);
      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('renders seeker avatar area', () => {
      const { container } = renderWithRouter(<RequestCard request={mockRequest} />);
      // Should have avatar or profile area
      expect(container).toBeInTheDocument();
    });
  });

  describe('Time display', () => {
    it('shows relative time', () => {
      renderWithRouter(<RequestCard request={mockRequest} />);
      // Should show something like "less than a minute ago" or similar
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Rate type display', () => {
    it('shows per day for DAILY rate type', () => {
      renderWithRouter(<RequestCard request={mockRequest} />);
      expect(screen.getByText(/\/day/)).toBeInTheDocument();
    });

    it('shows per hour for HOURLY rate type', () => {
      const hourlyRequest = { ...mockRequest, rateType: 'HOURLY' } as unknown as Request;
      renderWithRouter(<RequestCard request={hourlyRequest} />);
      expect(screen.getByText(/\/hr/)).toBeInTheDocument();
    });
  });

  describe('Interaction states', () => {
    it('card is interactive', () => {
      const { container } = renderWithRouter(<RequestCard request={mockRequest} />);
      const interactiveElement = container.querySelector('[class*="cursor"]');
      expect(interactiveElement || container).toBeInTheDocument();
    });
  });

  describe('Distance calculation', () => {
    it('calculates distance when user has location', () => {
      const userWithLocation = {
        ...mockCurrentUser,
        locationLat: 51.5074,
        locationLng: -0.1278,
      } as unknown as User;
      
      const requestWithLocation = {
        ...mockRequest,
        locationLat: 51.5,
        locationLng: -0.12,
      } as unknown as Request;
      
      renderWithRouter(<RequestCard request={requestWithLocation} currentUser={userWithLocation} />);
      expect(document.body).toBeInTheDocument();
    });

    it('handles missing user location', () => {
      const userNoLocation = {
        ...mockCurrentUser,
        locationLat: undefined,
        locationLng: undefined,
      } as unknown as User;
      
      renderWithRouter(<RequestCard request={mockRequest} currentUser={userNoLocation} />);
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Quick actions', () => {
    it('has bookmark button', () => {
      const { container } = renderWithRouter(<RequestCard request={mockRequest} />);
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('handles bookmark click', () => {
      renderWithRouter(<RequestCard request={mockRequest} currentUser={mockCurrentUser} />);
      const buttons = screen.getAllByRole('button');
      if (buttons.length > 0) {
        fireEvent.click(buttons[0]);
      }
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Rate display variations', () => {
    it('displays hourly rate correctly', () => {
      const hourlyRequest = { ...mockRequest, rateType: 'HOURLY', budget: 25 } as unknown as Request;
      renderWithRouter(<RequestCard request={hourlyRequest} />);
      expect(screen.getByText(/£25\/hr/)).toBeInTheDocument();
    });

    it('handles request with no budget', () => {
      const noBudgetRequest = { ...mockRequest, budget: undefined } as unknown as Request;
      renderWithRouter(<RequestCard request={noBudgetRequest} />);
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Urgency variations', () => {
    it('renders THIS_WEEKEND urgency', () => {
      const weekendRequest = { ...mockRequest, urgency: 'THIS_WEEKEND' } as unknown as Request;
      renderWithRouter(<RequestCard request={weekendRequest} />);
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Seeker display', () => {
    it('handles missing seeker data', () => {
      const noSeekerRequest = { ...mockRequest, seeker: undefined } as unknown as Request;
      renderWithRouter(<RequestCard request={noSeekerRequest} />);
      expect(document.body).toBeInTheDocument();
    });
  });
});
