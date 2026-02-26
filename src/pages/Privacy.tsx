import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Shield, Lock, Eye, Database, Mail, UserX, LucideIcon } from "lucide-react";
import MarketingFooter from "../components/MarketingFooter";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsBreadcrumbs from "@/components/docs/DocsBreadcrumbs";
import DocsMobileHeader from "@/components/docs/DocsMobileHeader";
import SEO from "@/components/SEO";

interface Subsection {
  subtitle: string;
  items: string[];
}

interface Section {
  title: string;
  icon?: LucideIcon;
  content?: string;
  items?: string[];
  subsections?: Subsection[];
  footer?: string;
}

export default function Privacy() {
  const navigate = useNavigate();

  const sections: Section[] = [
    {
      title: "1. Information We Collect",
      icon: Database,
      subsections: [
        {
          subtitle: "Account Information:",
          items: [
            "Name, email address, phone number",
            "Profile photo and bio",
            "Location (city/postcode for matching nearby users)",
            "Verification documents (for identity and insurance verification)"
          ]
        },
        {
          subtitle: "Transaction Information:",
          items: [
            "Tool listings, photos, and descriptions",
            "Job requests and quotes",
            "Messages between users",
            "Transaction history and payment details",
            "Reviews and ratings"
          ]
        },
        {
          subtitle: "Automatically Collected Information:",
          items: [
            "Device information (browser, OS, IP address)",
            "Usage data (pages visited, features used)",
            "Cookies and similar tracking technologies"
          ]
        }
      ]
    },
    {
      title: "2. How We Use Your Information",
      icon: Eye,
      items: [
        "Provide and improve our platform services",
        "Match job seekers with local providers",
        "Process payments and transactions",
        "Send important updates about your account and transactions",
        "Verify user identity and prevent fraud",
        "Personalize your experience on the platform",
        "Send marketing communications (with your consent)",
        "Analyze usage patterns to improve our service",
        "Comply with legal obligations"
      ]
    },
    {
      title: "3. Information Sharing",
      icon: Lock,
      content: "We do not sell your personal information. We may share your information in the following situations:",
      items: [
        "With other users: Your profile, listings, and reviews are visible to other platform users",
        "With service providers: Payment processors, email services, and hosting providers",
        "For legal reasons: To comply with laws, regulations, or valid legal processes",
        "Business transfers: In connection with a merger, acquisition, or sale of assets",
        "With your consent: When you explicitly authorize us to share your information"
      ]
    },
    {
      title: "4. Data Security",
      icon: Shield,
      content: "We implement appropriate security measures to protect your information:",
      items: [
        "Encrypted data transmission (SSL/TLS)",
        "Secure password storage with encryption",
        "Regular security audits and updates",
        "Limited employee access to personal data",
        "Secure payment processing through trusted providers"
      ],
      footer: "However, no method of transmission over the internet is 100% secure. While we strive to protect your data, we cannot guarantee absolute security."
    },
    {
      title: "5. Your Rights and Choices",
      icon: UserX,
      items: [
        "Access: Request a copy of your personal data",
        "Correction: Update inaccurate or incomplete information",
        "Deletion: Request deletion of your account and data (subject to legal retention requirements)",
        "Objection: Opt out of marketing communications",
        "Portability: Request your data in a machine-readable format",
        "Restriction: Request limitation of data processing in certain circumstances"
      ],
      footer: "To exercise these rights, contact us at support@spannerwork.co.uk"
    },
    {
      title: "6. Cookies and Tracking",
      icon: Eye,
      content: "We use cookies and similar technologies to:",
      items: [
        "Keep you logged in",
        "Remember your preferences",
        "Analyze how you use our platform",
        "Provide relevant advertising (with consent)"
      ],
      footer: "You can control cookies through your browser settings. For more details, see our Cookie Policy."
    },
    {
      title: "7. Data Retention",
      content: "We retain your personal information for as long as necessary to:",
      items: [
        "Provide our services to you",
        "Comply with legal obligations (e.g., tax records, transaction history)",
        "Resolve disputes and enforce our agreements",
        "Prevent fraud and abuse"
      ],
      footer: "After account deletion, we may retain certain information for legal and security purposes for up to 7 years."
    },
    {
      title: "8. Children's Privacy",
      content: "SpannerWork is not intended for users under 18 years old. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us immediately."
    },
    {
      title: "9. International Data Transfers",
      content: "Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your data in accordance with this privacy policy and applicable laws."
    },
    {
      title: "10. Third-Party Links",
      content: "Our platform may contain links to third-party websites. We are not responsible for the privacy practices of these external sites. We encourage you to review their privacy policies."
    },
    {
      title: "11. Changes to This Policy",
      content: "We may update this privacy policy from time to time. We will notify you of significant changes via email or platform notification. Continued use of SpannerWork after changes constitutes acceptance of the updated policy."
    },
    {
      title: "12. Contact Us",
      icon: Mail,
      content: "If you have questions or concerns about this privacy policy or our data practices, please contact us:",
      items: [
        "Email: support@spannerwork.co.uk",
        "Contact Form: Available on our Contact page",
        "Response Time: We aim to respond within 48 hours"
      ]
    }
  ];

  return (
    <>
      <SEO
        title="Privacy Policy - SpannerWork"
        description="Read SpannerWork's privacy policy. Learn how we collect, use, and protect your personal data when using our tool rental and mechanic services platform."
        keywords="privacy policy, data protection, GDPR, personal data, spannerwork"
      />
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
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-brand-100">Last updated: January 2025</p>
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
            <Card className="border-none shadow-lg mb-8 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Shield className="w-8 h-8 text-brand-800 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg mb-2">Your Privacy Matters</h3>
                <p className="text-gray-700">
                  At SpannerWork, we take your privacy seriously. This policy explains how we collect, 
                  use, and protect your personal information. By using our platform, you agree to the 
                  practices described in this policy.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-8">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <Card key={index} className="border-none shadow-lg">
                <CardContent className="p-8">
                  <div className="flex items-start gap-4 mb-4">
                    {Icon && (
                      <div className="w-12 h-12 bg-gradient-to-br from-brand-800 to-brand-900 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <h2 className="text-2xl font-bold text-gray-900 flex-1">{section.title}</h2>
                  </div>
                  
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
            );
          })}
        </div>

            <Card className="mt-12 border-2 border-brand-800">
              <CardContent className="p-8 text-center">
                <h3 className="text-xl font-bold mb-4">Questions About Your Privacy?</h3>
                <p className="text-gray-600 mb-6">We're committed to transparency and protecting your data</p>
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={() => navigate(createPageUrl("Contact"))}
                    className="bg-brand-800 hover:bg-brand-900"
                  >
                    Contact Us
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate(createPageUrl("Cookies"))}
                  >
                    Cookie Policy
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
