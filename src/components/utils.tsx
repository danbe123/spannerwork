/**
 * Creates a URL for navigating to a page in the app
 * @param pageName - The name of the page (e.g., "Feed", "Profile")
 * @returns The URL path for the page
 */
export function createPageUrl(pageName: string): string {
  return `/${pageName}`;
}
