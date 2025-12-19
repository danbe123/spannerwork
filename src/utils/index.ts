function slugifySegment(input: string): string {
    if (!input) {
        return '';
    }

    return input
        .replace(/^\/+|\/+$/g, '')
        .replace(/\s+/g, '-')
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/_+/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase();
}

export function createPageUrl(pageName: string) {
    if (!pageName) {
        return '/';
    }

    const [rawPath, rawQuery] = pageName.split('?');
    const slug = slugifySegment(rawPath || '');
    if (slug === 'home') {
        return rawQuery ? `/?${rawQuery}` : '/';
    }
    const normalizedPath = slug ? `/${slug}` : '/';

    return rawQuery ? `${normalizedPath}?${rawQuery}` : normalizedPath;
}

export function mapPathToPageName(pathname: string, pageNames: readonly string[], fallback = 'Home') {
    const slug = slugifySegment(pathname || '');

    if (!slug || slug === 'home') {
        return 'Home';
    }

    const match = pageNames.find((page) => slugifySegment(page) === slug);
    return match || fallback;
}

/**
 * Format price in pence to GBP currency string
 * @param pence - Amount in pence
 * @returns Formatted price string (e.g., "£12.50")
 */
export function formatPrice(pence: number): string {
    const pounds = pence / 100;
    return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
    }).format(pounds);
}
