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
import { Loader2, Upload, X, AlertCircle, ImagePlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tool, ToolCondition } from "@/types";
import { queryKeys } from "@/lib/queryKeys";
import { TOOL_CATEGORIES, TOOL_CONDITIONS } from "@/components/offer/constants";
import { AIImproveButton, AIImprovementPreview, type ImprovedContent } from "@/components/ai";

interface EditToolDialogProps {
  tool: Tool;
  onClose: () => void;
}

export default function EditToolDialog({ tool, onClose }: EditToolDialogProps) {
  const queryClient = useQueryClient();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(tool.name);
  const [description, setDescription] = useState(tool.description);
  const [category, setCategory] = useState(tool.category);
  const [condition, setCondition] = useState(tool.condition as string);
  const [dailyRate, setDailyRate] = useState(tool.dailyRate / 100);
  const [weeklyRate, setWeeklyRate] = useState(tool.weeklyRate ? tool.weeklyRate / 100 : 0);
  const [deposit, setDeposit] = useState(tool.deposit / 100);
  const [photos, setPhotos] = useState<string[]>(tool.photos || []);

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

  const updateToolMutation = useMutation({
    mutationFn: () => {
      const dailyRatePence = Math.round(dailyRate * 100);
      const weeklyRatePence = weeklyRate ? Math.round(weeklyRate * 100) : undefined;
      const depositPence = Math.round(deposit * 100);

      return toolsService.update(tool.id, {
        name: name.trim(),
        description: description.trim(),
        category,
        condition: condition as ToolCondition,
        dailyRate: Number.isFinite(dailyRatePence) ? dailyRatePence : 0,
        weeklyRate: weeklyRatePence,
        deposit: Number.isFinite(depositPence) ? depositPence : 0,
        photos,
        postcode: tool.postcode, // Keep existing postcode
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tool(tool.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tools() });
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
    if (!deposit || deposit <= 0) {
      setError('Please enter a valid deposit amount');
      return;
    }

    updateToolMutation.mutate();
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const isFormValid = name.trim() && description.trim() && dailyRate > 0 && deposit > 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Edit Tool</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <Label htmlFor="name" className="text-sm font-medium">Name</Label>
            <Input
              id="name"
              placeholder="What tool is this?"
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
              placeholder="Describe your tool in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5 min-h-[120px] resize-none"
              maxLength={1000}
            />
            <AIImproveButton
              title={name}
              description={description}
              category={category}
              listingType="tool"
              onImproved={handleAIImproved}
              className="mt-2"
            />
          </div>

          {/* Category */}
          <div>
            <Label className="text-sm font-medium">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOOL_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Condition */}
          <div>
            <Label className="text-sm font-medium">Condition</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOOL_CONDITIONS.map((cond) => (
                  <SelectItem key={cond.value} value={cond.value}>{cond.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="dailyRate" className="text-sm font-medium">Daily Rate</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                <Input
                  id="dailyRate"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="25"
                  value={dailyRate || ''}
                  onChange={(e) => setDailyRate(e.target.value ? parseFloat(e.target.value) : 0)}
                  className="pl-7"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="weeklyRate" className="text-sm font-medium">Weekly Rate</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                <Input
                  id="weeklyRate"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="100"
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
                  min="1"
                  step="1"
                  placeholder="50"
                  value={deposit || ''}
                  onChange={(e) => setDeposit(e.target.value ? parseFloat(e.target.value) : 0)}
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
                      onClick={() => document.getElementById('photo-upload-tool')?.click()}
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
                  onClick={() => document.getElementById('photo-upload-tool')?.click()}
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
                id="photo-upload-tool"
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
              disabled={updateToolMutation.isPending || !isFormValid}
              className="flex-1 bg-brand-800 hover:bg-brand-900"
            >
              {updateToolMutation.isPending ? (
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
