'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/components/AppContext';
import { getLocalizedMuseumName, getLocalizedCityName } from '@/lib/getLocalizedName';
import { resolveMuseumOpenStatus } from '@/lib/openStatus';

const NEARBY_LABELS: Record<string, {
    title: string;
    close: string;
    locating: string;
    deniedTitle: string;
    deniedBody: string;
    unsupported: string;
    empty: string;
    statusTitle: string;
    statusNote: string;
}> = {
    ko: { title: '내 주변 미술관/박물관', close: '닫기', locating: '현재 위치를 확인하는 중이에요', deniedTitle: '현재 위치를 사용하려면 권한이 필요해요', deniedBody: '브라우저 설정에서 위치 접근을 허용해 주세요.', unsupported: '이 브라우저에서는 현재 위치를 사용할 수 없어요', empty: '주변에서 표시할 미술관/박물관을 찾지 못했어요', statusTitle: '운영 정보', statusNote: '박물관 및 미술관별 입장 마감 시간이 상이할 수 있습니다.' },
    en: { title: 'Nearby Museums', close: 'Close', locating: 'Locating...', deniedTitle: 'Location permission required', deniedBody: 'Allow location access in browser settings', unsupported: 'Geolocation is not supported', empty: 'No museums found nearby', statusTitle: 'Hours', statusNote: 'Last admission times may vary by museum or gallery.' },
    ja: { title: '周辺のミュージアム', close: '閉じる', locating: '現在地を確認しています', deniedTitle: '位置情報の許可が必要です', deniedBody: 'ブラウザ設定で位置情報アクセスを許可してください。', unsupported: 'このブラウザでは位置情報を使用できません', empty: '周辺に表示できるミュージアムが見つかりません', statusTitle: '営業時間', statusNote: '最終入場時間はミュージアムごとに異なる場合があります。' },
    de: { title: 'Museen in der Nähe', close: 'Schließen', locating: 'Standort wird ermittelt...', deniedTitle: 'Standortberechtigung erforderlich', deniedBody: 'Erlauben Sie den Standortzugriff in den Browsereinstellungen.', unsupported: 'Geolokalisierung wird nicht unterstützt', empty: 'Keine Museen in der Nähe gefunden', statusTitle: 'Öffnungszeiten', statusNote: 'Letzter Einlass kann je nach Museum oder Galerie variieren.' },
    fr: { title: 'Musées à proximité', close: 'Fermer', locating: 'Localisation...', deniedTitle: 'Autorisation de localisation requise', deniedBody: 'Autorisez l’accès à la position dans les paramètres du navigateur.', unsupported: 'La géolocalisation n’est pas prise en charge', empty: 'Aucun musée trouvé à proximité', statusTitle: 'Horaires', statusNote: 'L’heure de dernière admission peut varier selon le musée ou la galerie.' },
    es: { title: 'Museos cercanos', close: 'Cerrar', locating: 'Localizando...', deniedTitle: 'Se requiere permiso de ubicación', deniedBody: 'Permite el acceso a la ubicación en la configuración del navegador.', unsupported: 'La geolocalización no es compatible', empty: 'No se encontraron museos cercanos', statusTitle: 'Horario', statusNote: 'La última entrada puede variar según el museo o la galería.' },
    pt: { title: 'Museus próximos', close: 'Fechar', locating: 'Localizando...', deniedTitle: 'Permissão de localização necessária', deniedBody: 'Permita o acesso à localização nas configurações do navegador.', unsupported: 'Geolocalização não suportada', empty: 'Nenhum museu encontrado por perto', statusTitle: 'Horário', statusNote: 'O horário da última entrada pode variar por museu ou galeria.' },
    'zh-CN': { title: '附近博物馆', close: '关闭', locating: '正在确认当前位置', deniedTitle: '需要位置权限', deniedBody: '请在浏览器设置中允许位置访问。', unsupported: '此浏览器不支持定位', empty: '附近未找到可显示的博物馆', statusTitle: '开放时间', statusNote: '各博物馆及美术馆的最后入场时间可能不同。' },
    'zh-TW': { title: '附近博物館', close: '關閉', locating: '正在確認目前位置', deniedTitle: '需要位置權限', deniedBody: '請在瀏覽器設定中允許位置存取。', unsupported: '此瀏覽器不支援定位', empty: '附近未找到可顯示的博物館', statusTitle: '開放時間', statusNote: '各博物館及美術館的最後入場時間可能不同。' },
    da: { title: 'Museer i nærheden', close: 'Luk', locating: 'Finder placering...', deniedTitle: 'Placeringstilladelse kræves', deniedBody: 'Tillad placeringsadgang i browserindstillingerne.', unsupported: 'Geolokation understøttes ikke', empty: 'Ingen museer fundet i nærheden', statusTitle: 'Åbningstider', statusNote: 'Sidste adgang kan variere efter museum eller galleri.' },
    fi: { title: 'Lähistön museot', close: 'Sulje', locating: 'Haetaan sijaintia...', deniedTitle: 'Sijaintilupa tarvitaan', deniedBody: 'Salli sijainnin käyttö selaimen asetuksissa.', unsupported: 'Sijaintia ei tueta tässä selaimessa', empty: 'Lähistöltä ei löytynyt museoita', statusTitle: 'Aukiolo', statusNote: 'Viimeinen sisäänpääsy voi vaihdella museoittain tai gallerioittain.' },
    sv: { title: 'Museer i närheten', close: 'Stäng', locating: 'Hämtar plats...', deniedTitle: 'Platsbehörighet krävs', deniedBody: 'Tillåt platsåtkomst i webbläsarens inställningar.', unsupported: 'Geolokalisering stöds inte', empty: 'Inga museer hittades i närheten', statusTitle: 'Öppettider', statusNote: 'Sista insläpp kan variera mellan museer och gallerier.' },
    et: { title: 'Lähedal muuseumid', close: 'Sulge', locating: 'Asukoha tuvastamine...', deniedTitle: 'Asukoha luba on vajalik', deniedBody: 'Luba asukoha kasutamine brauseri seadetes.', unsupported: 'Geolokatsioon ei ole toetatud', empty: 'Lähedusest muuseume ei leitud', statusTitle: 'Lahtiolek', statusNote: 'Viimane sissepääs võib muuseumiti või galeriiti erineda.' },
};

