'use client';
import { useState, useEffect, useMemo, useDeferredValue, type CSSProperties } from 'react';
import { useApp } from '@/components/AppContext';
import { t, formatDate, type Locale } from '@/lib/i18n';
import { useCachedTranslation } from '@/hooks/useCachedTranslation';
import { useTranslatedText } from '@/hooks/useTranslation';
import { getMuseumImageSrc, isRenderableUrl } from '@/lib/getMuseumImage';
import { getLocalizedMuseumName } from '@/lib/getLocalizedName';
import { getDisplayStoryTitle } from '@/lib/storyTitle';
import * as gtag from '@/lib/gtag';
import EmptyStateGame from '@/components/ui/EmptyStateGame';

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

function containsKorean(text: string): boolean {
    return /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text);
}

function safeTranslatedStoryText(value: string | undefined, locale: Locale, fallback: string) {
    const text = value || '';
    if (locale !== 'ko' && containsKorean(text)) return fallback;
    return text || fallback;
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

function StoryMuseumMeta({ post, locale, className = '' }: { post: any; locale: Locale; className?: string }) {
    return (
        <p className={`mm-story-museum-line ${className}`}>
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M5.25 21V9.75L12 4.5l6.75 5.25V21M9 21v-6h6v6M8.25 10.5h.008v.008H8.25v-.008Zm3.75 0h.008v.008H12v-.008Zm3.75 0h.008v.008h-.008v-.008Z" />
            </svg>
            <span className="truncate">{getStoryMuseumLine(post, locale)}</span>
        </p>
    );
}

const STORY_CATEGORY_COLORS: Record<string, { color: string; bg: string; activeBg: string; darkBg: string; darkActiveBg: string; border: string; darkBorder: string }> = {
    ALL: { color: '#2563eb', bg: 'rgba(37, 99, 235, 0.10)', activeBg: 'rgba(37, 99, 235, 0.18)', darkBg: 'rgba(37, 99, 235, 0.16)', darkActiveBg: 'rgba(37, 99, 235, 0.28)', border: 'rgba(37, 99, 235, 0.38)', darkBorder: 'rgba(96, 165, 250, 0.42)' },
    TRAVEL: { color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.11)', activeBg: 'rgba(14, 165, 233, 0.20)', darkBg: 'rgba(14, 165, 233, 0.16)', darkActiveBg: 'rgba(14, 165, 233, 0.28)', border: 'rgba(14, 165, 233, 0.40)', darkBorder: 'rgba(56, 189, 248, 0.42)' },
    ART: { color: '#db2777', bg: 'rgba(219, 39, 119, 0.10)', activeBg: 'rgba(219, 39, 119, 0.18)', darkBg: 'rgba(219, 39, 119, 0.15)', darkActiveBg: 'rgba(219, 39, 119, 0.27)', border: 'rgba(219, 39, 119, 0.36)', darkBorder: 'rgba(244, 114, 182, 0.40)' },
    MUSEUM: { color: '#4f46e5', bg: 'rgba(79, 70, 229, 0.10)', activeBg: 'rgba(79, 70, 229, 0.18)', darkBg: 'rgba(99, 102, 241, 0.15)', darkActiveBg: 'rgba(99, 102, 241, 0.27)', border: 'rgba(79, 70, 229, 0.36)', darkBorder: 'rgba(129, 140, 248, 0.40)' },
    SPECIAL: { color: '#b45309', bg: 'rgba(245, 158, 11, 0.13)', activeBg: 'rgba(245, 158, 11, 0.22)', darkBg: 'rgba(245, 158, 11, 0.15)', darkActiveBg: 'rgba(245, 158, 11, 0.27)', border: 'rgba(245, 158, 11, 0.40)', darkBorder: 'rgba(251, 191, 36, 0.42)' },
};

function getStoryCategoryKey(category?: string) {
    return (category || 'MUSEUM').toUpperCase();
}

function getStoryCategoryLabel(category: string | undefined, locale: Locale) {
    const key = getStoryCategoryKey(category);
    const labels = CATEGORY_LABELS[key] || CATEGORY_LABELS.MUSEUM;
    return labels[locale] || (locale.startsWith('zh') ? labels.zh : undefined) || labels.en || key;
}

function getStoryCategoryStyle(category?: string): CSSProperties {
    const key = getStoryCategoryKey(category);
    const color = STORY_CATEGORY_COLORS[key] || STORY_CATEGORY_COLORS.MUSEUM;
    return {
        '--story-category-color': color.color,
        '--story-category-bg': color.bg,
        '--story-category-active-bg': color.activeBg,
        '--story-category-dark-bg': color.darkBg,
        '--story-category-dark-active-bg': color.darkActiveBg,
        '--story-category-border': color.border,
        '--story-category-dark-border': color.darkBorder,
    } as CSSProperties;
}

function getStoryCategoryColors(category?: string) {
    const key = getStoryCategoryKey(category);
    return STORY_CATEGORY_COLORS[key] || STORY_CATEGORY_COLORS.MUSEUM;
}

function storyCategoryTagStyle(category?: string): CSSProperties {
    const color = getStoryCategoryColors(category);
    return {
        ...getStoryCategoryStyle(category),
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 6,
        display: 'inline-flex',
        minHeight: 20,
        maxWidth: 'calc(100% - 16px)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 7px',
        borderRadius: 999,
        border: `1px solid ${color.border}`,
        background: '#ffffff',
        color: color.color,
        fontSize: 10,
        fontWeight: 760,
        lineHeight: 1,
        letterSpacing: 0,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
        backdropFilter: 'blur(10px) saturate(150%)',
        WebkitBackdropFilter: 'blur(10px) saturate(150%)',
    };
}

function storyCategoryFilterStyle(category: string, active: boolean): CSSProperties {
    const color = getStoryCategoryColors(category);
    return {
        ...getStoryCategoryStyle(category),
        color: active ? '#ffffff' : color.color,
        borderColor: active ? 'transparent' : color.border,
        background: active ? color.color : color.bg,
        opacity: active ? 1 : 0.72,
        boxShadow: active
            ? 'inset 0 0 0 1px rgba(255,255,255,0.18), 0 12px 28px rgba(15,23,42,0.12)'
            : `inset 0 0 0 1px ${color.border}, 0 8px 18px rgba(15,23,42,0.025)`,
    };
}

function StoryCategoryTag({ category, locale }: { category?: string; locale: Locale }) {
    return (
        <span
            className="mm-story-category-tag"
            style={storyCategoryTagStyle(category)}
        >
            {getStoryCategoryLabel(category, locale)}
        </span>
    );
}

function StoryCategoryInlineTag({ category, locale }: { category?: string; locale: Locale }) {
    const style = getStoryCategoryStyle(category) as CSSProperties & Record<string, string>;
    return (
        <span
            className="mm-story-category-inline-tag"
            style={style}
        >
            {getStoryCategoryLabel(category, locale)}
        </span>
    );
}

const STORY_SECTION_LABELS: Record<string, {
    curated: string;
    fresh: string;
    list: string;
    count: string;
    loading: string;
}> = {
    ko: { curated: '여기는 어때요?', fresh: '새 이야기', list: '이야기 목록', count: '편', loading: '불러오는 중' },
    en: { curated: 'How about these?', fresh: 'New stories', list: 'Story list', count: 'stories', loading: 'Loading' },
    ja: { curated: 'ここはどうですか？', fresh: '新しいストーリー', list: 'ストーリー一覧', count: '件', loading: '読み込み中' },
    de: { curated: 'Wie wäre es hier?', fresh: 'Neue Geschichten', list: 'Geschichten', count: 'Stories', loading: 'Wird geladen' },
    fr: { curated: 'Et ces lieux ?', fresh: 'Nouvelles histoires', list: 'Liste des histoires', count: 'histoires', loading: 'Chargement' },
    es: { curated: '¿Qué tal estos?', fresh: 'Nuevas historias', list: 'Lista de historias', count: 'historias', loading: 'Cargando' },
    pt: { curated: 'Que tal estes?', fresh: 'Novas histórias', list: 'Lista de histórias', count: 'histórias', loading: 'Carregando' },
    'zh-CN': { curated: '这里怎么样？', fresh: '新故事', list: '故事列表', count: '篇', loading: '加载中' },
    'zh-TW': { curated: '這裡怎麼樣？', fresh: '新故事', list: '故事列表', count: '篇', loading: '載入中' },
    da: { curated: 'Hvad med disse?', fresh: 'Nye historier', list: 'Historieliste', count: 'historier', loading: 'Indlæser' },
    fi: { curated: 'Entä nämä?', fresh: 'Uudet tarinat', list: 'Tarinat', count: 'tarinaa', loading: 'Ladataan' },
    sv: { curated: 'Vad sägs om dessa?', fresh: 'Nya berättelser', list: 'Berättelselista', count: 'berättelser', loading: 'Laddar' },
    et: { curated: 'Kuidas oleks nendega?', fresh: 'Uued lood', list: 'Lugude nimekiri', count: 'lugu', loading: 'Laadimine' },
};

const STORY_SEARCH_LABELS: Record<string, { placeholder: string; results: string; empty: string; count: string }> = {
    ko: { placeholder: '스토리, 미술관, 도시 검색', results: '검색 결과', empty: '일치하는 스토리가 없어요', count: '개 결과' },
    en: { placeholder: 'Search stories, museums, cities...', results: 'Search results', empty: 'No matching stories', count: 'results' },
    ja: { placeholder: 'ストーリー・美術館・都市を検索...', results: '検索結果', empty: '一致するストーリーはありません', count: '件' },
    de: { placeholder: 'Stories, Museen, Städte suchen...', results: 'Suchergebnisse', empty: 'Keine passenden Geschichten', count: 'Ergebnisse' },
    fr: { placeholder: 'Rechercher histoires, musées, villes...', results: 'Résultats', empty: 'Aucune histoire correspondante', count: 'résultats' },
    es: { placeholder: 'Buscar historias, museos, ciudades...', results: 'Resultados', empty: 'No hay historias coincidentes', count: 'resultados' },
    pt: { placeholder: 'Pesquisar histórias, museus, cidades...', results: 'Resultados', empty: 'Nenhuma história encontrada', count: 'resultados' },
    'zh-CN': { placeholder: '搜索故事、博物馆、城市...', results: '搜索结果', empty: '没有匹配的故事', count: '条结果' },
    'zh-TW': { placeholder: '搜尋故事、博物館、城市...', results: '搜尋結果', empty: '沒有符合的故事', count: '筆結果' },
    da: { placeholder: 'Søg historier, museer, byer...', results: 'Søgeresultater', empty: 'Ingen matchende historier', count: 'resultater' },
    fi: { placeholder: 'Hae tarinoita, museoita, kaupunkeja...', results: 'Hakutulokset', empty: 'Ei osuvia tarinoita', count: 'tulosta' },
    sv: { placeholder: 'Sök berättelser, museer, städer...', results: 'Sökresultat', empty: 'Inga matchande berättelser', count: 'resultat' },
    et: { placeholder: 'Otsi lugusid, muuseume, linnu...', results: 'Otsingutulemused', empty: 'Sobivaid lugusid ei leitud', count: 'tulemust' },
};

function getStorySearchTitle(post: any, locale: Locale) {
    return getDisplayStoryTitle(sanitizeAI(locale === 'ko' ? post.title : (post.titleEn || post.title)), post.museums);
}

function getStorySearchText(post: any, locale: Locale) {
    const museums = post.museums?.map((item: any) => item?.museum).filter(Boolean) || [];
    const museumText = museums.flatMap((museum: any) => [
        getLocalizedMuseumName(museum, locale),
        museum.name,
        museum.nameKo,
        museum.nameEn,
        museum.city,
        museum.country,
    ]);
    return [
        post.title,
        post.titleEn,
        post.author,
        post.category,
        post.summary,
        post.excerpt,
        post.description,
        getStoryCategoryLabel(post.category, locale),
        ...museumText,
    ].filter(Boolean).join(' ').toLowerCase();
}

function StorySearchResult({ post, locale, onNavigate }: { post: any; locale: Locale; onNavigate: (id: string) => void }) {
    const chain = getStoryImageChain(post);
    return (
        <a
            href={`/blog/${post.id}`}
            onClick={() => onNavigate(post.id)}
            className="mm-story-search-result mm-map2-search-result w-full text-left px-4 py-3 transition-colors border-b last:border-0 flex items-center gap-3"
        >
            <div className="mm-map2-search-result-thumb w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                {chain[0] ? (
                    <img src={chain[0]} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <img src="/logo.svg" alt="" className="w-5 h-5 opacity-20 dark:invert dark:opacity-60" />
                    </div>
                )}
            </div>
            <div className="min-w-0 flex-1">
                <span className="mm-map2-search-result-title truncate">{getStorySearchTitle(post, locale)}</span>
                <div className="mm-map2-search-result-subtitle truncate">{getStoryMuseumLine(post, locale)}</div>
            </div>
        </a>
    );
}

