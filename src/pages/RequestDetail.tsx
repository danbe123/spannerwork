
import { useState } from "react";
import { authService, requestsService, usersService, transactionsService } from "@/api/services";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  Banknote,
  User as UserIcon,
  MessageCircle,
  Wrench,
  GraduationCap,
  Warehouse,
  Edit,
  Eye,
  AlertCircle,
  LucideIcon
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import RequestResponseDialog from "../components/RequestResponseDialog";
import EditRequestDialog from "../components/EditRequestDialog";
import { Transaction } from "@/types";

// Format UK postcode with proper spacing
const formatPostcode = (input?: string) => {
  if (!input) return '';
  
  // Remove spaces and convert to uppercase
  const cleaned = input.toString().replace(/\s+/g, '').toUpperCase();
  
  // UK postcodes are 5-7 chars (without space)
  // Last 3 chars are always: digit + 2 letters
  if (cleaned.length >= 5 && cleaned.length <= 7) {
    const outward = cleaned.slice(0, -3);
    const inward = cleaned.slice(-3);
    return `${outward} ${inward}`;
  }
  
  return cleaned;
};

const urgencyColors: Record<string, string> = {
  ASAP: "bg-red-100 text-red-800 border-red-200",
  TODAY: "bg-orange-100 text-orange-800 border-orange-200",
  THIS_WEEKEND: "bg-yellow-100 text-yellow-800 border-yellow-200",
  FLEXIBLE: "bg-green-100 text-green-800 border-green-200"
};

const categoryIcons: Record<string, LucideIcon> = {
  TOOLS: Wrench,
  EXPERTISE: GraduationCap,
  SPACE: Warehouse
};

