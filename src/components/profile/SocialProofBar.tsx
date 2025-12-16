/**
 * SocialProofBar Component
 * 
 * Displays key trust indicators:
 * - Response time
 * - Completion rate
 * - Member tenure
 * - Repeat customers
 */

import { motion } from "framer-motion";
import { 
  CheckCircle2, 
  Calendar, 
  Users,
  Shield,
  Award
} from "lucide-react";
import { differenceInMonths, differenceInYears } from "date-fns";

import type { User, Transaction } from "@/types";
import type { LucideIcon } from "lucide-react";

interface SocialProofBarProps {
  user: User;
  transactions: Transaction[];
  className?: string;
}

interface ProofItem {
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
  color: string;
  bgColor: string;
}

export default function SocialProofBar({ 
  user,
  transactions = [],
  className = ""
}: SocialProofBarProps) {
  // Calculate stats
  const completedCount = transactions.filter(t => t.status === 'COMPLETED').length;
  const totalCount = transactions.length;
  const completionRate = totalCount > 0 
    ? Math.round((completedCount / totalCount) * 100) 
    : 100;

  // Calculate repeat customers
  const customerIds = transactions
    .filter(t => t.status === 'COMPLETED')
    .map(t => t.userId);
  const uniqueCustomers = new Set(customerIds).size;
  const repeatCustomers = customerIds.length - uniqueCustomers;

  // Calculate member tenure
  const memberSince = user?.createdDate ? new Date(user.createdDate) : new Date();
  const monthsAsMember = differenceInMonths(new Date(), memberSince);
  const yearsAsMember = differenceInYears(new Date(), memberSince);

  let tenureText: string;
  if (yearsAsMember >= 1) {
    tenureText = `${yearsAsMember}+ year${yearsAsMember > 1 ? 's' : ''}`;
  } else if (monthsAsMember >= 1) {
    tenureText = `${monthsAsMember} month${monthsAsMember > 1 ? 's' : ''}`;
  } else {
    tenureText = 'New member';
  }

  // Build proof items - only show real data
  const proofItems: ProofItem[] = [
    {
      icon: Calendar,
      label: 'Member Since',
      value: tenureText,
      description: 'Trusted member for',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  // Only show completion rate if user has completed transactions
  if (completedCount > 0) {
    proofItems.unshift({
      icon: CheckCircle2,
      label: 'Completion Rate',
      value: `${completionRate}%`,
      description: 'Success rate',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    });
  }

  // Add repeat customers if applicable
  if (repeatCustomers > 0) {
    proofItems.push({
      icon: Users,
      label: 'Repeat Customers',
      value: `${repeatCustomers}`,
      description: 'Customers who came back',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    });
  }

  // Add total transactions if significant
  if (completedCount >= 5) {
    proofItems.push({
      icon: Award,
      label: 'Completed',
      value: `${completedCount}`,
      description: 'Successful transactions',
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
    });
  }

  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-brand-800" />
        <h3 className="font-semibold text-gray-900">Trust & Performance</h3>
      </div>
      
      <motion.div 
        className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
          }
        }}
      >
        {proofItems.map((item) => (
          <motion.div
            key={item.label}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 }
            }}
            whileHover={{ scale: 1.02, y: -2 }}
            className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-default"
          >
            <div className={`w-10 h-10 rounded-lg ${item.bgColor} flex items-center justify-center mb-3`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{item.value}</p>
            <p className="text-xs text-gray-500 mt-1">{item.description}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
