import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowLeft, 
  FileText, 
  Search, 
  Star, 
  Shield, 
  MessageSquare,
  CheckCircle2,
  Lightbulb,
  Handshake,
  AlertTriangle,
  ThumbsUp
} from "lucide-react";
import MarketingFooter from "../../components/MarketingFooter";
import SEO from "@/components/SEO";

interface GuideSection {
  icon: React.ElementType;
  title: string;
  content: string[];
  tips?: string[];
}

export default function RenterGuide(): JSX.Element {
  const navigate = useNavigate();

  const sections: GuideSection[] = [
    {
      icon: Search,
      title: "Finding What You Need",
      content: [
        "Use specific search terms for best results. 'Engine hoist 2 tonne' works better than just 'hoist'. Include brand names if you have a preference.",
        "Filter by location to find items near you. Closer items mean lower travel costs and easier coordination for pickup and return.",
        "Browse by category when you're not sure exactly what you need. Our categories are organised by use case to help you discover options.",
        "Save searches for items you regularly need. You'll be notified when new listings match your criteria.",
        "Check multiple listings before deciding. Compare rates, conditions, and included accessories to find the best value."
      ],
      tips: [
        "Search early - popular items book up quickly",
        "Consider alternatives if your first choice isn't available",
        "Look at recently added listings for fresh options",
        "Use the map view to find items in your area"
      ]
    },
    {
      icon: Star,
      title: "Reading Reviews & Ratings",
      content: [
        "A provider's overall rating tells you about their reliability, but read individual reviews for context and specific feedback.",
        "Pay attention to recent reviews over older ones. They reflect the provider's current service quality and equipment condition.",
        "Look for reviews from renters with similar needs to yours. A tool that worked for a professional might be overkill for a weekend project.",
        "Note how providers respond to any negative feedback. Professional responses to criticism show maturity and customer focus.",
        "No reviews doesn't mean bad - new providers often offer better rates. Just take extra care with verification and documentation."
      ],
      tips: [
        "4.5+ stars usually indicates reliable providers",
        "Read 3-star reviews for balanced perspectives",
        "Check if reviewers mention condition matching photos",
        "Look for repeat renters - a good sign"
      ]
    },
    {
      icon: MessageSquare,
      title: "Communicating with Providers",
      content: [
        "Be clear about your needs upfront. Explain what project you're working on and how you plan to use the equipment.",
        "Ask specific questions about condition, included items, and any quirks to expect. Good providers appreciate informed renters.",
        "Discuss logistics early: pickup/return times, location, and any flexibility needed. Agreeing these upfront prevents friction later.",
        "Keep all communication on the platform. This protects both parties and provides a record if any disputes arise.",
        "Respond promptly to messages. Providers are more likely to prioritise reliable communicators."
      ],
      tips: [
        "Introduce yourself and your experience level",
        "Ask about operating tips for unfamiliar equipment",
        "Confirm the provider's preferred contact method",
        "Request the provider's availability for questions during rental"
      ]
    },
    {
      icon: Handshake,
      title: "Safe Handoffs",
      content: [
        "Agree a specific time and place for pickup. Public locations or the provider's workshop are usually best for first-time rentals.",
        "Inspect the item thoroughly before accepting it. Test all functions, check for damage, and ensure it matches the listing description.",
        "Take timestamped photos together with the provider. Document any existing wear, scratches, or damage before you leave.",
        "Confirm you have everything: accessories, cases, cables, manuals. Check against the listing description.",
        "Get a quick demonstration if you're unfamiliar with the equipment. Good providers are happy to explain operation and safety."
      ],
      tips: [
        "Bring your phone charger for photos",
        "Allow 15-20 minutes for thorough inspection",
        "Test power tools before leaving",
        "Note any pre-existing issues in the app"
      ]
    },
    {
      icon: Shield,
      title: "During Your Rental",
      content: [
        "Use equipment as intended and within your skill level. If unsure about an operation, consult the manual or contact the provider.",
        "Store items securely when not in use. Protect from weather, theft, and accidental damage.",
        "Keep the provider informed of any issues immediately. Minor problems are easier to resolve than surprises at return.",
        "Don't make modifications or adjustments beyond normal use. This includes calibration on precision instruments.",
        "If something breaks during normal use, document it immediately and contact the provider. Accidents happen - honesty is key."
      ],
      tips: [
        "Take progress photos of your project",
        "Clean tools before returning",
        "Note any consumables you've used",
        "Keep rental items separate from your own"
      ]
    },
    {
      icon: ThumbsUp,
      title: "Returns & Reviews",
      content: [
        "Return items on time or earlier. Late returns inconvenience providers and may incur penalties.",
        "Return items in the same condition you received them. Clean equipment and repack accessories properly.",
        "Complete the return inspection together when possible. This confirms condition and triggers deposit release.",
        "Leave an honest review promptly. Mention what went well and any areas for improvement. Your feedback helps the community.",
        "If you had a great experience, consider returning to the same provider. Building relationships often leads to better rates and priority access."
      ],
      tips: [
        "Message ahead if you'll be late",
        "Keep original packaging if provided",
        "Thank providers who went above and beyond",
        "Report any safety concerns to the platform"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="Renter's Guide - How to Find & Rent Tools | SpannerWork"
        description="Complete guide to finding, renting, and returning tools on SpannerWork. Learn how to search effectively, read reviews, and save money on your projects."
        keywords="tool rental guide, how to rent tools, renting equipment tips, SpannerWork renter guide, DIY tool rental"
      />

      {/* Hero */}
      <div className="bg-gradient-to-r from-brand-800 to-brand-900 text-white px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/resources")}
            className="mb-6 text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Resources
          </Button>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold">Renter's Guide</h1>
              <p className="text-xl text-orange-100 mt-2">Find what you need and save money on your projects</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Introduction */}
        <Card className="mb-12 border-none shadow-lg bg-gradient-to-br from-orange-50 to-amber-50">
          <CardContent className="p-8">
            <div className="flex items-start gap-4">
              <Lightbulb className="w-8 h-8 text-brand-800 flex-shrink-0" />
              <div>
                <h2 className="text-xl font-bold mb-2">Why Rent Instead of Buy?</h2>
                <p className="text-gray-700">
                  Specialist tools are expensive, and many jobs only need equipment once or twice a year. 
                  Renting from SpannerWork gives you access to professional-grade equipment at a fraction 
                  of purchase cost, without the storage and maintenance headaches. Plus, you're supporting 
                  fellow mechanics in your community.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sections */}
        <div className="space-y-12">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <div key={index} className="scroll-mt-20" id={section.title.toLowerCase().replace(/\s+/g, '-')}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-brand-800 to-brand-900 rounded-xl flex items-center justify-center">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold">{section.title}</h2>
                </div>

                <div className="space-y-4 mb-6">
                  {section.content.map((paragraph, pIndex) => (
                    <p key={pIndex} className="text-gray-700 leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {section.tips && (
                  <Card className="bg-gray-50 border-gray-200">
                    <CardContent className="p-6">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        Pro Tips
                      </h4>
                      <ul className="grid md:grid-cols-2 gap-2">
                        {section.tips.map((tip, tIndex) => (
                          <li key={tIndex} className="text-sm text-gray-600 flex items-start gap-2">
                            <span className="text-brand-800 mt-1">•</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {index < sections.length - 1 && <hr className="mt-12 border-gray-200" />}
              </div>
            );
          })}
        </div>

        {/* Red Flags Warning */}
        <Card className="mt-12 bg-red-50 border-red-200">
          <CardContent className="p-8">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-bold mb-4 text-red-900">Watch Out For Red Flags</h3>
                <ul className="space-y-2 text-red-800">
                  <li>• Requests to pay outside the platform</li>
                  <li>• Listings with no photos or very blurry images</li>
                  <li>• Prices dramatically below market rate</li>
                  <li>• Providers unwilling to meet or demonstrate equipment</li>
                  <li>• Pressure to skip inspection or documentation</li>
                  <li>• Refusal to use the platform's messaging system</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <Card className="mt-12 bg-gradient-to-r from-brand-800 to-brand-900 border-none text-white">
          <CardContent className="p-12 text-center">
            <Search className="w-16 h-16 mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">Ready to Find What You Need?</h2>
            <p className="text-xl text-orange-100 mb-8">
              Browse thousands of tools, equipment, and services near you
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate("/feed")}
                size="lg"
                className="bg-white text-brand-800 hover:bg-orange-50 text-lg px-8 py-6 font-bold"
              >
                Browse Listings
              </Button>
              <Button
                onClick={() => navigate("/create?intent=need")}
                variant="outline"
                size="lg"
                className="border-white text-white hover:bg-white/10 text-lg px-8 py-6"
              >
                Post a Request
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <MarketingFooter />
    </div>
  );
}
