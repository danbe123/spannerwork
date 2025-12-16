/**
 * Safety Page
 *
 * Information about SpannerWork's safety features and guidelines.
 */

import React from "react";
import { Shield, CheckCircle, AlertTriangle, Users, Lock, MessageCircle, Phone, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import { Link } from "react-router-dom";

interface SafetyFeature {
  icon: React.ElementType;
  title: string;
  description: string;
}

const safetyFeatures: SafetyFeature[] = [
  {
    icon: Users,
    title: "Verified Users",
    description: "All users can verify their identity through email and phone verification. Look for the verified badge when choosing who to work with.",
  },
  {
    icon: Shield,
    title: "Secure Payments",
    description: "All payments are processed through our secure platform. Never pay outside of SpannerWork to ensure you're protected.",
  },
  {
    icon: MessageCircle,
    title: "In-App Messaging",
    description: "Keep all communication within the app. This creates a record and helps our support team if any issues arise.",
  },
  {
    icon: Lock,
    title: "Data Protection",
    description: "Your personal information is encrypted and never shared without your consent. We comply with UK GDPR regulations.",
  },
  {
    icon: FileText,
    title: "Clear Agreements",
    description: "Every transaction includes clear terms about the rental period, costs, and responsibilities of both parties.",
  },
  {
    icon: Phone,
    title: "Support Team",
    description: "Our dedicated support team is available to help resolve any disputes or concerns quickly and fairly.",
  },
];

const safetyTips = [
  "Always meet in a safe, public place for tool handovers when possible",
  "Check the condition of items before accepting them",
  "Take photos of tools and spaces before and after use",
  "Report any suspicious behaviour immediately",
  "Read reviews and ratings before booking",
  "Never share your password or payment details directly",
  "Use the in-app messaging for all communications",
  "Complete all transactions through the SpannerWork platform",
];

export default function Safety(): JSX.Element {
  return (
    <>
      <SEO
        title="Safety | SpannerWork"
        description="Learn about SpannerWork's safety features and best practices for secure tool rentals and service bookings."
      />
      
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-[#2E7D32] to-[#1B5E20] text-white py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Your Safety Matters
            </h1>
            <p className="text-xl text-green-100 max-w-2xl mx-auto">
              We've built SpannerWork with safety at its core. Here's how we protect you and your transactions.
            </p>
          </div>
        </div>

        {/* Safety Features Grid */}
        <div className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-center mb-8">Built-in Safety Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {safetyFeatures.map((feature, idx) => (
              <Card key={idx} className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-2">
                    <feature.icon className="w-5 h-5 text-green-600" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Safety Tips */}
        <div className="bg-white py-16">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-center mb-8">Safety Tips</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {safetyTips.map((tip, idx) => (
                <div key={idx} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Report Section */}
        <div className="max-w-4xl mx-auto px-4 py-16">
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">See Something Suspicious?</h3>
              <p className="text-gray-600 mb-6">
                If you encounter any suspicious activity, fraudulent listings, or safety concerns,
                please report them immediately. We take all reports seriously.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/contact">
                  <Button className="bg-amber-600 hover:bg-amber-700">
                    Report an Issue
                  </Button>
                </Link>
                <Link to="/guides/safety">
                  <Button variant="outline">
                    Read Full Safety Guide
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