export default function RequestDetail() {
  const navigate = useNavigate();
  const [showResponseDialog, setShowResponseDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const { id: requestId } = useParams<{ id: string }>();

  const { data: currentUserData } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => authService.getCurrentUser(),
  });

  const currentUser = currentUserData?.user;

  const { data: requestData, isLoading } = useQuery({
    queryKey: ['request', requestId],
    queryFn: async () => requestId ? requestsService.getById(requestId) : Promise.resolve(undefined),
    enabled: !!requestId,
  });

  const request = requestData?.request;

  const { data: seekerData } = useQuery({
    queryKey: ['user', request?.seekerId],
    queryFn: async () => request?.seekerId ? usersService.getById(request.seekerId) : Promise.resolve(undefined),
    enabled: !!request?.seekerId,
  });

  const seeker = seekerData?.user;

  const { data: responsesData } = useQuery({
    queryKey: ['requestResponses', requestId],
    queryFn: async () => requestId ? transactionsService.list({ requestId }) : Promise.resolve({ data: [] }),
    enabled: !!requestId,
  });

  const responses = responsesData?.data || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Request Not Found</h2>
          <Button onClick={() => navigate('/Feed')} className="mt-4">
            Back to Feed
          </Button>
        </div>
      </div>
    );
  }

  const isOwnRequest = currentUser?.id === request?.seekerId;
  const isActive = request?.status === 'ACTIVE';

  const getRateDisplay = () => {
    if (request.budget === undefined || request.budget === null) return null;
    
    switch(request.rateType) {
      case 'HOURLY':
        return `£${request.budget}/hr`;
      case 'DAILY':
        return `£${request.budget}/day`;
      case 'FIXED':
      default:
        return `£${request.budget}`;
    }
  };

  const CategoryIcon = (request.category && categoryIcons[request.category]) || Wrench;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100">
      <div className="bg-gradient-to-r from-brand-800 to-brand-900 text-white px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/Feed')}
            className="mb-4 text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Feed
          </Button>
          <div className="flex items-center gap-3">
            <CategoryIcon className="w-8 h-8" />
            <h1 className="text-3xl font-bold">Job Details</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6 pb-8">
        <Card className="border-none shadow-lg mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-2xl mb-3">{request.title}</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Badge className={`${urgencyColors[request.urgency] || 'bg-gray-100 text-gray-800'} border font-semibold`}>
                    {request.urgency?.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                  {getRateDisplay() && (
                    <Badge className="bg-green-600 text-white font-semibold">
                      <Banknote className="w-3 h-3 mr-1" />
                      {getRateDisplay()}
                    </Badge>
                  )}
                  <Badge variant="outline" className="capitalize border-gray-300 text-gray-700 font-semibold">
                    <CategoryIcon className="w-3 h-3 mr-1" />
                    {request.category}
                  </Badge>
                  {!isActive && (
                    <Badge variant="secondary" className="font-semibold">
                      {request.status}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {request.photos && request.photos.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-3">Photos</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {request.photos.map((photo, index) => (
                    <img
                      key={index}
                      src={photo}
                      alt={`Request photo ${index + 1}`}
                      className="w-full h-48 object-cover rounded-lg shadow-sm"
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-lg mb-2">Description</h3>
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {request.description}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-brand-800" />
                  Location
                </h3>
                <p className="text-gray-700 font-medium">
                  {request.postcode
                    ? formatPostcode(request.postcode)
                    : request.locationAddress || 'Not specified'}
                </p>
                {request.broadcastRadius !== undefined && request.broadcastRadius < 999 && (
                  <p className="text-sm text-gray-500 mt-1">
                    Within {request.broadcastRadius} miles
                  </p>
                )}
                {request.broadcastRadius !== undefined && request.broadcastRadius >= 999 && (
                   <p className="text-sm text-gray-500 mt-1">Nationwide request</p>
                )}
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-brand-800" />
                  Posted
                </h3>
                <p className="text-gray-700 font-medium">
                  {formatDistanceToNow(new Date(request.createdDate), { addSuffix: true })}
                </p>
              </div>
            </div>

            {seeker && (
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-brand-800" />
                  Posted By
                </h3>
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 shadow-sm border border-gray-200">
                  <Avatar className="w-12 h-12">
                    {seeker.avatar ? (
                      <AvatarImage src={seeker.avatar} alt={seeker.name || 'User'} className="object-cover" />
                    ) : null}
                    <AvatarFallback className="bg-orange-100 text-brand-800 font-bold text-lg">
                      {seeker.name?.[0]?.toUpperCase() || seeker.email?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-gray-900">{seeker.name || 'User'}</p>
                    {(seeker.rating !== undefined && seeker.rating !== null) && (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <span>⭐ {seeker.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isOwnRequest && responses.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-brand-800" />
                  Responses ({responses.length})
                </h3>
                <div className="space-y-3">
                  {responses.map((response: Transaction) => (
                    <Card key={response.id} className="bg-blue-50 border-blue-200 shadow-sm">
                      <CardContent className="p-4 flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-gray-800">New offer received!</p>
                          <p className="text-sm text-gray-600">
                            Quote: £{response.rentalFee} {response.depositAmount ? `• Deposit: £${response.depositAmount}` : ''}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => navigate(`/Chat?userId=${response.providerId}&requestId=${request.id}`)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          View Quote
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3 mt-8">
          {isOwnRequest && isActive ? (
            <>
              <Button
                onClick={() => setShowEditDialog(true)}
                variant="outline"
                className="flex-1 border-2 hover:border-brand-800 hover:bg-orange-50 text-gray-700"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Request
              </Button>
              <Button
                onClick={() => navigate(`/Messages`)} // Assuming a generic messages page or specific one if responses exist
                className="flex-1 bg-brand-800 hover:bg-brand-900 text-white"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Responses {responses.length > 0 && `(${responses.length})`}
              </Button>
            </>
          ) : !isOwnRequest && isActive ? (
            <Button
              onClick={() => setShowResponseDialog(true)}
              className="w-full bg-brand-800 hover:bg-brand-900 text-lg py-7 font-bold shadow-lg hover:shadow-xl transition-all"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              I Can Help! Send Quote
            </Button>
          ) : (
            <Button
              onClick={() => navigate('/Feed')}
              variant="outline"
              className="w-full border-2 text-gray-700"
            >
              Back to Feed
            </Button>
          )}
        </div>
      </div>

      {showResponseDialog && request && (
        <RequestResponseDialog
          request={request}
          onClose={() => setShowResponseDialog(false)}
        />
      )}

      {showEditDialog && request && (
        <EditRequestDialog
          request={request}
          onClose={() => setShowEditDialog(false)}
        />
      )}
    </div>
  );
}
