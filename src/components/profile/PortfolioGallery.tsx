/**
 * PortfolioGallery Component
 * 
 * Showcases completed work with photos from transactions and tools.
 * Features lightbox view and category filtering.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Image as ImageIcon, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Wrench,
  Calendar,
  Star,
  ZoomIn
} from "lucide-react";
import { format } from "date-fns";

import type { Tool, Transaction } from "@/types";

interface PortfolioItem {
  id: string;
  type: 'tool' | 'work';
  photo: string;
  title: string;
  category?: string;
  date?: Date;
  rating?: number;
  description?: string;
}

interface PortfolioGalleryProps {
  tools: Tool[];
  transactions: Transaction[];
  className?: string;
}

export default function PortfolioGallery({ 
  tools = [], 
  transactions = [],
  className = ""
}: PortfolioGalleryProps) {
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [filter, setFilter] = useState<string>("all");

  // Build portfolio items from tools and transactions
  const portfolioItems: PortfolioItem[] = [];

  // Add tools with photos
  tools.forEach(tool => {
    if (tool.photos && tool.photos.length > 0) {
      tool.photos.forEach((photo, index) => {
        portfolioItems.push({
          id: `tool-${tool.id}-${index}`,
          type: 'tool',
          photo,
          title: tool.name,
          category: tool.category,
          description: tool.description,
        });
      });
    }
  });

  // Add completed transactions with photos
  transactions.forEach(tx => {
    if (tx.status === 'COMPLETED' && tx.photos) {
      tx.photos.forEach((photo, idx) => {
        portfolioItems.push({
          id: `work-${tx.id}-${idx}`,
          type: 'work',
          photo,
          title: tx.title || 'Completed Work',
          category: tx.category ?? undefined,
          date: new Date(tx.createdDate),
          rating: tx.rating ?? undefined,
        });
      });
    }
  });

  // Get unique categories
  const categories = ['all', ...new Set(portfolioItems.map(item => item.category).filter(Boolean))];

  // Filter items
  const filteredItems = filter === 'all' 
    ? portfolioItems 
    : portfolioItems.filter(item => item.category === filter);

  // Get current item index for navigation
  const currentIndex = selectedItem 
    ? filteredItems.findIndex(item => item.id === selectedItem.id) 
    : -1;

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setSelectedItem(filteredItems[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex < filteredItems.length - 1) {
      setSelectedItem(filteredItems[currentIndex + 1]);
    }
  };

  if (portfolioItems.length === 0) {
    return (
      <Card className={`border-none shadow-lg ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ImageIcon className="w-5 h-5 text-brand-800" />
            Portfolio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="mb-2">No portfolio items yet</p>
            <p className="text-sm">Add photos to your tools or complete jobs to build your portfolio</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={`border-none shadow-lg ${className}`}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ImageIcon className="w-5 h-5 text-brand-800" />
            Portfolio
            <Badge variant="secondary" className="ml-2">
              {portfolioItems.length} photos
            </Badge>
          </CardTitle>

          {categories.length > 2 && (
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat || 'unknown'} value={cat || 'unknown'}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>

        <CardContent>
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.05 }
              }
            }}
          >
            {filteredItems.slice(0, 12).map((item) => (
              <motion.div
                key={item.id}
                variants={{
                  hidden: { opacity: 0, scale: 0.8 },
                  visible: { opacity: 1, scale: 1 }
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group"
                onClick={() => setSelectedItem(item)}
              >
                <img
                  src={item.photo}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-sm font-medium truncate">{item.title}</p>
                    {item.category && (
                      <Badge variant="secondary" className="mt-1 text-xs bg-white/20 text-white border-0">
                        {item.category}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Zoom icon */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                      <ZoomIn className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>

                {/* Type badge */}
                <div className="absolute top-2 right-2">
                  <Badge 
                    className={`text-xs ${
                      item.type === 'tool' 
                        ? 'bg-blue-500/80' 
                        : 'bg-green-500/80'
                    } text-white border-0`}
                  >
                    {item.type === 'tool' ? <Wrench className="w-3 h-3" /> : <Star className="w-3 h-3" />}
                  </Badge>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {filteredItems.length > 12 && (
            <div className="mt-4 text-center">
              <Button variant="outline" className="text-brand-800 border-brand-800 hover:bg-brand-800/5">
                View All {filteredItems.length} Photos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lightbox Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
          <AnimatePresence mode="wait">
            {selectedItem && (
              <motion.div
                key={selectedItem.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                {/* Close button */}
                <button
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-4 right-4 z-10 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>

                {/* Navigation */}
                {currentIndex > 0 && (
                  <button
                    onClick={handlePrevious}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6 text-white" />
                  </button>
                )}
                {currentIndex < filteredItems.length - 1 && (
                  <button
                    onClick={handleNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                  >
                    <ChevronRight className="w-6 h-6 text-white" />
                  </button>
                )}

                {/* Image */}
                <img
                  src={selectedItem.photo}
                  alt={selectedItem.title}
                  className="w-full max-h-[70vh] object-contain"
                />

                {/* Info bar */}
                <div className="p-4 bg-black/80 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-semibold text-lg">{selectedItem.title}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        {selectedItem.category && (
                          <Badge variant="secondary" className="bg-white/10 text-white border-0">
                            {selectedItem.category}
                          </Badge>
                        )}
                        {selectedItem.date && (
                          <span className="text-gray-400 text-sm flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(selectedItem.date, 'MMM d, yyyy')}
                          </span>
                        )}
                        {selectedItem.rating && (
                          <span className="text-amber-400 text-sm flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-400" />
                            {selectedItem.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-gray-400 text-sm">
                      {currentIndex + 1} / {filteredItems.length}
                    </div>
                  </div>
                  {selectedItem.description && (
                    <p className="text-gray-300 text-sm mt-2 line-clamp-2">{selectedItem.description}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}
