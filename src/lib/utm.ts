/**
 * Build a share URL with UTM parameters for analytics tracking.
 * Automatically detects the content type from the URL path.
 *
 * Example output:
 *   https://museummap.app/museums/abc?utm_source=share&utm_medium=social&utm_campaign=museum_share
 */
export function buildShareUrl(baseUrl: string, campaign?: string): string {
    const url = new URL(baseUrl);

    // Auto-detect campaign from path
    if (!campaign) {
        const path = url.pathname;
        if (path.startsWith('/museums/')) campaign = 'museum_share';
        else if (path.startsWith('/artworks/') || path.startsWith('/artworks')) campaign = 'artwork_share';
        else if (path.startsWith('/collections/')) campaign = 'collection_share';
        else if (path.startsWith('/blog/')) campaign = 'story_share';
        else campaign = 'general_share';
    }

    url.searchParams.set('utm_source', 'share');
    url.searchParams.set('utm_medium', 'social');
    url.searchParams.set('utm_campaign', campaign);

    return url.toString();
}
