'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

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
    return '/';
}

export default function FloatingBackButton() {
    const pathname = usePathname();
    const router = useRouter();
    const backingRef = useRef(false);
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        const query = window.matchMedia('(min-width: 768px)');
        const update = () => setIsDesktop(query.matches);
        update();
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);

    if (!shouldShowFloatingBack(pathname)) return null;
    const pcOnly = isPcOnlyFloatingBack(pathname);
    if (pcOnly && !isDesktop) return null;

    const handleBack = () => {
        if (backingRef.current) return;
        backingRef.current = true;
        if (pathname === '/admin') {
            router.replace('/profile');
            return;
        }
        if (pathname === '/settings' && typeof window !== 'undefined') {
            const storedFallback = sessionStorage.getItem('mm_settings_return_to');
            const fallbackTarget = !storedFallback || storedFallback === '/settings' ? '/' : storedFallback;
            window.dispatchEvent(new Event('mm-settings-exit'));
            window.location.assign(fallbackTarget);
            return;
        }
        if (typeof window !== 'undefined' && window.history.length > 1) {
            const currentPath = `${window.location.pathname}${window.location.search}`;
            const fallbackTarget = getBackFallback(pathname);
            router.back();
            window.setTimeout(() => {
                const nextPath = `${window.location.pathname}${window.location.search}`;
                if (nextPath === currentPath) {
                    router.replace(fallbackTarget);
                }
            }, 420);
        } else {
            router.replace('/');
        }
    };

    if (pathname === '/settings') {
        return (
            <a
                href="/"
                onPointerDown={(event) => {
                    if (event.pointerType === 'touch') {
                        event.preventDefault();
                        handleBack();
                    }
                }}
                onClick={(event) => {
                    if (backingRef.current) {
                        event.preventDefault();
                        return;
                    }
                    handleBack();
                }}
                className="mm-floating-back-button"
                aria-label="Back"
            >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
            </a>
        );
    }

    return (
        <button
            type="button"
            onPointerDown={(event) => {
                if (event.pointerType === 'touch') {
                    event.preventDefault();
                    handleBack();
                }
            }}
            onClick={(event) => {
                if (backingRef.current) {
                    event.preventDefault();
                    return;
                }
                handleBack();
            }}
            className={`mm-floating-back-button ${pcOnly ? 'mm-floating-back-button--pc-only' : ''}`}
            aria-label="Back"
        >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
        </button>
    );
}
