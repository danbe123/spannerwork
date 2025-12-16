import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { StepIndicator } from './StepIndicator';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: React.PropsWithChildren<{ className?: string }>) => (
      <div className={className} {...props}>{children}</div>
    ),
  },
}));

describe('StepIndicator', () => {
  describe('Rendering steps', () => {
    it('renders default number of steps (2)', () => {
      const { container } = render(<StepIndicator currentStep={0} />);
      
      // Should render 2 step indicators by default
      const steps = container.querySelectorAll('.h-1\\.5');
      expect(steps).toHaveLength(2);
    });

    it('renders custom number of steps', () => {
      const { container } = render(<StepIndicator currentStep={0} totalSteps={5} />);
      
      const steps = container.querySelectorAll('.h-1\\.5');
      expect(steps).toHaveLength(5);
    });

    it('renders single step when totalSteps is 1', () => {
      const { container } = render(<StepIndicator currentStep={0} totalSteps={1} />);
      
      const steps = container.querySelectorAll('.h-1\\.5');
      expect(steps).toHaveLength(1);
    });
  });

  describe('Current step highlighting', () => {
    it('highlights current step with brand color', () => {
      const { container } = render(<StepIndicator currentStep={0} totalSteps={3} />);
      
      const steps = container.querySelectorAll('.h-1\\.5');
      // First step should be current (has bg-brand class)
      expect(steps[0]).toHaveClass('bg-brand');
    });

    it('marks completed steps with gradient', () => {
      const { container } = render(<StepIndicator currentStep={2} totalSteps={3} />);
      
      const steps = container.querySelectorAll('.h-1\\.5');
      // First two steps should be completed (have gradient class)
      expect(steps[0]).toHaveClass('bg-gradient-to-r');
      expect(steps[1]).toHaveClass('bg-gradient-to-r');
    });

    it('marks future steps with gray background', () => {
      const { container } = render(<StepIndicator currentStep={0} totalSteps={3} />);
      
      const steps = container.querySelectorAll('.h-1\\.5');
      // Last two steps should be inactive (gray)
      expect(steps[1]).toHaveClass('bg-gray-200');
      expect(steps[2]).toHaveClass('bg-gray-200');
    });
  });

  describe('Step widths', () => {
    it('applies wider width to current step', () => {
      const { container } = render(<StepIndicator currentStep={1} totalSteps={3} />);
      
      const steps = container.querySelectorAll('.h-1\\.5');
      // Current step (index 1) should have w-12 class
      expect(steps[1]).toHaveClass('w-12');
    });

    it('applies medium width to completed steps', () => {
      const { container } = render(<StepIndicator currentStep={2} totalSteps={3} />);
      
      const steps = container.querySelectorAll('.h-1\\.5');
      // Completed steps should have w-8 class
      expect(steps[0]).toHaveClass('w-8');
      expect(steps[1]).toHaveClass('w-8');
    });

    it('applies narrow width to future steps', () => {
      const { container } = render(<StepIndicator currentStep={0} totalSteps={3} />);
      
      const steps = container.querySelectorAll('.h-1\\.5');
      // Future steps should have w-4 class
      expect(steps[2]).toHaveClass('w-4');
    });
  });

  describe('Edge cases', () => {
    it('handles currentStep of 0', () => {
      const { container } = render(<StepIndicator currentStep={0} totalSteps={3} />);
      
      const steps = container.querySelectorAll('.h-1\\.5');
      expect(steps[0]).toHaveClass('bg-brand');
    });

    it('handles currentStep equal to last step', () => {
      const { container } = render(<StepIndicator currentStep={2} totalSteps={3} />);
      
      const steps = container.querySelectorAll('.h-1\\.5');
      expect(steps[2]).toHaveClass('bg-brand');
    });

    it('handles currentStep beyond total steps', () => {
      const { container } = render(<StepIndicator currentStep={5} totalSteps={3} />);
      
      // Should not crash and render all 3 steps
      const steps = container.querySelectorAll('.h-1\\.5');
      expect(steps).toHaveLength(3);
    });
  });

  describe('Container styling', () => {
    it('renders with flex container', () => {
      const { container } = render(<StepIndicator currentStep={0} />);
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('flex');
      expect(wrapper).toHaveClass('items-center');
    });

    it('has gap between steps', () => {
      const { container } = render(<StepIndicator currentStep={0} />);
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('gap-1');
    });
  });
});
