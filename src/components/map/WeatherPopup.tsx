'use client';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/components/AppContext';
import type { Locale } from '@/lib/i18n';
import { fetchLocationLabel } from '@/lib/locationLabel';

interface Props {
    isOpen: boolean;
    closing?: boolean;
    onClose: () => void;
    anchor?: 'left' | 'right' | 'before';
    vertical?: 'below' | 'above';
    mode?: 'popover' | 'fixed-bottom';
    triggerRef?: RefObject<HTMLElement | null>;
    initialWeather?: { temp: number; code: number; cityName?: string } | null;
    onWeatherLoaded?: (weather: { temp: number; code: number; cityName?: string }) => void;
    locationOverride?: { lat: number; lng: number } | null;
}

// WMO weather codes → icon + label + indoor recommendation
// https://open-meteo.com/en/docs#weathervariables
const WEATHER_MAP: Record<number, { icon: string; ko: string; en: string; indoor: boolean }> = {
    0: { icon: '☀️', ko: '맑음', en: 'Clear', indoor: false },
    1: { icon: '🌤️', ko: '대체로 맑음', en: 'Mostly clear', indoor: false },
    2: { icon: '⛅', ko: '구름 조금', en: 'Partly cloudy', indoor: false },
    3: { icon: '☁️', ko: '흐림', en: 'Overcast', indoor: false },
    45: { icon: '🌫️', ko: '안개', en: 'Fog', indoor: true },
    48: { icon: '🌫️', ko: '짙은 안개', en: 'Dense fog', indoor: true },
    51: { icon: '🌦️', ko: '이슬비', en: 'Light drizzle', indoor: true },
    53: { icon: '🌦️', ko: '이슬비', en: 'Drizzle', indoor: true },
    55: { icon: '🌧️', ko: '강한 이슬비', en: 'Heavy drizzle', indoor: true },
    61: { icon: '🌧️', ko: '약한 비', en: 'Light rain', indoor: true },
    63: { icon: '🌧️', ko: '비', en: 'Rain', indoor: true },
    65: { icon: '⛈️', ko: '강한 비', en: 'Heavy rain', indoor: true },
    71: { icon: '🌨️', ko: '약한 눈', en: 'Light snow', indoor: true },
    73: { icon: '❄️', ko: '눈', en: 'Snow', indoor: true },
    75: { icon: '❄️', ko: '폭설', en: 'Heavy snow', indoor: true },
    77: { icon: '❄️', ko: '싸락눈', en: 'Snow grains', indoor: true },
    80: { icon: '🌦️', ko: '소나기', en: 'Rain showers', indoor: true },
    81: { icon: '🌧️', ko: '강한 소나기', en: 'Heavy showers', indoor: true },
    82: { icon: '⛈️', ko: '폭우', en: 'Violent showers', indoor: true },
    85: { icon: '🌨️', ko: '눈 소나기', en: 'Snow showers', indoor: true },
    86: { icon: '❄️', ko: '강한 눈 소나기', en: 'Heavy snow showers', indoor: true },
    95: { icon: '⛈️', ko: '천둥번개', en: 'Thunderstorm', indoor: true },
    96: { icon: '⛈️', ko: '우박 동반 뇌우', en: 'Thunderstorm w/ hail', indoor: true },
    99: { icon: '⛈️', ko: '강한 뇌우', en: 'Severe thunderstorm', indoor: true },
};

