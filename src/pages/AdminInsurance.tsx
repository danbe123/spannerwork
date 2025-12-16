import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileCheck, 
  FileX, 
  Clock, 
  AlertTriangle, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
  Shield,
  PoundSterling
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { adminInsuranceService, InsuranceDocument } from '@/api/services/insurance';
import { formatDistanceToNow, format } from 'date-fns';

export default function AdminInsurance() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingDocs, setPendingDocs] = useState<InsuranceDocument[]>([]);
  const [expiringDocs, setExpiringDocs] = useState<InsuranceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  
  // Dialog state
  const [selectedDoc, setSelectedDoc] = useState<InsuranceDocument | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab, pagination.page]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'pending') {
        const response = await adminInsuranceService.getPendingDocuments({ 
          page: pagination.page, 
          limit: pagination.limit 
        });
        setPendingDocs(response.data);
        setPagination(prev => ({ ...prev, ...response.pagination }));
      } else {
        const response = await adminInsuranceService.getExpiringDocuments(30);
        setExpiringDocs(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(doc: InsuranceDocument) {
    setActionLoading(true);
    try {
      await adminInsuranceService.approveDocument(doc.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve document');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!selectedDoc || !rejectReason.trim()) return;
    
    setActionLoading(true);
    try {
      await adminInsuranceService.rejectDocument(selectedDoc.id, rejectReason);
      setRejectDialogOpen(false);
      setRejectReason('');
      setSelectedDoc(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject document');
    } finally {
      setActionLoading(false);
    }
  }

  function openRejectDialog(doc: InsuranceDocument) {
    setSelectedDoc(doc);
    setRejectDialogOpen(true);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'PENDING_REVIEW':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'APPROVED':
        return <Badge variant="secondary" className="bg-green-100 text-green-800"><FileCheck className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive"><FileX className="h-3 w-3 mr-1" />Rejected</Badge>;
      case 'EXPIRED':
        return <Badge variant="secondary" className="bg-red-100 text-red-800"><AlertTriangle className="h-3 w-3 mr-1" />Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function formatCoverage(pence: number | null): string {
    if (!pence) return 'Not specified';
    return `£${(pence / 100).toLocaleString()}`;
  }

  const documents = activeTab === 'pending' ? pendingDocs : expiringDocs;

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Insurance Verification</h1>
          <p className="text-muted-foreground">Review and approve provider insurance documents</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/admin')}>
          Back to Admin
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending Review
            {pendingDocs.length > 0 && (
              <Badge variant="secondary" className="ml-1">{pagination.total || pendingDocs.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="expiring" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Expiring Soon
            {expiringDocs.length > 0 && (
              <Badge variant="secondary" className="ml-1">{expiringDocs.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : documents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileCheck className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium">All caught up!</h3>
                <p className="text-muted-foreground">No pending insurance documents to review.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <Card key={doc.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <User className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{doc.user?.name || 'Unknown User'}</span>
                          <span className="text-muted-foreground">{doc.user?.email}</span>
                          {getStatusBadge(doc.status)}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Insurance Type</p>
                            <p className="font-medium">{doc.documentType.replace(/_/g, ' ')}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Provider</p>
                            <p className="font-medium">{doc.provider || 'Not specified'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <PoundSterling className="h-3 w-3" /> Coverage
                            </p>
                            <p className="font-medium">{formatCoverage(doc.coverageAmount)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> Expiry
                            </p>
                            <p className="font-medium">
                              {doc.expiryDate 
                                ? format(new Date(doc.expiryDate), 'dd MMM yyyy')
                                : 'Not specified'
                              }
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 text-sm text-muted-foreground">
                          Uploaded {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                          {doc.policyNumber && ` • Policy #${doc.policyNumber}`}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(doc.documentUrl, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View Doc
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(doc)}
                          disabled={actionLoading}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <FileCheck className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openRejectDialog(doc)}
                          disabled={actionLoading}
                        >
                          <FileX className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                    disabled={pagination.page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="expiring">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : expiringDocs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium">All clear!</h3>
                <p className="text-muted-foreground">No insurance documents expiring in the next 30 days.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <span>These documents expire within 30 days. Consider notifying providers to renew.</span>
              </div>
              
              {expiringDocs.map((doc) => (
                <Card key={doc.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <User className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{doc.user?.name || 'Unknown User'}</span>
                          <span className="text-muted-foreground">{doc.user?.email}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span>{doc.documentType.replace(/_/g, ' ')}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-red-600 font-medium">
                            Expires {doc.expiryDate 
                              ? format(new Date(doc.expiryDate), 'dd MMM yyyy')
                              : 'Unknown'
                            }
                          </span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Send Reminder
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Insurance Document</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this document. The provider will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter rejection reason (e.g., 'Document is illegible', 'Coverage amount too low', 'Expired document')"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={!rejectReason.trim() || actionLoading}
            >
              {actionLoading ? 'Rejecting...' : 'Reject Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
