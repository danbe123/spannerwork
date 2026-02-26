import { useState, useRef, FormEvent, ChangeEvent } from "react";
import { usersService, uploadService, addressService, AddressResult } from "@/api/services";
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
import { Loader2, MapPin, Camera, X, Search, Building2, Info } from "lucide-react";
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
  postcode: string;
  street: string;
  city: string;
  county: string;
  country: string;
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
  postcode?: string;
  street?: string;
  city?: string;
  county?: string;
  country?: string;
  locationAddress?: string;
  locationLat?: number;
  locationLng?: number;
  avatar?: string;
}

export default function EditProfileDialog({ user, wizardMode = false, onClose }: EditProfileDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extendedUser = user as User & { street?: string; city?: string; county?: string; country?: string; defaultPayoutSpeed?: 'STANDARD' | 'INSTANT' };
  const [formData, setFormData] = useState<FormData>({
    name: user?.name || "",
    username: user?.email?.split('@')[0] || "",
    bio: user?.bio || "",
    postcode: user?.postcode || "",
    street: extendedUser?.street || "",
    city: extendedUser?.city || "",
    county: extendedUser?.county || "",
    country: extendedUser?.country || "GB",
    locationAddress: user?.locationAddress || "",
    locationLat: user?.locationLat || null,
    locationLng: user?.locationLng || null,
    avatar: user?.avatar || "",
    defaultPayoutSpeed: extendedUser?.defaultPayoutSpeed || 'STANDARD',
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState("");

  // Address lookup state
  const [addressOptions, setAddressOptions] = useState<AddressResult[]>([]);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const [lookingUpAddress, setLookingUpAddress] = useState(false);

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
          if (import.meta.env.DEV) {
            console.error("Error getting address:", error);
          }
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
        if (import.meta.env.DEV) {
          console.error("Geolocation error:", error);
        }
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
      if (import.meta.env.DEV) {
        console.error('Upload error:', error);
      }
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

  // Lookup addresses for a postcode using GetAddress.io
  const handlePostcodeLookup = async () => {
    const postcode = formData.postcode.trim();
    if (!postcode || postcode.length < 5) {
      setLocationError("Please enter a valid UK postcode");
      return;
    }

    setLookingUpAddress(true);
    setLocationError(null);
    setAddressOptions([]);

    try {
      const addresses = await addressService.lookupPostcode(postcode);
      if (addresses.length > 0) {
        setAddressOptions(addresses);
        setShowAddressDropdown(true);
      } else {
        setLocationError("No addresses found for this postcode. Please check and try again.");
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Address lookup error:", error);
      }
      setLocationError("Failed to look up address. Please try again.");
    } finally {
      setLookingUpAddress(false);
    }
  };

  // Handle address selection from dropdown
  const handleAddressSelect = (address: AddressResult) => {
    setFormData({
      ...formData,
      street: address.line1 + (address.line2 ? `, ${address.line2}` : ''),
      city: address.city,
      county: address.county,
      postcode: address.postcode,
      country: address.country || 'GB',
      locationAddress: `${address.city}, UK`,
    });
    setShowAddressDropdown(false);
    setAddressOptions([]);

    // Geocode the postcode to get coordinates
    handleGeocodePostcode(address.postcode);
  };

  // Geocode postcode to get lat/lng
  const handleGeocodePostcode = async (postcode: string) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(postcode)},UK&limit=1`
      );
      const data = await response.json();
      if (data && data.length > 0) {
        setFormData(prev => ({
          ...prev,
          locationLat: parseFloat(data[0].lat),
          locationLng: parseFloat(data[0].lon),
        }));
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Geocoding error:", error);
      }
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUpdateError("");

    if (wizardMode) {
      const missingName = !formData.name?.trim();
      const missingAddress = !formData.postcode?.trim() || !formData.street?.trim();

      if (missingName) {
        setUpdateError('Please enter your name to continue.');
        return;
      }
      if (missingAddress) {
        setUpdateError('Please enter your postcode and select your address to continue.');
        return;
      }
    }

    const dataToSubmit: UpdateData = {};

    if (formData.name) dataToSubmit.name = formData.name;
    if (formData.bio) dataToSubmit.bio = formData.bio;
    if (formData.postcode) dataToSubmit.postcode = formData.postcode;
    if (formData.street) dataToSubmit.street = formData.street;
    if (formData.city) dataToSubmit.city = formData.city;
    if (formData.county) dataToSubmit.county = formData.county;
    if (formData.country) dataToSubmit.country = formData.country;
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

          {/* Address Section */}
          <div className="space-y-3">
            <Label htmlFor="postcode">Your Address</Label>

            {/* Postcode Input with Find Address */}
            <div className="flex gap-2">
              <Input
                id="postcode"
                value={formData.postcode}
                onChange={(e) => {
                  setFormData({ ...formData, postcode: e.target.value.toUpperCase() });
                  setShowAddressDropdown(false);
                }}
                placeholder="Enter postcode (e.g., SW1A 1AA)"
                className={`flex-1 ${wizardMode && !formData.postcode?.trim() && !formData.street?.trim() ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                maxLength={10}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handlePostcodeLookup}
                disabled={lookingUpAddress || !formData.postcode?.trim()}
                className="shrink-0"
              >
                {lookingUpAddress ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Find Address
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleGetLocation}
                disabled={gettingLocation}
                title="Use my current location"
                className="shrink-0"
              >
                {gettingLocation ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Address Dropdown */}
            {showAddressDropdown && addressOptions.length > 0 && (
              <div className="relative">
                <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  <div className="p-2 border-b border-gray-100 bg-gray-50">
                    <p className="text-xs text-gray-600 flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {addressOptions.length} addresses found
                    </p>
                  </div>
                  {addressOptions.map((address, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleAddressSelect(address)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-brand-50 border-b border-gray-50 last:border-0 transition-colors"
                    >
                      <span className="font-medium text-gray-900">{address.line1}</span>
                      {address.line2 && <span className="text-gray-500">, {address.line2}</span>}
                      <span className="text-gray-500 block text-xs">{address.city}, {address.county}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Address Fields */}
            {formData.street && (
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <Label htmlFor="street" className="text-xs text-gray-500">Street Address</Label>
                  <Input
                    id="street"
                    value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    placeholder="Street address"
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="city" className="text-xs text-gray-500">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="City"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="county" className="text-xs text-gray-500">County</Label>
                    <Input
                      id="county"
                      value={formData.county}
                      onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                      placeholder="County"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Privacy notice */}
            <div className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Only your postcode area (e.g., "SW1A area") is shown publicly. Your full address is only shared when you choose to share it in messages.
              </p>
            </div>

            {wizardMode && !formData.postcode?.trim() && !formData.street?.trim() && (
              <p className="text-xs text-red-600">
                Required - enter your postcode and select your address
              </p>
            )}
            {formData.locationLat && formData.locationLng && formData.street && (
              <p className="text-xs text-green-600">
                ✓ Address verified
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
