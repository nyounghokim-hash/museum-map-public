'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useApp } from '@/components/AppContext';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/i18n';

import * as gtag from '@/lib/gtag';
import { buildShareUrl } from '@/lib/utm';
import { getLocalizedMuseumName } from '@/lib/getLocalizedName';
import { getLocalizedArtworkTitle, getLocalizedArtistName } from '@/lib/getLocalizedName';

const PAGE_LABELS: Record<string, { title: string; subtitle: string; loading: string; empty: string; viewMuseum: string }> = {
    ko: { title: '작품', subtitle: '세계의 대표 작품을 한눈에', loading: '불러오는 중...', empty: '아직 등록된 작품이 없습니다', viewMuseum: '미술관 보기' },
    en: { title: 'Artworks', subtitle: 'Featured artworks from around the world', loading: 'Loading...', empty: 'No artworks yet', viewMuseum: 'View Museum' },
    ja: { title: '作品', subtitle: '世界の代表作品を一目で', loading: '読み込み中...', empty: '作品はまだありません', viewMuseum: '美術館を見る' },
    de: { title: 'Kunstwerke', subtitle: 'Ausgewählte Kunstwerke aus aller Welt', loading: 'Laden...', empty: 'Noch keine Kunstwerke', viewMuseum: 'Museum ansehen' },
    fr: { title: 'Œuvres', subtitle: 'Œuvres du monde entier', loading: 'Chargement...', empty: 'Aucune œuvre', viewMuseum: 'Voir le musée' },
    es: { title: 'Obras', subtitle: 'Obras destacadas del mundo', loading: 'Cargando...', empty: 'Sin obras aún', viewMuseum: 'Ver museo' },
    pt: { title: 'Obras', subtitle: 'Obras em destaque do mundo', loading: 'Carregando...', empty: 'Sem obras ainda', viewMuseum: 'Ver museu' },
    'zh-CN': { title: '作品', subtitle: '来自世界各地的精选作品', loading: '加载中...', empty: '暂无作品', viewMuseum: '查看博物馆' },
    'zh-TW': { title: '作品', subtitle: '來自世界各地的精選作品', loading: '載入中...', empty: '暫無作品', viewMuseum: '查看博物館' },
    da: { title: 'Kunstværker', subtitle: 'Udvalgte kunstværker fra hele verden', loading: 'Indlæser...', empty: 'Ingen kunstværker endnu', viewMuseum: 'Se museum' },
    fi: { title: 'Teokset', subtitle: 'Valittuja teoksia ympäri maailmaa', loading: 'Ladataan...', empty: 'Ei teoksia vielä', viewMuseum: 'Katso museo' },
    sv: { title: 'Konstverk', subtitle: 'Utvalda konstverk från hela världen', loading: 'Laddar...', empty: 'Inga konstverk ännu', viewMuseum: 'Visa museum' },
    et: { title: 'Teosed', subtitle: 'Maailma silmapaistvad teosed', loading: 'Laadimine...', empty: 'Teoseid pole veel', viewMuseum: 'Vaata muuseumi' },
};

type ArtworkSortMode = 'random' | 'registered' | 'year' | 'alphabetical';
const ARTWORK_SORT_LABELS: Record<ArtworkSortMode, Record<string, string>> = {
    random: { ko: '랜덤순', en: 'Random', ja: 'ランダム', zh: '随机', 'zh-CN': '随机', 'zh-TW': '隨機', fr: 'Aléatoire', de: 'Zufällig', es: 'Aleatorio', pt: 'Aleatório', da: 'Tilfældig', fi: 'Satunnainen', sv: 'Slumpmässig', et: 'Juhuslik' },
    registered: { ko: '등록순', en: 'Date Added', ja: '登録順', zh: '添加日期', 'zh-CN': '添加日期', 'zh-TW': '新增日期', fr: 'Date d\'ajout', de: 'Hinzugefügt', es: 'Fecha de adición', pt: 'Data de adição', da: 'Tilføjet', fi: 'Lisätty', sv: 'Tillagd', et: 'Lisatud' },
    year: { ko: '연도순', en: 'Year', ja: '年代順', zh: '年份', 'zh-CN': '年份', 'zh-TW': '年份', fr: 'Année', de: 'Jahr', es: 'Año', pt: 'Ano', da: 'År', fi: 'Vuosi', sv: 'År', et: 'Aasta' },
    alphabetical: { ko: '가나다순', en: 'A–Z', ja: '五十音順', zh: '字母顺序', 'zh-CN': '字母顺序', 'zh-TW': '字母順序', fr: 'A–Z', de: 'A–Z', es: 'A–Z', pt: 'A–Z', da: 'A–Å', fi: 'A–Ö', sv: 'A–Ö', et: 'A–Ü' },
};

