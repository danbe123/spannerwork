import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Cookie, X, Settings, Check } from "lucide-react";

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    analytics: true,
    marketing: true,
  });

  useEffect(() => {
    const consent = localStorage.getItem("cookieConsent");
    if (!consent) {
      setTimeout(() => setShowBanner(true), 1000);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem("cookieConsent", JSON.stringify({
      necessary: true,
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString()
    }));
    setShowBanner(false);
  };

  const handleRejectAll = () => {
    localStorage.setItem("cookieConsent", JSON.stringify({
      necessary: true,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString()
    }));
    setShowBanner(false);
  };

  const handleSavePreferences = () => {
    localStorage.setItem("cookieConsent", JSON.stringify({
      ...preferences,
      timestamp: new Date().toISOString()
    }));
    setShowBanner(false);
    setShowSettings(false);
  };

  if (!showBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-[9999]"
      >
        <Card className="border-none shadow-2xl overflow-hidden bg-gradient-to-br from-white to-orange-50">
          <div className="relative bg-gradient-to-r from-brand-800 to-brand-900 p-4 overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute inset-0 animate-pulse" style={{
                backgroundImage: 'radial-gradient(circle at 20% 50%, white 2px, transparent 2px)',
                backgroundSize: '30px 30px'
              }} />
            </div>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                >
                  <Cookie className="w-8 h-8 text-[#FFC107]" />
                </motion.div>
                <div>
                  <h3 className="text-white font-bold text-lg">Cookie Time! 🍪</h3>
                  <p className="text-orange-100 text-xs">We use cookies (the digital kind)</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowBanner(false)}
                className="text-white hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <CardContent className="p-6">
            {!showSettings ? (
              <>
                <p className="text-gray-700 mb-4 leading-relaxed">
                  We use cookies to make SpannerWork work better for you. They help us remember your preferences, keep you logged in, and show you relevant jobs nearby.
                </p>
                
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleAcceptAll}
                    className="bg-gradient-to-r from-brand-800 to-brand-900 hover:from-brand-900 hover:to-[#A52A14] text-white shadow-lg w-full"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Accept All Cookies
                  </Button>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setShowSettings(true)}
                      variant="outline"
                      className="flex-1 border-2"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Customize
                    </Button>
                    
                    <Button
                      onClick={handleRejectAll}
                      variant="ghost"
                      className="flex-1"
                    >
                      Reject All
                    </Button>
                  </div>
                </div>

                <a
                  href={createPageUrl("Cookies")}
                  className="text-xs text-brand-800 hover:underline block text-center mt-3"
                >
                  Read our Cookie Policy
                </a>
              </>
            ) : (
              <>
                <h4 className="font-bold mb-4">Cookie Preferences</h4>
                
                <div className="space-y-4 mb-4">
                  <div className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-semibold text-sm mb-1">Necessary Cookies</div>
                      <p className="text-xs text-gray-600">Required for the site to work. Cannot be disabled.</p>
                    </div>
                    <div className="ml-3 flex items-center justify-center w-12 h-6 bg-green-500 rounded-full">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>

                  <div className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-semibold text-sm mb-1">Analytics Cookies</div>
                      <p className="text-xs text-gray-600">Help us understand how you use SpannerWork.</p>
                    </div>
                    <button
                      onClick={() => setPreferences({ ...preferences, analytics: !preferences.analytics })}
                      className={`ml-3 flex items-center justify-center w-12 h-6 rounded-full transition-all ${
                        preferences.analytics ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <motion.div
                        className="w-5 h-5 bg-white rounded-full shadow-md"
                        animate={{ x: preferences.analytics ? 6 : -6 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>

                  <div className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-semibold text-sm mb-1">Marketing Cookies</div>
                      <p className="text-xs text-gray-600">Show you relevant content and ads.</p>
                    </div>
                    <button
                      onClick={() => setPreferences({ ...preferences, marketing: !preferences.marketing })}
                      className={`ml-3 flex items-center justify-center w-12 h-6 rounded-full transition-all ${
                        preferences.marketing ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <motion.div
                        className="w-5 h-5 bg-white rounded-full shadow-md"
                        animate={{ x: preferences.marketing ? 6 : -6 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSavePreferences}
                    className="flex-1 bg-gradient-to-r from-brand-800 to-brand-900 text-white"
                  >
                    Save Preferences
                  </Button>
                  <Button
                    onClick={() => setShowSettings(false)}
                    variant="outline"
                  >
                    Back
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
