'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Wraps page content with bottom padding only on pages where MobileBottomNav is visible */
export default function MainContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Listen for detail panel open signal from map page
    const [detailOpen, setDetailOpen] = useState(false);
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setDetailOpen(document.body.hasAttribute('data-detail-open'));
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-detail-open'] });
        return () => observer.disconnect();
    }, []);

    // Scroll to top on page navigation (except pages with self-managed scroll restoration)
    useEffect(() => {
        // Pages that manage their own scroll restoration (e.g. artworks list)
        const selfManagedScrollKeys = ['artworks_scroll_pos'];
        const hasRestoredScroll = selfManagedScrollKeys.some(k => {
            try { return !!sessionStorage.getItem(k); } catch { return false; }
        });
        if (!hasRestoredScroll) {
            window.scrollTo(0, 0);
        }
    }, [pathname]);

    // Mirror the show logic from MobileBottomNav (whitelist)
    const showNavPages = ['/', '/saved', '/blog', '/artworks', '/plans', '/collections'];
    const navHidden = !showNavPages.includes(pathname) || detailOpen;

    // Navigation tab pages that get fade animation
    const isNavPage = showNavPages.includes(pathname) || pathname.startsWith('/artworks');

    return (
        <main key={isNavPage ? pathname : undefined} className={`flex-1 flex flex-col relative w-full h-full ${navHidden ? '' : 'pb-[56px]'} lg:pb-0 ${isNavPage ? 'animate-fadeInUp' : ''}`}>
            {children}
        </main>
    );
}

