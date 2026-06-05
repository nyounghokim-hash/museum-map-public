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

function getStoryImageChain(post: any): string[] {
    const firstMuseum = post.museums?.[0]?.museum;
    const museumImg = firstMuseum ? getMuseumImageSrc(firstMuseum) : null;
    const relArt = post.storyArtworks?.[0]?.artwork?.image;
    const jsonArtRaw = Array.isArray(post.artworks) ? (post.artworks as any[])[0] : null;
    const jsonArt = jsonArtRaw?.image || jsonArtRaw?.imageUrl;
    const preview = isRenderableUrl(post.previewImage) ? post.previewImage : null;
    const artwork = isRenderableUrl(relArt) ? relArt : (isRenderableUrl(jsonArt) ? jsonArt : null);
    return [artwork, preview, museumImg].filter(Boolean) as string[];
}

function getStoryMuseumLine(post: any, locale: Locale): string {
    const museums = post.museums?.map((item: any) => item?.museum).filter(Boolean) || [];
    if (museums.length === 0) {
        return locale === 'ko' ? '박물관 및 미술관' : locale === 'ja' ? '博物館・美術館' : 'Museums and galleries';
    }
    const first = getLocalizedMuseumName(museums[0], locale) || museums[0].nameKo || museums[0].name || '';
    if (museums.length === 1) return first;
    const moreLabel = locale === 'ko'
        ? `외 ${museums.length - 1}곳`
        : locale === 'ja'
            ? `ほか${museums.length - 1}件`
            : `+${museums.length - 1} more`;
    return `${first} ${moreLabel}`;
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
    const chain = getStoryImageChain(post);
    const museumLine = getStoryMuseumLine(post, locale);
    return (
        <button
            onClick={() => onNavigate(post.id)}
            className="mm-list-row2 group w-full text-left"
        >
            <div className="mm-story-list-thumb">
                {chain[0] ? (
                    <img
                        src={chain[0]}
                        data-fallbacks={JSON.stringify(chain.slice(1))}
                        alt={post.title}
                        className="opacity-0 transition-all duration-500 group-hover:scale-105"
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
                                el.className = 'w-full h-full object-contain p-3 opacity-20 dark:invert dark:opacity-60';
                            }
                        }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <img src="/logo.svg" alt="" className="w-8 h-8 opacity-20 dark:invert dark:opacity-60" />
                    </div>
                )}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 text-[10px] font-black uppercase tracking-widest flex-wrap" style={{ color: 'var(--mm-brand)' }}>
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
                <h2 className="text-[15px] sm:text-base font-black mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2" style={{ color: 'var(--mm-text-primary)', wordBreak: 'break-word' }}>
                    {displayTitle}
                </h2>
                <p className="mm-story-museum-line text-xs line-clamp-1 leading-relaxed" style={{ wordBreak: 'break-word' }}>
                    {museumLine}
                </p>
            </div>
        </button>
    );
}

function StoryRailCard({ post, locale, onNavigate }: { post: any; locale: Locale; onNavigate: (id: string) => void }) {
    const { translations: cached } = useCachedTranslation('story', post.id, locale);
    const sourceTitle = post.titleEn || post.title || '';
    const sourceContent = ((post.contentEn || post.content) || '').replace(/<[^>]*>/g, '');
    const liveTitle = useTranslatedText(sourceTitle, locale);
    const liveContent = useTranslatedText(sourceContent.substring(0, 1200), locale);
    const displayTitle = getDisplayStoryTitle(sanitizeAI(locale === 'ko'
        ? post.title
        : locale === 'en'
            ? (post.titleEn || post.title)
            : (cached.title || liveTitle || sourceTitle)), post.museums);
    const displayContent = sanitizeAI(locale === 'ko'
        ? (post.content || '').replace(/<[^>]*>/g, '')
        : locale === 'en'
            ? ((post.contentEn || post.content) || '').replace(/<[^>]*>/g, '')
            : (cached.content || liveContent || sourceContent)).substring(0, 110);
    const chain = getStoryImageChain(post);
    const museumLine = getStoryMuseumLine(post, locale);

    return (
        <button type="button" onClick={() => onNavigate(post.id)} className="mm-story-rail-card group text-left active:scale-[0.99] transition-transform">
            <div className="h-24 sm:h-28 overflow-hidden bg-slate-100 dark:bg-neutral-800">
                {chain[0] ? (
                    <img
                        src={chain[0]}
                        data-fallbacks={JSON.stringify(chain.slice(1))}
                        alt={post.title}
                        className="w-full h-full object-cover opacity-0 transition-all duration-700 group-hover:scale-105"
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
                                el.className = 'w-full h-full object-contain p-10 opacity-20 dark:invert dark:opacity-60';
                            }
                        }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <img src="/logo.svg" alt="" className="w-12 h-12 opacity-20 dark:invert dark:opacity-60" />
                    </div>
                )}
            </div>
            <div className="p-3.5">
                <div className="flex items-center gap-1.5 mb-1 text-[10px] font-black uppercase tracking-widest flex-wrap" style={{ color: 'var(--mm-brand)' }}>
                    <span>{post.author || 'MM Editor'}</span>
                    <span style={{ color: 'var(--mm-surface-border)' }}>•</span>
                    <span className="font-medium" style={{ color: 'var(--mm-text-tertiary)' }}>{formatDate(post.createdAt, locale)}</span>
                    {post.views > 0 && (
                        <>
                            <span style={{ color: 'var(--mm-surface-border)' }}>•</span>
                            <span className="font-medium normal-case flex items-center gap-1" style={{ color: 'var(--mm-text-tertiary)' }}>
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                {post.views.toLocaleString()}
                            </span>
                        </>
                    )}
                </div>
                <h3 className="text-[15px] sm:text-base font-black leading-tight line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" style={{ color: 'var(--mm-text-primary)', wordBreak: 'break-word' }}>{displayTitle}</h3>
                <p className="mm-story-museum-line mt-1 text-xs leading-relaxed line-clamp-1" style={{ wordBreak: 'break-word' }}>{museumLine}</p>
            </div>
        </button>
    );
}

