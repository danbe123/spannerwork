import { authService, spacesService, usersService } from "@/api/services";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft, 
  Warehouse,
  Star,
  Shield,
  MessageCircle,
  CheckCircle,
  AlertCircle,
  Maximize,
  Car,
  Zap,
  MapPin
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import SEO, { generateProductSchema, generateBreadcrumbSchema } from "@/components/SEO";
import { Space, User } from "@/types";

export default function SpaceDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: spaceIdFromPath } = useParams<{ id: string }>();
  const urlParams = new URLSearchParams(location.search);
  const spaceIdFromQuery = urlParams.get('id');
  const spaceId = spaceIdFromPath || spaceIdFromQuery;

  // All hooks must be called before any conditional returns
  const { data: spaceData, isLoading } = useQuery({
    queryKey: ['space', spaceId],
    queryFn: () => spacesService.getById(spaceId!),
    enabled: !!spaceId,
  });

  const space: Space | undefined = spaceData?.space;

  const { data: ownerData } = useQuery({
    queryKey: ['owner', space?.ownerId],
    queryFn: () => usersService.getById(space!.ownerId),
    enabled: !!space?.ownerId,
  });

  const owner: User | undefined = ownerData?.user;

  const { data: currentUserData } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => authService.getCurrentUser(),
  });

  const currentUser = currentUserData?.user;

  // Early return if required param is missing
  if (!spaceId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Missing Space ID</h2>
          <p className="text-gray-600 mb-4">No space ID was provided in the URL.</p>
          <Button onClick={() => navigate('/feed')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Feed
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-12 w-32 mb-6" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Space Not Found</h2>
          <Button onClick={() => navigate(createPageUrl("Feed"))}>
            Back to Feed
          </Button>
        </div>
      </div>
    );
  }

  const isOwner = currentUser?.id === space.ownerId;

  const getRateDisplay = (): string => {
    const rates: string[] = [];
    if (space.hourlyRate > 0) rates.push(`£${space.hourlyRate}/hr`);
    if (space.dailyRate > 0) rates.push(`£${space.dailyRate}/day`);
    return rates.length > 0 ? rates.join(' • ') : 'Contact for pricing';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
      <SEO
        title={`${space.name} - Workshop Space | SpannerWork`}
        description={space.description || `Rent ${space.name} from SpannerWork. Workshop space available for hire.`}
        keywords={`workshop rental, garage space, ${space.name}`}
        // @ts-ignore - Schema types from JSX component
        schema={[
          generateProductSchema(space),
          generateBreadcrumbSchema([
            { name: "Home", url: "https://spannerwork.co.uk" },
            { name: "Feed", url: "https://spannerwork.app/feed" },
            { name: space.name, url: `https://spannerwork.app/space-detail?id=${spaceId}` }
          ])
        ]}
      />

      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Feed"))}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Feed
        </Button>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Photos */}
          <div>
            {space.photos && space.photos.length > 0 ? (
              <div className="space-y-4">
                <img
                  src={space.photos[0]}
                  alt={space.name}
                  className="w-full h-96 object-cover rounded-xl shadow-lg"
                />
                {space.photos.length > 1 && (
                  <div className="grid grid-cols-3 gap-2">
                    {space.photos.slice(1, 4).map((photo, index) => (
                      <img
                        key={index}
                        src={photo}
                        alt={`${space.name} ${index + 2}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-96 bg-gray-100 rounded-xl flex items-center justify-center">
                <Warehouse className="w-24 h-24 text-gray-300" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{space.name}</h1>
              <Badge className="bg-purple-100 text-purple-800 mb-4 capitalize">
                <Warehouse className="w-3 h-3 mr-1" />
                Workshop Space
              </Badge>
              
              <div className="flex items-center gap-2 mb-4">
                <Badge className={space.available ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                  {space.available ? 'Available Now' : 'Currently Booked'}
                </Badge>
              </div>

              <p className="text-2xl font-bold text-green-600 mb-2">
                {getRateDisplay()}
              </p>
              
              {space.deposit && space.deposit > 0 && (
                <p className="text-sm text-gray-600">
                  <Shield className="w-4 h-4 inline mr-1" />
                  £{space.deposit} refundable deposit
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-gray-700 leading-relaxed">{space.description || 'No description provided'}</p>
            </div>

            {/* Space Details */}
            <Card className="bg-gray-50 border-none">
              <CardHeader>
                <CardTitle className="text-lg">Space Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {space.sizeSqft && space.sizeSqft > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Maximize className="w-4 h-4 text-gray-600" />
                    <span>{space.sizeSqft} square feet</span>
                  </div>
                )}
                {space.vehicleCapacity && space.vehicleCapacity > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Car className="w-4 h-4 text-gray-600" />
                    <span>Fits {space.vehicleCapacity} vehicle{space.vehicleCapacity > 1 ? 's' : ''}</span>
                  </div>
                )}
                {space.maxVehicleHeight && space.maxVehicleHeight > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-600" />
                    <span>Max height: {space.maxVehicleHeight} feet</span>
                  </div>
                )}
                {space.electricityAvailable && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <Zap className="w-4 h-4" />
                    <span>Electricity available</span>
                  </div>
                )}
                {space.toolsAvailable && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span>Basic tools provided</span>
                  </div>
                )}
                {space.supervisionRequired && (
                  <div className="flex items-center gap-2 text-sm text-orange-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>Owner supervision required</span>
                  </div>
                )}
                {space.insuranceRequired && (
                  <div className="flex items-center gap-2 text-sm text-orange-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>Insurance required</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Features */}
            {space.features && space.features.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Features & Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {space.features.map((feature, index) => (
                    <Badge key={index} variant="secondary">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Owner Info */}
            {owner && (
              <Card className="bg-gray-50 border-none">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">Space Owner</h3>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={owner.avatar || undefined} />
                      <AvatarFallback className="bg-purple-100 text-purple-700">
                        {owner.name?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold">{owner.name || owner.username || 'User'}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Star className="w-3 h-3 fill-[#FFC107] text-[#FFC107]" />
                        <span>{owner.rating?.toFixed(1) || '0.0'}</span>
                        <span>•</span>
                        <span>{owner.totalTransactions || 0} jobs</span>
                        {owner.totalTransactions >= 5 && (
                          <CheckCircle className="w-3 h-3 text-[#FFC107]" />
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            {!isOwner && space.available && (
              <Link to={createPageUrl(`Chat?userId=${space.ownerId}`)}>
                <Button className="w-full bg-brand-800 hover:bg-brand-900 text-lg py-6">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Contact Owner
                </Button>
              </Link>
            )}

            {isOwner && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Your Listing:</strong> This is your space. Manage it from your profile.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