const WEATHER_UI: Record<string, Record<Locale, string>> = {
    title: {
        en: "Today's Weather", ko: '오늘의 날씨', ja: '今日の天気', de: 'Heutiges Wetter', fr: 'Météo du jour',
        es: 'Tiempo de hoy', pt: 'Tempo de hoje', 'zh-CN': '今日天气', 'zh-TW': '今日天氣',
        da: 'Dagens vejr', fi: 'Tämän päivän sää', sv: 'Dagens väder', et: 'Tänane ilm',
    },
    close: {
        en: 'Close', ko: '닫기', ja: '閉じる', de: 'Schließen', fr: 'Fermer', es: 'Cerrar', pt: 'Fechar',
        'zh-CN': '关闭', 'zh-TW': '關閉', da: 'Luk', fi: 'Sulje', sv: 'Stäng', et: 'Sulge',
    },
    locationRequired: {
        en: 'Location permission required', ko: '위치 권한이 필요해요', ja: '位置情報の許可が必要です', de: 'Standortfreigabe erforderlich',
        fr: 'Autorisation de localisation requise', es: 'Se necesita permiso de ubicación', pt: 'Permissão de localização necessária',
        'zh-CN': '需要位置权限', 'zh-TW': '需要位置權限', da: 'Placeringstilladelse kræves', fi: 'Sijaintilupa tarvitaan',
        sv: 'Platsbehörighet krävs', et: 'Vajalik on asukohaluba',
    },
    loadError: {
        en: 'Failed to load weather', ko: '날씨 정보를 불러올 수 없어요', ja: '天気情報を読み込めません', de: 'Wetter konnte nicht geladen werden',
        fr: 'Impossible de charger la météo', es: 'No se pudo cargar el tiempo', pt: 'Não foi possível carregar o tempo',
        'zh-CN': '无法加载天气', 'zh-TW': '無法載入天氣', da: 'Kunne ikke indlæse vejret', fi: 'Säätä ei voitu ladata',
        sv: 'Kunde inte läsa in vädret', et: 'Ilmateadet ei saanud laadida',
    },
    indoorTitle: {
        en: 'Indoor recommended!', ko: '실내 관람 추천!', ja: '屋内鑑賞がおすすめ！', de: 'Innenräume empfohlen!',
        fr: 'Visite en intérieur conseillée !', es: '¡Mejor en interiores!', pt: 'Interiores recomendados!',
        'zh-CN': '推荐室内参观！', 'zh-TW': '推薦室內參觀！', da: 'Indendørs anbefales!', fi: 'Sisätilat suositeltavia!',
        sv: 'Inomhus rekommenderas!', et: 'Soovitame siseruume!',
    },
    indoorDesc: {
        en: 'A perfect day for museums & galleries', ko: '미술관과 박물관을 돌아보기 좋은 날씨예요', ja: '美術館や博物館めぐりにぴったりの日です',
        de: 'Perfektes Wetter für Museen und Galerien', fr: 'Une journée idéale pour musées et galeries',
        es: 'Un día perfecto para museos y galerías', pt: 'Um dia perfeito para museus e galerias',
        'zh-CN': '很适合逛美术馆和博物馆', 'zh-TW': '很適合逛美術館和博物館', da: 'En perfekt dag til museer og gallerier',
        fi: 'Täydellinen päivä museoille ja gallerioille', sv: 'En perfekt dag för museer och gallerier', et: 'Ideaalne päev muuseumideks ja galeriideks',
    },
    outdoorTitle: {
        en: 'Sculpture parks await', ko: '조각공원도 좋은 날', ja: '彫刻公園にもよい日', de: 'Skulpturenparks warten',
        fr: 'Les parcs de sculptures vous attendent', es: 'Los parques de esculturas esperan', pt: 'Parques de esculturas à espera',
        'zh-CN': '也适合去雕塑公园', 'zh-TW': '也適合去雕塑公園', da: 'Skulpturparker venter', fi: 'Veistospuistot kutsuvat',
        sv: 'Skulpturparker väntar', et: 'Skulptuuripargid ootavad',
    },
    outdoorDesc: {
        en: 'Outdoor art & architecture walks', ko: '야외 전시나 건축 산책도 추천해요', ja: '屋外展示や建築散策もおすすめです',
        de: 'Auch Kunst im Freien und Architekturspaziergänge lohnen sich', fr: 'Art en plein air et promenades architecturales',
        es: 'Arte al aire libre y paseos de arquitectura', pt: 'Arte ao ar livre e passeios de arquitetura',
        'zh-CN': '推荐户外展览和建筑漫步', 'zh-TW': '推薦戶外展覽和建築漫步', da: 'Udendørs kunst og arkitekturvandringer',
        fi: 'Ulkoilman taide ja arkkitehtuurikävelyt', sv: 'Utomhuskonst och arkitekturpromenader', et: 'Väliskunst ja arhitektuurijalutuskäigud',
    },
    powered: {
        en: 'Powered by Open-Meteo', ko: '제공: Open-Meteo', ja: '提供: Open-Meteo', de: 'Bereitgestellt von Open-Meteo',
        fr: 'Fourni par Open-Meteo', es: 'Con datos de Open-Meteo', pt: 'Fornecido por Open-Meteo',
        'zh-CN': '数据来源：Open-Meteo', 'zh-TW': '資料來源：Open-Meteo', da: 'Leveret af Open-Meteo',
        fi: 'Lähde: Open-Meteo', sv: 'Drivs av Open-Meteo', et: 'Allikas: Open-Meteo',
    },
    basedOn: {
        en: 'Weather for', ko: '날씨 기준', ja: '天気の基準', de: 'Wetter für', fr: 'Météo pour',
        es: 'Clima de', pt: 'Clima para', 'zh-CN': '天气位置', 'zh-TW': '天氣位置',
        da: 'Vejr for', fi: 'Sää sijainnille', sv: 'Väder för', et: 'Ilm asukohas',
    },
};

