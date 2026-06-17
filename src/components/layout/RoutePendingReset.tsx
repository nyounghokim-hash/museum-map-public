'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import { clearRoutePending, startRoutePending } from '@/lib/route-pending';

export default function RoutePendingReset() {
    const pathname = usePathname();
    const { locale } = useApp();

    useEffect(() => {
        clearRoutePending();
    }, [pathname]);

    useEffect(() => {
        window.addEventListener('pageshow', clearRoutePending);
        window.addEventListener('focus', clearRoutePending);
        document.addEventListener('visibilitychange', clearRoutePending);
        return () => {
            window.removeEventListener('pageshow', clearRoutePending);
            window.removeEventListener('focus', clearRoutePending);
            document.removeEventListener('visibilitychange', clearRoutePending);
        };
    }, []);

    useEffect(() => {
        const maybeStartPending = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
            if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
            try {
                const url = new URL(anchor.href);
                if (url.origin !== window.location.origin) return;
                const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                const next = `${url.pathname}${url.search}${url.hash}`;
                if (current === next) return;
                startRoutePending(locale, anchor.href);
            } catch { }
        };
        document.addEventListener('click', maybeStartPending, true);
        return () => {
            document.removeEventListener('click', maybeStartPending, true);
        };
    }, [locale]);

    return null;
}
