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
      color: "from-brand-800 to-brand-900",
      stats: "Pay per use"
    },
    {
      icon: GraduationCap,
      title: "Hire Expertise",
      description: "Connect with skilled mechanics for hands-on help or expert consultation.",
      color: "from-brand-800 to-brand-900",
      stats: "Local pros"
    },
    {
      icon: Warehouse,
      title: "Book Space",
      description: "Access workshops with lifts, bays, and specialized equipment.",
      color: "from-brand-800 to-brand-900",
      stats: "By the hour or day"
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
      rate: "You set the daily rate",
      earning: "Earn per rental",
      period: "",
      icon: Wrench,
      color: "from-brand-800 to-brand-900",
      details: "Power tools, diagnostic gear, specialty equipment",
      highlight: null
    },
    {
      service: "Your Skills",
      rate: "Set your hourly rate",
      earning: "Get paid for jobs",
      period: "",
      icon: GraduationCap,
      color: "from-brand-800 to-brand-900",
      details: "Consultations, hands-on help, full repairs",
      highlight: null
    },
    {
      service: "Workshop Space",
      rate: "Hourly or daily rates",
      earning: "Monetise downtime",
      period: "",
      icon: Warehouse,
      color: "from-brand-800 to-brand-900",
      details: "Bays, lifts, workspace access",
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
              <p className={`text-xs font-semibold transition-colors hidden sm:block ${
                scrolled ? 'text-brand-800' : 'text-[#FFC107]'
              }`}>Tools. Skills. Space.</p>
            </div>
          </div>

          {/* Navigation Links - Desktop */}
          <div className="hidden md:flex items-center gap-6">
            <a href="/how-it-works" className={`font-medium transition-colors hover:text-[#FFC107] ${
              scrolled ? 'text-gray-700' : 'text-white'
            }`}>How It Works</a>
            <a href="/pricing" className={`font-medium transition-colors hover:text-[#FFC107] ${
              scrolled ? 'text-gray-700' : 'text-white'
            }`}>Pricing</a>
            <a href="/blog" className={`font-medium transition-colors hover:text-[#FFC107] ${
              scrolled ? 'text-gray-700' : 'text-white'
            }`}>Blog</a>
            <a href="/resources" className={`font-medium transition-colors hover:text-[#FFC107] ${
              scrolled ? 'text-gray-700' : 'text-white'
            }`}>Resources</a>
          </div>

          <Button
            onClick={handleGetStarted}
            size="sm"
            className={`transition-all text-xs sm:text-sm px-3 sm:px-4 ${
              scrolled
                ? 'bg-brand-800 hover:bg-brand-900 text-white'
                : 'bg-white text-brand-800 hover:bg-brand-50'
            }`}
            aria-label={isAuthenticated ? 'Go to app feed' : 'Sign up or login'}
          >
            {isAuthenticated ? 'Go to App' : 'Sign Up or Login'}
            <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-0.5 sm:ml-1" />
          </Button>
        </div>
      </nav>

      <main id="main-content">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-[#A52A14] pt-24 pb-16 sm:pt-28 sm:pb-20 md:pt-32 md:pb-24 lg:pt-40 lg:pb-32">
        <div className="absolute inset-0 opacity-10" aria-hidden="true">
          <div className="absolute inset-0 bg-dot-pattern" />
        </div>

        <div className="relative max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl 2xl:text-7xl font-bold text-white mb-6 leading-tight animate-fade-in-up">
              Your Local
              <br />
              <span className="text-[#FFC107]">Garage Network</span>
            </h1>

            <p className="text-lg sm:text-xl lg:text-2xl text-brand-100 mb-4 animate-fade-in-up animation-delay-100">
              Rent tools. Hire mechanics. Book workspace.
            </p>

            <p className="text-base sm:text-lg text-brand-200 max-w-2xl mx-auto mb-8 sm:mb-10 animate-fade-in-up animation-delay-200">
              Everything you need for your next project, right in your neighborhood. No dealership prices. No corporate markups. Just real people helping real people.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12 animate-fade-in-up animation-delay-300">
              <Button
                onClick={handleGetStarted}
                size="lg"
                className="bg-white text-brand-800 hover:bg-brand-50 text-base sm:text-lg px-6 sm:px-10 py-6 sm:py-7 shadow-2xl font-bold group w-full sm:w-auto"
              >
                Get Started Free
                <ChevronRight className="w-6 h-6 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-white/10 backdrop-blur-sm border-2 border-white/40 text-white hover:bg-white hover:text-brand-800 text-base sm:text-lg px-6 sm:px-10 py-6 sm:py-7 font-bold transition-all w-full sm:w-auto"
              >
                <Play className="w-5 h-5 mr-2" />
                See How It Works
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-3xl mx-auto animate-fade-in-up animation-delay-400">
              {heroStats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div key={index} className="flex flex-col items-center text-center">
                    <Icon className="w-5 h-5 text-[#FFC107] mb-1" />
                    <span className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</span>
                    <span className="text-xs sm:text-sm text-white/70">{stat.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-16 md:h-24 rotate-180">
            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" fill="#ffffff"></path>
          </svg>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1920px] mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <Badge className="bg-brand-800 text-white hover:bg-brand-900 mb-4 px-4 py-1.5 text-sm font-semibold">
              One Platform
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
              Everything You Need
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Whether you're tackling a weekend project or running a full restoration, SpannerWork connects you with the tools, skills, and space to get it done right.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-12 sm:mb-16">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="group relative bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-2xl p-5 sm:p-6 lg:p-8 hover:border-brand-800/30 hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-start gap-5">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform flex-shrink-0`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                      <p className="text-gray-600 leading-relaxed mb-3">{feature.description}</p>
                      <span className="inline-flex items-center text-sm font-semibold text-brand-800">
                        {feature.stats}
                        <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-brand-800 to-brand-900 rounded-2xl" />
            <div className="relative px-5 py-8 sm:px-8 sm:py-10 md:py-12 text-center">
              <p className="text-white/90 mb-4 sm:mb-6 text-sm sm:text-base lg:text-lg font-medium">
                No subscriptions. No dealership markup. Just fair, local rates.
              </p>
              <Button
                onClick={handleGetStarted}
                size="lg"
                className="bg-white text-brand-800 hover:bg-brand-50 text-sm sm:text-base lg:text-lg px-6 sm:px-8 lg:px-12 py-4 sm:py-6 shadow-xl font-bold w-full sm:w-auto"
              >
                Browse Listings
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1920px] mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <Badge className="bg-brand-800 text-white hover:bg-brand-900 mb-4 px-4 py-1.5 text-sm font-semibold">
              How It Works
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
              Post. Connect. Done.
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              From posting your need to getting the job done - it's that simple
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-4 mb-10 sm:mb-16">
            {howItWorks.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="relative group">
                  {/* Connector line - only on desktop */}
                  {index < howItWorks.length - 1 && (
                    <div className="hidden lg:block absolute top-7 left-[60%] w-full h-0.5 bg-gradient-to-r from-brand-800/30 to-brand-800/10" />
                  )}

                  <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 border border-gray-100 hover:border-brand-800/30 hover:shadow-lg transition-all h-full">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-br from-brand-800 to-brand-900 rounded-lg sm:rounded-xl flex items-center justify-center text-white font-bold text-base sm:text-xl shadow-lg flex-shrink-0">
                        {step.step}
                      </div>
                      <Icon className="hidden sm:block w-6 h-6 text-brand-800/40" />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1 sm:mb-2">{step.title}</h3>
                    <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2 sm:gap-3 text-gray-600">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-brand-800/10 flex items-center justify-center">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-brand-800" />
              </div>
              <span className="text-sm sm:text-base font-medium">Quick responses from local providers</span>
            </div>
            <Button
              onClick={handleGetStarted}
              size="lg"
              className="bg-brand-800 hover:bg-brand-900 text-white px-6 sm:px-8 py-4 sm:py-6 shadow-lg font-semibold w-full sm:w-auto"
            >
              Post Your First Job
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Earning Potential */}
      <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1920px] mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <Badge className="bg-brand-800 text-white hover:bg-brand-900 mb-4 px-4 py-1.5 text-sm font-semibold">
              For Providers
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
              Turn Idle Assets Into Income
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Got tools collecting dust? Skills to share? Space sitting empty? Put them to work.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-12 sm:mb-16">
            {earningItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={index}
                  className="group relative bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-2xl p-5 sm:p-6 lg:p-8 hover:border-brand-800/30 hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-start gap-5">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform flex-shrink-0`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{item.service}</h3>
                      <p className="text-brand-800 font-semibold text-sm mb-3">{item.rate}</p>
                      <p className="text-gray-600 text-sm leading-relaxed">{item.details}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-brand-800 to-brand-900 rounded-2xl" />
            <div className="relative px-5 py-8 sm:px-8 sm:py-10 md:py-12">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-8">
                <div className="text-center lg:text-left">
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">Start Earning Today</h3>
                  <p className="text-sm sm:text-base text-white/80">List your first item in minutes. No signup fees.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                  <Button
                    onClick={handleGetStarted}
                    size="lg"
                    className="bg-white text-brand-800 hover:bg-brand-50 px-6 sm:px-8 py-4 sm:py-6 shadow-xl font-semibold w-full sm:w-auto"
                  >
                    List Your First Item
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap justify-center lg:justify-start gap-x-4 sm:gap-x-6 gap-y-2 mt-4 sm:mt-6 text-xs sm:text-sm text-white/70">
                <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> No fees to list</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> You set the price</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Get paid securely</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Browse Categories - New SEO Section */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-gray-50" aria-labelledby="browse-heading">
        <div className="max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1920px] mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 id="browse-heading" className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
              Browse Our Marketplace
            </h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
              Find exactly what you need - from professional tools to skilled mechanics and workshop spaces
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            {/* Tool Categories */}
            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <h3 className="font-bold text-sm sm:text-lg text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                  <Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-brand-800" />
                  <span className="hidden sm:inline">Popular </span>Tools
                </h3>
                <nav aria-label="Tool categories">
                  <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
                    <li><a href="/feed?category=TOOLS&search=diagnostic" className="text-gray-600 hover:text-brand-800 transition-colors block py-1">Diagnostic Equipment</a></li>
                    <li><a href="/feed?category=TOOLS&search=lift" className="text-gray-600 hover:text-brand-800 transition-colors block py-1">Car Lifts & Ramps</a></li>
                    <li><a href="/feed?category=TOOLS&search=compressor" className="text-gray-600 hover:text-brand-800 transition-colors block py-1">Air Compressors</a></li>
                    <li><a href="/feed?category=TOOLS&search=welder" className="text-gray-600 hover:text-brand-800 transition-colors block py-1">Welding Equipment</a></li>
                    <li><a href="/feed?category=TOOLS" className="text-brand-800 hover:text-brand-900 font-semibold block py-1">View All Tools →</a></li>
                  </ul>
                </nav>
              </CardContent>
            </Card>

            {/* Services */}
            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <h3 className="font-bold text-sm sm:text-lg text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  <span className="hidden sm:inline">Mechanic </span>Services
                </h3>
                <nav aria-label="Service categories">
                  <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
                    <li><a href="/feed?category=EXPERTISE&search=engine" className="text-gray-600 hover:text-brand-800 transition-colors block py-1">Engine Specialists</a></li>
                    <li><a href="/feed?category=EXPERTISE&search=bodywork" className="text-gray-600 hover:text-brand-800 transition-colors block py-1">Bodywork & Paint</a></li>
                    <li><a href="/feed?category=EXPERTISE&search=electrical" className="text-gray-600 hover:text-brand-800 transition-colors block py-1">Auto Electricians</a></li>
                    <li><a href="/feed?category=EXPERTISE&search=restoration" className="text-gray-600 hover:text-brand-800 transition-colors block py-1">Classic Car Restoration</a></li>
                    <li><a href="/feed?category=EXPERTISE" className="text-brand-800 hover:text-brand-900 font-semibold block py-1">Find Mechanics →</a></li>
                  </ul>
                </nav>
              </CardContent>
            </Card>

            {/* Spaces */}
            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <h3 className="font-bold text-sm sm:text-lg text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                  <Warehouse className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                  <span className="hidden sm:inline">Workshop </span>Spaces
                </h3>
                <nav aria-label="Space categories">
                  <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
                    <li><a href="/feed?category=SPACE&search=garage" className="text-gray-600 hover:text-brand-800 transition-colors block py-1">Garages with Lifts</a></li>
                    <li><a href="/feed?category=SPACE&search=workshop" className="text-gray-600 hover:text-brand-800 transition-colors block py-1">Full Workshops</a></li>
                    <li><a href="/feed?category=SPACE&search=bay" className="text-gray-600 hover:text-brand-800 transition-colors block py-1">Service Bays</a></li>
                    <li><a href="/feed?category=SPACE&search=storage" className="text-gray-600 hover:text-brand-800 transition-colors block py-1">Secure Storage</a></li>
                    <li><a href="/feed?category=SPACE" className="text-brand-800 hover:text-brand-900 font-semibold block py-1">Browse Spaces →</a></li>
                  </ul>
                </nav>
              </CardContent>
            </Card>

            {/* Resources */}
            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <h3 className="font-bold text-sm sm:text-lg text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  Resources
                </h3>
                <nav aria-label="Resources">
                  <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
                    <li><a href="/how-it-works" className="text-gray-600 hover:text-brand-800 transition-colors block py-1">How SpannerWork Works</a></li>
                    <li><a href="/resources/provider-guide" className="text-gray-600 hover:text-brand-800 transition-colors block py-1">Provider Guide</a></li>
                    <li><a href="/resources/renter-guide" className="text-gray-600 hover:text-brand-800 transition-colors block py-1">Renter Guide</a></li>
                    <li><a href="/safety" className="text-gray-600 hover:text-brand-800 transition-colors block py-1">Safety Guidelines</a></li>
                    <li><a href="/resources" className="text-brand-800 hover:text-brand-900 font-semibold block py-1">All Resources →</a></li>
                  </ul>
                </nav>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-white" aria-labelledby="social-proof-heading">
        <div className="max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1920px] mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 id="social-proof-heading" className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 sm:mb-4">
              Success Stories Coming Soon
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600">Be among our first members and share your story</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-8 sm:mb-12">
            <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
              <CardContent className="p-5 sm:p-8 text-center">
                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <Users className="w-7 h-7 sm:w-10 sm:h-10 text-gray-400" />
                </div>
                <h3 className="text-base sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3">Be Our First Tool Provider</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">List your tools and become one of our founding members.</p>
                <Button onClick={handleGetStarted} className="bg-brand-800 hover:bg-brand-900 text-white text-sm sm:text-base">
                  List Your Tools
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
              <CardContent className="p-5 sm:p-8 text-center">
                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <Star className="w-7 h-7 sm:w-10 sm:h-10 text-gray-400" />
                </div>
                <h3 className="text-base sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3">Leave the First Review</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">Complete a transaction and share your experience.</p>
                <Button onClick={handleGetStarted} className="bg-brand-800 hover:bg-brand-900 text-white text-sm sm:text-base">
                  Find Help
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 border-dashed border-gray-300 bg-gray-50 sm:col-span-2 lg:col-span-1">
              <CardContent className="p-5 sm:p-8 text-center">
                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <Award className="w-7 h-7 sm:w-10 sm:h-10 text-gray-400" />
                </div>
                <h3 className="text-base sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3">Share Your Success</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">Your story could inspire others in the community.</p>
                <Button onClick={handleGetStarted} className="bg-brand-800 hover:bg-brand-900 text-white text-sm sm:text-base">
                  Get Started
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <p className="text-sm sm:text-base lg:text-lg text-gray-600 mb-4 sm:mb-6">
              Join {membersCount > 0 ? membersCount + '+' : 'our growing community of'} mechanics and DIYers
            </p>
            <Card className="max-w-2xl mx-auto bg-gradient-to-br from-brand-50 to-red-50 border-2 border-brand-800">
              <CardContent className="p-5 sm:p-8 text-center">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">Early Adopter Benefits</h3>
                <p className="text-sm sm:text-base text-gray-700 mb-4 sm:mb-6">Enjoy exclusive perks as one of our first members:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-left">
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
      <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-brand-800 via-brand-900 to-[#A52A14] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-dot-pattern-sm" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <Zap className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 text-[#FFC107] mx-auto mb-4 sm:mb-6 animate-bounce" />
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-brand-100 mb-6 sm:mb-10 max-w-2xl mx-auto">
            Join the community marketplace where mechanics help mechanics. Post a job or start earning in under 2 minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={handleGetStarted}
              size="lg"
              className="bg-white text-brand-800 hover:bg-brand-50 text-base sm:text-lg lg:text-xl px-6 sm:px-8 lg:px-12 py-5 sm:py-6 lg:py-8 shadow-2xl font-bold group w-full sm:w-auto"
            >
              Sign Up - It's Free
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 ml-2 group-hover:translate-x-2 transition-transform" />
            </Button>
          </div>
          <p className="text-brand-200 mt-4 sm:mt-6 text-xs sm:text-sm">
            ✓ Free to join  ✓ Only pay when you transact  ✓ No monthly fees
          </p>
        </div>
      </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
