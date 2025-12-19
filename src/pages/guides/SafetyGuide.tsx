import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowLeft, 
  Shield, 
  Camera, 
  UserCheck, 
  MapPin, 
  CheckCircle2,
  AlertTriangle,
  Lock,
  FileText,
  Phone,
  Eye,
  Ban,
  Siren
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
  checklist?: string[];
}

export default function SafetyGuide(): JSX.Element {
  const navigate = useNavigate();

  const sections: GuideSection[] = [
    {
      icon: UserCheck,
      title: "Verification & Identity",
      content: [
        "Always verify the identity of the person you're dealing with. Phone-verified users have proven they have access to a real phone number.",
        "For high-value items (£500+), consider requesting government ID at the handover. A trustworthy person won't mind this reasonable precaution.",
        "Check the user's profile completeness. Users with photos, bios, and verified details are more accountable than anonymous accounts.",
        "Review their transaction history and ratings. A track record of successful rentals is the best indicator of reliability.",
        "Be cautious with brand new accounts for expensive equipment. There's nothing wrong with new users, but take extra precautions."
      ],
      checklist: [
        "Phone verification confirmed",
        "Profile photo uploaded",
        "Reviews from previous transactions",
        "Responsive to messages",
        "Willing to meet in person"
      ]
    },
    {
      icon: Camera,
      title: "Photo Documentation",
      content: [
        "Photos are your protection. Take detailed, timestamped images at every handover - both pickup and return.",
        "Document all angles: overall condition, close-ups of any existing damage, serial numbers, and included accessories.",
        "Take photos together with the other party present. This creates a shared understanding of condition.",
        "Include something in the photo that proves the date - a newspaper, phone screen with date visible, or the SpannerWork app open.",
        "Store photos securely and keep them for at least 30 days after the transaction completes. Cloud backup is ideal."
      ],
      checklist: [
        "Overall condition shot",
        "Close-ups of any wear/damage",
        "Serial number/model label",
        "All accessories included",
        "Date/time proof in frame",
        "Both parties present/acknowledged"
      ]
    },
    {
      icon: MapPin,
      title: "Meeting Safely",
      content: [
        "For first-time transactions, meet in public places when possible. Busy car parks, petrol stations, or community centres work well.",
        "If meeting at a private address, let someone know where you're going, who you're meeting, and when to expect you back.",
        "Daytime meetings are preferable. If evening is unavoidable, choose well-lit, populated locations.",
        "Trust your instincts. If something feels wrong about a meeting, reschedule or cancel. Your safety isn't worth any rental fee.",
        "Consider bringing a friend for high-value transactions. Two people provide both safety and a witness."
      ],
      checklist: [
        "Meeting location agreed in advance",
        "Someone knows your whereabouts",
        "Meeting during daylight hours",
        "Phone fully charged",
        "Easy exit route available"
      ]
    },
    {
      icon: Lock,
      title: "Secure Transactions",
      content: [
        "Always use SpannerWork's payment system. It holds funds securely and protects both parties from fraud.",
        "Never accept requests to pay outside the platform - cash, bank transfer, or third-party payment apps bypass our protections.",
        "Deposits should be agreed through the platform and documented. Don't hand over cash deposits without proper recording.",
        "If a deal seems too good to be true, it probably is. Extremely low prices often indicate scams or misrepresented items.",
        "Keep all communication on the platform. This creates a record that can help resolve any disputes."
      ],
      checklist: [
        "Payment through SpannerWork only",
        "Deposit amount agreed in writing",
        "All terms documented in messages",
        "Receipt/confirmation received",
        "No pressure to bypass platform"
      ]
    },
    {
      icon: FileText,
      title: "Clear Agreements",
      content: [
        "Document everything in writing before the rental begins: duration, rates, deposit, pickup/return times, and condition expectations.",
        "Be explicit about acceptable use. If there are restrictions (no commercial use, experience required), state them clearly.",
        "Agree late return policies upfront. What's the daily rate if someone needs extra time? At what point does it become a problem?",
        "Discuss damage scenarios. What happens if something breaks? What constitutes 'normal wear' versus 'damage'?",
        "Both parties should acknowledge the agreement. A simple 'confirmed' message creates mutual understanding."
      ],
      checklist: [
        "Rental duration confirmed",
        "Total cost including deposit",
        "Pickup and return times",
        "Condition expectations",
        "Late return policy",
        "Damage liability terms"
      ]
    },
    {
      icon: Siren,
      title: "If Things Go Wrong",
      content: [
        "Stay calm and communicate. Most issues are misunderstandings that can be resolved through clear, professional dialogue.",
        "Document everything. If there's a dispute, photos, messages, and written agreements are your evidence.",
        "Use SpannerWork's dispute resolution process. Our team reviews evidence and helps mediate fair outcomes.",
        "For criminal matters (theft, assault, fraud), contact the police immediately and then inform SpannerWork.",
        "Leave honest reviews about your experience. This helps the community avoid problematic users."
      ],
      checklist: [
        "Document the issue with photos/screenshots",
        "Keep all communication written",
        "Report through the platform",
        "Contact police if criminal",
        "Don't retaliate or escalate"
      ]
    }
  ];

  const redFlags = [
    { flag: "Requests to communicate off-platform", why: "Avoids our protections and creates no evidence trail" },
    { flag: "Pressure to pay in cash or bank transfer", why: "Bypasses payment protection; funds are unrecoverable" },
    { flag: "Refuses to meet or show ID for valuable items", why: "May be using fake identity or stolen equipment" },
    { flag: "Significantly underpriced listings", why: "Often bait for scams or misrepresented items" },
    { flag: "New account with no verification", why: "No accountability; easy to create and abandon" },
    { flag: "Unwilling to provide photos or documentation", why: "May be hiding damage or misrepresenting condition" },
    { flag: "Creates artificial urgency", why: "Pressure tactics prevent careful consideration" },
    { flag: "Requests personal information beyond necessary", why: "May be identity theft or phishing attempt" }
  ];

  return (
    <>
      <DocsMobileHeader />
      <div className="min-h-screen bg-white">
        <SEO
          title="Safety Best Practices - Stay Safe on SpannerWork"
          description="Comprehensive safety guide for SpannerWork users. Learn verification tips, photo documentation, safe meeting practices, and how to protect yourself and your equipment."
          keywords="tool rental safety, SpannerWork safety guide, peer to peer rental safety, equipment rental protection"
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
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold">Safety Best Practices</h1>
              <p className="text-xl text-orange-100 mt-2">Protect yourself, your equipment, and your community</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <DocsBreadcrumbs />
        </div>
      </div>

      {/* Trust Banner */}
      <div className="bg-green-50 border-b border-green-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            <p className="text-green-800 font-medium">
              Follow these guidelines to help ensure safe, successful transactions for everyone.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="lg:flex lg:gap-8">
          <div className="hidden lg:block w-[280px] flex-none">
            <DocsSidebar />
          </div>

          <div className="min-w-0 flex-1">
            {/* Quick Safety Checklist */}
        <Card className="mb-12 border-none shadow-lg bg-gradient-to-br from-orange-50 to-amber-50">
          <CardContent className="p-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Eye className="w-6 h-6 text-brand-800" />
              Quick Safety Checklist
            </h2>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                "Verify user identity and ratings",
                "Document condition with photos",
                "Meet in safe, public locations",
                "Use platform payments only",
                "Keep all communication in-app",
                "Trust your instincts",
                "Report suspicious behaviour",
                "Review terms before agreeing"
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">{item}</span>
                </div>
              ))}
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

                {section.checklist && (
                  <Card className="bg-gray-50 border-gray-200">
                    <CardContent className="p-6">
                      <h4 className="font-semibold text-gray-900 mb-3">Checklist</h4>
                      <div className="grid md:grid-cols-2 gap-2">
                        {section.checklist.map((item, cIndex) => (
                          <div key={cIndex} className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded border-2 border-gray-300 flex items-center justify-center">
                              <CheckCircle2 className="w-4 h-4 text-gray-400" />
                            </div>
                            <span className="text-sm text-gray-600">{item}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {index < sections.length - 1 && <hr className="mt-12 border-gray-200" />}
              </div>
            );
          })}
        </div>

        {/* Red Flags Section */}
        <Card className="mt-12 bg-red-50 border-red-200">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              <h3 className="text-2xl font-bold text-red-900">Red Flags to Watch For</h3>
            </div>
            <div className="space-y-4">
              {redFlags.map((item, index) => (
                <div key={index} className="flex items-start gap-3">
                  <Ban className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900">{item.flag}</p>
                    <p className="text-sm text-red-700">{item.why}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card className="mt-8 border-amber-200 bg-amber-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Phone className="w-8 h-8 text-amber-700" />
              <div>
                <h4 className="font-bold text-amber-900">Need Help?</h4>
                <p className="text-amber-800">
                  If you experience suspicious behaviour or feel unsafe, contact our support team immediately 
                  through the app, or email safety@spannerwork.co.uk. For emergencies, always call 999.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <Card className="mt-12 bg-gradient-to-r from-brand-800 to-brand-900 border-none text-white">
          <CardContent className="p-12 text-center">
            <Shield className="w-16 h-16 mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">Stay Safe, Trade with Confidence</h2>
            <p className="text-xl text-orange-100 mb-8">
              Our community thrives on trust. Thank you for doing your part.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate("/feed")}
                size="lg"
                className="bg-white text-brand-800 hover:bg-orange-50 text-lg px-8 py-6 font-bold"
              >
                Browse Safely
              </Button>
              <Button
                onClick={() => navigate("/contact")}
                variant="outline"
                size="lg"
                className="bg-white/10 border-white/40 text-white hover:bg-white/20 hover:text-white text-lg px-8 py-6"
              >
                Contact Support
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