function SmallStoryCard({ post, locale, onNavigate }: { post: any; locale: Locale; onNavigate: (id: string) => void }) {
    const { translations: cached } = useCachedTranslation('story', post.id, locale);
    const sourceTitle = post.titleEn || post.title || '';
    const liveTitle = useTranslatedText(sourceTitle, locale);
    const displayTitle = getDisplayStoryTitle(sanitizeAI(locale === 'ko'
        ? post.title
        : locale === 'en'
            ? (post.titleEn || post.title)
            : (cached.title || liveTitle || sourceTitle)), post.museums);
    const chain = getStoryImageChain(post);

    return (
        <button type="button" onClick={() => onNavigate(post.id)} className="mm-story-mini-card group text-left active:scale-[0.99] transition-transform">
            <div className="mm-story-mini-thumb">
                {chain[0] ? (
                    <img
                        src={chain[0]}
                        data-fallbacks={JSON.stringify(chain.slice(1))}
                        alt={post.title}
                        className="opacity-0 transition-all duration-500 group-hover:scale-105"
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
                                el.className = 'w-full h-full object-contain p-5 opacity-20 dark:invert dark:opacity-60';
                            }
                        }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <img src="/logo.svg" alt="" className="w-9 h-9 opacity-20 dark:invert dark:opacity-60" />
                    </div>
                )}
            </div>
            <div className="mm-story-mini-body">
                <div>
                    <span>{post.author || 'MM Editor'}</span>
                    <span> · </span>
                    <span>{formatDate(post.createdAt, locale)}</span>
                </div>
                <h3>{displayTitle}</h3>
            </div>
        </button>
    );
}

