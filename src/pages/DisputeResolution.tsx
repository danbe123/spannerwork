import { useState, ChangeEvent, FormEvent } from "react";
import { authService, disputesService, transactionsService, uploadService } from "@/api/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { Dispute, Transaction, User } from "@/types";
import type { UploadedFile } from "@/api/services/upload";
import SEO from "@/components/SEO";
import MarketingFooter from "@/components/MarketingFooter";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsBreadcrumbs from "@/components/docs/DocsBreadcrumbs";
import DocsMobileHeader from "@/components/docs/DocsMobileHeader";
import { Link } from "react-router-dom";

interface UpdateDisputeParams {
  disputeId: string;
  data: {
    status: string;
    resolution: string;
  };
}

export default function DisputeResolution() {
  const queryClient = useQueryClient();
  const [_selectedDispute, setSelectedDispute] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolutionType, setResolutionType] = useState("");

  const [newTransactionId, setNewTransactionId] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [evidenceUploads, setEvidenceUploads] = useState<UploadedFile[]>([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  const { data: currentUserData } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => authService.getCurrentUser(),
  });

  const currentUser: User | undefined = currentUserData?.user;

  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ['myDisputes'],
    queryFn: async (): Promise<Dispute[]> => {
      if (!currentUser?.id) return [];
      const result = await disputesService.list({});
      return result.data || [];
    },
    enabled: !!currentUser?.id,
  });

  const { data: transactions = [], isLoading: isTransactionsLoading } = useQuery({
    queryKey: ['myTransactionsForDispute', currentUser?.id],
    queryFn: async (): Promise<Transaction[]> => {
      if (!currentUser?.id) return [];

      const [asUser, asProvider] = await Promise.all([
        transactionsService.list({}),
        transactionsService.list({ asProvider: true }),
      ]);

      const combined = [
        ...(asUser.data ?? []),
        ...(asProvider.data ?? []),
      ] as Transaction[];

      const seen = new Set<string>();
      return combined.filter((t) => {
        const id = (t as unknown as { id?: string })?.id;
        if (!id) return false;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    },
    enabled: !!currentUser?.id,
  });

  const updateDisputeMutation = useMutation({
    mutationFn: ({ disputeId, data }: UpdateDisputeParams) => disputesService.resolve(disputeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myDisputes'] });
      setSelectedDispute(null);
      setResolutionNotes("");
      setResolutionType("");
      toast.success("Dispute updated successfully");
    },
  });

  const createDisputeMutation = useMutation({
    mutationFn: () =>
      disputesService.create({
        transactionId: newTransactionId,
        reason: newReason,
        description: (() => {
          const base = (newDescription || '').trim();
          if (evidenceUploads.length === 0) return base;

          let out = base;
          const header = "\n\nEvidence:";
          if (out.length + header.length <= 2000) {
            out += header;
          }

          for (const file of evidenceUploads) {
            const line = `\n- ${file.fileUrl}`;
            if (out.length + line.length > 2000) break;
            out += line;
          }

          return out;
        })(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myDisputes'] });
      setNewTransactionId("");
      setNewReason("");
      setNewDescription("");
      setEvidenceUploads([]);
      toast.success("Dispute submitted", {
        description: "Our team will review it and contact both parties.",
      });
    },
  });

  const handleCreateDispute = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser?.id) {
      toast.error("Please sign in to raise a dispute");
      return;
    }

    if (!newTransactionId || !newReason || !newDescription) {
      toast.error("Please complete all fields");
      return;
    }

    createDisputeMutation.mutate();
  };

  const handleEvidenceChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    setUploadingEvidence(true);
    try {
      const result = await uploadService.uploadFiles(files);
      const uploaded = result.data.files || [];
      setEvidenceUploads((prev) => [...prev, ...uploaded]);
      if (result.data.warning) {
        toast.error(result.data.warning);
      }
    } catch (err) {
      console.error('Evidence upload error:', err);
      toast.error('Failed to upload images');
    } finally {
      setUploadingEvidence(false);
    }
  };

  const statusColors: Record<string, string> = {
    OPEN: "bg-yellow-100 text-yellow-800",
    UNDER_REVIEW: "bg-blue-100 text-blue-800",
    RESOLVED_FOR_INITIATOR: "bg-green-100 text-green-800",
    RESOLVED_FOR_RESPONDENT: "bg-green-100 text-green-800",
    RESOLVED_SPLIT: "bg-purple-100 text-purple-800",
    CLOSED: "bg-gray-100 text-gray-800",
  };

  const handleResolve = (dispute: Dispute) => {
    if (!resolutionType || !resolutionNotes) {
      toast.error("Please select resolution type and add notes");
      return;
    }

    updateDisputeMutation.mutate({
      disputeId: dispute.id,
      data: {
        status: resolutionType,
        resolution: resolutionNotes,
      }
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100">
        <div className="bg-gradient-to-br from-brand-800 to-brand-900 text-white py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Skeleton className="h-10 w-64 mx-auto bg-white/20" />
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-10">
          <Skeleton className="h-6 w-80 mb-6" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Dispute Resolution | SpannerWork"
        description="Raise and track disputes for transactions on SpannerWork. Our team reviews disputes fairly and quickly."
      />

      <DocsMobileHeader />

      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100">
        <div className="bg-gradient-to-br from-brand-800 to-brand-900 text-white py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Dispute Resolution</h1>
            <p className="text-xl text-orange-100">Raise a dispute, track progress, and get a fair outcome</p>
            <div className="mt-6">
              <Link to="/resources">
                <Button variant="ghost" className="text-white hover:bg-white/20">
                  Back to Resources
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <DocsBreadcrumbs />
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="lg:flex lg:gap-8">
            <div className="hidden lg:block w-[280px] flex-none">
              <DocsSidebar />
            </div>

            <div className="min-w-0 flex-1 space-y-8">
              {!currentUser?.id ? (
                <Card className="border-none shadow-lg">
                  <CardContent className="p-8">
                    <h2 className="text-xl font-bold mb-2">Sign in to raise a dispute</h2>
                    <p className="text-gray-600 mb-6">
                      Disputes are tied to a specific transaction, so you’ll need to be signed in to submit one.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Link to="/profile">
                        <Button className="bg-brand-800 hover:bg-brand-900">Sign In</Button>
                      </Link>
                      <Link to="/contact">
                        <Button variant="outline">Contact Support</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-none shadow-lg">
                  <CardHeader>
                    <CardTitle>Raise a Dispute</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateDispute} className="space-y-4">
                      <div>
                        <Label>Choose an order</Label>
                        <Select
                          value={newTransactionId}
                          onValueChange={(value) => {
                            if (value.startsWith('__')) return;
                            setNewTransactionId(value);
                          }}
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder="Select a transaction" />
                          </SelectTrigger>
                          <SelectContent>
                            {isTransactionsLoading ? (
                              <SelectItem value="__loading" disabled>
                                Loading transactions...
                              </SelectItem>
                            ) : transactions.length === 0 ? (
                              <SelectItem value="__none" disabled>
                                No transactions found
                              </SelectItem>
                            ) : (
                              transactions.map((t) => {
                                const id = (t as unknown as { id: string }).id;
                                const status = (t as unknown as { status?: string }).status;
                                const dateRaw =
                                  (t as unknown as { createdDate?: string }).createdDate ||
                                  (t as unknown as { startDate?: string }).startDate ||
                                  (t as unknown as { endDate?: string }).endDate;

                                let dateLabel = '';
                                if (dateRaw) {
                                  const d = new Date(dateRaw);
                                  if (!Number.isNaN(d.getTime())) {
                                    dateLabel = format(d, 'MMM d, yyyy');
                                  }
                                }

                                const display = [
                                  id,
                                  status || 'Transaction',
                                  dateLabel,
                                ].filter(Boolean).join(' • ');

                                return (
                                  <SelectItem key={id} value={id}>
                                    {display}
                                  </SelectItem>
                                );
                              })
                            )}
                          </SelectContent>
                        </Select>

                        <div className="mt-4">
                          <Label htmlFor="transactionId">Or paste a transaction ID</Label>
                          <Input
                            id="transactionId"
                            value={newTransactionId}
                            onChange={(e) => setNewTransactionId(e.target.value)}
                            placeholder="e.g. txn_123..."
                            className="mt-2"
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Reason</Label>
                        <Select value={newReason} onValueChange={setNewReason}>
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder="Select a reason" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Item not as described">Item not as described</SelectItem>
                            <SelectItem value="Item damaged">Item damaged</SelectItem>
                            <SelectItem value="Late / no-show">Late / no-show</SelectItem>
                            <SelectItem value="Payment / refund issue">Payment / refund issue</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="description">What happened?</Label>
                        <Textarea
                          id="description"
                          value={newDescription}
                          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNewDescription(e.target.value)}
                          placeholder="Explain what happened, dates/times, and what outcome you're seeking..."
                          className="mt-2 h-28"
                        />
                      </div>

                      <div>
                        <Label htmlFor="evidenceFiles">Attach photos (optional)</Label>
                        <Input
                          id="evidenceFiles"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleEvidenceChange}
                          className="mt-2"
                          disabled={uploadingEvidence}
                        />

                        {uploadingEvidence ? (
                          <p className="text-sm text-gray-600 mt-2">Uploading…</p>
                        ) : null}

                        {evidenceUploads.length > 0 ? (
                          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {evidenceUploads.map((file) => (
                              <div key={file.fileUrl} className="border rounded-lg p-2 bg-white">
                                <img
                                  src={file.fileUrl}
                                  alt={file.originalName}
                                  className="w-full h-28 object-cover rounded"
                                />
                                <div className="mt-2 flex items-center justify-between gap-2">
                                  <span className="text-xs text-gray-600 truncate" title={file.originalName}>
                                    {file.originalName}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setEvidenceUploads((prev) => prev.filter((f) => f.fileUrl !== file.fileUrl))}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <Button
                        type="submit"
                        className="w-full bg-brand-800 hover:bg-brand-900"
                        disabled={
                          createDisputeMutation.isPending ||
                          uploadingEvidence ||
                          !newTransactionId ||
                          !newReason ||
                          !newDescription
                        }
                      >
                        {createDisputeMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          'Submit Dispute'
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              <div>
                <div className="mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">Your Disputes</h2>
                  <p className="text-gray-600">View and manage your disputes</p>
                </div>

                {disputes.length === 0 ? (
                  <Card className="border-none shadow-lg">
                    <CardContent className="p-12 text-center">
                      <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">No Disputes</h3>
                      <p className="text-gray-600">You don't have any active disputes.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {disputes.map((dispute) => (
                      <Card key={dispute.id} className="border-none shadow-lg">
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <CardTitle className="text-xl mb-2">{dispute.reason}</CardTitle>
                              <div className="flex flex-wrap gap-2">
                                <Badge className={statusColors[dispute.status] || statusColors.OPEN}>
                                  {dispute.status.replace(/_/g, ' ')}
                                </Badge>
                                <Badge variant="outline">Transaction ID: {dispute.transactionId}</Badge>
                                <Badge variant="outline" className="text-xs">
                                  Filed {format(new Date(dispute.createdDate), 'MMM d, yyyy')}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                          <div>
                            <h4 className="font-semibold mb-2">Details</h4>
                            <p className="text-gray-700">{dispute.description}</p>
                          </div>

                          {dispute.resolution && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                              <h4 className="font-semibold mb-2">Resolution</h4>
                              <p className="text-sm text-gray-700">{dispute.resolution}</p>
                              {dispute.resolvedDate && (
                                <p className="text-xs text-gray-500 mt-2">
                                  Resolved on {format(new Date(dispute.resolvedDate), 'MMM d, yyyy')}
                                </p>
                              )}
                            </div>
                          )}

                          {dispute.status === 'OPEN' && currentUser?.role === 'ADMIN' && (
                            <div className="border-t pt-4 space-y-4">
                              <div>
                                <Label>Resolution Type</Label>
                                <Select value={resolutionType} onValueChange={setResolutionType}>
                                  <SelectTrigger className="mt-2">
                                    <SelectValue placeholder="Select resolution" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="RESOLVED_FOR_INITIATOR">Resolve for Initiator</SelectItem>
                                    <SelectItem value="RESOLVED_FOR_RESPONDENT">Resolve for Respondent</SelectItem>
                                    <SelectItem value="RESOLVED_SPLIT">Split Resolution</SelectItem>
                                    <SelectItem value="CLOSED">Close Without Resolution</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label>Resolution Notes</Label>
                                <Textarea
                                  value={resolutionNotes}
                                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setResolutionNotes(e.target.value)}
                                  placeholder="Explain the resolution..."
                                  className="mt-2 h-24"
                                />
                              </div>

                              <Button
                                onClick={() => handleResolve(dispute)}
                                disabled={updateDisputeMutation.isPending || !resolutionType || !resolutionNotes}
                                className="w-full bg-brand-800 hover:bg-brand-900"
                              >
                                {updateDisputeMutation.isPending ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Resolving...
                                  </>
                                ) : (
                                  'Resolve Dispute'
                                )}
                              </Button>
                            </div>
                          )}

                          {dispute.status === 'OPEN' && currentUser?.role !== 'ADMIN' && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                              <p className="text-sm text-gray-700">
                                This dispute is under review. Our team will investigate and reach out to both parties shortly.
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <MarketingFooter />
      </div>
    </>
  );
}
