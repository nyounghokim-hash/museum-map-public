'use client';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { GlassPanel } from '@/components/ui/glass';
import PhotoCarousel from '@/components/ui/PhotoCarousel';
import { buildMapLinks, isAndroidDevice, isAppleDevice, isKoreanMapTarget } from '@/lib/mapLinks';
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
import { useAccountSaves } from '@/hooks/useAccountSaves';
import { translateViLabel, translateViValue, getWebsiteLabels, getFeaturedWorksTitle, getReportLabels, getCopyToast, getTapCopyHint, getUpdatedLabel, getGoogleReviewsTitle, getReviewsLabel, getNoReviewText, getNoReviewsMsg, getNotFoundText, getFullDescriptionLabel } from '@/lib/visitorInfoI18n';
import { getDisplayStoryTitle } from '@/lib/storyTitle';
import { findVisitorHoursItem, openingHoursToDisplaySource } from '@/lib/openingHoursTemplate';
import { resolveMuseumOpenStatus } from '@/lib/openStatus';
import { ACTIVE_TRIP_CHANGE_EVENT, getActiveTripForAccount, setActiveTripForAccount } from '@/lib/accountStorage';
import { findTripStopForMuseum, isStopVisited, updateTripStopVisitState } from '@/lib/tripStatus';
import { navigateDocument } from '@/lib/route-pending';

import LoadingAnimation from '@/components/ui/LoadingAnimation';

const RETURN_TO_MUSEUM_DETAIL_KEY = 'mm-return-to-museum-detail';
const FEATURED_ARTWORK_PREVIEW_LIMIT = 20;

const DETAIL_TRIP_VISIT_LABELS: Record<string, { title: string; mark: string; unmark: string; saved: string; removed: string; failed: string; removeFailed: string; pending: string }> = {
    ko: { title: '이번 여행', mark: '다녀간 곳으로 표시', unmark: '다녀감 취소', saved: '방문 기록을 저장했어요', removed: '다녀감 표시를 취소했어요', failed: '방문 기록을 저장하지 못했어요', removeFailed: '다녀감 표시를 취소하지 못했어요', pending: '여행 시작 후 체크할 수 있어요' },
    en: { title: 'This trip', mark: 'Mark as visited', unmark: 'Undo visit', saved: 'Visit saved', removed: 'Visit mark removed', failed: 'Could not save visit', removeFailed: 'Could not remove visit mark', pending: 'Available when the trip starts' },
    ja: { title: 'この旅行', mark: '訪問済みにする', unmark: '訪問を取消', saved: '訪問記録を保存しました', removed: '訪問済みを取り消しました', failed: '訪問記録を保存できませんでした', removeFailed: '訪問済みを取り消せませんでした', pending: '旅行開始後にチェックできます' },
    de: { title: 'Diese Reise', mark: 'Als besucht markieren', unmark: 'Besuch entfernen', saved: 'Besuch gespeichert', removed: 'Besuchsmarkierung entfernt', failed: 'Besuch konnte nicht gespeichert werden', removeFailed: 'Besuchsmarkierung konnte nicht entfernt werden', pending: 'Verfügbar, wenn die Reise beginnt' },
    fr: { title: 'Ce voyage', mark: 'Marquer comme visité', unmark: 'Annuler la visite', saved: 'Visite enregistrée', removed: 'Marque de visite retirée', failed: 'Impossible d’enregistrer la visite', removeFailed: 'Impossible de retirer la marque de visite', pending: 'Disponible au début du voyage' },
    es: { title: 'Este viaje', mark: 'Marcar como visitado', unmark: 'Deshacer visita', saved: 'Visita guardada', removed: 'Marca de visita eliminada', failed: 'No se pudo guardar la visita', removeFailed: 'No se pudo eliminar la marca de visita', pending: 'Disponible cuando empiece el viaje' },
    pt: { title: 'Esta viagem', mark: 'Marcar como visitado', unmark: 'Desfazer visita', saved: 'Visita salva', removed: 'Marca de visita removida', failed: 'Não foi possível salvar a visita', removeFailed: 'Não foi possível remover a marca de visita', pending: 'Disponível quando a viagem começar' },
    'zh-CN': { title: '本次旅行', mark: '标记为已到访', unmark: '取消到访', saved: '到访记录已保存', removed: '已取消到访标记', failed: '无法保存到访记录', removeFailed: '无法取消到访标记', pending: '旅行开始后可勾选' },
    'zh-TW': { title: '本次旅行', mark: '標記為已到訪', unmark: '取消到訪', saved: '到訪紀錄已儲存', removed: '已取消到訪標記', failed: '無法儲存到訪紀錄', removeFailed: '無法取消到訪標記', pending: '旅行開始後可勾選' },
    da: { title: 'Denne rejse', mark: 'Markér som besøgt', unmark: 'Fortryd besøg', saved: 'Besøg gemt', removed: 'Besøgsmarkering fjernet', failed: 'Kunne ikke gemme besøg', removeFailed: 'Kunne ikke fjerne besøgsmarkering', pending: 'Tilgængelig når rejsen starter' },
    fi: { title: 'Tämä matka', mark: 'Merkitse käydyksi', unmark: 'Kumoa käynti', saved: 'Käynti tallennettu', removed: 'Käyntimerkintä poistettu', failed: 'Käyntiä ei voitu tallentaa', removeFailed: 'Käyntimerkintää ei voitu poistaa', pending: 'Käytössä matkan alettua' },
    sv: { title: 'Den här resan', mark: 'Markera som besökt', unmark: 'Ångra besök', saved: 'Besök sparat', removed: 'Besöksmarkering borttagen', failed: 'Kunde inte spara besök', removeFailed: 'Kunde inte ta bort besöksmarkering', pending: 'Tillgängligt när resan startar' },
    et: { title: 'See reis', mark: 'Märgi külastatuks', unmark: 'Võta külastus tagasi', saved: 'Külastus salvestatud', removed: 'Külastuse märge eemaldati', failed: 'Külastust ei saanud salvestada', removeFailed: 'Külastuse märget ei saanud eemaldada', pending: 'Saadaval reisi alguses' },
};

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
    GR: 'Europe/Athens', GRC: 'Europe/Athens', Greece: 'Europe/Athens', 그리스: 'Europe/Athens',
    SE: 'Europe/Stockholm', Sweden: 'Europe/Stockholm',
    EE: 'Europe/Tallinn', Estonia: 'Europe/Tallinn',
};

const WEEKDAY_KEYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAY_KO_FULL = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];
const WEEKDAY_JA_FULL = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
const CLOCK_TOKEN_PATTERN = String.raw`(?:AM|PM|오전|오후)?\s*\d{1,2}(?:(?::\d{2}(?::\d{2})?)|(?:\s*[시時]\s*(?:\d{1,2}\s*(?:분|分)?)?))?\s*(?:AM|PM|오전|오후)?`;
const CLOCK_RANGE_PATTERN = new RegExp(`(${CLOCK_TOKEN_PATTERN})\\s*[-~–〜～]\\s*(${CLOCK_TOKEN_PATTERN})`, 'i');
const CLOCK_RANGE_PATTERN_GLOBAL = new RegExp(`(${CLOCK_TOKEN_PATTERN})\\s*[-~–〜～]\\s*(${CLOCK_TOKEN_PATTERN})`, 'gi');
const ALL_DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6];

function getWeekdayLabel(dayIndex: number, locale: string) {
    const key = WEEKDAY_KEYS[dayIndex];
    return key ? (DAY_LABELS[key]?.[locale] || DAY_LABELS[key]?.en || WEEKDAY_KO_FULL[dayIndex]) : '';
}

function normalizeOpeningHoursSource(value: unknown): string | undefined {
    if (!value) return undefined;
    const templated = openingHoursToDisplaySource(value);
    if (templated) return templated;
    if (Array.isArray(value)) {
        const joined = value
            .map(item => typeof item === 'string' ? item : '')
            .map(item => item.trim())
            .filter(Boolean)
            .join(' / ');
        return joined || undefined;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return undefined;
        if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
            try {
                const parsed = JSON.parse(trimmed);
                return normalizeOpeningHoursSource(parsed) || trimmed;
            } catch {
                return trimmed;
            }
        }
        return trimmed;
    }
    if (typeof value === 'object') {
        const objectValue = value as Record<string, unknown>;
        if (Array.isArray(objectValue.weekdayDescriptions)) {
            const weekdayRows = objectValue.weekdayDescriptions
                .map(item => typeof item === 'string' ? item.trim() : '')
                .filter(Boolean);
            if (weekdayRows.length) return weekdayRows.join(' / ');
        }
        const maybeRows: string[] = [];
        const pushRow = (label: string, item: unknown) => {
            if (typeof item !== 'string') return;
            const next = item.trim();
            if (next) maybeRows.push(`${label}: ${next}`);
        };
        pushRow('월-금', objectValue.weekday);
        pushRow('토-일', objectValue.weekend);
        pushRow('월요일', objectValue.monday);
        pushRow('화요일', objectValue.tuesday);
        pushRow('수요일', objectValue.wednesday);
        pushRow('목요일', objectValue.thursday);
        pushRow('금요일', objectValue.friday);
        pushRow('토요일', objectValue.saturday);
        pushRow('일요일', objectValue.sunday);
        if (typeof objectValue.closed === 'string' && objectValue.closed.trim()) {
            const closedValue = objectValue.closed.trim();
            const closedDayTokens = Array.from(closedValue.matchAll(/[일월화수목금토](?:요일)?/g))
                .map(match => match[0].replace(/요일/g, ''));
            if (closedDayTokens.length) {
                Array.from(new Set(closedDayTokens)).forEach(day => maybeRows.push(`${day}: 휴관`));
            } else {
                maybeRows.push(closedValue);
            }
        }
        if (maybeRows.length === 0) {
            Object.values(objectValue)
                .map(item => typeof item === 'string' ? item.trim() : '')
                .filter(Boolean)
                .filter(item => !/^\d{4}-\d{2}-\d{2}T/.test(item))
                .forEach(item => maybeRows.push(item));
        }
        return maybeRows.length ? maybeRows.join(' / ') : undefined;
    }
    return undefined;
}

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

function parseClockMinutes(raw: string) {
    const source = raw.trim();
    const meridiem = /PM|오후/i.test(source) ? 'pm' : /AM|오전/i.test(source) ? 'am' : null;
    const match = source.match(/(\d{1,2})(?::(\d{2})(?::\d{2})?|(?:\s*[시時]\s*(\d{1,2})?\s*(?:분|分)?)?)?/);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] || match[3] || 0);
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    return hour * 60 + minute;
}

