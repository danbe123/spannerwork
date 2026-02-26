/**
 * VerificationCard Component
 *
 * Clickable card showing verification status for the Profile page.
 * Links to full verification center for completing verifications.
 */

import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Shield,
  Mail,
  Phone,
  FileCheck,
  ShieldCheck,
  ChevronRight,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

import type { User } from "@/types";

interface VerificationCardProps {
  user: User;
  className?: string;
}

interface VerificationItem {
  id: string;
  label: string;
  description: string;
  verified: boolean;
  icon: typeof Shield;
  color: string;
}

export default function VerificationCard({ user, className = "" }: VerificationCardProps) {
  const navigate = useNavigate();

  const verifications: VerificationItem[] = [
    {
      id: 'email',
      label: 'Email',
      description: 'Receive important notifications',
      verified: !!user?.emailVerified,
      icon: Mail,
      color: 'blue',
    },
    {
      id: 'phone',
      label: 'Mobile',
      description: 'SMS notifications & 2FA',
      verified: !!user?.phoneVerified,
      icon: Phone,
      color: 'orange',
    },
    {
      id: 'id',
      label: 'ID',
      description: 'Government ID verification',
      verified: !!user?.idVerified,
      icon: FileCheck,
      color: 'purple',
    },
    {
      id: 'insurance',
      label: 'Insurance',
      description: 'Proof of coverage',
      verified: !!user?.insuranceVerified,
      icon: ShieldCheck,
      color: 'green',
    },
  ];

  const verifiedCount = verifications.filter(v => v.verified).length;
  const totalCount = verifications.length;
  const progressPercentage = Math.round((verifiedCount / totalCount) * 100);
  const allVerified = verifiedCount === totalCount;

  const getColorClasses = (color: string, verified: boolean) => {
    if (!verified) return 'bg-gray-100 text-gray-400';
    switch (color) {
      case 'blue': return 'bg-blue-100 text-blue-600';
      case 'orange': return 'bg-brand-100 text-brand-600';
      case 'purple': return 'bg-purple-100 text-purple-600';
      case 'green': return 'bg-green-100 text-green-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <Card
        className={`border-none shadow-lg cursor-pointer hover:shadow-xl transition-shadow overflow-hidden ${className}`}
        onClick={() => navigate('/verification')}
      >
        {/* Header */}
        <div className={`px-6 py-4 ${allVerified ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 'bg-gradient-to-r from-brand-800 to-brand-900'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Verification Status</h3>
                <p className="text-white/70 text-sm">
                  {allVerified ? 'Fully verified account' : 'Build trust with verifications'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`${allVerified ? 'bg-white/20' : 'bg-white/10'} text-white border-0`}>
                {verifiedCount}/{totalCount}
              </Badge>
              <ChevronRight className="w-5 h-5 text-white/70" />
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <Progress
              value={progressPercentage}
              className="h-2 bg-white/20"
            />
          </div>
        </div>

        <CardContent className="p-4">
          {/* Verification Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {verifications.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className={`relative p-3 rounded-lg border ${
                    item.verified
                      ? 'border-green-200 bg-green-50/50'
                      : 'border-gray-200 bg-gray-50/50'
                  }`}
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getColorClasses(item.color, item.verified)}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${item.verified ? 'text-gray-900' : 'text-gray-500'}`}>
                        {item.label}
                      </p>
                      {item.verified ? (
                        <div className="flex items-center justify-center gap-1 mt-0.5">
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                          <span className="text-xs text-green-600 font-medium">Verified</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1 mt-0.5">
                          <AlertCircle className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-400">Not verified</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Call to action */}
          {!allVerified && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-600 text-center">
                Complete verifications to unlock more features and build trust
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
