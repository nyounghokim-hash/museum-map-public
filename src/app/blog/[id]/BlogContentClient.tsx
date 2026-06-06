'use client';
import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslatedText, useTranslatedTexts } from '@/hooks/useTranslation';
import { useCachedTranslation } from '@/hooks/useCachedTranslation';
import { useApp } from '@/components/AppContext';
import { formatDate, t, type Locale } from '@/lib/i18n';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { buildShareUrl } from '@/lib/utm';
import { getLocalizedMuseumName } from '@/lib/getLocalizedName';
import { getLocalizedArtworkTitle, getLocalizedArtistName } from '@/lib/getLocalizedName';
import { getMuseumImageSrc } from '@/lib/getMuseumImage';
import { getDisplayStoryTitle } from '@/lib/storyTitle';
import { translateViLabel, translateViValue } from '@/lib/visitorInfoI18n';
import ReportModal from '@/components/ui/ReportModal';


/**
 * AI 특유의 마크다운/포맷 표현을 자연스러운 텍스트로 변환
 */
function sanitizeAIContent(text: string): string {
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

function sanitizeAIHtml(html: string): string {
    if (!html) return html;
    return html
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/''([^']*)''/g, '$1')
        .replace(/\u201C([^\u201D]*)\u201D/g, '$1')
        .replace(/\u300C([^\u300D]*)\u300D/g, '$1')
        .replace(/\u300E([^\u300F]*)\u300F/g, '$1');
}

/**
 * 본문 첫 번째 <h2>가 페이지 제목(h1)과 동일하거나 유사하면 제거
 * - 완전 일치 또는 정규화 후 80% 이상 일치 시 제거
 */
function removeLeadingDuplicateH2(html: string, pageTitle: string): string {
    if (!html || !pageTitle) return html;
    const normalize = (s: string) => s.replace(/<[^>]+>/g, '').trim().toLowerCase();
    const titleNorm = normalize(pageTitle);
    return html.replace(/^(\s*<h2[^>]*>)([\s\S]*?)(<\/h2>)/, (match, open, inner, close) => {
        const innerNorm = normalize(inner);
        if (!innerNorm) return match;
        // 완전 일치 또는 한쪽이 다른 쪽을 포함
        if (innerNorm === titleNorm || titleNorm.includes(innerNorm) || innerNorm.includes(titleNorm)) {
            return '';
        }
        return match;
    });
}

function InfoTable({ data, locale }: { data: any[]; locale: string }) {
    const handleShare = async () => {
        const url = buildShareUrl(window.location.href);
        const title = document.title;
        if (navigator.share) {
            try { await navigator.share({ title, url }); } catch { }
        } else {
            await navigator.clipboard.writeText(url);
            alert(locale === 'ko' ? '공유 링크를 복사했어요' : 'Link copied');
        }
    };

    if (!data || data.length === 0) return null;
    return (
        <div className="mt-10">
            <h2 className="mm-section-title">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                <span>{t('blog.visitorInfo', locale as Locale)}</span>
            </h2>
            <div className="mm-info-table">
                <table>
                    <tbody>
                        {data.map((row: any, i: number) => (
                            <tr key={i}>
                                <td>{translateViLabel(row.label, locale)}</td>
                                <td>{translateViValue(row.value, locale)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function SafeImage({ src, alt, className }: { src: string; alt: string; className: string; fallbackIcon?: string }) {
    const [error, setError] = useState(false);
    if (!src || error) {
        return (
            <div className={`${className} flex items-center justify-center bg-gray-100 dark:bg-neutral-800`}>
                <img src="/logo.svg" alt="" className="w-12 h-12 opacity-20 dark:invert dark:opacity-60" />
            </div>
        );
    }
    return <img src={src} alt={alt} className={className} onError={() => setError(true)} />;
}

/* ─── Artwork Detail Bottom Sheet ─── */
function ArtworkModal({ work, onClose, translations, locale }: { work: any; onClose: () => void; translations: Map<string, string>; locale: string }) {
    if (!work) return null;
    return (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-backdropIn" />
            {/* Bottom Sheet */}
            <div
                className="relative w-full max-w-3xl max-h-[85vh] bg-white dark:bg-neutral-900 rounded-t-3xl overflow-hidden shadow-2xl animate-slideUp"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-gray-300 dark:bg-neutral-600 rounded-full" />
                </div>

                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-3 right-4 z-10 w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-all active:scale-95"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div className="overflow-y-auto max-h-[80vh]">
                    {/* Image */}
                    <div className="w-full aspect-[16/9] bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                        {work.image ? (
                            <img
                                src={work.image}
                                alt={work.title || ''}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.currentTarget.src = '/logo.svg'; e.currentTarget.className = 'w-full h-full object-contain p-12 opacity-20 dark:invert dark:opacity-60'; }}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <img src="/logo.svg" alt="" className="w-12 h-12 opacity-20 dark:invert dark:opacity-60" />
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="p-6 pb-10">
                        {work.artist && (
                            <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">
                                {getLocalizedArtistName(work, locale) || work.artist}
                            </p>
                        )}
                        <h3 className="font-extrabold text-lg dark:text-white leading-tight mb-3">
                            {getLocalizedArtworkTitle(work, locale)}
                        </h3>
                        {work.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                {translations.get(work.description) || work.description}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ArtworkCards({ data, locale }: { data: any[]; locale: string }) {
    const allTexts = data ? data.flatMap((w: any) => [w.title || '', w.description || '']) : [];
    const translations = useTranslatedTexts(allTexts, locale as Locale);
    const [selectedWork, setSelectedWork] = useState<any>(null);
    const router = useRouter();

    if (!data || data.length === 0) return null;
    return (
        <div className="mt-10">
            <h2 className="mm-section-title">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                </svg>
                <span>{t('blog.featuredWorks', locale as Locale)}</span>
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 snap-x snap-mandatory scrollbar-hide">
                {data.map((work: any, i: number) => (
                    <div
                        key={i}
                        className="mm-card min-w-[260px] max-w-[280px] flex-shrink-0 snap-start group cursor-pointer"
                        onClick={() => work.id ? router.push(`/artworks/${work.id}`) : setSelectedWork(work)}
                    >
                        <div className="h-[180px] overflow-hidden" style={{ background: 'var(--mm-surface-secondary)' }}>
                            <SafeImage
                                src={work.image}
                                alt={work.title || ''}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                        </div>
                        <div className="p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--mm-brand)' }}>
                                {getLocalizedArtistName(work, locale) || work.artist}
                            </p>
                            <h3 className="font-bold text-xs leading-tight mb-2" style={{ color: 'var(--mm-text-primary)' }}>
                                {getLocalizedArtworkTitle(work, locale)}
                            </h3>
                            {work.description && (
                                <p className="text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--mm-text-secondary)' }}>
                                    {translations.get(work.description) || work.description}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Artwork Detail Modal */}
            {selectedWork && (
                <ArtworkModal
                    work={selectedWork}
                    onClose={() => setSelectedWork(null)}
                    translations={translations}
                    locale={locale}
                />
            )}
        </div>
    );
}

function RelatedMuseums({ museums, locale }: { museums: any[]; locale: string }) {
    const [showAll, setShowAll] = useState(false);
    if (!museums || museums.length === 0) return null;
    const VISIBLE = 2;
    const visibleMuseums = showAll ? museums : museums.slice(0, VISIBLE);
    const hasMore = museums.length > VISIBLE;
    return (
        <div className="mb-6 -mx-6 sm:-mx-10 md:-mx-12 px-6 sm:px-10 md:px-12">
            <div className="flex items-start gap-2">
                <div className="flex flex-wrap gap-2 flex-1">
                    {visibleMuseums.map((m: any) => {
                        const imageSrc = getMuseumImageSrc(m);
                        return (
                            <div key={m.id} className="inline-flex items-center gap-0">
                                <Link href={`/museums/${m.id}`} className="mm-museum-chip group">
                                {imageSrc ? (
                                    <SafeImage src={imageSrc} alt={m.name} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                                ) : (
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--mm-brand-bg)' }}>
                                        <svg className="w-4 h-4" style={{ color: 'var(--mm-brand-light)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                    </div>
                                )}
                                <span>{getLocalizedMuseumName(m, locale)}</span>
                                <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform flex-shrink-0" style={{ color: 'var(--mm-brand-light)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                            </Link>
                        </div>
                    );
                    })}
                    {/* 더보기 / 접기 버튼 */}
                    {hasMore && (
                        <button
                            onClick={() => setShowAll(prev => !prev)}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-dashed border-blue-200 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/25 transition-all text-xs font-bold text-blue-500 dark:text-blue-400 active:scale-95"
                        >
                            {showAll ? (
                                <>
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                                    {locale === 'ko' ? '접기' : locale === 'ja' ? '閉じる' : 'Less'}
                                </>
                            ) : (
                                <>
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                    {locale === 'ko' ? `+${museums.length - VISIBLE}개 더보기` : locale === 'ja' ? `+${museums.length - VISIBLE}件` : `+${museums.length - VISIBLE} more`}
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function BlogContentClient({ post, serverLocale }: { post: any; serverLocale: string }) {
    const { locale } = useApp();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const effectiveLocale = locale || serverLocale;
    const [isExiting, setIsExiting] = useState(false);
    const [isFromBack, setIsFromBack] = useState(false);
    const fromMuseum = searchParams.get('fromMuseum');
    const fromMap = searchParams.get('fromMap') === '1';
    const backHref = fromMuseum && /^[A-Za-z0-9_-]+$/.test(fromMuseum) ? `/museums/${fromMuseum}` : null;

    // Check if we arrived via back navigation
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const backTs = sessionStorage.getItem('navigating-back');
            if (backTs && Date.now() - parseInt(backTs) < 500) {
                setIsFromBack(true);
            }
            sessionStorage.removeItem('navigating-back');

            // 외부 링크/직접 진입이면 history에 맵을 미리 넣어
            // 뒤로가기 시 사이트 외부로 나가지 않고 맵으로 이동하도록.
            try {
                const ref = document.referrer;
                const sameOrigin = !!ref && new URL(ref).origin === window.location.origin;
                if (!sameOrigin && !sessionStorage.getItem('back-anchor-set')) {
                    const here = window.location.pathname + window.location.search;
                    window.history.replaceState({ backAnchor: true }, '', '/');
                    window.history.pushState({ detail: true }, '', here);
                    sessionStorage.setItem('back-anchor-set', '1');
                }
            } catch { /* ignore */ }
        }
    }, []);

    const handleBack = useCallback(() => {
        setIsExiting(true);
        if (typeof window !== 'undefined') sessionStorage.setItem('navigating-back', String(Date.now()));
        setTimeout(() => {
            if (fromMap) {
                router.replace('/');
            } else if (backHref) {
                router.replace(backHref);
            } else {
                router.replace('/blog');
            }
        }, 200);
    }, [backHref, fromMap, router]);

    const handleShare = useCallback(async () => {
        const url = buildShareUrl(window.location.href);
        if (navigator.share) {
            try { await navigator.share({ title: document.title, url }); } catch { }
        } else {
            await navigator.clipboard.writeText(url);
        }
    }, []);

    // DB-cached translation for non-ko/en locales
    const { translations: cached } = useCachedTranslation('story', post.id, effectiveLocale);
    const sourceTitle = post.titleEn || post.title || '';
    const sourceContent = (post.contentEn || post.content || '').replace(/<[^>]*>/g, '');
    const liveTitle = useTranslatedText(sourceTitle, effectiveLocale);
    const liveContent = useTranslatedText(sourceContent, effectiveLocale);

    // Determine display content
    const hasEnglish = !!post.titleEn;
    const isKoOrEn = effectiveLocale === 'ko' || effectiveLocale === 'en';

    let displayTitle: string;
    let displayContent: string;
    let isHtml = true;

    if (effectiveLocale === 'ko') {
        displayTitle = getDisplayStoryTitle(sanitizeAIContent(post.title), post.museums);
        displayContent = removeLeadingDuplicateH2(sanitizeAIHtml(post.content), post.title);
    } else if (effectiveLocale === 'en') {
        displayTitle = getDisplayStoryTitle(sanitizeAIContent(post.titleEn || post.title), post.museums);
        displayContent = removeLeadingDuplicateH2(sanitizeAIHtml(post.contentEn || post.content), post.titleEn || post.title);
    } else if (cached.title) {
        displayTitle = getDisplayStoryTitle(sanitizeAIContent(cached.title), post.museums);
        displayContent = cached.content ? sanitizeAIContent(cached.content) : sanitizeAIHtml((post.contentEn || post.content).replace(/<[^>]*>/g, ''));
        isHtml = !cached.content;
    } else {
        displayTitle = getDisplayStoryTitle(sanitizeAIContent(liveTitle || sourceTitle), post.museums);
        displayContent = sanitizeAIContent(liveContent || sourceContent);
        isHtml = false;
    }

    const [reportOpen, setReportOpen] = useState(false);

    const [previewError, setPreviewError] = useState(false);
    const showBackControls = pathname?.startsWith('/blog/') && pathname !== '/blog';

    return (
        <div className={`mm-editorial-page2 mm-story-detail-page2 w-full lg:max-w-[1180px] mx-auto lg:px-8 ${isExiting ? 'page-slide-out' : isFromBack ? 'page-slide-in-back' : 'page-slide-in'}`}>
            {/* Preview Image with fallback */}
            <div className="mm-detail-hero2 mm-story-detail-hero2 h-[340px] sm:h-[420px] lg:h-[520px] lg:rounded-[32px]">
                <div className="mm-detail-round-actions">
                    {showBackControls ? (
                        <button onClick={handleBack} aria-label="Back" className="mm-detail-top-back">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    ) : <span />}
                    <button onClick={handleShare} aria-label="Share story">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                    </button>
                </div>
                {post.previewImage && !previewError ? (
                    <img
                        src={post.previewImage}
                        alt={displayTitle}
                        className="w-full h-full object-cover object-center"
                        onError={() => setPreviewError(true)}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-neutral-800">
                        <img src="/logo.svg" alt="Museum Map" className="w-20 h-20 opacity-20 dark:invert dark:opacity-60" />
                    </div>
                )}
                <div className="mm-detail-hero-copy">
                    <div className="mm-gallery-kicker mb-3">MM Story</div>
                    <h1 className="text-3xl sm:text-5xl font-black leading-[1.02] tracking-tight text-white">
                        {displayTitle}
                    </h1>
                </div>
            </div>

            {showBackControls && typeof document !== 'undefined' && createPortal(
                <button type="button" onClick={handleBack} aria-label="Back" className="mm-detail-floating-back lg:hidden">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>,
                document.body
            )}

            <div className="mm-story-detail-body2 p-6 sm:p-10 md:p-12">
                {/* Author & Date */}
                <div className="flex items-center gap-2 mb-4 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                    <span>{post.author || 'MM Editor'}</span>
                    <span className="text-gray-300 dark:text-neutral-700">•</span>
                    <span className="text-gray-400 font-medium">{formatDate(post.createdAt, effectiveLocale)}</span>
                    {post.views > 0 && (
                        <>
                            <span className="text-gray-300 dark:text-neutral-700">•</span>
                            <span className="text-gray-400 font-medium normal-case">
                                <svg className="w-3.5 h-3.5 inline -mt-0.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                {post.views.toLocaleString()}
                            </span>
                        </>
                    )}
                </div>

                <h1 className="mm-hide-when-hero-title">
                    {displayTitle}
                </h1>

                {/* Related Museums — right below title */}
                <RelatedMuseums museums={post.museums} locale={effectiveLocale} />

                {/* 컬렉션으로 이동하기 버튼 — 컬렉션이 연결된 스토리만 표시 */}
                {post.collectionId && (
                    <div className="mb-6">
                        <Link href={`/collections/${post.collectionId}`} className="mm-btn-gradient group">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                            <span>{effectiveLocale === 'ko' ? '컬렉션으로 이동하기' : effectiveLocale === 'ja' ? 'コレクションへ' : effectiveLocale === 'zh-CN' || effectiveLocale === 'zh-TW' ? '前往收藏集' : effectiveLocale === 'de' ? 'Zur Sammlung' : effectiveLocale === 'fr' ? 'Voir la collection' : effectiveLocale === 'es' ? 'Ver colección' : 'Go to Collection'}</span>
                            <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>
                    </div>
                )}


                {!isHtml || (cached.content && !isKoOrEn) ? (
                    <div className="mm-content">
                        <p style={{ whiteSpace: 'pre-wrap' }}>{displayContent}</p>
                    </div>
                ) : (
                    <div className="ql-snow">
                        <div
                            className="ql-editor mm-content"
                            dangerouslySetInnerHTML={{ __html: displayContent }}
                            style={{ padding: 0 }}
                        />
                    </div>
                )}

                {/* Info Table */}
                <InfoTable data={post.infoTable} locale={effectiveLocale} />

                {/* Artwork Cards */}
                <ArtworkCards data={post.artworks} locale={effectiveLocale} />

                {/* Report Info Update */}
                <div className="mt-10 pt-6 border-t border-gray-100 dark:border-neutral-800">
                    <button
                        onClick={() => setReportOpen(true)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/50 text-gray-400 dark:text-gray-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/10 dark:hover:border-blue-800 text-xs font-bold transition-all active:scale-95"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        {t('blog.requestInfoUpdate', effectiveLocale as Locale)}
                    </button>
                </div>
                <ReportModal
                    isOpen={reportOpen}
                    onClose={() => setReportOpen(false)}
                    locale={effectiveLocale}
                    targetName={post.title}
                    onSubmit={async (msg) => {
                        await fetch('/api/feedback', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                content: msg,
                                type: 'report',
                                category: 'story_info',
                                targetId: post.id,
                                targetName: post.title,
                            })
                        });
                        alert(effectiveLocale === 'ko' ? '감사합니다! 수정 요청이 접수되었어요 🙏' : 'Thank you! Your request has been received 🙏');
                    }}
                />
            </div>
        </div>
    );
}
