/**
 * SuccessCelebration - Success modal with confetti animation
 */

import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Zap, Users, Shield, Rocket, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brandColors } from "@/lib/colors";

// Confetti particle component
function ConfettiParticle({ delay, color }: { delay: number; color: string }) {
  return (
    <motion.div
      className="absolute w-3 h-3 rounded-sm"
      style={{ backgroundColor: color }}
      initial={{ 
        y: -20, 
        x: Math.random() * 400 - 200,
        rotate: 0,
        opacity: 1 
      }}
      animate={{ 
        y: 400,
        x: Math.random() * 200 - 100,
        rotate: Math.random() * 720,
        opacity: 0
      }}
      transition={{ 
        duration: 2 + Math.random(),
        delay: delay,
        ease: "easeOut"
      }}
    />
  );
}

// Brand colors for confetti - uses Tailwind brand palette
const CONFETTI_COLORS = [brandColors[800], brandColors[500], '#FFC107', '#4CAF50', '#2196F3', '#9C27B0'];

interface SuccessCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  onReset: () => void;
  intent: string;
}

export function SuccessCelebration({ isOpen, onClose, onReset, intent }: SuccessCelebrationProps) {
  const navigate = useNavigate();
  
  if (!isOpen) return null;

  const isJob = intent === 'need';
  const title = isJob ? 'Job Posted!' : 'Listing Created!';
  const subtitle = isJob 
    ? 'Your job is now live. Providers in your area will be notified.' 
    : 'Your listing is now visible to potential customers.';

  const handleCreateAnother = () => {
    onClose();
    onReset();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    >
      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 50 }).map((_, i) => (
          <ConfettiParticle 
            key={i} 
            delay={i * 0.02} 
            color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]} 
          />
        ))}
      </div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 15 }}
        className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center relative overflow-hidden"
      >
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 to-amber-50 opacity-50" />
        
        <div className="relative">
          {/* Success icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4 }}
            >
              <CheckCircle2 className="w-12 h-12 text-white" />
            </motion.div>
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold text-gray-900 mb-2"
          >
            {title}
          </motion.h2>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-gray-600 mb-8"
          >
            {subtitle}
          </motion.p>

          {/* Stats/Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex justify-center gap-6 mb-8"
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-2">
                <Zap className="w-6 h-6 text-brand" />
              </div>
              <p className="text-sm text-gray-600">Instant visibility</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-sm text-gray-600">Local providers</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Shield className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">Protected</p>
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="space-y-3"
          >
            <Button
              onClick={() => navigate(isJob ? '/feed' : '/profile')}
              className="w-full h-12 bg-gradient-to-r from-brand to-brand-500 hover:from-brand-900 hover:to-brand-700 text-white font-semibold shadow-lg"
            >
              <Rocket className="w-5 h-5 mr-2" />
              {isJob ? 'View Feed' : 'View My Listings'}
            </Button>
            <Button
              variant="outline"
              onClick={handleCreateAnother}
              className="w-full h-12"
            >
              <PartyPopper className="w-5 h-5 mr-2" />
              Create Another
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default SuccessCelebration;