function SkeletonCard() {
    return (
        <div className="skeleton skeleton-card overflow-hidden">
            <div className="aspect-[4/3] skeleton" style={{ borderRadius: 0 }} />
            <div className="p-3.5 space-y-2">
                <div className="skeleton skeleton-text w-16" />
                <div className="skeleton skeleton-title w-28" />
                <div className="skeleton skeleton-text w-20" />
            </div>
        </div>
    );
}

const SCROLL_KEY = 'artworks_scroll_pos';
const CACHE_KEY = 'artworks_cache';

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
    const router = useRouter();
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
    const labels = PAGE_LABELS[locale] || PAGE_LABELS.en;
    const sentinelRef = useRef<HTMLDivElement>(null);
    const restoredRef = useRef(false);

    // Debounce search query (1000ms — 입력 완료 후 1초 뒤 결과 표시)
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(searchQuery), 1000);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchArtworks = useCallback(async (nextCursor?: string) => {
        if (nextCursor) setLoadingMore(true); else setLoading(true);
        try {
            // If cursor starts with 'offset:', use random mode with offset for load-more
            let url: string;
            if (nextCursor && nextCursor.startsWith('offset:')) {
                const offset = nextCursor.replace('offset:', '');
                url = `/api/artworks?limit=24&random=true&offset=${offset}`;
            } else if (nextCursor) {
                url = `/api/artworks?limit=12&cursor=${nextCursor}`;
            } else {
                url = '/api/artworks?limit=48&random=true';
            }
            const res = await fetch(url);
            const data = await res.json();
            const items = data.data?.artworks || [];
            const newCursor = data.data?.nextCursor ? `offset:${data.data.nextCursor}` : (data.data?.nextCursor ?? null);
            setArtworks(prev => {
                const result = nextCursor ? [...prev, ...items] : items;
                try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ items: result, hasMore: data.data?.hasMore ?? false, cursor: newCursor })); } catch { }
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
    }, []);

    // On mount: try to restore from cache, otherwise fetch fresh
    useEffect(() => {
        try {
            const cached = sessionStorage.getItem(CACHE_KEY);
            const savedScroll = sessionStorage.getItem(SCROLL_KEY);
            if (cached && savedScroll) {
                const { items, hasMore: hm, cursor: c } = JSON.parse(cached);
                if (items?.length > 0) {
                    setArtworks(items);
                    setHasMore(hm);
                    setCursor(c);
                    setLoading(false);
                    restoredRef.current = true;
                    // Restore scroll position after render
                    requestAnimationFrame(() => {
                        setTimeout(() => { window.scrollTo(0, parseInt(savedScroll, 10)); }, 50);
                    });
                    sessionStorage.removeItem(SCROLL_KEY);
                    return;
                }
            }
        } catch { }
        fetchArtworks();
    }, [fetchArtworks]);

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
        try {
            const res = await fetch('/api/artworks?limit=48&random=true');
            const data = await res.json();
            const items = data.data?.artworks || [];
            const rawCursor = data.data?.nextCursor ?? null;
            const newCursor = rawCursor ? `offset:${rawCursor}` : null;
            setArtworks(items);
            setHasMore(data.data?.hasMore ?? false);
            setCursor(newCursor);
            try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ items, hasMore: data.data?.hasMore ?? false, cursor: newCursor })); } catch { }
        } catch { }
        setTimeout(() => setShuffleSpinning(false), 500);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSortChange = async (mode: ArtworkSortMode) => {
        if (mode === sortMode) return;
        setSortMode(mode);
        if (mode === 'random') {
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
            alert(locale === 'ko' ? '복사되었습니다' : 'Copied');
        }
    };

    return (
        <div className="no-back-swipe w-full lg:max-w-[1080px] mx-auto px-4 py-4 sm:px-6 sm:py-8 md:px-8 mt-4 sm:mt-8 pb-32 lg:pb-8" style={{ scrollbarGutter: 'stable' }}>
            <div className="mb-6 sm:mb-8">
                {loading ? (
                    <>
                        <div className="skeleton skeleton-text w-16 mb-3" />
                        <div className="skeleton skeleton-title w-36 mb-2" />
                        <div className="skeleton skeleton-text w-56 mt-2" />
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                            <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-[0.2em]">Gallery</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight dark:text-white">{labels.title}</h1>
                            <button
                                onClick={reshuffleArtworks}
                                className="w-9 h-9 flex items-center justify-center rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-500 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 active:scale-90 transition-all"
                                aria-label="Shuffle"
                            >
                                <svg className={`w-4 h-4 transition-transform duration-500 ${shuffleSpinning ? 'rotate-[360deg]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-gray-400 dark:text-neutral-500 mt-1 text-xs font-medium">{labels.subtitle}</p>
                    </>
                )}
            </div>

            {/* Search Bar */}
            {!loading && artworks.length > 0 && (
                <div className="mb-5">
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={locale === 'ko' ? '작품, 작가, 미술관 검색...' : locale === 'ja' ? '作品・作家・美術館を検索...' : 'Search artworks, artists, museums...'}
                            className="w-full pl-9 pr-9 py-3 backdrop-blur-xl rounded-2xl text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                            style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', boxShadow: 'var(--glass-shadow)' }}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        )}
                    </div>
                    {searchQuery && debouncedQuery === searchQuery && (
                        <p className="text-[11px] text-gray-400 mt-2 ml-1 min-w-[60px]">{filteredArtworks.length}{locale === 'ko' ? '개 결과' : ' results'}</p>
                    )}
                    {/* Sort Dropdown */}
                    <div className="flex items-center justify-end mt-2">
                        <select
                            value={sortMode}
                            onChange={e => handleSortChange(e.target.value as ArtworkSortMode)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-200 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                        >
                            {(['random', 'registered', 'year', 'alphabetical'] as ArtworkSortMode[]).map(mode => (
                                <option key={mode} value={mode}>{ARTWORK_SORT_LABELS[mode]?.[locale] || ARTWORK_SORT_LABELS[mode]?.en}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {loading && !searchQuery ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                    {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
            ) : artworks.length === 0 ? (
                <div className="py-20 sm:py-32 flex flex-col items-center justify-center">
                    <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gray-50 dark:bg-neutral-800/50 rounded-full flex items-center justify-center mb-8">
                        <img src="/logo.svg" alt="Museum Map" className="w-16 h-16 sm:w-20 sm:h-20 opacity-20 dark:invert dark:opacity-[0.6]" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-4 text-center">
                        {labels.empty}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base max-w-md text-center mb-10 leading-relaxed">
                        박물관의 작품들을 둘러보고 저장해보세요
                    </p>
                </div>
            ) : (
                <>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-5">
                        {filteredArtworks.map((aw: any, idx: number) => {
                            const museums = getMuseums(aw);
                            return (
                                <div
                                    key={`${shuffleKey}-${aw.id}`}
                                    className="group rounded-2xl overflow-hidden border shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer active:scale-[0.98]"
                                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)', animation: `fadeInUp 0.4s ${Math.min(idx, 11) * 50}ms both` }}
                                    onClick={() => { gtag.event('view_artwork', { category: 'artwork', label: aw.title || aw.id, value: 1 }); try { sessionStorage.setItem(SCROLL_KEY, String(window.scrollY)); } catch { } router.push(`/artworks/${aw.id}`); }}
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
                                            <img src="/logo.svg" alt="" className="w-12 h-12 opacity-20 dark:invert dark:opacity-60" />
                                        </div>
                                    </div>
                                    <div className="p-3.5">
                                        {(aw.artist || aw.artistKo) && <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-0.5 truncate">{getLocalizedArtistName(aw, locale)}</p>}
                                        <h3 className="font-bold text-[15px] truncate dark:text-white leading-tight">{getLocalizedArtworkTitle(aw, locale)}</h3>
                                        {museums.length > 0 && (
                                            <p className="text-xs text-gray-400 dark:text-neutral-500 truncate mt-1.5 flex items-center gap-1">
                                                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                {getLocalizedMuseumName(museums[0], locale)}
                                            </p>
                                        )}
                                    </div>
                                </div>
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
                                                onError={(e) => { e.currentTarget.src = '/logo.svg'; e.currentTarget.className = 'w-full h-full object-contain p-16 opacity-20 dark:invert dark:opacity-60'; }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <img src="/logo.svg" alt="" className="w-24 h-24 opacity-20 dark:invert dark:opacity-60" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-6 pb-10">
                                        {(selected.artist || selected.artistKo) && (
                                            <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1">{getLocalizedArtistName(selected, locale)}</p>
                                        )}
                                        <h3 className="font-extrabold text-lg dark:text-white leading-tight mb-3">{getLocalizedArtworkTitle(selected, locale)}</h3>
                                        {selected.description && (
                                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">{selected.descriptionKo || selected.description}</p>
                                        )}
                                        {getMuseums(selected).length > 0 && (
                                            <div className="space-y-2 mt-2">
                                                {getMuseums(selected).map((m: any) => (
                                                    <button
                                                        key={m.id}
                                                        onClick={() => { setSelected(null); router.push(`/museums/${m.id}`); }}
                                                        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-xl transition-colors active:scale-95"
                                                    >
                                                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                        <span>{getLocalizedMuseumName(m, locale)}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* View Detail Page */}
                                        <button
                                            onClick={() => { setSelected(null); router.push(`/artworks/${selected.id}`); }}
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
