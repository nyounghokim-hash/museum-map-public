'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { buildShareUrl } from '@/lib/utm';
import { useApp } from '@/components/AppContext';

import { useTranslatedTexts } from '@/hooks/useTranslation';
import { useCachedTranslation } from '@/hooks/useCachedTranslation';
import type { Locale } from '@/lib/i18n';
import { getLocalizedMuseumName, getLocalizedCityName } from '@/lib/getLocalizedName';
import { getDisplayStoryTitle } from '@/lib/storyTitle';
import { resolveMuseumRouteId } from '@/lib/clientMuseumRoute';
import { backWithFallback, navigateWithPending } from '@/lib/route-pending';



function getImageSource(url: string, locale: string): { label: string; link?: string } {
    if (!url) return { label: '' };
    if (url.includes('wikimedia.org') || url.includes('wikipedia.org'))
        return { label: 'Wikimedia Commons', link: 'https://commons.wikimedia.org' };
    if (url.includes('artic.edu'))
        return { label: 'Art Institute of Chicago', link: 'https://www.artic.edu' };
    if (url.includes('metmuseum.org'))
        return { label: 'The Metropolitan Museum of Art', link: 'https://www.metmuseum.org' };
    if (url.includes('europeana.eu'))
        return { label: 'Europeana', link: 'https://www.europeana.eu' };
    if (url.includes('googleapis.com'))
        return { label: 'Google Places', link: 'https://maps.google.com' };
    return { label: locale === 'ko' ? '운영팀에서 추가' : 'Added by operations team' };
}

function getLocaleJsonValue(value: unknown, locale: string): string {
    if (!value || typeof value !== 'object') return '';
    const translated = (value as Record<string, unknown>)[locale];
    return typeof translated === 'string' ? translated.trim() : '';
}

interface ArtworkDetailClientProps {
    artworkId: string;
    serverLocale: string;
    initialData?: any;
}

