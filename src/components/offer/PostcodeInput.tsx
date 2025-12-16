import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, AlertCircle } from "lucide-react";
import { ChangeEvent } from "react";

interface PostcodeInputProps {
  postcode: string;
  setPostcode: (postcode: string) => void;
  locationError: string;
  setLocationError: (error: string) => void;
  inputId?: string;
  helpText?: string;
}

export default function PostcodeInput({ 
  postcode, 
  setPostcode, 
  locationError, 
  setLocationError,
  inputId = "postcode",
  helpText = "Users can find listings near them. Your exact address stays private until confirmed booking."
}: PostcodeInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPostcode(e.target.value.toUpperCase());
    setLocationError("");
  };

  return (
    <div className="space-y-2 p-4 bg-blue-50 rounded-xl border-2 border-blue-300">
      <div className="flex items-center gap-2">
        <MapPin className="w-5 h-5 text-blue-600" />
        <Label htmlFor={inputId} className="text-base font-semibold">
          Your Location (Postcode) <span className="text-red-600">*</span>
        </Label>
      </div>
      <Input
        id={inputId}
        placeholder="e.g., SW1A 1AA"
        value={postcode}
        onChange={handleChange}
        className={`uppercase h-12 border-2 ${locationError ? 'border-red-500' : ''}`}
        required
        maxLength={10}
      />
      {locationError && (
        <p className="text-sm text-red-600 font-medium flex items-center gap-1 mt-1">
          <AlertCircle className="w-4 h-4" />
          {locationError}
        </p>
      )}
      <p className="text-xs text-blue-700 mt-1">
        💡 {helpText}
      </p>
    </div>
  );
}
