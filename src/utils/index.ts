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
