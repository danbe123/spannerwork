export interface DocsLink {
  title: string;
  href: string;
}

export interface DocsLinkGroup {
  title: string;
  links: DocsLink[];
}

export const DOCS_LINK_GROUPS: DocsLinkGroup[] = [
  {
    title: 'Support',
    links: [
      { title: 'Resources', href: '/resources' },
      { title: 'Contact', href: '/contact' },
      { title: 'Refund Policy', href: '/refund-policy' },
      { title: 'Dispute Resolution', href: '/dispute-resolution' },
    ],
  },
  {
    title: 'Guides',
    links: [
      { title: "Provider's Guide", href: '/guides/provider' },
      { title: "Renter's Guide", href: '/guides/renter' },
      { title: 'Safety Guide', href: '/guides/safety' },
      { title: 'Pricing Guide', href: '/guides/pricing' },
    ],
  },
  {
    title: 'Product',
    links: [
      { title: 'How It Works', href: '/how-it-works' },
      { title: 'Pricing', href: '/pricing' },
      { title: 'Safety', href: '/safety' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { title: 'Terms', href: '/terms' },
      { title: 'Privacy', href: '/privacy' },
      { title: 'Cookies', href: '/cookies' },
    ],
  },
];

export function getDocsTitleForPath(pathname: string): string | null {
  const normalized = (pathname || '').toLowerCase();
  for (const group of DOCS_LINK_GROUPS) {
    for (const link of group.links) {
      if (link.href.toLowerCase() === normalized) return link.title;
    }
  }
  return null;
}
