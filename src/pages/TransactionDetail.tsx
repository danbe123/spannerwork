import React, { useState, ChangeEvent } from "react";
import { authService, transactionsService, usersService, toolsService, reviewsService, uploadService } from "@/api/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { queryKeys } from "@/lib/queryKeys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, 
  Camera,
  CheckCircle,
  AlertCircle,
  Star,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function TransactionDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const location = useLocation();
  const { id: transactionIdFromPath } = useParams<{ id: string }>();
  const urlParams = new URLSearchParams(location.search);
  const transactionIdFromQuery = urlParams.get('id');
  const transactionId = transactionIdFromPath || transactionIdFromQuery;

  const transactionIdKey = transactionId ?? '';

  const [pickupPhoto, setPickupPhoto] = useState<string | null>(null);
  const [returnPhoto, setReturnPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");

  const { data: transactionData, isLoading } = useQuery({
    queryKey: queryKeys.transaction(transactionIdKey),
    queryFn: async () => transactionId ? transactionsService.getById(transactionId) : Promise.resolve(undefined),
    enabled: !!transactionId,
  });

  const transaction = transactionData?.transaction;

  const { data: currentUserData } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () => authService.getCurrentUser(),
  });

  const currentUser = currentUserData?.user;

  const providerId = transaction?.providerId ?? '';
  const userId = transaction?.userId ?? '';
  const toolId = transaction?.toolId ?? '';

  const { data: providerData } = useQuery({
    queryKey: transaction?.providerId ? queryKeys.provider(providerId) : queryKeys.providerRoot(),
    queryFn: async () => transaction?.providerId ? usersService.getById(transaction.providerId) : Promise.resolve(undefined),
    enabled: !!transaction?.providerId,
  });

  const provider = providerData?.user;

  const { data: userIdData } = useQuery({
    queryKey: transaction?.userId ? queryKeys.userId(userId) : queryKeys.userIdRoot(),
    queryFn: async () => transaction?.userId ? usersService.getById(transaction.userId) : Promise.resolve(undefined),
    enabled: !!transaction?.userId,
  });

  const user = userIdData?.user;

  const { data: toolData } = useQuery({
    queryKey: transaction?.toolId ? queryKeys.tool(toolId) : queryKeys.tools(),
    queryFn: async () => transaction?.toolId ? toolsService.getById(transaction.toolId) : Promise.resolve(undefined),
    enabled: !!transaction?.toolId,
  });

  const tool = toolData?.tool;

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>, type: 'pickup' | 'return') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const result = await uploadService.uploadFile(file);
      const fileUrl = result.data.fileUrl;
      if (type === 'pickup') {
        setPickupPhoto(fileUrl);
      } else {
        setReturnPhoto(fileUrl);
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
    }
    setUploadingPhoto(false);
  };

  const confirmPickupMutation = useMutation({
    mutationFn: async () => {
      if (!transactionId) return;
      // Backend handles status update and tool availability
      await transactionsService.updateStatus(transactionId, 'IN_PROGRESS');
    },
    onSuccess: () => {
      if (!transactionId) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.transaction(transactionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myTools() });
      queryClient.invalidateQueries({ queryKey: queryKeys.myListings() });
    },
  });

  const confirmReturnMutation = useMutation({
    mutationFn: async () => {
      if (!transaction || !transactionId) return;
      const isProvider = currentUser?.id === transaction.providerId;
      const revieweeId = isProvider ? transaction.userId : transaction.providerId;

      // Complete transaction - backend handles tool availability, emails, notifications
      await transactionsService.complete(transactionId);

      // Create review if rating provided
      if (rating > 0 && revieweeId) {
        await reviewsService.create({
          transactionId: transactionId,
          reviewedUserId: revieweeId, // Fixed field name to match CreateReviewData
          rating: rating,
          comment: review,
        });
      }
    },
    onSuccess: () => {
      if (!transactionId) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.transaction(transactionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myTools() });
      queryClient.invalidateQueries({ queryKey: queryKeys.myListings() });
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
      queryClient.invalidateQueries({ queryKey: queryKeys.providerRoot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.userIdRoot() });
      navigate(createPageUrl("Profile"));
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-12 w-32 mb-6" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Transaction Not Found</h2>
          <Button onClick={() => navigate(createPageUrl("Profile"))}>
            Back to Profile
          </Button>
        </div>
      </div>
    );
  }

  const isProvider = currentUser?.id === transaction.providerId;
  const isUser = currentUser?.id === transaction.userId;
  const otherUser = isProvider ? user : provider;

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    CONFIRMED: "bg-blue-100 text-blue-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    COMPLETED: "bg-green-100 text-green-800",
    CANCELLED: "bg-gray-100 text-gray-800",
  };

  const daysRemaining = transaction?.endDate
    ? Math.ceil((new Date(transaction.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const pickupConditionPhoto = transaction.pickupConditionPhoto;
  const returnConditionPhoto = transaction.returnConditionPhoto;
  const agreedTerms = transaction.agreedTerms;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Profile"))}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Status Banner */}
        <Card className="border-none shadow-lg mb-6">
          <div className={`h-2 ${
            transaction.status === 'COMPLETED' ? 'bg-green-500' :
            (transaction.status as string) === 'ACTIVE' ? 'bg-blue-500' :
            (transaction.status as string) === 'DISPUTED' ? 'bg-red-500' : // DISPUTED not in enum but might be used
            'bg-yellow-500'
          }`} />
          
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div>
                <CardTitle className="text-2xl mb-2">Transaction Details</CardTitle>
                <Badge className={`${statusColors[transaction.status] || 'bg-gray-100'} text-lg px-3 py-1`}>
                  {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1).toLowerCase()}
                </Badge>
              </div>

              {transaction.status === 'IN_PROGRESS' && daysRemaining >= 0 && (
                <div className="text-right">
                  <p className="text-sm text-gray-600">Return due in</p>
                  <p className="text-3xl font-bold text-brand-800">{daysRemaining}</p>
                  <p className="text-sm text-gray-600">day{daysRemaining !== 1 ? 's' : ''}</p>
                </div>
              )}

              {transaction.status === 'IN_PROGRESS' && daysRemaining < 0 && (
                <div className="text-right">
                  <Badge className="bg-red-100 text-red-800 text-lg px-3 py-1">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    Overdue by {Math.abs(daysRemaining)} day{Math.abs(daysRemaining) !== 1 ? 's' : ''}
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Tool Info */}
            {tool && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">Tool</h3>
                <div className="flex items-center gap-3">
                  {tool.photos?.[0] && (
                    <img src={tool.photos[0]} alt={tool.name} className="w-16 h-16 object-cover rounded" />
                  )}
                  <div>
                    <p className="font-medium">{tool.name}</p>
                    <p className="text-sm text-gray-600">{tool.category}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Participants */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-3">Provider</h3>
                {provider && (
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-orange-100 text-brand-800">
                        {provider.name?.[0]?.toUpperCase() || 'P'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{provider.name || provider.email}</p>
                      <div className="flex items-center text-sm text-gray-600">
                        <Star className="w-3 h-3 fill-[#FFC107] text-[#FFC107] mr-1" />
                        {provider.rating?.toFixed(1) || '0.0'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-3">User</h3>
                {user && (
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-blue-100 text-blue-700">
                        {user.name?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.name || user.email}</p>
                      <div className="flex items-center text-sm text-gray-600">
                        <Star className="w-3 h-3 fill-[#FFC107] text-[#FFC107] mr-1" />
                        {user.rating?.toFixed(1) || '0.0'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Financial Details */}
            <div className="grid md:grid-cols-3 gap-4 py-4 border-t border-b">
              {transaction.depositAmount !== undefined && transaction.depositAmount !== null && (
                <div>
                  <p className="text-sm text-gray-600">Deposit</p>
                  <p className="text-xl font-bold">£{transaction.depositAmount.toFixed(2)}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Rental Fee</p>
                <p className="text-xl font-bold">£{transaction.rentalFee?.toFixed(2) || '0.00'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Duration</p>
                <p className="text-xl font-bold">{agreedTerms?.durationDays || 1} day(s)</p>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h3 className="font-semibold mb-3">Timeline</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1" />
                  <div>
                    <p className="font-medium">Transaction Created</p>
                    <p className="text-sm text-gray-600">
                      {format(new Date(transaction.createdDate), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>

                {transaction.startDate && (
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-1" />
                    <div>
                      <p className="font-medium">Tool Picked Up</p>
                      <p className="text-sm text-gray-600">
                        {format(new Date(transaction.startDate), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                )}

                {(transaction.completedDate || transaction.endDate) && (
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-1" />
                    <div>
                      <p className="font-medium">Tool Returned</p>
                      <p className="text-sm text-gray-600">
                        {format(new Date(transaction.completedDate || transaction.endDate), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Condition Photos */}
            {(pickupConditionPhoto || returnConditionPhoto) && (
              <div>
                <h3 className="font-semibold mb-3">Condition Photos</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {pickupConditionPhoto && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">At Pickup</p>
                      <img
                        src={pickupConditionPhoto}
                        alt="Pickup condition"
                        className="w-full h-48 object-cover rounded-lg border"
                      />
                    </div>
                  )}
                  {returnConditionPhoto && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">At Return</p>
                      <img
                        src={returnConditionPhoto}
                        alt="Return condition"
                        className="w-full h-48 object-cover rounded-lg border"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            {transaction.status === 'CONFIRMED' && isUser && (
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">Confirm Pickup</h3>
                <p className="text-sm text-gray-600">
                  Take a photo of the tool's condition before taking it
                </p>
                
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload(e, 'pickup')}
                  className="hidden"
                  id="pickup-photo"
                />
                
                {pickupPhoto ? (
                  <img src={pickupPhoto} alt="Pickup" className="w-full h-48 object-cover rounded-lg border" />
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('pickup-photo')?.click()}
                    disabled={uploadingPhoto}
                    className="w-full"
                  >
                    {uploadingPhoto ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 mr-2" />
                        Take Photo
                      </>
                    )}
                  </Button>
                )}

                <Button
                  onClick={() => confirmPickupMutation.mutate()}
                  disabled={!pickupPhoto || confirmPickupMutation.isPending}
                  className="w-full bg-brand-800 hover:bg-brand-900"
                >
                  Confirm Pickup
                </Button>
              </div>
            )}

            {transaction.status === 'IN_PROGRESS' && isProvider && (
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">Confirm Return</h3>
                <p className="text-sm text-gray-600">
                  Take a photo of the tool's condition upon return
                </p>
                
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload(e, 'return')}
                  className="hidden"
                  id="return-photo"
                />
                
                {returnPhoto ? (
                  <img src={returnPhoto} alt="Return" className="w-full h-48 object-cover rounded-lg border" />
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('return-photo')?.click()}
                    disabled={uploadingPhoto}
                    className="w-full"
                  >
                    {uploadingPhoto ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 mr-2" />
                        Take Photo
                      </>
                    )}
                  </Button>
                )}

                {/* Rating */}
                <div>
                  <p className="text-sm font-medium mb-2">Rate {otherUser?.name}</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="focus:outline-none"
                      >
                        <Star
                          className={`w-8 h-8 ${
                            star <= rating
                              ? 'fill-[#FFC107] text-[#FFC107]'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <Textarea
                  placeholder="Leave a review (optional)"
                  value={review}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReview(e.target.value)}
                  className="h-24"
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 text-right">{review.length}/500</p>

                <Button
                  onClick={() => confirmReturnMutation.mutate()}
                  disabled={!returnPhoto || confirmReturnMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {confirmReturnMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Confirm Return & Complete
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Dispute Button */}
            {(transaction.status === 'IN_PROGRESS' || transaction.status === 'COMPLETED') && (
              <div className="pt-4 border-t mt-6">
                <p className="text-sm text-gray-600 mb-3">
                  Having an issue? You can file a dispute if there's a problem with this transaction.
                </p>
                <Button
                  variant="outline"
                  className="w-full border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => navigate(createPageUrl(`DisputeResolution?transactionId=${transactionId}`))}
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  File a Dispute
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