function BlogCard({ post, locale, onNavigate }: { post: any; locale: Locale; onNavigate: (id: string) => void }) {
    // DB-cached translations for non-ko/en
    const { translations: cached } = useCachedTranslation('story', post.id, locale);
    const sourceTitle = post.titleEn || post.title || '';
    const liveTitle = useTranslatedText(sourceTitle, locale);

    let displayTitle: string;

    if (locale === 'ko') {
        displayTitle = getDisplayStoryTitle(sanitizeAI(post.title), post.museums);
    } else if (locale === 'en') {
        displayTitle = getDisplayStoryTitle(sanitizeAI(post.titleEn || post.title), post.museums);
    } else if (cached.title) {
        displayTitle = getDisplayStoryTitle(sanitizeAI(cached.title), post.museums);
    } else {
        displayTitle = getDisplayStoryTitle(sanitizeAI(safeTranslatedStoryText(liveTitle || sourceTitle, locale, STORY_SECTION_LABELS[locale]?.loading || STORY_SECTION_LABELS.en.loading)), post.museums);
    }
    const chain = getStoryImageChain(post);
    return (
        <a
            href={`/blog/${post.id}`}
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
                        loading="lazy"
                        decoding="async"
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
                                el.className = 'mm-empty-logo m-auto object-contain dark:invert';
                            }
                        }}
                    />
                ) : (
                    <div className="mm-story-empty-thumb w-full h-full flex items-center justify-center">
                        <img src="/logo.svg" alt="" className="mm-empty-logo dark:invert" />
                    </div>
                )}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 text-[10px] font-black uppercase tracking-widest flex-wrap" style={{ color: 'var(--mm-brand)' }}>
                    <StoryCategoryInlineTag category={post.category} locale={locale} />
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
                <h2 className="text-[16px] sm:text-[17px] font-black mb-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate" style={{ color: 'var(--mm-text-primary)', wordBreak: 'normal' }}>
                    {displayTitle}
                </h2>
                <StoryMuseumMeta post={post} locale={locale} className="text-xs leading-relaxed" />
            </div>
        </a>
    );
}

