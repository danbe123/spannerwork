/**
 * MarketingLayout - Lightweight layout for marketing pages
 *
 * This layout is used for public marketing pages (home, about, pricing, etc.)
 * It intentionally does NOT import heavy libraries like framer-motion
 * to keep the initial bundle size small for first-time visitors.
 */

import React, { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import CookieConsent from "@/components/CookieConsent";
import { Toaster } from "@/components/ui/sonner";
import BackToTopFab from "@/components/BackToTopFab";

// Scroll restoration for marketing pages
function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;
    window.scrollTo(0, 0);
  }, [pathname, navigationType]);

  return null;
}

interface MarketingLayoutProps {
  children: React.ReactNode;
  currentPageName?: string;
}

export default function MarketingLayout({ children }: MarketingLayoutProps): JSX.Element {
  return (
    <>
      <ScrollToTop />
      {children}
      <BackToTopFab bottomClassName="bottom-28 lg:bottom-6" />
      <CookieConsent />
      <Toaster position="top-right" />
    </>
  );
}
