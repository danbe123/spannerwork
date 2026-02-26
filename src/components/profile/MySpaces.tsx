import { useState } from "react";
import { spacesService, authService } from "@/api/services";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Warehouse, Trash2, MapPin, Maximize, Car, Zap } from "lucide-react";
import { Space } from "@/types";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";

interface MySpacesProps {
  spaces: Space[];
}

export default function MySpaces({ spaces }: MySpacesProps) {
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState<Space | null>(null);

  const { data: currentUserData } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () => authService.getCurrentUser(),
  });

  const currentUser = currentUserData?.user;

  const deleteSpaceMutation = useMutation({
    mutationFn: (spaceId: string) => spacesService.delete(spaceId),
    onSuccess: () => {
      // Invalidate all relevant queries
      if (currentUser?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.myListingsByUser(currentUser.id) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.mySpaces() });
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      toast.success('Space deleted successfully');
      setDeleteConfirm(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete space');
    },
  });

  const getRateDisplay = (space: Space): string => {
    const rates: string[] = [];
    if (space.hourlyRate) rates.push(`£${space.hourlyRate}/hr`);
    if (space.dailyRate) rates.push(`£${space.dailyRate}/day`);
    if (space.weeklyRate) rates.push(`£${space.weeklyRate}/wk`);
    return rates.length > 0 ? rates.join(' • ') : 'Contact for pricing';
  };

  if (spaces.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Warehouse className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p>No spaces listed yet. Add your garage or workshop to start earning!</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid md:grid-cols-2 gap-6">
        {spaces.map((space) => (
          <Card key={space.id} className="border-none shadow-lg overflow-hidden">
            {space.photos?.[0] && (
              <img
                src={space.photos[0]}
                alt={space.name}
                className="w-full h-48 object-cover"
              />
            )}
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">{space.name}</h3>
                  <Badge variant="outline" className="mb-2 capitalize">
                    {space.spaceType?.replace(/_/g, ' ') || 'Space'}
                  </Badge>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {space.description}
              </p>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-2 mb-3 text-xs text-gray-600">
                {(space.sizeSqft ?? 0) > 0 && (
                  <div className="flex items-center gap-1">
                    <Maximize className="w-3 h-3" />
                    <span>{space.sizeSqft} sq ft</span>
                  </div>
                )}
                {(space.vehicleCapacity ?? 0) > 0 && (
                  <div className="flex items-center gap-1">
                    <Car className="w-3 h-3" />
                    <span>{space.vehicleCapacity} vehicle{(space.vehicleCapacity ?? 0) > 1 ? 's' : ''}</span>
                  </div>
                )}
                {(space.maxVehicleHeight ?? 0) > 0 && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>{space.maxVehicleHeight}ft height</span>
                  </div>
                )}
              </div>

              {/* Features */}
              {space.features && space.features.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {space.features.slice(0, 3).map((feature, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                  {space.features.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{space.features.length - 3} more
                    </Badge>
                  )}
                </div>
              )}

              {/* Amenities Icons */}
              <div className="flex gap-3 mb-3 text-xs text-gray-500">
                {space.electricityAvailable && (
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-[#FFC107]" />
                    <span>Power</span>
                  </div>
                )}
                {space.toolsAvailable && (
                  <div className="flex items-center gap-1">
                    <Warehouse className="w-3 h-3 text-blue-500" />
                    <span>Tools</span>
                  </div>
                )}
              </div>

              {/* Pricing & Actions */}
              <div className="flex flex-wrap gap-2 text-xs mb-3">
                <Badge className="bg-green-100 text-green-800">
                  {getRateDisplay(space)}
                </Badge>
                {space.available ? (
                  <Badge className="bg-green-100 text-green-800">Available</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800">Booked</Badge>
                )}
                {(space.deposit ?? 0) > 0 && (
                  <Badge variant="outline">£{space.deposit} deposit</Badge>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteConfirm(space)}
                  className="ml-auto"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {deleteConfirm && (
        <AlertDialog open onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Space?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteSpaceMutation.mutate(deleteConfirm.id)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete Space
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
