'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

const NAV_PAGE_KEYS: Record<string, string> = {
    '/': 'home',
    '/exhibitions': 'exhibitions',
    '/saved': 'saved',
    '/blog': 'story',
    '/artworks': 'artworks',
    '/plans': 'plans',
    '/collections': 'collections',
    '/compare': 'compare',
};

/** Wraps page content with bottom padding only on pages where MobileBottomNav is visible */
export default function MainContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

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

    // Detect arrival via back navigation so list/editorial pages slide in from the
    // back direction (set by backWithFallback; consumed here unless a child detail
    // page already consumed it). Map page ('/') keeps the plain fade.
    const [isBack, setIsBack] = useState(false);
    useEffect(() => {
        try {
            const ts = sessionStorage.getItem('navigating-back');
            const fresh = !!ts && Date.now() - parseInt(ts) < 600;
            setIsBack(fresh);
            if (ts) sessionStorage.removeItem('navigating-back');
        } catch { }
    }, [pathname]);

    // Mirror the show logic from MobileBottomNav (whitelist)
    const showNavPages = Object.keys(NAV_PAGE_KEYS);
    const navHidden = !showNavPages.includes(pathname) || detailOpen;

    // Navigation tab pages that get the soft tab-enter animation. Detail pages
    // own their own slide animations, so keep this exact-route only.
    const navPageKey = NAV_PAGE_KEYS[pathname] || undefined;
    const isNavPage = !!navPageKey;
    const shellClass = pathname === '/'
        ? 'mm-map-shell'
        : pathname === '/login'
            ? 'mm-entry-shell'
            : 'mm-editorial-shell';
    const enterClass = !isNavPage
        ? ''
        : isBack && pathname !== '/'
            ? 'page-slide-in-back'
            : 'mm-nav-page-enter';

    return (
        <main
            key={pathname}
            data-route={pathname}
            data-mm-page={navPageKey}
            className={`flex-1 flex flex-col relative w-full h-full ${shellClass} ${navHidden ? '' : 'pb-[56px]'} md:pb-0 ${enterClass}`}
        >
            {children}
        </main>
    );
}
