/**
 * GettingStartedCard Component
 * 
 * Shows verification status and prompts for new users:
 * - Verification progress (email, phone, ID)
 * - First sale prompt when no transactions
 * - Profile completion checklist
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  Mail, 
  Phone, 
  CheckCircle2,
  Wrench,
  Rocket,
  ArrowRight,
  Sparkles,
  MapPin,
  User as UserIcon,
  ChevronDown
} from "lucide-react";

import type { User as UserType, Tool, Transaction } from "@/types";

interface GettingStartedCardProps {
  user: UserType;
  tools: Tool[];
  transactions: Transaction[];
  onEditProfile?: () => void;
  className?: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  action?: () => void;
  actionLabel?: string;
  icon: typeof Shield;
}

export default function GettingStartedCard({ 
  user, 
  tools = [], 
  transactions = [],
  onEditProfile,
  className = "" 
}: GettingStartedCardProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);
  
  const completedTransactions = transactions.filter(t => t.status === 'COMPLETED').length;
  const hasFirstSale = completedTransactions > 0;

  // Build checklist items
  const checklist: ChecklistItem[] = [
    {
      id: 'email',
      label: 'Verify Email',
      description: 'Confirm your email address',
      completed: !!user?.emailVerified,
      action: () => navigate('/Verification'),
      actionLabel: 'Verify',
      icon: Mail,
    },
    {
      id: 'phone',
      label: 'Add Phone Number',
      description: 'Add and verify your phone',
      completed: !!user?.phone,
      action: () => navigate('/Verification'),
      actionLabel: 'Add',
      icon: Phone,
    },
    {
      id: 'profile',
      label: 'Complete Profile',
      description: 'Add your name and bio',
      completed: !!(user?.name && user?.bio),
      action: onEditProfile,
      actionLabel: 'Edit',
      icon: UserIcon,
    },
    {
      id: 'location',
      label: 'Set Location',
      description: 'Add your postcode',
      completed: !!user?.locationAddress,
      action: onEditProfile,
      actionLabel: 'Add',
      icon: MapPin,
    },
    {
      id: 'listing',
      label: 'Create First Listing',
      description: 'List a tool or service',
      completed: tools.length > 0,
      action: () => navigate('/CreateOffer'),
      actionLabel: 'Create',
      icon: Wrench,
    },
    {
      id: 'sale',
      label: 'Complete First Transaction',
      description: 'Get your first sale or rental',
      completed: hasFirstSale,
      icon: Rocket,
    },
  ];

  const completedCount = checklist.filter(item => item.completed).length;
  const totalCount = checklist.length;
  const progressPercentage = Math.round((completedCount / totalCount) * 100);
  const allComplete = completedCount === totalCount;

  // Don't show if everything is complete
  if (allComplete) {
    return null;
  }

  return (
    <Card className={`border-none shadow-lg overflow-hidden ${className}`}>
      {/* Header with gradient - clickable to collapse */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-gradient-to-r from-brand-800 to-[#FF6F00] px-6 py-4 text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Get Started</h3>
              <p className="text-orange-100 text-sm">Complete your profile to build trust</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-white/20 text-white border-0">
              {completedCount}/{totalCount} complete
            </Badge>
            <ChevronDown className={`w-5 h-5 text-white transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="mt-4">
          <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
            <motion.div 
              className="bg-white h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="p-6">
        {/* First sale prompt if no transactions */}
        {!hasFirstSale && tools.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Rocket className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900">Ready for your first transaction!</h4>
                <p className="text-sm text-blue-700 mt-1">
                  You have {tools.length} listing{tools.length > 1 ? 's' : ''} ready. Share them to get your first customer.
                </p>
                <Button 
                  size="sm" 
                  className="mt-3 bg-blue-600 hover:bg-blue-700"
                  onClick={() => navigate('/Browse')}
                >
                  Explore Marketplace
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Checklist */}
        <div className="space-y-3">
          {checklist.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                  item.completed 
                    ? 'bg-green-50' 
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                {/* Status icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  item.completed 
                    ? 'bg-green-100' 
                    : 'bg-gray-200'
                }`}>
                  {item.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <Icon className="w-4 h-4 text-gray-500" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${
                    item.completed ? 'text-green-800' : 'text-gray-900'
                  }`}>
                    {item.label}
                  </p>
                  <p className={`text-sm ${
                    item.completed ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {item.completed ? 'Completed' : item.description}
                  </p>
                </div>

                {/* Action button */}
                {!item.completed && item.action && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={item.action}
                    className="flex-shrink-0"
                  >
                    {item.actionLabel}
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>
      </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
