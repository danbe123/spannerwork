import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { statsService } from "@/api/services";
import { queryKeys } from "@/lib/queryKeys";
import useAuth from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SEO, { generateLocalBusinessSchema } from "@/components/SEO";
import MarketingFooter from "@/components/MarketingFooter";
import {
  Wrench,
  Users,
  TrendingUp,
  MessageCircle,
  Star,
  ChevronRight,
  CheckCircle,
  Banknote,
  Zap,
  Award,
  Clock,
  GraduationCap,
  Warehouse,
  Briefcase,
  ArrowRight,
  Play,
  LucideIcon
} from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  stats: string;
}

interface HowItWorksStep {
  step: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

interface HeroStat {
  value: number | string;
  label: string;
  icon: LucideIcon;
}

interface EarningItem {
  service: string;
  rate: string;
  earning: string;
  period: string;
  icon: LucideIcon;
  color: string;
  details: string;
  highlight: string | null;
}

export default function Home(): JSX.Element {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  const { isAuthenticated } = useAuth();

  const { data: statsData } = useQuery({
    queryKey: queryKeys.platformStats(),
    queryFn: () => statsService.getPublicStats(),
    refetchInterval: 60000,
  });

  const stats = statsData || {
    users: { total: 0, active: 0 },
    requests: { active: 0 },
    listings: { total: 0, tools: 0 },
    transactions: { completed: 0 },
    platform: { averageRating: '5.0', trustScore: '4.8' }
  };

  useEffect(() => {
    const handleScroll = (): void => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleGetStarted = (): void => {
    if (isAuthenticated) {
      navigate("/Feed");
    } else {
      const params = new URLSearchParams();
      params.set('redirect', '/Feed');
      navigate(`/Profile?${params.toString()}`);
    }
  };

  const features: Feature[] = [
    {
      icon: Wrench,
      title: "Rent Tools",
      description: "Access professional equipment when you need it. From power tools to specialty gear.",
      color: "from-orange-500 to-red-500",
      stats: "500+ tools available"
    },
    {
      icon: GraduationCap,
      title: "Hire Expertise",
      description: "Connect with skilled mechanics for hands-on help or expert consultation.",
      color: "from-blue-500 to-indigo-500",
      stats: "Avg £45/hr"
    },
    {
      icon: Warehouse,
      title: "Book Space",
      description: "Access workshops with lifts, bays, and specialized equipment.",
      color: "from-purple-500 to-pink-500",
      stats: "From £40/day"
    }
  ];

  const howItWorks: HowItWorksStep[] = [
    {
      step: "1",
      title: "Post Your Need",
      description: "Describe what you need - tools, skills, or space. Set your budget.",
      icon: CheckCircle
    },
    {
      step: "2",
      title: "Get Quotes",
      description: "Local providers respond. Review profiles, ratings, and prices.",
      icon: MessageCircle
    },
    {
      step: "3",
      title: "Pay Securely",
      description: "Agree on terms and pay through our secure platform.",
      icon: Banknote
    },
    {
      step: "4",
      title: "Rate & Review",
      description: "Leave feedback and build your reputation in the community.",
      icon: Award
    }
  ];

  const activeJobsCount = stats.requests?.active ?? 0;
  const membersCount = stats.users?.total ?? 0;
  const averageRating = stats.platform?.averageRating ?? '5.0';

  const heroStats: HeroStat[] = [
    { value: activeJobsCount, label: "Active Jobs", icon: Briefcase },
    { value: membersCount, label: "Members", icon: Users },
    { value: averageRating, label: "Avg Rating", icon: Star },
    { value: "£42", label: "Avg Hourly", icon: TrendingUp },
  ];

  const earningItems: EarningItem[] = [
    {
      service: "Tools & Equipment",
      rate: "£10-180/day",
      earning: "£50-900",
      period: "per month",
      icon: Wrench,
      color: "from-orange-500 to-red-500",
      details: "Based on item type",
      highlight: null
    },
    {
      service: "Mechanical Services",
      rate: "£40-80/hr",
      earning: "£160-640",
      period: "per week",
      icon: GraduationCap,
      color: "from-blue-500 to-indigo-500",
      details: "Set your own rates",
      highlight: "🔥 High demand"
    },
    {
      service: "Workshop Space",
      rate: "£40-90/day",
      earning: "£200-450",
      period: "per week",
      icon: Warehouse,
      color: "from-purple-500 to-pink-500",
      details: "Weekend rentals",
      highlight: null
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="SpannerWork - Rent Tools, Hire Mechanics & Book Workshop Space Near You"
        description="Save money on car repairs and DIY projects. Rent tools from £10/day, hire skilled mechanics from £30/hr, or book workshop space. Join 150+ members in Herefordshire."
        keywords="tool rental near me, mechanic for hire, workshop space rental, garage rental, automotive tools, car repair help, DIY mechanic, tool sharing, equipment rental herefordshire"
        schema={[
          generateLocalBusinessSchema(),
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "SpannerWork",
            "url": "https://spannerwork.co.uk",
            "potentialAction": {
              "@type": "SearchAction",
              "target": "https://spannerwork.app/search?q={search_term_string}",
              "query-input": "required name=search_term_string"
            }
          }
        ]}
      />

      {/* Sticky Navigation */}
      <nav className={`fixed left-0 right-0 top-0 z-40 transition-all duration-300 ${
        scrolled ? 'bg-white shadow-md py-3' : 'bg-transparent py-6'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all ${
              scrolled ? 'bg-gradient-to-br from-brand-800 to-brand-900' : 'bg-white'
            }`}>
              <Wrench className={`w-6 h-6 ${scrolled ? 'text-white' : 'text-brand-800'}`} />
            </div>
            <div>
              <h2 className={`font-bold text-2xl transition-colors ${
                scrolled ? 'text-gray-900' : 'text-white'
              }`}>SpannerWork</h2>
              <p className={`text-xs font-semibold transition-colors ${
                scrolled ? 'text-brand-800' : 'text-[#FFC107]'
              }`}>Tools. Skills. Space.</p>
            </div>
          </div>
          <Button
            onClick={handleGetStarted}
            className={`transition-all ${
              scrolled
                ? 'bg-brand-800 hover:bg-brand-900 text-white'
                : 'bg-white text-brand-800 hover:bg-orange-50'
            }`}
            aria-label={isAuthenticated ? 'Go to app feed' : 'Sign up for free'}
          >
            {isAuthenticated ? 'Go to App' : 'Sign Up Free'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-[#A52A14] pt-32 pb-20 md:pt-40 md:pb-32">
        <div className="absolute inset-0 opacity-10" aria-hidden="true">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight animate-fade-in-up">
              Your Local
              <br />
              <span className="text-[#FFC107]">Garage Network</span>
            </h1>

            <p className="text-xl md:text-2xl text-orange-100 mb-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              Rent tools. Hire mechanics. Book workspace.
            </p>

            <p className="text-lg text-orange-200 max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              Everything you need for your next project, right in your neighborhood. No dealership prices. No corporate markups. Just real people helping real people.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <Button
                onClick={handleGetStarted}
                size="lg"
                className="bg-white text-brand-800 hover:bg-orange-50 text-lg px-10 py-7 shadow-2xl font-bold group"
              >
                Get Started Free
                <ChevronRight className="w-6 h-6 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-white/10 backdrop-blur-sm border-2 border-white/40 text-white hover:bg-white hover:text-brand-800 text-lg px-10 py-7 font-bold transition-all"
              >
                <Play className="w-5 h-5 mr-2" />
                See How It Works
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              {heroStats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <Card key={index} className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/20 transition-all">
                    <CardContent className="p-6 text-center">
                      <Icon className="w-6 h-6 mx-auto mb-2 text-[#FFC107]" />
                      <p className="text-4xl font-bold text-white mb-1">{stat.value}</p>
                      <p className="text-sm text-orange-100">{stat.label}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-16 md:h-24">
            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" fill="#ffffff"></path>
          </svg>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-orange-50 via-red-50 to-orange-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Everything You Need.<br />One Platform.
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Whether you're tackling a weekend project or running a full restoration, SpannerWork connects you with the tools, skills, and space to get it done right.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="border-none shadow-xl hover:shadow-2xl transition-all duration-300 group overflow-hidden relative bg-white">
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${feature.color}`} />
                  <CardContent className="p-8">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                    <p className="text-gray-600 mb-4 leading-relaxed">{feature.description}</p>
                    <Badge variant="outline" className="font-semibold text-gray-700 border border-gray-300">
                      {feature.stats}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="text-center">
            <p className="text-gray-700 mb-6 text-lg font-medium">No subscriptions. No dealership markup. Just fair, local rates.</p>
            <Button
              onClick={handleGetStarted}
              size="lg"
              className="bg-brand-800 hover:bg-brand-900 text-white text-lg px-10 py-7 shadow-xl font-bold"
            >
              Browse Available Tools & Services
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Post. Connect. Done.
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              From posting your need to getting the job done - usually in under an hour
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 relative mb-12">
            <div className="hidden lg:block absolute top-24 left-0 right-0 h-1 bg-gradient-to-r from-brand-800 via-blue-500 to-green-500 opacity-20" style={{ width: '75%', left: '12.5%' }} />

            {howItWorks.map((step, index) => (
              <div key={index} className="relative">
                <Card className="border-none shadow-xl h-full hover:shadow-2xl transition-all bg-white">
                  <CardContent className="p-8 text-center">
                    <div className="relative inline-block mb-6">
                      <div className="w-16 h-16 bg-gradient-to-br from-brand-800 to-brand-900 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-xl relative z-10">
                        {step.step}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-br from-brand-800 to-brand-900 rounded-full blur-xl opacity-50 animate-pulse" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{step.description}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          <div className="text-center">
            <div className="inline-flex items-center gap-3 bg-orange-50 border border-orange-200 px-6 py-3 rounded-full mb-8">
              <Clock className="w-5 h-5 text-brand-800" />
              <span className="text-gray-700 font-semibold">Average response time: 47 minutes</span>
            </div>
            <div>
              <Button
                onClick={handleGetStarted}
                size="lg"
                className="bg-brand-800 hover:bg-brand-900 text-white text-lg px-10 py-7 shadow-xl font-bold"
              >
                Post Your First Job Free
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Earning Potential */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-4">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Turn Idle Assets Into Income
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-3">
              List your tools, skills, or space and earn when they're booked
            </p>
            <p className="text-gray-500">Real earning potential from our community</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12 mt-12">
            {earningItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <Card key={index} className="border-none shadow-xl hover:shadow-2xl transition-all overflow-hidden group relative">
                  {item.highlight && (
                    <div className="absolute top-4 right-4 z-10">
                      <Badge className="bg-[#FFC107] text-gray-900 font-bold shadow-lg">
                        {item.highlight}
                      </Badge>
                    </div>
                  )}
                  <div className={`h-2 bg-gradient-to-r ${item.color}`} />
                  <CardContent className="p-8 text-center">
                    <div className={`w-20 h-20 rounded-2xl bg-gradient-to-r ${item.color} flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-lg`}>
                      <Icon className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{item.service}</h3>
                    <p className="text-gray-600 mb-4 font-semibold">{item.rate}</p>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 mb-3 border-2 border-green-200">
                      <p className="text-xs text-green-700 font-semibold mb-1">Potential Earnings</p>
                      <p className="text-2xl font-bold text-green-600 mb-1">{item.earning}</p>
                      <p className="text-sm text-green-700 font-semibold">{item.period}</p>
                    </div>
                    <p className="text-xs text-gray-500">{item.details}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="border-none shadow-xl bg-white max-w-2xl mx-auto">
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Start Earning Today</h3>
              </div>
              <p className="text-gray-600 mb-6">List your tools, set your rates, and start getting requests</p>
              <Button
                onClick={handleGetStarted}
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white text-lg px-10 py-7 shadow-xl font-bold"
              >
                List Your First Item Free
              </Button>
              <p className="text-sm text-gray-500 mt-4">✓ No fees to list  ✓ You set the price  ✓ 3 months zero fees</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Success Stories Coming Soon
            </h2>
            <p className="text-xl text-gray-600">Be among our first members and share your story</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-6">
                  <Users className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Be Our First Tool Provider</h3>
                <p className="text-gray-600 mb-6">List your tools and become one of our founding members.</p>
                <Button onClick={handleGetStarted} className="bg-brand-800 hover:bg-brand-900 text-white">
                  List Your Tools
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-6">
                  <Star className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Leave the First Review</h3>
                <p className="text-gray-600 mb-6">Complete a transaction and share your experience.</p>
                <Button onClick={handleGetStarted} className="bg-brand-800 hover:bg-brand-900 text-white">
                  Find Help
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-6">
                  <Award className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Share Your Success</h3>
                <p className="text-gray-600 mb-6">Your story could inspire others in the community.</p>
                <Button onClick={handleGetStarted} className="bg-brand-800 hover:bg-brand-900 text-white">
                  Get Started
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <p className="text-gray-600 text-lg mb-6">
              Join {membersCount > 0 ? membersCount + '+' : 'our growing community of'} mechanics and DIYers
            </p>
            <Card className="max-w-2xl mx-auto bg-gradient-to-br from-orange-50 to-red-50 border-2 border-brand-800">
              <CardContent className="p-8 text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Early Adopter Benefits</h3>
                <p className="text-gray-700 mb-6">Enjoy exclusive perks as one of our first members:</p>
                <div className="grid md:grid-cols-2 gap-4 text-left">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                    <span className="text-gray-700">Featured listing priority</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                    <span className="text-gray-700">3 months zero platform fees</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                    <span className="text-gray-700">Founding member badge</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                    <span className="text-gray-700">Direct input on features</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-brand-800 via-brand-900 to-[#A52A14] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '30px 30px'
          }} />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <Zap className="w-20 h-20 text-[#FFC107] mx-auto mb-6 animate-bounce" />
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-orange-100 mb-10 max-w-2xl mx-auto">
            Join the community marketplace where mechanics help mechanics. Post a job or start earning in under 2 minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={handleGetStarted}
              size="lg"
              className="bg-white text-brand-800 hover:bg-orange-50 text-xl px-12 py-8 shadow-2xl font-bold group"
            >
              Sign Up - It's Free
              <ChevronRight className="w-6 h-6 ml-2 group-hover:translate-x-2 transition-transform" />
            </Button>
          </div>
          <p className="text-orange-200 mt-6 text-sm">
            ✓ Free to join  ✓ Only pay when you transact  ✓ No monthly fees
          </p>
        </div>
      </section>

      <MarketingFooter />

      <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out;
        }
      `}</style>
    </div>
  );
}
