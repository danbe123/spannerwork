import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
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
  if (hideOnPaths.map((p) => p.toLowerCase()).includes(path)) return null;

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > showAfterPx);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showAfterPx]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          whileTap={{ scale: 0.9 }}
          className={`fixed right-4 ${bottomClassName} z-40 w-12 h-12 rounded-full shadow-xl flex items-center justify-center border border-orange-200 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 transition-colors`}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
        >
          <ArrowUp className="w-5 h-5 text-white" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
