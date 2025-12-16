/**
 * StepIndicator - Premium step progress indicator
 */

import { motion } from "framer-motion";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps?: number;
}

export function StepIndicator({ currentStep, totalSteps = 2 }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <motion.div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < currentStep 
              ? 'bg-gradient-to-r from-brand to-brand-500 w-8' 
              : i === currentStep 
                ? 'bg-brand w-12' 
                : 'bg-gray-200 w-4'
          }`}
          initial={false}
          animate={{ 
            width: i < currentStep ? 32 : i === currentStep ? 48 : 16,
            opacity: i <= currentStep ? 1 : 0.5
          }}
        />
      ))}
    </div>
  );
}

export default StepIndicator;
