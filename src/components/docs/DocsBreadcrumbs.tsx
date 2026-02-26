import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { getDocsTitleForPath } from "./docsLinks";

interface Crumb {
  title: string;
  href?: string;
}

export default function DocsBreadcrumbs(): JSX.Element {
  const location = useLocation();
  const path = location.pathname;

  const currentTitle = getDocsTitleForPath(path) || 'Help';

  const crumbs: Crumb[] = [
    { title: 'Home', href: '/' },
    { title: 'Resources', href: '/resources' },
  ];

  // Add current page if not on resources page
  if (path.toLowerCase() !== '/resources') {
    crumbs.push({ title: currentTitle });
  }

  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-gray-600">
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          const content = crumb.href && !isLast ? (
            <Link to={crumb.href} className="inline-flex items-center gap-1 hover:text-brand-800">
              {crumb.title === 'Home' ? <Home className="w-4 h-4" /> : null}
              <span className="font-medium">{crumb.title}</span>
            </Link>
          ) : (
            <span className={isLast ? 'font-semibold text-gray-900' : 'font-medium'}>{crumb.title}</span>
          );

          return (
            <li key={`${crumb.title}-${idx}`} className="inline-flex items-center gap-1">
              {idx > 0 ? <ChevronRight className="w-4 h-4 text-gray-400" /> : null}
              {content}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
