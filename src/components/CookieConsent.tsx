import { useState, useEffect } from "react";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Settings, Check } from "lucide-react";

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

type Expression = 'happy' | 'eating' | 'surprised' | 'frustrated' | 'satisfied' | 'curious';

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [bonusRound, setBonusRound] = useState(false);
  const [bonusRound2, setBonusRound2] = useState(false);
  const [expression, setExpression] = useState<Expression>('happy');
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    analytics: true,
    marketing: true,
  });

  useEffect(() => {
    const consent = localStorage.getItem("cookieConsent");
    if (!consent) {
      setTimeout(() => {
        setShowBanner(true);
        // Trigger animation after mount
        requestAnimationFrame(() => setIsVisible(true));
      }, 1000);
    }
  }, []);

  // Trigger bonus round 5 seconds after initial animation ends (4s animation + 5s wait = 9s total)
  useEffect(() => {
    if (isVisible && !bonusRound) {
      const timer = setTimeout(() => {
        setBonusRound(true);
      }, 5500); // 3.45s animation + 1s delay + 1s wait
      return () => clearTimeout(timer);
    }
  }, [isVisible, bonusRound]);

  // Expression timeline for initial journey (3.45s + 1s delay)
  useEffect(() => {
    if (!isVisible || bonusRound) return;

    const timeline: { time: number; expr: Expression }[] = [
      { time: 2200, expr: 'surprised' },  // overshoot! (35%)
      { time: 2400, expr: 'frustrated' }, // shake (40%)
      { time: 2700, expr: 'happy' },      // got dot 2, turn around
      { time: 4000, expr: 'satisfied' },  // exit happy
    ];

    const timers = timeline.map(({ time, expr }) =>
      setTimeout(() => setExpression(expr), time)
    );

    return () => timers.forEach(clearTimeout);
  }, [isVisible, bonusRound]);

  // Expression timeline for bonus round (faster - 1.8s + 0.3s delay)
  useEffect(() => {
    if (!bonusRound || bonusRound2) return;

    setExpression('curious');

    const timeline: { time: number; expr: Expression }[] = [
      { time: 1200, expr: 'eating' },
      { time: 1400, expr: 'satisfied' },
    ];

    const timers = timeline.map(({ time, expr }) =>
      setTimeout(() => setExpression(expr), time)
    );

    return () => timers.forEach(clearTimeout);
  }, [bonusRound, bonusRound2]);

  // Trigger second bonus round right after first one ends (first bonus is ~2.1s)
  useEffect(() => {
    if (bonusRound && !bonusRound2) {
      const timer = setTimeout(() => {
        setBonusRound2(true);
      }, 2200); // 2.1s for first bonus + tiny gap
      return () => clearTimeout(timer);
    }
  }, [bonusRound, bonusRound2]);

  // Expression timeline for bonus round 2
  useEffect(() => {
    if (!bonusRound2) return;

    setExpression('curious');

    const timeline: { time: number; expr: Expression }[] = [
      { time: 1000, expr: 'eating' },
      { time: 1200, expr: 'satisfied' },
    ];

    const timers = timeline.map(({ time, expr }) =>
      setTimeout(() => setExpression(expr), time)
    );

    return () => timers.forEach(clearTimeout);
  }, [bonusRound2]);

  const handleClose = () => {
    setIsVisible(false);
    // Wait for animation to complete before unmounting
    setTimeout(() => setShowBanner(false), 200);
  };

  const handleAcceptAll = () => {
    localStorage.setItem("cookieConsent", JSON.stringify({
      necessary: true,
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString()
    }));
    handleClose();
  };

  const handleRejectAll = () => {
    localStorage.setItem("cookieConsent", JSON.stringify({
      necessary: true,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString()
    }));
    handleClose();
  };

  const handleSavePreferences = () => {
    localStorage.setItem("cookieConsent", JSON.stringify({
      ...preferences,
      timestamp: new Date().toISOString()
    }));
    handleClose();
  };

  if (!showBanner) return null;

  return (
    <div
      className={`
        fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-[9999]
        transition-all duration-300 ease-out
        ${isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-24'
        }
      `}
    >
      <Card className="border-none shadow-2xl overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800">
        {/* Header with text left, animation right */}
        <div className="relative p-4 pb-2 overflow-hidden">
          <div className="flex items-center gap-4">
            {/* Text content - left side */}
            <div className="flex-shrink-0">
              <h3 className="text-white font-bold text-base md:text-lg">Cookie Time!</h3>
              <p className="text-gray-400 text-xs">Nom nom nom...</p>
            </div>

            {/* Animation track - right side, takes remaining space */}
            <div className="pac-track flex-1">
              {!bonusRound ? (
                <>
                  {/* Initial animation - Row of dots */}
                  <div className="pac-dots">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={`pac-dot pac-dot-${i}`}
                      />
                    ))}
                  </div>

                  {/* Cookie - starts left, travels right */}
                  <div className="pac-man-container">
                    <div className={`pac-cookie expression-${expression}`} />
                  </div>
                </>
              ) : !bonusRound2 ? (
                <>
                  {/* Bonus round 1 - single dot pops up, cookie returns to get it */}
                  <div className="pac-bonus-dot" />
                  <div className="pac-bonus-container">
                    <div className={`pac-cookie expression-${expression}`} />
                  </div>
                </>
              ) : (
                <>
                  {/* Bonus round 2 - quicker, half distance */}
                  <div className="pac-bonus-dot-2" />
                  <div className="pac-bonus-container-2">
                    <div className={`pac-cookie expression-${expression}`} />
                  </div>
                </>
              )}
            </div>

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="text-gray-400 hover:text-white hover:bg-white/10 h-8 w-8 flex-shrink-0"
              aria-label="Close cookie banner"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
          {!showSettings ? (
            <>
              <p className="text-gray-300 text-sm md:text-base mb-4 leading-relaxed">
                We use cookies to make SpannerWork work better for you. They help us remember your preferences and show you relevant jobs.
              </p>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleAcceptAll}
                  className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 font-bold shadow-lg w-full"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Accept All Cookies
                </Button>

                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowSettings(true)}
                    variant="outline"
                    className="flex-1 border-gray-400 bg-gray-100 text-gray-900 hover:bg-white hover:text-black text-sm font-medium"
                  >
                    <Settings className="w-3 h-3 mr-1 md:w-4 md:h-4 md:mr-2" />
                    <span className="md:hidden">Settings</span>
                    <span className="hidden md:inline">Customize</span>
                  </Button>

                  <Button
                    onClick={handleRejectAll}
                    variant="ghost"
                    className="flex-1 text-gray-400 hover:text-white text-sm"
                  >
                    <span className="md:hidden">Reject</span>
                    <span className="hidden md:inline">Reject All</span>
                  </Button>
                </div>
              </div>

              <a
                href={createPageUrl("Cookies")}
                className="text-xs text-gray-500 hover:text-gray-300 block text-center mt-3"
              >
                Cookie Policy
              </a>
            </>
          ) : (
            <>
              <h4 className="font-bold text-white mb-3 text-sm md:text-base md:mb-4">Cookie Preferences</h4>

              <div className="space-y-3 md:space-y-4 mb-4">
                <div className="flex items-center justify-between p-2.5 md:p-3 bg-gray-700/50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-white text-sm">Necessary Cookies</div>
                    <p className="text-xs text-gray-400">Required for site to work</p>
                  </div>
                  <div className="ml-2 md:ml-3 flex items-center justify-center w-10 md:w-12 h-5 md:h-6 bg-green-500 rounded-full">
                    <Check className="w-3 h-3 md:w-4 md:h-4 text-white" />
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 md:p-3 bg-gray-700/50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-white text-sm">Analytics Cookies</div>
                    <p className="text-xs text-gray-400">Help us improve</p>
                  </div>
                  <button
                    onClick={() => setPreferences({ ...preferences, analytics: !preferences.analytics })}
                    className={`ml-2 md:ml-3 flex items-center w-10 md:w-12 h-5 md:h-6 rounded-full transition-colors duration-200 ${
                      preferences.analytics ? 'bg-green-500 justify-end' : 'bg-gray-500 justify-start'
                    }`}
                  >
                    <div className="w-4 md:w-5 h-4 md:h-5 bg-white rounded-full shadow-md mx-0.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between p-2.5 md:p-3 bg-gray-700/50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-white text-sm">Marketing Cookies</div>
                    <p className="text-xs text-gray-400">Relevant content & ads</p>
                  </div>
                  <button
                    onClick={() => setPreferences({ ...preferences, marketing: !preferences.marketing })}
                    className={`ml-2 md:ml-3 flex items-center w-10 md:w-12 h-5 md:h-6 rounded-full transition-colors duration-200 ${
                      preferences.marketing ? 'bg-green-500 justify-end' : 'bg-gray-500 justify-start'
                    }`}
                  >
                    <div className="w-4 md:w-5 h-4 md:h-5 bg-white rounded-full shadow-md mx-0.5" />
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSavePreferences}
                  className="flex-1 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 font-bold text-sm"
                >
                  Save Preferences
                </Button>
                <Button
                  onClick={() => setShowSettings(false)}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700 text-sm"
                >
                  Back
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
