import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowLeft, 
  Book, 
  Camera, 
  FileText, 
  PoundSterling, 
  Star, 
  CheckCircle2,
  Lightbulb,
  TrendingUp,
  Shield,
  Calendar
} from "lucide-react";
import MarketingFooter from "../../components/MarketingFooter";
import SEO from "@/components/SEO";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsBreadcrumbs from "@/components/docs/DocsBreadcrumbs";
import DocsMobileHeader from "@/components/docs/DocsMobileHeader";

interface GuideSection {
  icon: React.ElementType;
  title: string;
  content: string[];
  tips?: string[];
}

export default function ProviderGuide(): JSX.Element {
  const navigate = useNavigate();

  const sections: GuideSection[] = [
    {
      icon: Camera,
      title: "Taking Great Photos",
      content: [
        "Quality photos are the single biggest factor in getting your listing noticed. Items with clear, well-lit photos get up to 3x more enquiries.",
        "Use natural daylight whenever possible - photograph near a window or outdoors on an overcast day for even lighting without harsh shadows.",
        "Include at least 4-5 photos: overall view, close-ups of key features, any wear or damage, brand/model labels, and the item in use if possible.",
        "Clean your equipment thoroughly before photographing. A spotless tool suggests a well-maintained item.",
        "Use a plain, uncluttered background - a white wall or workbench works well. Avoid busy backgrounds that distract from your item."
      ],
      tips: [
        "Smartphone cameras are fine - just ensure the lens is clean",
        "Show scale by including a common object nearby",
        "Photograph accessories and included items separately",
        "Update photos seasonally to keep listings fresh"
      ]
    },
    {
      icon: FileText,
      title: "Writing Compelling Descriptions",
      content: [
        "Start with the most important details: brand, model, condition, and what the tool is best used for.",
        "Be specific about specifications - power rating, size, capacity, age, and any unique features that set your item apart.",
        "Mention what's included: cases, accessories, manuals, spare parts, or consumables.",
        "Be honest about condition. Mention any wear, scratches, or quirks. Transparency builds trust and prevents disputes.",
        "Describe typical use cases to help renters understand if the item suits their needs."
      ],
      tips: [
        "Use bullet points for specifications - easy to scan",
        "Include the original purchase price for context",
        "Mention any maintenance you've done recently",
        "Add keywords renters might search for"
      ]
    },
    {
      icon: PoundSterling,
      title: "Setting Competitive Rates",
      content: [
        "Research similar listings in your area to understand market rates. Price competitively while valuing your equipment fairly.",
        "Consider offering daily, weekly, and monthly rates. Weekly rates are typically 4-5x daily; monthly rates 12-15x daily.",
        "Factor in your costs: purchase price, maintenance, insurance, and depreciation. Aim to recover costs within 12-18 months of rentals.",
        "High-demand periods (bank holidays, summer) can command premium rates. Quieter periods might benefit from discounts.",
        "New listings benefit from slightly lower introductory rates to build reviews quickly."
      ],
      tips: [
        "Offer a 10% discount for first-time renters",
        "Bundle complementary items at a reduced rate",
        "Review and adjust pricing quarterly",
        "Premium brands can command 20-30% higher rates"
      ]
    },
    {
      icon: Shield,
      title: "Protecting Your Equipment",
      content: [
        "Always request a deposit proportional to the item's value. Typically 20-50% of replacement cost is reasonable.",
        "Take timestamped photos together at handover - document the item's condition with the renter present.",
        "Verify the renter's identity. Phone-verified users are more accountable. For high-value items, request ID.",
        "Set clear terms: acceptable use, prohibited activities, return condition expectations, and late return penalties.",
        "Consider requiring proof of experience for specialist equipment like welding gear or diagnostic tools."
      ],
      tips: [
        "Create a simple handover checklist",
        "Keep serial numbers documented",
        "Check your home insurance covers rentals",
        "Start with lower-value items to vet new renters"
      ]
    },
    {
      icon: Calendar,
      title: "Managing Bookings",
      content: [
        "Keep your availability calendar updated. Nothing frustrates renters more than requesting unavailable items.",
        "Respond to enquiries promptly - within a few hours if possible. Quick responses dramatically improve conversion rates.",
        "Confirm all details in writing: pickup time, return time, location, condition expectations, and payment terms.",
        "Send a reminder message 24 hours before pickup with any last-minute instructions or location details.",
        "After return, inspect the item promptly and process the deposit return quickly to maintain good ratings."
      ],
      tips: [
        "Set realistic pickup/return windows",
        "Have a backup contact method for emergencies",
        "Block out maintenance days in your calendar",
        "Thank renters personally - it encourages reviews"
      ]
    },
    {
      icon: Star,
      title: "Building Your Reputation",
      content: [
        "Your rating is your most valuable asset. Consistently delivering great experiences builds trust and commands better rates.",
        "Go above and beyond: include helpful accessories, provide usage tips, or offer flexible pickup times.",
        "Request reviews after successful rentals. Most happy customers will leave feedback if asked politely.",
        "Respond professionally to any negative feedback. Address concerns and show you're committed to improvement.",
        "Build relationships with repeat customers. Loyalty discounts keep your equipment in regular use."
      ],
      tips: [
        "A handwritten thank-you note makes an impression",
        "Share your expertise - renters appreciate tips",
        "Cross-promote complementary items you list",
        "Join local maker/DIY communities for referrals"
      ]
    }
  ];

  return (
    <>
      <DocsMobileHeader />
      <div className="min-h-screen bg-white">
        <SEO
          title="Provider's Guide - How to List Tools & Earn Money | SpannerWork"
          description="Complete guide to listing tools, setting rates, and maximising earnings on SpannerWork. Learn photography tips, pricing strategies, and how to build your reputation."
          keywords="tool rental provider guide, how to list tools, tool rental tips, earn money renting tools, SpannerWork provider"
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
              <Book className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold">Provider's Guide</h1>
              <p className="text-xl text-orange-100 mt-2">Everything you need to succeed as a SpannerWork provider</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <DocsBreadcrumbs />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="lg:flex lg:gap-8">
          <div className="hidden lg:block w-[280px] flex-none">
            <DocsSidebar />
          </div>

          <div className="min-w-0 flex-1">
            {/* Introduction */}
        <Card className="mb-12 border-none shadow-lg bg-gradient-to-br from-orange-50 to-amber-50">
          <CardContent className="p-8">
            <div className="flex items-start gap-4">
              <Lightbulb className="w-8 h-8 text-brand-800 flex-shrink-0" />
              <div>
                <h2 className="text-xl font-bold mb-2">Why Become a Provider?</h2>
                <p className="text-gray-700">
                  Your tools spend most of their time sitting idle. SpannerWork lets you turn that 
                  downtime into income while helping fellow mechanics and DIY enthusiasts complete 
                  their projects. Whether you have specialist diagnostic equipment, rarely-used 
                  power tools, or professional-grade kit, there's demand in your area.
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

        {/* Getting Started CTA */}
        <Card className="mt-16 bg-gradient-to-r from-brand-800 to-brand-900 border-none text-white">
          <CardContent className="p-12 text-center">
            <TrendingUp className="w-16 h-16 mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">Ready to Start Earning?</h2>
            <p className="text-xl text-orange-100 mb-8">
              List your first item in under 5 minutes
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate("/create?intent=offer")}
                size="lg"
                className="bg-white text-brand-800 hover:bg-orange-50 text-lg px-8 py-6 font-bold"
              >
                Create Your First Listing
              </Button>
              <Button
                onClick={() => navigate("/pricing")}
                variant="outline"
                size="lg"
                className="bg-white/10 border-white/40 text-white hover:bg-white/20 hover:text-white text-lg px-8 py-6"
              >
                View Pricing Guide
              </Button>
            </div>
          </CardContent>
        </Card>
          </div>
        </div>
      </div>

      <MarketingFooter />
      </div>
    </>
  );
}
