import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import MarketingFooter from "../components/MarketingFooter";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsBreadcrumbs from "@/components/docs/DocsBreadcrumbs";
import DocsMobileHeader from "@/components/docs/DocsMobileHeader";

interface Subsection {
  subtitle: string;
  items: string[];
}

interface Section {
  title: string;
  content?: string;
  items?: string[];
  subsections?: Subsection[];
  footer?: string;
}

export default function Terms() {
  const navigate = useNavigate();

  const sections: Section[] = [
    {
      title: "1. Acceptance of Terms",
      content: "By accessing and using SpannerWork, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree with these terms, please do not use our service."
    },
    {
      title: "2. Use of Service",
      content: "SpannerWork provides a platform connecting people who need tools, expertise, or workspace with those who can provide them. You must be 18 years or older to use this service. By registering, you confirm that all information provided is accurate and complete."
    },
    {
      title: "3. User Responsibilities",
      subsections: [
        {
          subtitle: "For Providers (Tool Owners/Service Providers):",
          items: [
            "Accurately represent the condition and capabilities of listed items",
            "Maintain items in safe, working condition before each rental",
            "Honor agreed-upon rates, terms, and availability",
            "Return deposits promptly when items are returned undamaged",
            "Respond to inquiries within 24 hours",
            "Ensure proper insurance coverage for high-value items"
          ]
        },
        {
          subtitle: "For Renters/Service Seekers:",
          items: [
            "Use items responsibly and only as intended",
            "Return items on time and in the same condition as received",
            "Pay agreed-upon rates promptly through the platform",
            "Report any damage or issues immediately",
            "Take photos of items at pickup and return",
            "Treat borrowed items with care as if they were your own"
          ]
        }
      ]
    },
    {
      title: "4. Payments and Fees",
      content: "SpannerWork charges a 10% service fee on completed transactions to providers. For the first 3 months after registration, this fee is waived as an introductory offer. Renters pay no platform fees. All payments are processed securely through our payment processor. Funds are held in escrow until transaction completion.",
      items: [
        "Providers receive payment after successful transaction completion",
        "Deposits are refunded to renters upon item return in good condition",
        "Disputes may delay payment release pending resolution",
        "Platform fees are non-refundable once a transaction is completed"
      ]
    },
    {
      title: "5. Insurance and Liability",
      content: "SpannerWork is a platform connecting users. We are not a party to transactions between users. Important liability information:",
      items: [
        "Providers are responsible for insuring their own equipment",
        "Renters are liable for damage to borrowed items beyond normal wear and tear",
        "Personal injury during tool use is the responsibility of the user",
        "SpannerWork is not liable for the quality, condition, or safety of listed items",
        "SpannerWork is not liable for disputes between users",
        "Users should maintain appropriate insurance coverage"
      ],
      footer: "We strongly recommend providers obtain proper insurance for valuable equipment and renters have appropriate liability coverage."
    },
    {
      title: "6. Deposits and Refunds",
      content: "Providers may require refundable deposits to protect their equipment. Deposit terms:",
      items: [
        "Deposits are held securely by SpannerWork during rental period",
        "Deposits are refunded within 48 hours of successful item return",
        "Providers may claim all or part of deposit for damage beyond normal wear",
        "Disputes over deposit refunds are subject to our resolution process",
        "Photo evidence is required to withhold deposit funds"
      ]
    },
    {
      title: "7. Dispute Resolution",
      content: "If a dispute arises between users, SpannerWork will mediate based on:",
      items: [
        "Photos taken at pickup and return",
        "Agreed-upon terms documented in the transaction",
        "Communication history between parties",
        "User reviews and reputation scores"
      ],
      footer: "Our decisions aim to be fair but are not legally binding arbitration. Users may pursue legal remedies independently."
    },
    {
      title: "8. Prohibited Conduct",
      content: "Users may not:",
      items: [
        "Post false or misleading information about items or services",
        "Engage in fraudulent activities or scams",
        "Harass, threaten, or abuse other users",
        "Circumvent platform fees by conducting transactions off-platform",
        "Use the platform for illegal purposes",
        "List stolen or illegally obtained items",
        "Discriminate against users based on protected characteristics",
        "Create multiple accounts to manipulate reviews or reputation"
      ]
    },
    {
      title: "9. Account Suspension and Termination",
      content: "We reserve the right to suspend or terminate accounts that:",
      items: [
        "Violate these terms of service",
        "Engage in prohibited conduct",
        "Receive multiple negative reviews or complaints",
        "Fail to complete transactions or respond to communications",
        "Commit fraud or provide false information"
      ],
      footer: "Suspended users will be notified and may appeal the decision. Terminated accounts forfeit any pending payments or deposits subject to dispute resolution."
    },
    {
      title: "10. Platform Modifications",
      content: "SpannerWork reserves the right to modify, suspend, or discontinue any aspect of the service at any time. We will provide reasonable notice of significant changes affecting user transactions."
    },
    {
      title: "11. Intellectual Property",
      content: "All content on SpannerWork, including logos, design, and software, is owned by SpannerWork. Users grant us a license to use photos and content they upload for platform operation and promotion."
    },
    {
      title: "12. Privacy and Data",
      content: "Your use of SpannerWork is also governed by our Privacy Policy. We collect and use personal information as described in that policy. By using our service, you consent to such collection and use."
    },
    {
      title: "13. Limitation of Liability",
      content: "To the maximum extent permitted by law, SpannerWork is not liable for indirect, incidental, special, or consequential damages arising from use of the platform. Our total liability for any claim is limited to the amount of fees paid by the user in the previous 12 months."
    },
    {
      title: "14. Changes to Terms",
      content: "We may update these terms from time to time. Material changes will be communicated via email or platform notification. Continued use of the service after changes constitutes acceptance of updated terms."
    },
    {
      title: "15. Governing Law",
      content: "These terms are governed by the laws of England and Wales. Any disputes shall be resolved in the courts of England and Wales."
    },
    {
      title: "16. Contact",
      content: "Questions about these terms? Contact us at support@spannerwork.co.uk or through our contact page."
    }
  ];

  return (
    <>
      <DocsMobileHeader />
      <div className="min-h-screen bg-white">
        <div className="bg-gradient-to-r from-brand-800 to-brand-900 text-white px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl("Home"))}
            className="mb-6 text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
          <p className="text-orange-100">Last updated: January 2025</p>
        </div>
      </div>

      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <DocsBreadcrumbs />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="lg:flex lg:gap-8">
          <div className="hidden lg:block w-[280px] flex-none">
            <DocsSidebar />
          </div>

          <div className="min-w-0 flex-1">
            <Card className="border-none shadow-lg mb-8 bg-orange-50">
          <CardContent className="p-6">
            <p className="text-gray-700">
              <strong>Important:</strong> Please read these terms carefully before using SpannerWork. 
              By creating an account or using our service, you agree to be bound by these terms. 
              If you have questions, contact us at support@spannerwork.co.uk
            </p>
          </CardContent>
        </Card>

        <div className="space-y-8">
          {sections.map((section, index) => (
            <Card key={index} className="border-none shadow-lg">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{section.title}</h2>
                
                {section.content && (
                  <p className="text-gray-700 leading-relaxed mb-4">{section.content}</p>
                )}
                
                {section.items && (
                  <ul className="space-y-3 mb-4">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-brand-800 rounded-full mt-2 flex-shrink-0" />
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {section.subsections && (
                  <div className="space-y-6">
                    {section.subsections.map((subsection, i) => (
                      <div key={i}>
                        <h3 className="font-semibold text-lg text-gray-900 mb-3">{subsection.subtitle}</h3>
                        <ul className="space-y-3">
                          {subsection.items.map((item, j) => (
                            <li key={j} className="flex items-start gap-3">
                              <div className="w-2 h-2 bg-brand-800 rounded-full mt-2 flex-shrink-0" />
                              <span className="text-gray-700">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {section.footer && (
                  <p className="text-gray-700 leading-relaxed mt-4 italic bg-gray-50 p-4 rounded-lg border-l-4 border-brand-800">
                    {section.footer}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

            <Card className="mt-12 border-2 border-brand-800">
              <CardContent className="p-8 text-center">
                <h3 className="text-xl font-bold mb-4">Questions About These Terms?</h3>
                <p className="text-gray-600 mb-6">We're happy to clarify anything you're unsure about</p>
                <Button
                  onClick={() => navigate(createPageUrl("Contact"))}
                  className="bg-brand-800 hover:bg-brand-900"
                >
                  Contact Us
                </Button>
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
