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
import { ACTIVE_TRIP_CHANGE_EVENT, clearActiveTripForAccount, getActiveTripForAccount } from '@/lib/accountStorage';
import EmptyStateGame from '@/components/ui/EmptyStateGame';
import { getTripVisitStats, isTripEnded } from '@/lib/tripStatus';

const EMPTY_ACTION_LABELS: Record<string, { primary: string; secondary: string }> = {
    ko: { primary: '내 픽에서 경로 만들기', secondary: '박물관 찾기' },
    en: { primary: 'Build from My Pick', secondary: 'Find museums' },
    ja: { primary: '保存からルート作成', secondary: '博物館を探す' },
    de: { primary: 'Route aus Picks erstellen', secondary: 'Museen finden' },
    fr: { primary: 'Créer avec mes choix', secondary: 'Trouver des musées' },
    es: { primary: 'Crear desde favoritos', secondary: 'Buscar museos' },
    pt: { primary: 'Criar com favoritos', secondary: 'Encontrar museus' },
    'zh-CN': { primary: '用我的收藏创建', secondary: '查找博物馆' },
    'zh-TW': { primary: '用我的收藏建立', secondary: '尋找博物館' },
    da: { primary: 'Lav rute fra gemte', secondary: 'Find museer' },
    fi: { primary: 'Luo reitti valinnoista', secondary: 'Etsi museoita' },
    sv: { primary: 'Skapa från valda', secondary: 'Hitta museer' },
    et: { primary: 'Loo marsruut valikutest', secondary: 'Leia muuseume' },
};

const TRIP_STATUS_LABELS: Record<string, { ended: string; visited: string }> = {
    ko: { ended: '끝난 여행', visited: '다녀감' },
    en: { ended: 'Ended', visited: 'Visited' },
    ja: { ended: '終了した旅行', visited: '訪問済み' },
    de: { ended: 'Beendet', visited: 'Besucht' },
    fr: { ended: 'Terminé', visited: 'Visité' },
    es: { ended: 'Finalizado', visited: 'Visitado' },
    pt: { ended: 'Encerrada', visited: 'Visitado' },
    'zh-CN': { ended: '已结束', visited: '已到访' },
    'zh-TW': { ended: '已結束', visited: '已到訪' },
    da: { ended: 'Afsluttet', visited: 'Besøgt' },
    fi: { ended: 'Päättynyt', visited: 'Käyty' },
    sv: { ended: 'Avslutad', visited: 'Besökt' },
    et: { ended: 'Lõppenud', visited: 'Külastatud' },
};

function reorderPlanStopsFromActiveTrip(planStops: any[] = [], activeStops: any[] = []) {
    if (!Array.isArray(planStops) || !Array.isArray(activeStops) || activeStops.length === 0) return planStops;
    const stopMap = new Map<string, any>();
    planStops.forEach((stop) => {
        if (stop?.id) stopMap.set(`stop:${stop.id}`, stop);
        if (stop?.museumId) stopMap.set(`museum:${stop.museumId}`, stop);
        if (stop?.museum?.id) stopMap.set(`museum:${stop.museum.id}`, stop);
    });
    const used = new Set<any>();
    const ordered = activeStops
        .map((activeStop) => {
            const matched = (activeStop?.id && stopMap.get(`stop:${activeStop.id}`))
                || (activeStop?.museumId && stopMap.get(`museum:${activeStop.museumId}`));
            if (matched) used.add(matched);
            return matched;
        })
        .filter(Boolean);
    const leftovers = planStops.filter((stop) => !used.has(stop));
    return [...ordered, ...leftovers].map((stop, index) => ({ ...stop, order: index }));
}

