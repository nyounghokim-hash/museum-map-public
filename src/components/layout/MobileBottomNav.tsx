'use client';

import { startTransition, useEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent, PointerEvent } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useApp } from '@/components/AppContext';
import LoginRequiredModal from '@/components/ui/LoginRequiredModal';
import { clearRoutePending } from '@/lib/route-pending';

const NAV_LABELS: Record<string, { map: string; exhibitions: string; saved: string; plans: string; artworks: string; story: string; collection: string; compare: string; menu: string }> = {
    ko: { map: '홈', exhibitions: '전시', saved: '내 픽', plans: '내 여행', artworks: '작품', story: 'MM스토리', collection: '컬렉션', compare: '비교', menu: '내 메뉴' },
    en: { map: 'Home', exhibitions: 'Exhibitions', saved: 'My Pick', plans: 'My Trips', artworks: 'Artworks', story: 'MM Story', collection: 'Collection', compare: 'Compare', menu: 'My menu' },
    ja: { map: 'ホーム', exhibitions: '展覧会', saved: '保存', plans: '旅行', artworks: '作品', story: 'MMストーリー', collection: 'コレクション', compare: '比較', menu: 'マイメニュー' },
    de: { map: 'Start', exhibitions: 'Ausstellungen', saved: 'Merkliste', plans: 'Reisen', artworks: 'Werke', story: 'MM Story', collection: 'Sammlung', compare: 'Vergleich', menu: 'Mein Menü' },
    fr: { map: 'Accueil', exhibitions: 'Expositions', saved: 'Favoris', plans: 'Voyages', artworks: 'Œuvres', story: 'MM Story', collection: 'Collection', compare: 'Comparer', menu: 'Mon menu' },
    es: { map: 'Inicio', exhibitions: 'Exposiciones', saved: 'Guardados', plans: 'Viajes', artworks: 'Obras', story: 'MM Story', collection: 'Colección', compare: 'Comparar', menu: 'Mi menú' },
    pt: { map: 'Início', exhibitions: 'Exposições', saved: 'Salvos', plans: 'Viagens', artworks: 'Obras', story: 'MM Story', collection: 'Coleção', compare: 'Comparar', menu: 'Meu menu' },
    'zh-CN': { map: '首页', exhibitions: '展览', saved: '收藏', plans: '我的旅行', artworks: '作品', story: 'MM故事', collection: '收藏集', compare: '比较', menu: '我的菜单' },
    'zh-TW': { map: '首頁', exhibitions: '展覽', saved: '收藏', plans: '我的旅行', artworks: '作品', story: 'MM故事', collection: '收藏集', compare: '比較', menu: '我的選單' },
    da: { map: 'Hjem', exhibitions: 'Udstillinger', saved: 'Gemt', plans: 'Rejser', artworks: 'Værker', story: 'MM Story', collection: 'Samling', compare: 'Sammenlign', menu: 'Min menu' },
    fi: { map: 'Koti', exhibitions: 'Näyttelyt', saved: 'Tallennettu', plans: 'Matkat', artworks: 'Teokset', story: 'MM Story', collection: 'Kokoelma', compare: 'Vertaile', menu: 'Oma valikko' },
    sv: { map: 'Hem', exhibitions: 'Utställningar', saved: 'Sparade', plans: 'Resor', artworks: 'Konst', story: 'MM Story', collection: 'Samling', compare: 'Jämför', menu: 'Min meny' },
    et: { map: 'Avaleht', exhibitions: 'Näitused', saved: 'Salvestatud', plans: 'Reisid', artworks: 'Teosed', story: 'MM Story', collection: 'Kogu', compare: 'Võrdle', menu: 'Minu menüü' },
};

