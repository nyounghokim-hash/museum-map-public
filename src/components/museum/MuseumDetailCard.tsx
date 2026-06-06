'use client';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { GlassPanel } from '@/components/ui/glass';
import PhotoCarousel from '@/components/ui/PhotoCarousel';
import { buildMapLinks, isAppleDevice } from '@/lib/mapLinks';
import { buildShareUrl } from '@/lib/utm';
import { useApp } from '@/components/AppContext';
import { useModal } from '@/components/ui/Modal';
import { t, translateCategory, translateDescription, getLocaleFromCountry, Locale, formatDate } from '@/lib/i18n';
import { useTranslatedText } from '@/hooks/useTranslation';
import { useCachedTranslation } from '@/hooks/useCachedTranslation';
import * as gtag from '@/lib/gtag';
import { addMuseumView } from '@/lib/museum-history';
import { getCountryName, getCityName } from '@/lib/countries';
import { getLocalizedMuseumName, getLocalizedCityName, getLocalizedArtworkTitle, getLocalizedArtistName } from '@/lib/getLocalizedName';
import ReportModal from '@/components/ui/ReportModal';
import { CameraIcon } from '@/components/ui/Icons';
import { useCompare } from '@/hooks/useCompare';
import { translateViLabel, translateViValue, getWebsiteLabels, getFeaturedWorksTitle, getReportLabels, getCopyToast, getTapCopyHint, getUpdatedLabel, getGoogleReviewsTitle, getReviewsLabel, getNoReviewText, getNoReviewsMsg, getNotFoundText } from '@/lib/visitorInfoI18n';
import { getDisplayStoryTitle } from '@/lib/storyTitle';

import LoadingAnimation from '@/components/ui/LoadingAnimation';

const RETURN_TO_MUSEUM_DETAIL_KEY = 'mm-return-to-museum-detail';

