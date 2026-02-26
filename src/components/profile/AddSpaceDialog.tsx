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
import { AnimatedInput } from "@/components/ui/animated-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import { Loader2, Upload, X } from "lucide-react";
import { User } from "@/types";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";

const AVAILABLE_FEATURES = [
  "Vehicle Ramp",
  "Inspection Pit",
  "Vehicle Lift",
  "Air Compressor",
  "Tire Changer",
  "Wheel Balancer",
  "Diagnostic Equipment",
  "Welding Station",
  "Parts Washer",
  "Tool Storage",
  "Climate Controlled",
  "24/7 Access",
  "Security System",
  "Lighting",
  "Water Access",
  "Ventilation/Exhaust Fans",
  "Toilets",
  "Basic Tools",
  "Fire Extinguisher",
  "First Aid Kit",
  "3 Phase Electric"
];

interface AddSpaceDialogProps {
  onClose: () => void;
  currentUser: User;
}

interface SpaceFormData {
  name: string;
  space_type: string;
  description: string;
  size_sqft: number;
  max_vehicle_height: number;
  vehicle_capacity: number;
  hourly_rate: number;
  daily_rate: number;
  weekly_rate: number;
  monthly_rate: number;
  deposit_amount: number;
  electricity_available: boolean;
  tools_available: boolean;
  supervision_required: boolean;
  insurance_required: boolean;
}

