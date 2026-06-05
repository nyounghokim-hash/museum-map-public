'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useApp } from '@/components/AppContext';
import LoginRequiredModal from '@/components/ui/LoginRequiredModal';

const NAV_LABELS: Record<string, { map: string; saved: string; plans: string; artworks: string; story: string; collection: string; compare: string }> = {
    ko: { map: '지도', saved: '내 픽', plans: '내 여행', artworks: '작품', story: 'MM스토리', collection: '컬렉션', compare: '비교' },
    en: { map: 'Map', saved: 'My Pick', plans: 'My Trips', artworks: 'Artworks', story: 'MM Story', collection: 'Collection', compare: 'Compare' },
    ja: { map: '地図', saved: '保存', plans: '旅行', artworks: '作品', story: 'MMストーリー', collection: 'コレクション', compare: '比較' },
    de: { map: 'Karte', saved: 'Merkliste', plans: 'Reisen', artworks: 'Werke', story: 'MM Story', collection: 'Sammlung', compare: 'Vergleich' },
    fr: { map: 'Carte', saved: 'Favoris', plans: 'Voyages', artworks: 'Œuvres', story: 'MM Story', collection: 'Collection', compare: 'Comparer' },
    es: { map: 'Mapa', saved: 'Guardados', plans: 'Viajes', artworks: 'Obras', story: 'MM Story', collection: 'Colección', compare: 'Comparar' },
    pt: { map: 'Mapa', saved: 'Salvos', plans: 'Viagens', artworks: 'Obras', story: 'MM Story', collection: 'Coleção', compare: 'Comparar' },
    'zh-CN': { map: '地图', saved: '收藏', plans: '我的旅行', artworks: '作品', story: 'MM故事', collection: '收藏集', compare: '比较' },
    'zh-TW': { map: '地圖', saved: '收藏', plans: '我的旅行', artworks: '作品', story: 'MM故事', collection: '收藏集', compare: '比較' },
    da: { map: 'Kort', saved: 'Gemt', plans: 'Rejser', artworks: 'Værker', story: 'MM Story', collection: 'Samling', compare: 'Sammenlign' },
    fi: { map: 'Kartta', saved: 'Tallennettu', plans: 'Matkat', artworks: 'Teokset', story: 'MM Story', collection: 'Kokoelma', compare: 'Vertaile' },
    sv: { map: 'Karta', saved: 'Sparade', plans: 'Resor', artworks: 'Konst', story: 'MM Story', collection: 'Samling', compare: 'Jämför' },
    et: { map: 'Kaart', saved: 'Salvestatud', plans: 'Reisid', artworks: 'Teosed', story: 'MM Story', collection: 'Kogu', compare: 'Võrdle' },
};

