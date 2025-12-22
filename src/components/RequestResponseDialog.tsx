import { useState, ChangeEvent, FormEvent, useRef } from "react";
import { authService, quickAcceptService, messagesService, uploadService } from "@/api/services";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, Send, Wrench, GraduationCap, Warehouse, LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Request } from "@/types";
import { queryKeys } from "@/lib/queryKeys";
import { formatPrice } from "@/utils";

const formatPostcode = (input: string | null | undefined): string => {
  if (!input) return '';
  const cleaned = input.toString().replace(/\s+/g, '').toUpperCase();
  if (cleaned.length >= 5 && cleaned.length <= 7) {
    const outward = cleaned.slice(0, -3);
    const inward = cleaned.slice(-3);
    return `${outward} ${inward}`;
  }
  return cleaned;
};

interface RequestResponseDialogProps {
  request: Request;
  onClose: () => void;
}

export default function RequestResponseDialog({ request, onClose }: RequestResponseDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: currentUserData } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () => authService.getCurrentUser(),
  });

  const currentUser = currentUserData?.user;

  const [_selectedToolId] = useState("");
  const [rate, setRate] = useState("");
  const [message, setMessage] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const photosRef = useRef<string[]>([]);
  const updatePhotos = (updater: (prev: string[]) => string[]) => {
    const next = updater(photosRef.current);
    photosRef.current = next;
    setPhotos(next);
  };
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const rateSuffix = request.rateType === 'HOURLY'
    ? '/hr'
    : request.rateType === 'DAILY'
      ? '/day'
      : '';

  const rateLabel = request.rateType === 'FIXED' ? 'Your Quote' : 'Your Rate';
  const ratePence = Math.round((parseFloat(rate) || 0) * 100);

  const sendQuoteMutation = useMutation({
    mutationFn: async (vars: { rentalFeePence: number; message: string; photos: string[] }) => {
      if (!currentUser) throw new Error("Not authenticated");

      const { rentalFeePence, message, photos } = vars;
      if (!Number.isFinite(rentalFeePence) || rentalFeePence <= 0) throw new Error("Please enter a valid quote amount");

      const result = await quickAcceptService.accept(request.id, rentalFeePence);

      const quoteLine = `I've sent you a quote for "${request.title}": ${formatPrice(rentalFeePence)}${rateSuffix}.`;

      const extraSections: string[] = [];
      if (message.trim()) extraSections.push(message.trim());
      if (photos.length > 0) extraSections.push(`Photos:\n${photos.join('\n')}`);

      const content = extraSections.length > 0
        ? `${quoteLine}\n\n${extraSections.join('\n\n')}`
        : quoteLine;

      await messagesService.send({
        recipientId: request.seekerId,
        content,
      });

      return result;
    },
    onMutate: () => {
      setSubmitError(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests() });
      queryClient.invalidateQueries({ queryKey: queryKeys.request(request.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.allMessages() });
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingResponses() });
      navigate(`/Chat?userId=${request.seekerId}&requestId=${request.id}`);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to send quote';
      setSubmitError(message);
    },
  });

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photosRef.current.length >= 5) return;
    
    setUploadingPhoto(true);
    setPhotoUploadError(null);
    try {
      const result = await uploadService.uploadFile(file);
      updatePhotos((prev) => [...prev, result.data.fileUrl]);
    } catch (error) {
      console.error("Error uploading photo:", error);
      setPhotoUploadError('Upload failed. Please try again.');
    }
    setUploadingPhoto(false);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!rate || !currentUser) return;
    if (!Number.isFinite(ratePence) || ratePence <= 0) return;
    sendQuoteMutation.mutate({ rentalFeePence: ratePence, message, photos });
  };

  const categoryIcons: Record<string, LucideIcon> = {
    tools: Wrench,
    expertise: GraduationCap,
    space: Warehouse,
    TOOLS: Wrench,
    EXPERTISE: GraduationCap,
    SPACE: Warehouse,
  };

  const CategoryIcon = categoryIcons[request.category] || Wrench;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Your Quote</DialogTitle>
        </DialogHeader>

        {/* Request Summary */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
              <CategoryIcon className="w-5 h-5 text-brand-800" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-1">{request.title}</h4>
              <p className="text-sm text-gray-600 line-clamp-2">{request.description}</p>
              <div className="flex gap-2 mt-2">
                <Badge className="bg-green-600 text-white">
                  Budget: {formatPrice(request.budget)}
                  {request.rateType === 'HOURLY' && '/hr'}
                  {request.rateType === 'DAILY' && '/day'}
                </Badge>
                {request.postcode && (
                  <Badge variant="outline">
                    {formatPostcode(request.postcode)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {submitError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {submitError}
            </div>
          )}

          {/* Pricing */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="rate">
                {rateLabel} ({request.rateType === 'HOURLY' ? '£/hr' : request.rateType === 'DAILY' ? '£/day' : '£'}) *
              </Label>
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">£</span>
                <Input
                  id="rate"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={request.rateType === 'FIXED' ? 'Enter your quote' : 'Enter your rate'}
                  value={rate}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || (/^\d+(\.\d{0,2})?$/.test(value) && parseFloat(value) >= 0)) {
                      setRate(value);
                    }
                  }}
                  className="pl-7"
                  required
                />
              </div>
              {ratePence > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-600">
                    You’ll send: <span className="font-medium text-gray-900">{formatPrice(ratePence)}{rateSuffix}</span>
                  </p>
                  {request.budget > 0 && (
                    <p className="text-xs text-gray-600">
                      Compared to budget:{' '}
                      {ratePence === request.budget ? (
                        <span className="font-medium text-gray-900">matches</span>
                      ) : ratePence > request.budget ? (
                        <span className="font-medium text-red-700">{formatPrice(ratePence - request.budget)} over</span>
                      ) : (
                        <span className="font-medium text-green-700">{formatPrice(request.budget - ratePence)} under</span>
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Message */}
          <div>
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Add any details that help the seeker decide (timing, experience, what’s included, etc.)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-2 h-32"
            />
          </div>

          {/* Photos */}
          <div>
            <Label>Attach Photos (Optional)</Label>
            <div className="flex gap-3 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('photo-upload-quote')?.click()}
                disabled={uploadingPhoto || sendQuoteMutation.isPending || photos.length >= 5}
              >
                {uploadingPhoto ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Photo
                  </>
                )}
              </Button>
              <input
                id="photo-upload-quote"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {photos.length}/5 attached. Links will be included in the chat message.
            </p>
            {photoUploadError && (
              <p className="text-xs text-red-700 mt-1">{photoUploadError}</p>
            )}
            {photos.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {photos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img
                      src={photo}
                      alt={`Upload ${index + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => updatePhotos((prev) => prev.filter((_, i) => i !== index))}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      disabled={sendQuoteMutation.isPending}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={sendQuoteMutation.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={sendQuoteMutation.isPending || uploadingPhoto || !rate || !currentUser || !Number.isFinite(ratePence) || ratePence <= 0}
              className="flex-1 bg-brand-800 hover:bg-brand-900"
            >
              {sendQuoteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Quote
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