export default function ArtworkDetailClient({ artworkId, serverLocale, initialData }: ArtworkDetailClientProps) {
    const { locale: appLocale } = useApp();
    const locale = appLocale || serverLocale;

    const [artwork, setArtwork] = useState<any>(initialData || null);
    const [loading, setLoading] = useState(!initialData);
    const [imgLoaded, setImgLoaded] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [isFromBack, setIsFromBack] = useState(false);
    const [portalReady, setPortalReady] = useState(false);
    const isBackingRef = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const lightboxRef = useRef<HTMLDivElement>(null);
    const lightboxTouchStart = useRef({ x: 0, y: 0 });

    // Check if we arrived via back navigation (within 500ms)
    useEffect(() => {
        setPortalReady(true);
        if (typeof window !== 'undefined') {
            const returnPath = sessionStorage.getItem('artwork-to-museum-return');
            const here = window.location.pathname + window.location.search;
            if (returnPath === here) sessionStorage.removeItem('artwork-to-museum-return');

            const backTs = sessionStorage.getItem('navigating-back');
            if (backTs && Date.now() - parseInt(backTs) < 500) {
                setIsFromBack(true);
            }
            sessionStorage.removeItem('navigating-back');
        }
    }, []);

    const handleBack = useCallback(() => {
        if (isBackingRef.current) return;
        isBackingRef.current = true;
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('navigating-back', String(Date.now()));
            const returnPath = sessionStorage.getItem('artwork-list-return');
            const historyState = window.history.state;
            if (returnPath && window.history.length <= 1) {
                sessionStorage.removeItem('artwork-list-return');
                navigateWithPending(returnPath, locale, true);
                return;
            }
            if (historyState?.backAnchor) {
                navigateWithPending('/artworks', locale, true);
                return;
            }
            if (window.history.length <= 1) {
                navigateWithPending('/artworks', locale, true);
                return;
            }
        }
        backWithFallback('/artworks', locale);
    }, [locale]);

    const allTexts = useMemo(() => {
        if (!artwork) return [];
        const sourceTexts = [
            artwork.titleKo || artwork.titleEn || artwork.title || '',
            artwork.descriptionKo || artwork.description || '',
            artwork.artistKo || artwork.artistEn || artwork.artist || '',
            artwork.title || '',
            artwork.description || '',
            artwork.artist || '',
            ...(artwork.museums || []).map((m: any) => m.nameKo || m.nameEn || m.name || ''),
            ...(artwork.museums || []).map((m: any) => m.name || ''),
            ...(artwork.relatedStories || []).map((s: any) => s.title || ''),
        ];
        return Array.from(new Set(sourceTexts.filter(Boolean)));
    }, [artwork]);
    const translations = useTranslatedTexts(allTexts, locale as Locale);
    const { translations: cachedArtwork } = useCachedTranslation('artwork', artwork?.id, locale);

    useEffect(() => {
        if (initialData) return; // Skip fetch if SSR data provided
        fetch(`/api/artworks/${artworkId}`)
            .then(r => r.json())
            .then(data => { setArtwork(data.data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [artworkId, initialData]);

    useEffect(() => {
        if (!lightboxOpen) return;
        const originalOverflow = document.body.style.overflow;
        const originalOverscroll = document.body.style.overscrollBehavior;
        const originalTouchAction = document.body.style.touchAction;
        const originalHtmlOverscroll = document.documentElement.style.overscrollBehavior;
        document.body.style.overflow = 'hidden';
        document.body.style.overscrollBehavior = 'none';
        document.body.style.touchAction = 'none';
        document.documentElement.style.overscrollBehavior = 'none';

        const onTouchStart = (e: TouchEvent) => {
            const t = e.touches[0];
            if (!t) return;
            lightboxTouchStart.current = { x: t.clientX, y: t.clientY };
            if (t.clientX < 36 || t.clientX > window.innerWidth - 36) {
                e.preventDefault();
            }
        };
        const onTouchMove = (e: TouchEvent) => {
            const t = e.touches[0];
            if (!t) return;
            const dx = t.clientX - lightboxTouchStart.current.x;
            const dy = t.clientY - lightboxTouchStart.current.y;
            if (Math.abs(dx) > 4 && Math.abs(dx) >= Math.abs(dy)) {
                e.preventDefault();
            }
        };

        const lightbox = lightboxRef.current;
        lightbox?.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });
        lightbox?.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
        return () => {
            document.body.style.overflow = originalOverflow;
            document.body.style.overscrollBehavior = originalOverscroll;
            document.body.style.touchAction = originalTouchAction;
            document.documentElement.style.overscrollBehavior = originalHtmlOverscroll;
            lightbox?.removeEventListener('touchstart', onTouchStart, { capture: true });
            lightbox?.removeEventListener('touchmove', onTouchMove, { capture: true });
        };
    }, [lightboxOpen]);

    const handleShare = async () => {
        const url = buildShareUrl(window.location.href);
        const title = artwork ? `${artwork.title}${artwork.artist ? ' — ' + artwork.artist : ''}` : '';
        if (navigator.share) {
            try { await navigator.share({ title, url }); } catch { }
        } else {
            await navigator.clipboard.writeText(url);
            alert(locale === 'ko' ? '공유 링크를 복사했어요' : 'Link copied');
        }
    };

    const handleMuseumClick = useCallback(async (museum: any) => {
        const museumRouteId = await resolveMuseumRouteId(museum);
        if (!museumRouteId) return;
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('navigating-forward', String(Date.now()));
            sessionStorage.setItem('artwork-to-museum-return', window.location.pathname + window.location.search);
        }
        window.location.assign(`/museums/${encodeURIComponent(museumRouteId)}?from=artwork`);
    }, []);

    if (loading) {
        return (
            <div className="mm-editorial-page2 mm-artwork-detail-page2 w-full lg:max-w-[860px] mx-auto px-0 sm:px-6 pb-32 lg:pb-10">
                <div className="mm-detail-hero2 w-full h-[420px] sm:h-[520px] bg-gray-100 dark:bg-neutral-800 sm:rounded-b-[32px] relative mt-0">
                    <div className="skeleton absolute inset-0 rounded-none" />
                </div>
                <div className="mm-artwork-detail-body2 px-5 sm:px-0 mt-6 lg:px-8 lg:py-8">
                    <div className="mm-skel-line w-28 mb-3" />
                    <div className="mm-skel-line h-8 w-3/4 mb-3" />
                    <div className="mm-skel-line w-24 mb-8" />
                    <div className="mm-skel-line w-full mb-3" />
                    <div className="mm-skel-line w-11/12 mb-3" />
                    <div className="mm-skel-line w-2/3" />
                </div>
            </div>
        );
    }

    if (!artwork) {
        return (
            <div className="w-full lg:max-w-[800px] mx-auto px-5 py-20 text-center">
                <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-neutral-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400 text-lg font-bold">
                    {locale === 'ko' ? '작품을 찾지 못했어요' : 'Artwork not found'}
                </p>
                <button onClick={() => navigateWithPending('/artworks', locale)} className="mt-4 text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline">
                    ← {locale === 'ko' ? '작품 목록' : 'Back to artworks'}
                </button>
            </div>
        );
    }

    const getDisplayTitle = () => {
        if (locale === 'ko') return artwork.titleKo || artwork.title;
        if (locale === 'en') return artwork.titleEn || artwork.title;
        const localeJsonTitle = getLocaleJsonValue(artwork.titleTranslations, locale);
        if (localeJsonTitle) return localeJsonTitle;
        const sourceTitle = artwork.titleKo || artwork.titleEn || artwork.title;
        return cachedArtwork.title || translations.get(sourceTitle) || translations.get(artwork.title) || sourceTitle;
    };
    const getDisplayArtist = () => {
        if (locale === 'ko') return artwork.artistKo || artwork.artist;
        if (locale === 'en') return artwork.artistEn || artwork.artist;
        const localeJsonArtist = getLocaleJsonValue(artwork.artistTranslations, locale);
        if (localeJsonArtist) return localeJsonArtist;
        const sourceArtist = artwork.artistKo || artwork.artistEn || artwork.artist;
        return cachedArtwork.artist || translations.get(sourceArtist) || translations.get(artwork.artist) || sourceArtist;
    };
    const getDisplayDesc = () => {
        if (locale === 'ko') return artwork.descriptionKo || artwork.description;
        if (locale === 'en') return artwork.description || artwork.descriptionKo;
        const sourceDescription = artwork.descriptionKo || artwork.description;
        return cachedArtwork.description || translations.get(sourceDescription) || translations.get(artwork.description) || sourceDescription;
    };

    const displayTitle = getDisplayTitle();
    const displayDesc = getDisplayDesc();
    const displayArtist = getDisplayArtist();

    return (
        <div ref={containerRef} className={`mm-editorial-page2 mm-artwork-detail-page2 w-full lg:max-w-[860px] mx-auto px-0 sm:px-6 pb-32 lg:pb-10 ${isFromBack ? 'page-slide-in-back' : 'page-slide-in'}`}>
            <div className="mm-detail-hero2 w-full h-[420px] sm:h-[520px] bg-gray-100 dark:bg-neutral-800 sm:rounded-b-[32px] relative mt-0">
                <div className="mm-detail-round-actions">
                    <button onClick={handleBack} aria-label="Back" className="mm-detail-top-back">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button onClick={handleShare} aria-label="Share" className="mm-artwork-share-action">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                    </button>
                </div>

                {artwork.image ? (
                    <>
                        {!imgLoaded && (
                            <div className="skeleton absolute inset-0 rounded-none" />
                        )}
                        <img
                            src={artwork.image}
                            alt={displayTitle}
                            className={`w-full h-full object-cover transition-opacity duration-500 cursor-zoom-in ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                            onLoad={() => setImgLoaded(true)}
                            onClick={() => setLightboxOpen(true)}
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback') as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                                setImgLoaded(true);
                            }}
                        />
                        <div className="logo-fallback w-full h-full flex items-center justify-center" style={{ display: 'none' }}>
                            <img src="/logo.svg" alt="" className="mm-empty-logo dark:invert" />
                        </div>
                    </>
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <img src="/logo.svg" alt="" className="mm-empty-logo dark:invert" />
                    </div>
                )}
                <div className="mm-detail-hero-copy">
                    {displayArtist && (
                        <div className="mm-gallery-kicker mb-3">{displayArtist}{artwork.year ? ` · ${artwork.year}` : ''}</div>
                    )}
                    <h1 className="text-3xl sm:text-5xl font-black leading-[1.02] tracking-tight text-white">{displayTitle}</h1>
                </div>
            </div>

            {portalReady && createPortal(
                <button type="button" onClick={handleBack} aria-label="Back" className="mm-detail-floating-back md:hidden">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>,
                document.body
            )}

            {/* Lightbox Overlay */}
            {portalReady && lightboxOpen && artwork.image && createPortal(
                <div
                    ref={lightboxRef}
                    className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-sm animate-backdropIn cursor-zoom-out"
                    style={{ touchAction: 'none', overscrollBehavior: 'none' }}
                    onClick={() => setLightboxOpen(false)}
                    onKeyDown={(e) => e.key === 'Escape' && setLightboxOpen(false)}
                    tabIndex={0}
                    role="dialog"
                >
                    <button
                        onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
                        className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
                        aria-label="Close"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
                        <img
                            src={artwork.image}
                            alt={displayTitle}
                            className="block max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-4rem)] max-h-[calc(100vh-8rem)] sm:max-h-[calc(100vh-9rem)] object-contain rounded-lg animate-modalIn"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <p className="absolute bottom-6 left-0 right-0 text-center text-white/70 text-sm font-medium">
                        {displayTitle}{displayArtist ? ` — ${displayArtist}` : ''}
                    </p>
                </div>,
                document.body
            )}

            {/* Content */}
            <div className="mm-artwork-detail-body2 px-5 sm:px-0 mt-6 lg:px-8 lg:py-8">
                {/* Artist badge */}
                {displayArtist && (
                    <p className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">
                        {displayArtist}
                    </p>
                )}

                <h1 className="mm-hide-when-hero-title">{displayTitle}</h1>

                {/* Year */}
                {artwork.year && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 font-bold mt-2">
                        {artwork.year}
                    </p>
                )}

                {/* Description */}
                {displayDesc && (
                    <div className="mt-6">
                        <p className="text-[15px] text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
                            {displayDesc}
                        </p>
                    </div>
                )}

                {/* Exhibition Museums Section */}
                {artwork.museums && artwork.museums.length > 0 && (
                    <div className="mt-10">
                        <h2 className="text-base font-extrabold dark:text-white mb-4 flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            {locale === 'ko' ? '전시 미술관 / 박물관' : 'Exhibition Venue'}
                        </h2>
                        <div className="space-y-3">
                            {artwork.museums.map((m: any, index: number) => {
                                const hasMuseumIdentity = Boolean(m?.id || m?.museumId || m?.museum?.id || m?.name || m?.nameKo || m?.nameEn);
                                const content = (
                                    <>
                                        {/* Museum thumbnail */}
                                        <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-neutral-800 overflow-hidden flex-shrink-0">
                                            {m.imageUrl ? (
                                                <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = '/logo.svg'; e.currentTarget.className = 'mm-empty-logo m-auto object-contain dark:invert'; }} />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <img src="/logo.svg" alt="" className="mm-empty-logo dark:invert" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-sm dark:text-white truncate">
                                                {getLocalizedMuseumName(m, locale)}
                                            </h3>
                                            <p className="text-[11px] text-gray-400 dark:text-neutral-500 mt-0.5 flex items-center gap-1">
                                                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                {getLocalizedCityName(m, locale) || m.city}, {(() => { try { return new Intl.DisplayNames([locale], { type: 'region' }).of(m.country); } catch { return m.country; } })()}
                                            </p>
                                        </div>
                                        {hasMuseumIdentity && (
                                            <svg className="w-4 h-4 text-gray-300 dark:text-neutral-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                            </svg>
                                        )}
                                    </>
                                );
                                const className = "mm-artwork-detail-card2 flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-[0.98]";
                                return hasMuseumIdentity ? (
                                    <button
                                        type="button"
                                        key={m.id || m.museumId || m.name || `museum-${index}`}
                                        onClick={() => handleMuseumClick(m)}
                                        className={`${className} w-full text-left`}
                                    >
                                        {content}
                                    </button>
                                ) : (
                                    <div key={`museum-${index}`} className={`${className} opacity-75`}>
                                        {content}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Related Stories Section */}
                {artwork.relatedStories && artwork.relatedStories.length > 0 && (
                    <div className="mt-10">
                        <h2 className="text-base font-extrabold dark:text-white mb-4 flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                            </svg>
                            {locale === 'ko' ? '관련 스토리' : 'Related Stories'}
                        </h2>
                        <div className="space-y-3">
                            {artwork.relatedStories.map((s: any) => (
                                <a
                                    key={s.id}
                                    href={`/blog/${s.id}?fromArtwork=${encodeURIComponent(artworkId)}`}
                                    className="mm-artwork-detail-card2 flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-[0.98]"
                                >
                                    {s.previewImage && (
                                        <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-neutral-800 overflow-hidden flex-shrink-0">
                                            <img src={s.previewImage} alt={s.title} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = '/logo.svg'; e.currentTarget.className = 'w-full h-full object-contain p-2 opacity-20 dark:invert dark:opacity-60'; }} />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-sm dark:text-white truncate">
                                            {getDisplayStoryTitle(translations.get(s.title) || s.title)}
                                        </h3>
                                        {s.description && (
                                            <p className="text-[11px] text-gray-400 dark:text-neutral-500 mt-0.5 truncate">
                                                {s.description.substring(0, 80)}
                                            </p>
                                        )}
                                    </div>
                                    <svg className="w-4 h-4 text-gray-300 dark:text-neutral-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* Image Source Attribution */}
                {artwork.image && (() => {
                    const source = getImageSource(artwork.image, locale);
                    return source.label ? (
                        <div className="mt-10 pt-4 border-t border-gray-100 dark:border-neutral-800">
                            <p className="text-[11px] text-gray-400 dark:text-neutral-500 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                                </svg>
                                {locale === 'ko' ? '이미지 출처: ' : 'Image source: '}
                                {source.link ? (
                                    <a href={source.link} target="_blank" rel="noreferrer" className="underline hover:text-gray-600 dark:hover:text-neutral-400">{source.label}</a>
                                ) : (
                                    <span>{source.label}</span>
                                )}
                            </p>
                        </div>
                    ) : null;
                })()}
            </div>
            {/* Bottom spacing */}
            <div className="h-8" />
        </div>
    );
}
