/**
 * LivePreviewCard - Shows listing preview as user creates it
 */

import { motion } from "framer-motion";
import { Camera, Eye, Heart, MessageCircle, Share2 } from "lucide-react";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { NeedData, OfferData } from "./types";

interface LivePreviewCardProps {
  intent: string;
  category: string;
  data: NeedData | OfferData;
  photos: string[];
}

export function LivePreviewCard({ intent, category, data, photos }: LivePreviewCardProps) {
  const isNeed = intent === "need";
  const title = isNeed ? (data as NeedData).title : ((data as OfferData).name || (data as OfferData).title);
  const description = data?.description;
  const budget = isNeed ? (data as NeedData).budget : ((data as OfferData).dailyRate || (data as OfferData).hourlyRate);
  
  let rateLabel = "";
  if (isNeed) {
    const rateType = (data as NeedData).rateType;
    rateLabel = rateType === "HOURLY" ? "/hr" : rateType === "DAILY" ? "/day" : "";
  } else {
    rateLabel = category === "service" ? "/hr" : "/day";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
    >
      {/* Preview Header */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2 border-b flex items-center gap-2">
        <Eye className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-medium text-gray-500">Live Preview</span>
        <div className="flex-1" />
        <span className="text-[10px] text-gray-400">How your listing will look</span>
      </div>

      {/* Preview Content */}
      <div className="p-4">
        {/* Photos Preview */}
        {photos && photos.length > 0 ? (
          <div className="aspect-video rounded-lg overflow-hidden mb-3 bg-gray-100">
            <OptimizedImage src={photos[0]} alt="" sizes="card" aspectRatio="16/9" className="w-full h-full" />
          </div>
        ) : (
          <div className="aspect-video rounded-lg bg-gradient-to-br from-gray-100 to-gray-50 mb-3 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <Camera className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <span className="text-xs">Add photos</span>
            </div>
          </div>
        )}

        {/* Title */}
        <h3 className={`font-bold text-lg mb-1 ${title ? 'text-gray-900' : 'text-gray-300'}`}>
          {title || "Your listing title..."}
        </h3>

        {/* Description */}
        <p className={`text-sm mb-3 line-clamp-2 ${description ? 'text-gray-600' : 'text-gray-300'}`}>
          {description || "Add a description to help people understand what you're offering..."}
        </p>

        {/* Price & Category */}
        <div className="flex items-center gap-2">
          {budget && (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-700 font-bold text-sm">
              £{budget}{rateLabel}
            </span>
          )}
          {category && (
            <span className="inline-flex items-center px-2 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-medium">
              {category === "TOOLS" || category === "tool" ? "Tool" : 
               category === "SPACE" || category === "space" ? "Space" : 
               category === "EXPERTISE" || category === "service" ? "Service" : ""}
            </span>
          )}
        </div>

        {/* Fake interaction buttons */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t">
          <button className="flex items-center gap-1 text-gray-400 text-sm">
            <Heart className="w-4 h-4" /> Save
          </button>
          <button className="flex items-center gap-1 text-gray-400 text-sm">
            <MessageCircle className="w-4 h-4" /> Message
          </button>
          <button className="flex items-center gap-1 text-gray-400 text-sm">
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default LivePreviewCard;
