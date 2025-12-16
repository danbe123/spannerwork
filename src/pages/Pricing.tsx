/**
 * Pricing Page
 * 
 * Displays SpannerWork's pricing structure and fee information.
 */

import { Check, Shield, Zap, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import SEO from "@/components/SEO";
import { Link } from "react-router-dom";

interface PricingFeature {
  text: string;
  included: boolean;
}

interface PricingTier {
  name: string;
  description: string;
  price: string;
  priceDescription: string;
  features: PricingFeature[];
  highlighted?: boolean;
  cta: string;
  ctaLink: string;
}

const pricingTiers: PricingTier[] = [
  {
    name: "Seekers",
    description: "Looking to rent tools, spaces, or hire services",
    price: "Free",
    priceDescription: "No subscription required",
    features: [
      { text: "Browse all listings", included: true },
      { text: "Post unlimited requests", included: true },
      { text: "Message providers directly", included: true },
      { text: "Secure payments", included: true },
      { text: "Review & rating system", included: true },
      { text: "5% platform fee on bookings", included: true },
    ],
    cta: "Start Searching",
    ctaLink: "/feed",
  },
  {
    name: "Providers",
    description: "Rent out your tools, spaces, or offer services",
    price: "Free",
    priceDescription: "No listing fees",
    features: [
      { text: "Unlimited tool listings", included: true },
      { text: "Unlimited space listings", included: true },
      { text: "Unlimited service offerings", included: true },
      { text: "Real-time booking management", included: true },
      { text: "Analytics dashboard", included: true },
      { text: "5% platform fee on earnings", included: true },
    ],
    highlighted: true,
    cta: "Start Earning",
    ctaLink: "/create",
  },
];

const faqs = [
  {
    question: "How does the 5% platform fee work?",
    answer: "We charge a 5% platform fee on each successful transaction. This covers payment processing, insurance, customer support, and platform maintenance. There are no hidden fees or subscription costs.",
  },
  {
    question: "When do I get paid as a provider?",
    answer: "Payments are released to providers within 24-48 hours after the rental period ends or service is completed, once both parties confirm the transaction.",
  },
  {
    question: "Are there any listing fees?",
    answer: "No! Listing your tools, spaces, or services on SpannerWork is completely free. You only pay the 5% fee when you make a successful transaction.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit and debit cards. All payments are processed securely through our payment partner.",
  },
  {
    question: "Is there a deposit required?",
    answer: "Providers can set their own deposit amounts for tool and space rentals. Deposits are held securely and returned after successful completion of the rental.",
  },
];

export default function Pricing(): JSX.Element {
  return (
    <>
      <SEO
        title="Pricing | SpannerWork"
        description="Simple, transparent pricing. No subscription fees, no hidden costs. Just a 5% platform fee on successful transactions."
      />
      
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-brand-800 to-brand-900 text-white py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-orange-100 max-w-2xl mx-auto">
              No subscriptions. No hidden fees. Just a fair 5% platform fee when you make money.
            </p>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="max-w-5xl mx-auto px-4 -mt-8">
          <div className="grid md:grid-cols-2 gap-6">
            {pricingTiers.map((tier) => (
              <Card 
                key={tier.name}
                className={`relative ${tier.highlighted ? 'border-brand-800 border-2 shadow-xl' : 'shadow-lg'}`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-800 text-white text-sm font-medium px-4 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-gray-900">{tier.price}</div>
                    <div className="text-gray-500 text-sm">{tier.priceDescription}</div>
                  </div>
                  
                  <ul className="space-y-3">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span className="text-gray-700">{feature.text}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Link to={tier.ctaLink}>
                    <Button 
                      className={`w-full ${tier.highlighted ? 'bg-brand-800 hover:bg-brand-900' : ''}`}
                      variant={tier.highlighted ? 'default' : 'outline'}
                    >
                      {tier.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Value Props */}
        <div className="max-w-5xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-center mb-8">What's Included</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-brand-800" />
              </div>
              <h3 className="font-semibold mb-2">Secure Payments</h3>
              <p className="text-gray-600 text-sm">All transactions protected with bank-level security</p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-brand-800" />
              </div>
              <h3 className="font-semibold mb-2">Instant Matching</h3>
              <p className="text-gray-600 text-sm">Connect with nearby providers in minutes</p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-brand-800" />
              </div>
              <h3 className="font-semibold mb-2">Trusted Community</h3>
              <p className="text-gray-600 text-sm">Verified users with reviews and ratings</p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto px-4 pb-16">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, idx) => (
              <AccordionItem key={idx} value={`faq-${idx}`} className="bg-white rounded-lg border px-4">
                <AccordionTrigger className="text-left font-medium">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </>
  );
}
