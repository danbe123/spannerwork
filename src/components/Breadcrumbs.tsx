import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  variant?: "light" | "dark";
}

export default function Breadcrumbs({ items, variant = "light" }: BreadcrumbsProps) {
  const isDark = variant === "dark";

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
      <Link
        to="/"
        className={`transition-colors flex items-center gap-1 ${
          isDark
            ? "text-white/70 hover:text-white"
            : "text-gray-500 hover:text-brand-800"
        }`}
      >
        <Home className="w-4 h-4" />
        <span className="sr-only">Home</span>
      </Link>

      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <ChevronRight className={`w-4 h-4 ${isDark ? "text-white/50" : "text-gray-400"}`} />
          {item.href ? (
            <Link
              to={item.href}
              className={`transition-colors ${
                isDark
                  ? "text-white/70 hover:text-white"
                  : "text-gray-500 hover:text-brand-800"
              }`}
            >
              {item.label}
            </Link>
          ) : (
            <span className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
