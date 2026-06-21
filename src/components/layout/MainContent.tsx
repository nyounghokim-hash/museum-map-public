'use client';
import { useState, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const SCROLL_POSITION_PREFIX = 'mm-scroll-position:';
const SCROLL_POSITION_LOCK_PREFIX = 'mm-scroll-position-lock:';
const SCROLL_POSITION_TTL_MS = 30 * 60 * 1000;
const SCROLL_POSITION_LOCK_TTL_MS = 3000;

type NavigationKind = 'push' | 'back_forward';

function storageKey(routeKey: string) {
    return `${SCROLL_POSITION_PREFIX}${routeKey}`;
}

function lockKey(routeKey: string) {
    return `${SCROLL_POSITION_LOCK_PREFIX}${routeKey}`;
}

function getBrowserRouteKey() {
    if (typeof window === 'undefined') return '';
    return `${window.location.pathname}${window.location.search}`;
}

function saveScrollPosition(routeKey: string) {
    if (typeof window === 'undefined' || !routeKey) return;
    try {
        const lockTs = Number(sessionStorage.getItem(lockKey(routeKey)) || '0');
        if (Number.isFinite(lockTs) && Date.now() - lockTs < SCROLL_POSITION_LOCK_TTL_MS) {
            const saved = readScrollPosition(routeKey);
            if (saved && saved.y > window.scrollY) return;
        }
        sessionStorage.setItem(storageKey(routeKey), JSON.stringify({
            x: window.scrollX,
            y: window.scrollY,
            ts: Date.now(),
        }));
    } catch { }
}

function readScrollPosition(routeKey: string) {
    if (typeof window === 'undefined' || !routeKey) return null;
    try {
        const raw = sessionStorage.getItem(storageKey(routeKey));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { x?: number; y?: number; ts?: number };
        if (typeof parsed.ts === 'number' && Date.now() - parsed.ts > SCROLL_POSITION_TTL_MS) {
            sessionStorage.removeItem(storageKey(routeKey));
            return null;
        }
        return {
            x: Number.isFinite(parsed.x) ? Number(parsed.x) : 0,
            y: Number.isFinite(parsed.y) ? Number(parsed.y) : 0,
        };
    } catch {
        sessionStorage.removeItem(storageKey(routeKey));
        return null;
    }
}

function restoreSavedScroll(routeKey: string) {
    if (typeof window === 'undefined') return;
    const saved = readScrollPosition(routeKey);
    if (!saved || saved.y <= 0) return;
    const restore = () => window.scrollTo(saved.x, saved.y);
    window.requestAnimationFrame(restore);
    [80, 220, 520, 900, 1400].forEach((delay) => {
        window.setTimeout(restore, delay);
    });
}

/** Wraps page content with bottom padding only on pages where MobileBottomNav is visible */
export default function MainContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const search = searchParams?.toString();
    const routeKey = `${pathname}${search ? `?${search}` : ''}`;
    const routeKeyRef = useRef(routeKey);
    const navigationKindRef = useRef<NavigationKind>('push');

    // Listen for detail panel open signal from map page
    const [detailOpen, setDetailOpen] = useState(false);
    useEffect(() => {
        setDetailOpen(document.body.hasAttribute('data-detail-open'));
        const observer = new MutationObserver(() => {
            setDetailOpen(document.body.hasAttribute('data-detail-open'));
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-detail-open'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        routeKeyRef.current = routeKey;
    }, [routeKey]);

    // Save and restore scroll explicitly so back buttons and mobile back-swipe feel native.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const previousScrollRestoration = window.history.scrollRestoration;
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }

        const saveCurrentRoute = () => saveScrollPosition(routeKeyRef.current || getBrowserRouteKey());
        const markPushNavigation = () => {
            saveCurrentRoute();
            navigationKindRef.current = 'push';
        };
        const handlePointerDown = (event: PointerEvent) => {
            if (event.defaultPrevented) return;
            const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
            if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
            if (anchor.dataset.mmRoutePending === 'off' || anchor.closest('[data-mm-route-pending="off"]')) return;
            try {
                const next = new URL(anchor.href);
                if (next.origin !== window.location.origin) return;
                const current = getBrowserRouteKey();
                const nextKey = `${next.pathname}${next.search}`;
                if (current === nextKey) return;
                saveCurrentRoute();
                navigationKindRef.current = 'push';
            } catch { }
        };
        const handlePopState = () => {
            saveCurrentRoute();
            navigationKindRef.current = 'back_forward';
        };
        const handleVisibilityChange = () => {
            if (document.hidden) saveCurrentRoute();
        };
        const handlePageShow = (event: PageTransitionEvent) => {
            const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
            if (event.persisted || navEntry?.type === 'back_forward') {
                restoreSavedScroll(getBrowserRouteKey());
            }
        };

        document.addEventListener('pointerdown', handlePointerDown, true);
        window.addEventListener('mm:client-route-change-start', markPushNavigation);
        window.addEventListener('popstate', handlePopState, true);
        window.addEventListener('pagehide', saveCurrentRoute);
        window.addEventListener('pageshow', handlePageShow);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
            window.removeEventListener('mm:client-route-change-start', markPushNavigation);
            window.removeEventListener('popstate', handlePopState, true);
            window.removeEventListener('pagehide', saveCurrentRoute);
            window.removeEventListener('pageshow', handlePageShow);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if ('scrollRestoration' in window.history) {
                window.history.scrollRestoration = previousScrollRestoration;
            }
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        const navigationKind = navigationKindRef.current === 'push' && navEntry?.type === 'back_forward'
            ? 'back_forward'
            : navigationKindRef.current;
        navigationKindRef.current = 'push';
        let frame = 0;
        const timers: number[] = [];
        const shouldRespectHash = window.location.hash.length > 1;

        if (!shouldRespectHash && navigationKind === 'back_forward') {
            const saved = readScrollPosition(routeKey);
            if (saved && saved.y > 0) {
                const restore = () => window.scrollTo(saved.x, saved.y);
                frame = window.requestAnimationFrame(restore);
                [80, 220, 520, 900, 1400].forEach((delay) => {
                    timers.push(window.setTimeout(restore, delay));
                });
            }
        } else if (!shouldRespectHash) {
            frame = window.requestAnimationFrame(() => window.scrollTo(0, 0));
        }

        return () => {
            if (frame) window.cancelAnimationFrame(frame);
            timers.forEach((timer) => window.clearTimeout(timer));
            saveScrollPosition(routeKey);
        };
    }, [routeKey]);

    // Mirror the show logic from MobileBottomNav (whitelist)
    const showNavPages = ['/', '/saved', '/blog', '/artworks', '/plans', '/collections', '/compare'];
    const navHidden = !showNavPages.includes(pathname) || detailOpen;

    // Navigation tab pages that get fade animation
    const isNavPage = showNavPages.includes(pathname) || pathname.startsWith('/artworks');
    const shellClass = pathname === '/'
        ? 'mm-map-shell'
        : pathname === '/login'
            ? 'mm-entry-shell'
            : 'mm-editorial-shell';

    return (
        <main data-route={pathname} className={`flex-1 flex flex-col relative w-full h-full ${shellClass} ${navHidden ? '' : 'pb-[56px]'} md:pb-0 ${isNavPage ? 'mm-nav-page-enter' : ''}`}>
            {children}
        </main>
    );
}
