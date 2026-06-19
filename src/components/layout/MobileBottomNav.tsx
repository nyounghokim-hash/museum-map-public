'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useApp } from '@/components/AppContext';
import LoginRequiredModal from '@/components/ui/LoginRequiredModal';
import { clearRoutePending, navigateWithPending, startRoutePending } from '@/lib/route-pending';

const NAV_LABELS: Record<string, { map: string; saved: string; plans: string; artworks: string; story: string; collection: string; compare: string }> = {
    ko: { map: '홈', saved: '내 픽', plans: '내 여행', artworks: '작품', story: 'MM스토리', collection: '컬렉션', compare: '비교' },
    en: { map: 'Home', saved: 'My Pick', plans: 'My Trips', artworks: 'Artworks', story: 'MM Story', collection: 'Collection', compare: 'Compare' },
    ja: { map: 'ホーム', saved: '保存', plans: '旅行', artworks: '作品', story: 'MMストーリー', collection: 'コレクション', compare: '比較' },
    de: { map: 'Start', saved: 'Merkliste', plans: 'Reisen', artworks: 'Werke', story: 'MM Story', collection: 'Sammlung', compare: 'Vergleich' },
    fr: { map: 'Accueil', saved: 'Favoris', plans: 'Voyages', artworks: 'Œuvres', story: 'MM Story', collection: 'Collection', compare: 'Comparer' },
    es: { map: 'Inicio', saved: 'Guardados', plans: 'Viajes', artworks: 'Obras', story: 'MM Story', collection: 'Colección', compare: 'Comparar' },
    pt: { map: 'Início', saved: 'Salvos', plans: 'Viagens', artworks: 'Obras', story: 'MM Story', collection: 'Coleção', compare: 'Comparar' },
    'zh-CN': { map: '首页', saved: '收藏', plans: '我的旅行', artworks: '作品', story: 'MM故事', collection: '收藏集', compare: '比较' },
    'zh-TW': { map: '首頁', saved: '收藏', plans: '我的旅行', artworks: '作品', story: 'MM故事', collection: '收藏集', compare: '比較' },
    da: { map: 'Hjem', saved: 'Gemt', plans: 'Rejser', artworks: 'Værker', story: 'MM Story', collection: 'Samling', compare: 'Sammenlign' },
    fi: { map: 'Koti', saved: 'Tallennettu', plans: 'Matkat', artworks: 'Teokset', story: 'MM Story', collection: 'Kokoelma', compare: 'Vertaile' },
    sv: { map: 'Hem', saved: 'Sparade', plans: 'Resor', artworks: 'Konst', story: 'MM Story', collection: 'Samling', compare: 'Jämför' },
    et: { map: 'Avaleht', saved: 'Salvestatud', plans: 'Reisid', artworks: 'Teosed', story: 'MM Story', collection: 'Kogu', compare: 'Võrdle' },
};

function navigateNative(href: string, locale?: string | null) {
    if (typeof window === 'undefined') return;
    navigateWithPending(href, locale);
}

const PUBLIC_PREFETCH_ROUTES = ['/', '/blog', '/artworks', '/collections'];
const ACCOUNT_PREFETCH_ROUTES = ['/saved', '/plans', '/compare'];
const PUBLIC_CLIENT_NAV_ROUTES = new Set(['/blog', '/artworks', '/collections']);
const PUBLIC_CLIENT_ROUTE_MARKERS: Record<string, string> = {
    '/blog': 'blog',
    '/artworks': 'artworks',
    '/collections': 'collections',
};
const CLIENT_NAV_FALLBACK_MS = 720;
const NAV_CACHE_TTL_MS = 5 * 60 * 1000;
const BLOG_LIST_CACHE_KEY = 'mm-blog-list-cache-v2';
const ARTWORKS_CACHE_KEY = 'artworks_cache';
const COLLECTIONS_PUBLIC_CACHE_KEY = 'mm-public-collections-cache-v1';
const prefetchedRoutes = new Set<string>();
let navDataPrefetchStarted = false;

