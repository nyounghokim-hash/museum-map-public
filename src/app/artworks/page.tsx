'use client';
import { useState, useEffect, useRef, useCallback, useMemo, type MouseEvent, type PointerEvent } from 'react';
import { useApp } from '@/components/AppContext';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Locale } from '@/lib/i18n';

import * as gtag from '@/lib/gtag';
import { buildShareUrl } from '@/lib/utm';
import { getLocalizedMuseumName } from '@/lib/getLocalizedName';
import { getLocalizedArtworkTitle, getLocalizedArtistName } from '@/lib/getLocalizedName';
import { resolveMuseumRouteId } from '@/lib/clientMuseumRoute';
import { lockMobileSearchChrome, primeMobileSearchChrome } from '@/lib/mobileSearchChrome';
import { navigateDocument } from '@/lib/route-pending';
import { useTranslatedText } from '@/hooks/useTranslation';
import EmptyStateGame from '@/components/ui/EmptyStateGame';
import { Shuffle } from 'lucide-react';

const PAGE_LABELS: Record<string, { title: string; subtitle: string; loading: string; empty: string; viewMuseum: string; listTitle: string; countUnit: string; searchPlaceholder: string }> = {
    ko: { title: '작품', subtitle: '세계 곳곳의 대표 작품을 살펴보세요.', loading: '작품을 불러오는 중이에요', empty: '아직 볼 수 있는 작품이 없어요', viewMuseum: '미술관 보기', listTitle: '작품 목록', countUnit: '점', searchPlaceholder: '작품, 작가, 미술관 검색' },
    en: { title: 'Artworks', subtitle: 'Featured artworks from around the world', loading: 'Loading...', empty: 'No artworks yet', viewMuseum: 'View Museum', listTitle: 'Artwork list', countUnit: 'works', searchPlaceholder: 'Search artworks, artists, museums...' },
    ja: { title: '作品', subtitle: '世界の代表作品を一目で', loading: '読み込み中...', empty: '作品はまだありません', viewMuseum: '美術館を見る', listTitle: '作品リスト', countUnit: '点', searchPlaceholder: '作品・作家・美術館を検索...' },
    de: { title: 'Kunstwerke', subtitle: 'Ausgewählte Kunstwerke aus aller Welt', loading: 'Laden...', empty: 'Noch keine Kunstwerke', viewMuseum: 'Museum ansehen', listTitle: 'Werkverzeichnis', countUnit: 'Werke', searchPlaceholder: 'Kunstwerke, Künstler, Museen suchen...' },
    fr: { title: 'Œuvres', subtitle: 'Œuvres du monde entier', loading: 'Chargement...', empty: 'Aucune œuvre', viewMuseum: 'Voir le musée', listTitle: 'Liste des œuvres', countUnit: 'œuvres', searchPlaceholder: 'Rechercher œuvres, artistes, musées...' },
    es: { title: 'Obras', subtitle: 'Obras destacadas del mundo', loading: 'Cargando...', empty: 'Sin obras aún', viewMuseum: 'Ver museo', listTitle: 'Lista de obras', countUnit: 'obras', searchPlaceholder: 'Buscar obras, artistas, museos...' },
    pt: { title: 'Obras', subtitle: 'Obras em destaque do mundo', loading: 'Carregando...', empty: 'Sem obras ainda', viewMuseum: 'Ver museu', listTitle: 'Lista de obras', countUnit: 'obras', searchPlaceholder: 'Pesquisar obras, artistas, museus...' },
    'zh-CN': { title: '作品', subtitle: '来自世界各地的精选作品', loading: '加载中...', empty: '暂无作品', viewMuseum: '查看博物馆', listTitle: '作品列表', countUnit: '件', searchPlaceholder: '搜索作品、艺术家、博物馆...' },
    'zh-TW': { title: '作品', subtitle: '來自世界各地的精選作品', loading: '載入中...', empty: '暫無作品', viewMuseum: '查看博物館', listTitle: '作品列表', countUnit: '件', searchPlaceholder: '搜尋作品、藝術家、博物館...' },
    da: { title: 'Kunstværker', subtitle: 'Udvalgte kunstværker fra hele verden', loading: 'Indlæser...', empty: 'Ingen kunstværker endnu', viewMuseum: 'Se museum', listTitle: 'Liste over værker', countUnit: 'værker', searchPlaceholder: 'Søg kunstværker, kunstnere, museer...' },
    fi: { title: 'Teokset', subtitle: 'Valittuja teoksia ympäri maailmaa', loading: 'Ladataan...', empty: 'Ei teoksia vielä', viewMuseum: 'Katso museo', listTitle: 'Teoslista', countUnit: 'teosta', searchPlaceholder: 'Hae teoksia, taiteilijoita, museoita...' },
    sv: { title: 'Konstverk', subtitle: 'Utvalda konstverk från hela världen', loading: 'Laddar...', empty: 'Inga konstverk ännu', viewMuseum: 'Visa museum', listTitle: 'Verklista', countUnit: 'verk', searchPlaceholder: 'Sök konstverk, konstnärer, museer...' },
    et: { title: 'Teosed', subtitle: 'Maailma silmapaistvad teosed', loading: 'Laadimine...', empty: 'Teoseid pole veel', viewMuseum: 'Vaata muuseumi', listTitle: 'Teoste loend', countUnit: 'teost', searchPlaceholder: 'Otsi teoseid, kunstnikke, muuseume...' },
};

