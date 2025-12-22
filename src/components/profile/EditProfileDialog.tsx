import { useState, useRef, FormEvent, ChangeEvent } from "react";
import { usersService, uploadService } from "@/api/services";
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
import { Loader2, MapPin, Camera, X } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User } from "@/types";
import { queryKeys } from "@/lib/queryKeys";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EditProfileDialogProps {
  user: User;
  wizardMode?: boolean;
  onClose: () => void;
}

interface FormData {
  name: string;
  username: string;
  bio: string;
  locationAddress: string;
  locationLat: number | null;
  locationLng: number | null;
  avatar: string;
  defaultPayoutSpeed: 'STANDARD' | 'INSTANT';
}

interface UpdateData {
  name?: string;
  username?: string;
  defaultPayoutSpeed?: 'STANDARD' | 'INSTANT';
  bio?: string;
  locationAddress?: string;
  locationLat?: number;
  locationLng?: number;
  avatar?: string;
}

export default function EditProfileDialog({ user, wizardMode = false, onClose }: EditProfileDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<FormData>({
    name: user?.name || "",
    username: user?.email?.split('@')[0] || "",
    bio: user?.bio || "",
    locationAddress: user?.locationAddress || "",
    locationLat: user?.locationLat || null,
    locationLng: user?.locationLng || null,
    avatar: user?.avatar || "",
    defaultPayoutSpeed: (user as unknown as { defaultPayoutSpeed?: 'STANDARD' | 'INSTANT' })?.defaultPayoutSpeed || 'STANDARD',
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState("");

  const updateProfileMutation = useMutation({
    mutationFn: (data: UpdateData) => usersService.update(user.id, data),
    onSuccess: () => {
      setUpdateError("");
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
      onClose();
    },
    onError: (error: Error & { data?: { message?: string } }) => {
      const message =
        error?.data?.message ||
        error?.message ||
        'Unable to update your profile. Please try again.';
      setUpdateError(message);
    },
  });

  const handleGetLocation = () => {
    setGettingLocation(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          );
          const data = await response.json();
          const address = data.address;
          const cityState = `${address.city || address.town || address.village || ''}, ${address.state || address.county || ''}`.trim();

          setFormData({
            ...formData,
            locationAddress: cityState,
            locationLat: lat,
            locationLng: lng,
          });
        } catch (error) {
          console.error("Error getting address:", error);
          setFormData({
            ...formData,
            locationLat: lat,
            locationLng: lng,
          });
        }

        setGettingLocation(false);
      },
      (error) => {
        setLocationError("Unable to get your location. Please enable location services.");
        setGettingLocation(false);
        console.error("Geolocation error:", error);
      }
    );
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUpdateError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUpdateError('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setUploadingAvatar(true);
    setUpdateError('');

    try {
      const response = await uploadService.uploadFile(file);
      if (response.success) {
        setFormData(prev => ({ ...prev, avatar: response.data.fileUrl }));
      } else {
        setUpdateError('Failed to upload image');
        setAvatarPreview(user?.avatar || null);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUpdateError('Failed to upload image. Please try again.');
      setAvatarPreview(user?.avatar || null);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setFormData(prev => ({ ...prev, avatar: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGeocodeAddress = async () => {
    if (!formData.locationAddress) return;
    
    setGettingLocation(true);
    setLocationError(null);
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.locationAddress)}&limit=1`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        setFormData({
          ...formData,
          locationLat: parseFloat(data[0].lat),
          locationLng: parseFloat(data[0].lon),
        });
      } else {
        setLocationError("Location not found. Please try a different address.");
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      setLocationError("Failed to find location");
    }
    
    setGettingLocation(false);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUpdateError("");

    if (wizardMode) {
      const missingName = !formData.name?.trim();
      const missingLocation = !formData.locationAddress?.trim();

      if (missingName || missingLocation) {
        setUpdateError('Please complete the required fields before continuing.');
        return;
      }
    }
    
    const dataToSubmit: UpdateData = {};
    
    if (formData.name) dataToSubmit.name = formData.name;
    if (formData.bio) dataToSubmit.bio = formData.bio;
    if (formData.locationAddress) dataToSubmit.locationAddress = formData.locationAddress;
    if (formData.avatar) dataToSubmit.avatar = formData.avatar;
    dataToSubmit.defaultPayoutSpeed = formData.defaultPayoutSpeed;
    
    if (formData.locationLat && formData.locationLng) {
      dataToSubmit.locationLat = formData.locationLat;
      dataToSubmit.locationLng = formData.locationLng;
    }
    
    updateProfileMutation.mutate(dataToSubmit);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {updateError && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">{updateError}</AlertDescription>
            </Alert>
          )}

          {/* Avatar Upload */}
          <div className="flex justify-center">
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={uploadingAvatar}
                className="relative group"
              >
                <Avatar className="w-24 h-24 border-4 border-gray-100">
                  <AvatarImage src={avatarPreview || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-brand-800 to-[#FF6F00] text-white text-2xl font-bold">
                    {formData.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploadingAvatar ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 text-white" />
                  )}
                </div>
              </button>
              {avatarPreview && !uploadingAvatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <p className="text-center text-xs text-gray-500">Click to upload a profile photo</p>

          <div>
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Your name"
              maxLength={50}
              className={wizardMode && !formData.name?.trim() ? 'border-red-500 focus-visible:ring-red-500' : undefined}
            />
          </div>

          <div>
            <Label htmlFor="bio">Garage Bio</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Tell us about your projects, skills, and what you love to work on..."
              className="h-24"
              maxLength={500}
            />
          </div>

          <div>
            <Label htmlFor="location">Postcode</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="location"
                value={formData.locationAddress}
                onChange={(e) => setFormData({ ...formData, locationAddress: e.target.value.toUpperCase() })}
                onBlur={handleGeocodeAddress}
                placeholder="Enter your UK postcode (e.g., HR1 2LR)"
                className={`flex-1 ${wizardMode && !formData.locationAddress?.trim() ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                maxLength={100}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleGetLocation}
                disabled={gettingLocation}
                title="Use my current location"
              >
                {gettingLocation ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Enter your postcode to verify your location.
            </p>
            {wizardMode && !formData.locationAddress?.trim() && (
              <p className="text-xs text-red-600 mt-1">
                Required
              </p>
            )}
            {formData.locationLat && formData.locationLng && (
              <p className="text-xs text-green-600 mt-1">
                ✓ Postcode verified
              </p>
            )}
            {locationError && (
              <Alert variant="destructive" className="mt-2">
                <AlertDescription className="text-xs">{locationError}</AlertDescription>
              </Alert>
            )}
          </div>

          <div>
            <Label>Payout Speed</Label>
            <div className="mt-2">
              <Select
                value={formData.defaultPayoutSpeed}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    defaultPayoutSpeed: value as FormData['defaultPayoutSpeed'],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payout speed" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STANDARD">Standard (2-7 days) — Free</SelectItem>
                  <SelectItem value="INSTANT">Instant (minutes) — 1.5% fee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Instant payout applies to new bookings and may not be available for all accounts.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="flex-1 bg-brand-800 hover:bg-brand-900"
            >
              {updateProfileMutation.isPending ? (
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
      </DialogContent>
    </Dialog>
  );
}
