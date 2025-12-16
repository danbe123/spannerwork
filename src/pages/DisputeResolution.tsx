import { useState, ChangeEvent } from "react";
import { authService, disputesService } from "@/api/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { Dispute, User } from "@/types";

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
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-12 w-64 mb-6" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dispute Resolution</h1>
          <p className="text-gray-600">View and manage your disputes</p>
        </div>

        {disputes.length === 0 ? (
          <Card className="border-none shadow-lg">
            <CardContent className="p-12 text-center">
              <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Disputes</h3>
              <p className="text-gray-600">
                You don't have any active disputes. This is great news!
              </p>
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
                        <Badge variant="outline">
                          Transaction ID: {dispute.transactionId}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Filed {format(new Date(dispute.createdDate), 'MMM d, yyyy')}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Dispute Details */}
                  <div>
                    <h4 className="font-semibold mb-2">Details</h4>
                    <p className="text-gray-700">{dispute.description}</p>
                  </div>

                  {/* Resolution */}
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

                  {/* Resolution Actions - Only for open disputes */}
                  {dispute.status === 'OPEN' && currentUser?.role === 'ADMIN' && (
                    <div className="border-t pt-4 space-y-4">
                      <div>
                        <Label>Resolution Type</Label>
                        <Select 
                          value={resolutionType} 
                          onValueChange={setResolutionType}
                        >
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

                  {/* Pending Review Message */}
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
  );
}
