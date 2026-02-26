/**
 * RequestHero - Professional hero section for job request details
 *
 * Features:
 * - Clean, subtle styling with light backgrounds
 * - Category-colored accent badges
 * - Clear typography hierarchy
 * - Budget display with professional formatting
 * - Subtle entrance animations
 */

import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Globe, Banknote } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { formatPrice } from '@/utils';

// Category accent colors (subtle, professional)
const CATEGORY_ACCENTS: Record<string, string> = {
  TOOLS: 'bg-amber-50 text-amber-700 border-amber-200',
  EXPERTISE: 'bg-blue-50 text-blue-700 border-blue-200',
  SPACE: 'bg-purple-50 text-purple-700 border-purple-200',
};

// Urgency configurations
const URGENCY_CONFIG: Record<string, { label: string; className: string }> = {
  ASAP: { label: 'ASAP', className: 'bg-red-500 text-white' },
  TODAY: { label: 'Today', className: 'bg-brand-500 text-white' },
  THIS_WEEKEND: { label: 'This Weekend', className: 'bg-amber-500 text-white' },
  FLEXIBLE: { label: 'Flexible', className: 'bg-emerald-500 text-white' },
};

// Get outward code from UK postcode (e.g., "HR6" from "HR6 9AA")
// For privacy, we only show the area code, not the full postcode
const getOutwardCode = (input?: string) => {
  if (!input) return '';
  const cleaned = input.toString().replace(/\s+/g, '').toUpperCase();
  if (cleaned.length >= 5 && cleaned.length <= 7) {
    return cleaned.slice(0, -3);
  }
  return cleaned;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

interface RequestHeroProps {
  title: string;
  category: string;
  categoryLabel: string;
  urgency: string;
  postcode?: string;
  locationAddress?: string;
  broadcastRadius?: number;
  createdDate: string;
  budget?: number | null;
  rateType?: string;
  status: string;
}

export default function RequestHero({
  title,
  category,
  categoryLabel,
  urgency,
  postcode,
  locationAddress,
  broadcastRadius,
  createdDate,
  budget,
  rateType,
  status,
}: RequestHeroProps) {
  const categoryAccent = CATEGORY_ACCENTS[category] || CATEGORY_ACCENTS.TOOLS;
  const urgencyConfig = URGENCY_CONFIG[urgency] || URGENCY_CONFIG.FLEXIBLE;
  const isNationwide = broadcastRadius !== undefined && broadcastRadius >= 999;
  const isActive = status === 'ACTIVE';

  const getRateLabel = () => {
    switch (rateType) {
      case 'HOURLY': return '/hr';
      case 'DAILY': return '/day';
      default: return '';
    }
  };

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
      <motion.div
        className="max-w-7xl mx-auto px-4 py-8 md:py-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Badges Row */}
        <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-2 mb-4">
          <Badge className={`${urgencyConfig.className} font-semibold px-3 py-1`}>
            {urgencyConfig.label}
          </Badge>
          <Badge className={`${categoryAccent} border font-medium px-3 py-1`}>
            {categoryLabel}
          </Badge>
          {isNationwide && (
            <Badge className="bg-blue-50 text-blue-700 border border-blue-200 font-medium px-3 py-1">
              <Globe className="w-3 h-3 mr-1" />
              Nationwide
            </Badge>
          )}
          {!isActive && (
            <Badge variant="secondary" className="bg-gray-100 text-gray-600 font-medium">
              {status}
            </Badge>
          )}
        </motion.div>

        {/* Title */}
        <motion.h1
          variants={itemVariants}
          className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-5 leading-tight"
        >
          {title}
        </motion.h1>

        {/* Meta Row & Budget */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          {/* Location & Time */}
          <div className="flex flex-wrap items-center gap-4 text-gray-600">
            {(postcode || locationAddress) && (
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <MapPin className="w-4 h-4 text-gray-400" />
                {postcode ? getOutwardCode(postcode) : locationAddress}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-sm">
              <Clock className="w-4 h-4 text-gray-400" />
              Posted {formatDistanceToNow(new Date(createdDate), { addSuffix: true })}
            </span>
          </div>

          {/* Budget Display */}
          {budget && (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
              <Banknote className="w-5 h-5 text-emerald-600" />
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-gray-900">
                  {formatPrice(budget)}
                </span>
                {getRateLabel() && (
                  <span className="text-sm text-gray-500 font-medium">
                    {getRateLabel()}
                  </span>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
