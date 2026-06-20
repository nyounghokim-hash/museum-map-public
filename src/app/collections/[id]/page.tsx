'use client';
import { useParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/components/AppContext';
import { useModal } from '@/components/ui/Modal';
import { t, Locale, translateCategory } from '@/lib/i18n';
import { getCountryName, getCityName } from '@/lib/countries';
import { getLocalizedMuseumName, getLocalizedCityName } from '@/lib/getLocalizedName';
import { useTranslatedText } from '@/hooks/useTranslation';
import { buildShareUrl } from '@/lib/utm';
import { getMuseumImageSrc, getMuseumImageFallback } from '@/lib/getMuseumImage';
import { getDisplayStoryTitle } from '@/lib/storyTitle';
import EmptyStateGame from '@/components/ui/EmptyStateGame';
import { backWithFallback } from '@/lib/route-pending';

const STORY_RETURN_TO_KEY = 'mm-story-return-to';

// Sub-component for translating text (wraps hook for use in JSX)
function TranslatedTitle({ text, locale }: { text: string; locale: string }) {
    const translated = useTranslatedText(text, locale as Locale);
    return <>{translated}</>;
}

// Format author display
function formatAuthor(user: any, locale: Locale) {
    if (!user?.name) return `${t('collections.curatedBy', locale)} ${t('global.anonymous', locale)} ${t('collections.anonymousVisitor', locale)}`;
    if (user.email === 'nyongho.kim@gmail.com' || user.name === 'System Admin') return `${t('collections.curatedBy', locale)} MM Editor`;
    if (user.name.startsWith('guest_')) return `${t('collections.curatedBy', locale)} ${t('global.anonymous', locale)} ${t('collections.anonymousVisitor', locale)}`;
    return `${t('collections.curatedBy', locale)} ${user.name}`;
}

export default function CollectionDetailPage() {
    const { id } = useParams();
    const { locale } = useApp();
    const { showAlert } = useModal();
    const [collection, setCollection] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isFromBack, setIsFromBack] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const backTs = sessionStorage.getItem('navigating-back');
            if (backTs && Date.now() - parseInt(backTs) < 500) {
                setIsFromBack(true);
            }
            sessionStorage.removeItem('navigating-back');
        }
    }, []);

    const handleBack = useCallback(() => {
        backWithFallback('/collections', locale);
    }, [locale]);

    useEffect(() => {
        fetch(`/api/collections/${id}`)
            .then(r => r.json())
            .then(res => {
                setCollection(res.data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [id]);

    const handleCreateAutoRoute = () => {
        if (!collection?.items || collection.items.length === 0) {
            showAlert(t('collections.emptyFolder', locale));
            return;
        }
        const museumIds = collection.items.map((i: any) => i.museumId).join(',');
        window.location.assign(`/plans/new?museums=${museumIds}`);
    };

    const handleShareCollection = () => {
        navigator.clipboard.writeText(buildShareUrl(window.location.href));
        showAlert(t('collections.shareSuccess', locale));
    };

    if (loading) return (
        <div className="mm-collection-detail2 w-full max-w-[1080px] mx-auto px-4 py-4 sm:px-6 sm:py-6 md:px-8 pb-56 lg:pb-8">
            <div className="mb-6">
                <div className="skeleton h-8 rounded-lg w-1/2 max-w-sm mb-3" />
                <div className="skeleton h-4 rounded w-1/3 max-w-xs" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="skeleton-card overflow-hidden">
                        <div className="skeleton h-40 w-full rounded-none" />
                        <div className="p-4">
                            <div className="skeleton h-5 rounded-lg w-2/3 mb-3" />
                            <div className="skeleton h-4 rounded w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const itemsCount = collection.items?.length || 0;
    const authorText = formatAuthor(collection.user, locale);

    return (
        <div className={`mm-collection-detail2 w-full max-w-[1080px] mx-auto px-4 py-4 sm:px-6 sm:py-6 md:px-8 pb-56 lg:pb-8 ${isFromBack ? 'page-slide-in-back' : 'page-slide-in'}`}>
            {/* Sticky header with back button */}
            <div className="mm-collection-detail2-head mb-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                            <h1 className="text-lg sm:text-2xl font-bold leading-tight tracking-tight" title={collection.title}>{locale === 'ko' ? collection.title : <TranslatedTitle text={collection.title} locale={locale} />}</h1>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                {collection.isVisitedCollection && (
                                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                        {locale === 'ko' ? '다녀간 컬렉션' : 'Visited collection'}
                                    </span>
                                )}
                                {Number(collection.tripCount) > 0 && (
                                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                                        {locale === 'ko' ? `여행 ${collection.tripCount}회` : `${collection.tripCount} trips`}
                                    </span>
                                )}
                                <p className="text-xs font-medium truncate" style={{ color: 'var(--mm-text-tertiary)' }}>
                                    {authorText} · {itemsCount} {t('collections.items', locale)}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex w-full items-center gap-2 shrink-0 sm:ml-2 sm:w-auto sm:justify-end">
                        <button
                            onClick={handleShareCollection}
                            className="h-11 w-11 flex items-center justify-center rounded-full border text-slate-500 transition-colors shadow-sm active:scale-95 dark:text-blue-100/70" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}
                            aria-label="Share"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                        </button>
                        {itemsCount > 0 && (
                            <button
                                onClick={handleCreateAutoRoute}
                                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.18)] transition-all active:scale-95 hover:bg-blue-700 sm:flex-none"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3 21l18-9L3 3l3 9Zm0 0h7" />
                                </svg>
                                {t('collections.planTrip', locale)}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Related Stories Section — above museum list */}
            {collection.stories && collection.stories.length > 0 && (
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-1 rounded-full bg-blue-500" />
                        <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.15em]">Related Stories</span>
                    </div>
                    <div className="flex flex-col gap-3">
                        {collection.stories.map((story: any) => {
                            const museumImg = story.museums?.[0]?.museum?.imageUrl
                                || (story.museums?.[0]?.museum?.cachedPhotoUrls ? (typeof story.museums[0].museum.cachedPhotoUrls === 'string' ? JSON.parse(story.museums[0].museum.cachedPhotoUrls) : story.museums[0].museum.cachedPhotoUrls)?.[0] : null);
                            const thumbSrc = story.previewImage || museumImg;
                            return (
                                <div
                                    key={story.id}
                                    onClick={() => {
                                        try {
                                            sessionStorage.setItem(STORY_RETURN_TO_KEY, `${window.location.pathname}${window.location.search}`);
                                        } catch { }
                                        window.location.assign(`/blog/${story.id}`);
                                    }}
                                    className="mm-card group flex active:scale-[0.99] cursor-pointer"
                                >
                                    <div className="w-24 h-24 sm:w-32 sm:h-28 shrink-0 overflow-hidden rounded-2xl relative" style={{ background: 'var(--mm-surface-secondary)' }}>
                                        {thumbSrc ? (
                                            <img
                                                src={thumbSrc}
                                                alt={story.title}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-all duration-500 opacity-0"
                                                onLoad={(e) => { (e.target as HTMLImageElement).classList.remove('opacity-0'); (e.target as HTMLImageElement).classList.add('opacity-100'); }}
                                                onError={(e) => { e.currentTarget.src = '/logo.svg'; e.currentTarget.className = 'w-full h-full object-contain p-6 opacity-20 dark:invert dark:opacity-60'; }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <img src="/logo.svg" alt="" className="w-10 h-10 opacity-20 dark:invert dark:opacity-60" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3 sm:p-4 flex-1 flex flex-col justify-center min-w-0">
                                        <div className="flex items-center gap-2 mb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--mm-brand)' }}>
                                            <span>{story.author || 'MM Editor'}</span>
                                            <span style={{ color: 'var(--mm-surface-border)' }}>•</span>
                                            <span className="font-medium" style={{ color: 'var(--mm-text-tertiary)' }}>
                                                {new Date(story.createdAt).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                        <h3 className="text-sm sm:text-base font-bold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2" style={{ color: 'var(--mm-text-primary)', wordBreak: 'break-word' }}>
                                            {getDisplayStoryTitle(locale === 'ko' ? story.title : (story.titleEn || story.title))}
                                        </h3>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Museum list */}
            {itemsCount === 0 ? (
                <EmptyStateGame locale={locale} title={t('collections.thisEmpty', locale)} compact className="mb-10 rounded-2xl border border-blue-100/70 dark:border-blue-400/10" />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {collection.items.map((item: any) => (
                        <div
                            key={item.id}
                            className="mm-collection-card2 overflow-hidden group cursor-pointer hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.98]"
                            onClick={() => window.location.assign(`/museums/${item.museum.id}`)}
                        >
                            <div className="h-40 relative overflow-hidden" style={{ background: 'var(--mm-surface-secondary)' }}>
                                {(() => {
                                    const imgSrc = getMuseumImageSrc(item.museum);
                                    const fallbackSrc = getMuseumImageFallback(item.museum);
                                    return imgSrc ? (
                                        <img
                                            src={imgSrc}
                                            alt={item.museum.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 will-change-transform opacity-0"
                                            onLoad={(e) => { (e.target as HTMLImageElement).classList.remove('opacity-0'); (e.target as HTMLImageElement).classList.add('opacity-100'); }}
                                            onError={(e) => {
                                                const el = e.target as HTMLImageElement;
                                                if (fallbackSrc && el.src !== fallbackSrc) { el.src = fallbackSrc; }
                                                else { el.style.display = 'none'; el.parentElement?.querySelector('.logo-fallback')?.classList.remove('hidden'); }
                                            }}
                                        />
                                    ) : null;
                                })()}
                                <div className={`logo-fallback absolute inset-0 flex items-center justify-center ${getMuseumImageSrc(item.museum) ? 'hidden' : ''}`}>
                                    <img src="/logo.svg" alt="Museum Map" className="w-36 h-36 opacity-20 dark:invert dark:opacity-[0.6]" />
                                </div>
                                {item.museum.type && (
                                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-black/60 backdrop-blur-md shadow-sm">
                                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 capitalize">
                                            {translateCategory(item.museum.type, locale)}
                                        </span>
                                    </div>
                                )}
                                {item.museum.imageUrl?.includes('googleusercontent') && (
                                    <span className="absolute bottom-2 right-2 text-[8px] text-white/40 font-medium">📷 Google</span>
                                )}
                            </div>
                            <div className="p-4 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-semibold text-[15px] mb-1 capitalize truncate" style={{ color: 'var(--mm-text-primary)' }}>{getLocalizedMuseumName(item.museum, locale)}</h3>
                                    <p className="text-xs font-medium truncate" style={{ color: 'var(--mm-text-tertiary)' }}>{getLocalizedCityName(item.museum, locale) || getCityName(item.museum.city, locale)}, {getCountryName(item.museum.country, locale)}</p>
                                </div>
                                {item.museum.googleRating && (
                                    <div className="flex items-center gap-1 shrink-0">
                                        <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                        <span className="text-sm font-bold text-yellow-500">{item.museum.googleRating.toFixed(1)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Mobile: Floating back button — rendered via portal to escape transform container */}
            {typeof document !== 'undefined' && createPortal(
                <div className="lg:hidden fixed bottom-8 right-8 z-[9998] flex flex-col gap-2">
                    {itemsCount > 0 && (
                        <button
                            onClick={handleCreateAutoRoute}
                            className="w-14 h-14 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white active:scale-95 transition-all animate-fadeIn border border-blue-400/40"
                            style={{ boxShadow: '0 12px 28px rgba(37,99,235,0.22)' }}
                            title={t('collections.planTrip', locale)}
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3 21l18-9L3 3l3 9Zm0 0h7" />
                            </svg>
                        </button>
                    )}
                    <button
                        onClick={handleBack}
                        className="w-14 h-14 flex items-center justify-center rounded-full bg-neutral-800/90 dark:bg-white/90 backdrop-blur-md text-white dark:text-gray-800 shadow-lg border border-neutral-700/60 dark:border-gray-200/60 active:scale-95 transition-all hover:bg-neutral-700 dark:hover:bg-gray-100"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
}
