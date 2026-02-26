/**
 * SellerTrustCard - Prominent seller info with trust indicators
 *
 * Displays:
 * - Large avatar
 * - Name with verification badge
 * - Star rating + review count
 * - Member since date
 * - Trust badges (Verified, Quick Responder, etc.)
 * - Message button (for non-owners)
 */

import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import TrustSignals, { RatingWithTrust } from '@/components/profile/TrustSignals';
import {
  MessageCircle,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { User } from '@/types';
import { format } from 'date-fns';

interface SellerTrustCardProps {
  user: User;
  isOwnRequest: boolean;
  onMessage?: () => void;
  variant?: 'sidebar' | 'inline';
}

export default function SellerTrustCard({
  user,
  isOwnRequest,
  onMessage,
  variant = 'sidebar'
}: SellerTrustCardProps) {
  const memberSince = user.createdDate
    ? format(new Date(user.createdDate), 'MMMM yyyy')
    : null;

  const initials = user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U';

  if (variant === 'inline') {
    // Mobile-friendly inline version
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
      >
        <div className="flex items-start gap-4">
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 bg-brand-200 rounded-full blur-lg scale-110 opacity-30" />
            <Avatar className="w-16 h-16 border-2 border-white shadow-sm relative">
              {user.avatar ? (
                <AvatarImage src={user.avatar} alt={user.name || 'User'} className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-brand-100 to-brand-200 text-brand-800 font-bold text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-gray-900 text-lg truncate">{user.name || 'User'}</h3>
              {user.emailVerified && (
                <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
              )}
            </div>

            <RatingWithTrust
              rating={user.rating}
              reviewCount={user.totalReviews}
              className="mb-2"
            />

            {memberSince && (
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Member since {memberSince}
              </p>
            )}
          </div>

          {!isOwnRequest && onMessage && (
            <Button
              onClick={onMessage}
              variant="outline"
              size="sm"
              className="flex-shrink-0 rounded-xl"
            >
              <MessageCircle className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100">
          <TrustSignals user={user} size="sm" showAll className="justify-start" />
        </div>
      </motion.div>
    );
  }

  // Sidebar version (desktop)
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
    >
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Posted by
      </h3>

      <div className="flex flex-col items-center text-center mb-4">
        {/* Avatar with subtle glow effect */}
        <div className="relative mb-3">
          <div className="absolute inset-0 bg-brand-200 rounded-full blur-xl scale-110 opacity-40" />
          <Avatar className="w-20 h-20 border-4 border-white shadow-md relative">
            {user.avatar ? (
              <AvatarImage src={user.avatar} alt={user.name || 'User'} className="object-cover" />
            ) : null}
            <AvatarFallback className="bg-gradient-to-br from-brand-100 to-brand-200 text-brand-800 font-bold text-2xl">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="flex items-center gap-1.5 mb-1">
          <h4 className="font-bold text-gray-900 text-lg">{user.name || 'User'}</h4>
          {user.emailVerified && (
            <CheckCircle2 className="w-5 h-5 text-blue-500" />
          )}
        </div>

        <RatingWithTrust
          rating={user.rating}
          reviewCount={user.totalReviews}
          className="justify-center mb-2"
        />

        {memberSince && (
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Member since {memberSince}
          </p>
        )}
      </div>

      <div className="mb-4">
        <TrustSignals user={user} size="md" showAll className="justify-center" />
      </div>

      {!isOwnRequest && onMessage && (
        <Button
          onClick={onMessage}
          variant="outline"
          className="w-full rounded-xl h-11 hover:bg-gray-50"
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          Message
        </Button>
      )}
    </motion.div>
  );
}
