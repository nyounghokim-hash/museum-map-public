'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { GlassPanel } from '@/components/ui/glass';
import { useApp } from '@/components/AppContext';
import { useModal } from '@/components/ui/Modal';
import { useCompare } from '@/hooks/useCompare';
import { t, translateCategory, Locale } from '@/lib/i18n';
import { getLocalizedMuseumName, getLocalizedCityName } from '@/lib/getLocalizedName';
import { getMuseumImageSrc } from '@/lib/getMuseumImage';

export default function ComparePage() {
    const { locale } = useApp();
    const { showAlert } = useModal();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { compareIds, addToCompare, removeFromCompare, clearCompare, isInCompare, compareCount, isFull } = useCompare();

    const [museums, setMuseums] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const [savedSuggestions, setSavedSuggestions] = useState<any[]>([]);

    // Load saved museums as suggestions in empty state (auth optional)
    useEffect(() => {
        fetch('/api/me/saves')
            .then(r => { if (!r.ok) throw new Error('unauth'); return r.json(); })
            .then(res => {
                const raw = res.data || res || [];
                const list = (Array.isArray(raw) ? raw : []).map((s: any) => s.museum).filter(Boolean).slice(0, 6);
                setSavedSuggestions(list);
            })
            .catch(() => {});
    }, []);

    // Hydrate from URL params, or reset if ?reset=1
    useEffect(() => {
        if (initialized) return;
        if (searchParams.get('reset') === '1') {
            clearCompare();
            router.replace('/compare');
            setInitialized(true);
            return;
        }
        const urlIds = searchParams.get('ids');
        if (urlIds) {
            const idList = urlIds.split(',').filter(Boolean);
            idList.forEach(id => addToCompare(id));
        }
        setInitialized(true);
    }, [searchParams, initialized, addToCompare, clearCompare, router]);

    // Fetch museum data when compareIds change
    useEffect(() => {
        if (compareIds.length === 0) { setMuseums([]); return; }
        setLoading(true);
        fetch(`/api/museums?ids=${compareIds.join(',')}`)
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(res => {
                // API returns { data: { data: [...], total } }
                const list = res.data?.data || res.data || [];
                const arr = Array.isArray(list) ? list : [];
                const map = new Map(arr.map((m: any) => [m.id, m]));
                const ordered = compareIds.map(id => map.get(id)).filter(Boolean);
                setMuseums(ordered);

                // Auto-prune stale IDs (museums that no longer exist in DB)
                const validIds = new Set(arr.map((m: any) => m.id));
                const staleIds = compareIds.filter(id => !validIds.has(id));
                staleIds.forEach(id => removeFromCompare(id));
            })
            .catch((e) => { console.error('Compare fetch error:', e); })
            .finally(() => setLoading(false));
    }, [compareIds, removeFromCompare]);

    const handleShare = () => {
        const url = `${window.location.origin}/compare?ids=${compareIds.join(',')}`;
        navigator.clipboard.writeText(url);
        showAlert(t('compare.linkCopied', locale));
    };

    const handleReset = () => {
        clearCompare();
        router.replace('/compare');
    };

    // Extract visitor info field
    const getVisitorField = (museum: any, keyword: string): string => {
        const vi = museum.visitorInfo;
        if (!Array.isArray(vi)) return '';
        const item = vi.find((v: any) => {
            const label = (v.label || '').toLowerCase();
            return label.includes(keyword);
        });
        return item?.value || '';
    };

    const compareRows = [
        { key: 'location', Icon: IconPin, getValue: (m: any) => `${getLocalizedCityName(m, locale)}, ${m.country || ''}` },
        { key: 'type', Icon: IconBuilding, getValue: (m: any) => translateCategory(m.type, locale) },
        { key: 'admission', Icon: IconTicket, getValue: (m: any) => getVisitorField(m, 'admission') || getVisitorField(m, '입장') || getVisitorField(m, 'ticket') || getVisitorField(m, 'entry') },
        { key: 'hours', Icon: IconClock, getValue: (m: any) => {
            const hours = m.openingHours;
            if (Array.isArray(hours) && hours.length > 0) {
                return typeof hours[0] === 'string' ? hours[0] : (hours[0]?.open || '');
            }
            return getVisitorField(m, 'hour') || getVisitorField(m, '시간') || getVisitorField(m, 'time');
        }},
        { key: 'rating', Icon: IconStar, getValue: (m: any) => m.googleRating ? `${m.googleRating}` : '' },
        { key: 'reviews', Icon: IconChat, getValue: (m: any) => m.googleRatingsTotal ? m.googleRatingsTotal.toLocaleString() : '' },
        { key: 'website', Icon: IconGlobe, getValue: (m: any) => m.website || '', isLink: true },
    ];

    // Compute highest values for difference highlighting
    const highlights = useMemo(() => {
        if (museums.length < 2) return { ratingMaxId: null, reviewsMaxId: null };
        const ratingMax = museums.reduce((a, b) => (b.googleRating || 0) > (a.googleRating || 0) ? b : a);
        const reviewsMax = museums.reduce((a, b) => (b.googleRatingsTotal || 0) > (a.googleRatingsTotal || 0) ? b : a);
        return {
            ratingMaxId: ratingMax.googleRating ? ratingMax.id : null,
            reviewsMaxId: reviewsMax.googleRatingsTotal ? reviewsMax.id : null,
        };
    }, [museums]);

    // Detect "free admission" for purple highlight
    const isFreeAdmission = (value: string) => {
        if (!value) return false;
        const s = value.toLowerCase();
        return /free|gratis|무료|無料|免费|kostenlos|gratuit|bezpłatn/i.test(s);
    };

    return (
        <div className="no-back-swipe w-full lg:max-w-[1080px] mx-auto px-4 py-4 sm:px-6 sm:py-8 md:px-8 mt-4 sm:mt-8 pb-32 lg:pb-8 overflow-hidden">
            {/* Header */}
            <div className="mb-6 sm:mb-8">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-[0.2em]">Compare</span>
                    {compareCount > 0 && (
                        <span className="text-[10px] font-black text-gray-400 dark:text-neutral-500 bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">{compareCount}/3</span>
                    )}
                </div>
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight dark:text-white">{t('compare.title', locale)}</h1>
                    {compareCount > 0 && (
                        <div className="flex items-center gap-2">
                            <button onClick={handleShare} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors active:scale-95">
                                {t('compare.share', locale)}
                            </button>
                            <button onClick={handleReset} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-neutral-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:scale-95">
                                {t('compare.reset', locale)}
                            </button>
                        </div>
                    )}
                </div>
                <p className="text-gray-400 dark:text-neutral-500 mt-1 text-xs font-medium">{t('compare.emptyDesc', locale)}</p>
            </div>

            {/* Empty State — above cards */}
            {compareCount === 0 && !loading && (
                <div className="py-8 sm:py-10 text-center">
                    <svg className="w-14 h-14 mx-auto text-gray-300 dark:text-neutral-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                    </svg>
                    <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-200 mb-1.5">{t('compare.empty', locale)}</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm mb-5">{t('compare.emptyDesc', locale)}</p>
                    <button
                        onClick={() => setSearchOpen(true)}
                        className="gradient-btn px-5 py-2.5 rounded-xl font-bold text-white text-sm active:scale-95 transition-transform focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        {t('compare.search', locale)}
                    </button>

                    {/* Saved suggestions — quick add */}
                    {savedSuggestions.length > 0 && (
                        <div className="mt-8 text-left max-w-xl mx-auto">
                            <div className="flex items-center justify-between mb-3 px-1">
                                <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-[0.2em]">
                                    {t('compare.savedList', locale)}
                                </span>
                                <span className="text-[10px] text-gray-400 dark:text-neutral-500 font-medium">
                                    {t('compare.addMore', locale)}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {savedSuggestions.map((m) => (
                                    <SavedSuggestionCard
                                        key={m.id}
                                        museum={m}
                                        locale={locale}
                                        onAdd={() => {
                                            const added = addToCompare(m.id);
                                            if (!added) showAlert(t('compare.full', locale));
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Compare Grid — mobile: horizontal scroll, lg+: flex-wrap */}
            {(museums.length > 0 || loading) && (
                <div className="overflow-x-auto lg:overflow-visible scrollbar-hide -mx-4 lg:mx-0 px-4 lg:px-0 pb-4">
                    <div className="flex lg:flex-wrap gap-3 lg:gap-5 min-w-min lg:min-w-0 pb-1">
                        {/* Museum Columns */}
                        {museums.map((museum) => (
                            <CompareColumn
                                key={museum.id}
                                museum={museum}
                                locale={locale}
                                rows={compareRows}
                                onRemove={() => removeFromCompare(museum.id)}
                                isRatingMax={highlights.ratingMaxId === museum.id}
                                isReviewsMax={highlights.reviewsMaxId === museum.id}
                                isFreeAdmission={isFreeAdmission}
                            />
                        ))}

                        {/* Loading placeholders */}
                        {loading && compareIds.length > museums.length && Array.from({ length: compareIds.length - museums.length }).map((_, i) => (
                            <div key={`skel-${i}`} className="w-[224px] sm:w-[248px] shrink-0">
                                <GlassPanel className="p-3 h-full">
                                    <div className="skeleton skeleton-title w-full h-[168px] rounded-xl mb-3" />
                                    <div className="skeleton skeleton-title w-3/4 mb-1.5" />
                                    <div className="skeleton skeleton-text w-1/2 mb-3" />
                                    {Array.from({ length: 2 }).map((_, j) => (
                                        <div key={j} className="skeleton skeleton-text w-full mb-1.5" />
                                    ))}
                                </GlassPanel>
                            </div>
                        ))}

                        {/* Empty Slot — add more */}
                        {!isFull && (
                            <button
                                onClick={() => setSearchOpen(true)}
                                className="w-[224px] sm:w-[248px] shrink-0"
                            >
                                <GlassPanel className="p-3 h-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 dark:border-neutral-700 hover:border-purple-400 dark:hover:border-purple-500 transition-colors cursor-pointer group">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center group-hover:bg-purple-50 dark:group-hover:bg-purple-900/20 transition-colors">
                                        <svg className="w-5 h-5 text-gray-300 dark:text-neutral-600 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-bold text-gray-400 dark:text-neutral-500 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                        {t('compare.addMore', locale)}
                                    </span>
                                </GlassPanel>
                            </button>
                        )}

                        {/* right-side spacer to match left gutter in horizontal scroll */}
                        <div className="shrink-0 w-4 lg:hidden" aria-hidden="true" />
                    </div>
                </div>
            )}

            {/* Search Modal */}
            {searchOpen && (
                <CompareSearchModal
                    locale={locale}
                    onClose={() => setSearchOpen(false)}
                    onSelect={(museum: any) => {
                        const added = addToCompare(museum.id);
                        if (!added) showAlert(t('compare.full', locale));
                        else setSearchOpen(false);
                    }}
                    isInCompare={isInCompare}
                />
            )}
        </div>
    );
}

/* ─── Compare Column (간결 버전) ─── */
function CompareColumn({ museum, locale, rows, onRemove, isRatingMax, isReviewsMax, isFreeAdmission }: {
    museum: any; locale: Locale; rows: any[]; onRemove: () => void;
    isRatingMax: boolean; isReviewsMax: boolean; isFreeAdmission: (v: string) => boolean;
}) {
    const [imgError, setImgError] = useState(false);
    const imgSrc = getMuseumImageSrc(museum);
    const name = getLocalizedMuseumName(museum, locale);
    const removeLabel = locale === 'ko' ? `${name} 비교에서 제거` : `Remove ${name} from compare`;

    const rowMap = Object.fromEntries(rows.map((r: any) => [r.key, r.getValue(museum)]));
    const location = rowMap.location;
    const typeLabel = rowMap.type;
    const admission = rowMap.admission;
    const hours = rowMap.hours;
    const rating = rowMap.rating;
    const reviews = rowMap.reviews;
    const website = rowMap.website;

    const admissionLabel = t('compare.admission', locale);
    const hoursLabel = t('compare.hours', locale);
    const ratingLabel = t('compare.rating', locale);
    const reviewsLabel = t('compare.reviews', locale);
    const websiteLabel = t('compare.website', locale);
    const noDataLabel = t('compare.noData', locale);
    const bestLabel = locale === 'ko' ? '최고값' : 'Best';
    const freeIsHighlighted = isFreeAdmission(admission);

    return (
        <article
            className="w-[224px] sm:w-[248px] shrink-0"
            aria-label={name}
        >
            <GlassPanel className="p-0 overflow-hidden h-full flex flex-col">
                {/* Image + Rating badge + Remove */}
                <div className="relative h-[168px] bg-gray-100 dark:bg-neutral-800">
                    {imgSrc && !imgError ? (
                        <Image
                            src={imgSrc}
                            alt={name}
                            fill
                            sizes="(max-width: 640px) 224px, 248px"
                            className="object-cover"
                            onError={() => setImgError(true)}
                            unoptimized
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Image src="/logo.svg" alt="" width={40} height={40} className="opacity-20 dark:invert dark:opacity-60" />
                        </div>
                    )}

                    {/* Rating + reviews consolidated badge (top-left) */}
                    {rating && (
                        <div
                            className={`absolute top-1.5 left-1.5 flex items-center gap-1 px-2 py-1 rounded-full backdrop-blur-md text-[11px] font-extrabold tabular-nums shadow-sm ${
                                isRatingMax || isReviewsMax
                                    ? 'bg-purple-600/90 text-white'
                                    : 'bg-black/55 text-white'
                            }`}
                            aria-label={`${ratingLabel} ${rating}${reviews ? `, ${reviewsLabel} ${reviews}` : ''}${(isRatingMax || isReviewsMax) ? ` (${bestLabel})` : ''}`}
                            title={`${ratingLabel} ${rating}${reviews ? ` · ${reviews} ${reviewsLabel}` : ''}`}
                        >
                            <svg className="w-3 h-3 text-amber-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
                            </svg>
                            <span>{rating}</span>
                            {reviews && <span className="opacity-80 font-semibold">· {reviews}</span>}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={onRemove}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/55 backdrop-blur-md flex items-center justify-center text-white hover:bg-red-500 transition-colors active:scale-90 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        aria-label={removeLabel}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Name */}
                <div className="px-4 pt-3.5 pb-2">
                    <h3 className="text-sm sm:text-base font-bold dark:text-white line-clamp-2 leading-snug">{name}</h3>
                </div>

                {/* Chips: location · type */}
                <div className="px-4 pb-3 flex flex-wrap gap-x-2 gap-y-1 text-[12px] text-gray-600 dark:text-gray-400">
                    {location && (
                        <span className="inline-flex items-center gap-1" title={location}>
                            <IconPin className="w-3.5 h-3.5 shrink-0 text-purple-500 dark:text-purple-400" />
                            <span className="truncate">{location}</span>
                        </span>
                    )}
                    {typeLabel && (
                        <span className="inline-flex items-center gap-1" title={typeLabel}>
                            <IconBuilding className="w-3.5 h-3.5 shrink-0 text-purple-500 dark:text-purple-400" />
                            <span className="truncate">{typeLabel}</span>
                        </span>
                    )}
                </div>

                {/* Key facts: admission · hours (dt/dd for a11y) */}
                <dl className="px-4 pb-2 space-y-3 flex-1">
                    <CompareFact
                        Icon={IconTicket}
                        label={admissionLabel}
                        value={admission || noDataLabel}
                        highlighted={freeIsHighlighted}
                        highlightLabel={bestLabel}
                    />
                    <CompareFact
                        Icon={IconClock}
                        label={hoursLabel}
                        value={hours || noDataLabel}
                    />
                </dl>

                {/* Actions: website icon + 상세보기 */}
                <div className="px-4 pt-3 pb-4 mt-auto flex items-center gap-2">
                    {website ? (
                        <a
                            href={website.startsWith('http') ? website : `https://${website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 w-8 h-8 rounded-xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 transition-colors active:scale-95 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            aria-label={`${name} ${websiteLabel}`}
                            title={websiteLabel}
                        >
                            <IconGlobe className="w-4 h-4" />
                        </a>
                    ) : null}
                    <Link
                        href={`/museums/${museum.id}`}
                        className="flex-1 block text-center px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 transition-colors active:scale-95 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        aria-label={`${name} ${t('compare.viewDetail', locale)}`}
                    >
                        {t('compare.viewDetail', locale)}
                    </Link>
                </div>
            </GlassPanel>
        </article>
    );
}

/* ─── Fact row (dt/dd) ─── */
function CompareFact({ Icon, label, value, highlighted, highlightLabel }: {
    Icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    highlighted?: boolean;
    highlightLabel?: string;
}) {
    return (
        <div className="flex items-start gap-2">
            <dt className="sr-only">{label}</dt>
            <span aria-hidden="true" className="shrink-0 w-4 h-4 mt-0.5 flex items-center justify-center text-purple-500 dark:text-purple-400" title={label}>
                <Icon className="w-full h-full" />
            </span>
            <dd className={`min-w-0 flex-1 text-[13px] leading-snug line-clamp-2 ${highlighted
                ? 'font-bold text-purple-600 dark:text-purple-300'
                : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                {value}
                {highlighted && highlightLabel && (
                    <span className="sr-only"> ({highlightLabel})</span>
                )}
            </dd>
        </div>
    );
}

/* ─── Saved Suggestion Card (quick add to compare) ─── */
function SavedSuggestionCard({ museum, locale, onAdd }: { museum: any; locale: Locale; onAdd: () => void }) {
    const [imgError, setImgError] = useState(false);
    const imgSrc = getMuseumImageSrc(museum);
    const name = getLocalizedMuseumName(museum, locale);
    const addLabel = locale === 'ko' ? `${name} 비교에 추가` : `Add ${name} to compare`;
    return (
        <button
            onClick={onAdd}
            aria-label={addLabel}
            className="group relative flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
            <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-neutral-800 shrink-0">
                {imgSrc && !imgError ? (
                    <Image src={imgSrc} alt="" fill sizes="40px" className="object-cover" onError={() => setImgError(true)} unoptimized />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Image src="/logo.svg" alt="" width={16} height={16} className="opacity-20 dark:invert dark:opacity-60" />
                    </div>
                )}
            </div>
            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 line-clamp-2 text-left flex-1">{name}</span>
            <span className="shrink-0 w-5 h-5 rounded-full bg-gray-100 dark:bg-neutral-800 group-hover:bg-purple-500 text-gray-400 group-hover:text-white flex items-center justify-center transition-colors">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
            </span>
        </button>
    );
}

/* ─── SVG Icons (stroke-based, currentColor) ─── */
type IconProps = { className?: string };
function IconPin({ className }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className || 'w-full h-full'} aria-hidden="true">
            <path d="M12 21s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12Z" />
            <circle cx="12" cy="9" r="2.5" />
        </svg>
    );
}
function IconBuilding({ className }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className || 'w-full h-full'} aria-hidden="true">
            <path d="M3 21h18" />
            <path d="M5 21V10l7-5 7 5v11" />
            <path d="M9 21v-5h6v5" />
            <path d="M9 12h.01M12 12h.01M15 12h.01" />
        </svg>
    );
}
function IconTicket({ className }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className || 'w-full h-full'} aria-hidden="true">
            <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 1 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 1 0 0-4V8Z" />
            <path d="M10 6v12" strokeDasharray="2 2" />
        </svg>
    );
}
function IconClock({ className }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className || 'w-full h-full'} aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
        </svg>
    );
}
function IconStar({ className }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className || 'w-full h-full'} aria-hidden="true">
            <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
        </svg>
    );
}
function IconChat({ className }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className || 'w-full h-full'} aria-hidden="true">
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.5A8 8 0 1 1 21 12Z" />
        </svg>
    );
}
function IconGlobe({ className }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className || 'w-full h-full'} aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18" />
        </svg>
    );
}