function BlogPageSkeleton({ locale }: { locale: Locale }) {
    return (
        <div className="no-back-swipe mm-editorial-page2 mm-library-page2 w-full max-w-[960px] mx-auto px-4 pt-4 sm:px-6 sm:pt-8 md:px-8 pb-32">
            <div className="mm-gallery-hero p-5 sm:p-7 mb-4 sm:mb-6">
                <div className="mm-skel-line w-20 mb-4 opacity-40" />
                <div className="mm-skel-line h-8 w-52 mb-3 opacity-50" />
                <div className="mm-skel-line w-64 opacity-40" />
                <div className="mt-5 flex gap-2 overflow-hidden">
                    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="mm-skel-pill w-24 opacity-40" />)}
                </div>
            </div>

            <div className="mm-section-heading">
                <h2>{locale === 'ko' ? '여기는 어때요?' : 'How about these?'}</h2>
                <span>{locale === 'ko' ? '불러오는 중' : 'Loading'}</span>
            </div>
            <div className="mm-rail-scroll flex gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="mm-actual-skeleton w-[240px] shrink-0">
                        <div className="mm-skel-block h-36 rounded-none" />
                        <div className="p-4">
                            <div className="mm-skel-line w-24 mb-3" />
                            <div className="mm-skel-line h-5 w-44 mb-2" />
                            <div className="mm-skel-line h-5 w-32 mb-3" />
                            <div className="mm-skel-line w-full" />
                        </div>
                    </div>
                ))}
            </div>

            <div className="mm-section-heading">
                <h2>{locale === 'ko' ? '새 이야기' : 'New stories'}</h2>
                <span>{locale === 'ko' ? '최근 발행' : 'Recent'}</span>
            </div>
            <div className="mm-list-surface">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="mm-list-row2">
                        <div className="mm-skel-block h-[72px] w-[84px] shrink-0" />
                        <div className="min-w-0 flex-1">
                            <div className="mm-skel-line w-32 mb-2" />
                            <div className="mm-skel-line h-5 w-11/12 mb-2" />
                            <div className="mm-skel-line w-2/3" />
                        </div>
                    </div>
                ))}
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

    const curatedPosts = useMemo(() => {
        const arr = [...filteredPosts];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr.slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredPosts.length, activeCategory]);
    const curatedIds = new Set(curatedPosts.map((post: any) => post.id));
    const freshPosts = [...filteredPosts]
        .filter((post: any) => !curatedIds.has(post.id))
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 4);

    if (loading) return <BlogPageSkeleton locale={locale} />;

    return (
        <div className="no-back-swipe mm-editorial-page2 mm-library-page2 w-full max-w-[960px] mx-auto px-4 pt-4 sm:px-6 sm:pt-8 md:px-8 pb-32 lg:pb-10">
            {navigating && <LoadingAnimation />}
            <div className="mm-gallery-hero p-5 sm:p-7 mb-4 sm:mb-6 animate-fadeInUp">
                <div className="mm-gallery-kicker mb-3">{locale === 'ko' ? 'Curated' : 'Curated'}</div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                    {t('blog.title', locale)}
                </h1>
                <p className="text-blue-100/80 mt-2 text-sm font-medium">
                    {t('blog.subtitle', locale)}
                </p>

                {/* Category Tabs — 전체 너비, SVG 아이콘 */}
                <div className="flex mt-5 gap-2 overflow-x-auto scrollbar-hide">
                    {CATEGORIES.map(cat => {
                        const isActive = activeCategory === cat.key;
                        return (
                            <button
                                key={cat.key}
                                onClick={() => handleCategoryChange(cat.key)}
                                className={`mm-gallery-chip ${isActive ? 'is-active' : ''}`}
                            >
                                {cat.icon}
                                <span>{CATEGORY_LABELS[cat.key]?.[locale] || CATEGORY_LABELS[cat.key]?.en}</span>
                            </button>
                        );
                    })}
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
                    {curatedPosts.length > 0 && (
                        <>
                            <div className="mm-section-heading">
                                <h2>{locale === 'ko' ? '여기는 어때요?' : 'How about these?'}</h2>
                                <span>{locale === 'ko' ? '랜덤 추천' : 'Random picks'}</span>
                            </div>
                            <div className="mm-rail-scroll stagger-children flex gap-3">
                                {curatedPosts.map((post: any) => (
                                    <StoryRailCard key={`curated-${post.id}`} post={post} locale={locale} onNavigate={handleNavigate} />
                                ))}
                            </div>
                        </>
                    )}

                    {freshPosts.length > 0 && (
                        <>
                            <div className="mm-section-heading">
                                <h2>{locale === 'ko' ? '새 이야기' : 'New stories'}</h2>
                                <span>{locale === 'ko' ? '최근 발행' : 'Recently published'}</span>
                            </div>
                            <div className="mm-story-mini-grid">
                                {freshPosts.map((post: any) => (
                                    <SmallStoryCard key={`fresh-${post.id}`} post={post} locale={locale} onNavigate={handleNavigate} />
                                ))}
                            </div>
                        </>
                    )}

                    <div className="mm-section-heading">
                        <h2>{locale === 'ko' ? '이야기 목록' : 'Story list'}</h2>
                        <div className="flex items-center gap-2">
                            <span>{sortedPosts.length.toLocaleString()} {locale === 'ko' ? '편' : 'stories'}</span>
                            <select
                                value={sortMode}
                                onChange={e => handleSortChange(e.target.value as SortMode)}
                                className="mm-gallery-chip cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                {(['random', 'newest', 'oldest', 'distance'] as SortMode[]).map(mode => (
                                    <option key={mode} value={mode}>{SORT_LABELS[mode]?.[locale] || SORT_LABELS[mode]?.en}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="mm-list-surface stagger-children">
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
