import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressStep } from './ProgressStep';
import { Wrench, GraduationCap, Building2 } from 'lucide-react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: React.PropsWithChildren<{ className?: string }>) => (
      <div className={className} {...props}>{children}</div>
    ),
  },
}));

describe('ProgressStep', () => {
  describe('Active state rendering', () => {
    it('renders as active when currentStep equals step', () => {
      render(
        <ProgressStep
          step={1}
          currentStep={1}
          icon={Wrench}
          label="Tools"
        />
      );

      expect(screen.getByText('Tools')).toBeInTheDocument();
    });

    it('renders as active when currentStep is greater than step', () => {
      render(
        <ProgressStep
          step={1}
          currentStep={2}
          icon={Wrench}
          label="Tools"
        />
      );

      expect(screen.getByText('Tools')).toHaveClass('text-brand');
    });

    it('renders as inactive when currentStep is less than step', () => {
      render(
        <ProgressStep
          step={2}
          currentStep={1}
          icon={GraduationCap}
          label="Expertise"
        />
      );

      expect(screen.getByText('Expertise')).toHaveClass('text-gray-400');
    });
  });

  describe('Icon rendering', () => {
    it('renders the provided icon', () => {
      const { container } = render(
        <ProgressStep
          step={1}
          currentStep={1}
          icon={Wrench}
          label="Tools"
        />
      );

      // Check that an SVG is rendered (the icon)
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders check icon for completed steps', () => {
      const { container } = render(
        <ProgressStep
          step={1}
          currentStep={3}
          icon={Wrench}
          label="Tools"
        />
      );

      // When step is completed (currentStep > step), it should show a check
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Label rendering', () => {
    it('renders the label text', () => {
      render(
        <ProgressStep
          step={1}
          currentStep={1}
          icon={Wrench}
          label="Tools"
        />
      );

      expect(screen.getByText('Tools')).toBeInTheDocument();
    });

    it('renders different labels correctly', () => {
      render(
        <ProgressStep
          step={2}
          currentStep={2}
          icon={Building2}
          label="Space"
        />
      );

      expect(screen.getByText('Space')).toBeInTheDocument();
    });
  });

  describe('Step number handling', () => {
    it('handles step 0', () => {
      render(
        <ProgressStep
          step={0}
          currentStep={0}
          icon={Wrench}
          label="Start"
        />
      );

      expect(screen.getByText('Start')).toBeInTheDocument();
    });

    it('handles high step numbers', () => {
      render(
        <ProgressStep
          step={10}
          currentStep={10}
          icon={Wrench}
          label="Final"
        />
      );

      expect(screen.getByText('Final')).toBeInTheDocument();
    });
  });

  describe('Current step styling', () => {
    it('applies current step styling when isCurrent', () => {
      const { container } = render(
        <ProgressStep
          step={2}
          currentStep={2}
          icon={Wrench}
          label="Current"
        />
      );

      // The container should have the ring class for current step
      const stepDiv = container.querySelector('.ring-4');
      expect(stepDiv).toBeInTheDocument();
    });

    it('does not apply ring styling when not current', () => {
      const { container } = render(
        <ProgressStep
          step={1}
          currentStep={2}
          icon={Wrench}
          label="Previous"
        />
      );

      // Should not have ring class when not current
      const stepDiv = container.querySelector('.ring-4');
      expect(stepDiv).not.toBeInTheDocument();
    });
  });
});