const styles = {
    root: {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 90,
        display: 'block',
        width: '100vw',
        maxWidth: '100vw',
        pointerEvents: 'none',
    } satisfies CSSProperties,
    shell: {
        pointerEvents: 'auto',
        width: '100%',
        overflow: 'visible',
        position: 'relative',
        padding: '10px 12px max(env(safe-area-inset-bottom, 0px), 8px)',
        borderRadius: '28px 28px 0 0',
        background: 'rgba(255,255,255,.96)',
        borderTop: '1px solid rgba(226,232,240,.76)',
        boxShadow: '0 -18px 48px rgba(15,23,42,.10), inset 0 1px 0 rgba(255,255,255,.88)',
        WebkitBackdropFilter: 'blur(18px) saturate(170%)',
        backdropFilter: 'blur(18px) saturate(170%)',
    } satisfies CSSProperties,
    toolbar: {
        position: 'relative',
        marginBottom: 0,
    } satisfies CSSProperties,
    row: {
        position: 'relative',
        display: 'flex',
        alignItems: 'stretch',
        minWidth: 0,
    } satisfies CSSProperties,
    tab: {
        flex: '1 1 0',
        minWidth: 0,
        height: 58,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        margin: '0 3px',
        borderRadius: 18,
        color: '#64748b',
        textAlign: 'center',
        textDecoration: 'none',
        transition: 'background 180ms ease, color 180ms ease, transform 180ms ease',
    } satisfies CSSProperties,
    tabActive: {
        color: '#fff',
        background: 'linear-gradient(180deg, #2563eb 0%, #123fbd 100%)',
        boxShadow: '0 14px 28px rgba(37,99,235,.24), inset 0 1px 0 rgba(255,255,255,.28)',
    } satisfies CSSProperties,
    label: {
        maxWidth: '100%',
        overflow: 'hidden',
        color: 'currentColor',
        fontSize: 11,
        fontWeight: 900,
        lineHeight: 1.1,
        letterSpacing: 0,
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    } satisfies CSSProperties,
    centerSlot: {
        flex: '1 1 0',
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        margin: '0 8px',
    } satisfies CSSProperties,
    centerButton: {
        width: 64,
        height: 64,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 3,
        border: 0,
        borderRadius: 999,
        background: 'linear-gradient(180deg,#2563eb 0%,#123fbd 100%)',
        boxShadow: '0 18px 36px rgba(37,99,235,.34), inset 0 1px 0 rgba(255,255,255,.32)',
        color: '#fff',
    } satisfies CSSProperties,
    centerInactive: {
        background: '#fff',
        color: '#2563eb',
        boxShadow: '0 12px 28px rgba(15,23,42,.14), inset 0 1px 0 rgba(255,255,255,.88)',
        border: '1px solid rgba(226,232,240,.9)',
    } satisfies CSSProperties,
    centerPressed: {
        transform: 'translateY(3px) scale(0.94)',
        background: 'linear-gradient(180deg,#1d4ed8 0%,#0f2f91 100%)',
        boxShadow: '0 8px 18px rgba(37,99,235,.26), inset 0 4px 10px rgba(15,23,42,.22)',
        transition: 'transform 160ms ease, box-shadow 160ms ease, background 160ms ease',
    } satisfies CSSProperties,
    overlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(2, 6, 23, .46)',
    } satisfies CSSProperties,
    menu: {
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        bottom: 'calc(80px + env(safe-area-inset-bottom, 0px) + 12px)',
        minWidth: 270,
        display: 'flex',
        overflow: 'hidden',
        borderRadius: 24,
        background: 'rgba(255,255,255,.97)',
        border: '1px solid rgba(226,232,240,.88)',
        boxShadow: '0 28px 70px rgba(15,23,42,.22)',
        WebkitBackdropFilter: 'blur(18px) saturate(170%)',
        backdropFilter: 'blur(18px) saturate(170%)',
    } satisfies CSSProperties,
    menuButton: {
        flex: '1 1 0',
        minWidth: 86,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '13px 10px',
        border: 0,
        background: 'transparent',
        color: '#0f172a',
    } satisfies CSSProperties,
    divider: {
        width: 1,
        margin: '10px 0',
        background: 'rgba(226,232,240,.92)',
    } satisfies CSSProperties,
    badge: {
        position: 'absolute',
        top: -2,
        right: 0,
        minWidth: 18,
        height: 18,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        background: '#ef4444',
        border: '2px solid #fff',
        color: '#fff',
        fontSize: 10,
        fontWeight: 1000,
    } satisfies CSSProperties,
};

function TabIcon({ name, active }: { name: 'map' | 'saved' | 'story' | 'artworks'; active: boolean }) {
    const className = `w-6 h-6 ${active ? 'text-white' : 'text-slate-500 dark:text-slate-300'}`;
    if (name === 'map') {
        return <svg className={className} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke={active ? 'none' : 'currentColor'} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    }
    if (name === 'saved') {
        return <svg className={className} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke={active ? 'none' : 'currentColor'} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>;
    }
    if (name === 'story') {
        return <svg className={className} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke={active ? 'none' : 'currentColor'} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2M7 16h6M7 8h6v4H7V8z" /></svg>;
    }
    return <svg className={className} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke={active ? 'none' : 'currentColor'} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
}

