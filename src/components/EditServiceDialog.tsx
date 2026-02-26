import { useState, ChangeEvent, FormEvent } from "react";
import { servicesService, uploadService } from "@/api/services";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Loader2, Upload, X, AlertCircle, ImagePlus, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Service } from "@/types";
import { queryKeys } from "@/lib/queryKeys";
import { SERVICE_SPECIALTIES } from "@/components/offer/constants";
import { AIImproveButton, AIImprovementPreview, type ImprovedContent } from "@/components/ai";

interface EditServiceDialogProps {
  service: Service;
  onClose: () => void;
}

export default function EditServiceDialog({ service, onClose }: EditServiceDialogProps) {
  const queryClient = useQueryClient();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(service.name || service.title);
  const [description, setDescription] = useState(service.description);
  const [specialties, setSpecialties] = useState<string[]>(service.specialties || []);
  const [hourlyRate, setHourlyRate] = useState(service.hourlyRate / 100);
  const [calloutFee, setCalloutFee] = useState(service.calloutFee ? service.calloutFee / 100 : 0);
  const [radius, setRadius] = useState(service.radius || service.serviceRadius || 10);
  const [photos, setPhotos] = useState<string[]>(service.photos || []);

  // AI improvement state
  const [showAIPreview, setShowAIPreview] = useState(false);
  const [aiImproved, setAiImproved] = useState<ImprovedContent | null>(null);

  const handleAIImproved = (improved: ImprovedContent) => {
    setAiImproved(improved);
    setShowAIPreview(true);
  };

  const handleAcceptAIImprovements = (accepted: { title?: string; description?: string }) => {
    if (accepted.title) setName(accepted.title);
    if (accepted.description) setDescription(accepted.description);
  };

  const toggleSpecialty = (specialty: string) => {
    setSpecialties(prev =>
      prev.includes(specialty)
        ? prev.filter(s => s !== specialty)
        : [...prev, specialty]
    );
  };

  const updateServiceMutation = useMutation({
    mutationFn: () => {
      const hourlyRatePence = Math.round(hourlyRate * 100);
      const calloutFeePence = calloutFee ? Math.round(calloutFee * 100) : undefined;

      return servicesService.update(service.id, {
        name: name.trim(),
        description: description.trim(),
        specialties,
        hourlyRate: Number.isFinite(hourlyRatePence) ? hourlyRatePence : 0,
        calloutFee: calloutFeePence,
        radius: radius || 10,
        photos,
        postcode: service.postcode, // Keep existing postcode
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.service(service.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.services() });
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

    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }
    if (!description.trim()) {
      setError('Please enter a description');
      return;
    }
    if (!hourlyRate || hourlyRate <= 0) {
      setError('Please enter a valid hourly rate');
      return;
    }
    if (specialties.length === 0) {
      setError('Please select at least one specialty');
      return;
    }

    updateServiceMutation.mutate();
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const isFormValid = name.trim() && description.trim() && hourlyRate > 0 && specialties.length > 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Edit Service</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <Label htmlFor="name" className="text-sm font-medium">Service Name</Label>
            <Input
              id="name"
              placeholder="What service do you offer?"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-sm font-medium">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your service in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5 min-h-[120px] resize-none"
              maxLength={1000}
            />
            <AIImproveButton
              title={name}
              description={description}
              category="EXPERTISE"
              listingType="service"
              onImproved={handleAIImproved}
              className="mt-2"
            />
          </div>

          {/* Pricing & Radius */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="hourlyRate" className="text-sm font-medium">Hourly Rate</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                <Input
                  id="hourlyRate"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="40"
                  value={hourlyRate || ''}
                  onChange={(e) => setHourlyRate(e.target.value ? parseFloat(e.target.value) : 0)}
                  className="pl-7"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="calloutFee" className="text-sm font-medium">Callout Fee</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                <Input
                  id="calloutFee"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={calloutFee || ''}
                  onChange={(e) => setCalloutFee(e.target.value ? parseFloat(e.target.value) : 0)}
                  className="pl-7"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="radius" className="text-sm font-medium">Service Radius</Label>
              <div className="relative mt-1.5">
                <Input
                  id="radius"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="10"
                  value={radius || ''}
                  onChange={(e) => setRadius(e.target.value ? parseInt(e.target.value) : 10)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">miles</span>
              </div>
            </div>
          </div>

          {/* Specialties */}
          <div>
            <Label className="text-sm font-medium">Specialties</Label>
            <p className="text-xs text-gray-500 mt-0.5 mb-2">Select all that apply</p>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg bg-gray-50">
              {SERVICE_SPECIALTIES.map((specialty) => (
                <button
                  key={specialty}
                  type="button"
                  onClick={() => toggleSpecialty(specialty)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    specialties.includes(specialty)
                      ? 'bg-brand-800 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {specialties.includes(specialty) && <Check className="w-3 h-3 inline-block mr-1" />}
                  {specialty}
                </button>
              ))}
            </div>
            {specialties.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {specialties.length} specialt{specialties.length === 1 ? 'y' : 'ies'} selected
              </p>
            )}
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
                      onClick={() => document.getElementById('photo-upload-service')?.click()}
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
                  onClick={() => document.getElementById('photo-upload-service')?.click()}
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
                id="photo-upload-service"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
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
              disabled={updateServiceMutation.isPending || !isFormValid}
              className="flex-1 bg-brand-800 hover:bg-brand-900"
            >
              {updateServiceMutation.isPending ? (
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
          original={{ title: name, description }}
          improved={aiImproved}
          onAccept={handleAcceptAIImprovements}
        />
      </DialogContent>
    </Dialog>
  );
}
