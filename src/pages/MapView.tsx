import { useState, useEffect, useMemo, type ComponentType } from "react";
import { requestsService, authService } from "@/api/services";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, List, Wrench, GraduationCap, Warehouse, Navigation, AlertCircle } from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Request, User } from "@/types";
import { brandColors } from "@/lib/colors";
import { queryKeys } from "@/lib/queryKeys";
import MarketingFooter from "@/components/MarketingFooter";
import DocsMobileHeader from "@/components/docs/DocsMobileHeader";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet component type workaround
const MapContainerAny = MapContainer as unknown as ComponentType<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet component type workaround
const TileLayerAny = TileLayer as unknown as ComponentType<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet component type workaround
const MarkerAny = Marker as unknown as ComponentType<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet component type workaround
const PopupAny = Popup as unknown as ComponentType<any>;

type LatLngTuple = [number, number];

// Extended type for Leaflet's Icon.Default prototype which includes _getIconUrl
interface IconDefaultPrototype {
  _getIconUrl?: string;
}

// Fix for default marker icons in react-leaflet
// The _getIconUrl property exists on the prototype but isn't in the type definitions
delete (L.Icon.Default.prototype as IconDefaultPrototype)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png"
});

interface FitBoundsProps {
  bounds: LatLngTuple[] | null;
}

function FitBounds({ bounds }: FitBoundsProps) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [bounds, map]);
  return null;
}

interface RequestWithCoords extends Request {
  coords: LatLngTuple;
}