interface Props {
    isOpen: boolean;
    closing?: boolean;
    onClose: () => void;
    museums: any[];
    onMuseumClick: (id: string) => void;
    /** Horizontal anchor for the popup relative to its trigger button. Defaults to 'left'. */
    anchor?: 'left' | 'right' | 'before';
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
    /** Optional saved/manual map location. When present, the popup does not request geolocation. */
    locationOverride?: { lat: number; lng: number } | null;
    /** Optional category filter inherited from the active map category. */
    categoryFilter?: string;
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

export default function NearbyPopup({ isOpen, closing = false, onClose, museums, onMuseumClick, anchor = 'left', vertical = 'below', mode = 'popover', triggerRef, locationOverride, categoryFilter = 'All' }: Props) {
    const { locale } = useApp();
    type State = 'idle' | 'loading' | 'ready' | 'denied' | 'unsupported';
    const [state, setState] = useState<State>('idle');
    const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties | null>(null);
    const [statusDetailsById, setStatusDetailsById] = useState<Record<string, { openingHours?: unknown; visitorInfo?: unknown }>>({});
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on outside press (ignores the panel itself and the trigger button)
    useEffect(() => {
        if (!isOpen) return;
        const handleOutsidePress = (e: Event) => {
            const target = e.target as Node;
            if (panelRef.current?.contains(target)) return;
            if (triggerRef?.current?.contains(target)) return;
            onClose();
        };
        // Defer binding by one tick so the opening click doesn't immediately close.
        const usePointerEvent = typeof window !== 'undefined' && 'PointerEvent' in window;
        const primaryEvent = usePointerEvent ? 'pointerdown' : 'touchstart';
        const tid = setTimeout(() => {
            document.addEventListener(primaryEvent, handleOutsidePress, true);
            if (!usePointerEvent) document.addEventListener('mousedown', handleOutsidePress, true);
        }, 0);
        return () => {
            clearTimeout(tid);
            document.removeEventListener(primaryEvent, handleOutsidePress, true);
            if (!usePointerEvent) document.removeEventListener('mousedown', handleOutsidePress, true);
        };
    }, [isOpen, onClose, triggerRef]);

    // Measure trigger position for popover mode
    useLayoutEffect(() => {
        if (!isOpen || mode !== 'popover' || !triggerRef?.current) return;
        const computePosition = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const popupWidth = Math.min(320, window.innerWidth - 24);
            const gap = 8;
            const estimatedHeight = Math.min(430, window.innerHeight - 120);
            const bottomSafe = window.innerWidth < 768 ? 118 : 24;
            const maxTop = Math.max(12, window.innerHeight - estimatedHeight - bottomSafe);
            const style: React.CSSProperties = { position: 'fixed', width: popupWidth };
            if (anchor === 'before') style.top = Math.min(Math.max(12, Math.round(rect.top)), maxTop);
            else if (vertical === 'below') style.top = Math.min(Math.max(12, Math.round(rect.bottom + gap)), maxTop);
            else style.bottom = Math.max(bottomSafe, Math.round(window.innerHeight - rect.top + gap));
            // Compute left always, clamped to viewport
            const desiredLeft = anchor === 'before'
                ? rect.left - popupWidth - gap
                : anchor === 'right'
                    ? rect.right - popupWidth
                    : rect.left;
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
        if (locationOverride) {
            setUserPos(locationOverride);
            setState('ready');
            return;
        }
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
    }, [isOpen, userPos, locationOverride?.lat, locationOverride?.lng]);

    const nearby = useMemo(() => {
        if (!userPos) return [];
        return museums
            .filter((m: any) => categoryFilter === 'All' || m?.type === categoryFilter)
            .filter((m: any) => typeof m?.latitude === 'number' && typeof m?.longitude === 'number')
            .map((m: any) => ({ ...m, distance: haversineKm(userPos.lat, userPos.lng, m.latitude, m.longitude) }))
            .sort((a: any, b: any) => a.distance - b.distance)
            .slice(0, 8);
    }, [userPos, museums, categoryFilter]);

    const nearbyIds = useMemo(() => nearby.map((museum: any) => museum.id).filter(Boolean).join(','), [nearby]);

    useEffect(() => {
        if (!isOpen || state !== 'ready' || !nearbyIds) return;
        const ids = nearbyIds.split(',').filter(id => id && !statusDetailsById[id]);
        if (ids.length === 0) return;

        let cancelled = false;
        fetch(`/api/museums?ids=${encodeURIComponent(ids.slice(0, 8).join(','))}`)
            .then(response => (response.ok ? response.json() : null))
            .then(json => {
                if (cancelled || !json) return;
                const rows = json.data?.data || json.data || [];
                if (!Array.isArray(rows) || rows.length === 0) return;
                setStatusDetailsById(prev => {
                    const next = { ...prev };
                    rows.forEach((row: any) => {
                        if (!row?.id) return;
                        next[row.id] = {
                            openingHours: row.openingHours,
                            visitorInfo: row.visitorInfo,
                        };
                    });
                    return next;
                });
            })
            .catch(() => { });

        return () => {
            cancelled = true;
        };
    }, [isOpen, nearbyIds, state, statusDetailsById]);

    const nearbyWithStatus = useMemo(() => nearby.map((museum: any) => {
        const details = statusDetailsById[museum.id];
        return details ? { ...museum, ...details } : museum;
    }), [nearby, statusDetailsById]);

    if (!isOpen) return null;
    // Popover mode: wait for layout-measured position before rendering to avoid
    // a one-frame flash at top-left of body (the absolute-fallback position).
    if (mode === 'popover' && !popoverStyle) return null;

    const labels = NEARBY_LABELS[locale] || NEARBY_LABELS.en;
    const headerText = labels.title;

    // WCAG AA: 다크 지도·이미지 위에서도 팝업이 뚜렷이 구분되도록 완전 불투명 + 경계 강화 + 더 짙은 그림자
    const commonClass = `mm-nearby-popup2 mm-map-popover-motion rounded-2xl z-[9999] overflow-hidden ${closing ? 'is-closing' : ''}`;
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
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-500 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {headerText}
                </h3>
                <button
                    onClick={onClose}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-neutral-900"
                    aria-label={labels.close}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="max-h-[380px] overflow-y-auto">
                {state === 'loading' && (
                    <div className="py-10 flex flex-col items-center gap-2 text-gray-500 dark:text-gray-300">
                        <div className="w-5 h-5 rounded-full border-2 border-blue-300 dark:border-blue-600 border-t-blue-600 dark:border-t-blue-300 animate-spin" />
                        <p className="text-xs">{labels.locating}</p>
                    </div>
                )}
                {state === 'denied' && (
                    <div className="py-8 px-5 text-center">
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                            {labels.deniedTitle}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            {labels.deniedBody}
                        </p>
                    </div>
                )}
                {state === 'unsupported' && (
                    <div className="py-8 px-5 text-center text-[11px] text-gray-600 dark:text-gray-300">
                        {labels.unsupported}
                    </div>
                )}
                {state === 'ready' && nearby.length === 0 && (
                    <div className="py-8 px-5 text-center text-[11px] text-gray-600 dark:text-gray-300">
                        {labels.empty}
                    </div>
                )}
                {state === 'ready' && nearbyWithStatus.map((m: any) => {
                    const openStatus = resolveMuseumOpenStatus(m, locale);
                    return (
                        <button
                            key={m.id}
                            onClick={() => { onMuseumClick(m.id); onClose(); }}
                            className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 active:scale-[0.98] transition text-left border-b border-gray-100 dark:border-neutral-800 last:border-0 focus-visible:outline-none focus-visible:bg-blue-50 dark:focus-visible:bg-blue-900/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                        >
                            <div className="min-w-0 flex-1">
                                <h4 className="font-semibold text-xs text-gray-900 dark:text-white truncate">
                                    {getLocalizedMuseumName(m, locale) || m.name}
                                </h4>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                    {getLocalizedCityName(m, locale) || m.city}
                                </p>
                            </div>
                            <div className="mm-nearby-popup2-meta shrink-0">
                                <span className={`mm-nearby-popup2-status is-${openStatus.kind}`}>
                                    <span aria-hidden="true" />
                                    {openStatus.label}
                                </span>
                                <span className="mm-nearby-popup2-distance">
                                    {m.distance < 1 ? `${Math.round(m.distance * 1000)}m` : `${m.distance.toFixed(1)}km`}
                                </span>
                            </div>
                        </button>
                    );
                })}
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