export default function MyPlansPage() {
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { locale } = useApp();
    const { showAlert, showConfirm } = useModal();
    const [activeTripId, setActiveTripId] = useState<string | null>(null);
    const [isPendingTrip, setIsPendingTrip] = useState(false);
    const [tripStartDate, setTripStartDate] = useState<string | null>(null);
    const emptyActions = EMPTY_ACTION_LABELS[locale] || EMPTY_ACTION_LABELS.en;

    const applyActiveTrip = (parsed: any) => {
        if (parsed?.planId) {
            setActiveTripId(parsed.planId);
            setIsPendingTrip(!!parsed.pending);
            setTripStartDate(parsed.startDate || null);
            if (Array.isArray(parsed.stops)) {
                setPlans(prev => prev.map(plan => plan.id === parsed.planId
                    ? { ...plan, stops: reorderPlanStopsFromActiveTrip(plan.stops, parsed.stops) }
                    : plan
                ));
            }
        } else {
            setActiveTripId(null);
            setIsPendingTrip(false);
            setTripStartDate(null);
        }
    };

    const refreshActiveTrip = (event?: Event) => {
        const eventTrip = event instanceof CustomEvent ? event.detail : null;
        applyActiveTrip(eventTrip || getActiveTripForAccount());
    };

    useEffect(() => {
        // Hydrate active trip
        refreshActiveTrip();
        window.addEventListener('storage', refreshActiveTrip);
        window.addEventListener('focus', refreshActiveTrip);

        const loadPlans = () => fetch('/api/plans')
            .then(r => r.json())
            .then(res => {
                const parsed = getActiveTripForAccount();
                const nextPlans = (res.data || []).map((plan: any) => parsed?.planId === plan.id
                    ? { ...plan, stops: reorderPlanStopsFromActiveTrip(plan.stops, parsed.stops) }
                    : plan
                );
                setPlans(nextPlans);
                setLoading(false);
            })
            .catch(() => setLoading(false));
        loadPlans();
        const handleActiveTripChange = (event: Event) => {
            refreshActiveTrip(event);
            loadPlans();
        };
        window.addEventListener(ACTIVE_TRIP_CHANGE_EVENT, handleActiveTripChange);
        return () => {
            window.removeEventListener(ACTIVE_TRIP_CHANGE_EVENT, handleActiveTripChange);
            window.removeEventListener('storage', refreshActiveTrip);
            window.removeEventListener('focus', refreshActiveTrip);
        };
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
        showConfirm(t('plans.confirmEndTrip', locale), async () => {
            clearActiveTripForAccount();
            setActiveTripId(null);
            try { await fetch('/api/plans/active-trip', { method: 'DELETE' }); } catch { }
            showAlert(t('plans.tripEnded', locale));
        });
    };

    return (
        <div data-mm-page="plans" className="mm-nav-page-enter no-back-swipe mm-editorial-page2 mm-travel-page2 mm-plans-page2 w-full lg:max-w-[960px] mx-auto px-4 pt-4 sm:px-6 sm:pt-8 md:px-8 pb-32 lg:pb-10 overflow-visible">
            <div className="mm-gallery-hero p-5 sm:p-7 mb-5 sm:mb-6">
                {loading ? (
                    <>
                        <div className="mm-skel-line w-20 mb-4 opacity-40" />
                        <div className="mm-skel-line h-8 w-44 mb-3 opacity-50" />
                        <div className="mm-skel-line w-64 opacity-40" />
                    </>
                ) : (
                    <>
                        <div className="mm-gallery-kicker mb-3">
                            Travel
                            {plans.length > 0 && (
                                <span className="ml-2 rounded-full bg-white/12 px-2 py-0.5 text-[10px] text-blue-100">{plans.length}</span>
                            )}
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">{t('plans.title', locale)}</h1>
                        <p className="text-blue-100/80 mt-2 text-sm font-medium">{t('plans.subtitle', locale)}</p>
                    </>
                )}
            </div>

            {loading ? (
                <div className="flex flex-col gap-3 sm:gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="mm-actual-skeleton p-4 sm:p-5 relative overflow-hidden">
                            <div className="min-w-0 pr-8 sm:pr-10">
                                <div className={`mm-skel-line h-6 ${i === 0 ? 'w-2/5' : i === 1 ? 'w-1/3' : 'w-1/4'} mb-3`} />
                                <div className="flex items-center gap-2 mt-1.5">
                                    <div className="mm-skel-pill w-24" />
                                    <div className="mm-skel-pill w-16" />
                                </div>
                                <div className={`mm-skel-line ${i === 0 ? 'w-3/4' : 'w-1/2'} mt-3`} />
                                <div className="flex items-center gap-1 mt-3">
                                    {Array.from({ length: i === 0 ? 4 : i === 1 ? 3 : 2 }).map((_, j) => (
                                        <div key={j} className="mm-skel-block rounded-xl w-9 h-9 sm:w-10 sm:h-10 shrink-0" />
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : plans.length === 0 ? (
                <EmptyStateGame locale={locale} title={t('plans.empty', locale)} description={t('plans.emptyDesc', locale)}>
                    <div className="mm-travel-empty-actions mx-auto grid max-w-sm grid-cols-1 gap-2 sm:grid-cols-2">
                        <Link href="/saved" data-mm-route-pending="off" className="mm-travel-empty-action mm-travel-empty-action--primary">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v18l7-5 7 5V3H5z" />
                            </svg>
                            {emptyActions.primary}
                        </Link>
                        <Link href="/" data-mm-route-pending="off" className="mm-travel-empty-action">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                            {emptyActions.secondary}
                        </Link>
                    </div>
                </EmptyStateGame>
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
                        const isEnded = isTripEnded(plan);
                        const visitStats = getTripVisitStats(plan.stops || []);
                        const statusLabels = TRIP_STATUS_LABELS[locale] || TRIP_STATUS_LABELS.en;
                        const dDayNum = isPending && tripStartDate ? Math.ceil((new Date(tripStartDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000) : null;
                        const dDayText = dDayNum !== null ? (dDayNum > 0 ? `D-${dDayNum}` : dDayNum === 0 ? 'D-DAY' : '') : '';

                        return (
                            <a key={plan.id} href={`/plans/${plan.id}`}>
                                <GlassPanel className={`p-4 sm:p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group overflow-hidden relative active:scale-[0.98] !rounded-3xl ${isPending ? 'ring-2 ring-amber-400 bg-amber-50/50 dark:bg-amber-900/10 shadow-md' : isActive ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10 shadow-md' : 'shadow-sm'}`}>
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
                                            <h3 className="text-base sm:text-lg font-bold group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400 transition-colors truncate">
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
                                                <span className="shrink-0 text-[10px] sm:text-xs font-bold text-white bg-blue-500 px-2 py-0.5 rounded-full animate-pulse">
                                                    {({ ko: '여행 중', en: 'On Trip', ja: '旅行中', de: 'Auf Reise', fr: 'En voyage', es: 'De viaje', pt: 'Em viagem', zh: '旅行中', it: 'In viaggio', ru: 'В поездке', ar: 'في رحلة', hi: 'यात्रा पर', et: 'Reisil' } as Record<string, string>)[locale] || 'On Trip'}
                                                </span>
                                            )}
                                            {isEnded && !isActive && (
                                                <span className="shrink-0 text-[10px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/70 px-2 py-0.5 rounded-full">
                                                    {statusLabels.ended}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-blue-200/75 bg-blue-50/80 dark:bg-blue-900/25 px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                {dateStr}
                                            </span>
                                            <span className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-blue-200/75 bg-blue-50/80 dark:bg-blue-900/25 px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                {stopCount} {stopCount === 1 ? t('plans.stop', locale) : t('plans.stops', locale)}
                                            </span>
                                            {visitStats.total > 0 && (
                                                <span className="text-[11px] sm:text-xs font-medium text-emerald-600 dark:text-emerald-300 bg-emerald-50/90 dark:bg-emerald-950/35 px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                                                    {statusLabels.visited} {visitStats.visited}/{visitStats.total}
                                                </span>
                                            )}
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
                                                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden border-2 border-white dark:border-blue-950 shadow-sm bg-gray-100 dark:bg-blue-950/60">
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
                            </a>
                        );
                    })}
                </div>
            )}


        </div>
    );
}
