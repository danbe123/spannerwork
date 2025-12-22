/**
 * Admin Analytics Dashboard
 * 
 * Platform-wide metrics and analytics for administrators
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Users,
  PoundSterling,
  Package,
  AlertTriangle,
  Activity,
  RefreshCw,
  Download,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { analyticsService } from '@/api/services/analytics.service';
import { brandColors } from '@/lib/colors';
import { queryKeys } from '@/lib/queryKeys';

// Chart colors
const COLORS = [brandColors[800], '#10B981', '#F59E0B', '#6366F1', '#EC4899'];

// Date range options
type DateRange = '7d' | '30d' | '90d' | 'all';

interface DateRangeOption {
  value: DateRange;
  label: string;
  days: number | null;
}

const DATE_RANGES: DateRangeOption[] = [
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '90d', label: 'Last 90 days', days: 90 },
  { value: 'all', label: 'All time', days: null },
];

/**
 * Format pence to pounds
 */
function formatPence(pence: number): string {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Format large numbers compactly
 */
function formatCompact(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

/**
 * Get initials from name
 */
function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function AdminAnalytics() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  
  // Calculate date params based on selected range
  const getDateParams = () => {
    const range = DATE_RANGES.find(r => r.value === dateRange);
    if (!range || !range.days) return {};
    return {
      startDate: format(subDays(new Date(), range.days), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
    };
  };

  // Queries
  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useQuery({
    queryKey: queryKeys.adminAnalyticsOverview(),
    queryFn: () => analyticsService.getOverview(),
  });

  const { data: revenue, isLoading: revenueLoading } = useQuery({
    queryKey: queryKeys.adminAnalyticsRevenue(dateRange),
    queryFn: () => analyticsService.getRevenue(getDateParams()),
  });

  const { data: userGrowth, isLoading: userGrowthLoading } = useQuery({
    queryKey: queryKeys.adminAnalyticsUsers(dateRange),
    queryFn: () => analyticsService.getUserGrowth(getDateParams()),
  });

  const { data: listingTrends, isLoading: listingTrendsLoading } = useQuery({
    queryKey: queryKeys.adminAnalyticsListings(dateRange),
    queryFn: () => analyticsService.getListingTrends(getDateParams()),
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: queryKeys.adminAnalyticsCategories(),
    queryFn: () => analyticsService.getCategoryBreakdown(),
  });

  const { data: geographic, isLoading: geographicLoading } = useQuery({
    queryKey: queryKeys.adminAnalyticsGeographic(),
    queryFn: () => analyticsService.getGeographicDistribution(),
  });

  const { data: funnel, isLoading: funnelLoading } = useQuery({
    queryKey: queryKeys.adminAnalyticsFunnel(),
    queryFn: () => analyticsService.getConversionFunnel(),
  });

  const { data: topPerformers, isLoading: topPerformersLoading } = useQuery({
    queryKey: queryKeys.adminAnalyticsTopPerformers(),
    queryFn: () => analyticsService.getTopPerformers(10),
  });

  const handleRefresh = () => {
    refetchOverview();
  };

  const handleExport = () => {
    // Export overview data as CSV
    if (!overview) return;
    
    const csvData = [
      ['Metric', 'Value'],
      ['Total Users', overview.totalUsers?.toString() || '0'],
      ['Active Users (24h)', overview.activeUsers24h?.toString() || '0'],
      ['Total Transactions', overview.totalTransactions?.toString() || '0'],
      ['Total GMV', formatPence(overview.totalGmv || 0)],
      ['Platform Revenue', formatPence(overview.platformRevenue || 0)],
      ['Total Listings', overview.totalListings?.toString() || '0'],
      ['New Users Today', overview.newUsersToday?.toString() || '0'],
      ['Pending Disputes', overview.pendingDisputes?.toString() || '0'],
      ['Date Range', dateRange],
      ['Export Date', new Date().toISOString()],
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Platform Analytics</h1>
            <p className="text-gray-600">Monitor your marketplace performance</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <SelectTrigger className="w-[160px]">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Users</p>
                  {overviewLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <p className="text-2xl font-bold">{formatCompact(overview?.totalUsers || 0)}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-green-600 mt-2">
                +{overview?.newUsersToday || 0} today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <PoundSterling className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total GMV</p>
                  {overviewLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <p className="text-2xl font-bold">{formatPence(overview?.totalGmv || 0)}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Platform fees: {formatPence(overview?.platformRevenue || 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Listings</p>
                  {overviewLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">{formatCompact(overview?.totalListings || 0)}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {overview?.totalTransactions || 0} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Activity className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active Now</p>
                  {overviewLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">{overview?.activeUsers24h || 0}</p>
                  )}
                </div>
              </div>
              {(overview?.pendingDisputes || 0) > 0 && (
                <Badge variant="destructive" className="mt-2">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {overview?.pendingDisputes} disputes
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Charts */}
        <Tabs defaultValue="revenue" className="space-y-4">
          <TabsList>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="users">User Growth</TabsTrigger>
            <TabsTrigger value="listings">Listings</TabsTrigger>
            <TabsTrigger value="funnel">Funnel</TabsTrigger>
          </TabsList>

          <TabsContent value="revenue">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Over Time</CardTitle>
                <CardDescription>
                  GMV and platform fees ({DATE_RANGES.find(r => r.value === dateRange)?.label})
                </CardDescription>
              </CardHeader>
              <CardContent>
                {revenueLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={revenue?.timeSeries || []}>
                      <defs>
                        <linearGradient id="gmvGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={brandColors[800]} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={brandColors[800]} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(d) => format(new Date(d), 'd MMM')}
                      />
                      <YAxis tickFormatter={(v) => `£${(v / 100).toFixed(0)}`} />
                      <Tooltip 
                        formatter={(value: number) => formatPence(value)}
                        labelFormatter={(d) => format(new Date(d), 'PPP')}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="gmv"
                        name="GMV"
                        stroke={brandColors[800]}
                        fill="url(#gmvGradient)"
                      />
                      <Line
                        type="monotone"
                        dataKey="platformFee"
                        name="Platform Fee"
                        stroke="#10B981"
                        strokeWidth={2}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Growth</CardTitle>
                <CardDescription>
                  New and cumulative users ({DATE_RANGES.find(r => r.value === dateRange)?.label})
                </CardDescription>
              </CardHeader>
              <CardContent>
                {userGrowthLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={userGrowth?.timeSeries || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(d) => format(new Date(d), 'd MMM')}
                      />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip 
                        labelFormatter={(d) => format(new Date(d), 'PPP')}
                      />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="newUsers"
                        name="New Users"
                        fill={brandColors[800]}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="totalUsers"
                        name="Total Users"
                        stroke="#10B981"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="listings">
            <Card>
              <CardHeader>
                <CardTitle>Listing Activity</CardTitle>
                <CardDescription>
                  New listings by category ({DATE_RANGES.find(r => r.value === dateRange)?.label})
                </CardDescription>
              </CardHeader>
              <CardContent>
                {listingTrendsLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={listingTrends?.timeSeries || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(d) => format(new Date(d), 'd MMM')}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(d) => format(new Date(d), 'PPP')}
                      />
                      <Legend />
                      <Bar dataKey="tools" name="Tools" stackId="a" fill={COLORS[0]} />
                      <Bar dataKey="spaces" name="Spaces" stackId="a" fill={COLORS[1]} />
                      <Bar dataKey="services" name="Services" stackId="a" fill={COLORS[2]} />
                      <Bar dataKey="requests" name="Requests" stackId="a" fill={COLORS[3]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="funnel">
            <Card>
              <CardHeader>
                <CardTitle>Conversion Funnel</CardTitle>
                <CardDescription>
                  User journey from signup to repeat customer
                </CardDescription>
              </CardHeader>
              <CardContent>
                {funnelLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <div className="space-y-4">
                    {[
                      { label: 'Signups', value: funnel?.funnel.totalSignups || 0, rate: '100%' },
                      { label: 'Profile Completed', value: funnel?.funnel.profileCompleted || 0, rate: funnel?.conversionRates.signupToProfile + '%' },
                      { label: 'First Listing', value: funnel?.funnel.firstListingCreated || 0, rate: funnel?.conversionRates.profileToListing + '%' },
                      { label: 'First Transaction', value: funnel?.funnel.firstTransactionCompleted || 0, rate: funnel?.conversionRates.signupToTransaction + '%' },
                      { label: 'Repeat Customers', value: funnel?.funnel.repeatCustomers || 0, rate: funnel?.conversionRates.transactionToRepeat + '%' },
                    ].map((step) => (
                      <div key={step.label} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{step.label}</span>
                          <span className="text-gray-500">{step.value.toLocaleString()} ({step.rate})</span>
                        </div>
                        <Progress 
                          value={(step.value / (funnel?.funnel.totalSignups || 1)) * 100} 
                          className="h-3"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Secondary Charts Row */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
              <CardDescription>Listings and revenue by type</CardDescription>
            </CardHeader>
            <CardContent>
              {categoriesLoading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : (
                <div className="flex items-center gap-8">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie
                        data={categories || []}
                        dataKey="count"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {(categories || []).map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3 flex-1">
                    {(categories || []).map((cat, idx) => (
                      <div key={cat.category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                          />
                          <span className="text-sm font-medium">{cat.category}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">{cat.count}</p>
                          <p className="text-xs text-gray-500">{formatPence(cat.revenue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Geographic Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Top Regions</CardTitle>
              <CardDescription>User distribution by postcode area</CardDescription>
            </CardHeader>
            <CardContent>
              {geographicLoading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : (
                <div className="space-y-3">
                  {(geographic || []).slice(0, 8).map((region) => (
                    <div key={region.region} className="flex items-center gap-3">
                      <div className="w-8 text-center">
                        <Badge variant="secondary">{region.region}</Badge>
                      </div>
                      <div className="flex-1">
                        <Progress 
                          value={(region.userCount / (geographic?.[0]?.userCount || 1)) * 100} 
                          className="h-2"
                        />
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {region.userCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          {region.listingCount}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Performers */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Providers</CardTitle>
              <CardDescription>Most active providers by completed rentals</CardDescription>
            </CardHeader>
            <CardContent>
              {topPerformersLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <div className="space-y-3">
                  {(topPerformers?.topProviders || []).slice(0, 5).map((provider, idx) => (
                    <div key={provider.id} className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-400 w-6">#{idx + 1}</span>
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={provider.avatar} />
                        <AvatarFallback>{getInitials(provider.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{provider.name}</p>
                        <p className="text-xs text-gray-500">{provider.metricLabel}</p>
                      </div>
                      <Badge variant="secondary" className="font-bold">
                        {provider.metric}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Earners</CardTitle>
              <CardDescription>Highest earning providers</CardDescription>
            </CardHeader>
            <CardContent>
              {topPerformersLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <div className="space-y-3">
                  {(topPerformers?.topEarners || []).slice(0, 5).map((earner, idx) => (
                    <div key={earner.id} className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-400 w-6">#{idx + 1}</span>
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={earner.avatar} />
                        <AvatarFallback>{getInitials(earner.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{earner.name}</p>
                        <p className="text-xs text-gray-500">Total earnings</p>
                      </div>
                      <Badge className="bg-green-100 text-green-800 font-bold">
                        {formatPence(earner.metric)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
