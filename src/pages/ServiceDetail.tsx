import { authService, servicesService, usersService } from "@/api/services";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";
import {
  ArrowLeft,
  Star,
  MessageCircle,
  AlertCircle,
  Clock,
  Shield,
  Award,
  Phone,
  CheckCircle,
  Edit
} from "lucide-react";
import EditServiceDialog from "@/components/EditServiceDialog";
import { Skeleton } from "@/components/ui/skeleton";
import SEO, { generateServiceSchema, generateBreadcrumbSchema } from "@/components/SEO";
import { Service, User } from "@/types";
import { queryKeys } from "@/lib/queryKeys";

export default function ServiceDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { id: serviceIdFromPath } = useParams<{ id: string }>();
  const urlParams = new URLSearchParams(location.search);
  const serviceIdFromQuery = urlParams.get('id');
  const serviceId = serviceIdFromPath || serviceIdFromQuery;
  const serviceIdKey = serviceId ?? '';

  // All hooks must be called before any conditional returns
  const { data: serviceData, isLoading } = useQuery({
    queryKey: queryKeys.service(serviceIdKey),
    queryFn: () => servicesService.getById(serviceIdKey),
    enabled: !!serviceId,
  });

  const service: Service | undefined = serviceData?.service;

  const providerIdKey = service?.providerId ?? '';

  const { data: providerData } = useQuery({
    queryKey: service?.providerId ? queryKeys.provider(providerIdKey) : queryKeys.providerRoot(),
    queryFn: () => usersService.getById(providerIdKey),
    enabled: !!service?.providerId,
  });

  const provider: User | undefined = providerData?.user;

  const { data: currentUserData } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () => authService.getCurrentUser(),
  });

  const currentUser = currentUserData?.user;

  // Early return if required param is missing
  if (!serviceId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Missing Service ID</h2>
          <p className="text-gray-600 mb-4">No service ID was provided in the URL.</p>
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

  if (!service) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Service Not Found</h2>
          <Button onClick={() => navigate(createPageUrl("Feed"))}>
            Back to Feed
          </Button>
        </div>
      </div>
    );
  }

  const isOwnService = currentUser?.id === service.providerId;

  const formatPrice = (): string => {
    if (service.hourlyRate) {
      return `£${service.hourlyRate}/hr`;
    }
    return 'By Quote';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
      <SEO
        title={`${service.title} - Professional Service | SpannerWork`}
        description={service.description}
        keywords={`${service.category}, professional service`}
        schema={[
          generateServiceSchema(service.title, service.description, service.hourlyRate || 0),
          generateBreadcrumbSchema([
            { name: "Home", url: "https://spannerwork.co.uk" },
            { name: "Feed", url: "https://spannerwork.app/feed" },
            { name: service.title, url: `https://spannerwork.app/service?id=${serviceId}` }
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

        <Card className="border-none shadow-xl mb-6">
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge className="bg-green-100 text-green-800">
                    {service.category}
                  </Badge>
                  {service.mobileService && (
                    <Badge variant="outline">
                      <Phone className="w-3 h-3 mr-1" />
                      Mobile Service
                    </Badge>
                  )}
                  {service.responseTime && (
                    <Badge variant="outline">
                      <Clock className="w-3 h-3 mr-1" />
                      {service.responseTime.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{service.title}</h1>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 mb-1">Starting from</p>
                <p className="text-3xl font-bold text-green-600">{formatPrice()}</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Description */}
            <div>
              <h3 className="font-semibold mb-2">About This Service</h3>
              <p className="text-gray-700 leading-relaxed">{service.description}</p>
            </div>

            {/* Photos */}
            {service.photos && service.photos.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Portfolio</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {service.photos.map((photo, index) => (
                    <img
                      key={index}
                      src={photo}
                      alt={`Service photo ${index + 1}`}
                      className="w-full h-48 object-cover rounded-lg border"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Details Grid */}
            <div className="grid md:grid-cols-2 gap-6 p-6 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600 mb-1">Experience</p>
                <p className="font-semibold">{service.yearsExperience || 0} years</p>
              </div>
              {service.mobileService && service.serviceRadius && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Service Radius</p>
                  <p className="font-semibold">{service.serviceRadius} miles</p>
                </div>
              )}
              {service.mobileService && service.calloutFee && service.calloutFee > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Call-out Fee</p>
                  <p className="font-semibold">£{service.calloutFee}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600 mb-1">Weekend Availability</p>
                <p className="font-semibold">{service.weekendAvailability ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Evening Availability</p>
                <p className="font-semibold">{service.eveningAvailability ? 'Yes' : 'No'}</p>
              </div>
              {service.emergencyCallout && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Emergency Call-out</p>
                  <Badge className="bg-red-100 text-red-800">Available 24/7</Badge>
                </div>
              )}
              {service.offersFreeQuote && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Free Quote</p>
                  <p className="font-semibold flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Yes
                  </p>
                </div>
              )}
            </div>

            {/* Professional Credentials */}
            {(service.certifications?.length || service.hasInsurance) && (
              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  Professional Credentials
                </h3>
                <div className="space-y-3">
                  {service.certifications && service.certifications.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Certifications</p>
                      <div className="flex flex-wrap gap-2">
                        {service.certifications.map((cert, index) => (
                          <Badge key={index} className="bg-blue-100 text-blue-800">
                            <Award className="w-3 h-3 mr-1" />
                            {cert}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {service.hasInsurance && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Insurance</p>
                      <Badge className="bg-green-100 text-green-800">
                        <Shield className="w-3 h-3 mr-1" />
                        Public Liability Insurance
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Provider Info */}
            <div className="border-t pt-6">
              <h3 className="font-semibold mb-4">Service Provider</h3>
              {provider && (
                <div className="flex items-center gap-4">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-blue-100 text-blue-700">
                      {provider.name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold">{provider.name || provider.username || 'User'}</p>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Star className="w-3 h-3 fill-[#FFC107] text-[#FFC107] mr-1" />
                        {provider.rating?.toFixed(1) || '0.0'}
                      </div>
                      <span>•</span>
                      <span>{provider.totalTransactions || 0} completed jobs</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            {!isOwnService && service.available && (
              <div className="border-t pt-6">
                <Link to={createPageUrl(`Chat?userId=${service.providerId}`)}>
                  <Button className="w-full bg-brand-800 hover:bg-brand-900 text-lg py-6">
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Contact Service Provider
                  </Button>
                </Link>
              </div>
            )}

            {isOwnService && (
              <div className="border-t pt-6 space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700">
                    <strong>Your Service:</strong> Customers can contact you through the messaging system.
                  </p>
                </div>
                <Button
                  onClick={() => setShowEditDialog(true)}
                  className="w-full bg-brand-800 hover:bg-brand-900"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Listing
                </Button>
              </div>
            )}

            {/* Edit Dialog */}
            {showEditDialog && service && (
              <EditServiceDialog
                service={service}
                onClose={() => setShowEditDialog(false)}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
