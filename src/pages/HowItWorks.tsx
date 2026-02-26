import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, CheckCircle, MessageCircle, PoundSterling, Award, Wrench, Users, Shield, LucideIcon } from "lucide-react";
import MarketingFooter from "../components/MarketingFooter";
import SEO from "@/components/SEO";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsBreadcrumbs from "@/components/docs/DocsBreadcrumbs";
import DocsMobileHeader from "@/components/docs/DocsMobileHeader";

interface Step {
  step: string;
  title: string;
  description: string;
  icon: LucideIcon;
  details: string[];
}

interface ProviderItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

export default function HowItWorks(): JSX.Element {
  const navigate = useNavigate();

  const steps: Step[] = [
    {
      step: "1",
      title: "Post Your Need",
      description: "Describe what you need - tools, skills, or space. Set your budget and urgency level.",
      icon: CheckCircle,
      details: ["Takes 2 minutes", "Be specific about requirements", "Add photos for clarity"]
    },
    {
      step: "2",
      title: "Get Quotes",
      description: "Local providers respond with their rates and availability. Review profiles and ratings.",
      icon: MessageCircle,
      details: ["Compare multiple offers", "Check provider ratings", "Read past reviews"]
    },
    {
      step: "3",
      title: "Agree & Pay",
      description: "Choose your provider, agree on terms, and pay securely through the platform.",
      icon: PoundSterling,
      details: ["Secure payment processing", "Deposit held until completion", "Clear terms documented"]
    },
    {
      step: "4",
      title: "Complete & Review",
      description: "Get the job done, return items in good condition, and leave feedback.",
      icon: Award,
      details: ["Track your transaction", "Upload return photos", "Build your reputation"]
    }
  ];

  const forProviders: ProviderItem[] = [
    {
      icon: Wrench,
      title: "List Your Items",
      description: "Add tools, equipment, or workspace to your inventory with photos and pricing."
    },
    {
      icon: Users,
      title: "Respond to Requests",
      description: "Browse local needs and send quotes. Set your own rates and availability."
    },
    {
      icon: Shield,
      title: "Get Paid Securely",
      description: "Payment is held securely and released once the job is complete. Deposits protect your assets."
    }
  ];

  return (
    <>
      <DocsMobileHeader />
      <div className="min-h-screen bg-white">
        <SEO
          title="How SpannerWork Works - Simple Tool Rental & Service Marketplace"
          description="Learn how to rent tools, hire mechanics, and book workshop space on SpannerWork. Simple 4-step process: Post, Connect, Pay, Review. Join our growing community today."
          keywords="how to rent tools, how to hire mechanic, tool rental process, service marketplace guide"
        />

        {/* Header */}
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
          <h1 className="text-4xl md:text-5xl font-bold mb-4">How SpannerWork Works</h1>
          <p className="text-xl text-brand-100">Simple, secure, and community-driven</p>
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
            {/* For Job Seekers */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12">For People Needing Help</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {steps.map((step, index) => {
              return (
                <Card key={index} className="border-2 border-gray-100 hover:border-brand-800 transition-all">
                  <CardContent className="p-8">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-brand-800 to-brand-900 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                        {step.step}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                        <p className="text-gray-600 mb-4">{step.description}</p>
                        <ul className="space-y-2">
                          {step.details.map((detail, i) => (
                            <li key={i} className="text-sm text-gray-500 flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-brand-800 rounded-full" />
                              {detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* For Providers */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-4">For Providers</h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Turn your idle tools, skills, and space into steady income
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {forProviders.map((item, index) => {
              const Icon = item.icon;
              return (
                <Card key={index} className="border-none shadow-lg text-center">
                  <CardContent className="p-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                    <p className="text-gray-600">{item.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <Card className="bg-gradient-to-r from-brand-800 to-brand-900 border-none text-white">
          <CardContent className="p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-xl text-brand-100 mb-8">Join our growing community of DIYers and mechanics</p>
            <Button
              onClick={() => navigate(createPageUrl("Feed"))}
              size="lg"
              className="bg-white text-brand-800 hover:bg-brand-50 text-lg px-12 py-6 font-bold"
            >
              Sign Up Free
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
