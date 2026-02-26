import { createPageUrl } from "@/utils";
import { Wrench, Send, Facebook, Instagram, Linkedin, Shield, Award, Users, CheckCircle } from "lucide-react";
import { FormEvent } from "react";

function XLogoIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.4l-5-6.2L6.2 22H2.9l7.3-8.4L.8 2h6.5l4.6 5.6L18.9 2Zm-1.1 18h1.7L7 3.9H5.2L17.8 20Z" />
    </svg>
  );
}

function ThreadsLogoIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 1.75c-5.65 0-10.25 4.6-10.25 10.25S6.35 22.25 12 22.25 22.25 17.65 22.25 12 17.65 1.75 12 1.75Zm0 18.7a8.45 8.45 0 1 1 0-16.9 8.45 8.45 0 0 1 0 16.9Z" />
      <path d="M12 6.2c-2.35 0-4.2 1.6-4.2 3.65h1.8c0-1.1 1.1-1.85 2.4-1.85 1.45 0 2.45.85 2.45 2.05 0 .25-.03.48-.1.7-1.2-.65-2.86-.8-4.2-.4-1.45.45-2.35 1.55-2.35 2.9 0 1.9 1.55 3.25 3.75 3.25 2.05 0 3.65-1.2 4.05-2.95.35-1.55-.08-2.95-1.05-3.85.12-.4.18-.8.18-1.25 0-2.2-1.8-3.9-4.2-3.9Zm2.95 8.55c-.25 1.05-1.2 1.75-2.45 1.75-1.15 0-1.95-.65-1.95-1.45 0-.6.42-1.08 1.15-1.3 1.02-.3 2.45-.12 3.32.48.05.47.02.99-.07 1.52Z" />
    </svg>
  );
}

function TikTokLogoIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M16.5 2h-2.1v12.1c0 1.7-1.4 3-3.1 3-1.7 0-3-1.3-3-3s1.3-3 3-3c.4 0 .8.1 1.1.2V9.1c-.4-.1-.8-.1-1.1-.1-3 0-5.4 2.4-5.4 5.4s2.4 5.4 5.4 5.4c3 0 5.5-2.4 5.5-5.4V8.2c1.2.9 2.7 1.4 4.2 1.4V7.4c-2.4 0-4.4-2-4.4-4.4Z" />
    </svg>
  );
}

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
                <p className="text-gray-300 text-lg">Get weekly tips, success stories, and local job alerts</p>
              </div>
              <div>
                <form className="flex flex-col sm:flex-row gap-3" onSubmit={handleNewsletterSubmit}>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-gray-300 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-brand-800"
                    required
                  />
                  <button type="submit" className="bg-gradient-to-r from-brand-800 to-brand-900 hover:from-brand-900 hover:to-[#A52A14] px-6 sm:px-8 py-3 rounded-lg font-semibold shadow-lg transition-all flex items-center justify-center gap-2">
                    <Send className="w-4 h-4" />
                    Subscribe
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Main footer content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-x-8 gap-y-8 md:gap-12 mb-8 md:mb-12">
            {/* Brand column */}
            <div className="col-span-2 md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-brand-800 to-brand-900 rounded-xl flex items-center justify-center shadow-xl transform hover:rotate-12 transition-transform">
                  <Wrench className="w-8 h-8 text-white" />
                </div>
                <div>
                  <span className="font-bold text-3xl">SpannerWork</span>
                  <p className="text-[#FFC107] text-sm font-semibold">Tools. Skills. Space.</p>
                </div>
              </div>
              <p className="text-gray-300 leading-relaxed mb-4 md:mb-6">
                Your local network for tools, expertise, and workspace. Stop paying dealership prices—get what you need from neighbors who know their stuff.
              </p>

              {/* Trust badges */}
              <div className="hidden md:grid grid-cols-2 gap-3 mb-6">
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
              <div className="hidden md:flex items-center gap-3">
                <a
                  href="#"
                  aria-label="Facebook"
                  className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                >
                  <Facebook className="w-5 h-5" />
                </a>
                <a
                  href="#"
                  aria-label="X"
                  className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                >
                  <XLogoIcon className="w-5 h-5" />
                </a>
                <a
                  href="#"
                  aria-label="Instagram"
                  className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                >
                  <Instagram className="w-5 h-5" />
                </a>
                <a
                  href="#"
                  aria-label="LinkedIn"
                  className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                >
                  <Linkedin className="w-5 h-5" />
                </a>
                <a
                  href="#"
                  aria-label="Threads"
                  className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                >
                  <ThreadsLogoIcon className="w-5 h-5" />
                </a>
                <a
                  href="#"
                  aria-label="TikTok"
                  className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                >
                  <TikTokLogoIcon className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Product links */}
            <div>
              <h3 className="font-bold text-lg mb-3 md:mb-4 text-[#FFC107]">Product</h3>
              <ul className="space-y-2 md:space-y-3">
                <li><a href={createPageUrl("HowItWorks")} className="block text-gray-300 hover:text-white transition-colors md:hover:translate-x-1 md:inline-block truncate">How It Works</a></li>
                <li><a href={createPageUrl("Pricing")} className="block text-gray-300 hover:text-white transition-colors md:hover:translate-x-1 md:inline-block truncate">Pricing</a></li>
                <li><a href={createPageUrl("Safety")} className="block text-gray-300 hover:text-white transition-colors md:hover:translate-x-1 md:inline-block truncate">Safety</a></li>
                <li><a href="/blog" className="block text-gray-300 hover:text-white transition-colors md:hover:translate-x-1 md:inline-block truncate">Blog</a></li>
              </ul>
            </div>

            {/* For Providers links */}
            <div>
              <h3 className="font-bold text-lg mb-3 md:mb-4 text-[#FFC107]">For Providers</h3>
              <ul className="space-y-2 md:space-y-3">
                <li><a href="/resources/start-earning" className="block text-gray-300 hover:text-white transition-colors md:hover:translate-x-1 md:inline-block truncate">Start Earning</a></li>
                <li><a href="/resources/success-stories" className="block text-gray-300 hover:text-white transition-colors md:hover:translate-x-1 md:inline-block truncate">Success Stories</a></li>
                <li><a href={createPageUrl("Resources")} className="block text-gray-300 hover:text-white transition-colors md:hover:translate-x-1 md:inline-block truncate">Resources</a></li>
              </ul>
            </div>

            {/* Company links */}
            <div className="md:col-span-1">
              <h3 className="font-bold text-lg mb-3 md:mb-4 text-[#FFC107]">Company</h3>
              <ul className="space-y-2 md:space-y-3">
                <li><a href={createPageUrl("About")} className="block text-gray-300 hover:text-white transition-colors md:hover:translate-x-1 md:inline-block truncate">About Us</a></li>
                <li><a href={createPageUrl("Contact")} className="block text-gray-300 hover:text-white transition-colors md:hover:translate-x-1 md:inline-block truncate">Contact</a></li>
                <li><a href={createPageUrl("Terms")} className="block text-gray-300 hover:text-white transition-colors md:hover:translate-x-1 md:inline-block truncate">Terms</a></li>
                <li><a href={createPageUrl("Privacy")} className="block text-gray-300 hover:text-white transition-colors md:hover:translate-x-1 md:inline-block truncate">Privacy</a></li>
                <li><a href={createPageUrl("Cookies")} className="block text-gray-300 hover:text-white transition-colors md:hover:translate-x-1 md:inline-block truncate">Cookies</a></li>
              </ul>
            </div>

            <div className="md:hidden">
              <h3 className="font-bold text-lg mb-3 text-[#FFC107]">Connect</h3>
              <div className="space-y-3 mb-5">
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
            </div>
          </div>

          <div className="md:hidden border-t border-white/10 py-3">
            <div className="grid grid-cols-6 w-full">
              <a
                href="#"
                aria-label="Facebook"
                className="w-full py-2 flex items-center justify-center text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="#"
                aria-label="X"
                className="w-full py-2 flex items-center justify-center text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10"
              >
                <XLogoIcon className="w-5 h-5" />
              </a>
              <a
                href="#"
                aria-label="Instagram"
                className="w-full py-2 flex items-center justify-center text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="#"
                aria-label="LinkedIn"
                className="w-full py-2 flex items-center justify-center text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a
                href="#"
                aria-label="Threads"
                className="w-full py-2 flex items-center justify-center text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10"
              >
                <ThreadsLogoIcon className="w-5 h-5" />
              </a>
              <a
                href="#"
                aria-label="TikTok"
                className="w-full py-2 flex items-center justify-center text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10"
              >
                <TikTokLogoIcon className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t-0 md:border-t border-white/10 pt-4 md:pt-8 flex flex-col md:flex-row justify-between items-center gap-2 md:gap-4 text-center md:text-left">
            <p className="text-gray-300 text-sm">
              &copy; 2025 SpannerWork. Built by mechanics, for mechanics. All rights reserved.
            </p>
            <div className="flex items-center gap-2 justify-center">
              <span className="text-xs text-gray-300">Built with a</span>
              <Wrench className="w-4 h-4 text-[#FFC107] animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
