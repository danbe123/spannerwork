import { useState, FormEvent, ChangeEvent } from "react";
import { requestsService, transactionsService, toolsService } from "@/api/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tool, Request } from "@/types";

export default function StartTransaction() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const urlParams = new URLSearchParams(window.location.search);
  const requestId = urlParams.get('requestId');
  const helperId = urlParams.get('helperId');
  const _seekerId = urlParams.get('seekerId');

  const [selectedToolId, setSelectedToolId] = useState("");
  const [depositAmount, setDepositAmount] = useState(0);
  const [rentalFee, setRentalFee] = useState(0);
  const [durationDays, setDurationDays] = useState(1);
  const [helperNotes, setHelperNotes] = useState("");

  const { data: requestData } = useQuery({
    queryKey: ['request', requestId],
    queryFn: () => requestsService.getById(requestId!),
    enabled: !!requestId,
  });

  const request: Request | undefined = requestData?.request;

  const { data: myToolsData } = useQuery({
    queryKey: ['providerTools', helperId],
    queryFn: () => toolsService.list({}),
    enabled: !!helperId,
  });

  const myTools: Tool[] = myToolsData?.data || [];

  const createTransactionMutation = useMutation({
    mutationFn: async () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + durationDays);

      const result = await transactionsService.create({
        requestId: requestId || undefined,
        toolId: selectedToolId && selectedToolId !== "none" ? selectedToolId : undefined,
        startDate: new Date().toISOString(),
        endDate: endDate.toISOString(),
        notes: helperNotes,
      });

      return result.transaction;
    },
    onSuccess: (transaction) => {
      queryClient.invalidateQueries({ queryKey: ['request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['myListings'] });
      navigate(createPageUrl(`Payment?transactionId=${transaction.id}`));
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (rentalFee <= 0 || depositAmount < 0) return;
    createTransactionMutation.mutate();
  };

  const selectedTool = myTools.find(t => t.id === selectedToolId);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Start Transaction</h1>
          <p className="text-gray-600 mt-2">Set the terms for your service</p>
        </div>

        {request && (
          <Card className="border-none shadow-lg mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Request Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold text-gray-900 mb-1">{request.title}</p>
              <p className="text-sm text-gray-600 mb-2">{request.description}</p>
              {request.budget && (
                <Badge className="bg-green-100 text-green-800">
                  Requested Budget: £{request.budget}
                  {request.rateType === 'HOURLY' && '/hr'}
                  {request.rateType === 'DAILY' && '/day'}
                </Badge>
              )}
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit}>
          <Card className="border-none shadow-lg mb-6">
            <CardHeader>
              <CardTitle>Service Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {myTools.length > 0 && (
                <div>
                  <Label>Select Tool (Optional)</Label>
                  <Select value={selectedToolId} onValueChange={setSelectedToolId}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Choose a tool from your inventory" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific tool (providing expertise/space)</SelectItem>
                      {myTools.map((tool) => (
                        <SelectItem key={tool.id} value={tool.id}>
                          {tool.name} - {tool.category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTool && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium">{selectedTool.name}</p>
                      <p className="text-xs text-gray-600 mt-1">{selectedTool.description}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline">{selectedTool.condition}</Badge>
                        {selectedTool.dailyRate && (
                          <Badge className="bg-green-100 text-green-800">£{selectedTool.dailyRate}/day</Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="duration">Service Duration</Label>
                <div className="flex items-center gap-3 mt-2">
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    max="30"
                    value={durationDays}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setDurationDays(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24"
                  />
                  <span className="text-gray-600">day(s)</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Expected completion by: {new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </p>
              </div>

              <div>
                <Label htmlFor="deposit">Security Deposit (£)</Label>
                <Input
                  id="deposit"
                  type="number"
                  min="0"
                  step="5"
                  value={depositAmount}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDepositAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0"
                  className="mt-2"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Optional security deposit, refunded upon completion
                </p>
              </div>

              <div>
                <Label htmlFor="rental">Your Rate (£) *</Label>
                <Input
                  id="rental"
                  type="number"
                  min="1"
                  step="1"
                  value={rentalFee}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setRentalFee(Math.max(1, parseFloat(e.target.value) || 0))}
                  placeholder="Enter your rate"
                  className="mt-2"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  {request?.rateType === 'HOURLY' && 'Your hourly rate'}
                  {request?.rateType === 'DAILY' && 'Your daily rate'}
                  {request?.rateType === 'FIXED' && 'Your total price for this job'}
                </p>
              </div>

              <div>
                <Label htmlFor="notes">Additional Terms & Notes</Label>
                <Textarea
                  id="notes"
                  value={helperNotes}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setHelperNotes(e.target.value)}
                  placeholder="Any special instructions, meeting location, terms..."
                  className="mt-2 h-24"
                  maxLength={1000}
                />
              </div>

              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-3">Payment Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium">{durationDays} day(s)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Security Deposit:</span>
                    <span className="font-medium">£{depositAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Service Fee:</span>
                    <span className="font-medium">£{rentalFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="font-semibold">Total Due Now:</span>
                    <span className="font-bold text-brand-800">
                      £{(depositAmount + rentalFee).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Alert className="mb-6">
            <FileText className="h-4 w-4" />
            <AlertDescription>
              Once both parties agree, the client will confirm with a photo. Payment will be held until service completion.
            </AlertDescription>
          </Alert>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createTransactionMutation.isPending || rentalFee <= 0 || depositAmount < 0}
              className="flex-1 bg-brand-800 hover:bg-brand-900"
            >
              {createTransactionMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Transaction'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