function formatClockLabel(raw: string, fallbackEndRaw?: string) {
    const minutes = parseClockMinutes(fallbackEndRaw ? inferStartClockMeridiem(raw, fallbackEndRaw) : raw);
    if (minutes == null) return '';
    const normalized = minutes % (24 * 60);
    const hour = Math.floor(normalized / 60);
    const minute = normalized % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function findClockRange(value: string | undefined) {
    if (!value) return null;
    const match = value.match(CLOCK_RANGE_PATTERN);
    if (!match) return null;
    const endHint = match[2];
    const startHint = !/AM|PM|오전|오후/i.test(match[1]) && !/AM|PM|오전|오후/i.test(endHint)
        ? `${match[1]} ${Number(match[1].match(/\d{1,2}/)?.[0] || 0) < 8 || Number(endHint.match(/\d{1,2}/)?.[0] || 0) <= Number(match[1].match(/\d{1,2}/)?.[0] || 0) ? 'PM' : 'AM'}`
        : match[1];
    const start = formatClockLabel(startHint, endHint);
    const end = formatClockLabel(endHint);
    return start && end ? { start, end } : null;
}

function inferStartClockMeridiem(startRaw: string, endRaw: string) {
    if (/PM|AM|오후|오전/i.test(startRaw) || !/PM|AM|오후|오전/i.test(endRaw)) return startRaw;
    const startHour = Number(startRaw.match(/(\d{1,2})/)?.[1] || NaN);
    const endHour = Number(endRaw.match(/(\d{1,2})/)?.[1] || NaN);
    if (Number.isNaN(startHour) || Number.isNaN(endHour)) return startRaw;
    if (/PM|오후/i.test(endRaw)) return `${startRaw} ${startHour === 12 || startHour <= endHour ? 'PM' : 'AM'}`;
    return `${startRaw} AM`;
}

function expandKoDayExpression(raw: string) {
    const source = raw.replace(/요일|曜日/g, '').replace(/\s+/g, '');
    if (/^(매일|매주|상시|연중무휴|월~일|월-일)$/.test(source)) return ALL_DAY_INDEXES;
    const dayIndex = (day: string) => {
        const ko = WEEKDAY_KO.indexOf(day);
        if (ko >= 0) return ko;
        return WEEKDAY_JA.indexOf(day);
    };
    const range = source.match(/^([일월화수목금토日月火水木金土])\s*[-~–〜～]\s*([일월화수목금토日月火水木金土])$/);
    if (range) {
        const start = dayIndex(range[1]);
        const end = dayIndex(range[2]);
        if (start < 0 || end < 0) return [];
        const days: number[] = [];
        let cursor = start;
        while (true) {
            days.push(cursor);
            if (cursor === end) break;
            cursor = (cursor + 1) % 7;
            if (days.length > 7) break;
        }
        return days;
    }
    return source
        .split(/[·,\/]/)
        .map(day => dayIndex(day))
        .filter(day => day >= 0);
}

function parseWeeklyOpeningTemplate(hoursValue: string | undefined) {
    if (!hoursValue) return null;
    const rows = hoursValue
        .replace(/\r?\n/g, ' / ')
        .split(/\s*(?:\/|,|;|。|\.)(?=\s*(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|매일|[일월화수목금토日月火水木金土]|월요일|화요일|수요일|목요일|금요일|토요일|일요일|日曜日|月曜日|火曜日|水曜日|木曜日|金曜日|土曜日))/i)
        .map(part => part.trim())
        .filter(Boolean);

    const days = WEEKDAY_KO.map((label, index) => ({
        index,
        label,
        open: false,
        start: '',
        end: '',
        note: '',
    }));

    let parsedCount = 0;
    const explicitlyMentionedDays = new Set<number>();
    for (const row of rows) {
        const match = row.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|월요일|화요일|수요일|목요일|금요일|토요일|일요일|日曜日|月曜日|火曜日|水曜日|木曜日|金曜日|土曜日|매일|[일월화수목금토日月火水木金土](?:\s*[·,\/~-〜～]\s*[일월화수목금토日月火水木金土])*)\s*[:：]?\s*(.+)$/i);
        if (!match) continue;
        const dayToken = match[1];
        const value = match[2].replace(/\s+/g, ' ').trim();
        const dayIndexes = DAY_ALIASES[dayToken]
            ? [WEEKDAY_KEYS.indexOf(DAY_ALIASES[dayToken] as typeof WEEKDAY_KEYS[number])]
            : WEEKDAY_KEYS.includes(dayToken as any)
                ? [WEEKDAY_KEYS.indexOf(dayToken as any)]
                : expandKoDayExpression(dayToken);
        if (dayIndexes.length === 0) continue;
        dayIndexes.forEach(index => explicitlyMentionedDays.add(index));

        const closed = /closed|휴관|휴무|休館|定休日|閉館|闭馆/i.test(value);
        const range = findClockRange(value);
        const start = range?.start || '';
        const end = range?.end || '';

        dayIndexes.forEach(index => {
            if (index < 0 || index > 6) return;
            days[index] = {
                ...days[index],
                open: !closed && Boolean(start && end),
                start,
                end,
                note: closed ? 'closed' : value,
            };
        });
        parsedCount += 1;

        if (!closed && start && end) {
            const exceptionPattern = /[（(]\s*([일월화수목금토](?:\s*[·,\/~-]\s*[일월화수목금토])*)\s*[-~–]\s*((?:AM|PM|오전|오후)?\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM|오전|오후)?)\s*[)）]/gi;
            for (const exception of value.matchAll(exceptionPattern)) {
                const exceptionDayIndexes = expandKoDayExpression(exception[1]);
                const exceptionEnd = formatClockLabel(exception[2]);
                if (!exceptionEnd) continue;
                exceptionDayIndexes.forEach(index => {
                    if (index < 0 || index > 6 || !dayIndexes.includes(index)) return;
                    days[index] = {
                        ...days[index],
                        open: true,
                        start,
                        end: exceptionEnd,
                        note: value,
                    };
                });
            }
        }
    }

    if (parsedCount > 0 && explicitlyMentionedDays.size > 0 && explicitlyMentionedDays.size < 7 && days.some(day => day.open)) {
        days.forEach((day, index) => {
            if (explicitlyMentionedDays.has(index) || day.note) return;
            days[index] = { ...day, open: false, start: '', end: '', note: 'closed' };
        });
    }

    if (parsedCount < 1 || days.every(day => !day.open && !day.note)) return null;
    const orderedDays = [1, 2, 3, 4, 5, 6, 0].map(index => days[index]);
    const openGroups = orderedDays
        .filter(day => day.open)
        .reduce((groups: Array<{ start: string; end: string; labels: string[] }>, day) => {
            const last = groups[groups.length - 1];
            if (last && last.start === day.start && last.end === day.end) last.labels.push(day.label);
            else groups.push({ start: day.start, end: day.end, labels: [day.label] });
            return groups;
        }, []);
    return { days: orderedDays, openGroups };
}

function parseStoredOpeningTemplate(value: unknown) {
    if (!value || typeof value !== 'object') return null;
    const template = value as {
        schema?: string;
        weekly?: Array<{
            day?: string;
            open?: boolean | null;
            ranges?: Array<{ start?: string; end?: string }>;
            note?: string;
        }>;
    };
    if (template.schema !== 'museum_map_opening_hours_v1' || !Array.isArray(template.weekly)) return null;

    const dayIndexes: Record<string, number> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
    };
    const days = WEEKDAY_KO.map((label, index) => ({
        index,
        label,
        open: false,
        start: '',
        end: '',
        note: '',
    }));

    template.weekly.forEach(day => {
        const index = dayIndexes[String(day.day || '').toLowerCase()];
        if (index === undefined) return;
        const firstRange = Array.isArray(day.ranges) ? day.ranges[0] : undefined;
        const start = firstRange?.start || '';
        const end = firstRange?.end || '';
        const suspiciousMidnight = start === '00:00' && end !== '00:00' && end !== '23:59';
        days[index] = {
            ...days[index],
            open: day.open === true && Boolean(start && end) && !suspiciousMidnight,
            start: suspiciousMidnight ? '' : start,
            end: suspiciousMidnight ? '' : end,
            note: day.open === false ? 'closed' : suspiciousMidnight ? 'unknown' : day.note || '',
        };
    });

    if (days.every(day => !day.open && !day.note)) return null;
    const orderedDays = [1, 2, 3, 4, 5, 6, 0].map(index => days[index]);
    const openGroups = orderedDays
        .filter(day => day.open)
        .reduce((groups: Array<{ start: string; end: string; labels: string[] }>, day) => {
            const last = groups[groups.length - 1];
            if (last && last.start === day.start && last.end === day.end) last.labels.push(day.label);
            else groups.push({ start: day.start, end: day.end, labels: [day.label] });
            return groups;
        }, []);
    return { days: orderedDays, openGroups };
}

function compactAddressLabel(address: string | undefined, city: string | undefined, cityKo: string | undefined, locale: string) {
    const cityLabel = locale === 'ko' ? (cityKo || city || '') : (city || cityKo || '');
    const value = String(address || '').trim();
    if (!value) return cityLabel;
    if (locale === 'ko') {
        const koReplacements: Array<[RegExp, string]> = [
            [/\bSouth Korea\b/gi, '대한민국'],
            [/\bSeoul\b/gi, '서울'],
            [/\bGongju\b/gi, '공주'],
            [/\bGangnam District\b/gi, '강남구'],
            [/\bJongno District\b/gi, '종로구'],
            [/\bJung District\b/gi, '중구'],
            [/\bYongsan District\b/gi, '용산구'],
            [/\bSongpa District\b/gi, '송파구'],
            [/\bMapo District\b/gi, '마포구'],
            [/\bCheongdam-dong\b/gi, '청담동'],
            [/\bYeoksam-dong\b/gi, '역삼동'],
            [/\bSinsa-dong\b/gi, '신사동'],
            [/\bSamseong-dong\b/gi, '삼성동'],
        ];
        const koAddress = koReplacements.reduce((next, [pattern, replacement]) => next.replace(pattern, replacement), value);
        const adminParts = koAddress
            .split(/[\s,]+/)
            .map(part => part.replace(/[0-9\-번길로]+$/g, '').trim())
            .filter(Boolean)
            .filter(part => /[가-힣]+(도|특별시|광역시|시|군|구|동|읍|면)$/.test(part))
            .filter(part => !/대한민국/.test(part));
        const uniqueParts = Array.from(new Set(adminParts));
        if (uniqueParts.length) {
            const hasCity = cityLabel && uniqueParts.some(part => cityLabel.includes(part) || part.includes(cityLabel));
            const parts = hasCity || !cityLabel ? uniqueParts : [cityLabel, ...uniqueParts];
            return Array.from(new Set(parts)).slice(0, 4).join(' · ');
        }
    }
    const koNeighborhood = value
        .split(/[\s,]+/)
        .map(part => part.replace(/[0-9\-번길로]+$/g, '').trim())
        .filter(Boolean)
        .reverse()
        .find(part => /[가-힣]+(동|읍|면|구|시)$/.test(part));
    if (koNeighborhood && cityLabel && !cityLabel.includes(koNeighborhood)) return `${cityLabel} · ${koNeighborhood}`;
    if (koNeighborhood) return koNeighborhood;
    if (cityLabel) return cityLabel;
    const parts = value.split(',').map(part => part.trim()).filter(Boolean);
    return parts.slice(-2, -1)[0] || parts[0] || value;
}

