import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ArrowUp } from "lucide-react";

interface BackToTopFabProps {
  bottomClassName?: string;
  hideOnPaths?: string[];
  showAfterPx?: number;
}

export default function BackToTopFab({
  bottomClassName = "bottom-6",
  hideOnPaths = [],
  showAfterPx = 400,
}: BackToTopFabProps): JSX.Element | null {
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  const path = (location.pathname || "").toLowerCase();
  const isHiddenPath = hideOnPaths.map((p) => p.toLowerCase()).includes(path);

  useEffect(() => {
    if (isHiddenPath) return;

    function onScroll() {
      setVisible(window.scrollY > showAfterPx);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showAfterPx, isHiddenPath]);

  if (isHiddenPath) return null;

  return (
    <button
      type="button"
      className={`
        fixed right-4 ${bottomClassName} z-40 w-12 h-12 rounded-full shadow-xl
        flex items-center justify-center border border-brand-200
        bg-gradient-to-br from-brand-500 to-brand-600
        hover:from-brand-600 hover:to-brand-700
        transition-all duration-200 ease-out
        active:scale-90
        ${visible
          ? 'opacity-100 scale-100 translate-y-0'
          : 'opacity-0 scale-90 translate-y-4 pointer-events-none'
        }
      `}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
    >
      <ArrowUp className="w-5 h-5 text-white" />
    </button>
  );
}