const PUBLIC_PREFETCH_ROUTES = ['/', '/exhibitions', '/blog', '/artworks', '/collections'];
const ACCOUNT_PREFETCH_ROUTES = ['/saved', '/plans', '/compare'];
const MAP_OVERLAY_DISMISS_EVENT = 'mm:map-overlays-dismiss';
const NAV_DOCUMENT_PREFETCH_KEY = 'mm-nav-document-prefetch-ts';
const NAV_DATA_WARM_KEY = 'mm-nav-data-warm-ts';
const NAV_DOCUMENT_PREFETCH_TTL_MS = 5 * 60 * 1000;
const prefetchedRoutes = new Set<string>();

function hasRecentSessionStamp(key: string, ttl: number) {
    if (typeof window === 'undefined') return false;
    try {
        const ts = Number(sessionStorage.getItem(key) || '0');
        return Number.isFinite(ts) && ts > 0 && Date.now() - ts < ttl;
    } catch {
        return false;
    }
}

function stampSession(key: string) {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(key, String(Date.now()));
    } catch { }
}

function scheduleIdleTask(callback: () => void, timeout = 2500) {
    if (typeof window === 'undefined') {
        callback();
        return undefined;
    }
    const win = window as Window & typeof globalThis & {
        requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
        cancelIdleCallback?: (handle: number) => void;
    };
    if (typeof win.requestIdleCallback === 'function' && typeof win.cancelIdleCallback === 'function') {
        const idleId = win.requestIdleCallback(callback, { timeout });
        return () => win.cancelIdleCallback?.(idleId);
    }
    const timer = window.setTimeout(callback, timeout);
    return () => window.clearTimeout(timer);
}

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

function routeTabKey(path: string) {
    if (path === '/') return 'map';
    if (path.startsWith('/exhibitions')) return 'exhibitions';
    if (path.startsWith('/saved')) return 'saved';
    if (path.startsWith('/blog')) return 'story';
    if (path.startsWith('/artworks')) return 'artworks';
    if (path.startsWith('/plans')) return 'plans';
    if (path.startsWith('/collections')) return 'collection';
    if (path.startsWith('/compare')) return 'compare';
    return null;
}

function dismissMapOverlays() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event(MAP_OVERLAY_DISMISS_EVENT));
}

function prepareClientRouteChange() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event('mm:client-route-change-start'));
}

