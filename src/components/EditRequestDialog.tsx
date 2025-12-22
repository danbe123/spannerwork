import { useState, ChangeEvent, FormEvent, KeyboardEvent } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Upload, X, AlertCircle, MapPin } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Request, Category, Urgency, RateType } from "@/types";
import { queryKeys } from "@/lib/queryKeys";

interface EditRequestDialogProps {
  request: Request;
  onClose: () => void;
}

interface FormData {
  title: string;
  description: string;
  category: string;
  urgency: string;
  duration_needed: string;
  budget: number | string;
  rate_type: string;
  broadcast_radius: number;
}

export default function EditRequestDialog({ request, onClose }: EditRequestDialogProps) {
  const queryClient = useQueryClient();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [locationAddress, setLocationAddress] = useState(request.locationAddress || "");
  const [locationLat, setLocationLat] = useState<number | null>(request.locationLat || null);
  const [locationLng, setLocationLng] = useState<number | null>(request.locationLng || null);
  const [geocoding, setGeocoding] = useState(false);
  const [nationwideSearch, setNationwideSearch] = useState((request.broadcastRadius || 0) >= 999);

  const [formData, setFormData] = useState<FormData>({
    title: request.title,
    description: request.description,
    category: request.category,
    urgency: request.urgency || 'flexible',
    duration_needed: (request as Request & { durationNeeded?: string }).durationNeeded || "",
    budget: request.budget / 100,
    rate_type: request.rateType || 'hourly',
    broadcast_radius: (request.broadcastRadius || 0) >= 999 ? 10 : request.broadcastRadius || 5,
  });

  const [photos, setPhotos] = useState<string[]>(request.photos || []);

  const handleGeocodeAddress = async () => {
    if (!locationAddress.trim()) return;
    
    setGeocoding(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationAddress)}`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        setLocationLat(parseFloat(data[0].lat));
        setLocationLng(parseFloat(data[0].lon));
      }
    } catch (error) {
      console.error("Geocoding error:", error);
    }
    setGeocoding(false);
  };

  const updateRequestMutation = useMutation({
    mutationFn: (data: FormData) => {
      const finalRadius = nationwideSearch ? 999 : data.broadcast_radius;
      
      const budgetPence = Math.round(
        (typeof data.budget === 'string' ? parseFloat(data.budget) : data.budget) * 100
      );

      return requestsService.update(request.id, {
        title: data.title,
        description: data.description,
        category: data.category as Category,
        urgency: data.urgency as Urgency,
        // @ts-expect-error - durationNeeded may not be in type
        durationNeeded: data.duration_needed,
        budget: Number.isFinite(budgetPence) ? budgetPence : 0,
        rateType: data.rate_type as RateType,
        broadcastRadius: finalRadius,
        photos: photos,
        locationAddress: locationAddress,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.request(request.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.requests() });
      onClose();
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
    if (!formData.title || !formData.description || !formData.budget || Number(formData.budget) <= 0) return;
    updateRequestMutation.mutate(formData);
  };

  const handleLocationKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGeocodeAddress();
    }
  };

  const isFormValid = formData.title.trim() && formData.description.trim() && Number(formData.budget) > 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Your Request</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <Label htmlFor="title">Job Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Need table saw for weekend project"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-2"
              required
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe what you need in detail..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-2 h-32"
              required
              maxLength={1000}
            />
          </div>

          {/* Category */}
          <div>
            <Label htmlFor="category">Category *</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tools">Tools</SelectItem>
                <SelectItem value="expertise">Expertise</SelectItem>
                <SelectItem value="space">Space</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Urgency and Duration */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="urgency">Urgency</Label>
              <Select value={formData.urgency} onValueChange={(value) => setFormData({ ...formData, urgency: value })}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asap">ASAP</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this_weekend">This Weekend</SelectItem>
                  <SelectItem value="flexible">Flexible</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="duration">How Long Do You Need It?</Label>
              <Select 
                value={formData.duration_needed} 
                onValueChange={(value) => setFormData({ ...formData, duration_needed: value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-2 hours">1-2 hours</SelectItem>
                  <SelectItem value="Half day (3-4 hours)">Half day (3-4 hours)</SelectItem>
                  <SelectItem value="Full day (8 hours)">Full day (8 hours)</SelectItem>
                  <SelectItem value="Weekend">Weekend</SelectItem>
                  <SelectItem value="2-3 days">2-3 days</SelectItem>
                  <SelectItem value="1 week">1 week</SelectItem>
                  <SelectItem value="2 weeks">2 weeks</SelectItem>
                  <SelectItem value="1 month">1 month</SelectItem>
                  <SelectItem value="Ongoing/Long-term">Ongoing/Long-term</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Budget */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="rate_type">Rate Type</Label>
              <Select value={formData.rate_type} onValueChange={(value) => setFormData({ ...formData, rate_type: value })}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly Rate</SelectItem>
                  <SelectItem value="daily">Daily Rate</SelectItem>
                  <SelectItem value="fixed">Fixed Price</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="budget">
                Your Budget *
                <span className="text-sm text-gray-600 ml-2 font-normal">
                  ({formData.rate_type === 'hourly' ? '£/hour' : formData.rate_type === 'daily' ? '£/day' : 'total'})
                </span>
              </Label>
              <div className="relative mt-2">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">£</span>
                <Input
                  id="budget"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Enter amount"
                  value={formData.budget}
                  onChange={(e) => {
                    const value = e.target.value;
                    const numValue = value ? parseFloat(value) : '';
                    if (value === '' || Number(numValue) > 0) {
                      setFormData({ ...formData, budget: numValue });
                    }
                  }}
                  className="pl-8"
                  required
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <Label htmlFor="location">Location</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="location"
                placeholder="Enter address or postcode"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                onKeyDown={handleLocationKeyDown}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleGeocodeAddress}
                disabled={geocoding || !locationAddress.trim()}
                variant="outline"
              >
                {geocoding ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Finding...
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4 mr-2" />
                    Find
                  </>
                )}
              </Button>
            </div>
            {locationLat && locationLng && (
              <div className="mt-3 border rounded-lg overflow-hidden">
                <iframe
                  width="100%"
                  height="200"
                  frameBorder="0"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${locationLng-0.01},${locationLat-0.01},${locationLng+0.01},${locationLat+0.01}&layer=mapnik&marker=${locationLat},${locationLng}`}
                  style={{ border: 0 }}
                  title="Location map"
                />
              </div>
            )}
          </div>

          {/* Broadcast Radius */}
          <div className="space-y-3 p-4 bg-purple-50 rounded-xl border border-purple-200">
            <Label htmlFor="radius" className="text-base font-semibold">
              Search Radius: {nationwideSearch ? 'Nationwide' : `${formData.broadcast_radius} miles`}
            </Label>
            {!nationwideSearch && (
              <>
                <input
                  id="radius"
                  type="range"
                  min="1"
                  max="150"
                  step="5"
                  value={formData.broadcast_radius}
                  onChange={(e) => setFormData({ ...formData, broadcast_radius: parseInt(e.target.value) })}
                  className="w-full mt-2"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>1 mile</span>
                  <span>150 miles</span>
                </div>
              </>
            )}
            <div className="flex items-center gap-2 pt-2">
              <Checkbox
                id="nationwide-search"
                checked={nationwideSearch}
                onCheckedChange={(checked) => setNationwideSearch(checked as boolean)}
              />
              <Label htmlFor="nationwide-search" className="text-sm text-gray-700 cursor-pointer font-normal">
                Search nationwide (ignore distance)
              </Label>
            </div>
            {!nationwideSearch && (
              <p className="text-xs text-gray-600 pt-1">
                {formData.broadcast_radius <= 5 && "Very close - walking distance"}
                {formData.broadcast_radius > 5 && formData.broadcast_radius <= 15 && "Short drive"}
                {formData.broadcast_radius > 15 && formData.broadcast_radius <= 50 && "Reasonable distance"}
                {formData.broadcast_radius > 50 && formData.broadcast_radius <= 100 && "Regional search"}
                {formData.broadcast_radius > 100 && "Wide area search"}
              </p>
            )}
          </div>

          {/* Photos */}
          <div>
            <Label>Photos</Label>
            <p className="text-sm text-gray-500 mb-2">Add photos of your project or the parts you&apos;re working on</p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('photo-upload-edit')?.click()}
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
                id="photo-upload-edit"
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

          {/* Submit */}
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

          {!isFormValid && (
            <Alert className="border-red-300 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 font-medium">
                Please fill in all required fields: Title, Description, and a valid Budget (greater than £0)
              </AlertDescription>
            </Alert>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
