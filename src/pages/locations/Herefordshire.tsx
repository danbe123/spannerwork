import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import MarketingFooter from "@/components/MarketingFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Wrench,
  Warehouse,
  GraduationCap,
  MapPin,
  Star,
  CheckCircle,
  ArrowRight,
  Shield,
  Users
} from "lucide-react";

const localAreas = [
  "Hereford", "Ross-on-Wye", "Leominster", "Ledbury", "Bromyard",
  "Kington", "Hay-on-Wye", "Weobley", "Eardisley", "Pembridge"
];

const popularServices = [
  { name: "Car Diagnostic Scans", price: "from £25" },
  { name: "Brake Pad Replacement", price: "from £80" },
  { name: "Oil Change Service", price: "from £45" },
  { name: "MOT Preparation", price: "from £60" },
  { name: "Clutch Replacement", price: "from £200" },
  { name: "Suspension Work", price: "from £100" }
];

export default function HerefordshireLocation() {
  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="Tool Rental, Mechanics & Workshop Space in Herefordshire | SpannerWork"
        description="Find local tool rentals, skilled mechanics, and workshop space in Herefordshire. Serving Hereford, Ross-on-Wye, Leominster, Ledbury and surrounding areas. Book online today."
        keywords="tool rental Herefordshire, mechanic Hereford, workshop space Herefordshire, garage rental Ross-on-Wye, car repair Leominster, mobile mechanic Ledbury, automotive tools Herefordshire"
        schema={[
          {
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "name": "SpannerWork Herefordshire",
            "description": "Tool rentals, mechanic services, and workshop space in Herefordshire",
            "url": "https://www.spannerwork.co.uk/locations/herefordshire",
            "address": {
              "@type": "PostalAddress",
              "addressRegion": "Herefordshire",
              "addressCountry": "UK"
            },
            "geo": {
              "@type": "GeoCoordinates",
              "latitude": "52.0565",
              "longitude": "-2.7164"
            },
            "areaServed": {
              "@type": "State",
              "name": "Herefordshire"
            },
            "priceRange": "£10-£100"
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.spannerwork.co.uk/" },
              { "@type": "ListItem", "position": 2, "name": "Locations", "item": "https://www.spannerwork.co.uk/locations" },
              { "@type": "ListItem", "position": 3, "name": "Herefordshire", "item": "https://www.spannerwork.co.uk/locations/herefordshire" }
            ]
          }
        ]}
      />

      {/* Breadcrumbs */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Breadcrumbs items={[
            { label: "Locations", href: "/locations" },
            { label: "Herefordshire" }
          ]} />
        </div>
      </div>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-brand-800 via-brand-900 to-[#A52A14] py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <Badge className="bg-white/20 text-white border-white/30 mb-6">
              <MapPin className="w-4 h-4 mr-1" /> Herefordshire
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Tool Rental, Mechanics & Workshop Space in <span className="text-[#FFC107]">Herefordshire</span>
            </h1>
            <p className="text-xl md:text-2xl text-brand-100 mb-8">
              Your local marketplace for automotive tools, skilled mechanics, and workshop space. Serving Hereford, Ross-on-Wye, Leominster and beyond.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-white text-brand-800 hover:bg-brand-50 font-bold">
                <Link to="/feed?location=Herefordshire">
                  Browse Local Listings
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-brand-800">
                <Link to="/profile">List Your Services</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-8 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-brand-800">50+</p>
              <p className="text-gray-600">Local Providers</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-brand-800">4.8</p>
              <p className="text-gray-600">Average Rating</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-brand-800">£10</p>
              <p className="text-gray-600">Starting From</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-brand-800">24hr</p>
              <p className="text-gray-600">Avg Response</p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
            What's Available in Herefordshire
          </h2>
          <p className="text-xl text-gray-600 text-center mb-12 max-w-3xl mx-auto">
            Connect with local providers offering tools, expertise, and workspace for your automotive projects
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Tools */}
            <Card className="border-none shadow-xl hover:shadow-2xl transition-shadow">
              <div className="h-2 bg-gradient-to-r from-brand-500 to-red-500" />
              <CardContent className="p-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-red-500 flex items-center justify-center mb-6">
                  <Wrench className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Tool Rental</h3>
                <p className="text-gray-600 mb-4">
                  Rent professional automotive tools from local owners. Car lifts, diagnostic scanners, air compressors, and specialty equipment.
                </p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    From £10/day
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Local pickup or delivery
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Verified owners
                  </li>
                </ul>
                <Button asChild className="w-full bg-brand-800 hover:bg-brand-900">
                  <Link to="/feed?category=TOOLS&location=Herefordshire">
                    Browse Tools
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Mechanics */}
            <Card className="border-none shadow-xl hover:shadow-2xl transition-shadow">
              <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <CardContent className="p-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center mb-6">
                  <GraduationCap className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Local Mechanics</h3>
                <p className="text-gray-600 mb-4">
                  Hire skilled mechanics in Herefordshire for hands-on help, consultations, or full repairs. Mobile and workshop-based.
                </p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    From £30/hour
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Ratings & reviews
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Mobile service available
                  </li>
                </ul>
                <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                  <Link to="/feed?category=EXPERTISE&location=Herefordshire">
                    Find Mechanics
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Workshop Space */}
            <Card className="border-none shadow-xl hover:shadow-2xl transition-shadow">
              <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-500" />
              <CardContent className="p-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-6">
                  <Warehouse className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Workshop Space</h3>
                <p className="text-gray-600 mb-4">
                  Rent garages and workshops with lifts, bays, and equipment. Perfect for big projects or weekend wrenching.
                </p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    From £40/day
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Lifts & equipment included
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Secure locations
                  </li>
                </ul>
                <Button asChild className="w-full bg-purple-600 hover:bg-purple-700">
                  <Link to="/feed?category=SPACE&location=Herefordshire">
                    Find Space
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Areas Served */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Areas We Serve in Herefordshire
          </h2>
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {localAreas.map((area) => (
              <Link
                key={area}
                to={`/feed?location=${encodeURIComponent(area)}`}
                className="px-4 py-2 bg-white rounded-full shadow-md hover:shadow-lg transition-shadow text-gray-700 hover:text-brand-800 font-medium"
              >
                {area}
              </Link>
            ))}
          </div>
          <p className="text-center text-gray-600">
            Can't find your area? <Link to="/feed" className="text-brand-800 underline font-medium">Search all listings</Link> or <Link to="/contact" className="text-brand-800 underline font-medium">contact us</Link>
          </p>
        </div>
      </section>

      {/* Popular Services */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Popular Services in Herefordshire
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {popularServices.map((service) => (
              <Card key={service.name} className="border-none shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-5 flex items-center justify-between">
                  <span className="font-medium text-gray-900">{service.name}</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {service.price}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">
            Why Choose SpannerWork in Herefordshire
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-brand-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-brand-800" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Local First</h3>
              <p className="text-gray-600 text-sm">Support local providers and reduce travel time</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Verified Reviews</h3>
              <p className="text-gray-600 text-sm">Real ratings from real customers</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Secure Payments</h3>
              <p className="text-gray-600 text-sm">Protected transactions on every booking</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Community</h3>
              <p className="text-gray-600 text-sm">Join Herefordshire's growing maker community</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-brand-800 to-brand-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Get Started in Herefordshire?
          </h2>
          <p className="text-xl text-brand-100 mb-8">
            Join the local marketplace for tools, mechanics, and workshop space
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-white text-brand-800 hover:bg-brand-50 font-bold">
              <Link to="/feed?location=Herefordshire">
                Browse Listings
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button asChild size="lg" className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-gray-900">
              <Link to="/profile">Sign Up Free</Link>
            </Button>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
