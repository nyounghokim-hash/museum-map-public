'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

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
