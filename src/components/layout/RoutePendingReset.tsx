'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import { clearDocumentNavigationStarted, clearRoutePending, startRoutePending } from '@/lib/route-pending';

const TRANSIENT_NAVIGATION_KEYS = ['navigating-back', 'navigating-forward'];
const LEFT_HANDED_STORAGE_KEY = 'mm_map_left_handed_mode';

function syncLeftHandedModeClass(nextValue?: boolean) {
    if (typeof document === 'undefined') return;
    let enabled = nextValue;
    if (typeof enabled !== 'boolean') {
        try {
            enabled = localStorage.getItem(LEFT_HANDED_STORAGE_KEY) === 'true';
        } catch {
            enabled = false;
        }
    }
    document.documentElement.classList.toggle('mm-left-handed-mode', enabled);
}

function clearBackForwardTransientState() {
    clearRoutePending();
    clearDocumentNavigationStarted();
    syncLeftHandedModeClass();
    const html = document.documentElement;
    const body = document.body;
    if (!body) return;

    body.removeAttribute('data-detail-open');
    html.classList.remove('mm-search-locking');
    body.classList.remove('mm-search-locking');
    html.removeAttribute('data-search-chrome');

    html.style.overscrollBehavior = '';
    body.style.overflow = '';
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    body.style.overscrollBehavior = '';
    body.style.touchAction = '';

    try {
        TRANSIENT_NAVIGATION_KEYS.forEach((key) => sessionStorage.removeItem(key));
    } catch { }
}

export default function RoutePendingReset() {
    const pathname = usePathname();
    const { locale } = useApp();

    useEffect(() => {
        document.documentElement.setAttribute('data-mm-hydrated', 'true');
        window.dispatchEvent(new Event('mm:hydrated'));
        clearBackForwardTransientState();
    }, [pathname]);

    useEffect(() => {
        syncLeftHandedModeClass();
        const handleStorage = (event: StorageEvent) => {
            if (event.key === LEFT_HANDED_STORAGE_KEY) syncLeftHandedModeClass(event.newValue === 'true');
        };
        const handlePrefsChange = (event: Event) => {
            const detail = (event as CustomEvent<{ leftHanded?: boolean }>).detail;
            syncLeftHandedModeClass(typeof detail?.leftHanded === 'boolean' ? detail.leftHanded : undefined);
        };
        window.addEventListener('storage', handleStorage);
        window.addEventListener('mm-map-prefs-change', handlePrefsChange);
        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('mm-map-prefs-change', handlePrefsChange);
        };
    }, []);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                clearRoutePending();
                return;
            }
            clearBackForwardTransientState();
        };

        window.addEventListener('pagehide', clearBackForwardTransientState);
        window.addEventListener('pageshow', clearBackForwardTransientState);
        window.addEventListener('popstate', clearBackForwardTransientState);
        window.addEventListener('focus', clearRoutePending);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            window.removeEventListener('pagehide', clearBackForwardTransientState);
            window.removeEventListener('pageshow', clearBackForwardTransientState);
            window.removeEventListener('popstate', clearBackForwardTransientState);
            window.removeEventListener('focus', clearRoutePending);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    useEffect(() => {
        const maybeStartPending = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
            if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
            if (anchor.dataset.mmRoutePending === 'off' || anchor.closest('[data-mm-route-pending="off"]')) return;
            try {
                const url = new URL(anchor.href);
                if (url.origin !== window.location.origin) return;
                const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                const next = `${url.pathname}${url.search}${url.hash}`;
                if (current === next) return;
                startRoutePending(locale);
            } catch { }
        };
        document.addEventListener('click', maybeStartPending, true);
        return () => {
            document.removeEventListener('click', maybeStartPending, true);
        };
    }, [locale]);

    return null;
}
