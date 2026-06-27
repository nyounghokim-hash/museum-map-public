'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import { clearDocumentNavigationStarted, clearRoutePending, startRoutePending } from '@/lib/route-pending';
import { reassertMobileChrome } from '@/lib/mobileSearchChrome';
import {
    consumePendingScrollRestore,
    getScrollRestorationPath,
    markPendingScrollRestore,
    restoreNativeScrollRestoration,
    restoreSavedScrollPosition,
    saveScrollPosition,
    setManualScrollRestoration,
} from '@/lib/scroll-restoration';

const LEFT_HANDED_STORAGE_KEY = 'mm_map_left_handed_mode';
const RETAINED_DETAIL_SELECTOR = [
    '.mm-museum-detail2',
    '.mm-story-detail-page2',
    '.mm-artwork-detail-page2',
    '.mm-collection-detail2',
    '.mm-plan-detail2',
].join(',');
const SCROLL_SAVE_THROTTLE_MS = 250;

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

    if (document.querySelector(RETAINED_DETAIL_SELECTOR)) {
        body.setAttribute('data-detail-open', 'true');
    } else {
        body.removeAttribute('data-detail-open');
    }
    html.classList.remove('mm-search-locking');
    body.classList.remove('mm-search-locking');
    html.removeAttribute('data-search-chrome');

    // Force the status-bar chrome back to the app theme after a route change.
    // iOS won't re-read a lingering dark tint from a detail page otherwise, which
    // made the next home search focus look black. Recreating our dynamic metas
    // forces a fresh read.
    reassertMobileChrome();

    html.style.overscrollBehavior = '';
    body.style.overflow = '';
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    body.style.overscrollBehavior = '';
    body.style.touchAction = '';

    // NOTE: navigating-back / navigating-forward are intentionally NOT cleared here.
    // Destination pages consume them on mount (with a freshness timestamp guard) to
    // play the correct entrance animation; clearing here on pagehide/popstate/route
    // change wiped the flag before the destination could read it, so the back
    // animation never ran.
}

function scrollNewRouteToTop() {
    window.requestAnimationFrame(() => {
        window.scrollTo({ left: 0, top: 0, behavior: 'auto' });
    });
}

export default function RoutePendingReset() {
    const pathname = usePathname();
    const { locale } = useApp();
    const currentScrollPathRef = useRef('');
    const pendingRestorePathRef = useRef<string | null>(null);

    useEffect(() => {
        document.documentElement.setAttribute('data-mm-hydrated', 'true');
        window.dispatchEvent(new Event('mm:hydrated'));
        clearBackForwardTransientState();
        const nextPath = getScrollRestorationPath();
        const previousPath = currentScrollPathRef.current;
        currentScrollPathRef.current = nextPath;
        const shouldRestore = pendingRestorePathRef.current === nextPath || consumePendingScrollRestore(nextPath);
        if (shouldRestore) {
            pendingRestorePathRef.current = null;
            restoreSavedScrollPosition(nextPath);
        } else {
            if (previousPath && previousPath !== nextPath && !nextPath.includes('#')) scrollNewRouteToTop();
            saveScrollPosition(nextPath);
        }
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
        currentScrollPathRef.current = getScrollRestorationPath();
        saveScrollPosition(currentScrollPathRef.current);
        const previousScrollRestoration = setManualScrollRestoration();
        let saveFrame = 0;
        let saveTimer = 0;
        let lastScrollSaveTs = 0;

        const runScheduledSave = () => {
            saveFrame = 0;
            lastScrollSaveTs = Date.now();
            saveScrollPosition(currentScrollPathRef.current || getScrollRestorationPath());
        };

        const scheduleSaveScroll = () => {
            if (saveFrame || saveTimer) return;
            const delay = Math.max(0, SCROLL_SAVE_THROTTLE_MS - (Date.now() - lastScrollSaveTs));
            const scheduleFrame = () => {
                saveFrame = window.requestAnimationFrame(runScheduledSave);
            };
            if (delay <= 0) {
                scheduleFrame();
                return;
            }
            saveTimer = window.setTimeout(() => {
                saveTimer = 0;
                scheduleFrame();
            }, delay);
        };
        const saveScrollNow = () => {
            if (saveFrame) {
                window.cancelAnimationFrame(saveFrame);
                saveFrame = 0;
            }
            if (saveTimer) {
                window.clearTimeout(saveTimer);
                saveTimer = 0;
            }
            lastScrollSaveTs = Date.now();
            saveScrollPosition(currentScrollPathRef.current || getScrollRestorationPath());
        };
        const saveBeforeInternalNavigation = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
            if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
            try {
                const url = new URL(anchor.href);
                if (url.origin !== window.location.origin) return;
                const current = getScrollRestorationPath();
                const next = `${url.pathname}${url.search}${url.hash}`;
                if (current !== next) saveScrollPosition(currentScrollPathRef.current || current);
            } catch { }
        };
        const handleBackForwardScrollRestore = () => {
            saveScrollPosition(currentScrollPathRef.current || getScrollRestorationPath());
            const restorePath = getScrollRestorationPath();
            pendingRestorePathRef.current = restorePath;
            markPendingScrollRestore(restorePath);
            restoreSavedScrollPosition(restorePath);
        };
        const handlePageShowScrollRestore = (event: PageTransitionEvent) => {
            currentScrollPathRef.current = getScrollRestorationPath();
            if (event.persisted || consumePendingScrollRestore(currentScrollPathRef.current)) {
                restoreSavedScrollPosition(currentScrollPathRef.current);
            }
        };

        window.addEventListener('scroll', scheduleSaveScroll, { passive: true });
        // Keep this bfcache-friendly: pagehide fires for normal unloads and
        // back-forward cache entries, while beforeunload can force mobile
        // browsers to discard the previous page instead of preserving it.
        window.addEventListener('pagehide', saveScrollNow);
        window.addEventListener('pageshow', handlePageShowScrollRestore);
        window.addEventListener('popstate', handleBackForwardScrollRestore, true);
        document.addEventListener('click', saveBeforeInternalNavigation, true);

        return () => {
            if (saveFrame) window.cancelAnimationFrame(saveFrame);
            if (saveTimer) window.clearTimeout(saveTimer);
            window.removeEventListener('scroll', scheduleSaveScroll);
            window.removeEventListener('pagehide', saveScrollNow);
            window.removeEventListener('pageshow', handlePageShowScrollRestore);
            window.removeEventListener('popstate', handleBackForwardScrollRestore, true);
            document.removeEventListener('click', saveBeforeInternalNavigation, true);
            restoreNativeScrollRestoration(previousScrollRestoration);
        };
    }, []);

    useEffect(() => {
        const handleWindowFocus = () => {
            clearRoutePending();
            reassertMobileChrome();
        };
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
        window.addEventListener('focus', handleWindowFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            window.removeEventListener('pagehide', clearBackForwardTransientState);
            window.removeEventListener('pageshow', clearBackForwardTransientState);
            window.removeEventListener('popstate', clearBackForwardTransientState);
            window.removeEventListener('focus', handleWindowFocus);
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
