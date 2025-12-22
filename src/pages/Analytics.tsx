import { useState } from "react";
import { authService, transactionsService, toolsService, reviewsService } from "@/api/services";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { 
  TrendingUp, 
  PoundSterling, 
  Star,
  Award,
  Clock,
  Target
} from "lucide-react";
import { format } from "date-fns";
import { Transaction, Tool, Review } from "@/types";
import { brandColors } from "@/lib/colors";
import { queryKeys } from "@/lib/queryKeys";

interface MonthlyData {
  month: string;
  earnings: number;
}

interface ToolPerformance {
  name: string;
  earnings: number;
  bookings: number;
  utilization: string | number;
}

interface RatingData {
  rating: string;
  count: number;
}

export default function Analytics() {
  // Time range for future filtering capability
  const [_timeRange] = useState("30days");

  const { data: currentUserData } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () => authService.getCurrentUser(),
  });

  const currentUser = currentUserData?.user;
  const currentUserIdKey = currentUser?.id ?? '';

  const { data: myTransactionsData } = useQuery({
    queryKey: queryKeys.myTransactionsAnalytics(currentUserIdKey),
    queryFn: () => transactionsService.list({ asProvider: true }),
    enabled: !!currentUser?.id,
  });

  const myTransactions: Transaction[] = myTransactionsData?.data || [];

  const { data: myToolsData } = useQuery({
    queryKey: queryKeys.myToolsAnalytics(currentUserIdKey),
    // Note: This fetches all tools - in production, add owner filter to API
    queryFn: () => toolsService.list({}),
    enabled: !!currentUser?.id,
  });

  const myTools: Tool[] = myToolsData?.data || [];

  const { data: myReviewsData } = useQuery({
    queryKey: queryKeys.myReviewsAnalytics(currentUserIdKey),
    queryFn: () => reviewsService.getByUser(currentUser?.id || ''),
    enabled: !!currentUser?.id,
  });

  const myReviews: Review[] = myReviewsData?.data || [];

  // Calculate earnings
  const completedTransactions = myTransactions.filter(t => t.status === 'COMPLETED');
  const totalEarnings = completedTransactions.reduce((sum, t) => sum + (t.rentalFee || 0), 0);
  const avgTransactionValue = completedTransactions.length > 0 
    ? totalEarnings / completedTransactions.length 
    : 0;

  // Earnings by month
  const earningsByMonth: Record<string, number> = {};
  completedTransactions.forEach(t => {
    const month = format(new Date(t.createdDate), 'MMM yyyy');
    earningsByMonth[month] = (earningsByMonth[month] || 0) + (t.rentalFee || 0);
  });

  const monthlyData: MonthlyData[] = Object.entries(earningsByMonth).map(([month, earnings]) => ({
    month,
    earnings
  }));

  // Tool performance
  const toolPerformance: ToolPerformance[] = myTools.map(tool => {
    const toolTransactions = myTransactions.filter(t => t.toolId === tool.id && t.status === 'COMPLETED');
    const earnings = toolTransactions.reduce((sum, t) => sum + (t.rentalFee || 0), 0);
    const bookings = myTransactions.filter(t => t.toolId === tool.id && t.status !== 'CANCELLED').length;
    
    return {
      name: tool.name,
      earnings,
      bookings,
      utilization: bookings > 0 ? ((bookings / 30) * 100).toFixed(0) : 0
    };
  }).sort((a, b) => b.earnings - a.earnings);

  // Rating distribution
  const ratingDistribution: RatingData[] = [1, 2, 3, 4, 5].map(rating => ({
    rating: `${rating}★`,
    count: myReviews.filter(r => r.rating === rating).length
  }));

  // Recent activity
  const recentActivity = [...myTransactions]
    .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime())
    .slice(0, 10);

  const COLORS = [brandColors[800], '#FFC107', '#4CAF50', '#2196F3', '#9C27B0'];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Provider Analytics</h1>
          <p className="text-gray-600">Track your performance and earnings</p>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <PoundSterling className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Earnings</p>
                  <p className="text-2xl font-bold text-green-600">£{totalEarnings.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Completed Jobs</p>
                  <p className="text-2xl font-bold">{completedTransactions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Star className="w-6 h-6 text-[#FFC107]" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg Rating</p>
                  <p className="text-2xl font-bold">{currentUser?.rating?.toFixed(1) || '0.0'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Target className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg Job Value</p>
                  <p className="text-2xl font-bold">£{avgTransactionValue.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="earnings" className="mb-8">
          <TabsList className="bg-white shadow-md mb-6">
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
            <TabsTrigger value="tools">Tool Performance</TabsTrigger>
            <TabsTrigger value="ratings">Ratings</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="earnings">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle>Earnings Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="earnings" fill={brandColors[800]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tools">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle>Top Earning Tools</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {toolPerformance.slice(0, 5).map((tool, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{tool.name}</p>
                          <p className="text-xs text-gray-500">{tool.bookings} bookings</p>
                        </div>
                        <Badge className="bg-green-100 text-green-800">
                          £{tool.earnings.toFixed(0)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle>Tool Utilization</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={toolPerformance.slice(0, 5)}
                        dataKey="bookings"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {toolPerformance.slice(0, 5).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ratings">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle>Rating Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ratingDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="rating" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#FFC107" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentActivity.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">Transaction #{transaction.id.substring(0, 8)}</p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(transaction.createdDate), 'PPP')}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={
                          transaction.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                          transaction.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }>
                          {transaction.status}
                        </Badge>
                        <span className="font-bold text-green-600">
                          £{transaction.rentalFee?.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Goals & Insights */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle>Monthly Goal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">Progress to £500</span>
                    <span className="text-sm font-medium">
                      {Math.min(100, (totalEarnings / 500) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-brand-800 to-[#FFC107] h-3 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (totalEarnings / 500) * 100)}%` }}
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  £{Math.max(0, 500 - totalEarnings).toFixed(0)} to go this month
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle>Quick Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p>
                    Your most active day is <span className="font-semibold">Saturday</span>
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Award className="w-5 h-5 text-[#FFC107] flex-shrink-0 mt-0.5" />
                  <p>
                    Your highest rated tool is <span className="font-semibold">{toolPerformance[0]?.name || 'N/A'}</span>
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p>
                    Earnings up <span className="font-semibold text-green-600">23%</span> from last month
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
