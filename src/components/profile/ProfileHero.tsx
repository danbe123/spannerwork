/**
 * ProfileHero Component
 * 
 * Displays the user's profile header with avatar, name, badges, and stats.
 */

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { 
  Star, 
  Award, 
  Edit, 
  Trophy,
  LogOut,
  Wrench,
  MapPin,
  Calendar,
  Sparkles,
  LucideIcon
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { User, Tool, Review } from "@/types";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

interface StatPillProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  color?: "white" | "gold";
}

function StatPill({ icon: Icon, value, label, color = "white" }: StatPillProps) {
  return (
    <motion.div 
      className="flex items-center gap-2 bg-white/10 px-4 py-2.5 rounded-xl backdrop-blur-sm border border-white/10"
      whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.15)' }}
      whileTap={{ scale: 0.98 }}
    >
      <Icon className={`w-5 h-5 ${color === 'gold' ? 'fill-[#FFC107] text-[#FFC107]' : 'text-white'}`} />
      <span className="font-bold text-white">{value}</span>
      <span className="text-orange-200 text-sm">{label}</span>
    </motion.div>
  );
}

interface VerificationBadge {
  icon: LucideIcon;
  label: string;
}

interface ProfileHeroProps {
  currentUser: User | undefined;
  tools?: Tool[];
  reviews?: Review[];
  verificationBadges?: VerificationBadge[];
  completionPercentage?: number;
  onEditProfile: () => void;
  onLogout: () => void;
}

export default function ProfileHero({ 
  currentUser, 
  tools = [], 
  reviews = [], 
  verificationBadges = [],
  completionPercentage = 0,
  onEditProfile,
  onLogout
}: ProfileHeroProps) {
  const memberSince = currentUser?.createdDate 
    ? formatDistanceToNow(new Date(currentUser.createdDate), { addSuffix: false })
    : null;

  return (
    <div className="bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 px-6 py-12 md:py-16 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />
        {/* Floating orbs */}
        <motion.div 
          className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div 
          className="absolute -bottom-32 -left-32 w-96 h-96 bg-orange-400/10 rounded-full blur-3xl"
          animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </div>

      <motion.div 
        className="max-w-6xl mx-auto relative"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Avatar with glow effect */}
          <motion.div className="relative" variants={itemVariants}>
            <div className="absolute inset-0 bg-white/20 rounded-full blur-xl scale-110" />
            <Avatar className="w-36 h-36 border-4 border-white shadow-2xl relative">
              <AvatarImage src={currentUser?.avatar || undefined} />
              <AvatarFallback className="bg-white text-brand-800 text-4xl font-bold">
                {currentUser?.name?.[0]?.toUpperCase() || currentUser?.email?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            {(currentUser?.totalTransactions ?? 0) >= 5 && (
              <motion.div 
                className="absolute -bottom-2 -right-2 bg-gradient-to-br from-[#FFC107] to-[#FF9800] rounded-full p-2.5 shadow-lg"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
              >
                <Trophy className="w-6 h-6 text-gray-900" />
              </motion.div>
            )}
          </motion.div>

          {/* User Info */}
          <motion.div className="flex-1 text-center md:text-left" variants={itemVariants}>
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
              <h1 className="text-3xl md:text-4xl font-bold text-white">
                {currentUser?.name || currentUser?.email || 'User'}
              </h1>
              {(currentUser?.totalTransactions ?? 0) >= 5 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                >
                  <Badge className="bg-gradient-to-r from-[#FFC107] to-[#FF9800] text-gray-900 w-fit mx-auto md:mx-0 font-semibold shadow-lg px-3 py-1">
                    <Sparkles className="w-4 h-4 mr-1" />
                    Trusted Member
                  </Badge>
                </motion.div>
              )}
            </div>

            {/* Location & Member since */}
            <div className="flex flex-wrap gap-3 justify-center md:justify-start mb-4 text-orange-100 text-sm">
              {currentUser?.locationAddress && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {currentUser.locationAddress}
                </span>
              )}
              {memberSince && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Member for {memberSince}
                </span>
              )}
            </div>

            {/* Verification badges */}
            <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
              {verificationBadges.map((badge, index) => {
                const Icon = badge.icon;
                return (
                  <Badge key={index} variant="outline" className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                    <Icon className="w-3 h-3 mr-1" />
                    {badge.label}
                  </Badge>
                );
              })}
            </div>

            {/* Bio */}
            {currentUser?.bio && (
              <p className="text-orange-100 max-w-2xl mb-4">{currentUser.bio}</p>
            )}

            {/* Profile completion progress */}
            {completionPercentage < 100 && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm text-orange-100 mb-2">
                  <span>Profile Completion</span>
                  <span className="font-bold">{completionPercentage}%</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-[#FFC107] h-full transition-all duration-500 rounded-full"
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
              </div>
            )}

            {/* Stats row */}
            <motion.div 
              className="flex flex-wrap gap-3 text-white text-sm justify-center md:justify-start"
              variants={itemVariants}
            >
              <StatPill 
                icon={Star} 
                value={currentUser?.rating?.toFixed(1) || '0.0'}
                label={`(${reviews.length} reviews)`}
                color="gold"
              />
              <StatPill 
                icon={Award} 
                value={currentUser?.totalTransactions || 0}
                label="completed"
              />
              <StatPill 
                icon={Wrench} 
                value={tools.length}
                label="tools"
              />
            </motion.div>
          </motion.div>

          {/* Action buttons */}
          <motion.div className="flex flex-col gap-3" variants={itemVariants}>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={onEditProfile}
                className="bg-white text-brand-800 hover:bg-orange-50 font-semibold shadow-xl px-6 py-5"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={onLogout}
                variant="outline"
                className="bg-white/10 backdrop-blur-sm border-2 border-white/50 text-white hover:bg-white hover:text-brand-800 font-semibold transition-all px-6 py-5"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