function stripParentheticalDetail(value: string | undefined) {
    return String(value || '')
        .replace(/\s*[（(][^()（）]*[)）]\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function koDayRangeIncludesToday(start: number, end: number, today: number) {
    if (start < 0 || end < 0 || today < 0) return false;
    if (start <= end) return today >= start && today <= end;
    return today >= start || today <= end;
}

function koDayPartIncludesToday(part: string, dayIndex: number) {
    if (dayIndex < 0) return false;
    const koShort = WEEKDAY_KO[dayIndex];
    const normalized = part
        .replace(/요일/g, '')
        .replace(/\s+/g, '')
        .replace(/[()]/g, '');
    const prefix = normalized.split(/(?:\d|오전|오후|AM|PM|Closed|closed|휴관|운영|개관)/i)[0] || normalized;
    const dayGroups = prefix.match(/[일월화수목금토](?:[·,\/]\s*[일월화수목금토]|[~-]\s*[일월화수목금토])*/g) || [];

    return dayGroups.some(group => {
        const range = group.match(/^([일월화수목금토])\s*[~-]\s*([일월화수목금토])$/);
        if (range) {
            return koDayRangeIncludesToday(WEEKDAY_KO.indexOf(range[1]), WEEKDAY_KO.indexOf(range[2]), dayIndex);
        }
        return group.split(/[·,\/]/).map(day => day.trim()).includes(koShort);
    });
}

function getTodayHoursSegment(hoursValue: string, dayName: string, dayIndex: number) {
    const koShort = WEEKDAY_KO[dayIndex < 0 ? 1 : dayIndex];
    const koFull = WEEKDAY_KO_FULL[dayIndex < 0 ? 1 : dayIndex];
    const jaShort = WEEKDAY_JA[dayIndex < 0 ? 1 : dayIndex];
    const jaFull = WEEKDAY_JA_FULL[dayIndex < 0 ? 1 : dayIndex];
    const dayNames = [dayName, koFull, koShort, jaFull, jaShort];
    const parts = hoursValue
        .replace(/\r?\n/g, ' / ')
        .split(/\s*(?:\/|,|;|。|\.)(?=\s*(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|[일월화수목금토日月火水木金土]|월요일|화요일|수요일|목요일|금요일|토요일|일요일|日曜日|月曜日|火曜日|水曜日|木曜日|金曜日|土曜日))/i)
        .map(part => part.trim())
        .filter(Boolean);

    const explicit = parts.find(part => {
        const normalizedPart = part.replace(/\s+/g, ' ');
        return dayNames.some(day => new RegExp(`(^|\\b|\\s)${day}(요일)?\\s*[:：]?`, 'i').test(normalizedPart))
            || koDayPartIncludesToday(normalizedPart, dayIndex);
    });
    if (explicit) return explicit;

    const compactClosed = new RegExp(`(^|[\\s,·/~-〜～])(${koShort}(요일)?|${jaShort}(曜日)?)\\s*(정기\\s*)?(휴관|휴무|休館|定休日|閉館)`, 'i');
    if (compactClosed.test(hoursValue)) return `${koFull}: 휴관`;
    const closedClauses = hoursValue.match(/[일월화수목금토](?:요일)?(?:\s*[·,\/~-]\s*[일월화수목금토](?:요일)?)*\s*(?:정기\s*)?휴관/g) || [];
    if (closedClauses.some(clause => new RegExp(`${koShort}(요일)?`).test(clause))) return `${koFull}: 휴관`;

    return hoursValue;
}

function getOpenStatus(hoursValue: string | undefined, country: string | undefined, locale: string) {
    const labels = {
        open: ({
            ko: '오늘 운영중',
            en: 'Open today',
            ja: '本日開館中',
            de: 'Heute geöffnet',
            fr: 'Ouvert aujourd’hui',
            es: 'Abierto hoy',
            pt: 'Aberto hoje',
            'zh-CN': '今日开放',
            'zh-TW': '今日開放',
            da: 'Åben i dag',
            fi: 'Auki tänään',
            sv: 'Öppet idag',
            et: 'Täna avatud',
        } as Record<string, string>)[locale] || 'Open today',
        ended: ({
            ko: '운영 종료',
            en: 'Closed for today',
            ja: '本日の営業終了',
            de: 'Heute geschlossen',
            fr: 'Fermé pour aujourd’hui',
            es: 'Cerrado por hoy',
            pt: 'Fechado por hoje',
            'zh-CN': '今日已闭馆',
            'zh-TW': '今日已休館',
            da: 'Lukket for i dag',
            fi: 'Suljettu tältä päivältä',
            sv: 'Stängt för idag',
            et: 'Tänaseks suletud',
        } as Record<string, string>)[locale] || 'Closed for today',
        todayClosed: ({
            ko: '오늘 휴관',
            en: 'Closed today',
            ja: '本日休館',
            de: 'Heute geschlossen',
            fr: 'Fermé aujourd’hui',
            es: 'Cerrado hoy',
            pt: 'Fechado hoje',
            'zh-CN': '今日闭馆',
            'zh-TW': '今日休館',
            da: 'Lukket i dag',
            fi: 'Suljettu tänään',
            sv: 'Stängt idag',
            et: 'Täna suletud',
        } as Record<string, string>)[locale] || 'Closed today',
        closed: ({
            ko: '장기 휴관',
            en: 'Long-term closure',
            ja: '長期休館',
            de: 'Langfristig geschlossen',
            fr: 'Fermeture longue durée',
            es: 'Cierre prolongado',
            pt: 'Fechamento prolongado',
            'zh-CN': '长期闭馆',
            'zh-TW': '長期休館',
            da: 'Langvarigt lukket',
            fi: 'Pitkäaikaisesti suljettu',
            sv: 'Långvarigt stängt',
            et: 'Pikaajaliselt suletud',
        } as Record<string, string>)[locale] || 'Long-term closure',
    };
    if (!hoursValue) return null;
    const timeZone = COUNTRY_TIMEZONES[country || ''] || 'UTC';
    const local = parseLocalParts(timeZone);
    const dayIndex = WEEKDAY_KEYS.indexOf(local.weekday as any);
    const koDay = WEEKDAY_KO[dayIndex < 0 ? 1 : dayIndex];
    const jaDay = WEEKDAY_JA[dayIndex < 0 ? 1 : dayIndex];
    const dayName = local.weekday;
    const todaySegment = getTodayHoursSegment(hoursValue, dayName, dayIndex);
    const normalized = todaySegment.replace(/\s+/g, ' ');
    const hasExplicitTodaySegment = todaySegment !== hoursValue
        || new RegExp(`(^|\\b|\\s)(${dayName}|${koDay}(요일)?|${jaDay}(曜日)?)\\s*[:：]?`, 'i').test(normalized)
        || koDayPartIncludesToday(normalized, dayIndex);
    const closedRegex = new RegExp(`(${dayName}|${koDay}(요일)?|${jaDay}(曜日)?)\\s*[:：]?\\s*(Closed|휴관|휴무|정기\\s*휴관|休館|定休日|閉館|closed)`, 'i');
    const genericClosedOnly = /^(closed|휴관|휴무|정기\s*휴관|休館|定休日|閉館|闭馆)$/i.test(normalized);
    const todayClosedClauses = normalized.match(/[일월화수목금토](?:요일)?(?:\s*[·,\/~-]\s*[일월화수목금토](?:요일)?)*\s*(?:정기\s*)?휴관/g) || [];
    const todayClosedByClause = todayClosedClauses.some(clause => koDayPartIncludesToday(clause, dayIndex));
    const hasClockRange = CLOCK_RANGE_PATTERN.test(normalized);
    if (closedRegex.test(normalized)
        || todayClosedByClause
        || (hasExplicitTodaySegment && !hasClockRange && /closed|휴관|휴무|休館|定休日|閉館|闭馆/i.test(normalized))
        || genericClosedOnly) {
        const isTodaySpecificClosure = hasExplicitTodaySegment || todayClosedByClause || closedRegex.test(normalized);
        return isTodaySpecificClosure
            ? { kind: 'todayClosed' as const, label: labels.todayClosed }
            : { kind: 'closed' as const, label: labels.closed };
    }
    if (/open\s*24\s*hours|24\s*시간|24시간/i.test(normalized)) {
        return { kind: 'open' as const, label: labels.open };
    }
    const ranges = Array.from(normalized.matchAll(CLOCK_RANGE_PATTERN_GLOBAL));
    if (ranges.length === 0) return null;
    const anyOpen = ranges.some(match => {
        const start = parseClockMinutes(inferStartClockMeridiem(match[1], match[2]));
        let end = parseClockMinutes(match[2]);
        if (start == null || end == null) return false;
        if (start === 0 && end === 0) return true;
        if (end < start) end += 24 * 60;
        const current = end >= 24 * 60 && local.minutes < start ? local.minutes + 24 * 60 : local.minutes;
        return current >= start && current <= end;
    });
    return anyOpen ? { kind: 'open' as const, label: labels.open } : { kind: 'ended' as const, label: labels.ended };
}

// Sub-component for translating general text (titles, descriptions)
function TranslatedText({ text, targetLocale }: { text: string; targetLocale: string }) {
    const { text: translated, isTranslating } = useTranslatedText(text, targetLocale as Locale, { withLoading: true });
    if (isTranslating) return <TextSkeleton />;
    return <>{translated}</>;
}

function hasArtworkImage(work: any) {
    return Boolean(work?.image || work?.imageUrl || work?.thumbnailUrl || work?.primaryImage);
}

function shuffleWithImagesFirst(artworks: any[]) {
    const shuffle = (items: any[]) => {
        const next = [...items];
        for (let i = next.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [next[i], next[j]] = [next[j], next[i]];
        }
        return next;
    };
    const withImages = artworks.filter(hasArtworkImage);
    const withoutImages = artworks.filter((work) => !hasArtworkImage(work));
    return [...shuffle(withImages), ...shuffle(withoutImages)];
}

function getViewAllLabel(locale: string) {
    const labels: Record<string, string> = {
        ko: '전체보기',
        en: 'View all',
        ja: 'すべて見る',
        'zh-CN': '查看全部',
        'zh-TW': '查看全部',
        de: 'Alle ansehen',
        fr: 'Tout voir',
        es: 'Ver todo',
        pt: 'Ver tudo',
        da: 'Se alle',
        fi: 'Näytä kaikki',
        sv: 'Visa alla',
        et: 'Vaata kõiki',
    };
    return labels[locale] || labels.en;
}

// Sub-component for rendering a single artwork card with translated text
function ArtworkCard({ work, locale, cachedTranslations, index, onClick, fullWidth }: { work: any; locale: string; cachedTranslations?: Record<string, string>; index: number; onClick?: () => void; fullWidth?: boolean }) {
    const cachedTitle = cachedTranslations?.[`artwork_${index}_title`];
    const [imgError, setImgError] = useState(false);
    const artworkTitle = getLocalizedArtworkTitle(work, locale);
    const artistName = getLocalizedArtistName(work, locale) || work.artist;
    return (
        <button
            type="button"
            className={`mm-featured-art-card mm-featured-art-card--overlay p-0 text-left group cursor-pointer appearance-none ${fullWidth ? 'is-single-card' : ''}`}
            onClick={onClick}
            aria-label={artworkTitle || work.title || ''}
        >
            <div className={`mm-featured-art-image relative ${work.image && !imgError ? '' : 'is-fallback'}`}>
                <img
                    src={work.image && !imgError ? work.image : '/logo.svg'}
                    alt={work.title || ''}
                    className={`w-full h-full transition-transform duration-500 ${work.image && !imgError ? 'object-cover group-hover:scale-[1.04]' : 'mm-empty-logo mm-featured-art-fallback-logo object-contain dark:invert'}`}
                    onError={() => setImgError(true)}
                />
                {work.year && (
                    <span className="mm-chip mm-chip--muted absolute left-2 top-2 px-2 py-1 text-[10px] leading-none shadow-sm backdrop-blur-md">
                        {work.year}
                    </span>
                )}
                <div className="mm-featured-art-gradient" />
                <div className="mm-featured-art-overlay">
                    {artistName && (
                        <p className="line-clamp-1">
                            {artistName}
                        </p>
                    )}
                    <h4 className="line-clamp-2">
                        {artworkTitle || cachedTitle || work.title}
                    </h4>
                </div>
            </div>
        </button>
    );
}

export default function MuseumDetailCard({ museumId, onClose, isMapContext, onSaveChange, onMoveToLocation, initialData }: { museumId: string; onClose?: () => void; isMapContext?: boolean; onSaveChange?: () => void; onMoveToLocation?: () => void; initialData?: any }) {
    const [data, setData] = useState<any>(initialData || null);
    const { locale } = useApp();
    const { showAlert } = useModal();
    const [loading, setLoading] = useState(!initialData);
    const [portalReady, setPortalReady] = useState(false);
    const [isPicked, setIsPicked] = useState(false);
    const [saveId, setSaveId] = useState<string | null>(null);
    const [showBurst, setShowBurst] = useState(false);
    const [showShrink, setShowShrink] = useState(false);
    const { data: session, status } = useSession();
    const router = useRouter();
    const { addToCompare, removeFromCompare, isInCompare } = useCompare();
    const { saves: accountSaves, loading: savesLoading, setCachedSaves } = useAccountSaves();
    const isSignedInUser = status === 'authenticated' && !session?.user?.name?.startsWith('guest_');
    const [activeTrip, setActiveTrip] = useState<any>(null);
    const [tripVisitSaving, setTripVisitSaving] = useState(false);

    const goLogin = useCallback(() => {
        if (typeof window === 'undefined') return;
        const callbackUrl = `${window.location.pathname}${window.location.search}`;
        window.location.assign(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }, []);

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
        window.location.assign(`/artworks/${artworkId}?${params.toString()}`);
    }, [isMapContext, museumId]);

    const openMuseumArtworkList = useCallback(() => {
        const params = new URLSearchParams({ museumId });
        const museumName = getLocalizedMuseumName(data, locale) || data?.nameKo || data?.name || '';
        if (museumName) params.set('museumName', museumName);
        if (typeof window !== 'undefined') {
            try {
                sessionStorage.setItem(RETURN_TO_MUSEUM_DETAIL_KEY, JSON.stringify({
                    museumId,
                    fromMap: !!isMapContext,
                    ts: Date.now(),
                }));
                sessionStorage.setItem('navigating-forward', String(Date.now()));
            } catch { }
        }
        window.location.assign(`/artworks?${params.toString()}`);
    }, [data, isMapContext, locale, museumId]);

    const [reportOpen, setReportOpen] = useState(false);
    const [fullDescriptionOpen, setFullDescriptionOpen] = useState(false);
    const [fullDescriptionClosing, setFullDescriptionClosing] = useState(false);
    const [visitInfoSheet, setVisitInfoSheet] = useState<null | 'hours' | 'admission'>(null);
    const [visitInfoSheetClosing, setVisitInfoSheetClosing] = useState(false);
    const [openStatusTipOpen, setOpenStatusTipOpen] = useState(false);
    const [directionsSheetOpen, setDirectionsSheetOpen] = useState(false);
    const [directionsSheetClosing, setDirectionsSheetClosing] = useState(false);
    const [copyToast, setCopyToast] = useState(false);
    const [copyToastExiting, setCopyToastExiting] = useState(false);
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
    const openStatusTipRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        setPortalReady(true);
    }, []);

    useEffect(() => {
        if (status === 'loading') return;
        const refreshTrip = (event?: Event) => {
            const eventTrip = event instanceof CustomEvent ? event.detail : null;
            setActiveTrip(eventTrip || getActiveTripForAccount(session?.user?.email));
        };
        refreshTrip();
        window.addEventListener(ACTIVE_TRIP_CHANGE_EVENT, refreshTrip);
        window.addEventListener('storage', refreshTrip);
        return () => {
            window.removeEventListener(ACTIVE_TRIP_CHANGE_EVENT, refreshTrip);
            window.removeEventListener('storage', refreshTrip);
        };
    }, [session?.user?.email, status]);

    const openFullDescription = useCallback(() => {
        setFullDescriptionClosing(false);
        setFullDescriptionOpen(true);
    }, []);

    const closeFullDescription = useCallback(() => {
        setFullDescriptionClosing(true);
        window.setTimeout(() => {
            setFullDescriptionOpen(false);
            setFullDescriptionClosing(false);
        }, 260);
    }, []);

    const openVisitInfoSheet = useCallback((sheet: 'hours' | 'admission') => {
        setVisitInfoSheetClosing(false);
        setVisitInfoSheet(sheet);
    }, []);

    const closeVisitInfoSheet = useCallback(() => {
        setVisitInfoSheetClosing(true);
        window.setTimeout(() => {
            setVisitInfoSheet(null);
            setVisitInfoSheetClosing(false);
        }, 240);
    }, []);

    const openDirectionsSheet = useCallback(() => {
        setDirectionsSheetClosing(false);
        setDirectionsSheetOpen(true);
    }, []);

    const closeDirectionsSheet = useCallback(() => {
        setDirectionsSheetClosing(true);
        window.setTimeout(() => {
            setDirectionsSheetOpen(false);
            setDirectionsSheetClosing(false);
        }, 240);
    }, []);

    useEffect(() => {
        if (!openStatusTipOpen) return;

        const handleOutsidePointer = (event: Event) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (openStatusTipRef.current?.contains(target)) return;
            setOpenStatusTipOpen(false);
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpenStatusTipOpen(false);
        };

        const usePointerEvent = typeof window !== 'undefined' && 'PointerEvent' in window;
        const primaryEvent = usePointerEvent ? 'pointerdown' : 'touchstart';
        document.addEventListener(primaryEvent, handleOutsidePointer, true);
        if (!usePointerEvent) document.addEventListener('mousedown', handleOutsidePointer, true);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener(primaryEvent, handleOutsidePointer, true);
            if (!usePointerEvent) document.removeEventListener('mousedown', handleOutsidePointer, true);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [openStatusTipOpen]);

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
    const embeddedSummary = locale !== 'ko' ? data?.summaryTranslations?.[locale] : undefined;
    const { isTranslating: isDescTranslating } = useTranslatedText(null, locale, { withLoading: true });
    const { text: translatedSummary, isTranslating: isSummaryTranslating } = useTranslatedText(embeddedSummary ? null : data?.summary, locale, { withLoading: true });
    // DB-cached translations for museum
    const { translations: cachedMuseum } = useCachedTranslation('museum', data?.id, locale);
    // Museum names should always display in their original language

    // Shuffle artworks each time data loads or museumId changes
    const [shuffledArtworks, setShuffledArtworks] = useState<any[]>([]);
    const [shuffleKey, setShuffleKey] = useState(0);
    const [shuffleSpinning, setShuffleSpinning] = useState(false);
    const reshuffleArtworks = () => {
        if (!data?.artworks) return;
        setShuffledArtworks(shuffleWithImagesFirst(data.artworks));
        setShuffleKey(k => k + 1);
        setShuffleSpinning(true);
        setTimeout(() => setShuffleSpinning(false), 500);
    };
    useEffect(() => {
        if (!data?.artworks) { setShuffledArtworks([]); return; }
        setShuffledArtworks(shuffleWithImagesFirst(data.artworks));
        setShuffleKey(k => k + 1);
    }, [data?.artworks, museumId]);

    useEffect(() => {
        // If initialData was provided, skip the main fetch
        if (initialData) {
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
    }, [museumId]);

    useEffect(() => {
        if (status === 'loading' || savesLoading) return;
        if (!isSignedInUser) {
            setIsPicked(false);
            setSaveId(null);
            return;
        }

        const save = accountSaves.find(s => s.museumId === museumId || s.museum?.id === museumId);
        if (save) {
            setIsPicked(true);
            setSaveId(save.id ?? null);
        } else {
            setIsPicked(false);
            setSaveId(null);
        }
    }, [accountSaves, museumId, status, isSignedInUser, savesLoading]);

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

    const featuredArtworks = shuffledArtworks.slice(0, FEATURED_ARTWORK_PREVIEW_LIMIT);
    const totalArtworkCount = Number(data?._count?.artworks) || Number(data?.artworkCount) || data?.artworks?.length || featuredArtworks.length;
    const hasMoreFeaturedArtworks = totalArtworkCount > featuredArtworks.length;
    const isKoreanDestination = isKoreanMapTarget(data.country);
    const mapTargetName = isKoreanDestination
        ? (data.nameKo || data.name || getLocalizedMuseumName(data, locale))
        : (getLocalizedMuseumName(data, locale) || data.name);
    const mapLinks = buildMapLinks({ name: mapTargetName, lat: data.latitude, lng: data.longitude });
    const appleFirst = typeof window !== 'undefined' && isAppleDevice();
    const naverDirectionsHref = typeof window !== 'undefined' && isAndroidDevice()
        ? mapLinks.naverDirectionsIntent
        : mapLinks.naverDirections;
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
    const detailTripVisitLabels = DETAIL_TRIP_VISIT_LABELS[locale] || DETAIL_TRIP_VISIT_LABELS.en;
    const activeTripStop = data?.id ? findTripStopForMuseum(activeTrip, data.id) : null;
    const showTripVisitAction = !!activeTripStop;
    const activeTripStopVisited = isStopVisited(activeTripStop);

    const handleCopyAddress = (address: string) => {
        navigator.clipboard.writeText(address).then(() => {
            setCopyToast(true);
            setCopyToastExiting(false);
            setTimeout(() => {
                setCopyToastExiting(true);
                setTimeout(() => setCopyToast(false), 300);
            }, 2000);
        }).catch(() => {/* ignore */ });
    };

    const handleToggleCompare = () => {
        if (!data) return;
        if (status === 'loading') {
            showAlert(locale === 'ko' ? '계정 정보를 확인하는 중이에요. 잠시 후 다시 시도해 주세요.' : 'Checking your account. Please try again in a moment.');
            return;
        }
        if (!isSignedInUser) { goLogin(); return; }
        if (isInCompare(data.id)) {
            removeFromCompare(data.id);
            triggerCompareToast(t('compare.removed', locale), false, false);
        } else {
            const added = addToCompare(data.id);
            if (added) triggerCompareToast(t('compare.added', locale), false);
            else triggerCompareToast(t('compare.full', locale), true);
        }
    };

    const handleToggleTripVisit = async () => {
        if (!activeTrip || !data?.id || tripVisitSaving) return;
        const tripStop = findTripStopForMuseum(activeTrip, data.id);
        if (!tripStop || activeTrip.pending) return;
        const labels = DETAIL_TRIP_VISIT_LABELS[locale] || DETAIL_TRIP_VISIT_LABELS.en;
        const wasVisited = isStopVisited(tripStop);
        const nextVisited = wasVisited ? null : { visitedAt: new Date().toISOString(), reviewId: tripStop.reviewId || null };
        const previousTrip = activeTrip;
        const applyTrip = (trip: any) => {
            setActiveTrip(trip);
            setActiveTripForAccount(trip);
        };

        setTripVisitSaving(true);
        applyTrip({
            ...activeTrip,
            stops: updateTripStopVisitState(activeTrip.stops || [], { id: tripStop.id, museumId: tripStop.museumId || data.id }, nextVisited),
        });
        try {
            const response = await fetch('/api/visited', {
                method: wasVisited ? 'DELETE' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planStopId: tripStop.id, museumId: tripStop.museumId || data.id, reviewId: tripStop.reviewId }),
            });
            if (!response.ok) throw new Error('Failed to save visit');
            if (!wasVisited) {
                const result = await response.json();
                const savedVisit = {
                    visitedAt: result.data?.visitedAt || nextVisited?.visitedAt || new Date().toISOString(),
                    reviewId: result.data?.id || result.data?.reviewId || tripStop.reviewId || null,
                };
                applyTrip({
                    ...activeTrip,
                    stops: updateTripStopVisitState(activeTrip.stops || [], { id: tripStop.id, museumId: tripStop.museumId || data.id }, savedVisit),
                });
            }
            showAlert(wasVisited ? labels.removed : labels.saved);
        } catch {
            applyTrip(previousTrip);
            showAlert(wasVisited ? labels.removeFailed : labels.failed);
        } finally {
            setTripVisitSaving(false);
        }
    };

    const handleTogglePick = async (e?: React.MouseEvent<HTMLButtonElement>) => {
        e?.preventDefault();
        if (!data) return;
        if (status === 'loading') {
            showAlert(locale === 'ko' ? '계정 정보를 확인하는 중이에요. 잠시 후 다시 시도해 주세요.' : 'Checking your account. Please try again in a moment.');
            return;
        }
        if (!isSignedInUser) { goLogin(); return; }
        if (isPicked && saveId) {
            const prevSaveId = saveId;
            setIsPicked(false);
            setSaveId(null);
            triggerShrink();
            try {
                const response = await fetch(`/api/me/saves/${prevSaveId}`, { method: 'DELETE' });
                if (response.status === 401) {
                    setIsPicked(true);
                    setSaveId(prevSaveId);
                    goLogin();
                    return;
                }
                if (!response.ok) throw new Error('Failed to delete save');
                setCachedSaves(prev => prev.filter(s => s.id !== prevSaveId && s.museumId !== data.id && s.museum?.id !== data.id));
                onSaveChange?.();
            } catch {
                setIsPicked(true);
                setSaveId(prevSaveId);
                showAlert(t('global.saveError', locale));
            }
        } else {
            setIsPicked(true);
            triggerBurst();
            try {
                const response = await fetch('/api/saves', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ museumId: data.id }),
                });
                if (response.status === 401) {
                    setIsPicked(false);
                    goLogin();
                    return;
                }
                if (!response.ok) throw new Error('Failed to save museum');
                const res = await response.json();
                const nextSaveId = res.data?.id || res.data?._id;
                if (!nextSaveId) throw new Error('Missing save id');
                setSaveId(nextSaveId);
                setCachedSaves(prev => [
                    {
                        ...res.data,
                        id: nextSaveId,
                        museumId: res.data?.museumId || data.id,
                        museum: res.data?.museum || data,
                    },
                    ...prev.filter(s => s.museumId !== data.id && s.museum?.id !== data.id),
                ]);
                onSaveChange?.();
                triggerSaveToast();
                gtag.event('save_museum', { category: 'museum', label: data.name, value: 1 });
            } catch {
                setIsPicked(false);
                showAlert(t('global.saveError', locale));
            }
        }
    };

    const visitorItems = Array.isArray(data.visitorInfo) ? data.visitorInfo : [];
    const quickHoursItem = findVisitorHoursItem(visitorItems)?.item;
    const admissionItem = visitorItems.find((item: any) => item.icon === '🎫' || item.label?.includes('입장') || item.label?.includes('요금'));
    const museumLocaleForAddress = getLocaleFromCountry(data.country);
    const statusHoursValue = normalizeOpeningHoursSource(data.openingHours) || quickHoursItem?.value;
    const openStatus = resolveMuseumOpenStatus(data, locale);
    const openingTemplate = parseStoredOpeningTemplate(data.openingHours) || parseWeeklyOpeningTemplate(statusHoursValue);
    const localForOpening = parseLocalParts(COUNTRY_TIMEZONES[data.country || ''] || 'UTC');
    const todayIndex = WEEKDAY_KEYS.indexOf(localForOpening.weekday as any);
    const todayOpening = openingTemplate?.days.find(day => day.index === todayIndex);
    const todayRawHoursSegment = statusHoursValue
        ? getTodayHoursSegment(statusHoursValue, localForOpening.weekday, todayIndex)
        : undefined;
    const todayRawRange = findClockRange(todayRawHoursSegment || statusHoursValue);
    const closedDays = openingTemplate?.days
        .filter(day => !day.open && day.note === 'closed')
        || [];
    const detailDescription = locale === 'ko'
        ? (data.descriptionKo || cachedMuseum.description || translateDescription(data.description, locale))
        : locale === 'en'
            ? data.description
            : (cachedMuseum.description || translateDescription(data.description, locale));
    const decisionLabels = ({
        ko: { title: '방문 전에 확인해요', directions: '길찾기', rating: '평점', hours: '운영 정보', access: '가는 길', address: '주소' },
        en: { title: 'Before you visit', directions: 'Directions', rating: 'Rating', hours: 'Hours', access: 'Getting there', address: 'Address' },
        ja: { title: '訪問前に確認', directions: '経路を見る', rating: '評価', hours: '営業時間', access: 'アクセス', address: '住所' },
        de: { title: 'Vor dem Besuch', directions: 'Route', rating: 'Bewertung', hours: 'Öffnungszeiten', access: 'Anfahrt', address: 'Adresse' },
        fr: { title: 'Avant la visite', directions: 'Itinéraire', rating: 'Note', hours: 'Horaires', access: 'Accès', address: 'Adresse' },
        es: { title: 'Antes de visitar', directions: 'Cómo llegar', rating: 'Valoración', hours: 'Horario', access: 'Acceso', address: 'Dirección' },
        pt: { title: 'Antes da visita', directions: 'Como chegar', rating: 'Avaliação', hours: 'Horário', access: 'Acesso', address: 'Endereço' },
        'zh-CN': { title: '到访前确认', directions: '路线', rating: '评分', hours: '开放时间', access: '交通', address: '地址' },
        'zh-TW': { title: '到訪前確認', directions: '路線', rating: '評分', hours: '開放時間', access: '交通', address: '地址' },
        da: { title: 'Før besøget', directions: 'Rute', rating: 'Bedømmelse', hours: 'Åbningstider', access: 'Transport', address: 'Adresse' },
        fi: { title: 'Ennen vierailua', directions: 'Reitti', rating: 'Arvio', hours: 'Aukiolo', access: 'Kulkuyhteydet', address: 'Osoite' },
        sv: { title: 'Före besöket', directions: 'Vägbeskrivning', rating: 'Betyg', hours: 'Öppettider', access: 'Transport', address: 'Adress' },
        et: { title: 'Enne külastust', directions: 'Teekond', rating: 'Hinnang', hours: 'Lahtiolekuajad', access: 'Transport', address: 'Aadress' },
    } as Record<string, { title: string; directions: string; rating: string; hours: string; access: string; address: string }>)[locale] || {
        title: 'Before you visit',
        directions: 'Directions',
        rating: 'Rating',
        hours: 'Hours',
        access: 'Getting there',
        address: 'Address',
    };
    const timeLabels = ({
        ko: { open: '오픈', close: '클로즈', closed: '휴관', expected: '관람 예상', admission: '입장료', until: '까지' },
        en: { open: 'Open', close: 'Close', closed: 'Closed', expected: 'Visit time', admission: 'Admission', until: 'until' },
        ja: { open: '開館', close: '閉館', closed: '休館', expected: '観覧目安', admission: '入場料', until: 'まで' },
        de: { open: 'Öffnet', close: 'Schließt', closed: 'Geschlossen', expected: 'Besuchszeit', admission: 'Eintritt', until: 'bis' },
        fr: { open: 'Ouverture', close: 'Fermeture', closed: 'Fermé', expected: 'Durée prévue', admission: 'Entrée', until: 'jusqu’à' },
        es: { open: 'Abre', close: 'Cierra', closed: 'Cerrado', expected: 'Tiempo estimado', admission: 'Entrada', until: 'hasta' },
        pt: { open: 'Abre', close: 'Fecha', closed: 'Fechado', expected: 'Tempo estimado', admission: 'Entrada', until: 'até' },
        'zh-CN': { open: '开放', close: '关闭', closed: '闭馆', expected: '预计参观', admission: '门票', until: '至' },
        'zh-TW': { open: '開放', close: '關閉', closed: '休館', expected: '預計參觀', admission: '門票', until: '至' },
        da: { open: 'Åbner', close: 'Lukker', closed: 'Lukket', expected: 'Besøgstid', admission: 'Entré', until: 'til' },
        fi: { open: 'Aukeaa', close: 'Sulkeutuu', closed: 'Suljettu', expected: 'Vierailuaika', admission: 'Pääsymaksu', until: 'asti' },
        sv: { open: 'Öppnar', close: 'Stänger', closed: 'Stängt', expected: 'Besökstid', admission: 'Entré', until: 'till' },
        et: { open: 'Avab', close: 'Sulgeb', closed: 'Suletud', expected: 'Külastusaeg', admission: 'Sissepääs', until: 'kuni' },
    } as Record<string, { open: string; close: string; closed: string; expected: string; admission: string; until: string }>)[locale] || { open: 'Open', close: 'Close', closed: 'Closed', expected: 'Visit time', admission: 'Admission', until: 'until' };
    const allDayLabel = ({
        ko: '24시간',
        en: '24 hours',
        ja: '24時間',
        de: '24 Stunden',
        fr: '24 h',
        es: '24 horas',
        pt: '24 horas',
        'zh-CN': '24小时',
        'zh-TW': '24小時',
        da: '24 timer',
        fi: '24 tuntia',
        sv: '24 timmar',
        et: '24 tundi',
    } as Record<string, string>)[locale] || '24 hours';
    const formatOpeningRange = (start: string, end: string) => {
        if (start === '00:00' && end === '00:00') return allDayLabel;
        if (start === '00:00' && end !== '23:59') return '-';
        return `${start} - ${end}`;
    };
    const visitInfoDisclaimer = ({
        ko: '운영 정보는 현장 상황이나 공식 공지에 따라 달라질 수 있어요.',
        en: 'Hours may change depending on onsite conditions or official notices.',
        ja: '運営情報は現地状況や公式案内により変わることがあります。',
        de: 'Öffnungszeiten können sich durch Bedingungen vor Ort oder offizielle Hinweise ändern.',
        fr: 'Les horaires peuvent changer selon la situation sur place ou les annonces officielles.',
        es: 'El horario puede cambiar según la situación del lugar o los avisos oficiales.',
        pt: 'Os horários podem mudar conforme as condições do local ou avisos oficiais.',
        'zh-CN': '开放信息可能会因现场情况或官方公告而变化。',
        'zh-TW': '開放資訊可能會依現場狀況或官方公告而變動。',
        da: 'Åbningstider kan ændre sig efter forhold på stedet eller officielle meddelelser.',
        fi: 'Aukioloajat voivat muuttua paikan tilanteen tai virallisten tiedotteiden mukaan.',
        sv: 'Öppettider kan ändras beroende på läget på plats eller officiella meddelanden.',
        et: 'Lahtiolekuajad võivad muutuda kohapealsete olude või ametlike teadete järgi.',
    } as Record<string, string>)[locale] || 'Hours may change depending on onsite conditions or official notices.';
    const directionsSheetLabels = ({
        ko: { title: '지도 앱 선택', desc: '어떤 지도에서 길찾기를 볼까요?', apple: 'Apple 지도', google: 'Google 지도', kakao: '카카오맵', naver: '네이버지도' },
        en: { title: 'Choose a map app', desc: 'Which map would you like to use?', apple: 'Apple Maps', google: 'Google Maps', kakao: 'Kakao Map', naver: 'NAVER Map' },
        ja: { title: '地図アプリを選択', desc: 'どの地図で経路を確認しますか？', apple: 'Appleマップ', google: 'Googleマップ', kakao: 'Kakao Map', naver: 'NAVER Map' },
        de: { title: 'Karten-App wählen', desc: 'Welche Karte möchten Sie verwenden?', apple: 'Apple Karten', google: 'Google Maps', kakao: 'Kakao Map', naver: 'NAVER Map' },
        fr: { title: 'Choisir une carte', desc: 'Quelle carte souhaitez-vous utiliser ?', apple: 'Plans Apple', google: 'Google Maps', kakao: 'Kakao Map', naver: 'NAVER Map' },
        es: { title: 'Elige una app de mapas', desc: '¿Qué mapa quieres usar?', apple: 'Apple Maps', google: 'Google Maps', kakao: 'Kakao Map', naver: 'NAVER Map' },
        pt: { title: 'Escolha um app de mapas', desc: 'Qual mapa você quer usar?', apple: 'Apple Maps', google: 'Google Maps', kakao: 'Kakao Map', naver: 'NAVER Map' },
        'zh-CN': { title: '选择地图应用', desc: '你想用哪个地图查看路线？', apple: 'Apple 地图', google: 'Google 地图', kakao: 'Kakao Map', naver: 'NAVER Map' },
        'zh-TW': { title: '選擇地圖 App', desc: '你想用哪個地圖查看路線？', apple: 'Apple 地圖', google: 'Google 地圖', kakao: 'Kakao Map', naver: 'NAVER Map' },
        da: { title: 'Vælg kort-app', desc: 'Hvilket kort vil du bruge?', apple: 'Apple Kort', google: 'Google Maps', kakao: 'Kakao Map', naver: 'NAVER Map' },
        fi: { title: 'Valitse karttasovellus', desc: 'Millä kartalla haluat nähdä reitin?', apple: 'Apple Kartat', google: 'Google Maps', kakao: 'Kakao Map', naver: 'NAVER Map' },
        sv: { title: 'Välj kartapp', desc: 'Vilken karta vill du använda?', apple: 'Apple Kartor', google: 'Google Maps', kakao: 'Kakao Map', naver: 'NAVER Map' },
        et: { title: 'Vali kaardirakendus', desc: 'Millist kaarti soovid kasutada?', apple: 'Apple Maps', google: 'Google Maps', kakao: 'Kakao Map', naver: 'NAVER Map' },
    } as Record<string, { title: string; desc: string; apple: string; google: string; kakao: string; naver: string }>)[locale] || {
        title: 'Choose a map app',
        desc: 'Which map would you like to use?',
        apple: 'Apple Maps',
        google: 'Google Maps',
        kakao: 'Kakao Map',
        naver: 'NAVER Map',
    };
    const defaultDirectionOptions = appleFirst
        ? [
            { key: 'apple' as const, label: directionsSheetLabels.apple, href: mapLinks.appleDirections, analyticsLabel: 'Apple Maps' },
            { key: 'google' as const, label: directionsSheetLabels.google, href: mapLinks.googleDirections, analyticsLabel: 'Google Maps' },
        ]
        : [
            { key: 'google' as const, label: directionsSheetLabels.google, href: mapLinks.googleDirections, analyticsLabel: 'Google Maps' },
            { key: 'apple' as const, label: directionsSheetLabels.apple, href: mapLinks.appleDirections, analyticsLabel: 'Apple Maps' },
        ];
    const directionOptions = isKoreanDestination
        ? [
            { key: 'kakao' as const, label: directionsSheetLabels.kakao, href: mapLinks.kakaoDirections, analyticsLabel: 'Kakao Map' },
            { key: 'naver' as const, label: directionsSheetLabels.naver, href: naverDirectionsHref, analyticsLabel: 'NAVER Map' },
            ...defaultDirectionOptions,
        ]
        : defaultDirectionOptions;
    const moveToLocationLabel = ({
        ko: '위치 이동하기',
        en: 'Move to location',
        ja: '位置へ移動',
        de: 'Zur Position',
        fr: 'Voir sur la carte',
        es: 'Ver ubicación',
        pt: 'Ver localização',
        'zh-CN': '移到位置',
        'zh-TW': '移到位置',
        da: 'Gå til placering',
        fi: 'Siirry sijaintiin',
        sv: 'Gå till plats',
        et: 'Liigu asukohta',
    } as Record<string, string>)[locale] || 'Move to location';
    const todayBasisLabel = ({
        ko: '금일 기준',
        en: 'Today',
        ja: '本日基準',
        de: 'Heute',
        fr: 'Aujourd’hui',
        es: 'Hoy',
        pt: 'Hoje',
        'zh-CN': '今日',
        'zh-TW': '今日',
        da: 'I dag',
        fi: 'Tänään',
        sv: 'I dag',
        et: 'Täna',
    } as Record<string, string>)[locale] || 'Today';
    const unknownOpenStatusLabel = ({
        ko: '운영 확인 필요',
        en: 'Check hours',
        ja: '営業時間を確認',
        de: 'Zeiten prüfen',
        fr: 'Horaires à vérifier',
        es: 'Consultar horario',
        pt: 'Verificar horário',
        'zh-CN': '请确认开放时间',
        'zh-TW': '請確認開放時間',
        da: 'Tjek åbningstid',
        fi: 'Tarkista aukiolo',
        sv: 'Kontrollera tider',
        et: 'Kontrolli aegu',
    } as Record<string, string>)[locale] || 'Check hours';
    const admissionDisplay = admissionItem?.value ? stripParentheticalDetail(translateViValue(admissionItem.value, locale)) : '';
    const admissionTitle = ({
        ko: '입장/관람료',
        en: 'Admission',
        ja: '入場・観覧料',
        de: 'Eintritt',
        fr: 'Entrée',
        es: 'Entrada',
        pt: 'Entrada',
        'zh-CN': '门票',
        'zh-TW': '門票',
        da: 'Entré',
        fi: 'Pääsymaksu',
        sv: 'Entré',
        et: 'Sissepääs',
    } as Record<string, string>)[locale] || 'Admission';
    const primaryOpeningGroup = openingTemplate?.openGroups?.[0];
    const hoursDisplay = todayOpening?.open
        ? formatOpeningRange(todayOpening.start, todayOpening.end)
        : todayRawRange
            ? formatOpeningRange(todayRawRange.start, todayRawRange.end)
        : primaryOpeningGroup
            ? formatOpeningRange(primaryOpeningGroup.start, primaryOpeningGroup.end)
            : todayOpening?.note === 'closed'
                ? timeLabels.closed
                : '-';
    const closedDaysLabel = closedDays
        .map(day => getWeekdayLabel(day.index, locale).replace(/요일$/, ''))
        .join('·');
    const displayedOpenStatus = openStatus || { kind: 'unknown' as const, label: unknownOpenStatusLabel, detailLabel: unknownOpenStatusLabel };
    const openUntil = todayOpening?.start === '00:00' && todayOpening?.end === '00:00'
        ? ''
        : todayOpening?.end || todayRawRange?.end;
    const openStatusLabel = displayedOpenStatus.kind === 'open' && openUntil
        ? locale === 'ko' || locale === 'ja'
            ? `${displayedOpenStatus.label} ${openUntil}${timeLabels.until}`
            : `${displayedOpenStatus.label} ${timeLabels.until} ${openUntil}`
        : displayedOpenStatus.label;

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
                    className="h-[352px] sm:h-[410px] w-full bg-gray-900"
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
                        className="mm-detail-hero-share flex absolute top-4 right-4 z-20 w-12 h-12 items-center justify-center rounded-full bg-black/42 backdrop-blur-md text-white/85 shadow-lg ring-1 ring-white/16 transition-all duration-300 hover:bg-black/60 active:scale-90"
                        aria-label="Share"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                    </button>
                    {/* PC: My Pick button on image */}
                    <button
                        onClick={handleTogglePick}
                        className={`hidden lg:flex absolute top-4 right-[8.5rem] z-20 w-12 h-12 items-center justify-center rounded-full shadow-lg transition-all duration-300 ${showBurst ? 'animate-bookmark-bounce' : showShrink ? 'animate-bookmark-shrink' : 'active:scale-90'} ${isPicked
                            ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-blue-500/30 ring-1 ring-blue-200/30'
                            : 'bg-black/42 backdrop-blur-md text-white/85 hover:bg-black/60 ring-1 ring-white/16'
                            }`}
                        aria-label={locale === 'ko' ? '내 픽' : 'My Pick'}
                    >
                        <svg className="w-6 h-6" fill={isPicked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v18l7-5 7 5V3H5z" />
                        </svg>
                    </button>
                    {/* Compare button on image */}
                    <button
                        onClick={handleToggleCompare}
                        className={`mm-detail-hero-compare flex absolute top-4 right-[4.75rem] z-20 w-12 h-12 items-center justify-center rounded-full shadow-lg transition-all duration-300 active:scale-90 ${isInCompare(data.id)
                            ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-blue-500/30 ring-1 ring-blue-200/30'
                            : 'bg-black/42 backdrop-blur-md text-blue-100 hover:bg-black/60 ring-1 ring-white/16'
                            }`}
                        aria-label={t('compare.add', locale)}
                    >
                        <svg className="w-5 h-5" fill={isInCompare(data.id) ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                        </svg>
                    </button>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                    {/* Google Places attribution */}
                    {(data.placePhotos?.length > 0 || data.imageUrl?.includes('googleusercontent')) && (
                        <span className="mm-detail-google-tag absolute left-4 top-4 z-20 inline-flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1.5 text-[9px] font-bold tracking-wide text-white/70 backdrop-blur-md ring-1 ring-white/15 pointer-events-none">
                            <CameraIcon className="h-3 w-3" />
                            Google
                        </span>
                    )}
                    <div className="mm-museum-hero-copy2 flex items-end justify-between">
                        <div className="mm-museum-hero-text2 min-w-0 flex-1 pr-4">
                            <p className="text-xs font-bold tracking-widest text-white/80 uppercase mb-1">{translateCategory(data.type, locale)} • {getLocalizedCityName(data, locale) || getCityName(data.city, locale)}, {getCountryName(data.country, locale)}</p>
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">{getLocalizedMuseumName(data, locale)}</h1>
                            {locale === 'ko' && data.nameEn && <p className="text-sm text-white/60 mt-0.5">{data.nameEn}</p>}
                            {locale !== 'ko' && <p className="text-sm text-white/60 mt-0.5">{data.nameKo || data.name}</p>}
                        </div>
                        {data.googleRating && (
                            <div className="mm-museum-hero-rating shrink-0">
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005z" />
                                </svg>
                                <span>{data.googleRating.toFixed(1)}</span>
                            </div>
                        )}
                    </div>


                </PhotoCarousel>
                </div>

                <div className="mm-detail-body mm-museum-detail-body2 pt-9 px-5 pb-5 sm:pt-11 sm:px-8 sm:pb-8">
                    {/* One-line Summary */}
                    {data.summary && (
                        <div className="museum-summary-card mb-8 rounded-2xl px-4 py-4 sm:px-5">
                            <p className="museum-summary-label mb-2 text-[13px] font-semibold tracking-[0.08em]">
                                {summaryLabel}
                            </p>
                            {locale !== 'ko' && isSummaryTranslating ? (
                                <div className="space-y-2">
                                    <div className="skeleton h-4 w-full rounded" />
                                    <div className="skeleton h-4 w-2/3 rounded" />
                                </div>
                            ) : (
                                <p className="museum-summary-text text-base leading-relaxed">
                                    {locale === 'ko' ? data.summary : embeddedSummary || translatedSummary || data.summary}
                                </p>
                            )}
                            {detailDescription && (
                                <button type="button" onClick={openFullDescription} className="mt-4 inline-flex items-center gap-1 text-xs font-black text-blue-600 dark:text-blue-300">
                                    {getFullDescriptionLabel(locale)}
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                </button>
                            )}
                        </div>
                    )}

                    <div className="mm-detail-decision-card mb-6 rounded-2xl border border-blue-100/80 bg-white/75 p-4 shadow-sm dark:border-blue-900/40 dark:bg-neutral-900/70">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="mm-detail-card-title text-[13px] font-semibold tracking-[0.08em] text-blue-600 dark:text-blue-400">
                                {decisionLabels.title}
                            </p>
                            <span className="mm-detail-status-wrap" ref={openStatusTipRef}>
                                <button
                                    type="button"
                                    className={`mm-open-status mm-open-status--${displayedOpenStatus.kind}`}
                                    onClick={() => setOpenStatusTipOpen((prev) => !prev)}
                                    aria-expanded={openStatusTipOpen}
                                    aria-label={`${decisionLabels.hours}: ${displayedOpenStatus.detailLabel}`}
                                >
                                    {openStatusLabel}
                                </button>
                                {openStatusTipOpen && (
                                    <span className="mm-detail-status-popover" role="status">
                                        <strong>{decisionLabels.hours}</strong>
                                        <em>{displayedOpenStatus.detailLabel}</em>
                                        <small>{visitInfoDisclaimer}</small>
                                    </span>
                                )}
                            </span>
                        </div>
                        <div className="mm-before-visit-list mb-4">
                            <button
                                type="button"
                                onClick={() => openVisitInfoSheet('admission')}
                                className="mm-detail-fact mm-detail-fact--list-row text-left transition-all active:scale-[0.99]"
                            >
                                <span className="mm-detail-fact-label">{admissionTitle}</span>
                                <strong className="mm-detail-fact-value">
                                    {admissionDisplay}
                                </strong>
                            </button>
                            <button
                                type="button"
                                onClick={() => openVisitInfoSheet('hours')}
                                className="mm-detail-fact mm-detail-fact--list-row text-left transition-all active:scale-[0.99]"
                            >
                                <span className="mm-detail-fact-label mm-detail-fact-label--stack">
                                    <span>{decisionLabels.hours}</span>
                                    <em>{todayBasisLabel}</em>
                                </span>
                                <span className="mm-detail-fact-value-group">
                                    <strong className="mm-detail-fact-value">{hoursDisplay}</strong>
                                    {closedDaysLabel && (
                                        <em>{closedDaysLabel} {timeLabels.closed}</em>
                                    )}
                                </span>
                            </button>
                        </div>
                        <div className={`grid gap-2 ${data.website ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            <button
                                type="button"
                                onClick={openDirectionsSheet}
                                className="mm-detail-action-button mm-detail-action-button--primary flex min-w-0 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-4 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 transition-all active:scale-95 hover:bg-blue-700"
                            >
                                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 13.5 21 3m0 0-6.75 18-3.75-7.5L3 9.75 21 3Z" />
                                </svg>
                                <span className="truncate">{decisionLabels.directions}</span>
                            </button>
                            {data.website && (
                                <a
                                    href={data.website}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={() => { gtag.event('open_website', { category: 'museum', label: data.name, value: 1 }); }}
                                    className="mm-detail-action-button mm-detail-action-button--secondary flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-4 text-sm font-semibold text-gray-500 shadow-sm transition-all hover:bg-gray-100 active:scale-95 dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-400 dark:hover:bg-neutral-800"
                                >
                                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m-7.843 4.582A11.953 11.953 0 0012 10.5c2.998 0 5.74-1.1 7.843-2.918M3.284 14.253A17.919 17.919 0 0012 16.5c3.162 0 6.133-.815 8.716-2.247" />
                                    </svg>
                                    <span className="truncate">{getWebsiteLabels(locale).cta}</span>
                                </a>
                            )}
                        </div>
                        {(onMoveToLocation || (data?.latitude && data?.longitude)) && (
                            <button
                                type="button"
                                onClick={onMoveToLocation || (() => {
                                    const lat = Number(data?.latitude);
                                    const lng = Number(data?.longitude);
                                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                                    window.location.assign(`/?flyTo=${lat},${lng}&flyToId=${encodeURIComponent(String(museumId))}`);
                                })}
                                className="mm-detail-action-button mm-detail-action-button--secondary mt-2 flex w-full min-w-0 items-center justify-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-4 text-sm font-semibold text-blue-600 shadow-sm transition-all hover:bg-blue-50 active:scale-95 dark:border-blue-500/20 dark:bg-blue-950/35 dark:text-blue-200 dark:hover:bg-blue-950/50"
                            >
                                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11Z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5h.01" />
                                </svg>
                                <span className="truncate">{moveToLocationLabel}</span>
                            </button>
                        )}
                        {showTripVisitAction && (
                            <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 dark:border-emerald-500/15 dark:bg-emerald-950/20">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">{detailTripVisitLabels.title}</p>
                                        <p className="mt-0.5 truncate text-xs font-semibold text-emerald-900/75 dark:text-emerald-100/75">{activeTrip?.title}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleToggleTripVisit}
                                        disabled={tripVisitSaving || activeTrip?.pending}
                                        className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${activeTripStopVisited ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20' : 'bg-white text-emerald-700 shadow-sm dark:bg-emerald-950/50 dark:text-emerald-200'}`}
                                        aria-pressed={activeTripStopVisited}
                                    >
                                        {activeTrip?.pending ? detailTripVisitLabels.pending : activeTripStopVisited ? detailTripVisitLabels.unmark : detailTripVisitLabels.mark}
                                    </button>
                                </div>
                            </div>
                        )}
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
                    <div className="hidden">
                        {/* Visitor Info Items */}
                        {false && data.visitorInfo && Array.isArray(data.visitorInfo) && data.visitorInfo.map((item: any, i: number) => {
                            const displayLabel = translateViLabel(item.label, locale);
                            const isLocation = item.label === '위치';
                            const isAccess = item.label === '교통' || item.label === '가는 길';
                            const isHours = item.icon === '🕐' || item.icon === 'clock' || item.label?.includes('영업') || item.label?.includes('시간');
                            if (isLocation || isHours || isAccess) return null;
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
                                </div>
                            );
                        })}
                    </div>

                    {/* Featured Artworks */}
                    {featuredArtworks.length > 0 && (
                        <div className="mm-detail-section mm-detail-content-section mt-7 pt-5 border-t border-gray-100 dark:border-neutral-800">
                            <div className="mm-detail-section-head mb-1.5 flex items-center justify-between gap-3">
                                <h3 className="mm-section-title mb-0">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--mm-brand-bg)', color: 'var(--mm-brand)' }}>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                                        </svg>
                                    </span>
                                    <span>{getFeaturedWorksTitle(locale)}</span>
                                </h3>
                                <div className="flex shrink-0 items-center gap-2">
                                    {hasMoreFeaturedArtworks && (
                                        <button
                                            type="button"
                                            onClick={openMuseumArtworkList}
                                            className="mm-detail-view-all-button"
                                        >
                                            <span>{getViewAllLabel(locale)}</span>
                                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                            </svg>
                                        </button>
                                    )}
                                    <span className="mm-chip mm-chip--muted px-2.5 py-1 text-[10px] leading-none">
                                        {totalArtworkCount}
                                    </span>
                                </div>
                            </div>
                            <div key={shuffleKey} className={`mm-featured-art-rail scrollbar-hide ${featuredArtworks.length === 1 ? 'is-single' : ''}`}>
                                {featuredArtworks.map((work: any, i: number) => (
                                    <div key={work.id || i} style={{ animation: `fadeInUp 0.4s ${i * 60}ms both` }}>
                                        <ArtworkCard work={work} locale={locale} cachedTranslations={cachedMuseum} index={i} fullWidth={featuredArtworks.length === 1} onClick={() => openArtworkDetail(work.id)} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Related Stories */}
                    {relatedStories.length > 0 && (
                        <div className="mm-detail-section mm-detail-content-section mt-7 pt-5 border-t border-gray-100 dark:border-neutral-800">
                            <div className="mm-detail-section-head mb-1.5 flex items-center justify-between gap-3">
                                <h3 className="mm-section-title mb-0">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--mm-brand-bg)', color: 'var(--mm-brand)' }}>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                        </svg>
                                    </span>
                                    <span>{locale === 'ko' ? '관련 스토리' : locale === 'ja' ? '関連ストーリー' : locale === 'zh-CN' ? '相关故事' : locale === 'zh-TW' ? '相關故事' : locale === 'de' ? 'Verwandte Geschichten' : locale === 'fr' ? 'Histoires liées' : locale === 'es' ? 'Historias relacionadas' : locale === 'pt' ? 'Histórias relacionadas' : locale === 'da' ? 'Relaterede historier' : locale === 'fi' ? 'Liittyvät tarinat' : locale === 'sv' ? 'Relaterade berättelser' : locale === 'et' ? 'Seotud lood' : 'Related stories'}</span>
                                </h3>
                                <span className="mm-chip mm-chip--muted px-2.5 py-1 text-[10px] leading-none">
                                    {relatedStories.length}
                                </span>
                            </div>
                            <div className={`mm-detail-story-rail flex gap-3.5 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide -mx-2 px-2 ${relatedStories.length === 1 ? 'is-single' : ''}`}>
                                {relatedStories.map((story: any) => {
                                    const storyTitle = getDisplayStoryTitle(locale === 'ko' ? story.title : (story.titleTranslations?.[locale] || story.titleEn || story.title), [data]);
                                    const storyHref = `/blog/${story.id}?fromMuseum=${encodeURIComponent(museumId)}`;
                                    return (
                                    <a
                                        href={storyHref}
                                        key={story.id}
                                        onPointerDown={() => {
                                            try {
                                                sessionStorage.setItem('navigating-forward', String(Date.now()));
                                            } catch { }
                                        }}
                                        className="mm-card mm-detail-story-card w-[260px] sm:w-[300px] flex-shrink-0 snap-start p-0 text-left group cursor-pointer appearance-none"
                                        aria-label={storyTitle}
                                    >
                                        <div className="mm-detail-story-image relative aspect-[16/9] overflow-hidden bg-gray-100 dark:bg-neutral-800">
                                            {story.previewImage ? (
                                                <img
                                                    src={story.previewImage}
                                                    alt={story.title}
                                                    className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                                                    onError={(e) => { e.currentTarget.src = '/logo.svg'; e.currentTarget.className = 'mm-empty-logo m-auto object-contain dark:invert'; }}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <img src="/logo.svg" alt="" className="mm-empty-logo dark:invert" />
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
                                            <h4 className="mm-detail-story-title mt-1.5 text-sm font-extrabold leading-snug line-clamp-2" style={{ color: 'var(--mm-text-primary)' }}>
                                                {storyTitle}
                                            </h4>
                                        </div>
                                    </a>
                                    );
                                })}
                            </div>
                        </div>
                    )}


                    {/* Report Info Update Button */}
                    <button
                        onClick={() => setReportOpen(true)}
                        className="mm-detail-report-button mt-8 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 text-gray-400 dark:text-gray-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/10 dark:hover:border-blue-800 text-xs font-bold transition-all active:scale-95"
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
                    <p className="hidden">
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

            {portalReady && visitInfoSheet && createPortal(
                <div className={`mm-hours-sheet-backdrop fixed inset-0 z-[10020] flex items-end justify-center bg-black/35 backdrop-blur-md ${visitInfoSheetClosing ? 'is-closing' : ''}`} onClick={closeVisitInfoSheet}>
                    <div className={`mm-hours-sheet w-full max-w-xl rounded-t-[28px] bg-white p-5 shadow-2xl dark:bg-slate-950 ${visitInfoSheetClosing ? 'is-closing' : ''}`} onClick={(e) => e.stopPropagation()}>
                        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-800" />
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                                {visitInfoSheet === 'hours' ? decisionLabels.hours : admissionTitle}
                            </h3>
                            <button type="button" onClick={closeVisitInfoSheet} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        {visitInfoSheet === 'hours' && openingTemplate ? (
                            <div className="mm-hours-sheet-list">
                                {openingTemplate.days.map(day => (
                                    <div key={day.index} className={`mm-hours-sheet-row ${day.open ? 'is-open' : 'is-closed'}`}>
                                        <span>{getWeekdayLabel(day.index, locale)}</span>
                                        <strong>{day.open ? formatOpeningRange(day.start, day.end) : timeLabels.closed}</strong>
                                    </div>
                                ))}
                            </div>
                        ) : visitInfoSheet === 'hours' ? (
                            <p className="text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                                {quickHoursItem?.value ? translateViValue(quickHoursItem.value, locale) : '-'}
                            </p>
                        ) : (
                            <div className="mm-hours-sheet-list">
                                <div className="mm-hours-sheet-row is-open">
                                    <span>{admissionTitle}</span>
                                    <strong>{admissionDisplay}</strong>
                                </div>
                            </div>
                        )}
                        {visitInfoSheet === 'hours' && (
                            <p className="mm-hours-sheet-note">
                                {visitInfoDisclaimer}
                            </p>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {portalReady && directionsSheetOpen && createPortal(
                <div className={`mm-hours-sheet-backdrop fixed inset-0 z-[10020] flex items-end justify-center bg-black/35 backdrop-blur-md ${directionsSheetClosing ? 'is-closing' : ''}`} onClick={closeDirectionsSheet}>
                    <div className={`mm-hours-sheet mm-directions-sheet w-full max-w-xl rounded-t-[28px] bg-white p-5 shadow-2xl dark:bg-slate-950 ${directionsSheetClosing ? 'is-closing' : ''}`} onClick={(e) => e.stopPropagation()}>
                        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-800" />
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="text-base font-semibold text-slate-900 dark:text-white">{directionsSheetLabels.title}</h3>
                                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{directionsSheetLabels.desc}</p>
                            </div>
                            <button type="button" onClick={closeDirectionsSheet} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="mm-directions-sheet-options">
                            {directionOptions.map(option => (
                                <a
                                    key={option.key}
                                    href={option.href}
                                    target={option.href.startsWith('http') ? '_blank' : undefined}
                                    rel={option.href.startsWith('http') ? 'noreferrer' : undefined}
                                    className="mm-directions-option"
                                    onClick={() => {
                                        gtag.event('get_directions', { category: 'navigation', label: option.analyticsLabel, value: 1 });
                                        closeDirectionsSheet();
                                    }}
                                >
                                    <span className={`mm-directions-option-icon mm-directions-option-icon--${option.key}`}>
                                        {option.key === 'apple' ? (
                                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                                <path d="M7 4.8 12 3l5 1.8 4-1.45v15.85l-4 1.45-5-1.8-5 1.8-4-1.45V4.15l4 1.65Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                                                <path d="M7 5v15M12 3.2v15.6M17 4.9v15.1" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
                                            </svg>
                                        ) : option.key === 'google' ? (
                                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                                <path d="M12 21s7-5.38 7-12A7 7 0 0 0 5 9c0 6.62 7 12 7 12Z" stroke="currentColor" strokeWidth="1.8" />
                                                <path d="M12 12.2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.8" />
                                            </svg>
                                        ) : option.key === 'kakao' ? (
                                            <svg className="mm-directions-brand-logo" viewBox="0 0 28 28" aria-hidden="true">
                                                <rect x="2.2" y="2.2" width="23.6" height="23.6" rx="7.2" fill="#FFE500" />
                                                <path d="M14 5.9c-4.27 0-7.72 3.39-7.72 7.58 0 5.53 7.72 11.3 7.72 11.3s7.72-5.77 7.72-11.3C21.72 9.29 18.27 5.9 14 5.9Z" fill="#1D9BF0" />
                                                <path d="M14 8.35c-2.9 0-5.25 2.3-5.25 5.15 0 3.33 3.35 7.13 5.25 8.95 1.9-1.82 5.25-5.62 5.25-8.95 0-2.85-2.35-5.15-5.25-5.15Z" fill="#28A8F5" />
                                                <circle cx="14" cy="13.45" r="2.55" fill="#FFE500" />
                                            </svg>
                                        ) : option.key === 'naver' ? (
                                            <svg className="mm-directions-brand-logo" viewBox="0 0 28 28" aria-hidden="true">
                                                <defs>
                                                    <linearGradient id="naverMapPinGradient" x1="14" x2="14" y1="2.4" y2="26.2" gradientUnits="userSpaceOnUse">
                                                        <stop stopColor="#168CFF" />
                                                        <stop offset="1" stopColor="#03C75A" />
                                                    </linearGradient>
                                                </defs>
                                                <path d="M14 2.65c5.7 0 10.32 4.46 10.32 9.95 0 7.08-10.32 12.75-10.32 12.75S3.68 19.68 3.68 12.6C3.68 7.11 8.3 2.65 14 2.65Z" fill="url(#naverMapPinGradient)" />
                                                <path d="M9.8 8.9h3.08l3.64 5.16V8.9h3.08v10.22h-3.08l-3.64-5.14v5.14H9.8V8.9Z" fill="white" />
                                            </svg>
                                        ) : null}
                                    </span>
                                    <span>{option.label}</span>
                                    <svg className="h-4 w-4 text-slate-300 dark:text-blue-200/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </a>
                            ))}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {portalReady && fullDescriptionOpen && createPortal(
                <div className={`mm-full-description-backdrop fixed inset-0 z-[10020] flex items-end justify-center bg-black/35 backdrop-blur-md ${fullDescriptionClosing ? 'is-closing' : ''}`} onClick={closeFullDescription}>
                    <div className={`mm-full-description-sheet w-full max-w-xl rounded-t-[28px] bg-white p-5 shadow-2xl dark:bg-slate-950 ${fullDescriptionClosing ? 'is-closing' : ''}`} onClick={(e) => e.stopPropagation()}>
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{getFullDescriptionLabel(locale)}</h3>
                            <button type="button" onClick={closeFullDescription} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <p className="mm-full-description-text max-h-[58vh] overflow-y-auto text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                            {detailDescription}
                        </p>
                    </div>
                </div>,
                document.body
            )}


            {/* Mobile bottom spacer */}
            <div className="mm-museum-mobile-bottom-spacer h-16 lg:h-10" />


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
                            <img src={selectedArtwork.image || '/logo.svg'} alt={selectedArtwork.title} className={`${selectedArtwork.image ? 'w-full h-full object-cover' : 'mm-empty-logo m-auto object-contain dark:invert'}`} onError={(e) => { e.currentTarget.src = '/logo.svg'; e.currentTarget.className = 'mm-empty-logo m-auto object-contain dark:invert'; }} />
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
            {portalReady && createPortal(
                <div className="lg:hidden fixed bottom-8 right-8 z-[9998] flex flex-col gap-2">
                    {/* My Pick button (top) */}
                    <button
                        onClick={handleTogglePick}
                        className={`w-14 h-14 flex items-center justify-center rounded-full shadow-lg transition-all duration-300 ${showBurst ? 'animate-bookmark-bounce' : showShrink ? 'animate-bookmark-shrink' : 'active:scale-90'} ${isPicked
                            ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-blue-500/30'
                            : 'bg-white/90 dark:bg-slate-950/90 backdrop-blur-md text-blue-600 dark:text-blue-200 hover:bg-white dark:hover:bg-slate-900 ring-1 ring-blue-200 dark:ring-blue-400/20 shadow-black/20'
                            }`}
                        aria-label={locale === 'ko' ? '내 픽' : 'My Pick'}
                    >
                        <svg className="w-5 h-5" fill={isPicked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v18l7-5 7 5V3H5z" />
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
            {portalReady && showSaveToast && createPortal(
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
            {portalReady && showCompareToast && createPortal(
                <div className={`fixed bottom-24 left-1/2 z-[9999] ${compareToastExiting ? 'animate-save-toast-out' : 'animate-save-toast-in'}`}>
                    <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white pl-5 pr-2 py-2 rounded-2xl shadow-2xl shadow-blue-600/20 flex items-center gap-3 font-bold text-sm whitespace-nowrap">
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
                                    navigateDocument('/compare');
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

            {/* Address copy toast */}
            {portalReady && copyToast && createPortal(
                <div className={`fixed bottom-24 left-1/2 z-[9999] ${copyToastExiting ? 'animate-save-toast-out' : 'animate-save-toast-in'}`}>
                    <div className="bg-gradient-to-r from-blue-700 to-blue-500 text-white px-5 py-2.5 rounded-full shadow-2xl shadow-blue-600/20 flex items-center gap-2 font-bold text-sm whitespace-nowrap">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {getCopyToast(locale)}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