const TOUCH_TAP_CANCEL_PX = 10;
const TOUCH_CLICK_SUPPRESS_MS = 450;

type ArtworkSortMode = 'random' | 'registered' | 'year' | 'alphabetical';
const ARTWORK_SORT_LABELS: Record<ArtworkSortMode, Record<string, string>> = {
    random: { ko: '랜덤순', en: 'Random', ja: 'ランダム', zh: '随机', 'zh-CN': '随机', 'zh-TW': '隨機', fr: 'Aléatoire', de: 'Zufällig', es: 'Aleatorio', pt: 'Aleatório', da: 'Tilfældig', fi: 'Satunnainen', sv: 'Slumpmässig', et: 'Juhuslik' },
    registered: { ko: '등록순', en: 'Date Added', ja: '登録順', zh: '添加日期', 'zh-CN': '添加日期', 'zh-TW': '新增日期', fr: 'Date d\'ajout', de: 'Hinzugefügt', es: 'Fecha de adición', pt: 'Data de adição', da: 'Tilføjet', fi: 'Lisätty', sv: 'Tillagd', et: 'Lisatud' },
    year: { ko: '연도순', en: 'Year', ja: '年代順', zh: '年份', 'zh-CN': '年份', 'zh-TW': '年份', fr: 'Année', de: 'Jahr', es: 'Año', pt: 'Ano', da: 'År', fi: 'Vuosi', sv: 'År', et: 'Aasta' },
    alphabetical: { ko: '가나다순', en: 'A–Z', ja: '五十音順', zh: '字母顺序', 'zh-CN': '字母顺序', 'zh-TW': '字母順序', fr: 'A–Z', de: 'A–Z', es: 'A–Z', pt: 'A–Z', da: 'A–Å', fi: 'A–Ö', sv: 'A–Ö', et: 'A–Ü' },
};

function SkeletonCard() {
    return (
        <div className="mm-actual-skeleton overflow-hidden">
            <div className="aspect-[4/3] mm-skel-block" style={{ borderRadius: 0 }} />
            <div className="p-3.5 space-y-2">
                <div className="mm-skel-line w-16" />
                <div className="mm-skel-line h-5 w-28" />
                <div className="mm-skel-line w-20" />
            </div>
        </div>
    );
}

