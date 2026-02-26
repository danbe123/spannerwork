import React, { useState } from "react";
import { authService, adminService, adminBlogService, requestsService } from "@/api/services";
import type { BlogPost, BlogPostStatus } from "@/api/services/blog";
import { adminInsuranceService, InsuranceDocument } from "@/api/services/insurance";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import EditRequestDialog from "@/components/EditRequestDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
// UI components
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  Users,
  AlertTriangle,
  TrendingUp,
  PoundSterling,
  FileText,
  CheckCircle,
  Ban,
  Mail,
  Download,
  RefreshCw,
  FileCheck,
  FileX,
  ExternalLink,
  User,
  PenSquare,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Save,
  LayoutDashboard,
  Clock,
  ArrowRight,
  Activity,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Request, Transaction } from "@/types";

type TabType = 'overview' | 'insurance' | 'disputes' | 'users' | 'transactions' | 'requests' | 'blog';

export default function Admin() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Search and filtering state for each admin section
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionStatusFilter, setTransactionStatusFilter] = useState<string>("all");
  const [requestSearch, setRequestSearch] = useState("");
  const [requestCategoryFilter, setRequestCategoryFilter] = useState<string>("all");

  // Bulk user management
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  // Dispute resolution state
  const [selectedDispute, setSelectedDispute] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");

  // Insurance document verification state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedInsuranceDoc, setSelectedInsuranceDoc] = useState<InsuranceDocument | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Request moderation state
  const [editingRequest, setEditingRequest] = useState<Request | null>(null);

  // Blog management state
  const [blogSearch, setBlogSearch] = useState("");
  const [blogStatusFilter, setBlogStatusFilter] = useState<string>("all");
  const [blogDialogOpen, setBlogDialogOpen] = useState(false);
  const [editingBlogPost, setEditingBlogPost] = useState<BlogPost | null>(null);
  const [blogForm, setBlogForm] = useState({
    slug: "",
    title: "",
    excerpt: "",
    content: "",
    featuredImage: "",
    category: "",
    tags: "",
    author: "SpannerWork Team",
    readTime: 5,
    status: "DRAFT" as BlogPostStatus,
    metaTitle: "",
    metaDescription: "",
  });

  const { data: currentUserData, isLoading: userLoading } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () => authService.getCurrentUser(),
  });
  const currentUser = currentUserData?.user;
  const isAdmin = currentUser?.role === 'ADMIN';

  const { data: allUsersData, isLoading: usersLoading } = useQuery({
    queryKey: queryKeys.allUsers(),
    queryFn: () => adminService.listUsers(),
    enabled: isAdmin,
  });

  const { data: allTransactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: queryKeys.allTransactions(),
    queryFn: () => adminService.listTransactions({ sort: '-created_date' }),
    enabled: isAdmin,
  });

  const { data: allDisputesData, isLoading: disputesLoading } = useQuery({
    queryKey: queryKeys.allDisputes(),
    queryFn: () => adminService.listDisputes({ sort: '-created_date' }),
    enabled: isAdmin,
  });

  const { data: allRequestsData, isLoading: requestsLoading } = useQuery({
    queryKey: queryKeys.allRequests(),
    queryFn: () => adminService.listRequests(),
    enabled: isAdmin,
  });

  const { data: pendingInsuranceData, refetch: refetchInsurance, isLoading: insuranceLoading } = useQuery({
    queryKey: ['admin', 'insurance', 'pending'],
    queryFn: () => adminInsuranceService.getPendingDocuments({ page: 1, limit: 50 }),
    enabled: isAdmin,
  });

  const { data: blogPostsData, refetch: refetchBlogPosts, isLoading: blogLoading } = useQuery({
    queryKey: ['admin', 'blog', blogStatusFilter, blogSearch],
    queryFn: () => adminBlogService.listAll({
      status: blogStatusFilter === 'all' ? undefined : blogStatusFilter as BlogPostStatus,
      search: blogSearch || undefined,
      limit: 100
    }),
    enabled: isAdmin,
  });

  const allUsers = allUsersData?.data || [];
  const allTransactions = allTransactionsData?.data || [];
  const allDisputes = allDisputesData?.data || [];
  const allRequests = (allRequestsData?.data || []) as Request[];
  const pendingInsurance = pendingInsuranceData?.data || [];
  const allBlogPosts = blogPostsData?.data || [];

  // Mutations
  const resolveDisputeMutation = useMutation({
    mutationFn: async ({ disputeId, status, refundInitiator, refundRespondent }: { disputeId: string, status: string, refundInitiator: number, refundRespondent: number }) => {
      await adminService.resolveDispute(disputeId, {
        status,
        resolution,
        refundAmountInitiator: refundInitiator,
        refundAmountRespondent: refundRespondent,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allDisputes() });
      setSelectedDispute(null);
      setResolution("");
      toast.success("Dispute resolved successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to resolve dispute");
    },
  });

  const suspendUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await adminService.suspendUser(userId, "Admin action");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allUsers() });
      toast.success("User suspended");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to suspend user");
    },
  });

  const approveInsuranceMutation = useMutation({
    mutationFn: async (docId: string) => {
      await adminInsuranceService.approveDocument(docId);
    },
    onSuccess: () => {
      refetchInsurance();
      toast.success("Insurance document approved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to approve document");
    },
  });

  const rejectInsuranceMutation = useMutation({
    mutationFn: async ({ docId, reason }: { docId: string; reason: string }) => {
      await adminInsuranceService.rejectDocument(docId, reason);
    },
    onSuccess: () => {
      refetchInsurance();
      setRejectDialogOpen(false);
      setRejectReason("");
      setSelectedInsuranceDoc(null);
      toast.success("Insurance document rejected");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reject document");
    },
  });

  const createBlogPostMutation = useMutation({
    mutationFn: async (data: typeof blogForm) => {
      return adminBlogService.create({
        ...data,
        tags: data.tags.split(',').map(t => t.trim()).filter(Boolean),
        featuredImage: data.featuredImage || null,
        metaTitle: data.metaTitle || null,
        metaDescription: data.metaDescription || null,
      });
    },
    onSuccess: () => {
      refetchBlogPosts();
      setBlogDialogOpen(false);
      resetBlogForm();
      toast.success("Blog post created");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create blog post");
    },
  });

  const updateBlogPostMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof blogForm }) => {
      return adminBlogService.update(id, {
        ...data,
        tags: data.tags.split(',').map(t => t.trim()).filter(Boolean),
        featuredImage: data.featuredImage || null,
        metaTitle: data.metaTitle || null,
        metaDescription: data.metaDescription || null,
      });
    },
    onSuccess: () => {
      refetchBlogPosts();
      setBlogDialogOpen(false);
      setEditingBlogPost(null);
      resetBlogForm();
      toast.success("Blog post updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update blog post");
    },
  });

  const deleteBlogPostMutation = useMutation({
    mutationFn: async (id: string) => {
      await adminBlogService.delete(id);
    },
    onSuccess: () => {
      refetchBlogPosts();
      toast.success("Blog post deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete blog post");
    },
  });

  const publishBlogPostMutation = useMutation({
    mutationFn: async (id: string) => {
      return adminBlogService.publish(id);
    },
    onSuccess: () => {
      refetchBlogPosts();
      toast.success("Blog post published");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to publish blog post");
    },
  });

  const unpublishBlogPostMutation = useMutation({
    mutationFn: async (id: string) => {
      return adminBlogService.unpublish(id);
    },
    onSuccess: () => {
      refetchBlogPosts();
      toast.success("Blog post unpublished");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to unpublish blog post");
    },
  });

  const deleteRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      await requestsService.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allRequests() });
      toast.success("Job deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete job");
    },
  });

  function resetBlogForm() {
    setBlogForm({
      slug: "",
      title: "",
      excerpt: "",
      content: "",
      featuredImage: "",
      category: "",
      tags: "",
      author: "SpannerWork Team",
      readTime: 5,
      status: "DRAFT",
      metaTitle: "",
      metaDescription: "",
    });
  }

  function openCreateBlogDialog() {
    setEditingBlogPost(null);
    resetBlogForm();
    setBlogDialogOpen(true);
  }

  function openEditBlogDialog(post: BlogPost) {
    setEditingBlogPost(post);
    setBlogForm({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      featuredImage: post.featuredImage || "",
      category: post.category,
      tags: post.tags.join(", "),
      author: post.author,
      readTime: post.readTime,
      status: post.status,
      metaTitle: post.metaTitle || "",
      metaDescription: post.metaDescription || "",
    });
    setBlogDialogOpen(true);
  }

  function handleBlogFormSubmit() {
    if (editingBlogPost) {
      updateBlogPostMutation.mutate({ id: editingBlogPost.id, data: blogForm });
    } else {
      createBlogPostMutation.mutate(blogForm);
    }
  }

  function generateSlug(title: string) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  function formatCoverage(pence: number | null): string {
    if (!pence) return 'Not specified';
    return `£${(pence / 100).toLocaleString()}`;
  }

  function openRejectDialog(doc: InsuranceDocument) {
    setSelectedInsuranceDoc(doc);
    setRejectDialogOpen(true);
  }

  function handleReject() {
    if (!selectedInsuranceDoc || !rejectReason.trim()) return;
    rejectInsuranceMutation.mutate({ docId: selectedInsuranceDoc.id, reason: rejectReason });
  }

  // Calculate stats
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const activeUsers = allUsers.filter(u =>
    u.lastActiveAt && new Date(u.lastActiveAt) >= thirtyDaysAgo
  ).length;

  const totalRevenue = allTransactions
    .filter((t: Transaction) => t.status === 'COMPLETED')
    .reduce((sum, t: Transaction) => sum + (t.rentalFee || 0) * 0.05, 0);

  const openDisputes = allDisputes.filter(d => d.status === 'OPEN' || d.status === 'UNDER_REVIEW').length;
  const pendingInsuranceCount = pendingInsurance.length;
  const activeTransactions = allTransactions.filter(t => t.status === 'IN_PROGRESS').length;

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-800" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Access Denied. Admin privileges required.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const navItems: { id: TabType; label: string; icon: typeof Shield; badge?: number; badgeColor?: string }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'insurance', label: 'Insurance', icon: FileCheck, badge: pendingInsuranceCount, badgeColor: 'bg-yellow-500' },
    { id: 'disputes', label: 'Disputes', icon: AlertTriangle, badge: openDisputes, badgeColor: 'bg-red-500' },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'transactions', label: 'Transactions', icon: PoundSterling },
    { id: 'requests', label: 'Requests', icon: FileText },
    { id: 'blog', label: 'Blog', icon: PenSquare },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-brand-800 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">{getGreeting()}</p>
                <h1 className="text-2xl font-bold">{currentUser?.name || 'Admin'}</h1>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg">
                <Clock className="w-4 h-4" />
                {format(new Date(), 'EEE, MMM d')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto py-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-brand-800 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`${item.badgeColor || 'bg-gray-500'} text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-none shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Total Users</p>
                      <p className="text-3xl font-bold mt-1">{allUsers.length}</p>
                      <p className="text-xs text-green-600 mt-1">{activeUsers} active (30d)</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Revenue</p>
                      <p className="text-3xl font-bold mt-1">£{totalRevenue.toFixed(0)}</p>
                      <p className="text-xs text-gray-500 mt-1">Platform fees</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <PoundSterling className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Transactions</p>
                      <p className="text-3xl font-bold mt-1">{allTransactions.length}</p>
                      <p className="text-xs text-blue-600 mt-1">{activeTransactions} in progress</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Active Requests</p>
                      <p className="text-3xl font-bold mt-1">{allRequests.filter(r => r.status === 'ACTIVE').length}</p>
                      <p className="text-xs text-gray-500 mt-1">{allRequests.length} total</p>
                    </div>
                    <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center">
                      <FileText className="w-6 h-6 text-brand-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Action Required Section */}
            {(pendingInsuranceCount > 0 || openDisputes > 0) && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-brand-800" />
                  Action Required
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {pendingInsuranceCount > 0 && (
                    <Card className="border-2 border-yellow-200 bg-yellow-50 shadow-md cursor-pointer hover:shadow-lg transition-all"
                      onClick={() => setActiveTab('insurance')}>
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-yellow-200 rounded-xl flex items-center justify-center">
                              <FileCheck className="w-6 h-6 text-yellow-700" />
                            </div>
                            <div>
                              <p className="font-semibold text-yellow-900">{pendingInsuranceCount} Insurance Document{pendingInsuranceCount > 1 ? 's' : ''}</p>
                              <p className="text-sm text-yellow-700">Pending verification review</p>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-yellow-600" />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {openDisputes > 0 && (
                    <Card className="border-2 border-red-200 bg-red-50 shadow-md cursor-pointer hover:shadow-lg transition-all"
                      onClick={() => setActiveTab('disputes')}>
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-red-200 rounded-xl flex items-center justify-center">
                              <AlertTriangle className="w-6 h-6 text-red-700" />
                            </div>
                            <div>
                              <p className="font-semibold text-red-900">{openDisputes} Open Dispute{openDisputes > 1 ? 's' : ''}</p>
                              <p className="text-sm text-red-700">Requires resolution</p>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-red-600" />
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Recent Transactions */}
              <Card className="border-none shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Recent Transactions</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('transactions')}>
                      View All <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {allTransactions.slice(0, 5).map((transaction) => {
                    const provider = allUsers.find(u => u.id === transaction.providerId);
                    const user = allUsers.find(u => u.id === transaction.userId);
                    return (
                      <div key={transaction.id} className="flex items-center justify-between py-3 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          <Badge className={`text-xs ${
                            transaction.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                            transaction.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                            transaction.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {transaction.status}
                          </Badge>
                          <div>
                            <p className="text-sm font-medium">{provider?.name || 'Provider'} → {user?.name || 'User'}</p>
                            <p className="text-xs text-gray-500">{formatDistanceToNow(new Date(transaction.createdDate), { addSuffix: true })}</p>
                          </div>
                        </div>
                        <p className="font-semibold">£{(transaction.rentalFee || 0).toFixed(0)}</p>
                      </div>
                    );
                  })}
                  {allTransactions.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No transactions yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Recent Users */}
              <Card className="border-none shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">New Users</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('users')}>
                      View All <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {allUsers.slice(0, 5).map((user) => (
                    <div key={user.id} className="flex items-center justify-between py-3 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{user.name || user.username || 'User'}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {user.emailVerified && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Verified</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {allUsers.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No users yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Insurance Tab */}
        {activeTab === 'insurance' && (
          <Card className="border-none shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Insurance Verification</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">Review and approve provider insurance documents</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => refetchInsurance()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {insuranceLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : pendingInsurance.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-lg font-medium text-gray-900">All caught up!</p>
                  <p className="text-gray-500 mt-1">No pending insurance documents to review.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingInsurance.map((doc) => (
                    <div key={doc.id} className="border-2 border-yellow-200 bg-yellow-50 rounded-xl p-5">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-yellow-200 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-yellow-700" />
                            </div>
                            <div>
                              <p className="font-semibold">{doc.user?.name || 'Unknown User'}</p>
                              <p className="text-sm text-gray-600">{doc.user?.email}</p>
                            </div>
                            <Badge className="bg-yellow-200 text-yellow-800 ml-auto md:ml-0">Pending</Badge>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-white rounded-lg p-3">
                            <div>
                              <p className="text-gray-500 text-xs">Type</p>
                              <p className="font-medium">{doc.documentType.replace(/_/g, ' ')}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">Provider</p>
                              <p className="font-medium">{doc.provider || 'Not specified'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">Coverage</p>
                              <p className="font-medium">{formatCoverage(doc.coverageAmount)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">Expiry</p>
                              <p className="font-medium">
                                {doc.expiryDate ? format(new Date(doc.expiryDate), 'dd MMM yyyy') : 'Not specified'}
                              </p>
                            </div>
                          </div>

                          <p className="text-xs text-gray-500 mt-3">
                            Uploaded {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                            {doc.policyNumber && ` • Policy #${doc.policyNumber}`}
                          </p>
                        </div>

                        <div className="flex md:flex-col gap-2">
                          <Button size="sm" variant="outline" onClick={() => window.open(doc.documentUrl, '_blank')} className="flex-1 md:flex-auto">
                            <ExternalLink className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => approveInsuranceMutation.mutate(doc.id)}
                            disabled={approveInsuranceMutation.isPending}
                            className="flex-1 md:flex-auto bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openRejectDialog(doc)}
                            disabled={rejectInsuranceMutation.isPending}
                            className="flex-1 md:flex-auto"
                          >
                            <FileX className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Disputes Tab */}
        {activeTab === 'disputes' && (
          <Card className="border-none shadow-md">
            <CardHeader>
              <div>
                <CardTitle>Dispute Management</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Review and resolve user disputes</p>
              </div>
            </CardHeader>
            <CardContent>
              {disputesLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : allDisputes.filter(d => d.status === 'OPEN' || d.status === 'UNDER_REVIEW').length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-lg font-medium text-gray-900">No open disputes</p>
                  <p className="text-gray-500 mt-1">All disputes have been resolved.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {allDisputes
                    .filter(d => d.status === 'OPEN' || d.status === 'UNDER_REVIEW')
                    .map(dispute => {
                      const initiator = allUsers.find(u => u.id === dispute.initiatorId);
                      const respondent = allUsers.find(u => u.id === dispute.respondentId);
                      const transaction = allTransactions.find(t => t.id === dispute.transactionId);

                      return (
                        <div key={dispute.id} className="border-2 border-red-200 bg-red-50 rounded-xl p-5">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="font-semibold text-lg text-red-900">{dispute.reason}</h4>
                              <p className="text-sm text-red-700">
                                Filed {formatDistanceToNow(new Date(dispute.createdDate), { addSuffix: true })}
                              </p>
                            </div>
                            <Badge className="bg-red-200 text-red-800">{dispute.status}</Badge>
                          </div>

                          <div className="grid md:grid-cols-4 gap-4 mb-4 text-sm bg-white rounded-lg p-4">
                            <div>
                              <p className="text-gray-500 text-xs">Initiator</p>
                              <p className="font-medium">{initiator?.name || initiator?.username || 'Unknown'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">Respondent</p>
                              <p className="font-medium">{respondent?.name || respondent?.username || 'Unknown'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">Transaction Value</p>
                              <p className="font-medium">£{transaction?.rentalFee?.toFixed(2) || '0.00'}</p>
                            </div>
                            {transaction?.depositAmount !== undefined && transaction?.depositAmount !== null && (
                              <div>
                                <p className="text-gray-500 text-xs">Deposit</p>
                                <p className="font-medium">£{transaction.depositAmount.toFixed(2)}</p>
                              </div>
                            )}
                          </div>

                          <div className="bg-white rounded-lg p-3 mb-4">
                            <p className="text-sm font-medium text-gray-700 mb-1">Details:</p>
                            <p className="text-sm text-gray-600">{dispute.description}</p>
                          </div>

                          {selectedDispute === dispute.id ? (
                            <div className="space-y-3 pt-3 border-t border-red-200">
                              <Textarea
                                placeholder="Enter resolution details..."
                                value={resolution}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setResolution(e.target.value)}
                                className="h-24"
                                maxLength={1000}
                              />
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <Button
                                  onClick={() => resolveDisputeMutation.mutate({
                                    disputeId: dispute.id,
                                    status: 'RESOLVED',
                                    refundInitiator: (transaction?.rentalFee || 0) + (transaction?.depositAmount || 0),
                                    refundRespondent: 0
                                  })}
                                  className="bg-green-600 hover:bg-green-700"
                                  disabled={resolveDisputeMutation.isPending}
                                >
                                  Rule for Initiator
                                </Button>
                                <Button
                                  onClick={() => resolveDisputeMutation.mutate({
                                    disputeId: dispute.id,
                                    status: 'RESOLVED',
                                    refundInitiator: 0,
                                    refundRespondent: (transaction?.rentalFee || 0)
                                  })}
                                  className="bg-blue-600 hover:bg-blue-700"
                                  disabled={resolveDisputeMutation.isPending}
                                >
                                  Rule for Respondent
                                </Button>
                                <Button
                                  onClick={() => resolveDisputeMutation.mutate({
                                    disputeId: dispute.id,
                                    status: 'RESOLVED',
                                    refundInitiator: (transaction?.rentalFee || 0) / 2,
                                    refundRespondent: (transaction?.rentalFee || 0) / 2
                                  })}
                                  className="bg-purple-600 hover:bg-purple-700"
                                  disabled={resolveDisputeMutation.isPending}
                                >
                                  Split 50/50
                                </Button>
                              </div>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setSelectedDispute(null);
                                  setResolution("");
                                }}
                                className="w-full"
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              onClick={() => setSelectedDispute(dispute.id)}
                              className="w-full bg-brand-800 hover:bg-brand-900"
                            >
                              Review & Resolve
                            </Button>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <Card className="border-none shadow-md">
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">{allUsers.length} registered users</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Input
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserSearch(e.target.value)}
                    className="w-48"
                  />
                  <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      <SelectItem value="USER">Users</SelectItem>
                      <SelectItem value="ADMIN">Admins</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedUsers.size > 0 && (
                    <div className="flex gap-2 ml-2 pl-2 border-l">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const emails = allUsers
                            .filter(u => selectedUsers.has(u.id))
                            .map(u => u.email)
                            .join(',');
                          window.location.href = `mailto:${emails}`;
                        }}
                      >
                        <Mail className="w-4 h-4 mr-1" />
                        Email ({selectedUsers.size})
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="space-y-2">
                  {allUsers
                    .filter(u => {
                      const matchesSearch = !userSearch ||
                        (u.name || u.username || "").toLowerCase().includes(userSearch.toLowerCase()) ||
                        u.email.toLowerCase().includes(userSearch.toLowerCase());
                      const matchesRole = userRoleFilter === "all" || u.role === userRoleFilter;
                      return matchesSearch && matchesRole;
                    })
                    .map(user => (
                      <div key={user.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedUsers.has(user.id)}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedUsers);
                              if (checked) {
                                next.add(user.id);
                              } else {
                                next.delete(user.id);
                              }
                              setSelectedUsers(next);
                            }}
                          />
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium">{user.name || user.username || 'User'}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="hidden md:flex flex-wrap gap-1">
                            {user.emailVerified && (
                              <Badge variant="outline" className="text-xs">Email ✓</Badge>
                            )}
                            {user.role === 'ADMIN' && (
                              <Badge className="bg-purple-100 text-purple-800 text-xs">Admin</Badge>
                            )}
                            {user.accountStatus === 'SUSPENDED' && (
                              <Badge variant="destructive" className="text-xs">Suspended</Badge>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.location.href = `mailto:${user.email}`}
                            >
                              <Mail className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => suspendUserMutation.mutate(user.id)}
                              disabled={user.accountStatus === 'SUSPENDED'}
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <Card className="border-none shadow-md">
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle>Transactions</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">{allTransactions.length} total transactions</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Input
                    placeholder="Search..."
                    value={transactionSearch}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTransactionSearch(e.target.value)}
                    className="w-48"
                  />
                  <Select value={transactionStatusFilter} onValueChange={setTransactionStatusFilter}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const filtered = allTransactions.filter(t => {
                        const matchesStatus = transactionStatusFilter === "all" || t.status === transactionStatusFilter;
                        return matchesStatus;
                      });
                      const csv = [
                        ['ID', 'Status', 'Provider', 'User', 'Amount', 'Date'].join(','),
                        ...filtered.map(t => {
                          const provider = allUsers.find(u => u.id === t.providerId);
                          const user = allUsers.find(u => u.id === t.userId);
                          return [
                            t.id,
                            t.status,
                            provider?.name || provider?.username || '',
                            user?.name || user?.username || '',
                            `£${(t.rentalFee || 0).toFixed(2)}`,
                            new Date(t.createdDate).toLocaleDateString()
                          ].join(',');
                        })
                      ].join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success('Transactions exported');
                    }}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="space-y-2">
                  {allTransactions
                    .filter(t => {
                      const provider = allUsers.find(u => u.id === t.providerId);
                      const user = allUsers.find(u => u.id === t.userId);
                      const matchesSearch = !transactionSearch ||
                        t.id.toLowerCase().includes(transactionSearch.toLowerCase()) ||
                        (provider?.name || '').toLowerCase().includes(transactionSearch.toLowerCase()) ||
                        (user?.name || '').toLowerCase().includes(transactionSearch.toLowerCase());
                      const matchesStatus = transactionStatusFilter === "all" || t.status === transactionStatusFilter;
                      return matchesSearch && matchesStatus;
                    })
                    .slice(0, 50)
                    .map(transaction => {
                      const provider = allUsers.find(u => u.id === transaction.providerId);
                      const user = allUsers.find(u => u.id === transaction.userId);

                      return (
                        <div key={transaction.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge className={`text-xs ${
                              transaction.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                              transaction.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                              transaction.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-800' :
                              transaction.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {transaction.status}
                            </Badge>
                            <div>
                              <p className="text-sm font-medium">
                                {provider?.name || 'Provider'} → {user?.name || 'User'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatDistanceToNow(new Date(transaction.createdDate), { addSuffix: true })}
                                <span className="ml-2 text-gray-400">ID: {transaction.id.slice(0, 8)}...</span>
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">£{(transaction.rentalFee || 0).toFixed(2)}</p>
                            {transaction.depositAmount !== undefined && transaction.depositAmount !== null && (
                              <p className="text-xs text-gray-500">+£{transaction.depositAmount.toFixed(2)} deposit</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Requests Tab */}
        {activeTab === 'requests' && (
          <Card className="border-none shadow-md">
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle>Job Requests</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">{allRequests.length} total requests</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Input
                    placeholder="Search..."
                    value={requestSearch}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRequestSearch(e.target.value)}
                    className="w-48"
                  />
                  <Select value={requestCategoryFilter} onValueChange={setRequestCategoryFilter}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      <SelectItem value="TOOLS">Tools</SelectItem>
                      <SelectItem value="SPACE">Space</SelectItem>
                      <SelectItem value="EXPERTISE">Expertise</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.allRequests() })}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="space-y-2">
                  {allRequests
                    .filter(r => {
                      const matchesSearch = !requestSearch ||
                        r.title.toLowerCase().includes(requestSearch.toLowerCase()) ||
                        (r.description || '').toLowerCase().includes(requestSearch.toLowerCase());
                      const matchesCategory = requestCategoryFilter === "all" || r.category === requestCategoryFilter;
                      return matchesSearch && matchesCategory;
                    })
                    .map(request => {
                      const seeker = allUsers.find(u => u.id === request.seekerId);

                      return (
                        <div key={request.id} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-medium">{request.title}</h4>
                                <Badge className={`text-xs ${
                                  request.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                  request.status === 'FULFILLED' ? 'bg-blue-100 text-blue-800' :
                                  request.status === 'EXPIRED' ? 'bg-gray-100 text-gray-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {request.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 mb-2 line-clamp-2">{request.description?.substring(0, 150)}...</p>
                              <div className="flex flex-wrap gap-2 items-center text-xs">
                                <Badge variant="outline">{request.category}</Badge>
                                <Badge className="bg-green-100 text-green-800">£{(request.budget / 100).toFixed(2)}</Badge>
                                <span className="text-gray-500">
                                  by {seeker?.name || 'User'} • {formatDistanceToNow(new Date(request.createdDate), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-1 ml-4 shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(`/jobs/${request.id}`, '_blank')}
                                title="View job"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingRequest(request)}
                                title="Edit job"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  if (confirm('Delete this job? This cannot be undone.')) {
                                    deleteRequestMutation.mutate(request.id);
                                  }
                                }}
                                disabled={deleteRequestMutation.isPending}
                                title="Delete job"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Blog Tab */}
        {activeTab === 'blog' && (
          <Card className="border-none shadow-md">
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle>Blog Management</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">{allBlogPosts.length} blog posts</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Input
                    placeholder="Search posts..."
                    value={blogSearch}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBlogSearch(e.target.value)}
                    className="w-48"
                  />
                  <Select value={blogStatusFilter} onValueChange={setBlogStatusFilter}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="PUBLISHED">Published</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => refetchBlogPosts()}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button size="sm" onClick={openCreateBlogDialog} className="bg-brand-800 hover:bg-brand-900">
                    <Plus className="w-4 h-4 mr-1" />
                    New Post
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {blogLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : allBlogPosts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <PenSquare className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-lg font-medium text-gray-900">No blog posts yet</p>
                  <p className="text-gray-500 mt-1 mb-4">Create your first blog post to get started</p>
                  <Button onClick={openCreateBlogDialog} className="bg-brand-800 hover:bg-brand-900">
                    <Plus className="w-4 h-4 mr-1" />
                    Create First Post
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {allBlogPosts.map((post) => (
                    <div key={post.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">{post.title}</h4>
                          <Badge className={`text-xs shrink-0 ${
                            post.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' :
                            post.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {post.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-1 mb-2">{post.excerpt}</p>
                        <div className="flex flex-wrap gap-2 items-center text-xs text-gray-500">
                          <span>{post.author}</span>
                          <span>•</span>
                          <span>{post.category}</span>
                          <span>•</span>
                          <span>{post.readTime} min</span>
                          {post.publishedAt && (
                            <>
                              <span>•</span>
                              <span>{formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true })}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-4 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => window.open(`/blog/${post.slug}`, '_blank')}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEditBlogDialog(post)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        {post.status === 'DRAFT' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => publishBlogPostMutation.mutate(post.id)}
                            disabled={publishBlogPostMutation.isPending}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        ) : post.status === 'PUBLISHED' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => unpublishBlogPostMutation.mutate(post.id)}
                            disabled={unpublishBlogPostMutation.isPending}
                          >
                            <EyeOff className="w-4 h-4" />
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if (confirm('Delete this blog post?')) {
                              deleteBlogPostMutation.mutate(post.id);
                            }
                          }}
                          disabled={deleteBlogPostMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Blog Post Dialog */}
      <Dialog open={blogDialogOpen} onOpenChange={setBlogDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBlogPost ? 'Edit Blog Post' : 'Create New Blog Post'}</DialogTitle>
            <DialogDescription>
              {editingBlogPost ? 'Update the blog post details below.' : 'Fill in the details for your new blog post.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Title *</label>
                <Input
                  placeholder="Enter post title"
                  value={blogForm.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setBlogForm(f => ({
                      ...f,
                      title,
                      slug: !editingBlogPost ? generateSlug(title) : f.slug
                    }));
                  }}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Slug *</label>
                <Input
                  placeholder="url-friendly-slug"
                  value={blogForm.slug}
                  onChange={(e) => setBlogForm(f => ({ ...f, slug: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Excerpt *</label>
              <Textarea
                placeholder="Brief summary (max 500 chars)"
                value={blogForm.excerpt}
                onChange={(e) => setBlogForm(f => ({ ...f, excerpt: e.target.value }))}
                rows={2}
                maxLength={500}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Content * (HTML supported)</label>
              <Textarea
                placeholder="Full blog post content..."
                value={blogForm.content}
                onChange={(e) => setBlogForm(f => ({ ...f, content: e.target.value }))}
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Category *</label>
                <Input
                  placeholder="e.g., Guides"
                  value={blogForm.category}
                  onChange={(e) => setBlogForm(f => ({ ...f, category: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Author</label>
                <Input
                  value={blogForm.author}
                  onChange={(e) => setBlogForm(f => ({ ...f, author: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Read Time (mins)</label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={blogForm.readTime}
                  onChange={(e) => setBlogForm(f => ({ ...f, readTime: parseInt(e.target.value) || 5 }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Tags (comma-separated)</label>
                <Input
                  placeholder="DIY, tools, automotive"
                  value={blogForm.tags}
                  onChange={(e) => setBlogForm(f => ({ ...f, tags: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Featured Image URL</label>
                <Input
                  placeholder="https://..."
                  value={blogForm.featuredImage}
                  onChange={(e) => setBlogForm(f => ({ ...f, featuredImage: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Meta Title (SEO)</label>
                <Input
                  placeholder="SEO title"
                  value={blogForm.metaTitle}
                  onChange={(e) => setBlogForm(f => ({ ...f, metaTitle: e.target.value }))}
                  maxLength={70}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Meta Description</label>
                <Input
                  placeholder="SEO description"
                  value={blogForm.metaDescription}
                  onChange={(e) => setBlogForm(f => ({ ...f, metaDescription: e.target.value }))}
                  maxLength={160}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Status</label>
              <Select value={blogForm.status} onValueChange={(v) => setBlogForm(f => ({ ...f, status: v as BlogPostStatus }))}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlogDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBlogFormSubmit}
              disabled={
                !blogForm.title.trim() ||
                !blogForm.slug.trim() ||
                !blogForm.excerpt.trim() ||
                !blogForm.content.trim() ||
                !blogForm.category.trim() ||
                createBlogPostMutation.isPending ||
                updateBlogPostMutation.isPending
              }
              className="bg-brand-800 hover:bg-brand-900"
            >
              <Save className="w-4 h-4 mr-1" />
              {createBlogPostMutation.isPending || updateBlogPostMutation.isPending
                ? 'Saving...'
                : editingBlogPost ? 'Update' : 'Create'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Insurance Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Insurance Document</DialogTitle>
            <DialogDescription>
              Provide a reason for rejection. The provider will be notified.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Rejection reason..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || rejectInsuranceMutation.isPending}
            >
              {rejectInsuranceMutation.isPending ? 'Rejecting...' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Request Dialog */}
      {editingRequest && (
        <EditRequestDialog
          request={editingRequest}
          onClose={() => {
            setEditingRequest(null);
            queryClient.invalidateQueries({ queryKey: queryKeys.allRequests() });
          }}
        />
      )}
    </div>
  );
}
