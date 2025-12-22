import { authService, toolsService, usersService } from "@/api/services";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft, 
  Wrench,
  Star,
  Shield,
  Calendar,
  MessageCircle,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import SEO, { generateProductSchema, generateBreadcrumbSchema } from "@/components/SEO";
import BundleSuggestions from "@/components/listing/BundleSuggestions";
import TrustSignals from "@/components/profile/TrustSignals";
import { Tool, User } from "@/types";
import { queryKeys } from "@/lib/queryKeys";

export default function ToolDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const toolIdFromQuery = urlParams.get('id');
  const toolIdFromPath = location.pathname.match(/^\/tool\/([^/]+)\/?$/i)?.[1] ?? null;
  const toolId = toolIdFromPath || toolIdFromQuery;
  const toolIdKey = toolId ?? '';

  // All hooks must be called before any conditional returns
  const { data: toolData, isLoading } = useQuery({
    queryKey: queryKeys.tool(toolIdKey),
    queryFn: () => toolsService.getById(toolIdKey),
    enabled: !!toolId,
  });

  const tool: Tool | undefined = toolData?.tool;

  const ownerIdKey = tool?.ownerId ?? '';

  const { data: ownerData } = useQuery({
    queryKey: tool?.ownerId ? queryKeys.owner(ownerIdKey) : queryKeys.userIdRoot(),
    queryFn: () => usersService.getById(ownerIdKey),
    enabled: !!tool?.ownerId,
  });

  const owner: User | undefined = ownerData?.user;

  const { data: currentUserData } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () => authService.getCurrentUser(),
  });

  const currentUser = currentUserData?.user;

  // Early return if required param is missing
  if (!toolId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Missing Tool ID</h2>
          <p className="text-gray-600 mb-4">No tool ID was provided in the URL.</p>
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

  if (!tool) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Tool Not Found</h2>
          <Button onClick={() => navigate(createPageUrl("Feed"))}>
            Back to Feed
          </Button>
        </div>
      </div>
    );
  }

  const isOwner = currentUser?.id === tool.ownerId;

  const getRateDisplay = (): string => {
    const rates: string[] = [];
    if (tool.dailyRate > 0) rates.push(`£${tool.dailyRate}/day`);
    if (tool.weeklyRate && tool.weeklyRate > 0) rates.push(`£${tool.weeklyRate}/wk`);
    return rates.length > 0 ? rates.join(' • ') : 'Contact for pricing';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
      <SEO
        title={`${tool.name} - ${tool.category} | SpannerWork`}
        description={tool.description || `Rent ${tool.name} from SpannerWork. ${tool.category} available for hire.`}
        keywords={`${tool.category}, tool rental, ${tool.name}, equipment hire`}
        // @ts-expect-error - Schema types from JSX component
        schema={[
          generateProductSchema(tool),
          generateBreadcrumbSchema([
            { name: "Home", url: "https://spannerwork.co.uk" },
            { name: "Feed", url: "https://spannerwork.app/feed" },
            { name: tool.name, url: `https://spannerwork.app/tool-detail?id=${toolId}` }
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
            {tool.photos && tool.photos.length > 0 ? (
              <div className="space-y-4">
                <img
                  src={tool.photos[0]}
                  alt={tool.name}
                  className="w-full h-96 object-cover rounded-xl shadow-lg"
                />
                {tool.photos.length > 1 && (
                  <div className="grid grid-cols-3 gap-2">
                    {tool.photos.slice(1, 4).map((photo, index) => (
                      <img
                        key={index}
                        src={photo}
                        alt={`${tool.name} ${index + 2}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-96 bg-gray-100 rounded-xl flex items-center justify-center">
                <Wrench className="w-24 h-24 text-gray-300" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{tool.name}</h1>
              <Badge className="bg-orange-100 text-orange-800 mb-4">
                <Wrench className="w-3 h-3 mr-1" />
                {tool.category}
              </Badge>
              
              <div className="flex items-center gap-2 mb-4">
                <Badge className={tool.available ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                  {tool.available ? 'Available Now' : 'Currently Rented'}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {tool.condition} Condition
                </Badge>
              </div>

              <p className="text-2xl font-bold text-green-600 mb-2">
                {getRateDisplay()}
              </p>
              
              {tool.deposit > 0 && (
                <p className="text-sm text-gray-600">
                  <Shield className="w-4 h-4 inline mr-1" />
                  £{tool.deposit} refundable deposit
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-gray-700 leading-relaxed">{tool.description || 'No description provided'}</p>
            </div>

            {/* Owner Info with Trust Signals */}
            {owner && (
              <Card className="bg-gray-50 border-none">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">Owner</h3>
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={owner.avatar || undefined} />
                      <AvatarFallback className="bg-orange-100 text-brand-800">
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
                  {/* Trust Signals */}
                  <TrustSignals user={owner} size="sm" />
                </CardContent>
              </Card>
            )}

            {/* Bundle Suggestions */}
            {tool && !isOwner && (
              <BundleSuggestions
                listingType="tool"
                listingId={tool.id}
                listingName={tool.name}
                listingCategory={tool.category}
              />
            )}

            {/* Actions */}
            {!isOwner && tool.available && (
              <div className="space-y-3">
                <Link to={createPageUrl(`Chat?userId=${tool.ownerId}`)}>
                  <Button className="w-full bg-brand-800 hover:bg-brand-900 text-lg py-6">
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Contact Owner
                  </Button>
                </Link>
                <Link to={createPageUrl(`Calendar?toolId=${tool.id}`)}>
                  <Button variant="outline" className="w-full">
                    <Calendar className="w-4 h-4 mr-2" />
                    View Calendar & Book
                  </Button>
                </Link>
              </div>
            )}

            {isOwner && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Your Listing:</strong> This is your tool. Manage it from your profile.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
