import { useState, ChangeEvent, FormEvent } from "react";
import { toolsService, uploadService } from "@/api/services";
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
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, X } from "lucide-react";
import { User } from "@/types";
import { queryKeys } from "@/lib/queryKeys";

interface AddToolDialogProps {
  onClose: () => void;
  currentUser: User;
}

interface ToolFormData {
  name: string;
  category: string;
  description: string;
  condition: string;
  lending_type: string;
  hourly_rate: number;
  daily_rate: number;
  weekly_rate: number;
  monthly_rate: number;
  deposit_amount: number;
  insurance_available: boolean;
  insurance_cost: number;
  tool_value: number;
  requires_supervision: boolean;
  can_teach: boolean;
  teaching_rate: number;
  allow_calendar_booking: boolean;
}

export default function AddToolDialog({ onClose, currentUser }: AddToolDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<ToolFormData>({
    name: "",
    category: "Power Tools",
    description: "",
    condition: "good",
    lending_type: "rental",
    hourly_rate: 0,
    daily_rate: 0,
    weekly_rate: 0,
    monthly_rate: 0,
    deposit_amount: 0,
    insurance_available: false,
    insurance_cost: 0,
    tool_value: 0,
    requires_supervision: false,
    can_teach: false,
    teaching_rate: 0,
    allow_calendar_booking: true,
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const createToolMutation = useMutation({
    // @ts-expect-error - API accepts additional fields
    mutationFn: (data: ToolFormData) => toolsService.create({
      name: data.name,
      category: data.category,
      description: data.description,
      condition: data.condition,
      dailyRate: data.daily_rate,
      weeklyRate: data.weekly_rate || undefined,
      deposit: data.deposit_amount,
      ownerId: currentUser.id,
      photos: photos,
      available: true,
      postcode: currentUser.postcode || '',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myTools() });
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
    createToolMutation.mutate(formData);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>List an Item for Rent</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Item Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Torque Wrench, Table Saw"
              required
              maxLength={100}
            />
          </div>

          <div>
            <Label htmlFor="category">Category *</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Hand Tools">Hand Tools</SelectItem>
                <SelectItem value="Power Tools">Power Tools</SelectItem>
                <SelectItem value="Automotive">Automotive</SelectItem>
                <SelectItem value="Lifting Equipment">Lifting Equipment</SelectItem>
                <SelectItem value="Diagnostic Tools">Diagnostic Tools</SelectItem>
                <SelectItem value="Welding">Welding</SelectItem>
                <SelectItem value="Woodworking">Woodworking</SelectItem>
                <SelectItem value="Painting">Painting</SelectItem>
                <SelectItem value="Specialty Tools">Specialty Tools</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the item, its condition, and any special notes..."
              className="h-24"
              required
              maxLength={1000}
            />
          </div>

          <div>
            <Label htmlFor="condition">Condition</Label>
            <Select value={formData.condition} onValueChange={(value) => setFormData({ ...formData, condition: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Photos */}
          <div>
            <Label>Photos</Label>
            <div className="flex gap-3 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('tool-photo-upload')?.click()}
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
                id="tool-photo-upload"
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

          {/* Pricing Section */}
          <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 text-green-800">
              <h3 className="font-semibold">Set Your Rates *</h3>
            </div>

            <div>
              <Label htmlFor="lending_type">Pricing Type</Label>
              <Select value={formData.lending_type} onValueChange={(value) => setFormData({ ...formData, lending_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly Rate</SelectItem>
                  <SelectItem value="daily">Daily Rate</SelectItem>
                  <SelectItem value="rental">Both Hourly & Daily</SelectItem>
                  <SelectItem value="recurring">Recurring Rental (Weekly/Monthly)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formData.lending_type === 'hourly' || formData.lending_type === 'rental') && (
              <div>
                <Label htmlFor="hourly_rate">Hourly Rate (£) *</Label>
                <Input
                  id="hourly_rate"
                  type="number"
                  min="1"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: Math.max(1, parseFloat(e.target.value) || 0) })}
                  placeholder="e.g., 12"
                  required={formData.lending_type === 'hourly' || formData.lending_type === 'rental'}
                />
              </div>
            )}

            {(formData.lending_type === 'daily' || formData.lending_type === 'rental') && (
              <div>
                <Label htmlFor="daily_rate">Daily Rate (£) *</Label>
                <Input
                  id="daily_rate"
                  type="number"
                  min="1"
                  value={formData.daily_rate}
                  onChange={(e) => setFormData({ ...formData, daily_rate: Math.max(1, parseFloat(e.target.value) || 0) })}
                  placeholder="e.g., 40"
                  required={formData.lending_type === 'daily' || formData.lending_type === 'rental'}
                />
              </div>
            )}

            {formData.lending_type === 'recurring' && (
              <>
                <div>
                  <Label htmlFor="weekly_rate">Weekly Rate (£) *</Label>
                  <Input
                    id="weekly_rate"
                    type="number"
                    min="1"
                    value={formData.weekly_rate}
                    onChange={(e) => setFormData({ ...formData, weekly_rate: Math.max(1, parseFloat(e.target.value) || 0) })}
                    placeholder="e.g., 150"
                    required={formData.lending_type === 'recurring'}
                  />
                </div>
                <div>
                  <Label htmlFor="monthly_rate">Monthly Rate (£) *</Label>
                  <Input
                    id="monthly_rate"
                    type="number"
                    min="1"
                    value={formData.monthly_rate}
                    onChange={(e) => setFormData({ ...formData, monthly_rate: Math.max(1, parseFloat(e.target.value) || 0) })}
                    placeholder="e.g., 450"
                    required={formData.lending_type === 'recurring'}
                  />
                </div>
              </>
            )}

            <div>
              <Label htmlFor="deposit">Security Deposit (£)</Label>
              <Input
                id="deposit"
                type="number"
                min="0"
                value={formData.deposit_amount}
                onChange={(e) => setFormData({ ...formData, deposit_amount: Math.max(0, parseFloat(e.target.value) || 0) })}
                placeholder="Optional - e.g., 80"
              />
              <p className="text-xs text-gray-600 mt-1">Refundable deposit to protect your item</p>
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                💡 Competitive rates: Power tools £15-40/day, Hand tools £4-12/day, Speciality equipment £40-80/day
              </AlertDescription>
            </Alert>
          </div>

          {/* Insurance Section */}
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <Label>Offer Insurance Protection?</Label>
                <p className="text-sm text-gray-500">Allow renters to purchase insurance</p>
              </div>
              <Switch
                checked={formData.insurance_available}
                onCheckedChange={(checked) => setFormData({ ...formData, insurance_available: checked })}
              />
            </div>

            {formData.insurance_available && (
              <>
                <div>
                  <Label htmlFor="insurance_cost">Insurance Cost (£/day)</Label>
                  <Input
                    id="insurance_cost"
                    type="number"
                    min="0"
                    value={formData.insurance_cost}
                    onChange={(e) => setFormData({ ...formData, insurance_cost: Math.max(0, parseFloat(e.target.value) || 0) })}
                    placeholder="e.g., 5"
                  />
                </div>
                <div>
                  <Label htmlFor="tool_value">Tool Replacement Value (£)</Label>
                  <Input
                    id="tool_value"
                    type="number"
                    min="0"
                    value={formData.tool_value}
                    onChange={(e) => setFormData({ ...formData, tool_value: Math.max(0, parseFloat(e.target.value) || 0) })}
                    placeholder="e.g., 800"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <Label>Offer Teaching/Demonstration?</Label>
              <p className="text-sm text-gray-500">Charge extra to show renters how to use this item</p>
            </div>
            <Switch
              checked={formData.can_teach}
              onCheckedChange={(checked) => setFormData({ ...formData, can_teach: checked })}
            />
          </div>

          {formData.can_teach && (
            <div>
              <Label htmlFor="teaching_rate">Teaching Rate (£/hour)</Label>
              <Input
                id="teaching_rate"
                type="number"
                min="1"
                value={formData.teaching_rate}
                onChange={(e) => setFormData({ ...formData, teaching_rate: Math.max(1, parseFloat(e.target.value) || 0) })}
                placeholder="e.g., 32"
              />
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <Label>Allow Calendar Booking?</Label>
              <p className="text-sm text-gray-500">Let users book via calendar interface</p>
            </div>
            <Switch
              checked={formData.allow_calendar_booking}
              onCheckedChange={(checked) => setFormData({ ...formData, allow_calendar_booking: checked })}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createToolMutation.isPending}
              className="flex-1 bg-brand-800 hover:bg-brand-900"
            >
              {createToolMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Item'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
