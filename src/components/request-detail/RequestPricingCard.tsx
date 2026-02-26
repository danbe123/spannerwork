/**
 * RequestPricingCard - Clear budget/pricing display with urgency
 *
 * Displays:
 * - Large budget amount
 * - Rate type badge (Fixed/Hourly/Daily)
 * - Urgency indicator
 * - Response count
 */

import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import {
  Banknote,
  Clock,
  Zap,
  Users,
  AlertTriangle
} from 'lucide-react';
import { formatPrice } from '@/utils';

interface RequestPricingCardProps {
  budget?: number | null;
  rateType?: string;
  urgency: string;
  responseCount: number;
}

// Urgency configuration
const URGENCY_CONFIG: Record<string, {
  label: string;
  bg: string;
  text: string;
  icon: typeof Zap;
  description: string;
}> = {
  ASAP: {
    label: 'ASAP',
    bg: 'bg-red-500',
    text: 'text-white',
    icon: AlertTriangle,
    description: 'Needed urgently'
  },
  TODAY: {
    label: 'Today',
    bg: 'bg-brand-500',
    text: 'text-white',
    icon: Zap,
    description: 'Needed today'
  },
  THIS_WEEKEND: {
    label: 'This Weekend',
    bg: 'bg-amber-500',
    text: 'text-white',
    icon: Clock,
    description: 'Needed this weekend'
  },
  FLEXIBLE: {
    label: 'Flexible',
    bg: 'bg-emerald-500',
    text: 'text-white',
    icon: Clock,
    description: 'Flexible timing'
  },
};

// Rate type labels
const RATE_TYPE_LABELS: Record<string, string> = {
  FIXED: 'Fixed Price',
  HOURLY: 'Per Hour',
  DAILY: 'Per Day',
};

export default function RequestPricingCard({
  budget,
  rateType = 'FIXED',
  urgency,
  responseCount
}: RequestPricingCardProps) {
  const urgencyConfig = URGENCY_CONFIG[urgency] || URGENCY_CONFIG.FLEXIBLE;
  const UrgencyIcon = urgencyConfig.icon;
  const rateLabel = RATE_TYPE_LABELS[rateType] || 'Fixed Price';

  const getRateDisplay = () => {
    if (budget === undefined || budget === null) return null;
    switch(rateType) {
      case 'HOURLY': return `${formatPrice(budget)}/hr`;
      case 'DAILY': return `${formatPrice(budget)}/day`;
      default: return formatPrice(budget);
    }
  };

  const priceDisplay = getRateDisplay();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Header with accent */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3">
        <div className="flex items-center gap-2 text-white">
          <Banknote className="w-5 h-5" />
          <span className="font-semibold">Job Details</span>
        </div>
      </div>

      <div className="p-6">
        {/* Budget Section */}
        {priceDisplay && (
          <div className="mb-6 text-center pb-6 border-b border-gray-100">
            <div className="text-sm text-gray-500 mb-1">Budget</div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{priceDisplay}</div>
            <Badge variant="secondary" className="bg-gray-100 text-gray-600 font-medium">
              {rateLabel}
            </Badge>
          </div>
        )}

        {/* Urgency Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <UrgencyIcon className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-500">Urgency</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${urgencyConfig.bg} ${urgencyConfig.text} text-sm font-semibold px-3 py-1`}>
              {urgencyConfig.label}
            </Badge>
            <span className="text-sm text-gray-500">{urgencyConfig.description}</span>
          </div>
        </div>

        {/* Responses Section */}
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-700">
                {responseCount} {responseCount === 1 ? 'quote' : 'quotes'} received
              </span>
            </div>
            {responseCount === 0 && (
              <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2.5 py-1 rounded-full">
                Be first!
              </span>
            )}
            {responseCount > 0 && responseCount < 5 && (
              <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2.5 py-1 rounded-full">
                Low competition
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