function StoryRailCard({ post, locale, onNavigate }: { post: any; locale: Locale; onNavigate: (id: string) => void }) {
    const { translations: cached } = useCachedTranslation('story', post.id, locale);
    const sourceTitle = post.titleEn || post.title || '';
    const liveTitle = useTranslatedText(sourceTitle, locale);
    const displayTitle = getDisplayStoryTitle(sanitizeAI(locale === 'ko'
        ? post.title
        : locale === 'en'
            ? (post.titleEn || post.title)
            : safeTranslatedStoryText(cached.title || liveTitle || sourceTitle, locale, STORY_SECTION_LABELS[locale]?.loading || STORY_SECTION_LABELS.en.loading)), post.museums);
    const chain = getStoryImageChain(post);

    return (
        <a href={`/blog/${post.id}`} onClick={() => onNavigate(post.id)} className="mm-story-rail-card group text-left active:scale-[0.99] transition-transform">
            <div className="relative h-24 sm:h-28 overflow-hidden bg-slate-100 dark:bg-neutral-800">
                <StoryCategoryTag category={post.category} locale={locale} />
                {chain[0] ? (
                    <img
                        src={chain[0]}
                        data-fallbacks={JSON.stringify(chain.slice(1))}
                        alt={post.title}
                        className="w-full h-full object-cover opacity-0 transition-all duration-700 group-hover:scale-105"
                        loading="lazy"
                        decoding="async"
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
                                el.className = 'mm-empty-logo m-auto object-contain dark:invert';
                            }
                        }}
                    />
                ) : (
                    <div className="mm-story-empty-thumb w-full h-full flex items-center justify-center">
                        <img src="/logo.svg" alt="" className="mm-empty-logo dark:invert" />
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
                <h3 className="mm-story-two-line-title text-[16px] sm:text-[17px] font-black leading-tight line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" style={{ color: 'var(--mm-text-primary)', wordBreak: 'break-word' }}>{displayTitle}</h3>
                <StoryMuseumMeta post={post} locale={locale} className="mt-1 text-xs leading-relaxed" />
            </div>
        </a>
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
            : safeTranslatedStoryText(cached.title || liveTitle || sourceTitle, locale, STORY_SECTION_LABELS[locale]?.loading || STORY_SECTION_LABELS.en.loading)), post.museums);
    const chain = getStoryImageChain(post);

    return (
        <a href={`/blog/${post.id}`} onClick={() => onNavigate(post.id)} className="mm-story-mini-card group text-left active:scale-[0.99] transition-transform">
            <div className="mm-story-mini-thumb relative">
                <StoryCategoryTag category={post.category} locale={locale} />
                {chain[0] ? (
                    <img
                        src={chain[0]}
                        data-fallbacks={JSON.stringify(chain.slice(1))}
                        alt={post.title}
                        className="opacity-0 transition-all duration-500 group-hover:scale-105"
                        loading="lazy"
                        decoding="async"
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
                                el.className = 'mm-empty-logo m-auto object-contain dark:invert';
                            }
                        }}
                    />
                ) : (
                    <div className="mm-story-empty-thumb w-full h-full flex items-center justify-center">
                        <img src="/logo.svg" alt="" className="mm-empty-logo dark:invert" />
                    </div>
                )}
            </div>
            <div className="mm-story-mini-body">
                <div>
                    <span className="mm-story-author">{post.author || 'MM Editor'}</span>
                    <span> · </span>
                    <span>{formatDate(post.createdAt, locale)}</span>
                </div>
                <h3 className="mm-story-two-line-title">{displayTitle}</h3>
                <StoryMuseumMeta post={post} locale={locale} className="mt-1.5 text-[11px] leading-snug" />
            </div>
        </a>
    );
}

