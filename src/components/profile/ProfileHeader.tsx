/**
 * ProfileHeader Component
 * 
 * Modern profile header with cover photo, overlapping avatar,
 * inline stats, and prominent verification badges.
 */

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { 
  MapPin, 
  Calendar, 
  Edit, 
  LogOut, 
  Star, 
  Share2, 
  Copy, 
  Check, 
  Shield, 
  CheckCircle2, 
  Camera,
  Sparkles,
  Award,
  Trophy,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import type { User, Tool, Review, Transaction } from "@/types";
import type { LucideIcon } from "lucide-react";

interface VerificationBadge {
  icon: LucideIcon;
  label: string;
  verified: boolean;
}

interface ProfileHeaderProps {
  currentUser: User;
  tools: Tool[];
  reviews: Review[];
  transactions: Transaction[];
  onEditProfile: () => void;
  onLogout: () => void;
}

// Verification badge with tooltip
function VerificationBadgeItem({ badge }: { badge: VerificationBadge }) {
  const Icon = badge.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          <Badge 
            variant="outline"
            className={`${
              badge.verified 
                ? 'bg-green-50 text-green-700 border-green-200' 
                : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}
          >
            <Icon className="w-3 h-3 mr-1" />
            {badge.label}
            {badge.verified && <CheckCircle2 className="w-3 h-3 ml-1 text-green-600" />}
          </Badge>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{badge.verified ? `${badge.label} ✓` : `${badge.label} not verified`}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function ProfileHeader({ 
  currentUser, 
  tools = [], 
  reviews = [],
  transactions = [],
  onEditProfile,
  onLogout
}: ProfileHeaderProps) {
  const [copied, setCopied] = useState(false);

  const memberDate = currentUser?.createdDate
    ? format(new Date(currentUser.createdDate), 'MMM yyyy')
    : null;

  const rating = currentUser?.rating ?? 0;

  // Calculate real stats from transactions
  const completedCount = transactions.filter(t => t.status === 'COMPLETED').length;
  const isTrustedMember = completedCount >= 5; // Trusted after 5 completed transactions

  // Build verification badges
  const verificationBadges: VerificationBadge[] = [
    { icon: Shield, label: "Email", verified: !!currentUser?.emailVerified },
    { icon: Shield, label: "Phone", verified: !!currentUser?.phone },
    { icon: Shield, label: "ID", verified: !!currentUser?.idVerified },
  ];

  const handleCopyLink = async () => {
    const profileUrl = `${window.location.origin}/user/${currentUser?.id}`;
    await navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    toast.success("Profile link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const profileUrl = `${window.location.origin}/user/${currentUser?.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${currentUser?.name || 'User'} on SpannerWork`,
          text: `Check out ${currentUser?.name}'s profile on SpannerWork`,
          url: profileUrl,
        });
      } catch {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <TooltipProvider>
      <div className="relative">
        {/* Cover Photo */}
        <div className="h-40 relative overflow-hidden">
          {/* Gradient background with pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900" />
          
          {/* Animated background elements */}
          <div className="absolute inset-0 opacity-20 bg-dot-pattern-md" />
          
          {/* Floating orbs */}
          <motion.div 
            className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"
            animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute -bottom-32 -left-32 w-80 h-80 bg-brand-300/10 rounded-full blur-3xl"
            animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-yellow-400/5 rounded-full blur-3xl"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Cover photo overlay - could be user's actual cover photo */}
          {currentUser?.coverPhoto && (
            <img
              src={currentUser.coverPhoto}
              alt="Cover"
              className="absolute inset-0 w-full h-full object-cover opacity-50"
            />
          )}

          {/* Top actions */}
          <div className="absolute top-4 right-4 flex gap-2">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleShare}
                className="bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyLink}
                className="bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Profile Content */}
        <div className="max-w-6xl mx-auto px-4 md:px-6 pb-8 mb-8">
          <div className="relative -mt-6">
            <motion.div 
              className="bg-white rounded-2xl shadow-xl p-6 md:p-10 border border-gray-100"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex flex-col md:flex-row gap-8">
                {/* Avatar */}
                <div className="relative mx-auto md:mx-0 flex-shrink-0">
                  <motion.div 
                    className="relative"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-800 to-[#FF6F00] rounded-full blur-lg opacity-30 scale-110" />
                    <Avatar className="w-28 h-28 md:w-36 md:h-36 border-4 border-white shadow-2xl relative">
                      <AvatarImage src={currentUser?.avatar ?? undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-brand-800 to-[#FF6F00] text-white text-4xl font-bold">
                        {currentUser?.name?.[0]?.toUpperCase() || currentUser?.email?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    
                    {/* Trusted member badge */}
                    {isTrustedMember && (
                      <motion.div 
                        className="absolute -bottom-2 -right-2 bg-gradient-to-br from-amber-400 to-brand-500 rounded-full p-2 shadow-lg"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5, type: "spring" }}
                      >
                        <Trophy className="w-5 h-5 text-white" />
                      </motion.div>
                    )}

                    {/* Edit avatar button */}
                    <button 
                      onClick={onEditProfile}
                      className="absolute bottom-0 right-0 md:bottom-2 md:right-2 bg-white rounded-full p-2 shadow-md hover:shadow-lg transition-shadow border border-gray-100"
                    >
                      <Camera className="w-4 h-4 text-gray-600" />
                    </button>
                  </motion.div>
                </div>

                {/* User Info - Clean vertical layout */}
                <div className="flex-1 text-center md:text-left pt-2 md:pt-0">
                  {/* Row 1: Name + Actions */}
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-3">
                    <div>
                      <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                          {currentUser?.name || currentUser?.email?.split('@')[0] || 'User'}
                        </h1>
                        {isTrustedMember && (
                          <Badge className="bg-gradient-to-r from-amber-400 to-brand-500 text-white w-fit mx-auto md:mx-0 shadow-md">
                            <Sparkles className="w-3 h-3 mr-1" />
                            Trusted Member
                          </Badge>
                        )}
                      </div>
                      {currentUser?.username && (
                        <p className="text-gray-500">@{currentUser.username}</p>
                      )}
                    </div>
                    
                    {/* Action buttons - top right */}
                    <div className="flex gap-2 justify-center md:justify-end">
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          onClick={onEditProfile}
                          className="bg-brand-800 hover:bg-brand-900 text-white shadow-lg"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Profile
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          onClick={onLogout}
                          variant="outline"
                          className="border-gray-200 text-gray-600 hover:bg-gray-50"
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          Logout
                        </Button>
                      </motion.div>
                    </div>
                  </div>

                  {/* Row 2: Meta info pills */}
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4 text-sm">
                    {currentUser?.locationAddress && (
                      <span className="flex items-center gap-1.5 text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
                        <MapPin className="w-3.5 h-3.5 text-gray-500" />
                        {currentUser.locationAddress}
                      </span>
                    )}
                    {memberDate && (
                      <span className="flex items-center gap-1.5 text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
                        <Calendar className="w-3.5 h-3.5 text-gray-500" />
                        Member since {memberDate}
                      </span>
                    )}
                  </div>

                  {/* Row 3: Bio */}
                  {currentUser?.bio && (
                    <p className="text-gray-600 mb-4 max-w-2xl leading-relaxed">{currentUser.bio}</p>
                  )}

                  {/* Row 4: All badges in one row */}
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start items-center">
                    {/* Verification badges */}
                    {verificationBadges.filter(b => b.verified).map((badge, index) => (
                      <VerificationBadgeItem key={index} badge={badge} />
                    ))}
                    
                    {/* Separator if we have both verification and stats */}
                    {verificationBadges.filter(b => b.verified).length > 0 && (reviews.length > 0 || completedCount > 0 || tools.length > 0) && (
                      <div className="hidden md:block w-px h-6 bg-gray-200 mx-1" />
                    )}
                    
                    {/* Quick Stats */}
                    {reviews.length > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-full text-sm">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span className="font-semibold text-gray-900">{rating.toFixed(1)}</span>
                        <span className="text-gray-500">({reviews.length})</span>
                      </div>
                    )}
                    {completedCount > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-full text-sm">
                        <Award className="w-3.5 h-3.5 text-blue-500" />
                        <span className="font-semibold text-gray-900">{completedCount}</span>
                        <span className="text-gray-500">done</span>
                      </div>
                    )}
                    {tools.length > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 rounded-full text-sm">
                        <Clock className="w-3.5 h-3.5 text-purple-500" />
                        <span className="font-semibold text-gray-900">{tools.length}</span>
                        <span className="text-gray-500">listings</span>
                      </div>
                    )}
                    
                    {/* New member badge if no stats yet */}
                    {reviews.length === 0 && completedCount === 0 && tools.length === 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 rounded-full text-sm">
                        <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                        <span className="font-medium text-brand-700">New Member</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