const WEATHER_LABELS: Record<number, Partial<Record<Locale, string>>> = {
    0: { en: 'Clear', ko: '맑음', ja: '快晴', de: 'Klar', fr: 'Dégagé', es: 'Despejado', pt: 'Céu limpo', 'zh-CN': '晴朗', 'zh-TW': '晴朗', da: 'Klart', fi: 'Selkeää', sv: 'Klart', et: 'Selge' },
    1: { en: 'Mostly clear', ko: '대체로 맑음', ja: 'おおむね晴れ', de: 'Meist klar', fr: 'Plutôt dégagé', es: 'Mayormente despejado', pt: 'Quase limpo', 'zh-CN': '大致晴朗', 'zh-TW': '大致晴朗', da: 'Overvejende klart', fi: 'Enimmäkseen selkeää', sv: 'Mestadels klart', et: 'Enamasti selge' },
    2: { en: 'Partly cloudy', ko: '구름 조금', ja: '晴れ時々曇り', de: 'Teilweise bewölkt', fr: 'Partiellement nuageux', es: 'Parcialmente nublado', pt: 'Parcialmente nublado', 'zh-CN': '局部多云', 'zh-TW': '局部多雲', da: 'Delvist skyet', fi: 'Puolipilvistä', sv: 'Delvis molnigt', et: 'Vahelduv pilvisus' },
    3: { en: 'Overcast', ko: '흐림', ja: '曇り', de: 'Bedeckt', fr: 'Couvert', es: 'Cubierto', pt: 'Nublado', 'zh-CN': '阴天', 'zh-TW': '陰天', da: 'Overskyet', fi: 'Pilvistä', sv: 'Mulet', et: 'Pilves' },
    45: { en: 'Fog', ko: '안개', ja: '霧', de: 'Nebel', fr: 'Brouillard', es: 'Niebla', pt: 'Nevoeiro', 'zh-CN': '雾', 'zh-TW': '霧', da: 'Tåge', fi: 'Sumua', sv: 'Dimma', et: 'Udu' },
    48: { en: 'Dense fog', ko: '짙은 안개', ja: '濃霧', de: 'Dichter Nebel', fr: 'Brouillard dense', es: 'Niebla densa', pt: 'Nevoeiro denso', 'zh-CN': '浓雾', 'zh-TW': '濃霧', da: 'Tæt tåge', fi: 'Sakeaa sumua', sv: 'Tät dimma', et: 'Tihe udu' },
    51: { en: 'Light drizzle', ko: '이슬비', ja: '弱い霧雨', de: 'Leichter Nieselregen', fr: 'Bruine légère', es: 'Llovizna ligera', pt: 'Chuvisco fraco', 'zh-CN': '小毛毛雨', 'zh-TW': '小毛毛雨', da: 'Let støvregn', fi: 'Heikkoa tihkua', sv: 'Lätt duggregn', et: 'Kerge uduvihm' },
    53: { en: 'Drizzle', ko: '이슬비', ja: '霧雨', de: 'Nieselregen', fr: 'Bruine', es: 'Llovizna', pt: 'Chuvisco', 'zh-CN': '毛毛雨', 'zh-TW': '毛毛雨', da: 'Støvregn', fi: 'Tihkua', sv: 'Duggregn', et: 'Uduvihm' },
    55: { en: 'Heavy drizzle', ko: '강한 이슬비', ja: '強い霧雨', de: 'Starker Nieselregen', fr: 'Forte bruine', es: 'Llovizna fuerte', pt: 'Chuvisco forte', 'zh-CN': '强毛毛雨', 'zh-TW': '強毛毛雨', da: 'Kraftig støvregn', fi: 'Voimakasta tihkua', sv: 'Kraftigt duggregn', et: 'Tugev uduvihm' },
    61: { en: 'Light rain', ko: '약한 비', ja: '小雨', de: 'Leichter Regen', fr: 'Pluie légère', es: 'Lluvia ligera', pt: 'Chuva fraca', 'zh-CN': '小雨', 'zh-TW': '小雨', da: 'Let regn', fi: 'Heikkoa sadetta', sv: 'Lätt regn', et: 'Kerge vihm' },
    63: { en: 'Rain', ko: '비', ja: '雨', de: 'Regen', fr: 'Pluie', es: 'Lluvia', pt: 'Chuva', 'zh-CN': '雨', 'zh-TW': '雨', da: 'Regn', fi: 'Sadetta', sv: 'Regn', et: 'Vihm' },
    65: { en: 'Heavy rain', ko: '강한 비', ja: '大雨', de: 'Starker Regen', fr: 'Forte pluie', es: 'Lluvia intensa', pt: 'Chuva forte', 'zh-CN': '大雨', 'zh-TW': '大雨', da: 'Kraftig regn', fi: 'Voimakasta sadetta', sv: 'Kraftigt regn', et: 'Tugev vihm' },
    71: { en: 'Light snow', ko: '약한 눈', ja: '小雪', de: 'Leichter Schnee', fr: 'Neige légère', es: 'Nieve ligera', pt: 'Neve fraca', 'zh-CN': '小雪', 'zh-TW': '小雪', da: 'Let sne', fi: 'Heikkoa lumisadetta', sv: 'Lätt snö', et: 'Kerge lumi' },
    73: { en: 'Snow', ko: '눈', ja: '雪', de: 'Schnee', fr: 'Neige', es: 'Nieve', pt: 'Neve', 'zh-CN': '雪', 'zh-TW': '雪', da: 'Sne', fi: 'Lumisadetta', sv: 'Snö', et: 'Lumi' },
    75: { en: 'Heavy snow', ko: '폭설', ja: '大雪', de: 'Starker Schnee', fr: 'Forte neige', es: 'Nieve intensa', pt: 'Neve forte', 'zh-CN': '大雪', 'zh-TW': '大雪', da: 'Kraftig sne', fi: 'Voimakasta lumisadetta', sv: 'Kraftig snö', et: 'Tugev lumi' },
    77: { en: 'Snow grains', ko: '싸락눈', ja: '雪粒', de: 'Schneekörner', fr: 'Neige en grains', es: 'Cinarra', pt: 'Grãos de neve', 'zh-CN': '雪粒', 'zh-TW': '雪粒', da: 'Snefnug', fi: 'Lumijyväsiä', sv: 'Snökorn', et: 'Lumeterad' },
    80: { en: 'Rain showers', ko: '소나기', ja: 'にわか雨', de: 'Regenschauer', fr: 'Averses', es: 'Chubascos', pt: 'Aguaceiros', 'zh-CN': '阵雨', 'zh-TW': '陣雨', da: 'Regnbyger', fi: 'Sadekuuroja', sv: 'Regnskurar', et: 'Vihmahood' },
    81: { en: 'Heavy showers', ko: '강한 소나기', ja: '強いにわか雨', de: 'Starke Schauer', fr: 'Fortes averses', es: 'Chubascos fuertes', pt: 'Aguaceiros fortes', 'zh-CN': '强阵雨', 'zh-TW': '強陣雨', da: 'Kraftige byger', fi: 'Voimakkaita sadekuuroja', sv: 'Kraftiga skurar', et: 'Tugevad vihmahood' },
    82: { en: 'Violent showers', ko: '폭우', ja: '激しいにわか雨', de: 'Heftige Schauer', fr: 'Averses violentes', es: 'Chubascos violentos', pt: 'Aguaceiros violentos', 'zh-CN': '猛烈阵雨', 'zh-TW': '猛烈陣雨', da: 'Meget kraftige byger', fi: 'Erittäin voimakkaita kuuroja', sv: 'Mycket kraftiga skurar', et: 'Väga tugevad vihmahood' },
    85: { en: 'Snow showers', ko: '눈 소나기', ja: 'にわか雪', de: 'Schneeschauer', fr: 'Averses de neige', es: 'Chubascos de nieve', pt: 'Aguaceiros de neve', 'zh-CN': '阵雪', 'zh-TW': '陣雪', da: 'Snebyger', fi: 'Lumikuuroja', sv: 'Snöbyar', et: 'Lumehood' },
    86: { en: 'Heavy snow showers', ko: '강한 눈 소나기', ja: '強いにわか雪', de: 'Starke Schneeschauer', fr: 'Fortes averses de neige', es: 'Chubascos fuertes de nieve', pt: 'Aguaceiros fortes de neve', 'zh-CN': '强阵雪', 'zh-TW': '強陣雪', da: 'Kraftige snebyger', fi: 'Voimakkaita lumikuuroja', sv: 'Kraftiga snöbyar', et: 'Tugevad lumehood' },
    95: { en: 'Thunderstorm', ko: '천둥번개', ja: '雷雨', de: 'Gewitter', fr: 'Orage', es: 'Tormenta', pt: 'Trovoada', 'zh-CN': '雷暴', 'zh-TW': '雷暴', da: 'Tordenvejr', fi: 'Ukkonen', sv: 'Åskväder', et: 'Äike' },
    96: { en: 'Thunderstorm w/ hail', ko: '우박 동반 뇌우', ja: 'ひょうを伴う雷雨', de: 'Gewitter mit Hagel', fr: 'Orage avec grêle', es: 'Tormenta con granizo', pt: 'Trovoada com granizo', 'zh-CN': '伴有冰雹的雷暴', 'zh-TW': '伴有冰雹的雷暴', da: 'Torden med hagl', fi: 'Ukkosta ja rakeita', sv: 'Åska med hagel', et: 'Äike rahega' },
    99: { en: 'Severe thunderstorm', ko: '강한 뇌우', ja: '激しい雷雨', de: 'Schweres Gewitter', fr: 'Orage violent', es: 'Tormenta severa', pt: 'Trovoada severa', 'zh-CN': '强雷暴', 'zh-TW': '強雷暴', da: 'Kraftigt tordenvejr', fi: 'Voimakas ukkonen', sv: 'Kraftigt åskväder', et: 'Tugev äike' },
};

