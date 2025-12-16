import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * Hook to detect if the current viewport is mobile-sized.
 * Uses matchMedia for efficient resize detection.
 * 
 * @returns boolean indicating if viewport width is below mobile breakpoint
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = (): void => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener('change', onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !!isMobile;
}

export default useIsMobile;
