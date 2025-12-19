import { Link, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { DOCS_LINK_GROUPS } from "./docsLinks";

export default function DocsSidebar(): JSX.Element {
  const location = useLocation();
  const currentPath = location.pathname.toLowerCase();

  return (
    <div className="sticky top-6 space-y-4">
      {DOCS_LINK_GROUPS.map((group) => (
        <Card key={group.title} className="border border-gray-200/70 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold tracking-wide text-gray-500 mb-3">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.links.map((link) => {
                const isActive = currentPath === link.href.toLowerCase();
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={
                      "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors " +
                      (isActive
                        ? "bg-orange-50 text-brand-800 font-semibold"
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
      ))}
    </div>
  );
}
