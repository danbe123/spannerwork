import { useState, ChangeEvent, FormEvent } from "react";
import { requestsService, uploadService } from "@/api/services";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnimatedInput } from "@/components/ui/animated-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Loader2, Upload, X, AlertCircle, ImagePlus, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Request, Urgency, RateType } from "@/types";
import { queryKeys } from "@/lib/queryKeys";
import { AIImproveButton, AIImprovementPreview, type ImprovedContent } from "@/components/ai";

interface EditRequestDialogProps {
  request: Request;
  onClose: () => void;
}

export default function EditRequestDialog({ request, onClose }: EditRequestDialogProps) {
  const queryClient = useQueryClient();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(request.title);
  const [description, setDescription] = useState(request.description);
  const [urgency, setUrgency] = useState(request.urgency || 'FLEXIBLE');
  const [budget, setBudget] = useState(request.budget / 100);
  const [rateType, setRateType] = useState(request.rateType || 'HOURLY');
  const [photos, setPhotos] = useState<string[]>(request.photos || []);

  // Sponsor state - initialize from existing request
  const [sponsorEnabled, setSponsorEnabled] = useState((request.sponsorCpaPercent || 0) > 0);
  const [sponsorCpaPercent, setSponsorCpaPercent] = useState(request.sponsorCpaPercent || 10);

  // AI improvement state
  const [showAIPreview, setShowAIPreview] = useState(false);
  const [aiImproved, setAiImproved] = useState<ImprovedContent | null>(null);

  const handleAIImproved = (improved: ImprovedContent) => {
    setAiImproved(improved);
    setShowAIPreview(true);
  };

  const handleAcceptAIImprovements = (accepted: { title?: string; description?: string }) => {
    if (accepted.title) setTitle(accepted.title);
    if (accepted.description) setDescription(accepted.description);
  };

  const updateRequestMutation = useMutation({
    mutationFn: () => {
      const budgetPence = Math.round(budget * 100);

      return requestsService.update(request.id, {
        title: title.trim(),
        description: description.trim(),
        urgency: urgency as Urgency,
        budget: Number.isFinite(budgetPence) ? budgetPence : 0,
        rateType: rateType as RateType,
        photos: photos,
        sponsorCpaPercent: sponsorEnabled ? sponsorCpaPercent : 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.request(request.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.requests() });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to save changes. Please try again.');
    },
  });

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    setError(null);
    try {
      const result = await uploadService.uploadFile(file);
      setPhotos([...photos, result.data.fileUrl]);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Error uploading photo:", err);
      }
      setError('Failed to upload photo. Please try again.');
    }
    setUploadingPhoto(false);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }
    if (!description.trim()) {
      setError('Please enter a description');
      return;
    }
    if (!budget || budget <= 0) {
      setError('Please enter a valid budget');
      return;
    }

    updateRequestMutation.mutate();
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const isFormValid = title.trim() && description.trim() && budget > 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Edit Job</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <Label htmlFor="title" className="text-sm font-medium">Title</Label>
            <Input
              id="title"
              placeholder="What do you need?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5"
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-sm font-medium">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what you need in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5 min-h-[120px] resize-none"
              maxLength={1000}
            />
            <AIImproveButton
              title={title}
              description={description}
              category={request.category}
              listingType="request"
              onImproved={handleAIImproved}
              className="mt-2"
            />
          </div>

          {/* Urgency */}
          <div>
            <Label className="text-sm font-medium">Urgency</Label>
            <Select value={urgency} onValueChange={(value) => setUrgency(value as Urgency)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ASAP">ASAP</SelectItem>
                <SelectItem value="TODAY">Today</SelectItem>
                <SelectItem value="THIS_WEEKEND">This Weekend</SelectItem>
                <SelectItem value="FLEXIBLE">Flexible</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Budget */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Rate Type</Label>
              <Select value={rateType} onValueChange={(value) => setRateType(value as RateType)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOURLY">Per Hour</SelectItem>
                  <SelectItem value="DAILY">Per Day</SelectItem>
                  <SelectItem value="FIXED">Fixed Price</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="budget" className="text-sm font-medium">Budget</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                <AnimatedInput
                  id="budget"
                  type="number"
                  min="1"
                  step="1"
                  placeholders={["50", "75", "100", "150", "200"]}
                  value={budget || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBudget(val ? parseFloat(val) : 0);
                  }}
                  className="pl-7"
                />
              </div>
            </div>
          </div>

          {/* Photos */}
          <div>
            <Label className="text-sm font-medium">Photos</Label>
            <div className="mt-2">
              {photos.length > 0 ? (
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {photos.map((photo, index) => (
                    <div key={index} className="relative aspect-square">
                      <img
                        src={photo}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {photos.length < 6 && (
                    <button
                      type="button"
                      onClick={() => document.getElementById('photo-upload-edit')?.click()}
                      disabled={uploadingPhoto}
                      className="aspect-square border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center hover:border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      {uploadingPhoto ? (
                        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                      ) : (
                        <ImagePlus className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => document.getElementById('photo-upload-edit')?.click()}
                  disabled={uploadingPhoto}
                  className="w-full py-8 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-500">Add photos</span>
                    </>
                  )}
                </button>
              )}
              <input
                id="photo-upload-edit"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Sponsor Section */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  <Label className="text-sm font-medium">Boost Your Listing</Label>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">Get more visibility and appear higher in search results</p>
              </div>
              <Switch
                checked={sponsorEnabled}
                onCheckedChange={setSponsorEnabled}
              />
            </div>

            {sponsorEnabled && (
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-yellow-800">CPA Rate:</Label>
                  <span className="font-semibold text-yellow-900">
                    {sponsorCpaPercent}%
                  </span>
                </div>
                <Slider
                  value={[sponsorCpaPercent]}
                  onValueChange={([value]) => setSponsorCpaPercent(value)}
                  min={5}
                  max={50}
                  step={5}
                  className="w-full"
                />
                <p className="text-xs text-yellow-700">
                  You&apos;ll pay {sponsorCpaPercent}% of the agreed price only when a transaction completes. Higher rates = more visibility.
                </p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
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
              disabled={updateRequestMutation.isPending || !isFormValid}
              className="flex-1 bg-brand-800 hover:bg-brand-900"
            >
              {updateRequestMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>

        {/* AI Improvement Preview Modal */}
        <AIImprovementPreview
          isOpen={showAIPreview}
          onClose={() => setShowAIPreview(false)}
          original={{ title, description }}
          improved={aiImproved}
          onAccept={handleAcceptAIImprovements}
        />
      </DialogContent>
    </Dialog>
  );
}