function BlogPageSkeleton() {
    return (
        <div data-mm-page="blog" className="no-back-swipe mm-editorial-page2 mm-library-page2 w-full max-w-[960px] mx-auto px-4 pt-4 sm:px-6 sm:pt-8 md:px-8 pb-32">
            <div className="mm-gallery-hero p-5 sm:p-7 mb-5 sm:mb-6">
                <div className="mm-skel-line w-20 mb-4 opacity-40" />
                <div className="mm-skel-line h-8 w-52 mb-3 opacity-50" />
                <div className="mm-skel-line w-64 opacity-40" />
                <div className="mt-5 flex gap-2 overflow-hidden">
                    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="mm-skel-pill w-24 opacity-40" />)}
                </div>
            </div>

            <div className="mb-5">
                <div className="mm-skel-pill h-12 w-full" />
            </div>

            <div className="mm-section-heading">
                <div className="mm-skel-line h-5 w-28" />
                <div className="mm-skel-line w-16" />
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
                <div className="mm-skel-line h-5 w-24" />
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
const STORY_RETURN_TO_KEY = 'mm-story-return-to';
const BLOG_LIST_CACHE_KEY = 'mm-blog-list-cache-v2';
const BLOG_LIST_CACHE_TTL_MS = 5 * 60 * 1000;

