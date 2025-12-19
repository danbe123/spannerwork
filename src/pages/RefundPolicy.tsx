/**
 * Refund Policy Page
 *
 * Details SpannerWork's refund and cancellation policies.
 */

import React from "react";
import { PoundSterling, Clock, AlertCircle, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import SEO from "@/components/SEO";
import { Link } from "react-router-dom";
import MarketingFooter from "@/components/MarketingFooter";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsBreadcrumbs from "@/components/docs/DocsBreadcrumbs";
import DocsMobileHeader from "@/components/docs/DocsMobileHeader";

interface RefundScenario {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  description: string;
  refundAmount: string;
}

const refundScenarios: RefundScenario[] = [
  {
    title: "Cancellation 48+ hours before",
    icon: CheckCircle,
    iconColor: "text-green-500",
    description: "Full refund if you cancel more than 48 hours before the rental start time.",
    refundAmount: "100% refund",
  },
  {
    title: "Cancellation 24-48 hours before",
    icon: Clock,
    iconColor: "text-yellow-500",
    description: "Partial refund if you cancel between 24 and 48 hours before the rental start time.",
    refundAmount: "50% refund",
  },
  {
    title: "Cancellation under 24 hours",
    icon: XCircle,
    iconColor: "text-red-500",
    description: "No refund for cancellations made less than 24 hours before the rental start time.",
    refundAmount: "No refund",
  },
  {
    title: "Provider cancellation",
    icon: CheckCircle,
    iconColor: "text-green-500",
    description: "Full refund if the provider cancels the booking at any time.",
    refundAmount: "100% refund",
  },
  {
    title: "Item not as described",
    icon: AlertCircle,
    iconColor: "text-orange-500",
    description: "Full or partial refund if the item or service doesn't match the listing description.",
    refundAmount: "Up to 100% refund",
  },
];

const faqs = [
  {
    question: "How long do refunds take to process?",
    answer: "Refunds are typically processed within 5-7 business days. The exact timing depends on your bank or card provider.",
  },
  {
    question: "What about deposits?",
    answer: "Deposits are returned within 48 hours of the rental ending, assuming no damage or issues are reported. If there's a dispute, the deposit is held until resolution.",
  },
  {
    question: "Can I get a refund if the tool breaks during use?",
    answer: "If equipment fails through no fault of your own, you may be eligible for a partial refund. Please document the issue with photos and contact our support team.",
  },
  {
    question: "What if the provider doesn't show up?",
    answer: "If a provider fails to deliver or be available as agreed, you'll receive a full refund plus a £10 credit for your next booking.",
  },
  {
    question: "How do I request a refund?",
    answer: "Go to your booking in the app, tap 'Request Refund', and follow the prompts. You can also contact our support team directly.",
  },
  {
    question: "Are platform fees refunded?",
    answer: "Yes, platform fees are refunded in full when you receive a full refund. For partial refunds, the platform fee is proportionally refunded.",
  },
];

export default function RefundPolicy(): JSX.Element {
  return (
    <>
      <SEO
        title="Refund Policy | SpannerWork"
        description="Learn about SpannerWork's refund and cancellation policies for tool rentals, space bookings, and services."
      />

      <DocsMobileHeader />
      
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-brand-800 to-brand-900 text-white py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <PoundSterling className="w-8 h-8" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Refund Policy
            </h1>
            <p className="text-xl text-orange-100 max-w-2xl mx-auto">
              We aim to be fair to both seekers and providers. Here's how refunds work on SpannerWork.
            </p>
          </div>
        </div>

        <div className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <DocsBreadcrumbs />
          </div>
        </div>

        {/* Last Updated */}
        <div className="max-w-6xl mx-auto px-4 py-4">
          <p className="text-sm text-gray-500 text-center">
            Last updated: December 2024
          </p>
        </div>

        {/* Docs Navigation + Content */}
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="lg:flex lg:gap-8">
            <div className="hidden lg:block w-[280px] flex-none">
              <DocsSidebar />
            </div>

            <div className="min-w-0 flex-1">
              {/* Refund Scenarios */}
              <div className="mb-8">
          <h2 className="text-2xl font-bold text-center mb-8">Cancellation & Refund Scenarios</h2>
          <div className="space-y-4">
                {refundScenarios.map((scenario, idx) => (
                  <Card key={idx} className="shadow-md">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 mt-1">
                          <scenario.icon className={`w-6 h-6 ${scenario.iconColor}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <h3 className="font-semibold text-gray-900">{scenario.title}</h3>
                            <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                              scenario.refundAmount.includes('100%') ? 'bg-green-100 text-green-700' :
                              scenario.refundAmount.includes('50%') ? 'bg-yellow-100 text-yellow-700' :
                              scenario.refundAmount.includes('No') ? 'bg-red-100 text-red-700' :
                              'bg-orange-100 text-orange-700'
                            }`}>
                              {scenario.refundAmount}
                            </span>
                          </div>
                          <p className="text-gray-600 mt-1">{scenario.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              </div>

              {/* Important Notes */}
              <Card className="bg-amber-50 border-amber-200 mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-800">
                    <AlertCircle className="w-5 h-5" />
                    Important Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-amber-900 space-y-2">
                  <p>• Refund eligibility is based on the rental start time, not when you made the booking.</p>
                  <p>• For services, cancellation policies may vary based on the provider's terms.</p>
                  <p>• Disputes must be raised within 48 hours of the rental ending.</p>
                  <p>• Fraudulent refund claims may result in account suspension.</p>
                </CardContent>
              </Card>

              {/* FAQ Section */}
              <div className="mb-8">
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

              {/* Contact CTA */}
              <Card className="bg-gradient-to-r from-brand-50 to-orange-50 border-brand-100">
                <CardContent className="p-8 text-center">
                  <HelpCircle className="w-12 h-12 text-brand-800 mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">Need Help with a Refund?</h3>
                  <p className="text-gray-600 mb-6">
                    Our support team is here to help resolve any issues fairly and quickly.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link to="/dispute-resolution">
                      <Button className="bg-brand-800 hover:bg-brand-900">
                        Open a Dispute
                      </Button>
                    </Link>
                    <Link to="/contact">
                      <Button variant="outline">
                        Contact Support
                      </Button>
                    </Link>
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