type WeatherIconKey = 'clear' | 'partly-cloudy' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'thunder';

const WEATHER_ICON_BY_CODE: Record<number, WeatherIconKey> = {
    0: 'clear',
    1: 'partly-cloudy',
    2: 'partly-cloudy',
    3: 'cloudy',
    45: 'fog',
    48: 'fog',
    51: 'rain',
    53: 'rain',
    55: 'rain',
    61: 'rain',
    63: 'rain',
    65: 'rain',
    71: 'snow',
    73: 'snow',
    75: 'snow',
    77: 'snow',
    80: 'rain',
    81: 'rain',
    82: 'thunder',
    85: 'snow',
    86: 'snow',
    95: 'thunder',
    96: 'thunder',
    99: 'thunder',
};

function weatherUi(key: keyof typeof WEATHER_UI, locale: string) {
    const loc = locale as Locale;
    return WEATHER_UI[key]?.[loc] || WEATHER_UI[key]?.en || key;
}

function weatherLabel(code: number, locale: string) {
    const loc = locale as Locale;
    const label = WEATHER_LABELS[code];
    if (label) return label[loc] || label.en || resolveWeather(code).en;
    const fallback = resolveWeather(code);
    return loc === 'ko' ? fallback.ko : fallback.en;
}

function resolveWeather(code: number) {
    return WEATHER_MAP[code] || WEATHER_MAP[3];
}