function ArtworkPageSkeleton({ locale }: { locale: Locale }) {
    return (
        <div data-mm-page="artworks" className="mm-nav-page-enter no-back-swipe mm-editorial-page2 mm-library-page2 w-full max-w-[960px] mx-auto px-4 pt-4 sm:px-6 sm:pt-8 md:px-8 pb-32 lg:pb-10">
            <div className="mm-gallery-hero p-5 sm:p-7 mb-5 sm:mb-6">
                <div className="mm-skel-line w-20 mb-4 opacity-40" />
                <div className="mm-skel-line h-8 w-40 mb-3 opacity-50" />
                <div className="mm-skel-line w-64 opacity-40" />
            </div>
            <div className="mb-5">
                <div className="mm-skel-pill h-12 w-full" />
            </div>
            <div className="mm-section-heading">
                <div className="mm-skel-line h-5 w-24" />
                <div className="flex items-center gap-2">
                    <div className="mm-skel-line w-12" />
                    <div className="mm-skel-pill w-24" />
                </div>
            </div>
            <div className="mm-artwork-grid2">
                {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
        </div>
    );
}

const SCROLL_KEY = 'artworks_scroll_pos';
const CACHE_KEY = 'artworks_cache';
const SCROLL_RESTORE_RETRY_MS = [80, 220, 520, 900, 1400];

type ArtworkCachePayload = {
    items?: any[];
    hasMore?: boolean;
    cursor?: string | null;
    seed?: string;
};

function readArtworkCache(cacheKey: string): ArtworkCachePayload | null {
    if (typeof window === 'undefined') return null;
    try {
        const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null') as ArtworkCachePayload | null;
        if (cached?.items?.length) return cached;
    } catch { }
    return null;
}

function restoreScrollPosition(y: number) {
    if (typeof window === 'undefined' || !Number.isFinite(y) || y <= 0) return;
    const restore = () => window.scrollTo(0, y);
    requestAnimationFrame(restore);
    SCROLL_RESTORE_RETRY_MS.forEach((delay) => {
        window.setTimeout(restore, delay);
    });
}

// Fisher-Yates (Knuth) shuffle — true uniform random, no bias
function fisherYatesShuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function translationValues(value: any): string[] {
    return value && typeof value === 'object'
        ? Object.values(value).filter(Boolean).map(String)
        : [];
}

export default function ArtworksPage() {
    const { locale } = useApp();
    const searchParams = useSearchParams();
    const router = useRouter();
    const museumIdFilter = searchParams.get('museumId') || '';
    const museumNameFilter = searchParams.get('museumName') || '';
    const cacheKey = museumIdFilter ? `${CACHE_KEY}_${museumIdFilter}` : CACHE_KEY;
    const [artworks, setArtworks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [cursor, setCursor] = useState<string | null>(null);
    const [selected, setSelected] = useState<any>(null);
    const [sheetClosing, setSheetClosing] = useState(false);
    const closeSheet = () => {
        setSheetClosing(true);
        setTimeout(() => { setSelected(null); setSheetClosing(false); }, 250);
    };
    const [shuffleKey, setShuffleKey] = useState(0);
    const [shuffleSpinning, setShuffleSpinning] = useState(false);
    const [sortMode, setSortMode] = useState<ArtworkSortMode>('random');

    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const artworkPointerHandledRef = useRef<string | null>(null);
    const artworkTouchRef = useRef<{ id: string; pointerId: number; x: number; y: number; moved: boolean } | null>(null);
    const artworkSuppressClickRef = useRef<{ id: string; until: number } | null>(null);
    const labels = PAGE_LABELS[locale] || PAGE_LABELS.en;
    const selectedDescriptionSource = selected?.descriptionKo || selected?.description || '';
    const selectedTranslatedDescription = useTranslatedText(selectedDescriptionSource, locale as Locale);
    const selectedDisplayDescription = locale === 'ko'
        ? (selected?.descriptionKo || selected?.description || '')
        : (selectedTranslatedDescription || selected?.description || selected?.descriptionKo || '');
    const sentinelRef = useRef<HTMLDivElement>(null);
    const restoredRef = useRef(false);
    const searchScrollLockRef = useRef(0);
    const randomSeedRef = useRef(`artworks-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    // Keep search responsive while still avoiding a full filter pass on every keystroke.
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(searchQuery), 250);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        if (!isSearchFocused) return;
        const restoreSearchChrome = lockMobileSearchChrome();
        searchScrollLockRef.current = window.scrollY;
        const originalBodyPosition = document.body.style.position;
        const originalBodyTop = document.body.style.top;
        const originalBodyWidth = document.body.style.width;
        const originalBodyOverflow = document.body.style.overflow;
        const originalHtmlOverscroll = document.documentElement.style.overscrollBehavior;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${searchScrollLockRef.current}px`;
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overscrollBehavior = 'none';
        return () => {
            restoreSearchChrome();
            document.body.style.position = originalBodyPosition;
            document.body.style.top = originalBodyTop;
            document.body.style.width = originalBodyWidth;
            document.body.style.overflow = originalBodyOverflow;
            document.documentElement.style.overscrollBehavior = originalHtmlOverscroll;
            window.scrollTo(0, searchScrollLockRef.current);
        };
    }, [isSearchFocused]);

    const fetchArtworks = useCallback(async (nextCursor?: string) => {
        if (nextCursor) setLoadingMore(true); else setLoading(true);
        try {
            // If cursor starts with 'offset:', use random mode with offset for load-more
            let url: string;
            if (nextCursor && nextCursor.startsWith('offset:')) {
                const offset = nextCursor.replace('offset:', '');
                url = `/api/artworks?limit=24&random=true&offset=${offset}&seed=${encodeURIComponent(randomSeedRef.current)}`;
            } else if (nextCursor) {
                url = `/api/artworks?limit=24&cursor=${nextCursor}${museumIdFilter ? `&museumId=${encodeURIComponent(museumIdFilter)}` : ''}`;
            } else if (museumIdFilter) {
                url = `/api/artworks?limit=24&museumId=${encodeURIComponent(museumIdFilter)}`;
            } else {
                url = `/api/artworks?limit=48&random=true&seed=${encodeURIComponent(randomSeedRef.current)}`;
            }
            const res = await fetch(url);
            const data = await res.json();
            const items = data.data?.artworks || [];
            const nextCursorValue = data.data?.nextCursor ?? null;
            const newCursor = nextCursorValue && url.includes('random=true') ? `offset:${nextCursorValue}` : nextCursorValue;
            setArtworks(prev => {
                const result = nextCursor ? [...prev, ...items] : items;
                try { sessionStorage.setItem(cacheKey, JSON.stringify({ items: result, hasMore: data.data?.hasMore ?? false, cursor: newCursor, seed: randomSeedRef.current })); } catch { }
                return result;
            });
            setHasMore(data.data?.hasMore ?? false);
            setCursor(newCursor);
        } catch {
            setHasMore(false);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [cacheKey, museumIdFilter]);

    // On mount: try to restore from cache, otherwise fetch fresh
    useEffect(() => {
        try {
            const cached = readArtworkCache(cacheKey);
            const savedScroll = sessionStorage.getItem(SCROLL_KEY);
            if (cached) {
                const cachedItems = cached.items;
                if (Array.isArray(cachedItems) && cachedItems.length > 0) {
                    if (typeof cached.seed === 'string' && cached.seed) randomSeedRef.current = cached.seed;
                    setArtworks(cachedItems);
                    setHasMore(cached.hasMore ?? true);
                    setCursor(cached.cursor ?? null);
                    setLoading(false);
                    restoredRef.current = true;
                    if (savedScroll) {
                        restoreScrollPosition(parseInt(savedScroll, 10));
                        sessionStorage.removeItem(SCROLL_KEY);
                    }
                    return;
                }
            }
        } catch { }
        fetchArtworks();
    }, [cacheKey, fetchArtworks]);

    // IntersectionObserver for infinite scroll
    useEffect(() => {
        if (!sentinelRef.current || !hasMore || loadingMore) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loadingMore && cursor) {
                    fetchArtworks(cursor);
                }
            },
            { rootMargin: '200px' }
        );
        observer.observe(sentinelRef.current);
        return () => observer.disconnect();
    }, [hasMore, loadingMore, cursor, fetchArtworks]);

    // Museums are now directly attached to artwork from optimized API
    const getMuseums = (aw: any) => aw.museums || [];

    const openArtworkDetail = (artworkId: string, label?: string) => {
        if (!artworkId) return;
        gtag.event('view_artwork', { category: 'artwork', label: label || artworkId, value: 1 });
        try {
            const routeKey = `${window.location.pathname}${window.location.search}`;
            const routeScroll = JSON.stringify({ x: window.scrollX, y: window.scrollY, ts: Date.now() });
            sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
            sessionStorage.setItem(`mm-scroll-position:${routeKey}`, routeScroll);
            sessionStorage.setItem(`mm-scroll-position-lock:${routeKey}`, String(Date.now()));
            sessionStorage.setItem('artwork-list-return', window.location.pathname + window.location.search);
        } catch { }
        router.push(`/artworks/${encodeURIComponent(artworkId)}`);
    };

    const suppressArtworkClick = (id: string) => {
        artworkSuppressClickRef.current = { id, until: Date.now() + TOUCH_CLICK_SUPPRESS_MS };
    };

    const handleArtworkPointerDown = (event: PointerEvent<HTMLAnchorElement>, artworkId: string) => {
        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
        artworkTouchRef.current = {
            id: artworkId,
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            moved: false,
        };
    };

    const handleArtworkPointerMove = (event: PointerEvent<HTMLAnchorElement>, artworkId: string) => {
        const state = artworkTouchRef.current;
        if (!state || state.id !== artworkId || state.pointerId !== event.pointerId) return;
        if (Math.hypot(event.clientX - state.x, event.clientY - state.y) > TOUCH_TAP_CANCEL_PX) {
            state.moved = true;
        }
    };

    const handleArtworkPointerCancel = (artworkId: string) => {
        artworkTouchRef.current = null;
        suppressArtworkClick(artworkId);
    };

    const handleArtworkPointerUp = (event: PointerEvent<HTMLAnchorElement>, artwork: any) => {
        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
        const state = artworkTouchRef.current;
        artworkTouchRef.current = null;
        if (!state || state.id !== artwork.id || state.pointerId !== event.pointerId) return;
        if (state.moved) {
            suppressArtworkClick(artwork.id);
            return;
        }
        event.preventDefault();
        artworkPointerHandledRef.current = artwork.id;
        openArtworkDetail(artwork.id, artwork.title || artwork.id);
    };

    const handleArtworkClick = (event: MouseEvent<HTMLAnchorElement>, artwork: any) => {
        const suppressed = artworkSuppressClickRef.current;
        if (suppressed && suppressed.id === artwork.id && Date.now() < suppressed.until) {
            event.preventDefault();
            return;
        }
        if (artworkPointerHandledRef.current === artwork.id) {
            event.preventDefault();
            artworkPointerHandledRef.current = null;
            return;
        }
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        openArtworkDetail(artwork.id, artwork.title || artwork.id);
    };

    const openMuseumFromArtwork = async (museum: any) => {
        const museumRouteId = await resolveMuseumRouteId(museum);
        if (!museumRouteId) return;
        setSelected(null);
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('navigating-forward', String(Date.now()));
        }
        window.location.assign(`/museums/${encodeURIComponent(museumRouteId)}?from=artwork-list`);
    };

    // Filter artworks by debounced search query — memoized
    const filteredArtworks = useMemo(() => {
        let result = artworks;
        if (debouncedQuery.trim()) {
            const q = debouncedQuery.toLowerCase();
            result = result.filter(aw =>
                aw.title?.toLowerCase().includes(q) ||
                aw.titleKo?.toLowerCase().includes(q) ||
                aw.titleEn?.toLowerCase().includes(q) ||
                translationValues(aw.titleTranslations).some(value => value.toLowerCase().includes(q)) ||
                aw.artist?.toLowerCase().includes(q) ||
                aw.artistKo?.toLowerCase().includes(q) ||
                aw.artistEn?.toLowerCase().includes(q) ||
                translationValues(aw.artistTranslations).some(value => value.toLowerCase().includes(q)) ||
                getMuseums(aw).some((m: any) =>
                    m.name?.toLowerCase().includes(q) ||
                    m.nameKo?.toLowerCase().includes(q) ||
                    translationValues(m.nameTranslations).some(value => value.toLowerCase().includes(q))
                )
            );
        }
        // Apply sort
        if (sortMode !== 'random') {
            const sorted = [...result];
            switch (sortMode) {
                case 'registered':
                    sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    break;
                case 'year': {
                    // Extract numeric year from string for comparison
                    const parseYear = (y: string | null | undefined): number => {
                        if (!y) return -Infinity;
                        const match = y.match(/-?(\d+)/);
                        if (!match) return -Infinity;
                        return y.startsWith('-') || y.toLowerCase().includes('bc') ? -parseInt(match[1]) : parseInt(match[1]);
                    };
                    sorted.sort((a, b) => parseYear(a.year) - parseYear(b.year));
                    break;
                }
                case 'alphabetical': {
                    const getTitle = (aw: any) => getLocalizedArtworkTitle(aw, locale) || aw.title || '';
                    sorted.sort((a, b) => getTitle(a).localeCompare(getTitle(b), locale === 'ko' ? 'ko' : 'en'));
                    break;
                }
            }
            return sorted;
        }
        return result;
    }, [artworks, debouncedQuery, sortMode, locale]);

    const reshuffleArtworks = async () => {
        setShuffleSpinning(true);
        setShuffleKey(k => k + 1);
        randomSeedRef.current = `artworks-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        try {
            const res = await fetch(`/api/artworks?limit=48&random=true&seed=${encodeURIComponent(randomSeedRef.current)}`);
            const data = await res.json();
            const items = data.data?.artworks || [];
            const rawCursor = data.data?.nextCursor ?? null;
            const newCursor = rawCursor ? `offset:${rawCursor}` : null;
            setArtworks(items);
            setHasMore(data.data?.hasMore ?? false);
            setCursor(newCursor);
            try { sessionStorage.setItem(cacheKey, JSON.stringify({ items, hasMore: data.data?.hasMore ?? false, cursor: newCursor, seed: randomSeedRef.current })); } catch { }
        } catch { }
        setTimeout(() => setShuffleSpinning(false), 500);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSortChange = async (mode: ArtworkSortMode) => {
        if (mode === sortMode) return;
        setSortMode(mode);
        if (mode === 'random') {
            if (museumIdFilter) {
                fetchArtworks();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
            // Switch back to random — reshuffle from API
            reshuffleArtworks();
        }
        // For other modes, sorting is handled client-side in useMemo
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleShare = async (aw: any) => {
        const text = `${aw.title}${aw.artist ? ' — ' + aw.artist : ''}`;
        const url = buildShareUrl(window.location.href);
        if (navigator.share) {
            try { await navigator.share({ title: text, text, url }); } catch { }
        } else {
            await navigator.clipboard.writeText(`${text}\n${url}`);
            alert(locale === 'ko' ? '공유 링크를 복사했어요' : 'Copied');
        }
    };

    if (loading && !searchQuery) {
        return <ArtworkPageSkeleton locale={locale} />;
    }

    return (
        <div data-mm-page="artworks" className="mm-nav-page-enter no-back-swipe mm-editorial-page2 mm-library-page2 w-full max-w-[960px] mx-auto px-4 pt-4 sm:px-6 sm:pt-8 md:px-8 pb-32 lg:pb-10" style={{ scrollbarGutter: 'stable' }}>
            <div className="mm-gallery-hero p-5 sm:p-7 mb-5 sm:mb-6">
                {loading ? (
                    <>
                        <div className="skeleton skeleton-text w-16 mb-3" />
                        <div className="skeleton skeleton-title w-36 mb-2" />
                        <div className="skeleton skeleton-text w-56 mt-2" />
                    </>
                ) : (
                    <>
                        <div className="mm-gallery-kicker mb-3">Collection</div>
                        <div className="flex items-center justify-between">
                            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">{labels.title}</h1>
                            {!museumIdFilter && (
                                <button
                                    onClick={reshuffleArtworks}
                                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/12 text-blue-100 border border-white/15 hover:bg-white/18 active:scale-90 transition-all"
                                    aria-label="Shuffle"
                                >
                                    <Shuffle className={`h-3.5 w-3.5 transition-transform duration-500 ${shuffleSpinning ? 'rotate-[360deg]' : ''}`} aria-hidden="true" />
                                </button>
                            )}
                        </div>
                        <p className="text-blue-100/80 mt-2 text-sm font-medium">{museumNameFilter || labels.subtitle}</p>
                    </>
                )}
            </div>

            {/* Search Bar */}
            {!loading && artworks.length > 0 && (
                <div className="mb-5">
                    <div className={`mm-map2-search relative flex h-[58px] items-center gap-2.5 rounded-full px-[18px] transition-all ${isSearchFocused ? 'is-focused' : ''}`}>
                        <svg className="w-5 h-5 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onPointerDown={() => primeMobileSearchChrome()}
                            onTouchStart={() => primeMobileSearchChrome()}
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => setIsSearchFocused(false)}
                            placeholder={labels.searchPlaceholder}
                            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-gray-800 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-blue-100/50"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        )}
                    </div>
                    {searchQuery && debouncedQuery === searchQuery && (
                        <p className="text-[11px] text-gray-400 mt-2 ml-1 min-w-[60px]">{filteredArtworks.length}{locale === 'ko' ? '개 결과' : ' results'}</p>
                    )}
                </div>
            )}

            {artworks.length === 0 ? (
                <EmptyStateGame
                    locale={locale}
                    title={labels.empty}
                    description={locale === 'ko' ? '지도를 둘러보며 마음에 드는 작품을 찾아보세요.' : labels.subtitle}
                />
            ) : (
                <>
                    <div className="mm-section-heading">
                        <h2>{labels.listTitle}</h2>
                        <div className="flex items-center gap-2">
                            <span>{filteredArtworks.length.toLocaleString()} {labels.countUnit}</span>
                            <select
                                value={sortMode}
                                onChange={e => handleSortChange(e.target.value as ArtworkSortMode)}
                                className="mm-gallery-chip cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                {(['random', 'registered', 'year', 'alphabetical'] as ArtworkSortMode[]).map(mode => (
                                    <option key={mode} value={mode}>{ARTWORK_SORT_LABELS[mode]?.[locale] || ARTWORK_SORT_LABELS[mode]?.en}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="mm-artwork-grid2">
                        {filteredArtworks.map((aw: any) => {
                            const museums = getMuseums(aw);
                            return (
                                <a
                                    key={`${shuffleKey}-${aw.id}`}
                                    href={`/artworks/${encodeURIComponent(aw.id)}`}
                                    data-mm-route-pending="off"
                                    className="mm-artwork-card2 block no-underline text-inherit group hover:-translate-y-0.5 transition-all duration-200 cursor-pointer active:scale-[0.98]"
                                    onPointerDown={(event) => handleArtworkPointerDown(event, aw.id)}
                                    onPointerMove={(event) => handleArtworkPointerMove(event, aw.id)}
                                    onPointerCancel={() => handleArtworkPointerCancel(aw.id)}
                                    onPointerUp={(event) => handleArtworkPointerUp(event, aw)}
                                    onClick={(event) => handleArtworkClick(event, aw)}
                                >
                                    <div className="aspect-[4/3] relative overflow-hidden bg-gray-100 dark:bg-neutral-800">
                                        {aw.image ? (
                                            <img
                                                src={aw.image}
                                                alt={aw.title}
                                                loading="lazy"
                                                className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500 opacity-0"
                                                onLoad={(e) => { (e.target as HTMLImageElement).classList.remove('opacity-0'); (e.target as HTMLImageElement).classList.add('opacity-100'); }}
                                                onError={(e) => { e.currentTarget.style.display = 'none'; const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback') as HTMLElement; if (fallback) fallback.style.display = 'flex'; }}
                                            />
                                        ) : null}
                                        <div className="logo-fallback w-full h-full flex items-center justify-center" style={{ display: aw.image ? 'none' : 'flex' }}>
                                            <img src="/logo.svg" alt="" className="mm-empty-logo mm-artwork-fallback-logo dark:invert" />
                                        </div>
                                    </div>
                                    <div className="p-3.5">
                                        {(aw.artist || aw.artistKo) && <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-0.5 truncate">{getLocalizedArtistName(aw, locale)}</p>}
                                        <h3 className="font-bold text-[15px] truncate dark:text-white leading-tight">{getLocalizedArtworkTitle(aw, locale)}</h3>
                                        {museums.length > 0 && (
                                            <p className="text-xs text-gray-400 dark:text-neutral-500 truncate mt-1.5 flex items-center gap-1.5">
                                                <svg className="w-3.5 h-3.5 flex-shrink-0 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M5.25 21V9.75L12 4.5l6.75 5.25V21M9 21v-6h6v6M8.25 10.5h.008v.008H8.25v-.008Zm3.75 0h.008v.008H12v-.008Zm3.75 0h.008v.008h-.008v-.008Z" /></svg>
                                                {getLocalizedMuseumName(museums[0], locale)}
                                            </p>
                                        )}
                                    </div>
                                </a>
                            );
                        })}

                        {/* Skeleton cards while loading more */}
                        {loadingMore && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={`skel-${i}`} />)}
                    </div>

                    {/* Infinite scroll sentinel */}
                    {hasMore && !loading && <div ref={sentinelRef} className="h-1" />}

                    {/* Artwork Detail Bottom Sheet */}
                    {selected && (
                        <div className="fixed inset-0 z-[9999] flex items-end justify-center" onClick={closeSheet}>
                            <div className={`absolute inset-0 bg-black/50 backdrop-blur-sm ${sheetClosing ? 'animate-fadeOut' : 'animate-backdropIn'}`} />
                            <div
                                className={`relative w-full max-w-3xl max-h-[85vh] glass-popup gradient-border rounded-t-3xl overflow-hidden ${sheetClosing ? 'animate-slideOutDown' : 'animate-slideUp'}`}
                                style={{ boxShadow: 'var(--glass-shadow-lg)' }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Drag handle */}
                                <div className="flex justify-center pt-3 pb-1">
                                    <div className="w-10 h-1 bg-gray-300 dark:bg-neutral-600 rounded-full" />
                                </div>

                                <div className="absolute top-3 right-4 z-10 flex items-center gap-2">
                                    {/* Share button */}
                                    <button
                                        onClick={() => handleShare(selected)}
                                        className="w-9 h-9 flex items-center justify-center rounded-full border text-gray-500 dark:text-gray-400 transition-colors shadow-sm active:scale-95"
                                        style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                                        aria-label="Share"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                        </svg>
                                    </button>
                                    {/* Close button */}
                                    <button
                                        onClick={closeSheet}
                                        className="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-all active:scale-95"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>

                                <div className="overflow-y-auto max-h-[80vh]">
                                    <div className="w-full aspect-[16/9] bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                                        {selected.image ? (
                                            <img
                                                src={selected.image}
                                                alt={selected.title}
                                                className="w-full h-full object-cover"
                                                onError={(e) => { e.currentTarget.src = '/logo.svg'; e.currentTarget.className = 'mm-empty-logo mm-artwork-fallback-logo object-contain dark:invert m-auto'; }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <img src="/logo.svg" alt="" className="mm-empty-logo mm-artwork-fallback-logo dark:invert" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-6 pb-10">
                                        {(selected.artist || selected.artistKo) && (
                                            <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">{getLocalizedArtistName(selected, locale)}</p>
                                        )}
                                        <h3 className="font-extrabold text-lg dark:text-white leading-tight mb-3">{getLocalizedArtworkTitle(selected, locale)}</h3>
                                        {selectedDisplayDescription && (
                                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">{selectedDisplayDescription}</p>
                                        )}
                                        {getMuseums(selected).length > 0 && (
                                            <div className="space-y-2 mt-2">
                                                {getMuseums(selected).map((m: any) => (
                                                    <button
                                                        key={m.id || m.museumId || m.name}
                                                        onClick={() => openMuseumFromArtwork(m)}
                                                        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-xl transition-colors active:scale-95"
                                                    >
                                                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                        <span>{getLocalizedMuseumName(m, locale)}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* View Detail Page */}
                                        <button
                                            onClick={() => { setSelected(null); openArtworkDetail(selected.id, selected.title || selected.id); }}
                                            className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-black text-white bg-black dark:bg-white dark:text-black rounded-xl transition-all hover:opacity-90 active:scale-95"
                                        >
                                            {locale === 'ko' ? '자세히 보기' : 'View Details'}
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bottom spacing */}
                    <div className="h-6" />
                </>
            )}
        </div>
    );
}