export default function BlogListPage() {
    const { locale } = useApp();
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [activeCategory, setActiveCategory] = useState<string>('ALL');
    const [sortMode, setSortMode] = useState<SortMode>('random');
    const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const sectionLabels = STORY_SECTION_LABELS[locale] || STORY_SECTION_LABELS.en;
    const searchLabels = STORY_SEARCH_LABELS[locale] || STORY_SEARCH_LABELS.en;
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
            sessionStorage.setItem(STORY_RETURN_TO_KEY, `${window.location.pathname}${window.location.search}`);
        } catch { }
    };

    useEffect(() => {
        const restoreListState = () => {
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
                const savedCat = sessionStorage.getItem(CAT_KEY);
                if (savedCat) { setActiveCategory(savedCat); sessionStorage.removeItem(CAT_KEY); }
                const savedSort = sessionStorage.getItem(SORT_KEY);
                if (savedSort) { setSortMode(savedSort as SortMode); sessionStorage.removeItem(SORT_KEY); }
            } catch { }
        };

        try {
            const cached = JSON.parse(sessionStorage.getItem(BLOG_LIST_CACHE_KEY) || 'null');
            if (cached && Date.now() - cached.ts < BLOG_LIST_CACHE_TTL_MS && Array.isArray(cached.posts)) {
                setPosts(cached.posts);
                setLoading(false);
                restoreListState();
                return;
            }
        } catch { }

        fetch('/api/blog?view=list', { cache: 'force-cache' })
            .then(res => res.json())
            .then(data => {
                if (data.data) {
                    const published = data.data.filter((p: any) => p.status === 'PUBLISHED');
                    setPosts(published);
                    try {
                        sessionStorage.setItem(BLOG_LIST_CACHE_KEY, JSON.stringify({ ts: Date.now(), posts: published }));
                    } catch { }
                }
                setLoading(false);
                restoreListState();
            })
            .catch(() => setLoading(false));
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

    const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase();
    const categoryFilteredPosts = useMemo(
        () => activeCategory === 'ALL' ? posts : posts.filter(p => (p.category || 'MUSEUM') === activeCategory),
        [activeCategory, posts],
    );
    const searchFilteredPosts = useMemo(() => {
        if (!normalizedSearchQuery) return posts;
        const tokens = normalizedSearchQuery.split(/\s+/).filter(Boolean);
        return posts.filter(post => {
            const haystack = getStorySearchText(post, locale);
            return tokens.every(token => haystack.includes(token));
        });
    }, [locale, normalizedSearchQuery, posts]);
    const searchResults = normalizedSearchQuery ? searchFilteredPosts.slice(0, 8) : [];
    const filteredPosts = normalizedSearchQuery ? searchFilteredPosts : categoryFilteredPosts;

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
    }, [filteredPosts, sortMode, userLocation]);

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
        return arr.slice(0, 5);
    }, [filteredPosts]);
    const curatedIds = new Set(curatedPosts.map((post: any) => post.id));
    const freshPosts = [...filteredPosts]
        .filter((post: any) => !curatedIds.has(post.id))
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 4);

    if (loading) return <BlogPageSkeleton />;

    return (
        <div data-mm-page="blog" className="no-back-swipe mm-editorial-page2 mm-library-page2 w-full max-w-[960px] mx-auto px-4 pt-4 sm:px-6 sm:pt-8 md:px-8 pb-32 lg:pb-10">
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
                                onClick={(e) => { e.currentTarget.blur(); handleCategoryChange(cat.key); }}
                                className={`mm-gallery-chip mm-story-category-chip ${isActive ? 'is-active' : ''}`}
                                style={storyCategoryFilterStyle(cat.key, isActive)}
                            >
                                {cat.icon}
                                <span>{getStoryCategoryLabel(cat.key, locale)}</span>
                            </button>
                        );
                    })}
                </div>

            </div>

            {posts.length > 0 && (
                <div className="relative mb-5">
                    <div className={`mm-map2-search relative flex h-[58px] items-center gap-2.5 rounded-full px-[18px] transition-all ${isSearchFocused ? 'is-focused' : ''}`}>
                        <svg className="w-5 h-5 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(1);
                            }}
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => setIsSearchFocused(false)}
                            placeholder={searchLabels.placeholder}
                            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-gray-800 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-blue-100/50"
                        />
                        {searchQuery && (
                            <button type="button" onClick={() => { setSearchQuery(''); setPage(1); }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white" aria-label={locale === 'ko' ? '검색어 지우기' : 'Clear search'}>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        )}
                    </div>
                    {normalizedSearchQuery && (
                        <div className="mm-story-search-results mt-2 rounded-2xl overflow-hidden border border-slate-200/80 bg-white/96 shadow-lg backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/94">
                            <div className="flex items-center justify-between px-4 py-2 text-[11px] font-semibold text-slate-500 dark:text-neutral-400">
                                <span>{searchLabels.results}</span>
                                <span>{searchFilteredPosts.length.toLocaleString()} {searchLabels.count}</span>
                            </div>
                            {searchResults.length > 0 ? (
                                searchResults.map((post: any) => (
                                    <StorySearchResult key={`story-search-${post.id}`} post={post} locale={locale} onNavigate={handleNavigate} />
                                ))
                            ) : (
                                <div className="px-4 py-5 text-center text-sm font-medium text-slate-500 dark:text-neutral-400">{searchLabels.empty}</div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {posts.length === 0 ? (
                <EmptyStateGame
                    locale={locale}
                    title={t('blog.empty', locale)}
                    description={t('blog.emptyDesc', locale)}
                />
            ) : (
                <>
                    {curatedPosts.length > 0 && (
                        <>
                            <div className="mm-section-heading">
                                <h2>{sectionLabels.curated}</h2>
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
                                <h2>{sectionLabels.fresh}</h2>
                            </div>
                            <div className="mm-story-mini-grid">
                                {freshPosts.map((post: any) => (
                                    <SmallStoryCard key={`fresh-${post.id}`} post={post} locale={locale} onNavigate={handleNavigate} />
                                ))}
                            </div>
                        </>
                    )}

                    <div className="mm-section-heading">
                        <h2>{sectionLabels.list}</h2>
                        <div className="flex items-center gap-2">
                            <span>{sortedPosts.length.toLocaleString()} {sectionLabels.count}</span>
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
                                const end = Math.min(totalPages, start + maxVisible - 1);
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
