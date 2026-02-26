import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, X } from "lucide-react";
import { uploadService } from "@/api/services";
import { ChangeEvent } from "react";

interface PhotoUploaderProps {
  photos: string[];
  setPhotos: (photos: string[]) => void;
  uploadingPhoto: boolean;
  setUploadingPhoto: (uploading: boolean) => void;
  inputId?: string;
  required?: boolean;
}

export default function PhotoUploader({ 
  photos, 
  setPhotos, 
  uploadingPhoto, 
  setUploadingPhoto,
  inputId = "photo-upload",
  required = false 
}: PhotoUploaderProps) {
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
      // Show user-friendly error message
      const errorMessage = (error as { message?: string })?.message || 'Upload failed. Please try again.';
      alert(errorMessage);
    }
    setUploadingPhoto(false);
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3 p-6 bg-gradient-to-br from-brand-50 to-red-50 rounded-xl border-2 border-brand-200">
      <div className="flex items-center gap-2">
        <Label className="text-lg font-semibold">Photos</Label>
        <Badge className="bg-brand-600">{required ? 'Required' : 'Recommended'}</Badge>
      </div>
      <p className="text-sm text-gray-600">Add clear photos to get up to 3x more enquiries</p>
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => document.getElementById(inputId)?.click()}
          disabled={uploadingPhoto}
          className="border-2 border-brand-300 hover:bg-brand-100"
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
          id={inputId}
          type="file"
          accept="image/*"
          onChange={handlePhotoUpload}
          className="hidden"
        />
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-4">
          {photos.map((photo, index) => (
            <div key={index} className="relative group">
              <img
                src={photo}
                alt={`Upload ${index + 1}`}
                className="w-full h-24 object-cover rounded-lg border-2 border-brand-300 shadow-sm"
              />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