function weatherIconSrc(code: number) {
    return `/weather/${WEATHER_ICON_BY_CODE[code] || 'cloudy'}.svg`;
}

function UmbrellaIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12a10 10 0 0 1 20 0Z" />
            <path d="M12 12v7a2 2 0 0 0 4 0" />
            <path d="M12 2v2" />
        </svg>
    );
}

function TreeIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 5 13h3l-4 6h16l-4-6h3L12 3Z" />
            <path d="M12 19v3" />
        </svg>
    );
}

export default function WeatherPopup({ isOpen, closing = false, onClose, anchor = 'left', vertical = 'below', mode = 'popover', triggerRef, initialWeather, onWeatherLoaded, locationOverride }: Props) {
    const { locale } = useApp();
    type State = 'idle' | 'loading' | 'ready' | 'error' | 'denied';
    const [state, setState] = useState<State>('idle');
    const [data, setData] = useState<{ temp: number; code: number; cityName?: string } | null>(null);
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const loadedLocationKeyRef = useRef<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e: MouseEvent) => {
            const target = e.target as Node;
            if (panelRef.current?.contains(target)) return;
            if (triggerRef?.current?.contains(target)) return;
            onClose();
        };
        const tid = setTimeout(() => document.addEventListener('mousedown', handleClick, true), 0);
        return () => { clearTimeout(tid); document.removeEventListener('mousedown', handleClick, true); };
    }, [isOpen, onClose, triggerRef]);

    useLayoutEffect(() => {
        if (!isOpen || mode !== 'popover' || !triggerRef?.current) return;
        const computePosition = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const popupWidth = Math.min(320, window.innerWidth - 24);
            const gap = 8;
            const estimatedHeight = Math.min(390, window.innerHeight - 120);
            const bottomSafe = window.innerWidth < 768 ? 118 : 24;
            const maxTop = Math.max(12, window.innerHeight - estimatedHeight - bottomSafe);
            const style: React.CSSProperties = { position: 'fixed', width: popupWidth };
            if (anchor === 'before') style.top = Math.min(Math.max(12, Math.round(rect.top)), maxTop);
            else if (vertical === 'below') style.top = Math.min(Math.max(12, Math.round(rect.bottom + gap)), maxTop);
            else style.bottom = Math.max(bottomSafe, Math.round(window.innerHeight - rect.top + gap));
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
        if (initialWeather) {
            setData(initialWeather);
            setState('ready');
        }
    }, [isOpen, initialWeather?.temp, initialWeather?.code]);

    useEffect(() => {
        if (!isOpen) return;
        const locationKey = `${locale}:${locationOverride ? `${locationOverride.lat.toFixed(5)},${locationOverride.lng.toFixed(5)}` : 'device'}`;
        if (state === 'ready' && data && loadedLocationKeyRef.current === locationKey) return;
        const fetchByLocation = async (location: { lat: number; lng: number }) => {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&current=temperature_2m,weather_code&timezone=auto`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('weather fetch failed');
            const json = await res.json();
            const label = await fetchLocationLabel(location, locale);
            const nextWeather = {
                temp: json.current.temperature_2m,
                code: json.current.weather_code,
                cityName: label.region,
            };
            setData(nextWeather);
            onWeatherLoaded?.(nextWeather);
            loadedLocationKeyRef.current = locationKey;
            setState('ready');
        };
        if (locationOverride) {
            setState('loading');
            fetchByLocation(locationOverride).catch(() => setState('error'));
            return;
        }
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            setState('error');
            return;
        }
        setState('loading');
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    await fetchByLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                } catch {
                    setState('error');
                }
            },
            () => setState('denied'),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 }
        );
    }, [isOpen, state, data, onWeatherLoaded, locale, locationOverride?.lat, locationOverride?.lng]);

    if (!isOpen) return null;
    if (mode === 'popover' && !popoverStyle) return null;

    const info = data ? resolveWeather(data.code) : null;
    const headerText = weatherUi('title', locale);

    const commonClass = `mm-weather-popup2 mm-map-popover-motion glass-popup rounded-2xl z-[9999] overflow-hidden ${closing ? 'is-closing' : ''}`;
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
            data-weather-popup
        >
            <div className="mm-weather-popup2-head relative flex items-center justify-between px-4 py-3">
                <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'var(--gradient-border-subtle)' }} />
                <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold" style={{ color: 'var(--mm-text-primary)' }}>
                    <span className="mm-weather-popup2-head-icon inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                        </svg>
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate">{headerText}</span>
                        {data?.cityName && (
                            <small className="mm-weather-popup2-location block truncate">
                                {weatherUi('basedOn', locale)} · {data.cityName}
                            </small>
                        )}
                    </span>
                </h3>
                <button
                    onClick={onClose}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition active:scale-95 hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:text-gray-300 dark:hover:bg-neutral-800 dark:hover:text-white dark:focus-visible:ring-offset-neutral-900"
                    aria-label={weatherUi('close', locale)}
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="mm-weather-popup2-body p-4">
                {state === 'loading' && (
                    <div className="flex items-center justify-center gap-3 py-8">
                        <div className="h-5 w-5 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin" />
                        <span className="text-xs font-medium" style={{ color: 'var(--mm-text-secondary)' }}>
                            {headerText}
                        </span>
                    </div>
                )}
                {state === 'denied' && (
                    <p className="rounded-xl px-3 py-4 text-center text-xs font-medium" style={{ background: 'var(--mm-brand-bg)', color: 'var(--mm-brand)' }}>
                        {weatherUi('locationRequired', locale)}
                    </p>
                )}
                {state === 'error' && (
                    <p className="rounded-xl px-3 py-4 text-center text-xs font-medium text-gray-600 dark:text-gray-300" style={{ background: 'var(--mm-surface-secondary)' }}>
                        {weatherUi('loadError', locale)}
                    </p>
                )}
                {state === 'ready' && data && info && (
                    <>
                        <div className="mm-weather-popup2-hero mb-4 flex items-center gap-4 rounded-2xl border p-3">
                            <div className="mm-weather-popup2-iconbox flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl">
                                <img
                                    src={weatherIconSrc(data.code)}
                                    alt=""
                                    className="h-16 w-16"
                                    draggable={false}
                                />
                            </div>
                            <div className="min-w-0">
                                <div className="mm-weather-popup2-temp font-mono text-4xl font-black leading-none">
                                    {Math.round(data.temp)}°
                                </div>
                                <div className="mm-weather-popup2-label mt-1 truncate text-xs font-medium">
                                    {weatherLabel(data.code, locale)}
                                </div>
                            </div>
                        </div>
                        {info.indoor ? (
                            <div className="mm-weather-popup2-rec rounded-2xl border p-3">
                                <p className="mb-1 flex items-center gap-2 text-xs font-semibold">
                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/70 dark:bg-white/10">
                                        <UmbrellaIcon className="h-3.5 w-3.5" />
                                    </span>
                                    {weatherUi('indoorTitle', locale)}
                                </p>
                                <p className="text-[11px] font-medium leading-relaxed">
                                    {weatherUi('indoorDesc', locale)}
                                </p>
                            </div>
                        ) : (
                            <div className="mm-weather-popup2-rec rounded-2xl border p-3">
                                <p className="mb-1 flex items-center gap-2 text-xs font-semibold">
                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/75 text-blue-600 dark:bg-white/10 dark:text-blue-200">
                                        <TreeIcon className="h-3.5 w-3.5" />
                                    </span>
                                    {weatherUi('outdoorTitle', locale)}
                                </p>
                                <p className="text-[11px] font-medium leading-relaxed">
                                    {weatherUi('outdoorDesc', locale)}
                                </p>
                            </div>
                        )}
                        <p className="mm-weather-popup2-provider mt-3 text-center text-[10px] font-medium" style={{ color: 'var(--mm-text-tertiary)' }}>
                            {weatherUi('powered', locale)}
                        </p>
                    </>
                )}
            </div>
        </div>
    );

    if (typeof document !== 'undefined') {
        return createPortal(panel, document.body);
    }
    return null;
}
