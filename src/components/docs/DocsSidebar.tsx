import { Link, useLocation } from "react-router-dom";
import { Home, Plus, MessageSquare, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DOCS_LINKS } from "./docsLinks";

const QUICK_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/feed", label: "Feed", icon: Home },
  { href: "/create", label: "Post a Job", icon: Plus },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/profile", label: "Profile", icon: User },
];

export default function DocsSidebar(): JSX.Element {
  const location = useLocation();
  const currentPath = location.pathname.toLowerCase();

  return (
    <div className="sticky top-6 space-y-4">
      {/* Quick Links */}
      <Card className="border border-gray-200/70 shadow-sm">
        <CardContent className="p-4">
          <p className="text-xs font-semibold tracking-wide text-gray-500 mb-3">
            QUICK LINKS
          </p>
          <div className="space-y-1">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-800 transition-colors"
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Resources Navigation */}
      <Card className="border border-gray-200/70 shadow-sm">
        <CardContent className="p-4">
          <p className="text-xs font-semibold tracking-wide text-gray-500 mb-3">
            RESOURCES
          </p>
          <div className="space-y-1">
            {DOCS_LINKS.map((link) => {
              const isActive = currentPath === link.href.toLowerCase();
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={
                    "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors " +
                    (isActive
                      ? "bg-brand-50 text-brand-800 font-semibold"
                      : "text-gray-700 hover:bg-gray-50 hover:text-brand-800")
                  }
                >
                  <span className="truncate">{link.title}</span>
                  {isActive && <span className="text-xs text-gray-400">You are here</span>}
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
