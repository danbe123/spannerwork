import { useState, ChangeEvent, FormEvent } from "react";
import { spacesService, uploadService } from "@/api/services";
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
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload, X, AlertCircle, ImagePlus, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Space } from "@/types";
import { queryKeys } from "@/lib/queryKeys";
import { AVAILABLE_FEATURES } from "@/components/offer/constants";
import { AIImproveButton, AIImprovementPreview, type ImprovedContent } from "@/components/ai";

interface EditSpaceDialogProps {
  space: Space;
  onClose: () => void;
}

export default function EditSpaceDialog({ space, onClose }: EditSpaceDialogProps) {
  const queryClient = useQueryClient();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(space.name);
  const [description, setDescription] = useState(space.description);
  const [hourlyRate, setHourlyRate] = useState(space.hourlyRate / 100);
  const [dailyRate, setDailyRate] = useState(space.dailyRate / 100);
  const [weeklyRate, setWeeklyRate] = useState(space.weeklyRate ? space.weeklyRate / 100 : 0);
  const [deposit, setDeposit] = useState(space.deposit ? space.deposit / 100 : 0);
  const [sizeSqft, setSizeSqft] = useState(space.sizeSqft || 0);
  const [vehicleCapacity, setVehicleCapacity] = useState(space.vehicleCapacity || 1);
  const [maxVehicleHeight, setMaxVehicleHeight] = useState(space.maxVehicleHeight || 0);
  const [electricityAvailable, setElectricityAvailable] = useState(space.electricityAvailable || false);
  const [toolsAvailable, setToolsAvailable] = useState(space.toolsAvailable || false);
  const [features, setFeatures] = useState<string[]>(space.features || []);
  const [photos, setPhotos] = useState<string[]>(space.photos || []);

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

  const toggleFeature = (feature: string) => {
    setFeatures(prev =>
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  };

  const updateSpaceMutation = useMutation({
    mutationFn: () => {
      const hourlyRatePence = Math.round(hourlyRate * 100);
      const dailyRatePence = Math.round(dailyRate * 100);
      const weeklyRatePence = weeklyRate ? Math.round(weeklyRate * 100) : undefined;
      const depositPence = deposit ? Math.round(deposit * 100) : undefined;

      return spacesService.update(space.id, {
        name: name.trim(),
        description: description.trim(),
        hourlyRate: Number.isFinite(hourlyRatePence) ? hourlyRatePence : undefined,
        dailyRate: Number.isFinite(dailyRatePence) ? dailyRatePence : 0,
        weeklyRate: weeklyRatePence,
        deposit: depositPence,
        sizeSqft: sizeSqft || undefined,
        vehicleCapacity: vehicleCapacity || undefined,
        maxVehicleHeight: maxVehicleHeight || undefined,
        electricityAvailable,
        toolsAvailable,
        features,
        photos,
        postcode: space.postcode, // Keep existing postcode
        locationAddress: space.locationAddress, // Keep existing address
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.space(space.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.spaces() });
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
    if (!dailyRate || dailyRate <= 0) {
      setError('Please enter a valid daily rate');
      return;
    }

    updateSpaceMutation.mutate();
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const isFormValid = name.trim() && description.trim() && dailyRate > 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Edit Space</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <Label htmlFor="name" className="text-sm font-medium">Name</Label>
            <Input
              id="name"
              placeholder="What type of space is this?"
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
              placeholder="Describe your space in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5 min-h-[120px] resize-none"
              maxLength={1000}
            />
            <AIImproveButton
              title={name}
              description={description}
              category="SPACE"
              listingType="space"
              onImproved={handleAIImproved}
              className="mt-2"
            />
          </div>

          {/* Space Details */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="sizeSqft" className="text-sm font-medium">Size (sq ft)</Label>
              <Input
                id="sizeSqft"
                type="number"
                min="0"
                placeholder="500"
                value={sizeSqft || ''}
                onChange={(e) => setSizeSqft(e.target.value ? parseInt(e.target.value) : 0)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="vehicleCapacity" className="text-sm font-medium">Vehicle Capacity</Label>
              <Input
                id="vehicleCapacity"
                type="number"
                min="1"
                placeholder="1"
                value={vehicleCapacity || ''}
                onChange={(e) => setVehicleCapacity(e.target.value ? parseInt(e.target.value) : 1)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="maxVehicleHeight" className="text-sm font-medium">Max Height (m)</Label>
              <Input
                id="maxVehicleHeight"
                type="number"
                min="0"
                step="0.1"
                placeholder="2.5"
                value={maxVehicleHeight || ''}
                onChange={(e) => setMaxVehicleHeight(e.target.value ? parseFloat(e.target.value) : 0)}
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label htmlFor="hourlyRate" className="text-sm font-medium">Hourly</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                <Input
                  id="hourlyRate"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="10"
                  value={hourlyRate || ''}
                  onChange={(e) => setHourlyRate(e.target.value ? parseFloat(e.target.value) : 0)}
                  className="pl-7"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="dailyRate" className="text-sm font-medium">Daily</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                <Input
                  id="dailyRate"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="50"
                  value={dailyRate || ''}
                  onChange={(e) => setDailyRate(e.target.value ? parseFloat(e.target.value) : 0)}
                  className="pl-7"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="weeklyRate" className="text-sm font-medium">Weekly</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                <Input
                  id="weeklyRate"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="200"
                  value={weeklyRate || ''}
                  onChange={(e) => setWeeklyRate(e.target.value ? parseFloat(e.target.value) : 0)}
                  className="pl-7"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="deposit" className="text-sm font-medium">Deposit</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                <Input
                  id="deposit"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="100"
                  value={deposit || ''}
                  onChange={(e) => setDeposit(e.target.value ? parseFloat(e.target.value) : 0)}
                  className="pl-7"
                />
              </div>
            </div>
          </div>

          {/* Amenities */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Amenities</Label>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="electricity"
                  checked={electricityAvailable}
                  onCheckedChange={setElectricityAvailable}
                />
                <Label htmlFor="electricity" className="text-sm cursor-pointer">Electricity Available</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="tools"
                  checked={toolsAvailable}
                  onCheckedChange={setToolsAvailable}
                />
                <Label htmlFor="tools" className="text-sm cursor-pointer">Tools Available</Label>
              </div>
            </div>
          </div>

          {/* Features */}
          <div>
            <Label className="text-sm font-medium">Features</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {AVAILABLE_FEATURES.map((feature) => (
                <button
                  key={feature}
                  type="button"
                  onClick={() => toggleFeature(feature)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    features.includes(feature)
                      ? 'bg-brand-800 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {features.includes(feature) && <Check className="w-3 h-3 inline-block mr-1" />}
                  {feature}
                </button>
              ))}
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
                      onClick={() => document.getElementById('photo-upload-space')?.click()}
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
                  onClick={() => document.getElementById('photo-upload-space')?.click()}
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
                id="photo-upload-space"
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
              disabled={updateSpaceMutation.isPending || !isFormValid}
              className="flex-1 bg-brand-800 hover:bg-brand-900"
            >
              {updateSpaceMutation.isPending ? (
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
