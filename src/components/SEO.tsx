import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  author?: string;
  image?: string;
  url?: string;
  type?: string;
  schema?: Record<string, unknown> | Record<string, unknown>[] | null;
}

export default function SEO({ 
  title = 'SpannerWork - Rent Tools, Hire Mechanics & Book Workshop Space Near You',
  description = 'SpannerWork connects you with local tools, skilled mechanics, and workshop spaces. Save money on car repairs and DIY projects.',
  keywords = 'tool rental, mechanic for hire, workshop space, car repair, DIY tools',
  author = 'SpannerWork',
  image = '/og-image.jpg',
  url = typeof window !== 'undefined' ? window.location.href : '',
  type = 'website',
  schema = null
}: SEOProps) {
  useEffect(() => {
    document.title = title;

    updateMetaTag('name', 'description', description);
    updateMetaTag('name', 'keywords', keywords);
    updateMetaTag('name', 'author', author);

    updateMetaTag('property', 'og:title', title);
    updateMetaTag('property', 'og:description', description);
    updateMetaTag('property', 'og:image', image);
    updateMetaTag('property', 'og:url', url);
    updateMetaTag('property', 'og:type', type);
    updateMetaTag('property', 'og:site_name', 'SpannerWork');

    updateMetaTag('name', 'twitter:card', 'summary_large_image');
    updateMetaTag('name', 'twitter:title', title);
    updateMetaTag('name', 'twitter:description', description);
    updateMetaTag('name', 'twitter:image', image);

    updateLinkTag('canonical', url);

    if (schema) {
      updateStructuredData(schema);
    }
  }, [title, description, keywords, author, image, url, type, schema]);

  return null;
}

function updateMetaTag(attribute: string, key: string, content: string) {
  if (!content) return;
  
  let element = document.querySelector(`meta[${attribute}="${key}"]`);
  
  if (element) {
    element.setAttribute('content', content);
  } else {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    element.setAttribute('content', content);
    document.head.appendChild(element);
  }
}

function updateLinkTag(rel: string, href: string) {
  if (!href) return;
  
  let element = document.querySelector(`link[rel="${rel}"]`);
  
  if (element) {
    element.setAttribute('href', href);
  } else {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    element.setAttribute('href', href);
    document.head.appendChild(element);
  }
}

function updateStructuredData(schema: Record<string, unknown> | Record<string, unknown>[]) {
  const existing = document.querySelector('script[type="application/ld+json"]');
  if (existing) {
    existing.remove();
  }

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.text = JSON.stringify(Array.isArray(schema) ? schema : [schema]);
  document.head.appendChild(script);
}

export function generateLocalBusinessSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "SpannerWork",
    "description": "Community marketplace for tool rentals, mechanic services, and workshop space",
    "url": "https://spannerwork.co.uk",
    // Note: Add telephone when a support line is set up
    // "telephone": "+44-XXX-XXXXXXX",
    "email": "hello@spannerwork.co.uk",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Herefordshire",
      "addressCountry": "UK"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": "52.0565",
      "longitude": "-2.7164"
    },
    "priceRange": "£10-£100",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "150"
    }
  };
}

export function generateServiceSchema(serviceName: string, description: string, price: number): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": serviceName,
    "description": description,
    "provider": {
      "@type": "Organization",
      "name": "SpannerWork"
    },
    "offers": {
      "@type": "Offer",
      "price": price,
      "priceCurrency": "GBP"
    }
  };
}

interface ProductForSchema {
  name: string;
  description: string;
  photos?: string[];
  dailyRate?: number;
  hourlyRate?: number;
  available: boolean;
}

export function generateProductSchema(product: ProductForSchema): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": product.description,
    "image": product.photos?.[0],
    "offers": {
      "@type": "Offer",
      "price": product.dailyRate || product.hourlyRate,
      "priceCurrency": "GBP",
      "availability": product.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
    }
  };
}

interface ReviewForSchema {
  rating: number;
  reviewerName?: string;
  comment?: string;
}

export function generateReviewSchema(review: ReviewForSchema, reviewedItem: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    "itemReviewed": {
      "@type": "Thing",
      "name": reviewedItem
    },
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": review.rating,
      "bestRating": "5"
    },
    "author": {
      "@type": "Person",
      "name": review.reviewerName
    },
    "reviewBody": review.comment
  };
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

export function generateBreadcrumbSchema(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url
    }))
  };
}
