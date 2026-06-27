'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { useApp } from '@/components/AppContext';
import { backLikeBrowser, backWithFallback, navigateDocument } from '@/lib/route-pending';

const FLOATING_BACK_ROUTES = new Set([
    '/admin',
    '/profile',
    '/settings',
    '/notifications',
]);

function shouldShowFloatingBack(pathname: string | null) {
    if (!pathname) return false;
    if (FLOATING_BACK_ROUTES.has(pathname)) return true;
    if (pathname.startsWith('/notifications/')) return true;
    if (pathname.startsWith('/museums/')) return true;
    if (pathname.startsWith('/artworks/')) return true;
    if (pathname.startsWith('/blog/')) return true;
    if (pathname.startsWith('/collections/')) return true;
    if (pathname.startsWith('/plans/')) return true;
    return false;
}

function isPcOnlyFloatingBack(pathname: string | null) {
    if (!pathname) return false;
    return (
        pathname.startsWith('/museums/')
        || pathname.startsWith('/artworks/')
        || pathname.startsWith('/blog/')
        || pathname.startsWith('/collections/')
        || pathname.startsWith('/plans/')
    );
}

function getBackFallback(pathname: string | null) {
    if (!pathname) return '/';
    if (pathname.startsWith('/blog/')) return '/blog';
    if (pathname.startsWith('/artworks/')) return '/artworks';
    if (pathname.startsWith('/collections/')) return '/collections';
    if (pathname.startsWith('/plans/')) return '/plans';
    if (pathname.startsWith('/museums/')) return '/';
    if (pathname.startsWith('/notifications/')) return '/notifications';
    if (pathname === '/profile') return '/';
    if (pathname === '/settings') return '/';
    return '/';
}

export default function FloatingBackButton() {
    const pathname = usePathname();
    const { locale } = useApp();
    const backingRef = useRef(false);
    const backPointerHandledRef = useRef(false);
    const [isDesktop, setIsDesktop] = useState(false);
    const [hiddenDuringBack, setHiddenDuringBack] = useState(false);

    useEffect(() => {
        const query = window.matchMedia('(min-width: 768px)');
        const update = () => setIsDesktop(query.matches);
        update();
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        setHiddenDuringBack(false);
        const reset = () => {
            backingRef.current = false;
            setHiddenDuringBack(false);
        };
        const hideForNavigation = () => {
            setHiddenDuringBack(true);
            window.setTimeout(() => setHiddenDuringBack(false), 1600);
        };
        window.addEventListener('pageshow', reset);
        window.addEventListener('pagehide', hideForNavigation);
        window.addEventListener('popstate', hideForNavigation, true);
        window.addEventListener('mm:client-route-change-start', hideForNavigation);
        return () => {
            window.removeEventListener('pageshow', reset);
            window.removeEventListener('pagehide', hideForNavigation);
            window.removeEventListener('popstate', hideForNavigation, true);
            window.removeEventListener('mm:client-route-change-start', hideForNavigation);
        };
    }, [pathname]);

    if (hiddenDuringBack || !shouldShowFloatingBack(pathname)) return null;
    const pcOnly = isPcOnlyFloatingBack(pathname);
    if (pcOnly && !isDesktop) return null;

    const handleBack = () => {
        if (backingRef.current) return;
        backingRef.current = true;
        setHiddenDuringBack(true);
        window.setTimeout(() => {
            backingRef.current = false;
            setHiddenDuringBack(false);
        }, 1400);
        if (pathname?.startsWith('/museums/') && typeof window !== 'undefined') {
            window.dispatchEvent(new Event('mm:museum-detail-back'));
            return;
        }
        if (pathname?.startsWith('/blog/')) {
            backLikeBrowser('/blog');
            return;
        }
        if (pathname === '/admin') {
            navigateDocument('/profile');
            return;
        }
        if (pathname === '/settings' && typeof window !== 'undefined') {
            const storedFallback = sessionStorage.getItem('mm_settings_return_to') || '/';
            const fallbackTarget = storedFallback === '/settings' ? '/' : storedFallback;
            backWithFallback(fallbackTarget, locale, { timeoutMs: 900, pendingOnFallback: false });
            return;
        }
        backWithFallback(getBackFallback(pathname), locale, { timeoutMs: 900, pendingOnFallback: false });
    };

    const handleBackPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
        event.preventDefault();
        backPointerHandledRef.current = true;
        handleBack();
    };

    const handleBackClick = (event: MouseEvent<HTMLButtonElement>) => {
        if (backPointerHandledRef.current) {
            event.preventDefault();
            backPointerHandledRef.current = false;
            return;
        }
        handleBack();
    };

    return (
        <button
            type="button"
            onPointerDown={handleBackPointerDown}
            onClick={handleBackClick}
            className={`mm-floating-back-button ${pcOnly ? 'mm-floating-back-button--pc-only' : ''}`}
            aria-label="Back"
        >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
        </button>
    );
}
