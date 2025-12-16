/**
 * ProgressStep - Individual step in progress indicator
 */

import { motion } from "framer-motion";
import { Check, LucideIcon } from "lucide-react";

interface ProgressStepProps {
  step: number;
  currentStep: number;
  icon: LucideIcon;
  label: string;
}

export function ProgressStep({ step, currentStep, icon: Icon, label }: ProgressStepProps) {
  const isActive = currentStep >= step;
  const isCurrent = currentStep === step;
  
  return (
    <div className="flex flex-col items-center">
      <motion.div
        className={`
          w-10 h-10 rounded-full flex items-center justify-center transition-all
          ${isActive 
            ? 'bg-gradient-to-br from-brand to-brand-500 text-white shadow-lg shadow-brand-500/30' 
            : 'bg-gray-100 text-gray-400'
          }
          ${isCurrent ? 'ring-4 ring-brand-100' : ''}
        `}
        animate={isCurrent ? { scale: [1, 1.05, 1] } : {}}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        {isActive && currentStep > step ? (
          <Check className="w-5 h-5" />
        ) : (
          <Icon className="w-5 h-5" />
        )}
      </motion.div>
      <span className={`text-xs mt-1.5 font-medium ${isActive ? 'text-brand' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  );
}

export default ProgressStep;
