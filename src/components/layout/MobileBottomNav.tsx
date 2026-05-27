'use client';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import { useSession } from 'next-auth/react';
import LoadingAnimation from '@/components/ui/LoadingAnimation';
import LoginRequiredModal from '@/components/ui/LoginRequiredModal';
import { useCompare } from '@/hooks/useCompare';

const NAV_LABELS: Record<string, { map: string; saved: string; plans: string; artworks: string; story: string; collection: string; compare: string }> = {
    ko: { map: '지도', saved: '내 픽', plans: '내 여행', artworks: '작품', story: '스토리', collection: '컬렉션', compare: '비교' },
    en: { map: 'Map', saved: 'My Pick', plans: 'My Trips', artworks: 'Artworks', story: 'Story', collection: 'Collection', compare: 'Compare' },
    ja: { map: '地図', saved: '保存', plans: '旅行', artworks: '作品', story: 'MMストーリー', collection: 'コレクション', compare: '比較' },
    de: { map: 'Karte', saved: 'Gespeichert', plans: 'Reisen', artworks: 'Werke', story: 'MM Story', collection: 'Sammlung', compare: 'Vergleich' },
    fr: { map: 'Carte', saved: 'Sauvegardé', plans: 'Voyages', artworks: 'Œuvres', story: 'MM Story', collection: 'Collection', compare: 'Comparer' },
    es: { map: 'Mapa', saved: 'Guardados', plans: 'Viajes', artworks: 'Obras', story: 'MM Story', collection: 'Colección', compare: 'Comparar' },
    pt: { map: 'Mapa', saved: 'Salvos', plans: 'Viagens', artworks: 'Obras', story: 'MM Story', collection: 'Coleção', compare: 'Comparar' },
    'zh-CN': { map: '地图', saved: '收藏', plans: '我的旅行', artworks: '作品', story: 'MM故事', collection: '收藏集', compare: '比较' },
    'zh-TW': { map: '地圖', saved: '收藏', plans: '我的旅行', artworks: '作品', story: 'MM故事', collection: '收藏集', compare: '比較' },
    da: { map: 'Kort', saved: 'Gemt', plans: 'Rejser', artworks: 'Værker', story: 'MM Story', collection: 'Samling', compare: 'Sammenlign' },
    fi: { map: 'Kartta', saved: 'Tallennettu', plans: 'Matkat', artworks: 'Teokset', story: 'MM Story', collection: 'Kokoelma', compare: 'Vertaile' },
    sv: { map: 'Karta', saved: 'Sparade', plans: 'Resor', artworks: 'Konst', story: 'MM Story', collection: 'Samling', compare: 'Jämför' },
    et: { map: 'Kaart', saved: 'Salvestatud', plans: 'Reisid', artworks: 'Teosed', story: 'MM Story', collection: 'Kogu', compare: 'Võrdle' },
};

