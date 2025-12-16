import { createPageUrl } from "@/utils";
import { Wrench, Send, Facebook, Twitter, Instagram, Shield, Award, Users, CheckCircle } from "lucide-react";
import { FormEvent } from "react";

export default function MarketingFooter() {
  const handleNewsletterSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Newsletter signup logic would go here
  };

  return (
    <footer className="relative bg-[#37474F] text-white overflow-hidden">
      <div className="relative">
        {/* Top section with newsletter */}
        <div className="border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-3xl font-bold mb-2 flex items-center gap-2">
                  <Wrench className="w-8 h-8 text-[#FFC107]" />
                  Stay Connected
                </h3>
                <p className="text-gray-400 text-lg">Get weekly tips, success stories, and local job alerts</p>
              </div>
              <div>
                <form className="flex gap-3" onSubmit={handleNewsletterSubmit}>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-gray-400 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-brand-800"
                    required
                  />
                  <button type="submit" className="bg-gradient-to-r from-brand-800 to-brand-900 hover:from-brand-900 hover:to-[#A52A14] px-8 py-3 rounded-lg font-semibold shadow-lg transition-all flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Subscribe
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Main footer content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-5 gap-12 mb-12">
            {/* Brand column */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-brand-800 to-brand-900 rounded-xl flex items-center justify-center shadow-xl transform hover:rotate-12 transition-transform">
                  <Wrench className="w-8 h-8 text-white" />
                </div>
                <div>
                  <span className="font-bold text-3xl">SpannerWork</span>
                  <p className="text-[#FFC107] text-sm font-semibold">Tools. Skills. Space.</p>
                </div>
              </div>
              <p className="text-gray-400 leading-relaxed mb-6">
                Your local network for tools, expertise, and workspace. Stop paying dealership prices—get what you need from neighbors who know their stuff.
              </p>

              {/* Trust badges */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="w-5 h-5 text-[#FFC107]" />
                  <span className="text-gray-300">Secure Payments</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Award className="w-5 h-5 text-[#FFC107]" />
                  <span className="text-gray-300">Verified Users</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-5 h-5 text-[#FFC107]" />
                  <span className="text-gray-300">Community Members</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-5 h-5 text-[#FFC107]" />
                  <span className="text-gray-300">4.8★ Rated</span>
                </div>
              </div>

              {/* Social links */}
              <div className="flex gap-3">
                <a href="#" className="w-10 h-10 rounded-lg bg-white/10 hover:bg-brand-800 flex items-center justify-center transition-all hover:scale-110">
                  <Facebook className="w-5 h-5" />
                </a>
                <a href="#" className="w-10 h-10 rounded-lg bg-white/10 hover:bg-brand-800 flex items-center justify-center transition-all hover:scale-110">
                  <Twitter className="w-5 h-5" />
                </a>
                <a href="#" className="w-10 h-10 rounded-lg bg-white/10 hover:bg-brand-800 flex items-center justify-center transition-all hover:scale-110">
                  <Instagram className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Product links */}
            <div>
              <h3 className="font-bold text-lg mb-4 text-[#FFC107]">Product</h3>
              <ul className="space-y-3">
                <li><a href={createPageUrl("HowItWorks")} className="text-gray-400 hover:text-white transition-colors hover:translate-x-1 inline-block">How It Works</a></li>
                <li><a href={createPageUrl("Pricing")} className="text-gray-400 hover:text-white transition-colors hover:translate-x-1 inline-block">Pricing</a></li>
                <li><a href={createPageUrl("Safety")} className="text-gray-400 hover:text-white transition-colors hover:translate-x-1 inline-block">Safety</a></li>
              </ul>
            </div>

            {/* For Providers links */}
            <div>
              <h3 className="font-bold text-lg mb-4 text-[#FFC107]">For Providers</h3>
              <ul className="space-y-3">
                <li><a href={createPageUrl("StartEarning")} className="text-gray-400 hover:text-white transition-colors hover:translate-x-1 inline-block">Start Earning</a></li>
                <li><a href={createPageUrl("SuccessStories")} className="text-gray-400 hover:text-white transition-colors hover:translate-x-1 inline-block">Success Stories</a></li>
                <li><a href={createPageUrl("Resources")} className="text-gray-400 hover:text-white transition-colors hover:translate-x-1 inline-block">Resources</a></li>
              </ul>
            </div>

            {/* Company links */}
            <div>
              <h3 className="font-bold text-lg mb-4 text-[#FFC107]">Company</h3>
              <ul className="space-y-3">
                <li><a href={createPageUrl("About")} className="text-gray-400 hover:text-white transition-colors hover:translate-x-1 inline-block">About Us</a></li>
                <li><a href={createPageUrl("Contact")} className="text-gray-400 hover:text-white transition-colors hover:translate-x-1 inline-block">Contact</a></li>
                <li><a href={createPageUrl("Terms")} className="text-gray-400 hover:text-white transition-colors hover:translate-x-1 inline-block">Terms</a></li>
                <li><a href={createPageUrl("Privacy")} className="text-gray-400 hover:text-white transition-colors hover:translate-x-1 inline-block">Privacy</a></li>
                <li><a href={createPageUrl("Cookies")} className="text-gray-400 hover:text-white transition-colors hover:translate-x-1 inline-block">Cookies</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 text-sm">
              &copy; 2025 SpannerWork. Built by mechanics, for mechanics. All rights reserved.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Built with a</span>
              <Wrench className="w-4 h-4 text-brand-800 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
