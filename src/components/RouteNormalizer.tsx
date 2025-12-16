/**
 * RouteNormalizer Component
 * 
 * Automatically redirects PascalCase routes to lowercase equivalents.
 */

import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Map of PascalCase paths to their lowercase equivalents
 */
const ROUTE_MAP: Record<string, string> = {
  '/Home': '/',
  '/Feed': '/feed',
  '/CreateRequest': '/create-request',
  '/Profile': '/profile',
  '/Messages': '/messages',
  '/RequestDetail': '/request',
  '/MapView': '/map',
  '/Chat': '/chat',
  '/StartTransaction': '/start-transaction',
  '/TransactionDetail': '/transaction',
  '/HowItWorks': '/how-it-works',
  '/Pricing': '/pricing',
  '/Safety': '/safety',
  '/StartEarning': '/start-earning',
  '/SuccessStories': '/success-stories',
  '/Resources': '/resources',
  '/About': '/about',
  '/Contact': '/contact',
  '/Terms': '/terms',
  '/Privacy': '/privacy',
  '/Cookies': '/cookies',
  '/RefundPolicy': '/refund-policy',
  '/Payment': '/payment',
  '/Verification': '/verification',
  '/DisputeResolution': '/dispute-resolution',
  '/Admin': '/admin',
  '/Calendar': '/calendar',
  '/SavedSearches': '/saved-searches',
  '/Referrals': '/referrals',
  '/Analytics': '/analytics',
  '/CreateOffer': '/create-offer',
  '/ToolDetail': '/tool',
  '/SpaceDetail': '/space',
  '/ServiceDetail': '/service',
};

/**
 * Check if path needs normalization
 */
function getNormalizedPath(pathname: string): string | null {
  if (ROUTE_MAP[pathname]) {
    return ROUTE_MAP[pathname];
  }

  for (const [pascalPath, lowerPath] of Object.entries(ROUTE_MAP)) {
    if (pathname.startsWith(pascalPath + '/') || pathname.startsWith(pascalPath + '?')) {
      return lowerPath + pathname.slice(pascalPath.length);
    }
  }

  if (/^\/[A-Z]/.test(pathname)) {
    const normalized = pathname
      .replace(/^\//, '')
      .replace(/([A-Z])/g, (_match, letter, index) => 
        index === 0 ? letter.toLowerCase() : `-${letter.toLowerCase()}`
      );
    return '/' + normalized;
  }

  return null;
}

/**
 * RouteNormalizer - place this inside Router but before Routes
 */
export default function RouteNormalizer() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const normalizedPath = getNormalizedPath(location.pathname);
    
    if (normalizedPath && normalizedPath !== location.pathname) {
      const newUrl = normalizedPath + location.search + location.hash;
      navigate(newUrl, { replace: true });
    }
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
}

export { getNormalizedPath, ROUTE_MAP };