type RoutePrefetchIdleDeadline = { didTimeout: boolean; timeRemaining: () => number };
type RoutePrefetchIdleWindow = Window & typeof globalThis & {
    requestIdleCallback?: (callback: (deadline: RoutePrefetchIdleDeadline) => void, options?: { timeout?: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
};

function prefetchRouteDocument(href: string) {
    if (typeof document === 'undefined' || prefetchedRoutes.has(href)) return;
    prefetchedRoutes.add(href);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    link.as = 'document';
    document.head.appendChild(link);
}

function normalizeRoutePath(href: string) {
    try {
        return new URL(href, window.location.origin).pathname;
    } catch {
        return href.split('?')[0] || href;
    }
}

function canUseClientNavigation(currentPath: string, href: string) {
    const nextPath = normalizeRoutePath(href);
    return PUBLIC_CLIENT_NAV_ROUTES.has(currentPath) && PUBLIC_CLIENT_NAV_ROUTES.has(nextPath);
}

function hasRouteMarker(path: string) {
    const marker = PUBLIC_CLIENT_ROUTE_MARKERS[path];
    return marker ? !!document.querySelector(`[data-mm-page="${marker}"]`) : false;
}

function hasFreshCache(key: string) {
    try {
        const cached = JSON.parse(sessionStorage.getItem(key) || 'null') as { ts?: number; items?: unknown[]; posts?: unknown[]; data?: unknown[] } | null;
        if (!cached) return false;
        const hasItems = Array.isArray(cached.items) || Array.isArray(cached.posts) || Array.isArray(cached.data);
        if (!hasItems) return false;
        return typeof cached.ts !== 'number' || Date.now() - cached.ts < NAV_CACHE_TTL_MS;
    } catch {
        return false;
    }
}

function prefetchNavDataCaches() {
    if (typeof window === 'undefined' || navDataPrefetchStarted) return;
    navDataPrefetchStarted = true;

    if (!hasFreshCache(BLOG_LIST_CACHE_KEY)) {
        fetch('/api/blog?view=list', { cache: 'force-cache' })
            .then(res => res.ok ? res.json() : null)
            .then((json: { data?: Array<{ status?: string }> } | null) => {
                const posts = json?.data?.filter(post => post.status === 'PUBLISHED') || [];
                if (posts.length > 0) sessionStorage.setItem(BLOG_LIST_CACHE_KEY, JSON.stringify({ ts: Date.now(), posts }));
            })
            .catch(() => { });
    }

    if (!hasFreshCache(ARTWORKS_CACHE_KEY)) {
        const seed = `nav-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        fetch(`/api/artworks?limit=48&random=true&seed=${encodeURIComponent(seed)}`)
            .then(res => res.ok ? res.json() : null)
            .then((json: { data?: { artworks?: unknown[]; hasMore?: boolean; nextCursor?: string | null } } | null) => {
                const items = json?.data?.artworks || [];
                if (items.length === 0) return;
                const cursor = json?.data?.nextCursor ? `offset:${json.data.nextCursor}` : null;
                sessionStorage.setItem(ARTWORKS_CACHE_KEY, JSON.stringify({ ts: Date.now(), items, hasMore: json?.data?.hasMore ?? false, cursor, seed }));
            })
            .catch(() => { });
    }

    if (!hasFreshCache(COLLECTIONS_PUBLIC_CACHE_KEY)) {
        fetch('/api/collections?public=true')
            .then(res => res.ok ? res.json() : null)
            .then((json: { data?: unknown[] } | null) => {
                const data = json?.data || [];
                if (data.length > 0) sessionStorage.setItem(COLLECTIONS_PUBLIC_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
            })
            .catch(() => { });
    }
}

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
    tabPending: {
        color: '#2563eb',
        background: 'rgba(239,246,255,.94)',
        transform: 'translateY(2px) scale(0.96)',
        boxShadow: 'inset 0 0 0 1px rgba(37,99,235,.14)',
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
    centerFloatingButton: {
        position: 'fixed',
        left: '50%',
        bottom: 'calc(max(env(safe-area-inset-bottom, 0px), 8px) + 5px)',
        zIndex: 10000,
        transform: 'translateX(-50%) translateY(3px) scale(0.94)',
        pointerEvents: 'auto',
    } satisfies CSSProperties,
    overlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(2, 6, 23, .46)',
        WebkitBackdropFilter: 'blur(4px) saturate(120%)',
        backdropFilter: 'blur(4px) saturate(120%)',
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
    const inactiveStrokeWidth = 1.45;
    if (name === 'map') {
        return <svg className={className} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke={active ? 'none' : 'currentColor'} strokeWidth={inactiveStrokeWidth}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    }
    if (name === 'saved') {
        return <svg className={className} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke={active ? 'none' : 'currentColor'} strokeWidth={inactiveStrokeWidth}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>;
    }
    if (name === 'story') {
        return <svg className={className} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke={active ? 'none' : 'currentColor'} strokeWidth={inactiveStrokeWidth}><path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2M7 16h6M7 8h6v4H7V8z" /></svg>;
    }
    return <svg className={className} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke={active ? 'none' : 'currentColor'} strokeWidth={inactiveStrokeWidth}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
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

function CenterMuseumIcon({ active }: { active: boolean }) {
    if (active) {
        return (
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.4 3.8 6.8v1.7h16.4V6.8L12 2.4Z" />
                <path d="M5.2 10h2.5v7.2H5.2V10Zm5.6 0h2.4v7.2h-2.4V10Zm5.5 0h2.5v7.2h-2.5V10Z" />
                <path d="M4.2 18.5h15.6v2.2H4.2v-2.2Z" />
            </svg>
        );
    }
    return (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.45} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3 4 7.2h16L12 3Z" />
            <path d="M5.5 9.2v8" />
            <path d="M10 9.2v8" />
            <path d="M14 9.2v8" />
            <path d="M18.5 9.2v8" />
            <path d="M4.5 18.5h15" />
            <path d="M3.8 21h16.4" />
        </svg>
    );
}

function MobileTabRoutePreview({ path }: { path: string }) {
    const skeletonCards = path === '/artworks' ? 8 : 4;
    const isCollections = path === '/collections';
    return (
        <div
            data-mm-route-preview={path}
            className="fixed inset-x-0 top-0 bottom-[calc(82px+env(safe-area-inset-bottom,0px))] z-[80] overflow-hidden bg-slate-50 dark:bg-[#020817] md:hidden"
            aria-hidden="true"
        >
            <div className={`no-back-swipe mm-editorial-page2 ${isCollections ? 'mm-travel-page2' : 'mm-library-page2'} w-full max-w-[960px] mx-auto px-4 pt-4 pb-8`}>
                <div className="mm-gallery-hero p-5 mb-5">
                    <div className="mm-skel-line w-24 mb-4 opacity-40" />
                    <div className="mm-skel-line h-8 w-44 mb-3 opacity-50" />
                    <div className="mm-skel-line w-64 opacity-40" />
                    {path === '/blog' && (
                        <div className="flex mt-5 gap-2 overflow-hidden">
                            {Array.from({ length: 5 }).map((_, index) => (
                                <div key={index} className="mm-skel-pill h-8 w-20 shrink-0" />
                            ))}
                        </div>
                    )}
                </div>
                {!isCollections && (
                    <div className="mb-5">
                        <div className="mm-skel-pill h-[58px] w-full" />
                    </div>
                )}
                {isCollections ? (
                    <>
                        <div className="flex gap-2 mb-6">
                            <div className="mm-skel-pill h-10 flex-1" />
                            <div className="mm-skel-pill h-10 flex-1" />
                        </div>
                        <div className="flex flex-col gap-3">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <div key={index} className="mm-actual-skeleton p-5">
                                    <div className="mm-skel-line h-6 w-3/5 mb-3" />
                                    <div className="flex items-center gap-3 mt-2">
                                        <div className="flex -space-x-2">
                                            {Array.from({ length: 4 }).map((__, thumbIndex) => (
                                                <div key={thumbIndex} className="mm-skel-circle w-7 h-7 border-2 border-white dark:border-neutral-900" />
                                            ))}
                                        </div>
                                        <div className="mm-skel-line w-20" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="mm-section-heading">
                            <div className="mm-skel-line h-5 w-28" />
                            {path === '/artworks' && (
                                <div className="flex items-center gap-2">
                                    <div className="mm-skel-line w-12" />
                                    <div className="mm-skel-pill w-24" />
                                </div>
                            )}
                        </div>
                        <div className={path === '/artworks' ? 'mm-artwork-grid2' : 'flex gap-4 overflow-hidden pb-2'}>
                            {Array.from({ length: skeletonCards }).map((_, index) => (
                                <div key={index} className={`${path === '/blog' ? 'w-[220px] shrink-0 ' : ''}mm-actual-skeleton overflow-hidden`}>
                                    <div className={`${path === '/artworks' ? 'aspect-[4/3]' : 'h-32'} mm-skel-block`} style={{ borderRadius: 0 }} />
                                    <div className="space-y-2 p-3.5">
                                        <div className="mm-skel-line w-16" />
                                        <div className="mm-skel-line h-5 w-32" />
                                        <div className="mm-skel-line w-24" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function MobileBottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { locale, darkMode } = useApp();
    const { data: session } = useSession();
    const isGuest = !session || session.user?.name?.startsWith('guest_');
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuClosing, setMenuClosing] = useState(false);
    const [pendingHref, setPendingHref] = useState<string | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [previewPath, setPreviewPath] = useState<string | null>(null);
    const [loginModalOpen, setLoginModalOpen] = useState(false);
    const [loginCallbackUrl, setLoginCallbackUrl] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);
    const centerTouchHandledRef = useRef(false);
    const clientNavFallbackRef = useRef<number | null>(null);
    const recentNavigationRef = useRef<{ href: string; ts: number } | null>(null);

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setDetailOpen(document.body.hasAttribute('data-detail-open'));
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-detail-open'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const navWindow = window as RoutePrefetchIdleWindow;
        const routes = isGuest ? PUBLIC_PREFETCH_ROUTES : [...PUBLIC_PREFETCH_ROUTES, ...ACCOUNT_PREFETCH_ROUTES];
        const run = () => {
            routes.forEach(prefetchRouteDocument);
            PUBLIC_CLIENT_NAV_ROUTES.forEach(route => router.prefetch(route));
            prefetchNavDataCaches();
        };
        if (navWindow.requestIdleCallback) {
            const idleId = navWindow.requestIdleCallback(run, { timeout: 900 });
            return () => navWindow.cancelIdleCallback?.(idleId);
        }
        const timer = navWindow.setTimeout(run, 250);
        return () => navWindow.clearTimeout(timer);
    }, [isGuest, router]);

    useEffect(() => {
        setMenuOpen(false);
        setMenuClosing(false);
        setPendingHref(null);
        setPreviewPath(null);
        if (clientNavFallbackRef.current) {
            window.clearTimeout(clientNavFallbackRef.current);
            clientNavFallbackRef.current = null;
        }
    }, [pathname]);

    useEffect(() => () => {
        if (clientNavFallbackRef.current) window.clearTimeout(clientNavFallbackRef.current);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !pendingHref) return;
        const expectedPath = pendingHref.split('?')[0] || pendingHref;
        const timer = window.setTimeout(() => {
            if (window.location.pathname === pathname && pathname !== expectedPath) {
                setPendingHref(null);
                clearRoutePending();
            }
        }, 1400);
        return () => window.clearTimeout(timer);
    }, [pathname, pendingHref]);

    const showNavPages = ['/', '/saved', '/blog', '/artworks', '/plans', '/collections', '/compare'];
    if (!showNavPages.includes(pathname) || detailOpen) return null;

    const labels = NAV_LABELS[locale] || NAV_LABELS.en;
    const currentPath = pathname;
    const isCenterActive = currentPath === '/plans' || currentPath.startsWith('/collections') || currentPath === '/compare';
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

    const closeMenu = () => {
        if (!menuOpen || menuClosing) return;
        setMenuClosing(true);
        window.setTimeout(() => {
            setMenuOpen(false);
            setMenuClosing(false);
        }, 170);
    };

    const toggleMenu = () => {
        if (menuOpen) {
            closeMenu();
            return;
        }
        setMenuClosing(false);
        setMenuOpen(true);
    };

    const goProtected = (href: string) => {
        closeMenu();
        if (isGuest) {
            setLoginCallbackUrl(href);
            setLoginModalOpen(true);
            return;
        }
        setPendingHref(href);
        navigateNative(href, locale);
    };

    const goRoute = (href: string) => {
        if (href === pathname) return;
        const now = Date.now();
        const recent = recentNavigationRef.current;
        if (recent?.href === href && now - recent.ts < 650) return;
        recentNavigationRef.current = { href, ts: now };
        setPendingHref(href);
        if (canUseClientNavigation(pathname, href)) {
            const nextPath = normalizeRoutePath(href);
            setPreviewPath(nextPath);
            startRoutePending(locale);
            router.prefetch(nextPath);
            router.push(href);
            if (clientNavFallbackRef.current) window.clearTimeout(clientNavFallbackRef.current);
            clientNavFallbackRef.current = window.setTimeout(() => {
                if (!hasRouteMarker(nextPath)) {
                    navigateNative(href, locale);
                }
            }, CLIENT_NAV_FALLBACK_MS);
            return;
        }
        navigateNative(href, locale);
    };

    const goPublic = (href: string) => {
        closeMenu();
        goRoute(href);
    };

    const primeMenuNavigation = (href: string, protectedRoute = false) => {
        if (protectedRoute && isGuest) return;
        setPendingHref(href);
        startRoutePending(locale);
    };

    const tabsLeft = [
        { href: '/', key: 'map' as const, label: labels.map, active: currentPath === '/' },
        { href: '/saved', key: 'saved' as const, label: labels.saved, active: currentPath.startsWith('/saved'), auth: true },
    ];
    const tabsRight = [
        { href: '/blog', key: 'story' as const, label: labels.story, active: currentPath.startsWith('/blog') },
        { href: '/artworks', key: 'artworks' as const, label: labels.artworks, active: currentPath.startsWith('/artworks') },
    ];

    const handleTabClick = (tab: typeof tabsLeft[number] | typeof tabsRight[number]) => (event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        if ('auth' in tab && tab.auth && isGuest) {
            setLoginCallbackUrl(tab.href);
            setLoginModalOpen(true);
            return;
        }
        if (tab.href !== pathname) {
            goRoute(tab.href);
        }
    };

    const renderTab = (tab: typeof tabsLeft[number] | typeof tabsRight[number]) => (
        <a
            key={tab.href}
            href={tab.href}
            onPointerDown={(event) => {
                if (tab.href === pathname) return;
                if ('auth' in tab && tab.auth && isGuest) {
                    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
                        event.preventDefault();
                        setLoginCallbackUrl(tab.href);
                        setLoginModalOpen(true);
                    }
                    return;
                }
                setPendingHref(tab.href);
                if (event.pointerType === 'touch' || event.pointerType === 'pen') {
                    event.preventDefault();
                    goRoute(tab.href);
                    return;
                }
                startRoutePending(locale);
            }}
            onClick={handleTabClick(tab)}
            className={`mm-nav-original-tab ${tab.active && !menuOpen ? 'is-active' : ''} ${pendingHref === tab.href ? 'is-pending' : ''}`}
            style={{ ...styles.tab, ...(!tab.active || menuOpen ? themedInactiveTabStyle : null), ...(tab.active && !menuOpen ? styles.tabActive : null), ...(pendingHref === tab.href && !tab.active ? styles.tabPending : null) }}
        >
            <TabIcon name={tab.key} active={tab.active && !menuOpen} />
            <span style={{ ...styles.label, fontWeight: tab.active && !menuOpen ? 850 : 600 }}>{tab.label}</span>
        </a>
    );

    return (
        <>
            {(menuOpen || menuClosing) && (
                <>
                    <div className={`mobile-nav-menu-overlay ${menuClosing ? 'is-closing' : ''}`} style={styles.overlay} onClick={closeMenu} />
                    <div className={`mobile-nav-center-menu ${menuClosing ? 'is-closing' : ''}`} style={{ ...styles.menu, ...themedMenuStyle }}>
                        <button type="button" style={{ ...styles.menuButton, ...themedMenuButtonStyle }} onPointerDown={(event) => {
                            if (event.pointerType === 'touch' || event.pointerType === 'pen') {
                                event.preventDefault();
                                goProtected('/plans');
                                return;
                            }
                            primeMenuNavigation('/plans', true);
                        }} onClick={() => goProtected('/plans')}>
                            <MenuIcon name="plans" />
                            <span style={{ ...styles.label, fontWeight: 650 }}>{labels.plans}</span>
                        </button>
                        <div style={{ ...styles.divider, ...themedDividerStyle }} />
                        <button type="button" style={{ ...styles.menuButton, ...themedMenuButtonStyle }} onPointerDown={(event) => {
                            if (event.pointerType === 'touch' || event.pointerType === 'pen') {
                                event.preventDefault();
                                goPublic('/collections');
                                return;
                            }
                            primeMenuNavigation('/collections');
                        }} onClick={() => goPublic('/collections')}>
                            <MenuIcon name="collection" />
                            <span style={{ ...styles.label, fontWeight: 650 }}>{labels.collection}</span>
                        </button>
                        <div style={{ ...styles.divider, ...themedDividerStyle }} />
                        <button type="button" style={{ ...styles.menuButton, ...themedMenuButtonStyle, position: 'relative' }} onPointerDown={(event) => {
                            if (event.pointerType === 'touch' || event.pointerType === 'pen') {
                                event.preventDefault();
                                goProtected('/compare');
                                return;
                            }
                            primeMenuNavigation('/compare', true);
                        }} onClick={() => goProtected('/compare')}>
                            <MenuIcon name="compare" />
                            <span style={{ ...styles.label, fontWeight: 650 }}>{labels.compare}</span>
                        </button>
                    </div>
                </>
            )}

            {previewPath && <MobileTabRoutePreview path={previewPath} />}

            <nav className="mobile-bottom-nav md:hidden" style={styles.root}>
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
                                onPointerDown={(event) => {
                                    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
                                    event.preventDefault();
                                    centerTouchHandledRef.current = true;
                                    toggleMenu();
                                }}
                                onClick={() => {
                                    if (centerTouchHandledRef.current) {
                                        centerTouchHandledRef.current = false;
                                        return;
                                    }
                                    toggleMenu();
                                }}
                            >
                                <CenterMuseumIcon active={isCenterActive || menuOpen} />
                            </button>
                        </div>

                        {tabsRight.map(renderTab)}
                    </div>
                </div>
            </nav>

            {(menuOpen || menuClosing) && (
                <button
                    type="button"
                    aria-label={labels.plans}
                    className={`mobile-nav-center-button mobile-nav-center-button-floating md:hidden ${menuClosing ? 'is-closing' : ''}`}
                    style={{ ...styles.centerButton, ...styles.centerPressed, ...styles.centerFloatingButton }}
                    onClick={closeMenu}
                >
                    <CenterMuseumIcon active />
                </button>
            )}

            <LoginRequiredModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} callbackUrl={loginCallbackUrl} />
        </>
    );
}
