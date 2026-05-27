'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/components/AppContext';
import { t, formatDate, type Locale } from '@/lib/i18n';
import { useCachedTranslation } from '@/hooks/useCachedTranslation';
import { useTranslatedText } from '@/hooks/useTranslation';
import LoadingAnimation from '@/components/ui/LoadingAnimation';
import { getMuseumImageSrc, isRenderableUrl } from '@/lib/getMuseumImage';
import { getLocalizedMuseumName } from '@/lib/getLocalizedName';
import { getDisplayStoryTitle } from '@/lib/storyTitle';
import * as gtag from '@/lib/gtag';

function sanitizeAI(text: string): string {
    if (!text) return text;
    return text
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/''([^']*)''/g, '$1')
        .replace(/\u201C([^\u201D]*)\u201D/g, '$1')
        .replace(/\u300C([^\u300D]*)\u300D/g, '$1')
        .replace(/\u300E([^\u300F]*)\u300F/g, '$1')
        .replace(/^[-*]\s+/gm, '')
        .replace(/^\d+\.\s+/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function BlogCard({ post, locale, onNavigate }: { post: any; locale: Locale; onNavigate: (id: string) => void }) {
    // DB-cached translations for non-ko/en
    const { translations: cached } = useCachedTranslation('story', post.id, locale);
    const sourceTitle = post.titleEn || post.title || '';
    const sourceContent = ((post.contentEn || post.content) || '').replace(/<[^>]*>/g, '');
    const liveTitle = useTranslatedText(sourceTitle, locale);
    const liveContent = useTranslatedText(sourceContent.substring(0, 2000), locale);

    let displayTitle: string;
    let displayContent: string;

    if (locale === 'ko') {
        displayTitle = getDisplayStoryTitle(sanitizeAI(post.title), post.museums);
        displayContent = sanitizeAI((post.content || '').replace(/<[^>]*>/g, '')).substring(0, 200);
    } else if (locale === 'en') {
        displayTitle = getDisplayStoryTitle(sanitizeAI(post.titleEn || post.title), post.museums);
        displayContent = sanitizeAI(((post.contentEn || post.content) || '').replace(/<[^>]*>/g, '')).substring(0, 200);
    } else if (cached.title) {
        displayTitle = getDisplayStoryTitle(sanitizeAI(cached.title), post.museums);
        displayContent = sanitizeAI((cached.content || (post.contentEn || post.content || '').replace(/<[^>]*>/g, '')).substring(0, 200));
    } else {
        displayTitle = getDisplayStoryTitle(sanitizeAI(liveTitle || sourceTitle), post.museums);
        displayContent = sanitizeAI((liveContent || sourceContent).substring(0, 200));
    }
    return (
        <div
            onClick={() => onNavigate(post.id)}
            className="mm-card group flex flex-col sm:flex-row min-h-auto sm:min-h-[180px] cursor-pointer"
        >
            {/* Horizontal Thumbnail — 대표작품 이미지를 우선. 순서: storyArtworks → artworks(JSON) → previewImage → 박물관 사진.
                로드 실패 시(Wikipedia hotlink 404/429 등) 다음 소스로 cascade fallback. */}
            <div className="w-full sm:w-[280px] h-[180px] sm:h-[200px] shrink-0 overflow-hidden relative" style={{ background: 'var(--mm-surface-secondary)' }}>
                {(() => {
                    const firstMuseum = post.museums?.[0]?.museum;
                    const museumImg = firstMuseum ? getMuseumImageSrc(firstMuseum) : null;
                    const relArt = post.storyArtworks?.[0]?.artwork?.image;
                    const jsonArtRaw = Array.isArray(post.artworks) ? (post.artworks as any[])[0] : null;
                    const jsonArt = jsonArtRaw?.image || jsonArtRaw?.imageUrl;
                    const preview = isRenderableUrl(post.previewImage) ? post.previewImage : null;
                    const artwork = isRenderableUrl(relArt) ? relArt : (isRenderableUrl(jsonArt) ? jsonArt : null);
                    const chain = [artwork, preview, museumImg].filter(Boolean) as string[];
                    if (chain.length === 0) return null;
                    return (
                        <img
                            src={chain[0]}
                            data-fallbacks={JSON.stringify(chain.slice(1))}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out will-change-transform opacity-0"
                            onLoad={(e) => { (e.target as HTMLImageElement).classList.remove('opacity-0'); (e.target as HTMLImageElement).classList.add('opacity-100'); }}
                            onError={(e) => {
                                const el = e.currentTarget;
                                const rest = JSON.parse(el.dataset.fallbacks || '[]') as string[];
                                if (rest.length > 0) {
                                    const next = rest.shift()!;
                                    el.dataset.fallbacks = JSON.stringify(rest);
                                    el.src = next;
                                } else {
                                    el.src = '/logo.svg';
                                    el.className = 'w-full h-full object-contain p-12 opacity-20 dark:invert dark:opacity-60';
                                }
                            }}
                        />
                    );
                })() ?? (
                    <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--mm-text-tertiary)' }}>
                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                )}
                {/* Category badge — top-left, prominent */}
                {post.category && (() => {
                    const label = CATEGORY_LABELS[post.category]?.[locale] || CATEGORY_LABELS[post.category]?.en || post.category;
                    const cat = post.category as string;
                    const gradientCls =
                        cat === 'TRAVEL' ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                            : cat === 'ART' ? 'bg-gradient-to-br from-pink-500 to-rose-600'
                                : cat === 'SPECIAL' ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                                    : 'bg-gradient-to-br from-purple-500 to-purple-700';
                    return (
                        <span
                            className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-lg ${gradientCls}`}
                            aria-label={label}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-white/80" aria-hidden="true" />
                            {label}
                        </span>
                    );
                })()}

                {/* Museum tags overlay — top-right of image */}
                {post.museums && post.museums.length > 0 && (
                    <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1 max-w-[60%]">
                        {post.museums.slice(0, 3).map((sm: any) => {
                            const mname = getLocalizedMuseumName(sm.museum || {}, locale);
                            const display = mname.length > 16 ? mname.substring(0, 16) + '…' : mname;
                            return (
                                <span
                                    key={sm.museum?.id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold text-white bg-black/55 backdrop-blur-md truncate max-w-full"
                                    title={mname}
                                >
                                    <svg className="w-2.5 h-2.5 flex-shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    <span className="truncate">{display}</span>
                                </span>
                            );
                        })}
                        {post.museums.length > 3 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white/85 bg-white/15 backdrop-blur-md">
                                +{post.museums.length - 3}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Content Side */}
            <div className="p-5 sm:p-6 flex-1 flex flex-col justify-center min-w-0">
                <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-widest flex-wrap" style={{ color: 'var(--mm-brand)' }}>
                    <span>{post.author || 'MM Editor'}</span>
                    <span style={{ color: 'var(--mm-surface-border)' }}>•</span>
                    <span className="font-medium" style={{ color: 'var(--mm-text-tertiary)' }}>{formatDate(post.createdAt, locale)}</span>
                    {post.views > 0 && (
                        <>
                            <span style={{ color: 'var(--mm-surface-border)' }}>•</span>
                            <span className="font-medium normal-case flex items-center gap-1" style={{ color: 'var(--mm-text-tertiary)' }}><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>{post.views.toLocaleString()}</span>
                        </>
                    )}
                </div>
                <h2 className="text-lg sm:text-xl font-bold mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-2" style={{ color: 'var(--mm-text-primary)', wordBreak: 'break-word' }}>
                    {displayTitle}
                </h2>
                <p className="text-sm line-clamp-2 leading-relaxed" style={{ color: 'var(--mm-text-secondary)', wordBreak: 'break-word' }}>
                    {displayContent}
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs font-bold group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" style={{ color: 'var(--mm-text-tertiary)' }}>
                    {t('blog.readMore', locale)}
                    <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </div>
        </div>
    );
}

const CATEGORIES = [
    {
        key: 'ALL', emoji: '✨',
        icon: <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
    },
    {
        key: 'TRAVEL', emoji: '✈️',
        icon: <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    {
        key: 'ART', emoji: '🎨',
        icon: <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" /></svg>
    },
    {
        key: 'MUSEUM', emoji: '📍',
        icon: <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
    },
    {
        key: 'SPECIAL', emoji: '✨',
        icon: <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
    },
] as const;

const CATEGORY_LABELS: Record<string, Record<string, string>> = {
    ALL: { ko: '전체', en: 'All', ja: 'すべて', zh: '全部', fr: 'Tout', de: 'Alle', es: 'Todo', it: 'Tutto', pt: 'Tudo', ru: 'Все', ar: 'الكل', sv: 'Alla', fi: 'Kaikki', da: 'Alle', et: 'Kõik' },
    MUSEUM: { ko: '뮤지엄', en: 'Museum', ja: 'ミュージアム', zh: '博物馆', fr: 'Musée', de: 'Museum', es: 'Museo', it: 'Museo', pt: 'Museu', ru: 'Музей', ar: 'متحف', sv: 'Museum', fi: 'Museo', da: 'Museum', et: 'Muuseum' },
    TRAVEL: { ko: '여행', en: 'Travel', ja: '旅行', zh: '旅行', fr: 'Voyage', de: 'Reise', es: 'Viaje', it: 'Viaggio', pt: 'Viagem', ru: 'Путешествие', ar: 'سفر', sv: 'Resa', fi: 'Matka', da: 'Rejse', et: 'Reis' },
    ART: { ko: '아트', en: 'Art', ja: 'アート', zh: '艺术', fr: 'Art', de: 'Kunst', es: 'Arte', it: 'Arte', pt: 'Arte', ru: 'Искусство', ar: 'فن', sv: 'Konst', fi: 'Taide', da: 'Kunst', et: 'Kunst' },
    SPECIAL: { ko: '특이', en: 'Unusual', ja: 'ユニーク', zh: '特色', fr: 'Insolite', de: 'Kurios', es: 'Insólito', it: 'Insolito', pt: 'Insólito', ru: 'Необычный', ar: 'غريب', sv: 'Ovanlig', fi: 'Omalaatuinen', da: 'Usædvanlig', et: 'Ebatavaline' },
};

type SortMode = 'random' | 'newest' | 'oldest' | 'distance';
const SORT_LABELS: Record<SortMode, Record<string, string>> = {
    random: { ko: '랜덤순', en: 'Random', ja: 'ランダム', zh: '随机', fr: 'Aléatoire', de: 'Zufällig', es: 'Aleatorio' },
    newest: { ko: '최신순', en: 'Newest', ja: '新しい順', zh: '最新', fr: 'Plus récent', de: 'Neueste', es: 'Más reciente' },
    oldest: { ko: '오래된순', en: 'Oldest', ja: '古い順', zh: '最旧', fr: 'Plus ancien', de: 'Älteste', es: 'Más antiguo' },
    distance: { ko: '거리순', en: 'Nearest', ja: '距離順', zh: '距离', fr: 'Distance', de: 'Entfernung', es: 'Distancia' },
};

export default function BlogListPage() {
    const { locale } = useApp();
    const router = useRouter();
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [navigating, setNavigating] = useState(false);
    const [page, setPage] = useState(1);
    const [activeCategory, setActiveCategory] = useState<string>('ALL');
    const [sortMode, setSortMode] = useState<SortMode>('random');
    const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);
    const PER_PAGE = 10;
    const SCROLL_KEY = 'blog_scroll_pos';
    const PAGE_KEY = 'blog_page';
    const CAT_KEY = 'blog_category';
    const SORT_KEY = 'blog_sort';

    const handleNavigate = (id: string) => {
        gtag.event('view_blog_post', { category: 'blog', label: id, value: 1 });
        try {
            sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
            sessionStorage.setItem(PAGE_KEY, String(page));
            sessionStorage.setItem(CAT_KEY, activeCategory);
            sessionStorage.setItem(SORT_KEY, sortMode);
        } catch { }
        setNavigating(true);
        router.push(`/blog/${id}`);
    };

    useEffect(() => {
        fetch('/api/blog')
            .then(res => res.json())
            .then(data => {
                if (data.data) {
                    const published = data.data.filter((p: any) => p.status === 'PUBLISHED');
                    setPosts(published);
                }
                setLoading(false);
                // Restore page + scroll position
                try {
                    const savedPage = sessionStorage.getItem(PAGE_KEY);
                    const savedScroll = sessionStorage.getItem(SCROLL_KEY);
                    if (savedPage) {
                        setPage(parseInt(savedPage, 10));
                        sessionStorage.removeItem(PAGE_KEY);
                    }
                    if (savedScroll) {
                        requestAnimationFrame(() => {
                            setTimeout(() => window.scrollTo(0, parseInt(savedScroll, 10)), 50);
                        });
                        sessionStorage.removeItem(SCROLL_KEY);
                    }
                } catch { }
            })
            .catch(() => setLoading(false));
        // Restore category + sort
        try {
            const savedCat = sessionStorage.getItem(CAT_KEY);
            if (savedCat) { setActiveCategory(savedCat); sessionStorage.removeItem(CAT_KEY); }
            const savedSort = sessionStorage.getItem(SORT_KEY);
            if (savedSort) { setSortMode(savedSort as SortMode); sessionStorage.removeItem(SORT_KEY); }
        } catch {}
    }, []);

    // Get user location for distance sort
    useEffect(() => {
        if (sortMode === 'distance' && !userLocation) {
            navigator.geolocation?.getCurrentPosition(
                (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => {/* ignore error */}
            );
        }
    }, [sortMode, userLocation]);

    const filteredPosts = activeCategory === 'ALL' ? posts : posts.filter(p => (p.category || 'MUSEUM') === activeCategory);

    // Sort posts based on sortMode
    const sortedPosts = useMemo(() => {
        const arr = [...filteredPosts];
        switch (sortMode) {
            case 'random':
                // Fisher-Yates shuffle
                for (let i = arr.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                }
                return arr;
            case 'newest':
                return arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            case 'oldest':
                return arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            case 'distance':
                if (!userLocation) return arr;
                return arr.sort((a, b) => {
                    const getMinDist = (post: any) => {
                        const museums = post.museums?.map((m: any) => m.museum).filter(Boolean) || [];
                        if (museums.length === 0) return Infinity;
                        return Math.min(...museums.map((m: any) => {
                            if (!m.latitude || !m.longitude) return Infinity;
                            const dLat = m.latitude - userLocation.lat;
                            const dLng = m.longitude - userLocation.lng;
                            return Math.sqrt(dLat * dLat + dLng * dLng);
                        }));
                    };
                    return getMinDist(a) - getMinDist(b);
                });
            default:
                return arr;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredPosts.length, sortMode, activeCategory, userLocation]);

    const totalPages = Math.ceil(sortedPosts.length / PER_PAGE);
    const paginatedPosts = sortedPosts.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const goToPage = (p: number) => {
        setPage(p);
    };

    const handleCategoryChange = (cat: string) => {
        setActiveCategory(cat);
        setPage(1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSortChange = (mode: SortMode) => {
        setSortMode(mode);
        setPage(1);
    };

    if (loading) return (
        <div className="no-back-swipe w-full max-w-[1080px] mx-auto px-4 py-4 sm:px-6 sm:py-8 md:px-8 mt-4 sm:mt-8">
            <div className="mb-6 sm:mb-8">
                <div className="skeleton skeleton-text w-16 mb-3" />
                <div className="skeleton skeleton-title w-48 mb-2" />
                <div className="skeleton skeleton-text w-72 mt-2" />
            </div>
            <div className="flex flex-col gap-6 sm:gap-8">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="skeleton skeleton-card flex flex-col sm:flex-row overflow-hidden">
                        <div className="w-full sm:w-[280px] h-[180px] sm:h-[200px] shrink-0 skeleton" style={{ borderRadius: 0 }} />
                        <div className="p-5 sm:p-6 flex-1 flex flex-col justify-center gap-3">
                            <div className="flex gap-2">
                                <div className="skeleton skeleton-text w-16" />
                                <div className="skeleton skeleton-text w-20" />
                            </div>
                            <div className="skeleton skeleton-title w-3/4" />
                            <div className="space-y-2">
                                <div className="skeleton skeleton-text w-full" />
                                <div className="skeleton skeleton-text w-2/3" />
                            </div>
                            <div className="skeleton skeleton-text w-20 mt-1" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="no-back-swipe w-full max-w-[1080px] mx-auto px-4 py-4 sm:px-6 sm:py-8 md:px-8 mt-4 sm:mt-8 pb-32 lg:pb-8">
            {navigating && <LoadingAnimation />}
            <div className="mb-6 sm:mb-8 animate-fadeInUp">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-[0.2em]">{locale === 'ko' ? '스토리' : 'Story'}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight dark:text-white">
                    {t('blog.title', locale)}
                </h1>
                <p className="text-gray-400 dark:text-neutral-500 mt-1 text-xs font-medium">
                    {t('blog.subtitle', locale)}
                </p>

                {/* Category Tabs — 전체 너비, SVG 아이콘 */}
                <div className="flex mt-4 bg-gray-100 dark:bg-neutral-800 rounded-2xl p-1 gap-1">
                    {CATEGORIES.map(cat => {
                        const isActive = activeCategory === cat.key;
                        return (
                            <button
                                key={cat.key}
                                onClick={() => handleCategoryChange(cat.key)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-3 lg:py-2.5 rounded-xl text-xs lg:text-sm font-bold whitespace-nowrap transition-all duration-200 active:scale-95 ${
                                    isActive
                                        ? 'gradient-btn text-white shadow-lg'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                            >
                                {cat.icon}
                                <span>{CATEGORY_LABELS[cat.key]?.[locale] || CATEGORY_LABELS[cat.key]?.en}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Sort Dropdown — 저장 페이지와 동일 스타일 */}
                <div className="flex items-center justify-end mt-3">
                    <select
                        value={sortMode}
                        onChange={e => handleSortChange(e.target.value as SortMode)}
                        className="px-3 py-1.5 rounded-xl text-[10px] lg:text-xs font-semibold border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-200 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                    >
                        {(['random', 'newest', 'oldest', 'distance'] as SortMode[]).map(mode => (
                            <option key={mode} value={mode}>{SORT_LABELS[mode]?.[locale] || SORT_LABELS[mode]?.en}</option>
                        ))}
                    </select>
                </div>
            </div>

            {posts.length === 0 ? (
                <div className="py-20 sm:py-32 flex flex-col items-center justify-center">
                    <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gray-50 dark:bg-neutral-800/50 rounded-full flex items-center justify-center mb-8">
                        <img src="/logo.svg" alt="Museum Map" className="w-16 h-16 sm:w-20 sm:h-20 opacity-20 dark:invert dark:opacity-[0.6]" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-4 text-center">
                        {t('blog.empty', locale)}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base max-w-md text-center mb-10 leading-relaxed">
                        {t('blog.emptyDesc', locale)}
                    </p>
                    <Link
                        href="/"
                        className="px-8 py-3 rounded-full gradient-btn text-white font-bold text-sm shadow-lg active:scale-95 transition-all"
                    >
                        {t('global.goHome', locale)}
                    </Link>
                </div>
            ) : (
                <>
                    <div className="flex flex-col gap-6 sm:gap-8 stagger-children">
                        {paginatedPosts.map((post: any) => (
                            <BlogCard key={post.id} post={post} locale={locale} onNavigate={handleNavigate} />
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-1.5 mt-10 mb-4">
                            {/* First page button */}
                            <button
                                onClick={() => goToPage(1)}
                                disabled={page === 1}
                                className="px-2 py-2 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                                title="First page"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                            </button>
                            {/* Prev button */}
                            <button
                                onClick={() => goToPage(page - 1)}
                                disabled={page === 1}
                                className="px-2 py-2 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            {(() => {
                                const maxVisible = 5;
                                let start = Math.max(1, page - Math.floor(maxVisible / 2));
                                let end = Math.min(totalPages, start + maxVisible - 1);
                                if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
                                return Array.from({ length: end - start + 1 }, (_, i) => start + i).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => goToPage(p)}
                                        className={`w-9 h-9 rounded-xl text-sm font-bold transition-all active:scale-95 ${p === page
                                            ? 'gradient-btn text-white shadow-md'
                                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800'
                                            }`}
                                    >
                                        {p}
                                    </button>
                                ));
                            })()}
                            {/* Next button */}
                            <button
                                onClick={() => goToPage(page + 1)}
                                disabled={page === totalPages}
                                className="px-2 py-2 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                            </button>
                            {/* Last page button */}
                            <button
                                onClick={() => goToPage(totalPages)}
                                disabled={page === totalPages}
                                className="px-2 py-2 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                                title="Last page"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
