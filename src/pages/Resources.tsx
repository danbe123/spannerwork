/**
 * Resources Page
 *
 * Hub for guides, FAQs, and helpful resources for SpannerWork users.
 */

import React from "react";
import { 
  BookOpen, 
  HelpCircle, 
  Shield, 
  PoundSterling,
  Wrench,
  Building2,
  Users,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import { Link } from "react-router-dom";
import MarketingFooter from "@/components/MarketingFooter";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsBreadcrumbs from "@/components/docs/DocsBreadcrumbs";
import DocsMobileHeader from "@/components/docs/DocsMobileHeader";

interface ResourceCategory {
  icon: React.ElementType;
  title: string;
  description: string;
  links: { title: string; href: string; }[];
}

const resourceCategories: ResourceCategory[] = [
  {
    icon: BookOpen,
    title: "Getting Started",
    description: "New to SpannerWork? Start here.",
    links: [
      { title: "How SpannerWork Works", href: "/how-it-works" },
      { title: "Creating Your First Listing", href: "/guides/provider" },
      { title: "Finding What You Need", href: "/guides/renter" },
      { title: "Setting Up Your Profile", href: "/profile" },
    ],
  },
  {
    icon: PoundSterling,
    title: "Pricing & Payments",
    description: "Understand our fee structure and payment process.",
    links: [
      { title: "Pricing Overview", href: "/pricing" },
      { title: "Pricing Your Listings", href: "/guides/pricing" },
      { title: "Payment FAQs", href: "/pricing#faq" },
      { title: "Refund Policy", href: "/refund-policy" },
    ],
  },
  {
    icon: Shield,
    title: "Safety & Trust",
    description: "Stay safe and build trust on the platform.",
    links: [
      { title: "Safety Guidelines", href: "/safety" },
      { title: "Verification Process", href: "/verification" },
      { title: "Dispute Resolution", href: "/dispute-resolution" },
      { title: "Community Guidelines", href: "/terms" },
    ],
  },
  {
    icon: Users,
    title: "Provider Resources",
    description: "Maximize your earnings as a provider.",
    links: [
      { title: "Provider Guide", href: "/guides/provider" },
      { title: "Managing Bookings", href: "/calendar" },
      { title: "Analytics Dashboard", href: "/analytics" },
      { title: "Referral Programme", href: "/referrals" },
    ],
  },
];

const popularArticles = [
  { title: "How to take great photos of your tools", icon: Wrench },
  { title: "Setting competitive prices for your space", icon: Building2 },
  { title: "Building a 5-star reputation", icon: Users },
  { title: "What to do if something goes wrong", icon: HelpCircle },
];

export default function Resources(): JSX.Element {
  return (
    <>
      <SEO
        title="Resources | SpannerWork"
        description="Guides, tutorials, and FAQs to help you get the most out of SpannerWork."
      />

      <DocsMobileHeader />
      
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-brand-800 to-brand-900 text-white py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-8 h-8" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Resource Centre
            </h1>
            <p className="text-xl text-brand-100 max-w-2xl mx-auto">
              Everything you need to succeed on SpannerWork. Guides, tips, and answers to common questions.
            </p>
          </div>
        </div>

        <div className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <DocsBreadcrumbs />
          </div>
        </div>

        {/* Docs Navigation + Resource Categories */}
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="lg:flex lg:gap-8">
            <div className="hidden lg:block w-[280px] flex-none">
              <DocsSidebar />
            </div>

            <div className="min-w-0 flex-1">
              <div className="grid md:grid-cols-2 gap-6">
                {resourceCategories.map((category, idx) => (
                  <Card key={idx} className="shadow-lg">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center">
                          <category.icon className="w-5 h-5 text-brand-800" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{category.title}</CardTitle>
                          <CardDescription>{category.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {category.links.map((link, i) => (
                          <li key={i}>
                            <Link 
                              to={link.href}
                              className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                            >
                              <span className="text-gray-700 group-hover:text-brand-800">{link.title}</span>
                              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-brand-800" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Popular Articles */}
        <div className="bg-white py-16">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-center mb-8">Popular Articles</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {popularArticles.map((article, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <article.icon className="w-5 h-5 text-brand-800" />
                  </div>
                  <span className="font-medium text-gray-700">{article.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Contact CTA */}
        <div className="max-w-4xl mx-auto px-4 py-16">
          <Card className="bg-gradient-to-r from-brand-50 to-brand-50 border-brand-100">
            <CardContent className="p-8 text-center">
              <HelpCircle className="w-12 h-12 text-brand-800 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Can't Find What You're Looking For?</h3>
              <p className="text-gray-600 mb-6">
                Our support team is here to help. Get in touch and we'll get back to you within 24 hours.
              </p>
              <Link to="/contact">
                <Button className="bg-brand-800 hover:bg-brand-900">
                  Contact Support
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <MarketingFooter />
      </div>
    </>
  );
}