// Skeleton pulse component for translation loading
function TextSkeleton({ lines = 1, className = '' }: { lines?: number; className?: string }) {
    return (
        <span className={`inline-flex flex-col gap-1.5 w-full ${className}`}>
            {Array.from({ length: lines }).map((_, i) => (
                <span key={i} className={`skeleton block h-3.5 rounded-md ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} />
            ))}
        </span>
    );
}

// Sub-component for sentence-level translation using Gemini API
// Falls back to regex-based translateViValue while API loads
function TranslatedViText({ text, targetLocale }: { text: string; targetLocale: string }) {
    const regexFallback = translateViValue(text, targetLocale);
    const { text: translated, isTranslating } = useTranslatedText(text, targetLocale as Locale, { withLoading: true });
    if (isTranslating) return <TextSkeleton />;
    // If API hasn't returned yet (translated === original text), show regex fallback
    return <>{translated === text ? regexFallback : translated}</>;
}

const DAY_LABELS: Record<string, Record<string, string>> = {
    Monday: { ko: '월요일', en: 'Monday', ja: '月曜日', 'zh-CN': '周一', 'zh-TW': '週一', de: 'Montag', fr: 'Lundi', es: 'Lunes', pt: 'Segunda', da: 'Mandag', fi: 'Maanantai', sv: 'Måndag', et: 'Esmaspäev' },
    Tuesday: { ko: '화요일', en: 'Tuesday', ja: '火曜日', 'zh-CN': '周二', 'zh-TW': '週二', de: 'Dienstag', fr: 'Mardi', es: 'Martes', pt: 'Terça', da: 'Tirsdag', fi: 'Tiistai', sv: 'Tisdag', et: 'Teisipäev' },
    Wednesday: { ko: '수요일', en: 'Wednesday', ja: '水曜日', 'zh-CN': '周三', 'zh-TW': '週三', de: 'Mittwoch', fr: 'Mercredi', es: 'Miércoles', pt: 'Quarta', da: 'Onsdag', fi: 'Keskiviikko', sv: 'Onsdag', et: 'Kolmapäev' },
    Thursday: { ko: '목요일', en: 'Thursday', ja: '木曜日', 'zh-CN': '周四', 'zh-TW': '週四', de: 'Donnerstag', fr: 'Jeudi', es: 'Jueves', pt: 'Quinta', da: 'Torsdag', fi: 'Torstai', sv: 'Torsdag', et: 'Neljapäev' },
    Friday: { ko: '금요일', en: 'Friday', ja: '金曜日', 'zh-CN': '周五', 'zh-TW': '週五', de: 'Freitag', fr: 'Vendredi', es: 'Viernes', pt: 'Sexta', da: 'Fredag', fi: 'Perjantai', sv: 'Fredag', et: 'Reede' },
    Saturday: { ko: '토요일', en: 'Saturday', ja: '土曜日', 'zh-CN': '周六', 'zh-TW': '週六', de: 'Samstag', fr: 'Samedi', es: 'Sábado', pt: 'Sábado', da: 'Lørdag', fi: 'Lauantai', sv: 'Lördag', et: 'Laupäev' },
    Sunday: { ko: '일요일', en: 'Sunday', ja: '日曜日', 'zh-CN': '周日', 'zh-TW': '週日', de: 'Sonntag', fr: 'Dimanche', es: 'Domingo', pt: 'Domingo', da: 'Søndag', fi: 'Sunnuntai', sv: 'Söndag', et: 'Pühapäev' },
};

const DAY_ALIASES: Record<string, keyof typeof DAY_LABELS> = {
    월요일: 'Monday',
    화요일: 'Tuesday',
    수요일: 'Wednesday',
    목요일: 'Thursday',
    금요일: 'Friday',
    토요일: 'Saturday',
    일요일: 'Sunday',
};

const HOURS_STATUS: Record<string, Record<string, string>> = {
    closed: {
        ko: '휴관', en: 'Closed', ja: '休館', de: 'Geschlossen', fr: 'Fermé', es: 'Cerrado', pt: 'Fechado',
        'zh-CN': '闭馆', 'zh-TW': '休館', da: 'Lukket', fi: 'Suljettu', sv: 'Stängt', et: 'Suletud',
    },
    open24: {
        ko: '24시간 운영', en: 'Open 24 hours', ja: '24時間営業', de: '24 Stunden geöffnet', fr: 'Ouvert 24 h/24',
        es: 'Abierto 24 horas', pt: 'Aberto 24 horas', 'zh-CN': '24小时开放', 'zh-TW': '24小時開放',
        da: 'Åbent 24 timer', fi: 'Avoinna 24 tuntia', sv: 'Öppet dygnet runt', et: 'Avatud 24 tundi',
    },
};

function formatOpeningHoursValue(value: string, locale: string) {
    if (!value || !/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|월요일|화요일|수요일|목요일|금요일|토요일|일요일/.test(value)) return null;
    const rows = value
        .split(/\s*\/\s*/)
        .map(part => part.trim())
        .map(part => {
            const match = part.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|월요일|화요일|수요일|목요일|금요일|토요일|일요일)\s*:\s*(.+)$/);
            if (!match) return null;
            const canonicalDay = DAY_ALIASES[match[1]] || match[1];
            let hours = match[2].replace(/\s+/g, ' ').trim();
            hours = hours
                .replace(/\bClosed\b/gi, HOURS_STATUS.closed[locale] || HOURS_STATUS.closed.en)
                .replace(/\bOpen 24 hours\b/gi, HOURS_STATUS.open24[locale] || HOURS_STATUS.open24.en);
            if (locale === 'ko') hours = hours.replace(/\bAM\b/g, '오전').replace(/\bPM\b/g, '오후');
            return {
                day: DAY_LABELS[canonicalDay]?.[locale] || DAY_LABELS[canonicalDay]?.en || match[1],
                hours,
                closed: /closed|휴관|geschlossen|fermé|cerrado|fechado|闭馆|休館|lukket|suljettu|stängt|suletud/i.test(hours),
            };
        })
        .filter((row): row is { day: string; hours: string; closed: boolean } => Boolean(row));
    return rows.length >= 2 ? rows : null;
}

const COUNTRY_TIMEZONES: Record<string, string> = {
    KR: 'Asia/Seoul', KOR: 'Asia/Seoul', Korea: 'Asia/Seoul', 'South Korea': 'Asia/Seoul', 대한민국: 'Asia/Seoul',
    JP: 'Asia/Tokyo', JPN: 'Asia/Tokyo', Japan: 'Asia/Tokyo', 일본: 'Asia/Tokyo',
    US: 'America/New_York', USA: 'America/New_York', 'United States': 'America/New_York', 미국: 'America/New_York',
    GB: 'Europe/London', UK: 'Europe/London', GBR: 'Europe/London', 'United Kingdom': 'Europe/London', 영국: 'Europe/London',
    FI: 'Europe/Helsinki', FIN: 'Europe/Helsinki', Finland: 'Europe/Helsinki', 핀란드: 'Europe/Helsinki',
    FR: 'Europe/Paris', France: 'Europe/Paris',
    DE: 'Europe/Berlin', Germany: 'Europe/Berlin',
    ES: 'Europe/Madrid', Spain: 'Europe/Madrid',
    PT: 'Europe/Lisbon', Portugal: 'Europe/Lisbon',
    CN: 'Asia/Shanghai', China: 'Asia/Shanghai',
    TW: 'Asia/Taipei', Taiwan: 'Asia/Taipei',
    DK: 'Europe/Copenhagen', Denmark: 'Europe/Copenhagen',
    SE: 'Europe/Stockholm', Sweden: 'Europe/Stockholm',
    EE: 'Europe/Tallinn', Estonia: 'Europe/Tallinn',
};

const WEEKDAY_KEYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

function parseLocalParts(timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(new Date());
    const weekday = parts.find(p => p.type === 'weekday')?.value || 'Monday';
    const hour = Number(parts.find(p => p.type === 'hour')?.value || 0);
    const minute = Number(parts.find(p => p.type === 'minute')?.value || 0);
    return { weekday, minutes: hour * 60 + minute };
}

function getOpenStatus(hoursValue: string | undefined, country: string | undefined, locale: string) {
    const labels = {
        open: locale === 'ko' ? '오늘 운영중' : 'Open today',
        ended: locale === 'ko' ? '오늘 운영 종료' : 'Closed for today',
        closed: locale === 'ko' ? '휴관 중' : 'Closed',
    };
    if (!hoursValue) return null;
    const timeZone = COUNTRY_TIMEZONES[country || ''] || 'UTC';
    const local = parseLocalParts(timeZone);
    const dayIndex = WEEKDAY_KEYS.indexOf(local.weekday as any);
    const koDay = WEEKDAY_KO[dayIndex < 0 ? 1 : dayIndex];
    const dayName = local.weekday;
    const normalized = hoursValue.replace(/\s+/g, ' ');
    const closedRegex = new RegExp(`(${dayName}|${koDay}(요일)?)\\s*[:：]?\\s*(Closed|휴관|정기\\s*휴관|closed)`, 'i');
    if (closedRegex.test(normalized) || new RegExp(`${koDay}(요일)?\\s*휴관`, 'i').test(normalized)) {
        return { kind: 'closed' as const, label: labels.closed };
    }
    const ranges = Array.from(normalized.matchAll(/(\d{1,2})[:：](\d{2})\s*[-~–]\s*(\d{1,2})[:：](\d{2})/g));
    if (ranges.length === 0) return null;
    const anyOpen = ranges.some(match => {
        const start = Number(match[1]) * 60 + Number(match[2]);
        const end = Number(match[3]) * 60 + Number(match[4]);
        return local.minutes >= start && local.minutes <= end;
    });
    return anyOpen ? { kind: 'open' as const, label: labels.open } : { kind: 'ended' as const, label: labels.ended };
}

// Sub-component for translating general text (titles, descriptions)
function TranslatedText({ text, targetLocale }: { text: string; targetLocale: string }) {
    const { text: translated, isTranslating } = useTranslatedText(text, targetLocale as Locale, { withLoading: true });
    if (isTranslating) return <TextSkeleton />;
    return <>{translated}</>;
}

// Sub-component for rendering a single artwork card with translated text
function ArtworkCard({ work, locale, cachedTranslations, index, onClick }: { work: any; locale: string; cachedTranslations?: Record<string, string>; index: number; onClick?: () => void }) {
    const cachedTitle = cachedTranslations?.[`artwork_${index}_title`];
    const [imgError, setImgError] = useState(false);
    const artworkTitle = getLocalizedArtworkTitle(work, locale);
    const artistName = getLocalizedArtistName(work, locale) || work.artist;
    return (
        <button
            type="button"
            className="mm-featured-art-card p-0 text-left group cursor-pointer appearance-none"
            onClick={onClick}
            aria-label={artworkTitle || work.title || ''}
        >
            <div className="mm-featured-art-image relative">
                <img
                    src={work.image && !imgError ? work.image : '/logo.svg'}
                    alt={work.title || ''}
                    className={`w-full h-full transition-transform duration-500 ${work.image && !imgError ? 'object-cover group-hover:scale-[1.04]' : 'mm-featured-art-fallback-logo object-contain opacity-50 dark:invert dark:opacity-50'}`}
                    onError={() => setImgError(true)}
                />
                {work.year && (
                    <span className="mm-chip mm-chip--muted absolute left-2 top-2 px-2 py-1 text-[10px] leading-none shadow-sm backdrop-blur-md">
                        {work.year}
                    </span>
                )}
            </div>
            <div className="mm-featured-art-body p-3 sm:p-3.5">
                {artistName && (
                    <p className="text-[10px] font-extrabold uppercase tracking-widest line-clamp-1" style={{ color: 'var(--mm-brand)' }}>
                        {artistName}
                    </p>
                )}
                <h4 className="mt-1 text-sm font-extrabold leading-snug line-clamp-2" style={{ color: 'var(--mm-text-primary)' }}>
                    {artworkTitle || cachedTitle || work.title}
                </h4>
            </div>
        </button>
    );
}

export default function MuseumDetailCard({ museumId, onClose, isMapContext, onSaveChange, initialData }: { museumId: string; onClose?: () => void; isMapContext?: boolean; onSaveChange?: () => void; initialData?: any }) {
    const [data, setData] = useState<any>(initialData || null);
    const { locale } = useApp();
    const { showAlert } = useModal();
    const [loading, setLoading] = useState(!initialData);
    const [isPicked, setIsPicked] = useState(false);
    const [saveId, setSaveId] = useState<string | null>(null);
    const [showBurst, setShowBurst] = useState(false);
    const [showShrink, setShowShrink] = useState(false);
    const { data: session, status } = useSession();
    const router = useRouter();
    const { addToCompare, removeFromCompare, isInCompare } = useCompare();
    const isSignedInUser = status === 'authenticated' && !session?.user?.name?.startsWith('guest_');

    const triggerBurst = () => {
        setShowBurst(true);
        setTimeout(() => setShowBurst(false), 700);
    };
    const triggerShrink = () => {
        setShowShrink(true);
        setTimeout(() => setShowShrink(false), 500);
    };

    const openArtworkDetail = useCallback((artworkId?: string) => {
        if (!artworkId) return;
        if (typeof window !== 'undefined') {
            try {
                sessionStorage.setItem(RETURN_TO_MUSEUM_DETAIL_KEY, JSON.stringify({
                    museumId,
                    fromMap: !!isMapContext,
                    ts: Date.now(),
                }));
            } catch { }
        }

        const params = new URLSearchParams({ fromMuseum: museumId });
        if (isMapContext) params.set('fromMap', '1');
        router.push(`/artworks/${artworkId}?${params.toString()}`);
    }, [isMapContext, museumId, router]);

    // Live data states
    const [exhibitions, setExhibitions] = useState<any[]>([]);
    const [loadingLive, setLoadingLive] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);
    const [fullDescriptionOpen, setFullDescriptionOpen] = useState(false);
    const [copyToast, setCopyToast] = useState(false);
    const [selectedArtwork, setSelectedArtwork] = useState<any>(null);
    const [relatedStories, setRelatedStories] = useState<any[]>([]);
    const [showSaveToast, setShowSaveToast] = useState(false);
    const [saveToastExiting, setSaveToastExiting] = useState(false);
    const [showCompareToast, setShowCompareToast] = useState(false);
    const [compareToastExiting, setCompareToastExiting] = useState(false);
    const [compareToastMessage, setCompareToastMessage] = useState('');
    const [compareToastIsFull, setCompareToastIsFull] = useState(false);
    const [compareToastShowAction, setCompareToastShowAction] = useState(false);
    const [scrollY, setScrollY] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Trigger save toast with auto-dismiss
    const triggerSaveToast = useCallback(() => {
        setShowSaveToast(true);
        setSaveToastExiting(false);
        setTimeout(() => { setSaveToastExiting(true); setTimeout(() => setShowSaveToast(false), 300); }, 2200);
    }, []);

    // Trigger compare toast
    const triggerCompareToast = useCallback((message: string, isFull: boolean, showAction = !isFull) => {
        setCompareToastMessage(message);
        setCompareToastIsFull(isFull);
        setCompareToastShowAction(showAction);
        setShowCompareToast(true);
        setCompareToastExiting(false);
        // Auto-dismiss after 3.5s (longer to give time to click button)
        setTimeout(() => { setCompareToastExiting(true); setTimeout(() => setShowCompareToast(false), 300); }, 3500);
    }, []);

    // Scroll tracking for mini header
    const handleDetailScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollY((e.target as HTMLDivElement).scrollTop);
    }, []);
    const { text: translatedDesc, isTranslating: isDescTranslating } = useTranslatedText(data?.description, locale, { withLoading: true });
    const { text: translatedSummary, isTranslating: isSummaryTranslating } = useTranslatedText(data?.summary, locale, { withLoading: true });
    // DB-cached translations for museum
    const { translations: cachedMuseum } = useCachedTranslation('museum', data?.id, locale);
    // Museum names should always display in their original language

    // Shuffle artworks each time data loads or museumId changes
    const [shuffledArtworks, setShuffledArtworks] = useState<any[]>([]);
    const [shuffleKey, setShuffleKey] = useState(0);
    const [shuffleSpinning, setShuffleSpinning] = useState(false);
    const reshuffleArtworks = () => {
        if (!data?.artworks) return;
        const filtered = data.artworks.filter((w: any) => w.image);
        const a = [...filtered]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; }
        setShuffledArtworks(a);
        setShuffleKey(k => k + 1);
        setShuffleSpinning(true);
        setTimeout(() => setShuffleSpinning(false), 500);
    };
    useEffect(() => {
        if (!data?.artworks) { setShuffledArtworks([]); return; }
        const filtered = data.artworks.filter((w: any) => w.image);
        const a = [...filtered]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; }
        setShuffledArtworks(a);
        setShuffleKey(k => k + 1);
    }, [data?.artworks, museumId]);

    useEffect(() => {
        // If initialData was provided, skip the main fetch
        if (initialData) {
            fetchLiveData(initialData.name, initialData.city);
            fetchRelatedStories();
            gtag.event('view_museum_detail', {
                category: 'museum',
                label: initialData.name,
                value: 1
            });
            addMuseumView(museumId);
        } else {
            setLoading(true);
            fetch(`/api/museums/${museumId}`)
                .then(r => r.json())
                .then(res => {
                    setData(res.data);
                    setLoading(false);
                    if (res.data) {
                        fetchLiveData(res.data.name, res.data.city);
                        fetchRelatedStories();
                        gtag.event('view_museum_detail', {
                            category: 'museum',
                            label: res.data.name,
                            value: 1
                        });
                        addMuseumView(museumId);
                    }
                })
                .catch(console.error);
        }

        fetch('/api/me/saves')
            .then(r => r.json())
            .then(res => {
                if (res.data) {
                    const save = res.data.find((s: any) => s.museumId === museumId || s.museum?.id === museumId);
                    if (save) {
                        setIsPicked(true);
                        setSaveId(save.id);
                    } else {
                        setIsPicked(false);
                        setSaveId(null);
                    }
                }
            })
            .catch(console.error);
    }, [museumId]);

    const fetchLiveData = async (name: string, city: string) => {
        setLoadingLive(true);
        try {
            const exhRes = await fetch(`/api/museums/${museumId}/exhibitions?name=${encodeURIComponent(name)}`).then(r => r.json());
            if (exhRes.data) setExhibitions(exhRes.data);
        } catch (e) {
            console.error("Failed to fetch live extended data", e);
        } finally {
            setLoadingLive(false);
        }
    };

    const fetchRelatedStories = async () => {
        try {
            const res = await fetch(`/api/museums/${museumId}/stories`);
            const data = await res.json();
            if (data.data) setRelatedStories(data.data);
        } catch { }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 min-h-[400px]">
            <LoadingAnimation size={120} />
        </div>
    );
    if (!data) return <div className="p-20 text-center dark:text-gray-300">{getNotFoundText(locale)}</div>;

    const mapLinks = buildMapLinks({ name: data.name, lat: data.latitude, lng: data.longitude });
    const appleFirst = typeof window !== 'undefined' && isAppleDevice();
    const summaryLabel = ({
        ko: 'AI 요약',
        en: 'AI Summary',
        ja: 'AI要約',
        'zh-CN': 'AI 摘要',
        'zh-TW': 'AI 摘要',
        de: 'AI-Zusammenfassung',
        fr: 'Résumé IA',
        es: 'Resumen IA',
        pt: 'Resumo de IA',
        da: 'AI-resume',
        fi: 'AI-yhteenveto',
        sv: 'AI-sammanfattning',
        et: 'AI kokkuvõte',
    } as Record<string, string>)[locale] || 'AI Summary';

    const handleCopyAddress = (address: string) => {
        navigator.clipboard.writeText(address).then(() => {
            setCopyToast(true);
            setTimeout(() => setCopyToast(false), 2000);
        }).catch(() => {/* ignore */ });
    };

    const handleToggleCompare = () => {
        if (!data) return;
        if (!isSignedInUser) { router.push('/login'); return; }
        if (isInCompare(data.id)) {
            removeFromCompare(data.id);
            triggerCompareToast(t('compare.removed', locale), false, false);
        } else {
            const added = addToCompare(data.id);
            if (added) triggerCompareToast(t('compare.added', locale), false);
            else triggerCompareToast(t('compare.full', locale), true);
        }
    };

    const handleTogglePick = async (e?: React.MouseEvent<HTMLButtonElement>) => {
        e?.preventDefault();
        if (!data) return;
        if (!isSignedInUser) { router.push('/login'); return; }
        if (isPicked && saveId) {
            const prevSaveId = saveId;
            setIsPicked(false);
            setSaveId(null);
            triggerShrink();
            fetch(`/api/me/saves/${prevSaveId}`, { method: 'DELETE' })
                .then(() => { onSaveChange?.(); })
                .catch(() => { setIsPicked(true); setSaveId(prevSaveId); });
        } else {
            setIsPicked(true);
            triggerBurst();
            fetch('/api/saves', { method: 'POST', body: JSON.stringify({ museumId: data.id }) })
                .then(r => r.json()).then(res => {
                    if (res.data) {
                        setSaveId(res.data.id || res.data._id);
                        onSaveChange?.();
                        triggerSaveToast();
                        gtag.event('save_museum', { category: 'museum', label: data.name, value: 1 });
                    } else {
                        setIsPicked(false);
                    }
                }).catch(() => { setIsPicked(false); });
        }
    };

    const visitorItems = Array.isArray(data.visitorInfo) ? data.visitorInfo : [];
    const quickHoursItem = visitorItems.find((item: any) => item.icon === '🕐' || item.icon === 'clock' || item.label?.includes('영업') || item.label?.includes('시간'));
    const quickAccessItem = visitorItems.find((item: any) => item.icon === '🚇' || item.label === '교통' || item.label === '가는 길');
    const decisionInfoItems = visitorItems.filter((item: any) => {
        const isLocation = item.label === '위치';
        return !isLocation && item !== quickHoursItem && item !== quickAccessItem;
    }).slice(0, 4);
    const openStatus = getOpenStatus(quickHoursItem?.value, data.country, locale);
    const detailDescription = locale === 'ko'
        ? (data.descriptionKo || cachedMuseum.description || translateDescription(data.description, locale))
        : locale === 'en'
            ? data.description
            : (cachedMuseum.description || translatedDesc || translateDescription(data.description, locale));
    const decisionLabels = ({
        ko: { title: '방문 전에 확인해요', directions: '길찾기', rating: '평점', hours: '운영 정보', access: '가는 길' },
        en: { title: 'Before you visit', directions: 'Directions', rating: 'Rating', hours: 'Hours', access: 'Getting there' },
        ja: { title: '訪問前に確認', directions: '経路を見る', rating: '評価', hours: '営業時間', access: 'アクセス' },
        de: { title: 'Vor dem Besuch', directions: 'Route', rating: 'Bewertung', hours: 'Öffnungszeiten', access: 'Anfahrt' },
        fr: { title: 'Avant la visite', directions: 'Itinéraire', rating: 'Note', hours: 'Horaires', access: 'Accès' },
        es: { title: 'Antes de visitar', directions: 'Cómo llegar', rating: 'Valoración', hours: 'Horario', access: 'Acceso' },
        pt: { title: 'Antes da visita', directions: 'Como chegar', rating: 'Avaliação', hours: 'Horário', access: 'Acesso' },
        'zh-CN': { title: '到访前确认', directions: '路线', rating: '评分', hours: '开放时间', access: '交通' },
        'zh-TW': { title: '到訪前確認', directions: '路線', rating: '評分', hours: '開放時間', access: '交通' },
        da: { title: 'Før besøget', directions: 'Rute', rating: 'Bedømmelse', hours: 'Åbningstider', access: 'Transport' },
        fi: { title: 'Ennen vierailua', directions: 'Reitti', rating: 'Arvio', hours: 'Aukiolo', access: 'Kulkuyhteydet' },
        sv: { title: 'Före besöket', directions: 'Vägbeskrivning', rating: 'Betyg', hours: 'Öppettider', access: 'Transport' },
        et: { title: 'Enne külastust', directions: 'Teekond', rating: 'Hinnang', hours: 'Lahtiolekuajad', access: 'Transport' },
    } as Record<string, { title: string; directions: string; rating: string; hours: string; access: string }>)[locale] || {
        title: 'Before you visit',
        directions: 'Directions',
        rating: 'Rating',
        hours: 'Hours',
        access: 'Getting there',
    };

    const showMiniHeader = false;

    return (
        <div
            className="mm-museum-detail2 w-full max-w-full overflow-hidden flex flex-col relative"
            ref={scrollContainerRef}
            onScroll={handleDetailScroll}
        >


            {/* Sticky Mini Header — appears when scrolled past hero */}
            {showMiniHeader && (
                <div className="mm-detail-mini-header sticky top-0 z-30 animate-mini-header backdrop-blur-xl px-4 py-2.5 flex items-center gap-3" style={{ background: 'var(--glass-bg-heavy)', borderBottom: '1px solid var(--glass-border)' }}>
                    {/* Gradient accent at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-[1px]" style={{ background: 'var(--gradient-border-subtle)' }} />
                    {onClose && (
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/50 dark:bg-white/10 text-gray-600 dark:text-gray-300 active:scale-95 transition-transform">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                    )}
                    <div className="flex-1 min-w-0">
                        <h2 className="text-sm font-extrabold dark:text-white truncate">{getLocalizedMuseumName(data, locale)}</h2>
                        <p className="text-[10px] text-gray-400 dark:text-neutral-500 truncate">{translateCategory(data.type, locale)} • {getLocalizedCityName(data, locale) || data.city}</p>
                    </div>
                    {data.googleRating && (
                        <span className="text-xs font-bold text-yellow-500 flex items-center gap-0.5 shrink-0">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005z" /></svg>
                            {data.googleRating.toFixed(1)}
                        </span>
                    )}
                </div>
            )}

            {/* Hero Card with Cover Image */}
            <GlassPanel intensity="heavy" className="mm-detail-hero-card mb-8 relative overflow-hidden group border-0 !rounded-none lg:!rounded-3xl shadow-none lg:shadow">
                {/* Cover Image — PhotoCarousel (이미지 영역에서는 스와이프 뒤로가기 비활성화) */}
                <div data-no-swipe-back className="mm-museum-hero2">
                <PhotoCarousel
                    photos={(() => { const raw = (data.placePhotos?.length > 0 ? data.placePhotos : (data.imageUrl ? [data.imageUrl] : [])) as string[]; return Array.from(new Set(raw)); })()}
                    alt={data.name}
                    className="h-[302px] sm:h-[360px] w-full bg-gray-900"
                >
                    {/* Share button on image */}
                    <button
                        onClick={async () => {
                            const url = buildShareUrl(`${window.location.origin}/museums/${museumId}`);
                            if (navigator.share) {
                                try { await navigator.share({ title: data.name, url }); } catch { }
                            } else {
                                await navigator.clipboard.writeText(url);
                            }
                        }}
                        className="mm-museum-round-action absolute top-4 right-4 z-20 active:scale-95 transition-all"
                        aria-label="Share"
                    >
                        <svg className="h-[18px] w-[18px] lg:h-5 lg:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                    </button>
                    {/* PC: Compare button on image */}
                    <button
                        onClick={handleToggleCompare}
                        className={`hidden lg:flex absolute top-4 right-[8rem] z-20 w-12 h-12 items-center justify-center rounded-full shadow-lg transition-all duration-300 active:scale-90 ${isInCompare(data.id)
                            ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-emerald-500/30'
                            : 'bg-black/40 backdrop-blur-md text-emerald-300 hover:bg-black/60 ring-2 ring-emerald-300/70'
                            }`}
                        aria-label={t('compare.add', locale)}
                    >
                        <svg className="w-5 h-5" fill={isInCompare(data.id) ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                        </svg>
                    </button>
                    {/* PC: Bookmark button on image (top-right) */}
                    <button
                        onClick={handleTogglePick}
                        className={`flex absolute top-4 right-[4.75rem] z-20 w-12 h-12 items-center justify-center rounded-full shadow-lg transition-all duration-300 ${showBurst ? 'animate-bookmark-bounce' : showShrink ? 'animate-bookmark-shrink' : 'active:scale-90'} ${isPicked
                            ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-blue-500/30 ring-2 ring-orange-300/85'
                            : 'bg-black/40 backdrop-blur-md text-white/80 hover:bg-black/60 ring-2 ring-orange-300/85'
                            }`}
                    >
                        {/* Blurred glow burst */}
                        {showBurst && (
                            <>
                                <span className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.5) 0%, transparent 70%)', animation: 'bookmarkRing 600ms ease-out forwards', filter: 'blur(6px)' }} />
                                {[0, 1, 2, 3, 4, 5].map(i => (
                                    <span key={i} className="absolute w-2 h-2 rounded-full" style={{
                                        background: ['rgba(37,99,235,0.85)', 'rgba(59,130,246,0.8)', 'rgba(96,165,250,0.75)', 'rgba(14,165,233,0.8)', 'rgba(147,197,253,0.78)', 'rgba(30,64,175,0.72)'][i],
                                        filter: 'blur(2px)',
                                        animation: `particleBurst${i} 600ms ${40 + i * 40}ms ease-out forwards`,
                                    }} />
                                ))}
                            </>
                        )}
                        <svg className="w-6 h-6" fill={isPicked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke={isPicked ? 'currentColor' : '#fdba74'} strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v18l7-5 7 5V3H5z" />
                        </svg>
                    </button>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                    {/* Google Places attribution */}
                    {(data.placePhotos?.length > 0 || data.imageUrl?.includes('googleusercontent')) && (
                        <span className="absolute left-4 top-4 z-20 inline-flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1.5 text-[9px] font-bold tracking-wide text-white/70 backdrop-blur-md ring-1 ring-white/15 pointer-events-none">
                            <CameraIcon className="h-3 w-3" />
                            Google
                        </span>
                    )}
                    <div className="mm-museum-hero-copy2 flex items-end justify-between">
                        <div>
                            <p className="text-xs font-bold tracking-widest text-white/80 uppercase mb-1">{translateCategory(data.type, locale)} • {getLocalizedCityName(data, locale) || getCityName(data.city, locale)}, {getCountryName(data.country, locale)}</p>
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">{getLocalizedMuseumName(data, locale)}</h1>
                            {locale === 'ko' && data.nameEn && <p className="text-sm text-white/60 mt-0.5">{data.nameEn}</p>}
                            {locale !== 'ko' && <p className="text-sm text-white/60 mt-0.5">{data.nameKo || data.name}</p>}
                        </div>
                    </div>


                </PhotoCarousel>
                </div>

                <div className="mm-detail-body mm-museum-detail-body2 pt-9 px-5 pb-5 sm:pt-11 sm:px-8 sm:pb-8">
                    {/* One-line Summary */}
                    {data.summary && (
                        <div className="museum-summary-card mb-8 rounded-2xl px-4 py-4 sm:px-5">
                            <p className="museum-summary-label mb-2 text-[13px] font-black uppercase tracking-[0.16em]">
                                {summaryLabel}
                            </p>
                            {locale !== 'ko' && isSummaryTranslating ? (
                                <div className="space-y-2">
                                    <div className="skeleton h-4 w-full rounded" />
                                    <div className="skeleton h-4 w-2/3 rounded" />
                                </div>
                            ) : (
                                <p className="museum-summary-text text-base font-bold leading-relaxed">
                                    {locale === 'ko' ? data.summary : translatedSummary || data.summary}
                                </p>
                            )}
                            {detailDescription && (
                                <button type="button" onClick={() => setFullDescriptionOpen(true)} className="mt-4 inline-flex items-center gap-1 text-xs font-black text-blue-600 dark:text-blue-300">
                                    {locale === 'ko' ? '전체 설명 텍스트' : 'Full description'}
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                </button>
                            )}
                        </div>
                    )}

                    <div className="mm-detail-decision-card mb-6 rounded-2xl border border-blue-100/80 bg-white/75 p-4 shadow-sm dark:border-blue-900/40 dark:bg-neutral-900/70">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-[13px] font-black uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
                                {decisionLabels.title}
                            </p>
                            {openStatus && (
                                <span className={`mm-open-status mm-open-status--${openStatus.kind}`}>
                                    {openStatus.label}
                                </span>
                            )}
                        </div>
                        <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
                            {quickHoursItem?.value && (
                                <div className="mm-detail-fact mm-detail-fact--brand rounded-xl bg-blue-50/70 px-3 py-2 dark:bg-blue-950/25">
                                    <p className="mb-0.5 text-[10px] font-black uppercase tracking-widest text-blue-500/80">{decisionLabels.hours}</p>
                                    <p className="line-clamp-2 font-bold leading-snug text-gray-800 dark:text-gray-100">{translateViValue(quickHoursItem.value, locale)}</p>
                                </div>
                            )}
                            {quickAccessItem?.value && (
                                <div className="mm-detail-fact rounded-xl bg-gray-50 px-3 py-2 dark:bg-neutral-800/70">
                                    <p className="mb-0.5 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-neutral-500">{decisionLabels.access}</p>
                                    <p className="line-clamp-2 font-bold leading-snug text-gray-800 dark:text-gray-100">{translateViValue(quickAccessItem.value, locale)}</p>
                                </div>
                            )}
                            {decisionInfoItems.map((item: any, i: number) => (
                                <div key={`${item.label}-${i}`} className="mm-detail-fact rounded-xl bg-gray-50 px-3 py-2 dark:bg-neutral-800/70">
                                    <p className="mb-0.5 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-neutral-500">{translateViLabel(item.label, locale)}</p>
                                    <p className="line-clamp-2 font-bold leading-snug text-gray-800 dark:text-gray-100">{translateViValue(item.value, locale)}</p>
                                </div>
                            ))}
                        </div>
                        <div className={`grid gap-2 ${data.website ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            <a
                                href={appleFirst ? mapLinks.appleDirections : mapLinks.googleDirections}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => { gtag.event('get_directions', { category: 'navigation', label: appleFirst ? 'Apple Maps' : 'Google Maps', value: 1 }); }}
                                className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-4 text-sm font-black text-white shadow-sm shadow-blue-500/20 transition-all active:scale-95 hover:bg-blue-700"
                            >
                                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                                </svg>
                                <span className="truncate">{decisionLabels.directions}</span>
                            </a>
                            {data.website && (
                                <a
                                    href={data.website}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={() => { gtag.event('open_website', { category: 'museum', label: data.name, value: 1 }); }}
                                    className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-4 text-xs font-extrabold text-gray-500 shadow-sm transition-all hover:bg-gray-100 active:scale-95 dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-400 dark:hover:bg-neutral-800"
                                >
                                    <svg className="h-3.5 w-3.5 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m-7.843 4.582A11.953 11.953 0 0012 10.5c2.998 0 5.74-1.1 7.843-2.918M3.284 14.253A17.919 17.919 0 0012 16.5c3.162 0 6.133-.815 8.716-2.247" />
                                    </svg>
                                    <span className="truncate">{getWebsiteLabels(locale).cta}</span>
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Description loading placeholder */}
                    {isDescTranslating && !cachedMuseum.description && locale !== 'ko' && locale !== 'en' && (
                        <div className="mb-5 space-y-2">
                            <div className="skeleton h-4 w-full rounded" />
                            <div className="skeleton h-4 w-full rounded" />
                            <div className="skeleton h-4 w-5/6 rounded" />
                            <div className="skeleton h-4 w-3/4 rounded" />
                        </div>
                    )}

                    {/* Updated date chip */}
                    {data.updatedAt && (
                        <div className="mb-3 flex items-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-50 dark:bg-neutral-800/60 text-[10px] font-bold text-gray-400 dark:text-neutral-500">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {getUpdatedLabel(locale)} {new Date(data.updatedAt).toLocaleDateString(locale === 'ko' ? 'ko-KR' : locale === 'ja' ? 'ja-JP' : locale === 'zh-CN' ? 'zh-CN' : locale === 'zh-TW' ? 'zh-TW' : locale === 'de' ? 'de-DE' : locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : locale === 'pt' ? 'pt-PT' : locale === 'da' ? 'da-DK' : locale === 'fi' ? 'fi-FI' : locale === 'sv' ? 'sv-SE' : locale === 'et' ? 'et-EE' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                        </div>
                    )}

                    {/* Map-style Info List */}
                    <div className="border-t border-gray-100 dark:border-neutral-800">
                        {/* Visitor Info Items */}
                        {data.visitorInfo && Array.isArray(data.visitorInfo) && data.visitorInfo.map((item: any, i: number) => {
                            const displayLabel = translateViLabel(item.label, locale);
                            const isLocation = item.label === '위치';
                            const isAccess = item.label === '교통' || item.label === '가는 길';
                            const isHours = item.icon === '🕐' || item.icon === 'clock' || item.label?.includes('영업') || item.label?.includes('시간');
                            if (!isLocation || isHours || isAccess) return null;
                            const openingHoursRows = isHours ? formatOpeningHoursValue(item.value, locale) : null;
                            // 위치: museum's country locale (or English if not in 13)
                            // 교통/가는길: user's selected locale (full sentence)
                            // others: regex-based translateViValue
                            const museumLocale = getLocaleFromCountry(data.country);
                            return (
                                <div key={i}>
                                    <div
                                        className={`flex items-start gap-3 py-2 ${!isLocation ? 'border-b border-gray-50 dark:border-neutral-800/50' : ''} -mx-2 px-2 ${isLocation ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800/30 rounded-lg transition-colors active:scale-[0.99]' : ''}`}
                                        onClick={isLocation ? () => handleCopyAddress(item.value) : undefined}
                                    >
                                        <span className="w-6 flex items-center justify-center flex-shrink-0 mt-0.5 text-gray-400 dark:text-gray-500">
                                            {item.icon === '🎟️' || item.label?.includes('입장') || item.label?.includes('요금') ? (
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" /></svg>
                                            ) : item.icon === '🕐' || item.label?.includes('영업') || item.label?.includes('시간') ? (
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            ) : item.icon === '📍' || item.label?.includes('위치') ? (
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                                            ) : item.icon === '🚇' || item.label?.includes('교통') || item.label?.includes('가는') ? (
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>
                                            ) : item.icon === '⏱️' || item.label?.includes('소요') ? (
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            ) : (
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
                                            )}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs sm:text-sm text-gray-400 dark:text-neutral-500 font-bold">{displayLabel}</p>
                                            {openingHoursRows ? (
                                                <div className="mt-1 grid gap-1.5 text-sm text-gray-800 dark:text-gray-200 font-medium">
                                                    {openingHoursRows.map((row) => (
                                                        <div key={row.day} className="grid grid-cols-[4.75rem_1fr] sm:grid-cols-[5.5rem_1fr] gap-2 leading-snug">
                                                            <span className="font-bold text-gray-500 dark:text-neutral-400">{row.day}</span>
                                                            <span className={row.closed ? 'text-gray-400 dark:text-neutral-500' : ''}>{row.hours}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-800 dark:text-gray-200 font-medium leading-relaxed">
                                                    {isLocation
                                                        ? (museumLocale === 'ko' ? item.value : <TranslatedViText text={item.value} targetLocale={museumLocale} />)
                                                        : isAccess
                                                            ? (locale === 'ko' ? item.value : <TranslatedViText text={item.value} targetLocale={locale} />)
                                                            : translateViValue(item.value, locale)}
                                                </p>
                                            )}
                                            {isLocation && (
                                                <p className="text-[10px] text-gray-400 dark:text-neutral-500 mt-0.5">
                                                    {getTapCopyHint(locale)}
                                                </p>
                                            )}
                                        </div>
                                        {isLocation && (
                                            <svg className="w-4 h-4 text-gray-300 dark:text-neutral-600 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        )}
                                    </div>
                                    {/* Map links below location, divider after buttons */}
                                    {isLocation && (
                                        <div className="border-b border-gray-50 dark:border-neutral-800/50 pb-3">
                                            <div className="flex gap-2 ml-10 mt-1">
                                                <a
                                                    href={mapLinks.appleDirections}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    onClick={() => { gtag.event('get_directions', { category: 'navigation', label: 'Apple Maps', value: 1 }); }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 transition active:scale-95"
                                                >
                                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
                                                    Apple Maps
                                                </a>
                                                <a
                                                    href={mapLinks.googleDirections}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    onClick={() => { gtag.event('get_directions', { category: 'navigation', label: 'Google Maps', value: 1 }); }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 transition active:scale-95"
                                                >
                                                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                                                    Google Maps
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Featured Artworks */}
                    {data.artworks && data.artworks.filter((w: any) => w.image).length > 0 && (
                        <div className="mm-detail-section mt-7 pt-5 border-t border-gray-100 dark:border-neutral-800">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <h3 className="mm-section-title mb-0">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--mm-brand-bg)', color: 'var(--mm-brand)' }}>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                                        </svg>
                                    </span>
                                    <span>{getFeaturedWorksTitle(locale)}</span>
                                </h3>
                                <span className="mm-chip mm-chip--muted px-2.5 py-1 text-[10px] leading-none">
                                    {shuffledArtworks.length}
                                </span>
                            </div>
                            <div key={shuffleKey} className="mm-featured-art-rail scrollbar-hide">
                                {shuffledArtworks.map((work: any, i: number) => (
                                    <div key={work.id || i} style={{ animation: `fadeInUp 0.4s ${i * 60}ms both` }}>
                                        <ArtworkCard work={work} locale={locale} cachedTranslations={cachedMuseum} index={i} onClick={() => openArtworkDetail(work.id)} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Copy Toast */}
                    {copyToast && (
                        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-lg backdrop-blur-md animate-fadeInUp">
                            <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                            {getCopyToast(locale)}
                        </div>
                    )}

                    {/* Related Stories */}
                    {relatedStories.length > 0 && (
                        <div className="mm-detail-section mt-7 pt-5 border-t border-gray-100 dark:border-neutral-800">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <h3 className="mm-section-title mb-0">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--mm-brand-bg)', color: 'var(--mm-brand)' }}>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                        </svg>
                                    </span>
                                    <span>{locale === 'ko' ? 'MM 스토리' : locale === 'ja' ? '関連ストーリー' : locale === 'zh-CN' ? '相关故事' : locale === 'zh-TW' ? '相關故事' : locale === 'de' ? 'Geschichten' : locale === 'fr' ? 'Histoires' : locale === 'es' ? 'Historias' : locale === 'pt' ? 'Histórias' : locale === 'da' ? 'Historier' : locale === 'fi' ? 'Tarinat' : locale === 'sv' ? 'Berättelser' : locale === 'et' ? 'Lood' : 'Stories'}</span>
                                </h3>
                                <span className="mm-chip mm-chip--muted px-2.5 py-1 text-[10px] leading-none">
                                    {relatedStories.length}
                                </span>
                            </div>
                            <div className="flex gap-3.5 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide -mx-2 px-2">
                                {relatedStories.map((story: any) => {
                                    const storyTitle = getDisplayStoryTitle(locale === 'ko' ? story.title : (story.titleTranslations?.[locale] || story.titleEn || story.title), [data]);
                                    return (
                                    <button
                                        type="button"
                                        key={story.id}
                                        onClick={() => router.push(`/blog/${story.id}?fromMuseum=${encodeURIComponent(museumId)}`)}
                                        className="mm-card w-[260px] sm:w-[300px] flex-shrink-0 snap-start p-0 text-left group cursor-pointer appearance-none"
                                        aria-label={storyTitle}
                                    >
                                        <div className="relative aspect-[16/9] overflow-hidden bg-gray-100 dark:bg-neutral-800">
                                            {story.previewImage ? (
                                                <img
                                                    src={story.previewImage}
                                                    alt={story.title}
                                                    className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                                                    onError={(e) => { e.currentTarget.src = '/logo.svg'; e.currentTarget.className = 'w-full h-full object-contain p-8 opacity-20 dark:invert dark:opacity-60'; }}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <img src="/logo.svg" alt="" className="w-10 h-10 opacity-20 dark:invert dark:opacity-60" />
                                                </div>
                                            )}
                                            {story.views > 0 && (
                                                <span className="mm-chip mm-chip--muted absolute right-2 top-2 px-2 py-1 text-[10px] leading-none shadow-sm backdrop-blur-md">
                                                    {story.views.toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="p-3.5">
                                            <p className="text-[10px] font-extrabold uppercase tracking-widest line-clamp-1" style={{ color: 'var(--mm-brand)' }}>
                                                {story.author || 'Editorial'} · {formatDate(story.createdAt, locale as Locale)}
                                            </p>
                                            <h4 className="mt-1.5 text-sm font-extrabold leading-snug line-clamp-2" style={{ color: 'var(--mm-text-primary)' }}>
                                                {storyTitle}
                                            </h4>
                                        </div>
                                    </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}


                    {/* Report Info Update Button */}
                    <button
                        onClick={() => setReportOpen(true)}
                        className="mm-detail-report-button mt-2 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 text-gray-400 dark:text-gray-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/10 dark:hover:border-blue-800 text-xs font-bold transition-all active:scale-95"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                        {getReportLabels(locale).button}
                    </button>
                    <ReportModal
                        isOpen={reportOpen}
                        onClose={() => setReportOpen(false)}
                        locale={locale}
                        targetName={data.name}
                        onSubmit={async (msg) => {
                            await fetch('/api/feedback', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    content: msg,
                                    type: 'report',
                                    category: 'museum_info',
                                    targetId: data.id,
                                    targetName: data.name,
                                })
                            });
                            showAlert(
                                getReportLabels(locale).thanks,
                                getReportLabels(locale).thanksDesc
                            );
                        }}
                    />
                    {/* Photo Source Attribution */}
                    <p className="text-center text-[9px] text-gray-300 dark:text-neutral-600 mt-3 flex items-center justify-center gap-1.5 flex-wrap">
                        {(() => {
                            const photos = data.placePhotos?.length > 0 ? data.placePhotos : (data.imageUrl ? [data.imageUrl] : []);
                            if (photos.length === 0) return '';
                            const tags: React.ReactNode[] = [];
                            if (photos.some((p: string) => p.includes('googleapis.com') || p.includes('googleusercontent.com'))) tags.push(<span key="g" className="bg-gray-50 dark:bg-neutral-800/50 px-1.5 py-0.5 rounded-full">📍 Google Places</span>);
                            if (photos.some((p: string) => p.includes('supabase.co'))) tags.push(<span key="s" className="bg-gray-50 dark:bg-neutral-800/50 px-1.5 py-0.5 rounded-full">📍 Google Places/</span>);
                            if (photos.some((p: string) => p.includes('wikimedia.org') || p.includes('wikipedia.org'))) tags.push(<span key="w" className="bg-gray-50 dark:bg-neutral-800/50 px-1.5 py-0.5 rounded-full">📷 Wikimedia</span>);
                            // For other URLs, extract domain as source (exclude internal hosting)
                            const otherPhotos = photos.filter((p: string) => !p.includes('googleapis.com') && !p.includes('googleusercontent.com') && !p.includes('wikimedia.org') && !p.includes('wikipedia.org') && !p.includes('supabase.co'));
                            const domains = new Set<string>();
                            otherPhotos.forEach((p: string) => {
                                try { const h = new URL(p).hostname.replace(/^www\./, ''); domains.add(h); } catch { }
                            });
                            domains.forEach(d => tags.push(<span key={d} className="bg-gray-50 dark:bg-neutral-800/50 px-1.5 py-0.5 rounded-full">📸 {d}</span>));
                            return tags.length > 0 ? <><CameraIcon className="w-3 h-3 inline mr-0.5" />{tags}</> : '';
                        })()}
                    </p>
                </div>
            </GlassPanel>

            {fullDescriptionOpen && createPortal(
                <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6" onClick={() => setFullDescriptionOpen(false)}>
                    <div className="w-full max-w-xl rounded-t-[28px] bg-white p-5 shadow-2xl dark:bg-slate-950 sm:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <h3 className="text-base font-black text-slate-900 dark:text-white">{locale === 'ko' ? '전체 설명 텍스트' : 'Full description'}</h3>
                            <button type="button" onClick={() => setFullDescriptionOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <p className="max-h-[58vh] overflow-y-auto text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                            {detailDescription}
                        </p>
                    </div>
                </div>,
                document.body
            )}


            {/* Mobile bottom spacer */}
            <div className="h-5 lg:h-3" />


            {/* Artwork Detail Modal */}



            {selectedArtwork && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6" onClick={() => setSelectedArtwork(null)}>
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-backdropIn" />
                    <div
                        className="relative w-full max-w-md max-h-[80vh] glass-popup gradient-border rounded-3xl overflow-hidden animate-modalIn"
                        style={{ boxShadow: 'var(--glass-shadow-lg)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setSelectedArtwork(null)}
                            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-all active:scale-95"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <div className="w-full aspect-[4/3] bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                            <img src={selectedArtwork.image || '/logo.svg'} alt={selectedArtwork.title} className={`w-full h-full ${selectedArtwork.image ? 'object-cover' : 'object-contain p-16 opacity-20 dark:invert dark:opacity-60'}`} onError={(e) => { e.currentTarget.src = '/logo.svg'; e.currentTarget.className = 'w-full h-full object-contain p-16 opacity-20 dark:invert dark:opacity-60'; }} />
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[35vh]">
                            {selectedArtwork.artist && (
                                <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">{getLocalizedArtistName(selectedArtwork, locale) || selectedArtwork.artist}</p>
                            )}
                            <h3 className="font-extrabold text-lg dark:text-white leading-tight mb-3">{getLocalizedArtworkTitle(selectedArtwork, locale)}</h3>
                            {selectedArtwork.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{locale === 'ko' ? (selectedArtwork.descriptionKo || selectedArtwork.description) : selectedArtwork.description}</p>
                            )}
                            {/* Image Source Attribution */}
                            {selectedArtwork.image && (() => {
                                const src = selectedArtwork.image;
                                let sourceLabel = locale === 'ko' ? '운영팀에서 추가' : 'Added by operations team';
                                let sourceLink: string | undefined;
                                if (src.includes('wikimedia.org') || src.includes('wikipedia.org')) { sourceLabel = 'Wikimedia Commons'; sourceLink = 'https://commons.wikimedia.org'; }
                                else if (src.includes('artic.edu')) { sourceLabel = 'Art Institute of Chicago'; sourceLink = 'https://www.artic.edu'; }
                                else if (src.includes('metmuseum.org')) { sourceLabel = 'The Metropolitan Museum of Art'; sourceLink = 'https://www.metmuseum.org'; }
                                else if (src.includes('europeana.eu')) { sourceLabel = 'Europeana'; sourceLink = 'https://www.europeana.eu'; }
                                else if (src.includes('googleapis.com')) { sourceLabel = 'Google Places'; sourceLink = 'https://maps.google.com'; }
                                return (
                                    <p className="text-[10px] text-gray-400 dark:text-neutral-500 mt-3 pt-2 border-t border-gray-100 dark:border-neutral-800 flex items-center gap-1">
                                        <CameraIcon className="w-3 h-3 inline mr-0.5" /> {locale === 'ko' ? '출처: ' : 'Source: '}
                                        {sourceLink ? <a href={sourceLink} target="_blank" rel="noreferrer" className="underline">{sourceLabel}</a> : sourceLabel}
                                    </p>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile floating FAB group — rendered via portal to escape transform container */}
            {typeof document !== 'undefined' && createPortal(
                <div className="lg:hidden fixed bottom-8 right-8 z-[9998] flex flex-col gap-2">
                    {/* Compare button (top) */}
                    <button
                        onClick={handleToggleCompare}
                        className={`w-14 h-14 flex items-center justify-center rounded-full shadow-lg transition-all duration-300 active:scale-90 ${isInCompare(data.id)
                            ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-emerald-500/30'
                            : 'bg-white/90 dark:bg-neutral-800/90 backdrop-blur-md text-emerald-500 dark:text-emerald-400 hover:bg-white dark:hover:bg-neutral-700 ring-2 ring-emerald-300 dark:ring-emerald-500/50'
                            }`}
                        aria-label={t('compare.add', locale)}
                    >
                        <svg className="w-5 h-5" fill={isInCompare(data.id) ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                        </svg>
                    </button>
                    {/* Back button (bottom) */}
                    <button
                        onClick={onClose || (() => router.back())}
                        className="w-14 h-14 flex items-center justify-center rounded-full bg-neutral-800/90 dark:bg-white/90 backdrop-blur-md text-white dark:text-gray-800 shadow-lg border border-neutral-700/60 dark:border-gray-200/60 active:scale-95 transition-all hover:bg-neutral-700 dark:hover:bg-gray-100"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                </div>,
                document.body
            )}

            {/* Save Confetti Toast */}
            {showSaveToast && typeof document !== 'undefined' && createPortal(
                <div className={`fixed bottom-24 left-1/2 z-[9999] ${saveToastExiting ? 'animate-save-toast-out' : 'animate-save-toast-in'}`}>
                    {/* Confetti particles */}
                    {!saveToastExiting && [0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                        <span key={i} className="absolute rounded-full" style={{
                            width: 6, height: 6,
                            background: ['#2563EB', '#3B82F6', '#93C5FD', '#0EA5E9', '#1D4ED8', '#60A5FA', '#38BDF8', '#172554'][i],
                            left: `${50 + (i - 3.5) * 12}%`,
                            top: -4,
                            ['--confetti-rot' as any]: `${90 + i * 45}deg`,
                            animation: `confettiFall ${600 + i * 80}ms ${i * 50}ms ease-out forwards`,
                        }} />
                    ))}
                    <div className="bg-gradient-to-r from-blue-700 to-blue-500 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 font-bold text-sm whitespace-nowrap">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3v18l7-5 7 5V3H5z" /></svg>
                        {locale === 'ko' ? '저장 완료!' : locale === 'ja' ? '保存しました！' : locale === 'zh-CN' ? '已保存！' : locale === 'de' ? 'Gespeichert!' : locale === 'fr' ? 'Sauvegardé !' : 'Saved!'}
                    </div>
                </div>,
                document.body
            )}

            {/* Compare toast with navigate button */}
            {showCompareToast && typeof document !== 'undefined' && createPortal(
                <div className={`fixed bottom-24 left-1/2 z-[9999] ${compareToastExiting ? 'animate-save-toast-out' : 'animate-save-toast-in'}`}>
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white pl-5 pr-2 py-2 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-sm whitespace-nowrap">
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            {compareToastIsFull ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            )}
                        </svg>
                        <span>{compareToastMessage}</span>
                        {compareToastShowAction && (
                            <button
                                onClick={() => {
                                    setShowCompareToast(false);
                                    router.push('/compare');
                                }}
                                className="ml-1 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors active:scale-95 whitespace-nowrap"
                            >
                                {locale === 'ko' ? '비교하기' : locale === 'ja' ? '比較する' : locale === 'zh-CN' ? '去比较' : locale === 'de' ? 'Vergleichen' : locale === 'fr' ? 'Comparer' : 'Compare'}
                            </button>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
