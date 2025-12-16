/**
 * Start Earning Page
 *
 * Landing page for potential providers to learn about earning on SpannerWork.
 */

import React from "react";
import { 
  PoundSterling, 
  Wrench, 
  Building2, 
  GraduationCap, 
  Clock, 
  TrendingUp, 
  Shield, 
  Calendar,
  ArrowRight,
  Star
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import { Link } from "react-router-dom";

interface EarningCategory {
  icon: React.ElementType;
  title: string;
  description: string;
  examples: string[];
  avgEarning: string;
  ctaLink: string;
}

const earningCategories: EarningCategory[] = [
  {
    icon: Wrench,
    title: "Rent Out Your Tools",
    description: "Turn your garage into a goldmine. Those tools sitting idle could be earning you money every week.",
    examples: ["Power drills", "Pressure washers", "Scaffolding", "Generators", "Specialist equipment"],
    avgEarning: "£15-50/day",
    ctaLink: "/create?intent=offer&category=tool",
  },
  {
    icon: Building2,
    title: "Share Your Space",
    description: "Got a workshop, garage, or storage space? Others need it and will pay for access.",
    examples: ["Workshop space", "Garage bays", "Storage units", "Studio space", "Parking spots"],
    avgEarning: "£20-100/day",
    ctaLink: "/create?intent=offer&category=space",
  },
  {
    icon: GraduationCap,
    title: "Offer Your Skills",
    description: "Your expertise is valuable. From plumbing to painting, help others while earning.",
    examples: ["Plumbing", "Electrical work", "Carpentry", "Decorating", "General repairs"],
    avgEarning: "£25-60/hour",
    ctaLink: "/create?intent=offer&category=service",
  },
];

const benefits = [
  { icon: Clock, title: "Flexible Hours", description: "You set your availability. Work when it suits you." },
  { icon: Shield, title: "Secure Payments", description: "Get paid directly to your bank. No chasing invoices." },
  { icon: Calendar, title: "Easy Scheduling", description: "Manage bookings with our simple calendar system." },
  { icon: TrendingUp, title: "Grow Your Reputation", description: "Build reviews and ratings to attract more customers." },
];

const steps = [
  { number: 1, title: "Create Your Listing", description: "Add photos, set your prices, and describe what you're offering." },
  { number: 2, title: "Get Discovered", description: "Local customers find you when they need what you have." },
  { number: 3, title: "Accept Bookings", description: "Review requests and accept the ones that work for you." },
  { number: 4, title: "Get Paid", description: "Receive secure payments directly to your account." },
];

export default function StartEarning(): JSX.Element {
  return (
    <>
      <SEO
        title="Start Earning | SpannerWork"
        description="Turn your tools, space, and skills into income. Join SpannerWork and start earning from what you already have."
      />
      
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-brand-800 to-brand-900 text-white py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-2 mb-6">
              <PoundSterling className="w-10 h-10" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Start Earning Today
            </h1>
            <p className="text-xl text-orange-100 max-w-2xl mx-auto mb-8">
              You have tools, space, or skills that others need. Turn them into a steady income stream.
            </p>
            <Link to="/create?intent=offer">
              <Button size="lg" className="bg-white text-brand-800 hover:bg-gray-100">
                Create Your First Listing
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Earning Categories */}
        <div className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-center mb-4">Three Ways to Earn</h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Choose what works for you. Many providers combine all three to maximise their earnings.
          </p>
          
          <div className="grid md:grid-cols-3 gap-6">
            {earningCategories.map((category, idx) => (
              <Card key={idx} className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4">
                    <category.icon className="w-6 h-6 text-brand-800" />
                  </div>
                  <CardTitle className="text-xl">{category.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-600">{category.description}</p>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Popular items:</p>
                    <div className="flex flex-wrap gap-2">
                      {category.examples.slice(0, 3).map((example, i) => (
                        <span key={i} className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {example}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div>
                      <p className="text-sm text-gray-500">Avg. earnings</p>
                      <p className="font-bold text-brand-800">{category.avgEarning}</p>
                    </div>
                    <Link to={category.ctaLink}>
                      <Button size="sm" className="bg-brand-800 hover:bg-brand-900">
                        Start
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white py-16">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-center mb-12">How It Works</h2>
            <div className="grid md:grid-cols-4 gap-8">
              {steps.map((step) => (
                <div key={step.number} className="text-center">
                  <div className="w-12 h-12 bg-brand-800 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                    {step.number}
                  </div>
                  <h3 className="font-semibold mb-2">{step.title}</h3>
                  <p className="text-gray-600 text-sm">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="max-w-5xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-center mb-12">Why Providers Love SpannerWork</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, idx) => (
              <div key={idx} className="text-center p-6 bg-white rounded-xl shadow-md">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <benefit.icon className="w-6 h-6 text-brand-800" />
                </div>
                <h3 className="font-semibold mb-2">{benefit.title}</h3>
                <p className="text-gray-600 text-sm">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-brand-800 to-brand-900 py-16">
          <div className="max-w-3xl mx-auto px-4 text-center text-white">
            <Star className="w-12 h-12 mx-auto mb-4 opacity-80" />
            <h2 className="text-3xl font-bold mb-4">Ready to Start Earning?</h2>
            <p className="text-orange-100 mb-8">
              Join thousands of providers already earning on SpannerWork. 
              It takes less than 5 minutes to create your first listing.
            </p>
            <Link to="/create?intent=offer">
              <Button size="lg" className="bg-white text-brand-800 hover:bg-gray-100">
                Create Your Listing Now
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