export default function MapView() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [userLocation, setUserLocation] = useState<LatLngTuple | null>(null);
  const [mapCenter] = useState<LatLngTuple>([52.2257, -2.7389]); // Default: Leominster, UK
  const [mapZoom] = useState(13);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

  const { data: requestsData, isLoading } = useQuery({
    queryKey: queryKeys.requests(),
    queryFn: () => requestsService.list({}),
  });

  const requests: Request[] = requestsData?.data || [];

  const { data: currentUserData } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () => authService.getCurrentUser()
  });

  const currentUser: User | undefined = currentUserData?.user;

  useEffect(() => {
    // Try to use user's stored location first
    if (currentUser?.locationLat && currentUser?.locationLng) {
      const location: LatLngTuple = [currentUser.locationLat, currentUser.locationLng];
      setUserLocation(location);
      return;
    }

    // Otherwise, get current position
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: LatLngTuple = [position.coords.latitude, position.coords.longitude];
          setUserLocation(location);
        },
        () => {
          setLocationPermissionDenied(true);
        }
      );
    }
  }, [currentUser]);

  // Filter requests and ONLY show those with valid coordinates
  const requestsWithCoords: RequestWithCoords[] = useMemo(() => {
    return requests.filter((request) => {
      if (request.status !== 'ACTIVE') return false;
      if (activeCategory !== 'all' && request.category.toLowerCase() !== activeCategory) return false;
      if (!request.locationLat || !request.locationLng) return false;
      return true;
    }).map(request => ({
      ...request,
      coords: [request.locationLat!, request.locationLng!] as LatLngTuple
    }));
  }, [requests, activeCategory]);

  // Count total active requests (including those without location)
  const totalActiveRequests = requests.filter((request) => {
    if (request.status !== 'ACTIVE') return false;
    if (activeCategory !== 'all' && request.category.toLowerCase() !== activeCategory) return false;
    return true;
  }).length;

  const requestsWithoutLocation = totalActiveRequests - requestsWithCoords.length;

  // Calculate bounds that include all markers
  const mapBounds: LatLngTuple[] | null = useMemo(() => {
    const allPoints: LatLngTuple[] = [];
    
    if (userLocation) {
      allPoints.push(userLocation);
    }
    
    requestsWithCoords.forEach(request => {
      if (request.coords) {
        allPoints.push(request.coords);
      }
    });
    
    if (allPoints.length >= 2) {
      return allPoints;
    }
    
    return null;
  }, [userLocation, requestsWithCoords]);

  const categoryColors: Record<string, string> = {
    tools: brandColors[800],
    expertise: "#1976D2",
    space: "#388E3C"
  };

  const urgencyColors: Record<string, string> = {
    ASAP: "bg-red-100 text-red-800",
    TODAY: "bg-orange-100 text-orange-800",
    THIS_WEEKEND: "bg-yellow-100 text-yellow-800",
    FLEXIBLE: "bg-green-100 text-green-800"
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100">
      <DocsMobileHeader />

      {/* Header */}
      <div className="hidden lg:block bg-gradient-to-r from-brand-800 to-brand-900 text-white px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <MapPin className="w-8 h-8" />
              <h1 className="text-2xl md:text-3xl font-bold">Map View</h1>
            </div>
            <Link to={createPageUrl("Feed")}>
              <Button variant="outline" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                <List className="w-4 h-4 mr-2" />
                List View
              </Button>
            </Link>
          </div>

          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="bg-white/20 backdrop-blur-sm">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="tools">
                <Wrench className="w-4 h-4 mr-2" />
                Tools
              </TabsTrigger>
              <TabsTrigger value="expertise">
                <GraduationCap className="w-4 h-4 mr-2" />
                Expertise
              </TabsTrigger>
              <TabsTrigger value="space">
                <Warehouse className="w-4 h-4 mr-2" />
                Space
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative h-[calc(100vh-200px)]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-800" />
          </div>
        ) : (
          <MapContainerAny
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: "100%", width: "100%" }}
            className="z-0"
          >
            <TileLayerAny
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {mapBounds && <FitBounds bounds={mapBounds} />}

            {/* User Location Marker */}
            {userLocation && (
              <MarkerAny position={userLocation}>
                <PopupAny>
                  <div className="text-center">
                    <Navigation className="w-6 h-6 text-blue-500 mx-auto mb-1" />
                    <p className="font-semibold">You are here</p>
                  </div>
                </PopupAny>
              </MarkerAny>
            )}

            {/* Request Markers */}
            {requestsWithCoords.map((request) => {
              const markerIcon = new L.Icon({
                iconUrl: `data:image/svg+xml;base64,${btoa(`
                  <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="16" cy="16" r="14" fill="${categoryColors[request.category.toLowerCase()] || brandColors[800]}" opacity="0.8"/>
                    <circle cx="16" cy="16" r="8" fill="white"/>
                  </svg>
                `)}`,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
                popupAnchor: [0, -16]
              });

              return (
                <MarkerAny key={request.id} position={request.coords} icon={markerIcon}>
                  <PopupAny maxWidth={300}>
                    <div className="p-2">
                      <h3 className="font-bold text-lg mb-2">{request.title}</h3>
                      <div className="flex flex-wrap gap-1 mb-2">
                        <Badge className={urgencyColors[request.urgency]}>
                          {request.urgency.replace(/_/g, ' ')}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {request.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {request.description}
                      </p>
                      <Link to={createPageUrl(`RequestDetail?id=${request.id}`)}>
                        <Button size="sm" className="w-full bg-brand-800 hover:bg-brand-900">
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </PopupAny>
                </MarkerAny>
              );
            })}
          </MapContainerAny>
        )}

        {/* Floating Stats Card */}
        <Card className="absolute top-4 left-4 z-[1000] shadow-lg border-none max-w-xs hidden md:block">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 mb-2">
              Showing <span className="font-bold text-brand-800">{requestsWithCoords.length}</span> request{requestsWithCoords.length !== 1 ? 's' : ''} on map
            </p>
            {requestsWithoutLocation > 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded-lg mb-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>
                  {requestsWithoutLocation} request{requestsWithoutLocation !== 1 ? 's' : ''} without location {requestsWithoutLocation !== 1 ? 'are' : 'is'} hidden. View all in <Link to={createPageUrl("Feed")} className="underline font-semibold">List View</Link>.
                </p>
              </div>
            )}
            <p className="text-xs text-gray-500">
              {userLocation ? "Based on your location" : locationPermissionDenied ? "Location access denied" : "Enable location for better results"}
            </p>
          </CardContent>
        </Card>
      </div>

      <MarketingFooter />
    </div>
  );
}
