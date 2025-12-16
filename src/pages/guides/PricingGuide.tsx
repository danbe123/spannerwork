import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowLeft, 
  TrendingUp, 
  PoundSterling, 
  Calculator, 
  Calendar, 
  Package,
  CheckCircle2,
  Lightbulb,
  BarChart3,
  Percent,
  Clock,
  Shield
} from "lucide-react";
import MarketingFooter from "../../components/MarketingFooter";
import SEO from "@/components/SEO";

interface PricingCategory {
  category: string;
  examples: string[];
  dailyRange: string;
  weeklyRange: string;
  depositRange: string;
}

interface GuideSection {
  icon: React.ElementType;
  title: string;
  content: string[];
  tips?: string[];
}

export default function PricingGuide(): JSX.Element {
  const navigate = useNavigate();

  const pricingCategories: PricingCategory[] = [
    {
      category: "Hand Tools & Power Tools",
      examples: ["Drills, Grinders, Jigsaws, Sanders"],
      dailyRange: "£10-25",
      weeklyRange: "£40-100",
      depositRange: "£30-100"
    },
    {
      category: "Diagnostic Equipment",
      examples: ["OBD Scanners, Multimeters, Timing Lights"],
      dailyRange: "£20-50",
      weeklyRange: "£80-200",
      depositRange: "£100-300"
    },
    {
      category: "Lifting & Support",
      examples: ["Engine Hoists, Jack Stands, Axle Stands"],
      dailyRange: "£25-50",
      weeklyRange: "£100-200",
      depositRange: "£100-250"
    },
    {
      category: "Specialist Automotive",
      examples: ["Timing Kits, Bearing Presses, Spring Compressors"],
      dailyRange: "£15-40",
      weeklyRange: "£60-160",
      depositRange: "£50-200"
    },
    {
      category: "Workshop Equipment",
      examples: ["Hydraulic Presses, Brake Lathes, Tyre Machines"],
      dailyRange: "£40-100",
      weeklyRange: "£160-400",
      depositRange: "£200-500"
    },
    {
      category: "Workshop Space",
      examples: ["Ramp Bay, Pit Bay, Open Bay"],
      dailyRange: "£30-80",
      weeklyRange: "£150-400",
      depositRange: "£100-300"
    }
  ];

  const sections: GuideSection[] = [
    {
      icon: Calculator,
      title: "Finding Your Starting Price",
      content: [
        "Don't overthink it! A good starting point is to look at what you paid for your item and think about earning that back over time.",
        "Have a quick look at similar items listed nearby. This gives you a sense of what people are willing to pay in your area.",
        "Remember to value your own time too - you'll be arranging pickups, answering questions, and keeping things in good nick.",
        "It's okay to start a bit lower while you're new. Getting those first few rentals and reviews is really valuable."
      ],
      tips: [
        "Good photos help justify your price",
        "Start lower, then increase as you get reviews",
        "Check similar listings in your area"
      ]
    },
    {
      icon: Calendar,
      title: "Offering Different Rental Lengths",
      content: [
        "Some people need a tool for a day, others for a week. Offering both options means you won't miss out on bookings.",
        "For weekly rentals, you don't need to charge 7x your daily rate - a small discount (like 4-5 days' worth) encourages longer bookings and means less hassle for you.",
        "Longer rentals are often easier - one handover instead of several, and you know your item is booked."
      ],
      tips: [
        "Daily rate for quick jobs",
        "Weekly rate with a small discount built in",
        "Less back-and-forth with longer rentals"
      ]
    },
    {
      icon: Percent,
      title: "Discounts That Work",
      content: [
        "A small discount for first-time renters can help you get those important early reviews. It's worth it!",
        "If someone wants to rent a few items together, a little money off encourages them to book more from you.",
        "Look after your repeat customers - they're reliable and you already know they'll take care of your stuff."
      ],
      tips: [
        "A little off for first-timers",
        "Bundle deals for multiple items",
        "Reward customers who come back"
      ]
    },
    {
      icon: Shield,
      title: "Protecting Your Stuff with Deposits",
      content: [
        "A deposit gives you peace of mind. If something goes wrong, you're covered.",
        "How much? Enough to make the renter careful, but not so much it puts people off. Somewhere between a quarter and half of what it would cost to replace is usually right.",
        "Be clear upfront about what the deposit covers. If everyone knows where they stand, there's less chance of any awkwardness later.",
        "When things go well (and they usually do!), return the deposit quickly. People really appreciate that."
      ],
      tips: [
        "Enough to cover potential issues",
        "Be clear about what it's for",
        "Return it promptly after a good rental"
      ]
    },
    {
      icon: Clock,
      title: "Busy Times and Quiet Times",
      content: [
        "Spring and summer weekends tend to be busier - everyone's doing projects! You might find you can charge a bit more then.",
        "Bank holidays are popular too. People have time off and want to get things done.",
        "Quieter times? That's okay. You could offer a small discount to keep things moving, or just enjoy the break."
      ],
      tips: [
        "Weekends and bank holidays are popular",
        "Summer is usually busier",
        "Quiet periods can mean a bit off to attract bookings"
      ]
    },
    {
      icon: BarChart3,
      title: "Tweaking as You Go",
      content: [
        "Your first price doesn't have to be perfect. You can always adjust based on how things go.",
        "Getting lots of interest but not many bookings? You might be a touch high. No interest at all? Maybe drop it a bit or improve your photos.",
        "As you get more reviews and people know you're reliable, you can gradually increase your rates."
      ],
      tips: [
        "It's fine to adjust your prices",
        "Reviews help you charge more over time",
        "Watch what's working and what isn't"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="Pricing Guide - Set Competitive Rates | SpannerWork"
        description="Complete pricing guide for SpannerWork providers. Learn how to set daily rates, offer discounts, determine deposits, and maximise your rental income."
        keywords="tool rental pricing, how to price rentals, equipment rental rates UK, SpannerWork pricing guide"
      />

      {/* Hero */}
      <div className="bg-gradient-to-r from-brand-800 to-brand-900 text-white px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/resources")}
            className="mb-6 text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Resources
          </Button>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold">Pricing Guide</h1>
              <p className="text-xl text-orange-100 mt-2">Simple tips to help you price your listings with confidence</p>
            </div>
          </div>
        </div>
      </div>

      {/* Market Rates Table */}
      <div className="bg-gray-50 border-b">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h3 className="text-center text-lg font-semibold text-gray-900 mb-6">
            <PoundSterling className="inline w-5 h-5 mr-1" />
            Rough Price Guide to Get You Started
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Category</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Examples</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Daily</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Weekly</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Deposit</th>
                </tr>
              </thead>
              <tbody>
                {pricingCategories.map((cat, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-white">
                    <td className="py-3 px-4 font-medium text-gray-900">{cat.category}</td>
                    <td className="py-3 px-4 text-gray-600 text-xs">{cat.examples.join(", ")}</td>
                    <td className="py-3 px-4 text-center text-brand-800 font-semibold">{cat.dailyRange}</td>
                    <td className="py-3 px-4 text-center text-brand-800 font-semibold">{cat.weeklyRange}</td>
                    <td className="py-3 px-4 text-center text-gray-600">{cat.depositRange}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 text-center mt-4">
            These are just rough guides to give you an idea. Your area, your item's condition, and the brand 
            all make a difference. Have a look at what others are charging nearby!
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Quick Pricing Tip */}
        <Card className="mb-12 border-none shadow-lg bg-gradient-to-br from-orange-50 to-amber-50">
          <CardContent className="p-8">
            <div className="flex items-start gap-4">
              <Lightbulb className="w-8 h-8 text-brand-800 flex-shrink-0" />
              <div>
                <h2 className="text-xl font-bold mb-3">Simple Pricing Tip</h2>
                <p className="text-gray-700 mb-4">
                  <strong>Aim to earn back what you paid in around 15-25 rentals.</strong>
                </p>
                <p className="text-gray-700 mb-4">
                  For example, if your tool cost £200, charging £10-15 per day means you'd cover your 
                  cost after about 15-20 rentals. After that, it's all profit minus any running costs.
                </p>
                <p className="text-gray-600 text-sm">
                  Popular items can be priced a bit higher. Items that rent less often might need 
                  lower prices to attract bookings.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sections */}
        <div className="space-y-12">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <div key={index} className="scroll-mt-20" id={section.title.toLowerCase().replace(/\s+/g, '-')}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-brand-800 to-brand-900 rounded-xl flex items-center justify-center">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold">{section.title}</h2>
                </div>

                <div className="space-y-4 mb-6">
                  {section.content.map((paragraph, pIndex) => (
                    <p key={pIndex} className="text-gray-700 leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {section.tips && (
                  <Card className="bg-gray-50 border-gray-200">
                    <CardContent className="p-6">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        Quick Tips
                      </h4>
                      <ul className="grid md:grid-cols-2 gap-2">
                        {section.tips.map((tip, tIndex) => (
                          <li key={tIndex} className="text-sm text-gray-600 flex items-start gap-2">
                            <span className="text-brand-800 mt-1">•</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {index < sections.length - 1 && <hr className="mt-12 border-gray-200" />}
              </div>
            );
          })}
        </div>

        {/* Example */}
        <Card className="mt-12 border-2 border-brand-800/20">
          <CardContent className="p-8">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Calculator className="w-6 h-6 text-brand-800" />
              Example: Pricing an Engine Hoist
            </h3>
            <div className="space-y-3 text-gray-700">
              <p><strong>You paid:</strong> £280 for an engine hoist</p>
              <p><strong>To earn that back in ~20 rentals:</strong> £280 ÷ 20 = £14 minimum per day</p>
              <p><strong>Suggested daily rate:</strong> £25-35 (round up and account for your time)</p>
              <p><strong>Weekly rate:</strong> £100-140 (offer a small discount for longer rentals)</p>
              <p><strong>Deposit:</strong> Around £100-150 to protect against damage</p>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <Card className="mt-12 bg-gradient-to-r from-brand-800 to-brand-900 border-none text-white">
          <CardContent className="p-12 text-center">
            <Package className="w-16 h-16 mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">Ready to Give It a Go?</h2>
            <p className="text-xl text-orange-100 mb-8">
              You've got this! Start with what feels right and adjust from there.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate("/create?intent=offer")}
                size="lg"
                className="bg-white text-brand-800 hover:bg-orange-50 text-lg px-8 py-6 font-bold"
              >
                Create a Listing
              </Button>
              <Button
                onClick={() => navigate("/guides/provider")}
                variant="outline"
                size="lg"
                className="border-white text-white hover:bg-white/10 text-lg px-8 py-6"
              >
                Provider's Guide
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <MarketingFooter />
    </div>
  );
}