export default function AddSpaceDialog({ onClose, currentUser }: AddSpaceDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<SpaceFormData>({
    name: "",
    space_type: "garage",
    description: "",
    size_sqft: 0,
    max_vehicle_height: 0,
    vehicle_capacity: 1,
    hourly_rate: 0,
    daily_rate: 0,
    weekly_rate: 0,
    monthly_rate: 0,
    deposit_amount: 0,
    electricity_available: true,
    tools_available: false,
    supervision_required: false,
    insurance_required: false,
  });

  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [sponsorEnabled, setSponsorEnabled] = useState(false);
  const [sponsorCpaPercent, setSponsorCpaPercent] = useState(5); // 5% minimum

  const createSpaceMutation = useMutation({
    mutationFn: (data: SpaceFormData) => spacesService.create({
      name: data.name,
      description: data.description,
      spaceType: data.space_type,
      hourlyRate: data.hourly_rate,
      dailyRate: data.daily_rate,
      weeklyRate: data.weekly_rate || undefined,
      sizeSqft: data.size_sqft || undefined,
      vehicleCapacity: data.vehicle_capacity || undefined,
      maxVehicleHeight: data.max_vehicle_height || undefined,
      electricityAvailable: data.electricity_available,
      toolsAvailable: data.tools_available,
      deposit: data.deposit_amount || undefined,
      features: selectedFeatures,
      photos: photos,
      postcode: currentUser.postcode || '',
      locationAddress: currentUser.locationAddress || '',
      sponsorCpaPercent: sponsorEnabled ? sponsorCpaPercent : 0,
    }),
    onSuccess: () => {
      // Invalidate both the user's listings and general spaces queries
      queryClient.invalidateQueries({ queryKey: queryKeys.myListingsByUser(currentUser.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.mySpaces() });
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      toast.success('Space listed successfully!');
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create space listing');
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
      if (import.meta.env.DEV) {
        console.error("Error uploading photo:", error);
      }
    }
    setUploadingPhoto(false);
  };

  const toggleFeature = (feature: string) => {
    if (selectedFeatures.includes(feature)) {
      setSelectedFeatures(selectedFeatures.filter(f => f !== feature));
    } else {
      setSelectedFeatures([...selectedFeatures, feature]);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    createSpaceMutation.mutate(formData);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>List Your Space for Rent</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Space Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Double Garage with 2-Post Lift, Home Workshop with Air Tools"
                required
                maxLength={100}
              />
            </div>

            <div>
              <Label htmlFor="space_type">Space Type *</Label>
              <Select value={formData.space_type} onValueChange={(value) => setFormData({ ...formData, space_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="garage">Garage</SelectItem>
                  <SelectItem value="workshop">Workshop</SelectItem>
                  <SelectItem value="driveway">Driveway</SelectItem>
                  <SelectItem value="storage_unit">Storage Unit</SelectItem>
                  <SelectItem value="parking_spot">Parking Spot</SelectItem>
                  <SelectItem value="industrial_space">Industrial Space</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the space layout, equipment included, access hours, and any restrictions (e.g., no painting, quiet hours). Mention what makes your space stand out..."
                className="h-24"
                required
                maxLength={1000}
              />
            </div>
          </div>

          {/* Photos */}
          <div>
            <Label>Photos</Label>
            <div className="flex gap-3 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('space-photo-upload')?.click()}
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
                id="space-photo-upload"
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
                      className="w-24 h-24 object-cover rounded-lg border"
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

          {/* Space Details */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
            <h3 className="font-semibold">Space Details</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="size">Size (sq ft)</Label>
                <Input
                  id="size"
                  type="number"
                  min="0"
                  value={formData.size_sqft}
                  onChange={(e) => setFormData({ ...formData, size_sqft: Math.max(0, parseFloat(e.target.value) || 0) })}
                  placeholder="e.g., 400"
                />
              </div>

              <div>
                <Label htmlFor="height">Max Vehicle Height (ft)</Label>
                <Input
                  id="height"
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.max_vehicle_height}
                  onChange={(e) => setFormData({ ...formData, max_vehicle_height: Math.max(0, parseFloat(e.target.value) || 0) })}
                  placeholder="e.g., 7"
                />
              </div>

              <div>
                <Label htmlFor="capacity">Vehicle Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  value={formData.vehicle_capacity}
                  onChange={(e) => setFormData({ ...formData, vehicle_capacity: Math.max(1, parseInt(e.target.value) || 1) })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Electricity Available</Label>
                <Switch
                  checked={formData.electricity_available}
                  onCheckedChange={(checked) => setFormData({ ...formData, electricity_available: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Basic Tools Provided</Label>
                <Switch
                  checked={formData.tools_available}
                  onCheckedChange={(checked) => setFormData({ ...formData, tools_available: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Supervision Required</Label>
                <Switch
                  checked={formData.supervision_required}
                  onCheckedChange={(checked) => setFormData({ ...formData, supervision_required: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Insurance Required</Label>
                <Switch
                  checked={formData.insurance_required}
                  onCheckedChange={(checked) => setFormData({ ...formData, insurance_required: checked })}
                />
              </div>
            </div>
          </div>

          {/* Features */}
          <div>
            <Label>Features & Amenities</Label>
            <p className="text-sm text-gray-500 mb-3">Highlight everything your space offers - more features means more bookings</p>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_FEATURES.map((feature) => (
                <Badge
                  key={feature}
                  variant={selectedFeatures.includes(feature) ? "default" : "outline"}
                  className={`cursor-pointer ${
                    selectedFeatures.includes(feature)
                      ? 'bg-brand-800 hover:bg-brand-900'
                      : 'hover:bg-gray-100'
                  }`}
                  onClick={() => toggleFeature(feature)}
                >
                  {feature}
                </Badge>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <h3 className="font-semibold text-green-800">Set Your Rates *</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hourly_rate">Hourly Rate (£)</Label>
                <AnimatedInput
                  id="hourly_rate"
                  type="number"
                  min="0"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: Math.max(0, parseFloat(e.target.value) || 0) })}
                  placeholders={["10", "15", "20", "12"]}
                />
              </div>

              <div>
                <Label htmlFor="daily_rate">Daily Rate (£) *</Label>
                <AnimatedInput
                  id="daily_rate"
                  type="number"
                  min="1"
                  value={formData.daily_rate}
                  onChange={(e) => setFormData({ ...formData, daily_rate: Math.max(1, parseFloat(e.target.value) || 0) })}
                  placeholders={["50", "80", "100", "65"]}
                  required
                />
              </div>

              <div>
                <Label htmlFor="weekly_rate">Weekly Rate (£)</Label>
                <AnimatedInput
                  id="weekly_rate"
                  type="number"
                  min="0"
                  value={formData.weekly_rate}
                  onChange={(e) => setFormData({ ...formData, weekly_rate: Math.max(0, parseFloat(e.target.value) || 0) })}
                  placeholders={["300", "450", "500", "350"]}
                />
              </div>

              <div>
                <Label htmlFor="monthly_rate">Monthly Rate (£)</Label>
                <AnimatedInput
                  id="monthly_rate"
                  type="number"
                  min="0"
                  value={formData.monthly_rate}
                  onChange={(e) => setFormData({ ...formData, monthly_rate: Math.max(0, parseFloat(e.target.value) || 0) })}
                  placeholders={["800", "1200", "1500", "1000"]}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="deposit">Security Deposit (£)</Label>
              <AnimatedInput
                id="deposit"
                type="number"
                min="0"
                value={formData.deposit_amount}
                onChange={(e) => setFormData({ ...formData, deposit_amount: Math.max(0, parseFloat(e.target.value) || 0) })}
                placeholders={["50", "100", "150", "75"]}
              />
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                Suggested rates based on market data: Basic garage £50-80/day, Equipped workshop £80-150/day, Industrial space with lifts £100-200/day
              </AlertDescription>
            </Alert>
          </div>

          {/* Sponsor Section */}
          <div className="space-y-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-yellow-800 font-semibold">Boost this listing</Label>
                <p className="text-sm text-yellow-700">Appear higher in search results and get more booking requests</p>
              </div>
              <Switch
                checked={sponsorEnabled}
                onCheckedChange={setSponsorEnabled}
              />
            </div>

            {sponsorEnabled && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-yellow-800">CPA Rate:</Label>
                  <span className="font-semibold text-yellow-900">{sponsorCpaPercent}%</span>
                </div>
                <Slider
                  value={[sponsorCpaPercent]}
                  onValueChange={([value]) => setSponsorCpaPercent(value)}
                  min={5}
                  max={50}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-yellow-700">
                  Pay {sponsorCpaPercent}% only when you receive a booking. Higher rates mean more visibility in search results.
                </p>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createSpaceMutation.isPending || !formData.daily_rate}
              className="flex-1 bg-brand-800 hover:bg-brand-900"
            >
              {createSpaceMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'List Space'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
