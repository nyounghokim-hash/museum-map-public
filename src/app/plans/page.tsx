'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { GlassPanel } from '@/components/ui/glass';
import { useApp } from '@/components/AppContext';
import { useModal } from '@/components/ui/Modal';
import { t, formatDate } from '@/lib/i18n';
import { getLocalizedMuseumName } from '@/lib/getLocalizedName';
import * as gtag from '@/lib/gtag';
import { getMuseumImageSrc } from '@/lib/getMuseumImage';
import { clearActiveTripForAccount, getActiveTripForAccount } from '@/lib/accountStorage';

export default function MyPlansPage() {
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { locale } = useApp();
    const { showAlert, showConfirm } = useModal();
    const [activeTripId, setActiveTripId] = useState<string | null>(null);
    const [isPendingTrip, setIsPendingTrip] = useState(false);
    const [tripStartDate, setTripStartDate] = useState<string | null>(null);

    useEffect(() => {
        // Hydrate active trip
        const parsed = getActiveTripForAccount();
        if (parsed?.planId) {
            setActiveTripId(parsed.planId);
            setIsPendingTrip(!!parsed.pending);
            setTripStartDate(parsed.startDate || null);
        }

        fetch('/api/plans')
            .then(r => r.json())
            .then(res => { setPlans(res.data || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        showConfirm(t('modal.deletePlan', locale), async () => {
            gtag.event('delete_plan', { category: 'plan', label: id, value: 1 });
            await fetch(`/api/plans/${id}`, { method: 'DELETE' });
            setPlans(prev => prev.filter(p => p.id !== id));
            if (activeTripId === id) {
                clearActiveTripForAccount();
                setActiveTripId(null);
            }
        });
    };

    const handleEndTrip = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        showConfirm(t('plans.confirmEndTrip', locale), () => {
            clearActiveTripForAccount();
            setActiveTripId(null);
            showAlert(t('plans.tripEnded', locale));
        });
    };

    return (
        <div className="no-back-swipe w-full lg:max-w-[1080px] mx-auto px-4 py-4 sm:px-6 sm:py-8 md:px-8 mt-4 sm:mt-8 pb-32 lg:pb-8 overflow-hidden">
            <div className="mb-6 sm:mb-8">
                {loading ? (
                    <>
                        <div className="skeleton skeleton-title w-44 mb-2" />
                        <div className="skeleton skeleton-text w-60 mt-2" />
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                            <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-[0.2em]">Travel</span>
                            {plans.length > 0 && (
                                <span className="text-[10px] font-black text-gray-400 dark:text-neutral-500 bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">{plans.length}</span>
                            )}
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight dark:text-white">{t('plans.title', locale)}</h1>
                        <p className="text-gray-400 dark:text-neutral-500 mt-1 text-xs font-medium">{t('plans.subtitle', locale)}</p>
                    </>
                )}
            </div>

            {loading ? (
                <div className="flex flex-col gap-3 sm:gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <GlassPanel key={i} className="p-4 sm:p-5 relative overflow-hidden">
                            <div className="min-w-0 pr-8 sm:pr-10">
                                <div className={`skeleton skeleton-title ${i === 0 ? 'w-2/5' : i === 1 ? 'w-1/3' : 'w-1/4'} mb-3`} />
                                <div className="flex items-center gap-2 mt-1.5">
                                    <div className="skeleton skeleton-text w-24" />
                                    <div className="skeleton skeleton-text w-16" />
                                </div>
                                <div className={`skeleton skeleton-text ${i === 0 ? 'w-3/4' : 'w-1/2'} mt-3`} />
                                <div className="flex items-center gap-1 mt-3">
                                    {Array.from({ length: i === 0 ? 4 : i === 1 ? 3 : 2 }).map((_, j) => (
                                        <div key={j} className="skeleton skeleton-circle w-9 h-9 sm:w-10 sm:h-10 shrink-0" />
                                    ))}
                                </div>
                            </div>
                        </GlassPanel>
                    ))}
                </div>
            ) : plans.length === 0 ? (
                <div className="py-16 sm:py-20 text-center">
                    <div className="text-5xl sm:text-6xl mb-4">
                        <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">{t('plans.empty', locale)}</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base mb-6">{t('plans.emptyDesc', locale)}</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3 sm:gap-4">
                    {[...plans].sort((a, b) => {
                        if (activeTripId === a.id) return -1;
                        if (activeTripId === b.id) return 1;
                        return 0;
                    }).map((plan) => {
                        const stopCount = plan.stops?.length || 0;
                        const museumNames = plan.stops?.map((s: any) => getLocalizedMuseumName(s.museum, locale)).filter(Boolean).slice(0, 3) || [];
                        const dateStr = plan.date ? formatDate(plan.date, locale) : (locale === 'ko' ? '날짜 미설정' : 'No date set');
                        const isActive = activeTripId === plan.id;
                        const isPending = isActive && isPendingTrip;
                        const dDayNum = isPending && tripStartDate ? Math.ceil((new Date(tripStartDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000) : null;
                        const dDayText = dDayNum !== null ? (dDayNum > 0 ? `D-${dDayNum}` : dDayNum === 0 ? 'D-DAY' : '') : '';

                        return (
                            <Link key={plan.id} href={`/plans/${plan.id}`}>
                                <GlassPanel className={`p-4 sm:p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group overflow-hidden relative active:scale-[0.98] ${isPending ? 'ring-2 ring-amber-400 bg-amber-50/50 dark:bg-amber-900/10 shadow-md' : isActive ? 'ring-2 ring-purple-500 bg-purple-50/50 dark:bg-purple-900/10 shadow-md' : 'shadow-sm'}`}>
                                    <button
                                        onClick={(e) => handleDelete(plan.id, e)}
                                        className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 p-2 sm:p-1.5 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 sm:opacity-0 sm:group-hover:opacity-100 transition-all z-10"
                                        title={locale === 'ko' ? '삭제' : 'Delete'}
                                        aria-label={locale === 'ko' ? '여행 계획 삭제' : 'Delete plan'}
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                    <div className="min-w-0 pr-8 sm:pr-10">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base sm:text-lg font-bold group-hover:text-purple-600 dark:text-white dark:group-hover:text-purple-400 transition-colors truncate">
                                                {plan.title || (locale === 'ko' ? '이름 없는 계획' : 'Untitled Plan')}
                                            </h3>
                                            {isPending && (
                                                <>
                                                    <span className="shrink-0 text-[10px] sm:text-xs font-bold text-white bg-amber-500 px-2 py-0.5 rounded-full">
                                                        {({ ko: '여행 준비 중', en: 'Upcoming', ja: '旅行準備中', de: 'Bevorstehend', fr: 'À venir', es: 'Próximo', pt: 'Em breve', zh: '即将出发', it: 'In arrivo', ru: 'Предстоящее', ar: 'قادمة', hi: 'आगामी', et: 'Eesolev' } as Record<string, string>)[locale] || 'Upcoming'}
                                                    </span>
                                                    {dDayText && (
                                                        <span className="shrink-0 text-[10px] sm:text-xs font-black text-amber-500 dark:text-amber-400 animate-pulse">
                                                            {dDayText}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                            {isActive && !isPending && (
                                                <span className="shrink-0 text-[10px] sm:text-xs font-bold text-white bg-purple-500 px-2 py-0.5 rounded-full animate-pulse">
                                                    {({ ko: '여행 중', en: 'On Trip', ja: '旅行中', de: 'Auf Reise', fr: 'En voyage', es: 'De viaje', pt: 'Em viagem', zh: '旅行中', it: 'In viaggio', ru: 'В поездке', ar: 'في رحلة', hi: 'यात्रा पर', et: 'Reisil' } as Record<string, string>)[locale] || 'On Trip'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className="text-[11px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                {dateStr}
                                            </span>
                                            <span className="text-[11px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                {stopCount} {stopCount === 1 ? t('plans.stop', locale) : t('plans.stops', locale)}
                                            </span>
                                        </div>
                                        {museumNames.length > 0 && (
                                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-2 truncate">
                                                {museumNames.join(' → ')}{stopCount > 3 && ` +${stopCount - 3}`}
                                            </p>
                                        )}
                                        {/* Itinerary thumbnail preview */}
                                        {plan.stops?.length > 0 && (
                                            <div className="flex items-center gap-1 mt-3 overflow-x-auto scrollbar-hide">
                                                {plan.stops.slice(0, 5).map((stop: any, idx: number) => (
                                                    <div key={stop.id || idx} className="flex items-center shrink-0">
                                                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden border-2 border-white dark:border-neutral-800 shadow-sm bg-gray-100 dark:bg-neutral-800">
                                                            {getMuseumImageSrc(stop.museum) ? (
                                                                <img src={getMuseumImageSrc(stop.museum)!} alt={stop.museum.name || ''} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = '/logo.svg'; e.currentTarget.className = 'w-full h-full object-contain p-2 opacity-20 dark:invert dark:opacity-60'; }} />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <img src="/logo.svg" alt="" className="w-4 h-4 opacity-20 dark:invert dark:opacity-60" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        {idx < Math.min(plan.stops.length, 5) - 1 && (
                                                            <svg className="w-3 h-3 text-gray-300 dark:text-neutral-600 shrink-0 mx-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                                        )}
                                                    </div>
                                                ))}
                                                {plan.stops.length > 5 && (
                                                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 ml-1 shrink-0">+{plan.stops.length - 5}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 transition-colors">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </GlassPanel>
                            </Link>
                        );
                    })}
                </div>
            )}


        </div>
    );
}