/* ─── Search Modal ─── */
function CompareSearchModal({ locale, onClose, onSelect, isInCompare }: { locale: Locale; onClose: () => void; onSelect: (m: any) => void; isInCompare: (id: string) => boolean }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [saved, setSaved] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout>(null);

    // Load saved museums (skip if not authenticated)
    useEffect(() => {
        fetch('/api/me/saves')
            .then(r => { if (!r.ok) throw new Error('Not auth'); return r.json(); })
            .then(res => {
                const raw = res.data || res || [];
                const list = (Array.isArray(raw) ? raw : []).map((s: any) => s.museum).filter(Boolean);
                setSaved(list);
            })
            .catch(() => {});
    }, []);

    // Focus input
    useEffect(() => { inputRef.current?.focus(); }, []);

    // Search with debounce
    const handleSearch = useCallback((q: string) => {
        setQuery(q);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!q.trim()) { setResults([]); return; }
        debounceRef.current = setTimeout(() => {
            setSearching(true);
            fetch(`/api/museums?q=${encodeURIComponent(q.trim())}&limit=20`)
                .then(r => r.json())
                .then(res => setResults(res.data?.data || res.data || []))
                .catch(() => {})
                .finally(() => setSearching(false));
        }, 300);
    }, []);

    const renderMuseumRow = (museum: any) => {
        const already = isInCompare(museum.id);
        const imgSrc = getMuseumImageSrc(museum);
        return (
            <button
                key={museum.id}
                onClick={() => !already && onSelect(museum)}
                disabled={already}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${already ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-neutral-800/50 active:bg-gray-100 dark:active:bg-neutral-800'}`}
            >
                <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-gray-100 dark:bg-neutral-800 shrink-0">
                    {imgSrc ? (
                        <Image
                            src={imgSrc}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-cover"
                            unoptimized
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Image src="/logo.svg" alt="" width={16} height={16} className="opacity-20 dark:invert dark:opacity-60" />
                        </div>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold dark:text-white truncate">{getLocalizedMuseumName(museum, locale)}</p>
                    <p className="text-[11px] text-gray-400 dark:text-neutral-500 truncate">{getLocalizedCityName(museum, locale)}, {(museum.country || '')}</p>
                </div>
                {already ? (
                    <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                ) : (
                    <svg className="w-5 h-5 text-gray-300 dark:text-neutral-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                )}
            </button>
        );
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-stretch sm:items-center justify-center">
            <div className="hidden sm:block absolute inset-0 bg-black/50 animate-[fadeIn_0.2s_ease-out]" onClick={onClose} />
            <div className="relative w-full sm:max-w-lg sm:mx-4 bg-white dark:bg-neutral-900 sm:rounded-2xl shadow-2xl sm:max-h-[80vh] flex flex-col animate-[slideUpFade_0.2s_ease-out] overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
                    <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder={t('compare.search', locale)}
                        className="flex-1 bg-transparent text-sm font-medium dark:text-white outline-none placeholder:text-gray-400 dark:placeholder:text-neutral-500"
                    />
                    <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors active:scale-90">
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1">
                    {/* Search Results */}
                    {query.trim() && (
                        <div>
                            <div className="px-4 py-2 text-[10px] font-black text-gray-400 dark:text-neutral-500 uppercase tracking-widest">
                                {t('compare.searchResult', locale)}
                            </div>
                            {searching ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-5 h-5 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
                                </div>
                            ) : results.length > 0 ? (
                                results.map(renderMuseumRow)
                            ) : (
                                <p className="text-center text-sm text-gray-400 py-8">{t('compare.noData', locale)}</p>
                            )}
                        </div>
                    )}

                    {/* Saved List */}
                    {!query.trim() && saved.length > 0 && (
                        <div>
                            <div className="px-4 py-2 text-[10px] font-black text-gray-400 dark:text-neutral-500 uppercase tracking-widest">
                                {t('compare.savedList', locale)}
                            </div>
                            {saved.map(renderMuseumRow)}
                        </div>
                    )}

                    {/* No saved + no search */}
                    {!query.trim() && saved.length === 0 && (
                        <div className="py-12 text-center">
                            <p className="text-sm text-gray-400 dark:text-neutral-500">{t('compare.search', locale)}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
