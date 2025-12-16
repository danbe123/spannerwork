import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Cookie } from "lucide-react";
import MarketingFooter from "../components/MarketingFooter";

interface Subsection {
  subtitle: string;
  content?: string;
  items: string[];
}

interface Section {
  title: string;
  content?: string;
  items?: string[];
  subsections?: Subsection[];
}

export default function Cookies() {
  const navigate = useNavigate();

  const sections: Section[] = [
    {
      title: "1. What Are Cookies?",
      content: "Cookies are small text files that are placed on your device when you visit a website. They help websites remember your preferences and improve your experience."
    },
    {
      title: "2. How We Use Cookies",
      subsections: [
        {
          subtitle: "Necessary Cookies",
          content: "These cookies are essential for the website to function properly. They enable core functionality such as:",
          items: [
            "Keeping you logged in as you navigate the site",
            "Remembering your privacy preferences",
            "Securing your connection",
            "Enabling basic site features"
          ]
        },
        {
          subtitle: "Analytics Cookies",
          content: "These cookies help us understand how visitors use our website. They collect information about:",
          items: [
            "Which pages you visit most often",
            "How long you spend on each page",
            "Any error messages you receive",
            "How you found our website"
          ]
        },
        {
          subtitle: "Marketing Cookies",
          content: "These cookies track your online activity to help us show you relevant content and ads:",
          items: [
            "Remember your interests based on your browsing",
            "Show you personalized job recommendations",
            "Track conversion from our marketing campaigns",
            "Limit the number of times you see an ad"
          ]
        }
      ]
    },
    {
      title: "3. Third-Party Cookies",
      content: "We may use third-party services that set their own cookies:",
      items: [
        "Google Analytics - to understand how users interact with our site",
        "Payment processors - to securely handle transactions",
        "Social media platforms - if you choose to share content"
      ]
    },
    {
      title: "4. Managing Cookies",
      content: "You have full control over your cookie preferences:",
      items: [
        "Accept or reject cookies through our cookie banner",
        "Change your preferences at any time",
        "Use your browser settings to block or delete cookies",
        "Note: Blocking necessary cookies may affect site functionality"
      ]
    },
    {
      title: "5. Cookie Duration",
      content: "Different cookies stay on your device for different lengths of time:",
      items: [
        "Session cookies - deleted when you close your browser",
        "Persistent cookies - stay on your device for a set period (up to 12 months)",
        "You can delete cookies manually through your browser at any time"
      ]
    },
    {
      title: "6. Browser Controls",
      content: "Most browsers allow you to control cookies through their settings. You can usually find these settings in the 'options' or 'preferences' menu of your browser. Note that disabling cookies may limit your use of the website."
    },
    {
      title: "7. Updates to This Policy",
      content: "We may update this Cookie Policy from time to time to reflect changes in technology or legislation. We'll notify you of any significant changes."
    },
    {
      title: "8. Contact Us",
      content: "Questions about our use of cookies? Contact us at support@spannerwork.co.uk"
    }
  ];

  return (
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
          <div className="flex items-center gap-3 mb-4">
            <Cookie className="w-12 h-12" />
            <h1 className="text-4xl md:text-5xl font-bold">Cookie Policy</h1>
          </div>
          <p className="text-orange-100">Last updated: January 2025</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="space-y-8">
          {sections.map((section, index) => (
            <Card key={index} className="border-none shadow-lg">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{section.title}</h2>
                
                {section.content && !section.subsections && (
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
                        <h3 className="font-semibold text-lg text-gray-900 mb-2">{subsection.subtitle}</h3>
                        {subsection.content && (
                          <p className="text-gray-700 leading-relaxed mb-3">{subsection.content}</p>
                        )}
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
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Fun fact box */}
        <Card className="border-none shadow-lg bg-gradient-to-br from-orange-50 to-yellow-50 mt-8">
          <CardContent className="p-8">
            <div className="flex items-start gap-4">
              <Cookie className="w-12 h-12 text-brand-800 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">Fun Cookie Fact! 🍪</h3>
                <p className="text-gray-700">
                  The term &quot;cookie&quot; comes from &quot;magic cookie,&quot; a packet of data a program receives and sends back unchanged. 
                  The first web cookies were created in 1994 by Lou Montulli to make online shopping carts possible!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <MarketingFooter />
    </div>
  );
}