// After a touch nav from the bottom nav, the menu/tab closes instantly while
// client navigation keeps the old page mounted for a beat. The follow-up
// synthetic click then lands on whatever is now under the finger (e.g. a Story
// or Artwork card), navigating somewhere unintended. Swallow that one ghost
// click document-wide.
function suppressNextGhostClick() {
    if (typeof document === 'undefined') return;
    const handler = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
    };
    document.addEventListener('click', handler, { capture: true, once: true });
    window.setTimeout(() => document.removeEventListener('click', handler, true), 450);
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
        touchAction: 'manipulation',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
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
        fontWeight: 500,
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
        touchAction: 'manipulation',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
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
        width: 'min(348px, calc(100vw - 38px))',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 12,
        padding: 14,
        overflow: 'visible',
        borderRadius: 30,
        background: 'radial-gradient(circle at 50% 0%, rgba(219,234,254,.78) 0%, rgba(255,255,255,0) 46%), linear-gradient(180deg, rgba(255,255,255,.99) 0%, rgba(248,251,255,.97) 100%)',
        border: '1px solid rgba(226,232,240,.92)',
        boxShadow: '0 34px 78px rgba(15,23,42,.24), 0 0 0 1px rgba(255,255,255,.66), inset 0 1px 0 rgba(255,255,255,.94)',
        WebkitBackdropFilter: 'blur(18px) saturate(170%)',
        backdropFilter: 'blur(18px) saturate(170%)',
    } satisfies CSSProperties,
    menuButton: {
        flex: '1 1 0',
        minWidth: 0,
        minHeight: 78,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        padding: '12px 10px',
        border: '1px solid rgba(147,197,253,.62)',
        borderRadius: 22,
        background: 'linear-gradient(180deg, rgba(255,255,255,.96) 0%, rgba(239,246,255,.88) 100%)',
        boxShadow: '0 14px 30px rgba(37,99,235,.10), inset 0 1px 0 rgba(255,255,255,.88)',
        color: '#0f172a',
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'manipulation',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        transition: 'transform 150ms ease, box-shadow 150ms ease, background 150ms ease',
    } satisfies CSSProperties,
    menuIconShell: {
        width: 40,
        height: 40,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        color: '#2563eb',
        background: 'linear-gradient(180deg, rgba(239,246,255,.98) 0%, rgba(219,234,254,.78) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.92), 0 10px 20px rgba(37,99,235,.15)',
    } satisfies CSSProperties,
    menuLabel: {
        minWidth: 0,
        maxWidth: '100%',
        overflow: 'hidden',
        color: 'currentColor',
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: 0,
        textAlign: 'center',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
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

type NavKey = 'map' | 'exhibitions' | 'saved' | 'story' | 'artworks' | 'plans' | 'collection' | 'compare';

function TabIcon({ name, active, pending }: { name: 'map' | 'exhibitions' | 'story' | 'artworks'; active: boolean; pending?: boolean }) {
    const className = `w-6 h-6 ${active ? 'text-white' : 'text-slate-500 dark:text-slate-300'}`;
    const iconStyle = active && pending ? { color: 'rgba(255,255,255,.5)' } : undefined;
    const inactiveStrokeWidth = 1.45;
    if (name === 'map') {
        return <svg className={className} style={iconStyle} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke={active ? 'none' : 'currentColor'} strokeWidth={inactiveStrokeWidth}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    }
    if (name === 'exhibitions') {
        if (active) {
            return (
                <svg className={className} style={iconStyle} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7.25 3.25a1 1 0 0 1 1 1v1h7.5v-1a1 1 0 1 1 2 0v1h.25a3 3 0 0 1 3 3v.9H3v-.9a3 3 0 0 1 3-3h.25v-1a1 1 0 0 1 1-1Z" />
                    <path d="M3 10.65h18v7.1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-7.1Zm5 3.2a1 1 0 1 0 0 2h4.75a1 1 0 1 0 0-2H8Zm0 3.2a1 1 0 1 0 0 2h7.75a1 1 0 1 0 0-2H8Z" />
                </svg>
            );
        }
        return <svg className={className} style={iconStyle} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={inactiveStrokeWidth}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75v2.5M16.5 3.75v2.5M4.75 8.5h14.5M6.25 5.5h11.5a2 2 0 012 2v10.25a2 2 0 01-2 2H6.25a2 2 0 01-2-2V7.5a2 2 0 012-2Zm3.25 6.25h5M9.5 15h3" /></svg>;
    }
    if (name === 'story') {
        if (active) {
            const storyAccent = pending ? 'rgba(37,99,235,.42)' : 'rgba(37,99,235,.78)';
            return (
                <svg className={className} style={iconStyle} viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        fill="currentColor"
                        d="M5.85 3.25h8.85c.52 0 1.02.2 1.39.58l2.08 2.08c.37.37.58.87.58 1.39v10.45a3 3 0 0 1-3 3h-9.9a3 3 0 0 1-3-3V6.25a3 3 0 0 1 3-3Z"
                    />
                    <path fill={storyAccent} d="M14.5 3.55v2.7a1.75 1.75 0 0 0 1.75 1.75h2.65a.4.4 0 0 0-.12-.2l-3.98-4a.4.4 0 0 0-.3-.25Z" />
                    <path fill={storyAccent} d="M7 7.05a.9.9 0 0 1 .9-.9h3.8a.9.9 0 0 1 .9.9v3a.9.9 0 0 1-.9.9H7.9a.9.9 0 0 1-.9-.9v-3Z" />
                    <path fill={storyAccent} d="M7.25 13.1a.82.82 0 0 1 .82-.82h8.2a.82.82 0 1 1 0 1.64h-8.2a.82.82 0 0 1-.82-.82ZM7.25 16.35a.82.82 0 0 1 .82-.82h5.9a.82.82 0 0 1 0 1.64h-5.9a.82.82 0 0 1-.82-.82Z" />
                </svg>
            );
        }
        return <svg className={className} style={iconStyle} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke={active ? 'none' : 'currentColor'} strokeWidth={inactiveStrokeWidth}><path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2M7 16h6M7 8h6v4H7V8z" /></svg>;
    }
    return <svg className={className} style={iconStyle} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke={active ? 'none' : 'currentColor'} strokeWidth={inactiveStrokeWidth}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
}

function MenuIcon({ name }: { name: 'saved' | 'plans' | 'collection' | 'compare' }) {
    if (name === 'saved') {
        return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 4.5h10.5a1.5 1.5 0 011.5 1.5v14.25L12 16.75l-6.75 3.5V6a1.5 1.5 0 011.5-1.5Z" /></svg>;
    }
    if (name === 'plans') {
        return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>;
    }
    if (name === 'collection') {
        return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
    }
    return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5 5 0 006 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5 5 0 006 0M18 7l3 9m-3-9l-6-2m0-2v18m0 0H9m3 0h3" /></svg>;
}

function CenterMuseumIcon({ active, pending }: { active: boolean; pending?: boolean }) {
    const iconStyle = active && pending ? { color: 'rgba(255,255,255,.5)' } : undefined;
    if (active) {
        return (
            <svg className="w-7 h-7 text-white" style={iconStyle} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
    const [loginModalOpen, setLoginModalOpen] = useState(false);
    const [loginCallbackUrl, setLoginCallbackUrl] = useState('');
    const [portalReady, setPortalReady] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const centerTouchHandledRef = useRef(false);
    const tabTouchHandledRef = useRef<string | null>(null);
    const menuTouchHandledRef = useRef<string | null>(null);
    const recentNavigationRef = useRef<{ href: string; ts: number } | null>(null);

    useEffect(() => {
        setPortalReady(true);
    }, []);

    useEffect(() => {
        setDetailOpen(document.body.hasAttribute('data-detail-open'));
        const observer = new MutationObserver(() => {
            setDetailOpen(document.body.hasAttribute('data-detail-open'));
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-detail-open'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const routes = isGuest ? PUBLIC_PREFETCH_ROUTES : [...PUBLIC_PREFETCH_ROUTES, ...ACCOUNT_PREFETCH_ROUTES];
        const warmDocuments = () => {
            if (!hasRecentSessionStamp(NAV_DOCUMENT_PREFETCH_KEY, NAV_DOCUMENT_PREFETCH_TTL_MS)) {
                routes.forEach(prefetchRouteDocument);
                stampSession(NAV_DOCUMENT_PREFETCH_KEY);
            }
            // Warm the public, cacheable Story list (/api/blog?view=list is
            // public + s-maxage) so the Story tab shows data instantly on first
            // visit. fetch() HTTP caching works on iOS where <link rel=prefetch>
            // is ignored. Skipped on the Story tab itself (it fetches anyway).
            if (pathname !== '/blog' && !hasRecentSessionStamp(NAV_DATA_WARM_KEY, NAV_DOCUMENT_PREFETCH_TTL_MS)) {
                try { fetch('/api/blog?view=list').catch(() => { }); } catch { }
                stampSession(NAV_DATA_WARM_KEY);
            }
        };
        const cancelDocumentWarmup = scheduleIdleTask(warmDocuments, pathname === '/' ? 5000 : 2200);
        return () => {
            cancelDocumentWarmup?.();
        };
    }, [isGuest, pathname]);

    useEffect(() => {
        setMenuOpen(false);
        setMenuClosing(false);
        setPendingHref(null);
    }, [pathname]);

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

    const showNavPages = ['/', '/exhibitions', '/saved', '/blog', '/artworks', '/plans', '/collections', '/compare'];
    if (!showNavPages.includes(pathname) || detailOpen) return null;

    const labels = NAV_LABELS[locale] || NAV_LABELS.en;
    const currentPath = pathname;
    const visualPath = pendingHref ? normalizeRoutePath(pendingHref) : currentPath;
    const visualTabKey = routeTabKey(visualPath);
    const pendingTargetPath = pendingHref ? normalizeRoutePath(pendingHref) : null;
    const pendingTabKey = pendingTargetPath ? routeTabKey(pendingTargetPath) : null;
    const isVisuallyActive = (key: NavKey) => visualTabKey === key;
    const isLoadingActive = (key: NavKey) => pendingTabKey === key && pendingTargetPath !== currentPath;
    const isCenterActive = isVisuallyActive('saved') || isVisuallyActive('plans') || isVisuallyActive('collection') || isVisuallyActive('compare');
    const isCenterLoadingActive = isLoadingActive('saved') || isLoadingActive('plans') || isLoadingActive('collection') || isLoadingActive('compare');
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
        background: 'radial-gradient(circle at 50% 0%, rgba(37,99,235,.24) 0%, rgba(37,99,235,0) 48%), linear-gradient(180deg, rgba(7,20,38,.98) 0%, rgba(5,15,30,.96) 100%)',
        border: '1px solid rgba(96,165,250,.22)',
        boxShadow: '0 30px 74px rgba(0,0,0,.44), inset 0 1px 0 rgba(255,255,255,.08)',
    } satisfies CSSProperties : null;
    const themedMenuButtonStyle = darkMode ? {
        color: '#e2e8f0',
        background: 'linear-gradient(180deg, rgba(15,42,85,.76) 0%, rgba(8,22,44,.84) 100%)',
        border: '1px solid rgba(96,165,250,.30)',
        boxShadow: '0 14px 30px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.08)',
    } satisfies CSSProperties : null;
    const themedMenuIconShellStyle = darkMode ? {
        color: '#dbeafe',
        background: 'linear-gradient(180deg, rgba(37,99,235,.48) 0%, rgba(15,23,42,.72) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12), 0 10px 20px rgba(0,0,0,.30)',
    } satisfies CSSProperties : null;

    const closeMenu = () => {
        if (!menuOpen || menuClosing) return;
        setMenuClosing(true);
        window.setTimeout(() => {
            setMenuOpen(false);
            setMenuClosing(false);
        }, 170);
    };

    const toggleMenu = () => {
        dismissMapOverlays();
        if (menuOpen) {
            closeMenu();
            return;
        }
        setMenuClosing(false);
        setMenuOpen(true);
    };

    const prefetchRoute = (href: string) => {
        try { router.prefetch(href); } catch { }
        prefetchRouteDocument(href);
    };

    const showPendingImmediately = (href: string, closeCenterMenu = true) => {
        try {
            flushSync(() => {
                if (closeCenterMenu) {
                    setMenuOpen(false);
                    setMenuClosing(false);
                }
                setPendingHref(href);
            });
        } catch {
            if (closeCenterMenu) {
                setMenuOpen(false);
                setMenuClosing(false);
            }
            setPendingHref(href);
        }
    };

    const openRoute = (href: string) => {
        // All bottom-nav transitions use client navigation now (the theme-color
        // meta removeChild crash is fixed). prepareClientRouteChange() fires
        // mm:client-route-change-start so the map (when leaving it) tears down
        // its overlays/renderer before React unmounts it. Entering the map just
        // mounts MapLibre fresh on the client.
        dismissMapOverlays();
        prepareClientRouteChange();
        clearRoutePending();
        startTransition(() => {
            router.push(href);
        });
    };

    const goProtected = (href: string, immediate = false) => {
        dismissMapOverlays();
        if (isGuest) {
            closeMenu();
            setLoginCallbackUrl(href);
            setLoginModalOpen(true);
            return;
        }
        if (immediate) {
            showPendingImmediately(href);
            openRoute(href);
            return;
        }
        if (!immediate) {
            setMenuOpen(false);
            setMenuClosing(false);
        }
        setPendingHref(href);
        prefetchRoute(href);
        openRoute(href);
    };

    const goRoute = (href: string, immediate = false) => {
        dismissMapOverlays();
        if (href === pathname) return;
        const now = Date.now();
        const recent = recentNavigationRef.current;
        if (recent?.href === href && now - recent.ts < 650) return;
        recentNavigationRef.current = { href, ts: now };
        if (immediate) {
            showPendingImmediately(href);
            openRoute(href);
            return;
        }
        if (!immediate) {
            setMenuOpen(false);
            setMenuClosing(false);
        }
        setPendingHref(href);
        prefetchRoute(href);
        openRoute(href);
    };

    const goPublic = (href: string, immediate = false) => {
        goRoute(href, immediate);
    };

    const primeMenuNavigation = (href: string, protectedRoute = false) => {
        if (protectedRoute && isGuest) return;
        dismissMapOverlays();
        setPendingHref(href);
        prefetchRoute(href);
    };

    const tabsLeft = [
        { href: '/', key: 'map' as const, label: labels.map, active: isVisuallyActive('map') },
        { href: '/exhibitions', key: 'exhibitions' as const, label: labels.exhibitions, active: isVisuallyActive('exhibitions') },
    ];
    const tabsRight = [
        { href: '/blog', key: 'story' as const, label: labels.story, active: isVisuallyActive('story') },
        { href: '/artworks', key: 'artworks' as const, label: labels.artworks, active: isVisuallyActive('artworks') },
    ];

    const handleTabPointerDown = (tab: typeof tabsLeft[number] | typeof tabsRight[number]) => (event: PointerEvent<HTMLAnchorElement>) => {
        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') {
            dismissMapOverlays();
            if (tab.href === pathname) return;
            setPendingHref(tab.href);
            prefetchRoute(tab.href);
            return;
        }

        if (tab.href === pathname) {
            event.preventDefault();
            dismissMapOverlays();
            return;
        }

        event.preventDefault();
        tabTouchHandledRef.current = tab.href;
        goRoute(tab.href, true);
        suppressNextGhostClick();
    };

    const handleTabClick = (tab: typeof tabsLeft[number] | typeof tabsRight[number]) => (event: MouseEvent<HTMLAnchorElement>) => {
        if (tabTouchHandledRef.current === tab.href) {
            event.preventDefault();
            tabTouchHandledRef.current = null;
            return;
        }
        dismissMapOverlays();
        if (tab.href === pathname) {
            event.preventDefault();
            return;
        }
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const now = Date.now();
        recentNavigationRef.current = { href: tab.href, ts: now };
        setPendingHref(tab.href);
        prefetchRoute(tab.href);
        openRoute(tab.href);
    };

    const renderTab = (tab: typeof tabsLeft[number] | typeof tabsRight[number]) => {
        const active = tab.active && !menuOpen;
        const loadingActive = active && isLoadingActive(tab.key);
        return (
        <a
            key={tab.href}
            href={tab.href}
            data-mm-route-pending="off"
            onPointerDown={handleTabPointerDown(tab)}
            onClick={handleTabClick(tab)}
            className={`mm-nav-original-tab ${active ? 'is-active' : ''} ${pendingHref === tab.href ? 'is-pending' : ''}`}
            style={{ ...styles.tab, ...(!tab.active || menuOpen ? themedInactiveTabStyle : null), ...(active ? styles.tabActive : null), ...(pendingHref === tab.href && !tab.active ? styles.tabPending : null) }}
        >
            <TabIcon name={tab.key} active={active} pending={loadingActive} />
            <span style={{ ...styles.label, fontWeight: active ? 600 : 500, color: loadingActive ? 'rgba(255,255,255,.5)' : 'currentColor' }}>{tab.label}</span>
        </a>
        );
    };

    const handleMenuPointerDown = (href: string, protectedRoute = false) => (event: PointerEvent<HTMLButtonElement>) => {
        if (event.pointerType === 'touch' || event.pointerType === 'pen') {
            event.preventDefault();
            menuTouchHandledRef.current = href;
            if (protectedRoute) goProtected(href, true);
            else goPublic(href, true);
            suppressNextGhostClick();
            return;
        }
        primeMenuNavigation(href, protectedRoute);
    };

    const handleMenuClick = (href: string, protectedRoute = false) => (event: MouseEvent<HTMLButtonElement>) => {
        if (menuTouchHandledRef.current === href) {
            event.preventDefault();
            menuTouchHandledRef.current = null;
            return;
        }
        if (protectedRoute) goProtected(href);
        else goPublic(href);
    };

    const navContent = (
        <>
            {(menuOpen || menuClosing) && (
                <>
                    <div className={`mobile-nav-menu-overlay ${menuClosing ? 'is-closing' : ''}`} style={styles.overlay} onClick={closeMenu} />
                    <div className={`mobile-nav-center-menu ${menuClosing ? 'is-closing' : ''}`} style={{ ...styles.menu, ...themedMenuStyle }}>
                        <button type="button" className="mobile-nav-menu-action" style={{ ...styles.menuButton, ...themedMenuButtonStyle }} onPointerDown={handleMenuPointerDown('/plans', true)} onClick={handleMenuClick('/plans', true)}>
                            <span style={{ ...styles.menuIconShell, ...themedMenuIconShellStyle }}><MenuIcon name="plans" /></span>
                            <span className="mobile-nav-menu-label" style={styles.menuLabel}>{labels.plans}</span>
                        </button>
                        <button type="button" className="mobile-nav-menu-action" style={{ ...styles.menuButton, ...themedMenuButtonStyle }} onPointerDown={handleMenuPointerDown('/saved', true)} onClick={handleMenuClick('/saved', true)}>
                            <span style={{ ...styles.menuIconShell, ...themedMenuIconShellStyle }}><MenuIcon name="saved" /></span>
                            <span className="mobile-nav-menu-label" style={styles.menuLabel}>{labels.saved}</span>
                        </button>
                        <button type="button" className="mobile-nav-menu-action" style={{ ...styles.menuButton, ...themedMenuButtonStyle }} onPointerDown={handleMenuPointerDown('/collections')} onClick={handleMenuClick('/collections')}>
                            <span style={{ ...styles.menuIconShell, ...themedMenuIconShellStyle }}><MenuIcon name="collection" /></span>
                            <span className="mobile-nav-menu-label" style={styles.menuLabel}>{labels.collection}</span>
                        </button>
                        <button type="button" className="mobile-nav-menu-action" style={{ ...styles.menuButton, ...themedMenuButtonStyle }} onPointerDown={handleMenuPointerDown('/compare', true)} onClick={handleMenuClick('/compare', true)}>
                            <span style={{ ...styles.menuIconShell, ...themedMenuIconShellStyle }}><MenuIcon name="compare" /></span>
                            <span className="mobile-nav-menu-label" style={styles.menuLabel}>{labels.compare}</span>
                        </button>
                    </div>
                </>
            )}

            <nav className="mobile-bottom-nav md:hidden" style={styles.root}>
                <div style={{ ...styles.shell, ...themedShellStyle }}>
                    <div id="nav-toolbar" style={styles.toolbar} />
                    <div style={styles.row}>
                        {tabsLeft.map(renderTab)}

                        <div style={styles.centerSlot} ref={menuRef}>
                            <button
                                type="button"
                                aria-expanded={menuOpen}
                                aria-pressed={isCenterActive || menuOpen}
                                aria-label={labels.menu}
                                className="mobile-nav-center-button"
                                style={{ ...styles.centerButton, ...(!isCenterActive ? styles.centerInactive : null), ...(!isCenterActive ? themedCenterInactiveStyle : null), ...((menuOpen || isCenterActive) ? styles.centerPressed : null) }}
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
                                <CenterMuseumIcon active={isCenterActive || menuOpen} pending={isCenterLoadingActive && !menuOpen} />
                            </button>
                        </div>

                        {tabsRight.map(renderTab)}
                    </div>
                </div>
            </nav>

            {(menuOpen || menuClosing) && (
                <button
                    type="button"
                    aria-label={labels.menu}
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

    if (!portalReady) return null;
    return createPortal(navContent, document.body);
}