export default function MobileBottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { locale } = useApp();
    const { data: session } = useSession();
    const isGuest = !session || session.user?.name?.startsWith('guest_');
    const [menuOpen, setMenuOpen] = useState(false);
    const [animKey, setAnimKey] = useState(0);
    const [navigatingAway, setNavigatingAway] = useState(false);
    const [loginModalOpen, setLoginModalOpen] = useState(false);
    const [loginCallbackUrl, setLoginCallbackUrl] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);
    const { compareCount } = useCompare();

    // Listen for detail panel open signal from map page
    const [detailOpen, setDetailOpen] = useState(false);
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setDetailOpen(document.body.hasAttribute('data-detail-open'));
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-detail-open'] });
        return () => observer.disconnect();
    }, []);

    // Dim overlay handles closing, no need for outside click handler

    // Close menu on route change
    useEffect(() => { setMenuOpen(false); setNavigatingAway(false); }, [pathname]);

    // Only show on main pages, hide when detail panel is open
    const showNavPages = ['/', '/saved', '/blog', '/artworks', '/plans', '/collections', '/compare'];
    if (!showNavPages.includes(pathname) || detailOpen) return null;

    const labels = NAV_LABELS[locale] || NAV_LABELS.en;

    const isCenterActive = navigatingAway || pathname === '/plans' || pathname.startsWith('/collections') || pathname === '/compare';

    const tabs = [
        {
            href: '/',
            label: labels.map,
            icon: (active: boolean) => (
                <svg className={`w-7 h-7 ${active ? 'text-white' : 'text-gray-400 dark:text-neutral-500'}`} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke={active ? 'none' : 'currentColor'} strokeWidth={active ? 0 : 1.6}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            ),
            isActive: !navigatingAway && pathname === '/',
        },
        {
            href: '/saved',
            label: labels.saved,
            needsAuth: true,
            icon: (active: boolean) => (
                <svg className={`w-7 h-7 ${active ? 'text-white' : 'text-gray-400 dark:text-neutral-500'}`} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke={active ? 'none' : 'currentColor'} strokeWidth={active ? 0 : 1.6}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
            ),
            isActive: !navigatingAway && pathname.startsWith('/saved'),
        },
    ];

    const tabsRight = [
        {
            href: '/blog',
            label: labels.story,
            icon: (active: boolean) => (
                <svg className={`w-7 h-7 ${active ? 'text-white' : 'text-gray-400 dark:text-neutral-500'}`} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke={active ? 'none' : 'currentColor'} strokeWidth={active ? 0 : 1.6}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
            ),
            isActive: !navigatingAway && pathname.startsWith('/blog'),
        },
        {
            href: '/artworks',
            label: labels.artworks,
            icon: (active: boolean) => (
                <svg className={`w-7 h-7 ${active ? 'text-white' : 'text-gray-400 dark:text-neutral-500'}`} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke={active ? 'none' : 'currentColor'} strokeWidth={active ? 0 : 1.6}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            ),
            isActive: !navigatingAway && pathname.startsWith('/artworks'),
        },
    ];

    const renderTab = (tab: typeof tabs[0] & { needsAuth?: boolean }) => {
        const handleClick = (e: React.MouseEvent) => {
            if (tab.needsAuth && isGuest) {
                e.preventDefault();
                setLoginCallbackUrl(tab.href);
                setLoginModalOpen(true);
            }
        };
        return (
            <Link
                key={tab.label}
                href={tab.href}
                onClick={handleClick}
                className={`flex-1 basis-0 flex flex-col items-center justify-center gap-0.5 py-2 mx-1 my-1 rounded-xl transition-[background,color,box-shadow] duration-200 ease-out min-w-0 ${tab.isActive ? 'gradient-btn' : ''}`}
            >
            <span className="transition-colors duration-200">
                {tab.icon(tab.isActive)}
            </span>
            <span className={`font-extrabold tracking-tight transition-colors duration-200 text-[11px] leading-tight truncate max-w-full px-1 ${tab.isActive ? 'text-white' : 'text-gray-400 dark:text-neutral-500'}`}>
                {tab.label}
            </span>
            </Link>
        );
    };

    return (
        <>
            {/* Dim overlay + popup - rendered OUTSIDE backdrop-filter parent */}
            {menuOpen && (
                <>
                    <div className="fixed inset-0 z-[9998] bg-black/50 animate-[fadeIn_0.2s_ease-out]" onClick={() => setMenuOpen(false)} />
                    <div className="fixed left-1/2 -translate-x-1/2 z-[9999] animate-[slideUpFade_0.3s_cubic-bezier(0.34,1.56,0.64,1)]" style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px) + 12px)' }}>
                        <div className="flex gap-0 glass-popup rounded-2xl overflow-hidden">
                            <button
                                onClick={() => {
                                    setMenuOpen(false);
                                    if (isGuest) { setLoginCallbackUrl('/plans'); setLoginModalOpen(true); return; }
                                    setNavigatingAway(true); router.push('/plans');
                                }}
                                className="flex-1 min-w-[72px] flex flex-col items-center gap-1.5 px-3 py-3 hover:bg-white/30 dark:hover:bg-white/5 transition-colors active:bg-white/50 dark:active:bg-white/10"
                            >
                                <svg className="w-5 h-5 text-purple-500 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                                <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200">{labels.plans}</span>
                            </button>
                            <div className="w-px my-2" style={{ background: 'var(--gradient-border)' }} />
                            <button
                                onClick={() => {
                                    setMenuOpen(false);
                                    if (isGuest) { setLoginCallbackUrl('/collections'); setLoginModalOpen(true); return; }
                                    setNavigatingAway(true); router.push('/collections');
                                }}
                                className="flex-1 min-w-[72px] flex flex-col items-center gap-1.5 px-3 py-3 hover:bg-white/30 dark:hover:bg-white/5 transition-colors active:bg-white/50 dark:active:bg-white/10"
                            >
                                <svg className="w-5 h-5 text-orange-500 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200">{labels.collection}</span>
                            </button>
                            <div className="w-px my-2" style={{ background: 'var(--gradient-border)' }} />
                            <button
                                onClick={() => {
                                    setMenuOpen(false);
                                    if (isGuest) { setLoginCallbackUrl('/compare'); setLoginModalOpen(true); return; }
                                    setNavigatingAway(true); router.push('/compare');
                                }}
                                className="relative flex-1 min-w-[72px] flex flex-col items-center gap-1.5 px-3 py-3 hover:bg-white/30 dark:hover:bg-white/5 transition-colors active:bg-white/50 dark:active:bg-white/10"
                            >
                                <svg className="w-5 h-5 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                                </svg>
                                <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200">{labels.compare}</span>
                                {compareCount > 0 && (
                                    <span className="absolute -top-0.5 right-3 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-black shadow-sm">
                                        {compareCount}
                                    </span>
                                )}
                            </button>
                        </div>
                        {/* Triangle arrow with gradient */}
                        <div className="flex justify-center">
                            <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-purple-400/50 dark:border-t-purple-500/50" />
                        </div>
                    </div>
                </>
            )}

            <nav className="mobile-bottom-nav lg:hidden fixed bottom-0 left-0 right-0 z-50">
                <div className="w-full overflow-visible relative pt-2 px-[12px]"
                    style={{
                        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
                        background: 'var(--glass-bg-heavy)',
                        backdropFilter: 'blur(24px) saturate(200%)',
                        WebkitBackdropFilter: 'blur(24px) saturate(200%)',
                    }}
                >
                    {/* Gradient top accent bar */}
                    <div className="gradient-accent-bar absolute top-0 left-0 right-0 opacity-50" />
                    {/* Portal target for toolbar content (AI search, count badge, active trip) */}
                    <div id="nav-toolbar" className="relative mb-2" />
                    <div className="relative flex items-center min-h-[72px]">
                        {/* Left tabs */}
                        {tabs.map(tab => renderTab(tab))}

                        {/* Center special button. Keep the same footprint while the floating button is shown. */}
                        <div className="flex-1 basis-0 h-16 flex items-center justify-center relative mx-4 min-w-0" ref={menuRef}>
                            <button
                                onClick={() => {
                                    if (isGuest) { setLoginCallbackUrl('/plans'); setLoginModalOpen(true); return; }
                                    setAnimKey(k => k + 1);
                                    setMenuOpen(!menuOpen);
                                }}
                                aria-hidden={menuOpen}
                                tabIndex={menuOpen ? -1 : 0}
                                className={`mobile-nav-center-button relative z-[70] w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-[opacity,box-shadow] duration-200 ease-out p-[3px] ${isCenterActive ? 'is-active' : ''} ${menuOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                            >
                                <div
                                    className={`mobile-nav-center-button-inner w-full h-full rounded-full flex items-center justify-center transition-colors duration-200 ${isCenterActive ? 'is-active' : 'bg-white dark:bg-neutral-800'}`}
                                >
                                    <svg key={animKey} className={`w-7 h-7 transition-colors duration-200 ${isCenterActive ? 'text-white' : 'text-purple-500 dark:text-purple-400'}`} fill={isCenterActive ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isCenterActive ? 0 : 1.8}>
                                        {/* Handle */}
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 2h4v3h-4z" />
                                        {/* Body */}
                                        <rect x="5" y="5" width="14" height="14" rx="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                        {/* Wheels */}
                                        <circle cx="9" cy="21.5" r="1.2" /><circle cx="15" cy="21.5" r="1.2" />
                                        {/* Stripes */}
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5v14m6-14v14" />
                                    </svg>
                                </div>
                                {compareCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-black shadow-sm border-2 border-white dark:border-neutral-800">
                                        {compareCount}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Right tabs */}
                        {tabsRight.map(tab => renderTab(tab))}
                    </div>
                </div>
            </nav>

            {/* Floating center button above dim when menu open */}
            {menuOpen && (
                <div
                    className="lg:hidden fixed inset-x-0 z-[10000] flex justify-center pointer-events-none"
                    style={{
                        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
                    }}
                >
                    <button
                        onClick={() => {
                            setAnimKey(k => k + 1);
                            setMenuOpen(false);
                        }}
                        className="mobile-nav-center-button mobile-nav-center-button-floating is-active w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-[opacity,box-shadow] duration-200 ease-out p-[3px] pointer-events-auto"
                    >
                        <div
                            className="mobile-nav-center-button-inner is-active w-full h-full rounded-full flex items-center justify-center"
                        >
                            <svg key={animKey} className="w-7 h-7 text-white transition-colors duration-200" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 2h4v3h-4z" />
                                <rect x="5" y="5" width="14" height="14" rx="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                <circle cx="9" cy="21.5" r="1.2" /><circle cx="15" cy="21.5" r="1.2" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5v14m6-14v14" />
                            </svg>
                        </div>
                    </button>
                </div>
            )}
            {/* Login Required Modal */}
            <LoginRequiredModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} callbackUrl={loginCallbackUrl} />
        </>
    );
}
