export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-8XMCJMKLSF';

// https://developers.google.com/analytics/devguides/collection/gtagjs/events
export const event = (action: string, { category, label, value }: { category?: string; label?: string; value?: number }) => {
    if (typeof window !== 'undefined' && (window as any).gtag && !window.location.hostname.includes('localhost')) {
        (window as any).gtag('event', action, {
            event_category: category,
            event_label: label,
            value: value,
        });
    }
};
