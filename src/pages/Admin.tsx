import React, { useState } from "react";
import { Link } from "react-router-dom";
import { authService, adminService } from "@/api/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Shield,
  Users,
  AlertTriangle,
  TrendingUp,
  PoundSterling,
  FileText,
  CheckCircle,
  Search,
  Ban,
  Mail,
  BarChart3,
  Download,
  RefreshCw,
  FileCheck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Request, Transaction } from "@/types";

export default function Admin() {
  const queryClient = useQueryClient();
  
  // Search & filter state
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionStatusFilter, setTransactionStatusFilter] = useState<string>("all");
  const [requestSearch, setRequestSearch] = useState("");
  const [requestCategoryFilter, setRequestCategoryFilter] = useState<string>("all");
  
  // Bulk action state
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  
  // Dispute state
  const [selectedDispute, setSelectedDispute] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");

  const { data: currentUserData } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () => authService.getCurrentUser(),
  });
  const currentUser = currentUserData?.user;

  // Check if user is admin
  const isAdmin = currentUser?.role === 'ADMIN';

  const { data: allUsersData } = useQuery({
    queryKey: queryKeys.allUsers(),
    queryFn: () => adminService.listUsers(),
    enabled: isAdmin,
  });

  const { data: allTransactionsData } = useQuery({
    queryKey: queryKeys.allTransactions(),
    queryFn: () => adminService.listTransactions({ sort: '-created_date' }),
    enabled: isAdmin,
  });

  const { data: allDisputesData } = useQuery({
    queryKey: queryKeys.allDisputes(),
    queryFn: () => adminService.listDisputes({ sort: '-created_date' }),
    enabled: isAdmin,
  });

  const { data: allRequestsData } = useQuery({
    queryKey: queryKeys.allRequests(),
    queryFn: () => adminService.listRequests(),
    enabled: isAdmin,
  });

  const allUsers = allUsersData?.data || [];
  const allTransactions = allTransactionsData?.data || [];
  const allDisputes = allDisputesData?.data || [];
  const allRequests = (allRequestsData?.data || []) as Request[];

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
    },
  });

  const suspendUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await adminService.suspendUser(userId, "Admin action");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allUsers() });
    },
  });

  if (!currentUser) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Access Denied. Admin privileges required.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Analytics
  const totalRevenue = allTransactions
    .filter((t: Transaction) => t.status === 'COMPLETED')
    .reduce((sum, t: Transaction) => sum + (t.rentalFee || 0) * 0.05, 0); // 5% platform fee

  const activeUsers = allUsers.filter(u => u.totalTransactions > 0).length;
  const openDisputes = allDisputes.filter(d => d.status === 'OPEN' || d.status === 'UNDER_REVIEW').length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-brand-800" />
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/insurance">
              <Button variant="outline" className="gap-2">
                <FileCheck className="w-4 h-4" />
                Insurance Review
              </Button>
            </Link>
            <Link to="/admin/analytics">
              <Button variant="outline" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                Platform Analytics
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold">{allUsers.length}</p>
                  <p className="text-xs text-gray-500">{activeUsers} active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <PoundSterling className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Revenue</p>
                  <p className="text-2xl font-bold">£{totalRevenue.toFixed(0)}</p>
                  <p className="text-xs text-gray-500">Platform fees</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Transactions</p>
                  <p className="text-2xl font-bold">{allTransactions.length}</p>
                  <p className="text-xs text-gray-500">
                    {allTransactions.filter(t => t.status === 'IN_PROGRESS').length} active
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  openDisputes > 0 ? 'bg-red-100' : 'bg-gray-100'
                }`}>
                  <AlertTriangle className={`w-6 h-6 ${
                    openDisputes > 0 ? 'text-red-600' : 'text-gray-400'
                  }`} />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Open Disputes</p>
                  <p className="text-2xl font-bold">{openDisputes}</p>
                  <p className="text-xs text-gray-500">{allDisputes.length} total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="disputes">
          <TabsList className="bg-white shadow-md mb-6">
            <TabsTrigger value="disputes">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Disputes ({openDisputes})
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="transactions">
              <FileText className="w-4 h-4 mr-2" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="requests">
              <Search className="w-4 h-4 mr-2" />
              Requests
            </TabsTrigger>
          </TabsList>

          {/* Disputes Tab */}
          <TabsContent value="disputes">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle>Dispute Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {allDisputes.filter(d => d.status === 'OPEN' || d.status === 'UNDER_REVIEW').length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                    <p>No open disputes. Great job!</p>
                  </div>
                ) : (
                  allDisputes
                    .filter(d => d.status === 'OPEN' || d.status === 'UNDER_REVIEW')
                    .map(dispute => {
                      const initiator = allUsers.find(u => u.id === dispute.initiatorId);
                      const respondent = allUsers.find(u => u.id === dispute.respondentId);
                      const transaction = allTransactions.find(t => t.id === dispute.transactionId);

                      return (
                        <Card key={dispute.id} className="border-2 border-red-200 bg-red-50">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h4 className="font-semibold text-lg mb-1">{dispute.reason}</h4>
                                <p className="text-sm text-gray-600">
                                  Filed {formatDistanceToNow(new Date(dispute.createdDate), { addSuffix: true })}
                                </p>
                              </div>
                              <Badge className="bg-red-600 text-white">
                                {dispute.status}
                              </Badge>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4 mb-3 text-sm">
                              <div>
                                <p className="text-gray-600">Initiator</p>
                                <p className="font-medium">{initiator?.name || initiator?.username}</p>
                              </div>
                              <div>
                                <p className="text-gray-600">Respondent</p>
                                <p className="font-medium">{respondent?.name || respondent?.username}</p>
                              </div>
                              <div>
                                <p className="text-gray-600">Transaction Value</p>
                                <p className="font-medium">£{transaction?.rentalFee?.toFixed(2)}</p>
                              </div>
                              {transaction?.depositAmount !== undefined && transaction?.depositAmount !== null && (
                                <div>
                                  <p className="text-gray-600">Deposit</p>
                                  <p className="font-medium">£{transaction.depositAmount.toFixed(2)}</p>
                                </div>
                              )}
                            </div>

                            <div className="bg-white p-3 rounded-lg mb-3">
                              <p className="text-sm font-medium mb-1">Details:</p>
                              <p className="text-sm text-gray-700">{dispute.description}</p>
                            </div>

                            {selectedDispute === dispute.id ? (
                              <div className="space-y-3 pt-3 border-t">
                                <Textarea
                                  placeholder="Enter resolution details..."
                                  value={resolution}
                                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setResolution(e.target.value)}
                                  className="h-24"
                                  maxLength={1000}
                                />
                                <div className="grid grid-cols-3 gap-2">
                                  <Button
                                    onClick={() => resolveDisputeMutation.mutate({
                                      disputeId: dispute.id,
                                      status: 'RESOLVED',
                                      refundInitiator: (transaction?.rentalFee || 0) + (transaction?.depositAmount || 0),
                                      refundRespondent: 0
                                    })}
                                    className="bg-green-600 hover:bg-green-700"
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
                          </CardContent>
                        </Card>
                      );
                    })
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <CardTitle>User Management</CardTitle>
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
                            toast.success(`Opening email to ${selectedUsers.size} users`);
                          }}
                        >
                          <Mail className="w-4 h-4 mr-1" />
                          Email ({selectedUsers.size})
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (confirm(`Suspend ${selectedUsers.size} users?`)) {
                              selectedUsers.forEach(id => suspendUserMutation.mutate(id));
                              setSelectedUsers(new Set());
                            }
                          }}
                        >
                          <Ban className="w-4 h-4 mr-1" />
                          Suspend ({selectedUsers.size})
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
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
                      <Card key={user.id} className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex items-start gap-3">
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
                              className="mt-1"
                            />
                            <div>
                              <h4 className="font-semibold">{user.name || user.username}</h4>
                              <p className="text-sm text-gray-600">{user.email}</p>
                              <div className="flex gap-2 mt-2">
                                <Badge variant="outline">
                                  {user.totalTransactions || 0} transactions
                                </Badge>
                                <Badge variant="outline">
                                  ⭐ {user.rating?.toFixed(1) || '0.0'}
                                </Badge>
                                {user.role === 'ADMIN' && (
                                  <Badge className="bg-purple-100 text-purple-800">Admin</Badge>
                                )}
                                {user.accountStatus === 'SUSPENDED' && (
                                  <Badge variant="destructive">Suspended</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                window.location.href = `mailto:${user.email}`;
                              }}
                            >
                              <Mail className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => suspendUserMutation.mutate(user.id)}
                              disabled={user.accountStatus === 'SUSPENDED'}
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <CardTitle>Transactions</CardTitle>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Input
                      placeholder="Search by ID or user..."
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
                        <Card key={transaction.id} className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={
                                  transaction.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                  transaction.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                                  transaction.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-800' :
                                  transaction.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }>
                                  {transaction.status}
                                </Badge>
                                <span className="text-sm text-gray-600">
                                  {formatDistanceToNow(new Date(transaction.createdDate), { addSuffix: true })}
                                </span>
                              </div>
                              <p className="text-sm">
                                <span className="font-medium">{provider?.name || provider?.username || 'Provider'}</span>
                                {' → '}
                                <span className="font-medium">{user?.name || user?.username || 'User'}</span>
                              </p>
                              <p className="text-xs text-gray-400 mt-1">ID: {transaction.id}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg">£{(transaction.rentalFee || 0).toFixed(2)}</p>
                              {transaction.depositAmount !== undefined && transaction.depositAmount !== null && (
                                <p className="text-xs text-gray-600">
                                  +£{transaction.depositAmount.toFixed(2)} deposit
                                </p>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Requests Tab */}
          <TabsContent value="requests">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <CardTitle>Requests</CardTitle>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Input
                      placeholder="Search requests..."
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
                        <Card key={request.id} className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold">{request.title}</h4>
                                <Badge className={
                                  request.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                  request.status === 'FULFILLED' ? 'bg-blue-100 text-blue-800' :
                                  request.status === 'EXPIRED' ? 'bg-gray-100 text-gray-800' :
                                  'bg-red-100 text-red-800'
                                }>
                                  {request.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{request.description?.substring(0, 100)}...</p>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline">{request.category}</Badge>
                                <Badge className="bg-green-100 text-green-800">
                                  £{request.budget}
                                </Badge>
                                <Badge variant="outline">{request.urgency}</Badge>
                                <span className="text-xs text-gray-500">
                                  by {seeker?.name || seeker?.username || 'User'} • {formatDistanceToNow(new Date(request.createdDate), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
