import { useState, ChangeEvent, FormEvent } from "react";
import { authService, transactionsService, messagesService, uploadService } from "@/api/services";
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
    queryKey: ['currentUser'],
    queryFn: () => authService.getCurrentUser(),
  });

  const currentUser = currentUserData?.user;

  const [selectedToolId] = useState("");
  const [rate, setRate] = useState("");
  const [deposit, setDeposit] = useState("");
  const [message, setMessage] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);

  const sendQuoteMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) throw new Error("Not authenticated");
      
      const result = await transactionsService.create({
        requestId: request.id,
        // @ts-expect-error - providerId may not be in type definition
        providerId: currentUser.id,
        userId: request.seekerId,
        toolId: selectedToolId || undefined,
        rentalFee: parseFloat(rate),
      });

      const transaction = result.transaction;

      await messagesService.send({
        recipientId: request.seekerId,
        content: `I've sent you a quote for "${request.title}": £${rate}/day with a £${deposit} deposit. ${message}`,
      });

      return transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['request', request.id] });
      queryClient.invalidateQueries({ queryKey: ['allMessages'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      navigate(`/Chat?userId=${request.seekerId}&requestId=${request.id}`);
    },
  });

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingPhoto(true);
    try {
      const result = await uploadService.uploadFile(file);
      setPhotos([...photos, result.data.fileUrl]);
    } catch (error) {
      console.error("Error uploading photo:", error);
    }
    setUploadingPhoto(false);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!rate || !deposit || !message || !currentUser) return;
    sendQuoteMutation.mutate();
  };

  const categoryIcons: Record<string, LucideIcon> = {
    tools: Wrench,
    expertise: GraduationCap,
    space: Warehouse
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
                  Budget: £{request.budget}
                  {request.rateType === 'HOURLY' && '/hr'}
                  {request.rateType === 'DAILY' && '/day'}
                </Badge>
                {request.locationAddress && (
                  <Badge variant="outline">
                    {formatPostcode(request.locationAddress)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Pricing */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="rate">Your Rate (£) *</Label>
              <Input
                id="rate"
                type="number"
                min="1"
                step="0.01"
                placeholder="Enter your rate"
                value={rate}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || (/^\d+(\.\d{0,2})?$/.test(value) && parseFloat(value) >= 0)) {
                    setRate(value);
                  }
                }}
                className="mt-2"
                required
              />
            </div>

            <div>
              <Label htmlFor="deposit">Security Deposit (£) *</Label>
              <Input
                id="deposit"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={deposit}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || (/^\d+(\.\d{0,2})?$/.test(value) && parseFloat(value) >= 0)) {
                    setDeposit(value);
                  }
                }}
                className="mt-2"
                required
              />
            </div>
          </div>

          {/* Message */}
          <div>
            <Label htmlFor="message">Your Message *</Label>
            <Textarea
              id="message"
              placeholder="Introduce yourself and explain what you can offer..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-2 h-32"
              required
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
                disabled={uploadingPhoto}
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
                      onClick={() => setPhotos(photos.filter((_, i) => i !== index))}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
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
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={sendQuoteMutation.isPending || !rate || !deposit || !message || !currentUser}
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
