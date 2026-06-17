'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import { useModal } from '@/components/ui/Modal';
import { GlassPanel } from '@/components/ui/glass';
import { t } from '@/lib/i18n';
import { getLocalizedMuseumName } from '@/lib/getLocalizedName';
import dynamic from 'next/dynamic';
import * as gtag from '@/lib/gtag';
import LoadingAnimation from '@/components/ui/LoadingAnimation';
import CalendarPicker from '@/components/ui/CalendarPicker';
import { useDragReorder } from '@/hooks/useDragReorder';
import { backWithFallback, navigateWithPending, startRoutePending } from '@/lib/route-pending';

const RouteMapViewer = dynamic(() => import('@/components/map/RouteMapViewer'), { ssr: false });

function AutoRouteContent() {
    const searchParams = useSearchParams();
    const { showAlert } = useModal();
    const [route, setRoute] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveStarted, setSaveStarted] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState<string | null>(null);
    const { locale, darkMode } = useApp();

    // Drag reorder state (via useDragReorder hook below)
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

    useEffect(() => {
        const ids = searchParams.get('museums');
        if (!ids) {
            // Demo mode: fetch first 5 museums as sample route
            fetch('/api/museums?limit=5')
                .then(r => r.json())
                .then(res => {
                    const list = res.data?.data || res.data || [];
                    const demoRoute = list.map((m: any, i: number) => ({
                        museumId: m.id,
                        name: getLocalizedMuseumName(m, locale),
                        latitude: m.latitude,
                        longitude: m.longitude,
                        order: i,
                        expectedArrival: new Date(Date.now() + i * 2 * 60 * 60 * 1000),
                    }));
                    setRoute(demoRoute);
                    setLoading(false);
                })
                .catch(console.error);
            return;
        }

        // Call TSP generator
        fetch('/api/route/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ museumIds: ids.split(',') })
        })
            .then(r => r.json())
            .then(res => {
                if (res.data?.route) {
                    // Enrich with coordinates by fetching each museum
                    const stops = res.data.route;
                    // Fetch museum details for coordinates
                    Promise.all(
                        stops.map((s: any) =>
                            fetch(`/api/museums/${s.museumId}`)
                                .then(r => r.json())
                                .then(d => ({ ...s, latitude: d.data?.latitude, longitude: d.data?.longitude }))
                                .catch(() => s)
                        )
                    ).then(enriched => {
                        setRoute(enriched);
                        setLoading(false);
                    });
                } else {
                    setLoading(false);
                }
            })
            .catch(console.error);
    }, [searchParams]);

    const routeStops = useMemo(() =>
        route.filter(s => s.latitude && s.longitude).map(s => ({
            name: getLocalizedMuseumName(s, locale),
            latitude: s.latitude,
            longitude: s.longitude,
            order: s.order,
        })),
        [route, locale]
    );

    const handleSavePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        setSaveStarted(true);
        const formData = new FormData(e.target as HTMLFormElement);
        const title = formData.get('title') as string;

        try {
            const res = await fetch('/api/plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, date: startDate, startDate: startDate || null, endDate: endDate || null, stops: route })
            });
            const data = await res.json();
            if (res.ok && data.data) {
                gtag.event('save_plan', {
                    category: 'plan',
                    label: title,
                    value: route.length
                });
                startRoutePending(locale);
                navigateWithPending('/plans', locale);
            } else {
                console.error('[Save Plan Error]', data);
                showAlert(`${t('plans.saveError', locale)} ${data.error?.message || JSON.stringify(data.error) || ''}`);
                setSaving(false);
                setSaveStarted(false);
            }
        } catch (err: unknown) {
            console.error('[Save Plan Network Error]', err);
            const message = err instanceof Error ? err.message : String(err);
            showAlert(`${t('global.networkError', locale)} (${message})`);
            setSaving(false);
            setSaveStarted(false);
        }
    };

    // --- Long press + drag handlers ---
    const drag = useDragReorder({
        scope: 'new-plan-stops',
        longPressMs: 400,
        onReorder: (fromIndex, toIndex) => {
            setRoute(prevRoute => {
                const newRoute = [...prevRoute];
                const [moved] = newRoute.splice(fromIndex, 1);
                newRoute.splice(toIndex, 0, moved);
                return newRoute.map((s, i) => ({
                    ...s,
                    order: i,
                    expectedArrival: new Date(Date.now() + i * 2 * 60 * 60 * 1000),
                }));
            });
        },
    });
    const { dragIndex, overIndex, isDragging } = drag;

    if (loading) return <div className="flex flex-col items-center justify-center p-20 min-h-[400px]"><LoadingAnimation size={120} /></div>;

    return (
        <div className={`mm-route-create2 w-full max-w-[1080px] mx-auto px-4 py-4 sm:px-6 sm:py-8 md:px-8 mt-3 sm:mt-6 pb-32 lg:pb-8 ${isFromBack ? 'page-slide-in-back' : 'page-slide-in'}`}>
            {/* Sticky header */}
            <div className="mm-route-create2-head mb-4">
                <div className="flex items-center gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-[0.18em]">Route</span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight" style={{ color: 'var(--mm-text-primary)' }}>{t('plans.reviewAutoRoute', locale)}</h1>
                    </div>
                </div>
                <p className="mt-2 text-xs font-medium" style={{ color: 'var(--mm-text-tertiary)' }}>{t('plans.reviewAutoRouteDesc', locale)}</p>
            </div>

            {/* Mini Route Map Preview */}
            {routeStops.length > 0 && (
                <div className="mm-route-create2-map w-full h-80 sm:h-[420px] rounded-[28px] overflow-hidden mb-6">
                    <RouteMapViewer stops={routeStops} darkMode={darkMode} padding={{ top: 52, bottom: 52, left: 52, right: 52 }} />
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-5 md:gap-6">
                {/* Route Itinerary — mobile: first (order-1), desktop: second (md:order-2) */}
                <div className="w-full md:w-96 order-1 md:order-2">
                    <GlassPanel className="mm-route-create2-panel rounded-[28px] p-5 md:p-6 relative max-h-[50vh] md:max-h-[calc(100vh-8rem)] overflow-y-auto hide-scrollbar" intensity="light">
                        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] mb-4" style={{ color: 'var(--mm-text-tertiary)' }}>{t('plans.routeItinerary', locale)}</h3>
                        <div className="absolute left-9 md:left-10 top-16 bottom-8 w-0.5 bg-blue-100 dark:bg-blue-950/80 z-0"></div>

                        <div className="space-y-2.5 relative z-10">
                            {route.map((stop, i) => {
                                const isBeingDragged = dragIndex === i;
                                const isDropTarget = overIndex === i && dragIndex !== i;

                                return (
                                    <div
                                        key={stop.museumId || i}
                                        data-drag-index={i}
                                        data-drag-scope="new-plan-stops"
                                        className={`flex gap-3 md:gap-4 items-start transition-all cursor-grab active:cursor-grabbing select-none touch-none
                                            ${isBeingDragged ? 'opacity-50 scale-105 rounded-xl bg-gray-100 p-2 -m-2 z-20' : ''}
                                            ${isDropTarget ? 'border-t-2 border-primary pt-2 mt-2 -t-2' : ''}
                                        `}
                                        onPointerDown={(e) => drag.onPointerDown(i, e)}
                                        onPointerMove={drag.onPointerMove}
                                        onPointerCancel={drag.cancelPress}
                                        onPointerLeave={drag.cancelPress}
                                    >
                                        <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-semibold text-xs md:text-sm shrink-0 shadow-sm ${isBeingDragged ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'}`}>
                                            {i + 1}
                                        </div>
                                        <div className={`flex-1 p-3 md:p-3.5 rounded-2xl border flex justify-between items-center backdrop-blur-sm
                                            ${isBeingDragged ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/30 dark:border-blue-700' : 'border'}`} style={!isBeingDragged ? { background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' } : undefined}>
                                            <div>
                                                <h4 className="font-semibold text-sm" style={{ color: 'var(--mm-text-primary)' }}>{getLocalizedMuseumName(stop, locale)}</h4>
                                                <p className="text-[11px] mt-0.5 flex items-center gap-0.5 font-medium" style={{ color: 'var(--mm-text-tertiary)' }}>
                                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    {(() => {
                                                        const tp = (stop.type || '').toLowerCase();
                                                        let min = 90;
                                                        if (tp.includes('art') || tp.includes('미술')) min = 120;
                                                        else if (tp.includes('gallery') || tp.includes('갤러리')) min = 60;
                                                        const h = Math.floor(min / 60);
                                                        const m = min % 60;
                                                        if (locale === 'ko') return h > 0 ? (m > 0 ? `${h}시간 ${m}분` : `${h}시간`) : `${m}분`;
                                                        return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
                                                    })()}
                                                </p>
                                            </div>
                                            {isDragging && (
                                                <div className="text-gray-400 dark:text-gray-500">
                                                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {isDragging && (
                            <p className="text-xs text-blue-500 dark:text-blue-400 text-center mt-4 animate-pulse">
                                {t('plans.dragReorder', locale)}
                            </p>
                        )}
                    </GlassPanel>
                </div>

                {/* Form — mobile: second (order-2), desktop: first (md:order-1) */}
                <div className="flex-1 order-2 md:order-1">
                    <form onSubmit={handleSavePlan} className="mm-route-create2-form glass-panel gradient-border-subtle p-5 md:p-6 rounded-[28px]">
                        <div className="space-y-5 mb-6">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-[0.14em] mb-2 block" style={{ color: 'var(--mm-text-tertiary)' }}>{t('plans.tripTitle', locale)}</label>
                                <input name="title" required type="text" placeholder={t('plans.tripTitlePlaceholder', locale)} className="w-full rounded-2xl p-3.5 border focus:ring-blue-500 focus:border-blue-500 transition text-sm font-medium" style={{ background: 'var(--mm-surface-secondary)', borderColor: 'var(--mm-surface-border)', color: 'var(--mm-text-primary)' }} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-[0.14em] mb-2 block" style={{ color: 'var(--mm-text-tertiary)' }}>{locale === 'ko' ? '여행기간 설정' : 'Set Travel Period'}</label>
                                <input type="hidden" name="date" value={startDate} />
                                <CalendarPicker
                                    rangeMode
                                    startDate={startDate || undefined}
                                    endDate={endDate || undefined}
                                    onRangeChange={(s, e) => { setStartDate(s); setEndDate(e); }}
                                    onChange={() => { }}
                                    locale={locale}
                                    minDate={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`}
                                />
                                {!startDate && (
                                    <p className="text-[10px] text-red-400 mt-1.5 font-medium">{({ ko: '시작일과 종료일을 선택해 주세요', en: 'Please select start and end dates', ja: '開始日と終了日を選択してください', de: 'Bitte Start- und Enddatum wählen', fr: 'Sélectionnez les dates de début et de fin', es: 'Seleccione fechas de inicio y fin', pt: 'Selecione as datas de início e término', 'zh-CN': '请选择开始和结束日期', 'zh-TW': '請選擇開始和結束日期', da: 'Vælg start- og slutdato', fi: 'Valitse alku- ja loppupäivä', sv: 'Välj start- och slutdatum', et: 'Valige algus- ja lõppkuupäev' } as Record<string, string>)[locale] || 'Please select start and end dates'}</p>
                                )}
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={saving || !startDate || !endDate}
                            className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-2xl shadow-[0_14px_28px_rgba(37,99,235,0.18)] hover:bg-blue-700 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? t('plans.saving', locale) : t('plans.saveButton', locale)}
                        </button>
                        {saveStarted && (
                            <p className="mt-2 text-center text-[11px] font-semibold text-blue-500 dark:text-blue-300" role="status" aria-live="polite">
                                {t('plans.saving', locale)}
                            </p>
                        )}
                    </form>
                </div>
            </div>

            {/* Mobile: Floating back button — rendered via portal to escape transform container */}
            {typeof document !== 'undefined' && createPortal(
                <div className="lg:hidden fixed bottom-8 right-8 z-[9998] flex flex-col gap-2">
                    <button
                        onClick={() => backWithFallback('/saved', locale)}
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

export default function AutoRoutePlanPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><LoadingAnimation size={120} /></div>}>
            <AutoRouteContent />
        </Suspense>
    );
}
