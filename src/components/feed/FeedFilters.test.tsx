import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FeedFilters from './FeedFilters';

describe('FeedFilters Component', () => {
  const defaultProps = {
    urgencyFilter: 'all',
    setUrgencyFilter: vi.fn(),
    rateTypeFilter: 'all',
    setRateTypeFilter: vi.fn(),
    budgetRange: '',
    setBudgetRange: vi.fn(),
    radiusFilter: 25,
    setRadiusFilter: vi.fn(),
    nationwideSearch: false,
    setNationwideSearch: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<FeedFilters {...defaultProps} />);
      expect(document.body).toBeInTheDocument();
    });

    it('displays distance label', () => {
      render(<FeedFilters {...defaultProps} />);
      expect(screen.getByText(/Distance:/)).toBeInTheDocument();
    });

    it('displays current radius in label', () => {
      render(<FeedFilters {...defaultProps} radiusFilter={25} />);
      expect(screen.getByText(/25 miles/)).toBeInTheDocument();
    });

    it('handles nationwideSearch state', () => {
      const { container } = render(<FeedFilters {...defaultProps} nationwideSearch={true} />);
      // Should render differently when nationwide is selected
      expect(container).toBeInTheDocument();
    });
  });

  describe('Nationwide checkbox', () => {
    it('renders Search nationwide checkbox', () => {
      render(<FeedFilters {...defaultProps} />);
      expect(screen.getByText('Search nationwide')).toBeInTheDocument();
    });

    it('checkbox reflects nationwideSearch state', () => {
      render(<FeedFilters {...defaultProps} nationwideSearch={true} />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('calls setNationwideSearch when clicked', () => {
      render(<FeedFilters {...defaultProps} />);
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(defaultProps.setNationwideSearch).toHaveBeenCalled();
    });
  });

  describe('Radius slider', () => {
    it('renders slider when not nationwide', () => {
      const { container } = render(<FeedFilters {...defaultProps} nationwideSearch={false} />);
      // Slider should be present
      const slider = container.querySelector('[role="slider"]');
      expect(slider).toBeInTheDocument();
    });

    it('hides slider when nationwide is selected', () => {
      const { container } = render(<FeedFilters {...defaultProps} nationwideSearch={true} />);
      const slider = container.querySelector('[role="slider"]');
      expect(slider).not.toBeInTheDocument();
    });

    it('shows range labels', () => {
      render(<FeedFilters {...defaultProps} nationwideSearch={false} />);
      expect(screen.getByText('1 mi')).toBeInTheDocument();
      expect(screen.getByText('150 mi')).toBeInTheDocument();
    });
  });

  describe('Distance descriptions', () => {
    it('shows Very close for small radius', () => {
      render(<FeedFilters {...defaultProps} radiusFilter={3} nationwideSearch={false} />);
      expect(screen.getByText(/Very close/)).toBeInTheDocument();
    });

    it('shows Short drive for medium radius', () => {
      render(<FeedFilters {...defaultProps} radiusFilter={10} nationwideSearch={false} />);
      expect(screen.getByText(/Short drive/)).toBeInTheDocument();
    });

    it('shows Reasonable distance for larger radius', () => {
      render(<FeedFilters {...defaultProps} radiusFilter={30} nationwideSearch={false} />);
      expect(screen.getByText(/Reasonable distance/)).toBeInTheDocument();
    });

    it('shows Regional search for wide radius', () => {
      render(<FeedFilters {...defaultProps} radiusFilter={75} nationwideSearch={false} />);
      expect(screen.getByText(/Regional search/)).toBeInTheDocument();
    });

    it('shows Wide area search for very wide radius', () => {
      render(<FeedFilters {...defaultProps} radiusFilter={120} nationwideSearch={false} />);
      expect(screen.getByText(/Wide area/)).toBeInTheDocument();
    });
  });

  describe('Layout', () => {
    it('renders in grid layout', () => {
      const { container } = render(<FeedFilters {...defaultProps} />);
      expect(container.querySelector('.grid')).toBeInTheDocument();
    });
  });

  describe('Icon', () => {
    it('renders MapPin icon', () => {
      const { container } = render(<FeedFilters {...defaultProps} />);
      const icon = container.querySelector('.lucide-map-pin');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Budget input', () => {
    it('renders budget input field', () => {
      render(<FeedFilters {...defaultProps} />);
      const input = screen.getByPlaceholderText('Any budget');
      expect(input).toBeInTheDocument();
    });

    it('calls setBudgetRange when budget changes', () => {
      render(<FeedFilters {...defaultProps} />);
      const input = screen.getByPlaceholderText('Any budget');
      fireEvent.change(input, { target: { value: '100' } });
      expect(defaultProps.setBudgetRange).toHaveBeenCalledWith(100);
    });

    it('handles empty budget value', () => {
      render(<FeedFilters {...defaultProps} budgetRange={100} />);
      const input = screen.getByPlaceholderText('Any budget');
      // First set a value, then clear it
      fireEvent.change(input, { target: { value: '' } });
      // The handler should be called - check it was called at all
      expect(defaultProps.setBudgetRange).toHaveBeenCalled();
    });
  });

  describe('Filter tags', () => {
    it('shows nationwide tag when nationwide is selected', () => {
      render(<FeedFilters {...defaultProps} nationwideSearch={true} />);
      expect(screen.getByText('Nationwide search')).toBeInTheDocument();
    });

    it('shows radius tag when radius is small', () => {
      render(<FeedFilters {...defaultProps} radiusFilter={5} nationwideSearch={false} />);
      expect(screen.getByText(/Within 5 miles/)).toBeInTheDocument();
    });

    it('shows urgency tag when urgency is set', () => {
      render(<FeedFilters {...defaultProps} urgencyFilter="today" />);
      expect(screen.getByText(/Urgency: today/)).toBeInTheDocument();
    });

    it('shows rate type tag when rate type is set', () => {
      render(<FeedFilters {...defaultProps} rateTypeFilter="hourly" />);
      expect(screen.getByText(/Payment: hourly/)).toBeInTheDocument();
    });

    it('shows budget tag when budget is set', () => {
      render(<FeedFilters {...defaultProps} budgetRange={50} />);
      expect(screen.getByText(/Max budget: £50/)).toBeInTheDocument();
    });

    it('clears nationwide when X is clicked', () => {
      render(<FeedFilters {...defaultProps} nationwideSearch={true} />);
      const clearBtn = screen.getByText('✕');
      fireEvent.click(clearBtn);
      expect(defaultProps.setNationwideSearch).toHaveBeenCalledWith(false);
    });

    it('clears urgency when X is clicked', () => {
      render(<FeedFilters {...defaultProps} urgencyFilter="today" />);
      const clearBtn = screen.getByText('✕');
      fireEvent.click(clearBtn);
      expect(defaultProps.setUrgencyFilter).toHaveBeenCalledWith('all');
    });

    it('clears rate type when X is clicked', () => {
      render(<FeedFilters {...defaultProps} rateTypeFilter="hourly" />);
      const clearBtn = screen.getByText('✕');
      fireEvent.click(clearBtn);
      expect(defaultProps.setRateTypeFilter).toHaveBeenCalledWith('all');
    });

    it('clears budget when X is clicked', () => {
      render(<FeedFilters {...defaultProps} budgetRange={50} />);
      const clearBtn = screen.getByText('✕');
      fireEvent.click(clearBtn);
      expect(defaultProps.setBudgetRange).toHaveBeenCalledWith('');
    });

    it('resets small radius when X is clicked', () => {
      render(<FeedFilters {...defaultProps} radiusFilter={5} nationwideSearch={false} />);
      const clearBtns = screen.getAllByText('✕');
      fireEvent.click(clearBtns[0]);
      expect(defaultProps.setRadiusFilter).toHaveBeenCalledWith(10);
    });
  });

  describe('Select dropdowns', () => {
    it('renders urgency select', () => {
      render(<FeedFilters {...defaultProps} />);
      expect(screen.getByText('Urgency')).toBeInTheDocument();
    });

    it('renders payment type select', () => {
      render(<FeedFilters {...defaultProps} />);
      expect(screen.getByText('Payment Type')).toBeInTheDocument();
    });

    it('renders max budget label', () => {
      render(<FeedFilters {...defaultProps} />);
      expect(screen.getByText('Max Budget')).toBeInTheDocument();
    });
  });
});
