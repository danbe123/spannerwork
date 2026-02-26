export interface DocsLink {
  title: string;
  href: string;
}

export interface DocsLinkGroup {
  title: string;
  links: DocsLink[];
}

// Flattened single navigation - all links in one section
export const DOCS_LINKS: DocsLink[] = [
  { title: 'Resources', href: '/resources' },
  { title: 'Contact', href: '/contact' },
  { title: 'Start Earning', href: '/resources/start-earning' },
  { title: 'Success Stories', href: '/resources/success-stories' },
  { title: "Provider's Guide", href: '/guides/provider' },
  { title: "Renter's Guide", href: '/guides/renter' },
  { title: 'Safety Guide', href: '/guides/safety' },
  { title: 'Pricing Guide', href: '/guides/pricing' },
  { title: 'How It Works', href: '/how-it-works' },
  { title: 'Pricing', href: '/pricing' },
  { title: 'Safety', href: '/safety' },
  { title: 'Terms', href: '/terms' },
  { title: 'Privacy', href: '/privacy' },
  { title: 'Cookies', href: '/cookies' },
  { title: 'Refund Policy', href: '/refund-policy' },
  { title: 'Dispute Resolution', href: '/dispute-resolution' },
];

// Grouped navigation format for sidebar component
export const DOCS_LINK_GROUPS: DocsLinkGroup[] = [
  {
    title: 'RESOURCES',
    links: DOCS_LINKS
  }
];


export function getDocsTitleForPath(pathname: string): string | null {
  const normalized = (pathname || '').toLowerCase();
  for (const link of DOCS_LINKS) {
    if (link.href.toLowerCase() === normalized) return link.title;
  }
  return null;
}
