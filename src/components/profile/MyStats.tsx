import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Clock,
  Star,
  Award,
  Search,
  Gift,
  BarChart3,
  Shield,
  ArrowUpRight,
  LucideIcon
} from "lucide-react";
import { User, Transaction, Review } from "@/types";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  color: string;
  trend?: string | null;
}

function StatCard({ icon: Icon, value, label, color, trend = null }: StatCardProps) {
  return (
    <motion.div variants={cardVariants}>
      <Card className="border-none shadow-lg overflow-hidden group hover:shadow-xl transition-all">
        <CardContent className="p-6 relative">
          <div className={`absolute inset-0 opacity-5 bg-gradient-to-br ${color}`} />
          
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              {trend && (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                  <ArrowUpRight className="w-3 h-3" />
                  {trend}
                </span>
              )}
            </div>
            <motion.p 
              className="text-3xl font-bold text-gray-900"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              {value}
            </motion.p>
            <p className="text-sm text-gray-500 mt-1">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface QuickActionCardProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  color: string;
}

function QuickActionCard({ icon: Icon, label, onClick, color }: QuickActionCardProps) {
  return (
    <motion.div variants={cardVariants}>
      <Card 
        className="border-none shadow-md hover:shadow-xl transition-all cursor-pointer group overflow-hidden" 
        onClick={onClick}
      >
        <CardContent className="p-6 text-center relative">
          <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 bg-gradient-to-br ${color} transition-opacity`} />
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            className={`w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}
          >
            <Icon className="w-7 h-7 text-white" />
          </motion.div>
          <p className="font-semibold text-gray-900 group-hover:text-brand-800 transition-colors">{label}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface MyStatsProps {
  currentUser?: User;
  transactions?: Transaction[];
  reviews?: Review[];
}

export default function MyStats({ currentUser, transactions, reviews }: MyStatsProps) {
  const navigate = useNavigate();

  const totalEarnings = transactions
    ?.filter(t => t.providerId === currentUser?.id && t.status === 'COMPLETED')
    .reduce((sum, t) => sum + (t.rentalFee || 0), 0) || 0;

  const activeTransactionsCount = transactions?.filter(
    t => (t.providerId === currentUser?.id || t.userId === currentUser?.id) &&
        (t.status === 'PENDING' || t.status === 'CONFIRMED' || t.status === 'IN_PROGRESS')
  ).length || 0;

  const averageRating = currentUser?.rating || 0;
  const reputationScore = currentUser?.totalTransactions || 0;

  const unverifiedFields: string[] = [];
  if (currentUser && !currentUser.emailVerified) unverifiedFields.push('email');
  if (currentUser && !currentUser.phoneVerified) unverifiedFields.push('phone');
  if (currentUser && !currentUser.insuranceVerified) unverifiedFields.push('insurance');

  const pendingReviews = transactions?.filter(
    t => t.status === 'COMPLETED' &&
        !reviews?.some(r => r.transactionId === t.id && r.reviewerId === currentUser?.id)
  ) || [];

  return (
    <div className="space-y-6">
      {/* Verification Prompt */}
      {unverifiedFields.length > 0 && (
        <Alert className="border-blue-300 bg-blue-50">
          <Shield className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <p className="font-semibold mb-2">Complete Your Verification</p>
            <p className="text-sm mb-3">
              Earn <strong>{unverifiedFields.length * 10} points</strong> and build trust
            </p>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => navigate('/Verification')}
            >
              Verify Now
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Review Prompts */}
      {pendingReviews.length > 0 && (
        <Alert className="border-brand-300 bg-brand-50">
          <Star className="h-4 w-4 text-brand-600" />
          <AlertDescription className="text-brand-800">
            <p className="font-semibold mb-2">Leave a Review</p>
            <p className="text-sm mb-3">
              You have {pendingReviews.length} completed transaction{pendingReviews.length > 1 ? 's' : ''} waiting for review
            </p>
            <Button
              size="sm"
              className="bg-brand-600 hover:bg-brand-700"
              onClick={() => navigate(`/TransactionDetail?id=${pendingReviews[0].id}`)}
            >
              Review Now
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Grid */}
      <motion.div 
        className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <StatCard 
          icon={TrendingUp}
          value={`£${totalEarnings.toFixed(0)}`}
          label="Total Earnings"
          color="from-emerald-500 to-green-600"
        />
        <StatCard 
          icon={Clock}
          value={activeTransactionsCount}
          label="Active Transactions"
          color="from-blue-500 to-indigo-600"
        />
        <StatCard 
          icon={Star}
          value={averageRating.toFixed(1)}
          label="Average Rating"
          color="from-amber-500 to-brand-600"
        />
        <StatCard 
          icon={Award}
          value={reputationScore}
          label="Reputation Score"
          color="from-purple-500 to-violet-600"
        />
      </motion.div>

      {/* Quick Links */}
      <motion.div 
        className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <QuickActionCard 
          icon={BarChart3}
          label="Analytics"
          onClick={() => navigate('/Analytics')}
          color="from-brand-800 to-brand-900"
        />
        <QuickActionCard 
          icon={Gift}
          label="Referrals"
          onClick={() => navigate('/Referrals')}
          color="from-emerald-500 to-green-600"
        />
        <QuickActionCard 
          icon={Search}
          label="Saved Searches"
          onClick={() => navigate('/SavedSearches')}
          color="from-blue-500 to-indigo-600"
        />
        {currentUser?.role === 'ADMIN' && (
          <QuickActionCard 
            icon={Shield}
            label="Admin"
            onClick={() => navigate('/Admin')}
            color="from-purple-500 to-violet-600"
          />
        )}
      </motion.div>
    </div>
  );
}