function MenuIcon({ name }: { name: 'plans' | 'collection' | 'compare' }) {
    const color = '#2563eb';
    if (name === 'plans') {
        return <svg className="w-5 h-5" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>;
    }
    if (name === 'collection') {
        return <svg className="w-5 h-5" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
    }
    return <svg className="w-5 h-5" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5 5 0 006 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5 5 0 006 0M18 7l3 9m-3-9l-6-2m0-2v18m0 0H9m3 0h3" /></svg>;
}

export default function MobileBottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { locale, darkMode } = useApp();
    const { data: session } = useSession();
    const isGuest = !session || session.user?.name?.startsWith('guest_');
    const [menuOpen, setMenuOpen] = useState(false);
    const [navigatingAway, setNavigatingAway] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [loginModalOpen, setLoginModalOpen] = useState(false);
    const [loginCallbackUrl, setLoginCallbackUrl] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setDetailOpen(document.body.hasAttribute('data-detail-open'));
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-detail-open'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const update = () => setIsMobile(window.innerWidth < 1024);
        update();
        window.addEventListener('resize', update, { passive: true });
        window.addEventListener('orientationchange', update, { passive: true });
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
        };
    }, []);

    useEffect(() => {
        setMenuOpen(false);
        setNavigatingAway(false);
    }, [pathname]);

    const showNavPages = ['/', '/saved', '/blog', '/artworks', '/plans', '/collections', '/compare'];
    if (!isMobile || !showNavPages.includes(pathname) || detailOpen) return null;

    const labels = NAV_LABELS[locale] || NAV_LABELS.en;
    const isCenterActive = navigatingAway || pathname === '/plans' || pathname.startsWith('/collections') || pathname === '/compare';
    const themedShellStyle = darkMode ? {
        background: 'rgba(7,20,38,.94)',
        borderTop: '1px solid rgba(96,165,250,.22)',
        boxShadow: '0 -18px 48px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.08)',
    } satisfies CSSProperties : null;
    const themedInactiveTabStyle = darkMode ? { color: '#cbd5e1' } satisfies CSSProperties : null;
    const themedCenterInactiveStyle = darkMode ? {
        background: 'rgba(15,23,42,.92)',
        color: '#93c5fd',
        boxShadow: '0 12px 28px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.08)',
        border: '1px solid rgba(96,165,250,.22)',
    } satisfies CSSProperties : null;
    const themedMenuStyle = darkMode ? {
        background: 'rgba(7,20,38,.96)',
        border: '1px solid rgba(96,165,250,.22)',
        boxShadow: '0 28px 70px rgba(0,0,0,.42)',
    } satisfies CSSProperties : null;
    const themedMenuButtonStyle = darkMode ? { color: '#e2e8f0' } satisfies CSSProperties : null;
    const themedDividerStyle = darkMode ? { background: 'rgba(96,165,250,.18)' } satisfies CSSProperties : null;

    const requireAuth = (href: string) => (event: MouseEvent) => {
        if (isGuest) {
            event.preventDefault();
            setLoginCallbackUrl(href);
            setLoginModalOpen(true);
        }
    };

    const goProtected = (href: string) => {
        setMenuOpen(false);
        if (isGuest && href !== '/compare') {
            setLoginCallbackUrl(href);
            setLoginModalOpen(true);
            return;
        }
        setNavigatingAway(true);
        router.push(href);
    };

    const tabsLeft = [
        { href: '/', key: 'map' as const, label: labels.map, active: !navigatingAway && pathname === '/' },
        { href: '/saved', key: 'saved' as const, label: labels.saved, active: !navigatingAway && pathname.startsWith('/saved'), auth: true },
    ];
    const tabsRight = [
        { href: '/blog', key: 'story' as const, label: labels.story, active: !navigatingAway && pathname.startsWith('/blog') },
        { href: '/artworks', key: 'artworks' as const, label: labels.artworks, active: !navigatingAway && pathname.startsWith('/artworks') },
    ];

    const renderTab = (tab: typeof tabsLeft[number] | typeof tabsRight[number]) => (
        <Link
            key={tab.href}
            href={tab.href}
            onClick={'auth' in tab && tab.auth ? requireAuth(tab.href) : undefined}
            className={`mm-nav-original-tab ${tab.active && !menuOpen ? 'is-active' : ''}`}
            style={{ ...styles.tab, ...(!tab.active || menuOpen ? themedInactiveTabStyle : null), ...(tab.active && !menuOpen ? styles.tabActive : null) }}
        >
            <TabIcon name={tab.key} active={tab.active && !menuOpen} />
            <span style={{ ...styles.label, fontWeight: tab.active && !menuOpen ? 850 : 600 }}>{tab.label}</span>
        </Link>
    );

    return (
        <>
            {menuOpen && (
                <>
                    <div style={styles.overlay} onClick={() => setMenuOpen(false)} />
                    <div style={{ ...styles.menu, ...themedMenuStyle }}>
                        <button type="button" style={{ ...styles.menuButton, ...themedMenuButtonStyle }} onClick={() => goProtected('/plans')}>
                            <MenuIcon name="plans" />
                            <span style={{ ...styles.label, fontWeight: 650 }}>{labels.plans}</span>
                        </button>
                        <div style={{ ...styles.divider, ...themedDividerStyle }} />
                        <button type="button" style={{ ...styles.menuButton, ...themedMenuButtonStyle }} onClick={() => goProtected('/collections')}>
                            <MenuIcon name="collection" />
                            <span style={{ ...styles.label, fontWeight: 650 }}>{labels.collection}</span>
                        </button>
                        <div style={{ ...styles.divider, ...themedDividerStyle }} />
                        <button type="button" style={{ ...styles.menuButton, ...themedMenuButtonStyle, position: 'relative' }} onClick={() => goProtected('/compare')}>
                            <MenuIcon name="compare" />
                            <span style={{ ...styles.label, fontWeight: 650 }}>{labels.compare}</span>
                        </button>
                    </div>
                </>
            )}

            <nav className="mobile-bottom-nav lg:hidden" style={styles.root}>
                <div style={{ ...styles.shell, ...themedShellStyle }}>
                    <div id="nav-toolbar" style={styles.toolbar} />
                    <div style={styles.row}>
                        {tabsLeft.map(renderTab)}

                        <div style={styles.centerSlot} ref={menuRef}>
                            <button
                                type="button"
                                aria-expanded={menuOpen}
                                aria-label={labels.plans}
                                className="mobile-nav-center-button"
                                style={{ ...styles.centerButton, ...(!isCenterActive ? styles.centerInactive : null), ...(!isCenterActive ? themedCenterInactiveStyle : null), ...(menuOpen ? styles.centerPressed : null) }}
                                onClick={() => {
                                    if (isGuest) {
                                        setLoginCallbackUrl('/plans');
                                        setLoginModalOpen(true);
                                        return;
                                    }
                                    setMenuOpen((open) => !open);
                                }}
                            >
                                <svg className="w-7 h-7" fill={isCenterActive ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isCenterActive ? 0 : 1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 2h4v3h-4z" />
                                    <rect x="5" y="5" width="14" height="14" rx="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <circle cx="9" cy="21.5" r="1.2" />
                                    <circle cx="15" cy="21.5" r="1.2" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5v14m6-14v14" />
                                </svg>
                            </button>
                        </div>

                        {tabsRight.map(renderTab)}
                    </div>
                </div>
            </nav>

            <LoginRequiredModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} callbackUrl={loginCallbackUrl} />
        </>
    );
}
