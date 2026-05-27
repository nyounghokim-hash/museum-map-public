'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/components/AppContext';
import { getLocalizedMuseumName, getLocalizedCityName } from '@/lib/getLocalizedName';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    museums: any[];
    onMuseumClick: (id: string) => void;
    /** Horizontal anchor for the popup relative to its trigger button. Defaults to 'left'. */
    anchor?: 'left' | 'right';
    /** Vertical placement — 'below' opens downward (default), 'above' opens upward. */
    vertical?: 'below' | 'above';
    /**
     * Positioning mode.
     *  - 'popover' (default): fixed, computed from triggerRef's bounding rect
     *  - 'fixed-bottom': viewport-fixed near bottom, centered — guarantees popup stays on-screen on mobile
     */
    mode?: 'popover' | 'fixed-bottom';
    /** Trigger element ref — required for 'popover' mode positioning. */
    triggerRef?: RefObject<HTMLElement | null>;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

export default function NearbyPopup({ isOpen, onClose, museums, onMuseumClick, anchor = 'left', vertical = 'below', mode = 'popover', triggerRef }: Props) {
    const { locale } = useApp();
    type State = 'idle' | 'loading' | 'ready' | 'denied' | 'unsupported';
    const [state, setState] = useState<State>('idle');
    const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on outside click (ignores the panel itself and the trigger button)
    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e: MouseEvent) => {
            const target = e.target as Node;
            if (panelRef.current?.contains(target)) return;
            if (triggerRef?.current?.contains(target)) return;
            onClose();
        };
        // Defer binding by one tick so the opening click doesn't immediately close.
        const tid = setTimeout(() => document.addEventListener('mousedown', handleClick, true), 0);
        return () => { clearTimeout(tid); document.removeEventListener('mousedown', handleClick, true); };
    }, [isOpen, onClose, triggerRef]);

    // Measure trigger position for popover mode
    useLayoutEffect(() => {
        if (!isOpen || mode !== 'popover' || !triggerRef?.current) return;
        const computePosition = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const popupWidth = Math.min(300, window.innerWidth - 24);
            const gap = 8;
            const style: React.CSSProperties = { position: 'fixed', width: popupWidth };
            if (vertical === 'below') style.top = Math.round(rect.bottom + gap);
            else style.bottom = Math.round(window.innerHeight - rect.top + gap);
            // Compute left always, clamped to viewport
            const desiredLeft = anchor === 'right' ? rect.right - popupWidth : rect.left;
            style.left = Math.max(12, Math.min(desiredLeft, window.innerWidth - popupWidth - 12));
            setPopoverStyle(style);
        };
        computePosition();
        window.addEventListener('resize', computePosition);
        window.addEventListener('scroll', computePosition, true);
        return () => {
            window.removeEventListener('resize', computePosition);
            window.removeEventListener('scroll', computePosition, true);
        };
    }, [isOpen, mode, triggerRef, anchor, vertical]);

    useEffect(() => {
        if (!isOpen) return;
        if (userPos) return;
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            setState('unsupported');
            return;
        }
        setState('loading');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setState('ready');
            },
            () => setState('denied'),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
        );
    }, [isOpen, userPos]);

    const nearby = useMemo(() => {
        if (!userPos) return [];
        return museums
            .filter((m: any) => typeof m?.latitude === 'number' && typeof m?.longitude === 'number')
            .map((m: any) => ({ ...m, distance: haversineKm(userPos.lat, userPos.lng, m.latitude, m.longitude) }))
            .sort((a: any, b: any) => a.distance - b.distance)
            .slice(0, 8);
    }, [userPos, museums]);

    if (!isOpen) return null;
    // Popover mode: wait for layout-measured position before rendering to avoid
    // a one-frame flash at top-left of body (the absolute-fallback position).
    if (mode === 'popover' && !popoverStyle) return null;

    const headerText = locale === 'ko' ? '내 주변 박물관' : 'Nearby Museums';

    // WCAG AA: 다크 지도·이미지 위에서도 팝업이 뚜렷이 구분되도록 완전 불투명 + 경계 강화 + 더 짙은 그림자
    const commonClass = 'bg-white dark:bg-neutral-900 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.25)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.65)] border border-gray-200 dark:border-neutral-700 z-[9999] animate-fadeInUp overflow-hidden';
    const panel = (
        <div
            ref={panelRef}
            role="dialog"
            aria-label={headerText}
            style={mode === 'popover' ? popoverStyle! : undefined}
            className={
                mode === 'fixed-bottom'
                    ? `fixed bottom-[calc(env(safe-area-inset-bottom,0px)+104px)] left-3 right-3 w-auto max-w-[400px] mx-auto ${commonClass}`
                    : commonClass
            }
        >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-neutral-700">
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-500 dark:text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {headerText}
                </h3>
                <button
                    onClick={onClose}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-neutral-900"
                    aria-label={locale === 'ko' ? '닫기' : 'Close'}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="max-h-[380px] overflow-y-auto">
                {state === 'loading' && (
                    <div className="py-10 flex flex-col items-center gap-2 text-gray-500 dark:text-gray-300">
                        <div className="w-5 h-5 rounded-full border-2 border-purple-300 dark:border-purple-600 border-t-purple-600 dark:border-t-purple-300 animate-spin" />
                        <p className="text-xs">{locale === 'ko' ? '현재 위치를 확인하는 중이에요' : 'Locating…'}</p>
                    </div>
                )}
                {state === 'denied' && (
                    <div className="py-8 px-5 text-center">
                        <p className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
                            {locale === 'ko' ? '현재 위치를 사용하려면 권한이 필요해요' : 'Location permission required'}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            {locale === 'ko' ? '브라우저 설정에서 위치 접근을 허용해주세요.' : 'Allow location access in browser settings'}
                        </p>
                    </div>
                )}
                {state === 'unsupported' && (
                    <div className="py-8 px-5 text-center text-[11px] text-gray-600 dark:text-gray-300">
                        {locale === 'ko' ? '이 브라우저에서는 현재 위치를 사용할 수 없어요' : 'Geolocation is not supported'}
                    </div>
                )}
                {state === 'ready' && nearby.length === 0 && (
                    <div className="py-8 px-5 text-center text-[11px] text-gray-600 dark:text-gray-300">
                        {locale === 'ko' ? '가까운 박물관을 찾지 못했어요' : 'No museums found nearby'}
                    </div>
                )}
                {state === 'ready' && nearby.map((m: any) => (
                    <button
                        key={m.id}
                        onClick={() => { onMuseumClick(m.id); onClose(); }}
                        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-purple-50 dark:hover:bg-purple-900/30 active:scale-[0.98] transition text-left border-b border-gray-100 dark:border-neutral-800 last:border-0 focus-visible:outline-none focus-visible:bg-purple-50 dark:focus-visible:bg-purple-900/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500"
                    >
                        <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-xs text-gray-900 dark:text-white truncate">
                                {getLocalizedMuseumName(m, locale) || m.name}
                            </h4>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                {getLocalizedCityName(m, locale) || m.city}
                            </p>
                        </div>
                        <div className="shrink-0 px-2 py-1 rounded-lg bg-purple-100 dark:bg-purple-800/60 text-purple-700 dark:text-purple-100 text-[11px] font-bold font-mono">
                            {m.distance < 1 ? `${Math.round(m.distance * 1000)}m` : `${m.distance.toFixed(1)}km`}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );

    // Always portal to body so the popup escapes ancestor stacking contexts
    // (backdrop-filter, transform, z-index) that would otherwise trap it.
    if (typeof document !== 'undefined') {
        return createPortal(panel, document.body);
    }
    return null;
}
