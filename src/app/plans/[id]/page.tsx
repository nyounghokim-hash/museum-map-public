'use client';
import { useParams } from 'next/navigation';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useDragReorder } from '@/hooks/useDragReorder';
import ConfettiCanvas from '@/components/ui/ConfettiCanvas';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import { useSession } from 'next-auth/react';
import { useModal } from '@/components/ui/Modal';
import { t, formatDate } from '@/lib/i18n';
import { getCountryName, getCityName } from '@/lib/countries';
import { getLocalizedMuseumName } from '@/lib/getLocalizedName';
import { clearActiveTripForAccount, getActiveTripForAccount, setActiveTripForAccount } from '@/lib/accountStorage';

const RouteMapViewer = dynamic(() => import('@/components/map/RouteMapViewer'), { ssr: false });

export default function PlanDetailPage() {
    const { id } = useParams();
    const [plan, setPlan] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const { locale, darkMode } = useApp();
    const { showAlert, showConfirm } = useModal();
    const router = useRouter();
    const { data: session } = useSession();
    const isAdmin = session?.user?.email === 'nyoungho.kim@gmail.com';

    // Drag reorder state (handled by useDragReorder below)
    const [hydrated, setHydrated] = useState(false);
    const [activeTripId, setActiveTripId] = useState<string | null>(null);
    const [stops, setStops] = useState<any[]>([]);
    const [isDirty, setIsDirty] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [isFromBack, setIsFromBack] = useState(false);
    const [calMonth, setCalMonth] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const backTs = sessionStorage.getItem('navigating-back');
            if (backTs && Date.now() - parseInt(backTs) < 500) {
                setIsFromBack(true);
            }
            sessionStorage.removeItem('navigating-back');
        }
    }, []);

    // Sync calendar month to plan's startDate when data loads
    useEffect(() => {
        if (plan?.startDate) {
            const sd = new Date(plan.startDate);
            setCalMonth(new Date(sd.getFullYear(), sd.getMonth(), 1));
        }
    }, [plan?.startDate]);

    // Initial fetch
    useEffect(() => {
        if (typeof id === 'string' && id.startsWith('guest-plan-')) {
            const storedPlans = localStorage.getItem('guest-plans');
            if (storedPlans) {
                try {
                    const parsed = JSON.parse(storedPlans);
                    const found = parsed.find((p: any) => p.id === id);
                    if (found) {
                        setPlan(found);
                        setStops(found.stops || []);
                    } else {
                        setError('Plan not found in local storage');
                    }
                } catch (e) {
                    setError('Failed to parse local plans');
                }
            } else {
                setError('No local plans found');
            }
            setLoading(false);
            return;
        }

        fetch(`/api/plans/${id}`)
            .then(res => res.json())
            .then(data => {
                if (data.data) {
                    setPlan(data.data);
                    const dbStops = data.data.stops?.sort((a: any, b: any) => a.order - b.order) || [];
                    setStops(dbStops);
                } else {
                    setError('Plan not found');
                }
                setLoading(false);
            })
            .catch(() => {
                setError('Failed to load plan');
                setLoading(false);
            });

        // Hydrate active trip
        const parsed = getActiveTripForAccount();
        if (parsed?.planId) setActiveTripId(parsed.planId);
        setHydrated(true); // Set hydrated to true after initial load
    }, [id]);

    // Removed useMemo for stops as it's now a state variable

    const routeStops = useMemo(() => {
        return stops
            .filter((s: any) => s.museum?.latitude && s.museum?.longitude)
            .map((s: any, i: number) => ({
                name: getLocalizedMuseumName(s.museum, locale),
                latitude: s.museum.latitude,
                longitude: s.museum.longitude,
                order: i,
                museumId: s.museum.id,
            }));
    }, [stops]);

    // --- Long press + drag handlers ---
    const drag = useDragReorder({
        scope: 'plan-stops',
        longPressMs: 400,
        onReorder: (fromIndex, toIndex) => {
            const newStops = [...stops];
            const [moved] = newStops.splice(fromIndex, 1);
            newStops.splice(toIndex, 0, moved);
            const updated = newStops.map((s, i) => ({ ...s, order: i }));
            setStops(updated);
            setPlan((prev: any) => ({ ...prev, stops: updated }));

            // Auto-save immediately
            const body = { stops: updated.map((s: any, i: number) => ({ id: s.id, order: i })) };
            fetch(`/api/plans/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }).then(() => {
                if (activeTripId === id) {
                    const newRouteStops = updated
                        .filter((s: any) => s.museum?.latitude && s.museum?.longitude)
                        .map((s: any, i: number) => ({
                            name: getLocalizedMuseumName(s.museum, locale),
                            latitude: s.museum.latitude,
                            longitude: s.museum.longitude,
                            order: i,
                            museumId: s.museum.id,
                        }));
                    const parsed = getActiveTripForAccount();
                    if (parsed) setActiveTripForAccount({ ...parsed, stops: newRouteStops });
                }
            }).catch(() => { });
            setIsDirty(true);
        },
    });
    const { dragIndex, overIndex, isDragging } = drag;

    // Mobile: top drawer occupies up to 65vh when open, ~120px when closed.
    // Pad the map so the route stays in the visible area below the drawer.
    const [viewportH, setViewportH] = useState(0);
    useEffect(() => {
        const handler = () => setViewportH(window.innerHeight);
        handler();
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);
    const mobileMapPadding = useMemo(() => ({
        top: sidebarOpen ? Math.round(viewportH * 0.65) + 24 : 140,
        bottom: 80,
        left: 40,
        right: 40,
    }), [sidebarOpen, viewportH]);

    const handleSave = useCallback(async () => {
        if (!plan?.stops) return;
        const body: any = { stops: stops.map((s: any, i: number) => ({ id: s.id, order: i })) };
        // Include dates in save
        if (plan.startDate !== undefined) body.startDate = plan.startDate;
        if (plan.endDate !== undefined) body.endDate = plan.endDate;
        try {
            await fetch(`/api/plans/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            setIsDirty(false);

            // Sync with activeTrip if this plan is the active one
            if (activeTripId === id) {
                const parsed = getActiveTripForAccount();
                if (parsed) setActiveTripForAccount({ ...parsed, stops: routeStops });
            }

            showAlert(t('plans.saved', locale));
        } catch {
            showAlert(t('global.saveError', locale));
        }
    }, [stops, routeStops, activeTripId, id, showAlert, locale, plan]);

    const [showPendingModal, setShowPendingModal] = useState(false);

    const handleStartTrip = useCallback(async () => {
        if (!plan) return;
        const startDate = plan.startDate || null;
        const endDate = plan.endDate || null;
        const now = new Date();

        // Check if startDate is in the future (trip hasn't started yet)
        const isFuture = startDate && new Date(startDate) > now;

        const tripData = {
            planId: id,
            title: plan.title || 'AutoRoute',
            stops: routeStops,
            startTime: new Date().toISOString(),
            startDate: startDate || now.toISOString(),
            endDate,
            pending: isFuture && !isAdmin, // admin bypasses pending
        };
        setActiveTripForAccount(tripData);
        setActiveTripId(id as string);
        // Sync to server (fire-and-forget — don't block UI)
        fetch(`/api/plans/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: true, startDate: tripData.startDate, endDate })
        }).catch(e => console.error('Failed to sync trip dates', e));

        if (isFuture && !isAdmin) {
            // Show pending modal
            setShowPendingModal(true);
            setTimeout(() => {
                setShowPendingModal(false);
                router.push('/');
            }, 3000);
        } else if (isAdmin && isFuture) {
            // Admin: schedule activation after 10 seconds
            const adminTripData = { ...tripData, pending: true, adminAutoActivate: Date.now() + 10000 };
            setActiveTripForAccount(adminTripData);
            setShowPendingModal(true);
            setTimeout(() => {
                setShowPendingModal(false);
                router.push('/');
            }, 3000);
        } else {
            // Start immediately with confetti
            setShowConfetti(true);
            setTimeout(() => {
                setShowConfetti(false);
                router.push('/');
            }, 3000);
        }
    }, [plan, routeStops, id, router, showAlert, locale, isAdmin]);

    const handleEndTrip = useCallback(() => {
        showConfirm(t('plans.confirmEndTrip', locale), () => {
            clearActiveTripForAccount();
            setActiveTripId(null);
            showAlert(t('plans.tripEnded', locale));
        });
    }, [locale, showAlert, showConfirm]);

    const handleStopClick = useCallback((stop: any) => {
        if (stop.museumId) {
            router.push(`/museums/${stop.museumId}`);
        }
    }, [router]);

    if (loading) return null;
    if (error) return (
        <div className="p-20 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
            <Link href="/plans" className="text-blue-600 font-semibold hover:underline">{t('detail.backToMap', locale)}</Link>
        </div>
    );

    // Estimated visit duration by museum type (in minutes)
    const getVisitDuration = (type?: string): number => {
        const t = (type || '').toLowerCase();
        if (t.includes('art') || t.includes('미술')) return 120;
        if (t.includes('science') || t.includes('과학')) return 90;
        if (t.includes('history') || t.includes('역사')) return 90;
        if (t.includes('gallery') || t.includes('갤러리')) return 60;
        return 90; // default
    };
    const formatDuration = (min: number, loc: string): string => {
        const h = Math.floor(min / 60);
        const m = min % 60;
        if (loc === 'ko') return h > 0 ? (m > 0 ? `약 ${h}시간 ${m}분` : `약 ${h}시간`) : `약 ${m}분`;
        return h > 0 ? (m > 0 ? `~${h}h ${m}m` : `~${h}h`) : `~${m}m`;
    };

    const dateStr = plan?.date ? formatDate(plan.date, locale) : '';
    const now = new Date();

    return (
        <>
            {/* Confetti popup overlay */}
            {showConfetti && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <ConfettiCanvas duration={3000} />
                    <div className="relative rounded-3xl p-8 shadow-2xl text-center max-w-sm mx-4 animate-fadeInUp glass-popup">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-extrabold dark:text-white mb-2">{t('plans.tripStartedTitle', locale)}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t('plans.tripStartedDesc', locale)}</p>
                    </div>
                </div>
            )}
            {/* Pending trip modal overlay */}
            {showPendingModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="relative rounded-3xl p-8 shadow-2xl text-center max-w-sm mx-4 animate-fadeInUp glass-popup">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-extrabold dark:text-white mb-2">{({ ko: '여행이 시작되면 알려드릴게요!', en: "We'll notify you when your trip starts!", ja: '旅行が始まったらお知らせします！', de: 'Wir benachrichtigen Sie, wenn Ihre Reise beginnt!', fr: 'Nous vous informerons au début du voyage !', es: '¡Te avisaremos cuando comience tu viaje!', pt: 'Avisaremos quando sua viagem começar!', zh: '旅行开始时会通知您！', it: 'Ti avviseremo quando inizierà il viaggio!', ru: 'Мы сообщим, когда начнётся поездка!', ar: 'سنخبرك عندما تبدأ رحلتك!', hi: 'जब आपकी यात्रा शुरू होगी, हम आपको सूचित करेंगे!', et: 'Teavitame sind, kui reis algab!' } as Record<string, string>)[locale] || "We'll notify you when your trip starts!"}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{({ ko: '여행 시작일이 되면 자동으로 활성화됩니다.', en: 'Your trip will automatically activate on the start date.', ja: '旅行開始日に自動的にアクティブになります。', de: 'Ihre Reise wird am Startdatum automatisch aktiviert.', fr: 'Votre voyage sera activé automatiquement à la date de début.', es: 'Tu viaje se activará automáticamente en la fecha de inicio.', pt: 'Sua viagem será ativada automaticamente na data de início.', zh: '您的旅行将在出发日期自动激活。', it: 'Il viaggio si attiverà automaticamente alla data di partenza.', ru: 'Поездка активируется автоматически в дату начала.', ar: 'ستبدأ رحلتك تلقائياً في تاريخ البدء.', hi: 'आपकी यात्रा शुरू होने की तारीख पर स्वचालित रूप से सक्रिय हो जाएगी।', et: 'Reis aktiveerub automaatselt alguskuupäeval.' } as Record<string, string>)[locale] || 'Your trip will automatically activate on the start date.'}</p>
                    </div>
                </div>
            )}
            <div className={`hidden sm:flex sm:flex-row h-[calc(100vh-3.5rem)] ${isExiting ? 'page-slide-out' : isFromBack ? 'page-slide-in-back' : 'page-slide-in'}`}>
                {/* Sidebar: Route List */}
                <div className="flex flex-col w-96 border-r shrink-0" style={{ background: 'var(--glass-bg-heavy)', borderColor: 'var(--glass-border)', backdropFilter: 'blur(24px) saturate(180%)' }}>
                    <div className="p-6 pb-0 flex flex-col shrink-0">
                        <Link href="/plans" className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded-full mb-4 transition-colors shadow-sm active:scale-95 shrink-0" title={t('plans.title', locale)}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </Link>
                        <h1 className="text-4xl font-extrabold mb-2 dark:text-white">{plan?.title || 'AutoRoute'}</h1>
                    </div>

                    {/* Scrollable stop list */}
                    <div className="flex-1 overflow-y-auto px-6 pb-4">
                        <div className="space-y-3 relative">
                            <div className="absolute left-[27px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-neutral-700 z-0"></div>
                            {stops.map((stop: any, i: number) => {
                                const arrival = stop.expectedArrival ? new Date(stop.expectedArrival) : new Date(now.getTime() + i * 2 * 60 * 60 * 1000);
                                const timeStr = arrival.toLocaleTimeString(locale === 'zh-CN' ? 'zh-Hans' : locale === 'zh-TW' ? 'zh-Hant' : locale, { hour: '2-digit', minute: '2-digit' });
                                const isBeingDragged = dragIndex === i;
                                const isDropTarget = overIndex === i && dragIndex !== i;
                                return (
                                    <div key={stop.id || i}
                                        data-drag-index={i}
                                        data-drag-scope="plan-stops"
                                        className={`relative z-10 flex gap-4 p-3 rounded-xl border transition-all select-none touch-none
                                        ${isBeingDragged ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 shadow-lg scale-[1.02] opacity-80'
                                                : isDropTarget ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-600 border-dashed'
                                                    : 'border shadow-sm hover:shadow-md'}`}
                                                style={!isBeingDragged ? { background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' } : undefined}
                                        onPointerDown={(e) => drag.onPointerDown(i, e)}
                                        onPointerMove={drag.onPointerMove}
                                        onPointerCancel={drag.cancelPress}
                                        onPointerLeave={drag.cancelPress}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${isBeingDragged ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-500 text-white shadow-sm'}`}>{i + 1}</div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-bold text-base truncate dark:text-white">{getLocalizedMuseumName(stop.museum, locale) || `Stop ${i + 1}`}</h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                <svg className="w-3 h-3 inline-block mr-0.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                {formatDuration(getVisitDuration(stop.museum?.type), locale)}
                                            </p>
                                        </div>
                                        {isDragging && <div className="flex items-center text-gray-300 dark:text-gray-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" /></svg></div>}
                                    </div>
                                );
                            })}
                            {stops.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500 pl-12">{t('plans.noStops', locale)}</p>}
                        </div>
                        {isDragging && <p className="text-xs text-blue-500 dark:text-blue-400 text-center mt-3 animate-pulse">{t('plans.dragReorder', locale)}</p>}

                        {/* Travel date range calendar — below stops */}
                        {(() => {
                            const sd = plan?.startDate ? new Date(plan.startDate) : null;
                            const ed = plan?.endDate ? new Date(plan.endDate) : null;
                            const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
                            const firstDow = calMonth.getDay();
                            const cells: (number | null)[] = [];
                            for (let i = 0; i < firstDow; i++) cells.push(null);
                            for (let d = 1; d <= daysInMonth; d++) cells.push(d);

                            const toYMD = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                            const sdStr = sd ? toYMD(sd) : '';
                            const edStr = ed ? toYMD(ed) : '';

                            const handleDayClick = (day: number) => {
                                const clicked = new Date(calMonth.getFullYear(), calMonth.getMonth(), day);
                                const clickedISO = clicked.toISOString();
                                if (!sd || (sd && ed)) {
                                    setPlan((p: any) => ({ ...p, startDate: clickedISO, endDate: null }));
                                    setIsDirty(true);
                                } else {
                                    if (clicked < sd) {
                                        setPlan((p: any) => ({ ...p, startDate: clickedISO, endDate: null }));
                                    } else {
                                        setPlan((p: any) => ({ ...p, endDate: clickedISO }));
                                    }
                                    setIsDirty(true);
                                }
                            };

                            const monthLabel = calMonth.toLocaleDateString(locale === 'ko' ? 'ko-KR' : locale, { year: 'numeric', month: 'long' });
                            const weekDays = locale === 'ko' ? ['일', '월', '화', '수', '목', '금', '토'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

                            return (
                                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-neutral-800">
                                    <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] mb-2 block">{locale === 'ko' ? '여행기간 설정' : 'Set Travel Period'}</label>
                                    {sd && (
                                        <div className="flex items-center gap-2 mb-2 text-xs font-bold">
                                            <span className="px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                                {sd.toLocaleDateString(locale === 'ko' ? 'ko-KR' : locale, { month: 'short', day: 'numeric' })}
                                            </span>
                                            {ed && (
                                                <>
                                                    <span className="text-gray-300 dark:text-gray-600">→</span>
                                                    <span className="px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                                        {ed.toLocaleDateString(locale === 'ko' ? 'ko-KR' : locale, { month: 'short', day: 'numeric' })}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between mb-2">
                                        <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 transition">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <span className="text-xs font-bold dark:text-white">{monthLabel}</span>
                                        <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 transition">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-7 gap-0 mb-1">
                                        {weekDays.map((d, i) => (
                                            <div key={i} className={`text-center text-[9px] font-bold py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>{d}</div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 gap-0">
                                        {cells.map((day, i) => {
                                            if (day === null) return <div key={i} />;
                                            const dt = new Date(calMonth.getFullYear(), calMonth.getMonth(), day);
                                            const ymd = toYMD(dt);
                                            const isStart = ymd === sdStr;
                                            const isEnd = ymd === edStr;
                                            const inRange = sd && ed && dt > sd && dt < ed;
                                            const isToday = toYMD(new Date()) === ymd;
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => handleDayClick(day)}
                                                    className={`relative h-8 text-xs font-medium transition-all rounded-lg
                                                        ${isStart || isEnd ? 'bg-blue-600 text-white font-bold shadow-sm' : ''}
                                                        ${inRange ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : ''}
                                                        ${!isStart && !isEnd && !inRange ? 'hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300' : ''}
                                                        ${isToday && !isStart && !isEnd ? 'ring-1 ring-blue-300 dark:ring-blue-700' : ''}
                                                    `}
                                                >
                                                    {day}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Sticky bottom buttons */}
                    <div className="p-4 border-t space-y-2 shrink-0" style={{ background: 'var(--glass-bg-heavy)', borderColor: 'var(--glass-border)' }}>
                        <button onClick={handleSave} disabled={!isDirty || !plan?.startDate || !plan?.endDate}
                            className={`w-full py-3 rounded-xl font-bold transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900 ${isDirty && plan?.startDate && plan?.endDate ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md' : 'bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50'}`}
                        >{t('plans.saveButton', locale)}</button>
                        {activeTripId === plan?.id ? (
                            <button onClick={handleEndTrip} className="w-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 py-3 rounded-xl font-bold hover:bg-red-100 dark:hover:bg-red-900/50 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900">{t('plans.endTrip', locale)}</button>
                        ) : (
                            <button onClick={handleStartTrip} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900">{t('plans.startTripButton', locale)}</button>
                        )}
                    </div>
                </div>

                {/* Right Content: Route Map */}
                <div className="flex-1 relative min-h-[300px]">
                    {routeStops.length > 0 ? (
                        <RouteMapViewer stops={routeStops} onStopClick={handleStopClick} darkMode={darkMode} padding={{ top: 80, bottom: 80, left: 80, right: 80 }} />
                    ) : (
                        <div className="w-full h-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                            <span className="text-zinc-500 font-medium bg-white/50 dark:bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">{t('plans.noRouteData', locale)}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile/Tablet: Map fullscreen + top drawer */}
            <div className={`sm:hidden relative h-[calc(100vh-3.5rem)] ${isExiting ? 'page-slide-out' : isFromBack ? 'page-slide-in-back' : 'page-slide-in'}`}>
                {/* Full-screen map */}
                <div className="absolute inset-0">
                    {routeStops.length > 0 ? (
                        <RouteMapViewer stops={routeStops} onStopClick={handleStopClick} darkMode={darkMode} padding={mobileMapPadding} />
                    ) : (
                        <div className="w-full h-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                            <span className="text-zinc-500 font-medium bg-white/50 dark:bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">{t('plans.noRouteData', locale)}</span>
                        </div>
                    )}
                </div>

                {/* Top drawer */}
                <div className={`absolute left-0 right-0 top-0 z-30 backdrop-blur-md rounded-b-3xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] flex flex-col transition-[max-height] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden ${sidebarOpen ? 'max-h-[65vh]' : 'max-h-[120px]'}`} style={{ background: 'var(--glass-bg-heavy)' }}>
                    {/* Header */}
                    <div className="px-4 pt-3 pb-2 flex items-center gap-3 shrink-0">
                        <div className="min-w-0 flex-1">
                            <h2 className="text-base font-extrabold dark:text-white truncate">{plan?.title || 'AutoRoute'}</h2>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate">
                                {stops.length} {t('plans.stops', locale)} {dateStr && `· ${dateStr}`}
                            </p>
                        </div>
                        <button onClick={() => setSidebarOpen(prev => !prev)} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                            <svg className={`w-4 h-4 transition-transform duration-300 ${sidebarOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>

                    {/* Action buttons — always visible */}
                    <div className="px-4 pb-3 flex gap-2 shrink-0">
                        <button onClick={handleSave} disabled={!isDirty || !plan?.startDate || !plan?.endDate}
                            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors active:scale-[0.98] ${isDirty && plan?.startDate && plan?.endDate ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-gray-500 opacity-50'}`}
                        >{t('plans.saveButton', locale)}</button>
                        {activeTripId === plan?.id ? (
                            <button onClick={handleEndTrip} className="flex-1 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 py-2.5 rounded-xl font-bold text-sm transition-colors active:scale-[0.98]">{t('plans.endTrip', locale)}</button>
                        ) : (
                            <button onClick={handleStartTrip} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold text-sm transition-colors active:scale-[0.98]">{t('plans.startTripButton', locale)}</button>
                        )}
                    </div>

                    {/* Expandable stop list */}
                    <div className={`px-4 pb-6 overflow-y-auto flex-1 min-h-0 transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
                        <div className="space-y-2.5 relative">
                            <div className="absolute left-[23px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-neutral-700 z-0"></div>
                            {stops.map((stop: any, i: number) => {
                                const isBeingDragged = dragIndex === i;
                                const isDropTarget = overIndex === i && dragIndex !== i;
                                return (
                                    <div key={stop.id || i}
                                        data-drag-index={i}
                                        data-drag-scope="plan-stops"
                                        className={`relative z-10 flex gap-3 p-2.5 rounded-xl border transition-all select-none touch-none
                                            ${isBeingDragged ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 shadow-lg scale-[1.02] opacity-80'
                                                : isDropTarget ? 'bg-green-50 dark:bg-green-900/20 border-green-300 border-dashed'
                                                    : 'border shadow-sm'}`}
                                                style={!isBeingDragged ? { background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' } : undefined}
                                        onPointerDown={(e) => drag.onPointerDown(i, e)}
                                        onPointerMove={drag.onPointerMove}
                                        onPointerCancel={drag.cancelPress}
                                        onPointerLeave={drag.cancelPress}
                                    >
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${isBeingDragged ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'}`}>{i + 1}</div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-bold text-sm truncate dark:text-white">{getLocalizedMuseumName(stop.museum, locale) || `Stop ${i + 1}`}</h3>
                                            <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate flex items-center gap-0.5">
                                                <svg className="w-2.5 h-2.5 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                {formatDuration(getVisitDuration(stop.museum?.type), locale)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Handle at bottom */}
                    <button onClick={() => setSidebarOpen(prev => !prev)} className="flex justify-center w-full pb-2 pt-1 shrink-0">
                        <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-neutral-600" />
                    </button>
                </div>
            </div>

            {/* Mobile: Floating back button — rendered via portal to escape transform container */}
            {typeof document !== 'undefined' && createPortal(
                <div className="lg:hidden fixed bottom-8 right-8 z-[9998] flex flex-col gap-2">
                    <button
                        onClick={() => { setIsExiting(true); if (typeof window !== 'undefined') sessionStorage.setItem('navigating-back', String(Date.now())); setTimeout(() => router.back(), 200); }}
                        className="w-14 h-14 flex items-center justify-center rounded-full bg-neutral-800/90 dark:bg-white/90 backdrop-blur-md text-white dark:text-gray-800 shadow-lg border border-neutral-700/60 dark:border-gray-200/60 active:scale-95 transition-all hover:bg-neutral-700 dark:hover:bg-gray-100"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                </div>,
                document.body
            )}
        </>
    );
}
