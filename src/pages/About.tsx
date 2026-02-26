import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Users, Heart, Target, Lightbulb, MapPin, Calendar, LucideIcon } from "lucide-react";
import MarketingFooter from "../components/MarketingFooter";
import DocsMobileHeader from "@/components/docs/DocsMobileHeader";
import SEO from "@/components/SEO";

interface ValueItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface TimelineItem {
  date: string;
  event: string;
}

export default function About() {
  const navigate = useNavigate();

  const values: ValueItem[] = [
    {
      icon: Users,
      title: "Community First",
      description: "We're building a network of neighbors helping neighbors. Local connections, real relationships."
    },
    {
      icon: Heart,
      title: "Fair & Transparent",
      description: "No hidden fees. No corporate markups. Just honest transactions between real people."
    },
    {
      icon: Target,
      title: "Empowering Independence",
      description: "Whether you're a DIYer or a pro, we give you the tools and connections to get the job done."
    },
    {
      icon: Lightbulb,
      title: "Sustainable Sharing",
      description: "Why should everyone own a cherry picker? Share resources, reduce waste, save money."
    }
  ];

  const timeline: TimelineItem[] = [
    { date: "Early 2025", event: "Concept development and platform building" },
    { date: "November 2025", event: "Beta testing phase with founding members" },
    { date: "Q3 2026", event: "Official launch in Herefordshire" },
    { date: "Q4 2026", event: "Community growth and expansion to neighboring areas" }
  ];

  return (
    <>
      <SEO
        title="About SpannerWork - Our Story & Mission"
        description="Learn about SpannerWork's mission to connect communities through tool sharing, mechanic services, and workshop spaces. Founded in Herefordshire, UK."
        keywords="about spannerwork, tool rental platform, community marketplace, sharing economy, UK"
        schema={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          "mainEntity": {
            "@type": "Organization",
            "name": "SpannerWork",
            "description": "Community marketplace for tool rentals, mechanic services, and workshop space",
            "url": "https://spannerwork.co.uk",
            "foundingDate": "2025",
            "foundingLocation": "Herefordshire, UK"
          }
        }}
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
            <h1 className="text-4xl md:text-5xl font-bold mb-4">About SpannerWork</h1>
            <p className="text-xl text-brand-100">Built by mechanics, for mechanics</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Beta Badge */}
        <Card className="mb-8 border-2 border-[#FFC107] bg-gradient-to-r from-yellow-50 to-brand-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-[#FFC107] text-gray-900 rounded-lg font-bold text-sm">
                BETA
              </div>
              <div>
                <p className="font-semibold text-gray-900">Currently in Beta Testing</p>
                <p className="text-sm text-gray-700">
                  Join our founding members and help shape the future of SpannerWork. Official launch coming Q3 2026!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Story */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold mb-6">Our Story</h2>
          <div className="prose prose-lg text-gray-700 space-y-4">
            <p>
              <strong>SpannerWork started with a simple frustration:</strong> I was quoted £800 for a job at a dealership that should&apos;ve cost £200. The parts were cheap, but the labor fees were astronomical. I knew plenty of skilled people locally who could&apos;ve helped for a fraction of that price.
            </p>
            <p>
              That&apos;s when it hit me - <strong>the sharing economy exists for everything except automotive work.</strong> You can rent someone&apos;s house (Airbnb), borrow their car (Turo), but there&apos;s no easy way to rent a trolley jack or hire a local mechanic to help with a brake job.
            </p>
            <p>
              So I built SpannerWork. No corporate middlemen. No dealership markups. Just a simple platform connecting people who need tools, skills, or workspace with neighbors who have them.
            </p>
            <p>
              <strong>We&apos;re currently in beta testing in Herefordshire</strong>, working with a small group of local mechanics and DIY enthusiasts to perfect the platform. The response has been incredible - people are hungry for an alternative to expensive dealerships and overpriced tool rentals.
            </p>
            <p>
              We&apos;re building a community where a Saturday oil change doesn&apos;t cost £150, where you can rent a transmission jack for £20 instead of buying one for £300, and where experienced mechanics can earn extra income helping their neighbors.
            </p>
            <p className="font-semibold text-brand-800">
              This is about making car maintenance affordable and keeping money in local communities. One spanner at a time.
            </p>
          </div>

          {/* Founder */}
          <Card className="mt-8 border-none shadow-lg bg-gradient-to-br from-brand-50 to-red-50">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-brand-800 to-brand-900 rounded-full flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
                  SW
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-1">The SpannerWork Team</h3>
                  <p className="text-gray-600 mb-2">Herefordshire, UK</p>
                  <p className="text-gray-700 italic">
                    &quot;We&apos;re tired of watching people overpay for simple car maintenance. SpannerWork is our answer - a platform that puts power back in the hands of local communities.&quot;
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold mb-8 text-center">Our Journey</h2>
          <div className="space-y-4">
            {timeline.map((item, index) => (
              <Card key={index} className="border-l-4 border-brand-800 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <Calendar className="w-5 h-5 text-brand-800" />
                    <div>
                      <p className="font-bold text-brand-800">{item.date}</p>
                      <p className="text-gray-700">{item.event}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Values */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold mb-12 text-center">What We Stand For</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <Card key={index} className="border-none shadow-lg">
                  <CardContent className="p-8">
                    <div className="w-12 h-12 bg-gradient-to-br from-brand-800 to-brand-900 rounded-xl flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">{value.title}</h3>
                    <p className="text-gray-600">{value.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Location */}
        <Card className="mb-16 border-none shadow-lg">
          <CardContent className="p-8">
            <div className="flex items-start gap-4">
              <MapPin className="w-8 h-8 text-brand-800 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-bold mb-2">Based in Herefordshire</h3>
                <p className="text-gray-700 leading-relaxed">
                  We&apos;re proud to be based in Herefordshire, serving the local community and surrounding areas. 
                  Our focus is on building strong, trusted connections between neighbors who share a passion 
                  for automotive work and DIY projects.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <Card className="bg-gradient-to-r from-brand-800 to-brand-900 border-none text-white">
          <CardContent className="p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">Join Our Beta Community</h2>
            <p className="text-xl text-brand-100 mb-8">Be among the first to experience the future of local car maintenance</p>
            <Button
              onClick={() => navigate(createPageUrl("Feed"))}
              size="lg"
              className="bg-white text-brand-800 hover:bg-brand-50 text-lg px-12 py-6 font-bold"
            >
              Join Beta Today
            </Button>
            <p className="text-sm text-brand-200 mt-4">✨ Founding members get exclusive benefits and zero fees for 3 months</p>
          </CardContent>
        </Card>
      </div>

        <MarketingFooter />
      </div>
    </>
  );
}
