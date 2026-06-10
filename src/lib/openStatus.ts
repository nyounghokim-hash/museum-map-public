import { findVisitorHoursItem, openingHoursToDisplaySource } from '@/lib/openingHoursTemplate';
import tzLookup from 'tz-lookup';

export type MuseumOpenStatusKind = 'open' | 'ended' | 'todayClosed' | 'closed' | 'unknown';

export type MuseumOpenStatus = {
    kind: MuseumOpenStatusKind;
    label: string;
    detailLabel: string;
    remainingMinutes?: number;
    remainingKind?: 'untilClose' | 'untilOpen';
};

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
    AU: 'Australia/Sydney', AUS: 'Australia/Sydney', Australia: 'Australia/Sydney', 호주: 'Australia/Sydney',
    NZ: 'Pacific/Auckland', NewZealand: 'Pacific/Auckland', 'New Zealand': 'Pacific/Auckland',
    CA: 'America/Toronto', Canada: 'America/Toronto',
    MX: 'America/Mexico_City', Mexico: 'America/Mexico_City',
    BR: 'America/Sao_Paulo', Brazil: 'America/Sao_Paulo',
    AR: 'America/Argentina/Buenos_Aires', Argentina: 'America/Argentina/Buenos_Aires',
    CL: 'America/Santiago', Chile: 'America/Santiago',
    CO: 'America/Bogota', Colombia: 'America/Bogota',
    NL: 'Europe/Amsterdam', Netherlands: 'Europe/Amsterdam',
    BE: 'Europe/Brussels', Belgium: 'Europe/Brussels',
    BY: 'Europe/Minsk', Belarus: 'Europe/Minsk',
    CH: 'Europe/Zurich', Switzerland: 'Europe/Zurich',
    IT: 'Europe/Rome', Italy: 'Europe/Rome',
    AT: 'Europe/Vienna', Austria: 'Europe/Vienna',
    LT: 'Europe/Vilnius', Lithuania: 'Europe/Vilnius',
    TR: 'Europe/Istanbul', Turkey: 'Europe/Istanbul',
    LB: 'Asia/Beirut', Lebanon: 'Asia/Beirut',
    QA: 'Asia/Qatar', Qatar: 'Asia/Qatar',
    AE: 'Asia/Dubai', UAE: 'Asia/Dubai',
    ZA: 'Africa/Johannesburg', 'South Africa': 'Africa/Johannesburg',
    MA: 'Africa/Casablanca', Morocco: 'Africa/Casablanca',
    HK: 'Asia/Hong_Kong', HongKong: 'Asia/Hong_Kong', 'Hong Kong': 'Asia/Hong_Kong',
    SG: 'Asia/Singapore', Singapore: 'Asia/Singapore',
    IN: 'Asia/Kolkata', India: 'Asia/Kolkata',
    TH: 'Asia/Bangkok', Thailand: 'Asia/Bangkok',
    ID: 'Asia/Jakarta', Indonesia: 'Asia/Jakarta',
    VN: 'Asia/Ho_Chi_Minh', Vietnam: 'Asia/Ho_Chi_Minh',
};

const WEEKDAY_KEYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAY_KO_FULL = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const CLOCK_TOKEN_PATTERN = String.raw`(?:AM|PM|오전|오후)?\s*\d{1,2}(?:(?::\d{2})|(?:\s*시\s*(?:\d{1,2}\s*분?)?))?\s*(?:AM|PM|오전|오후)?`;
const CLOCK_RANGE_PATTERN = new RegExp(`(${CLOCK_TOKEN_PATTERN})\\s*[-~–]\\s*(${CLOCK_TOKEN_PATTERN})`, 'i');
const CLOCK_RANGE_PATTERN_GLOBAL = new RegExp(`(${CLOCK_TOKEN_PATTERN})\\s*[-~–]\\s*(${CLOCK_TOKEN_PATTERN})`, 'gi');

const STATUS_LABELS: Record<MuseumOpenStatusKind, Record<string, string>> = {
    open: {
        ko: '오늘 운영중', en: 'Open today', ja: '本日開館中', de: 'Heute geöffnet', fr: 'Ouvert aujourd’hui', es: 'Abierto hoy', pt: 'Aberto hoje',
        'zh-CN': '今日开放', 'zh-TW': '今日開放', da: 'Åben i dag', fi: 'Auki tänään', sv: 'Öppet idag', et: 'Täna avatud',
    },
    ended: {
        ko: '오늘 운영 종료', en: 'Closed for today', ja: '本日の営業終了', de: 'Heute geschlossen', fr: 'Fermé pour aujourd’hui', es: 'Cerrado por hoy', pt: 'Fechado por hoje',
        'zh-CN': '今日已闭馆', 'zh-TW': '今日已休館', da: 'Lukket for i dag', fi: 'Suljettu tältä päivältä', sv: 'Stängt för idag', et: 'Tänaseks suletud',
    },
    todayClosed: {
        ko: '오늘 휴관', en: 'Closed today', ja: '本日休館', de: 'Heute geschlossen', fr: 'Fermé aujourd’hui',
        es: 'Cerrado hoy', pt: 'Fechado hoje', 'zh-CN': '今日闭馆', 'zh-TW': '今日休館', da: 'Lukket i dag',
        fi: 'Suljettu tänään', sv: 'Stängt idag', et: 'Täna suletud',
    },
    closed: {
        ko: '장기 휴관', en: 'Long-term closure', ja: '長期休館', de: 'Langfristig geschlossen',
        fr: 'Fermeture longue durée', es: 'Cierre prolongado', pt: 'Fechamento prolongado',
        'zh-CN': '长期闭馆', 'zh-TW': '長期休館', da: 'Langvarigt lukket', fi: 'Pitkäaikaisesti suljettu',
        sv: 'Långvarigt stängt', et: 'Pikaajaliselt suletud',
    },
    unknown: {
        ko: '확인 필요', en: 'Check hours', ja: '要確認', de: 'Prüfen', fr: 'À vérifier', es: 'Verificar',
        pt: 'Verificar', 'zh-CN': '需确认', 'zh-TW': '需確認', da: 'Tjek', fi: 'Tarkista', sv: 'Kontrollera',
        et: 'Kontrolli',
    },
};

function labelFor(kind: MuseumOpenStatusKind, locale: string) {
    return STATUS_LABELS[kind]?.[locale] || STATUS_LABELS[kind]?.en || STATUS_LABELS.unknown.en;
}

function pluralUnit(value: number, singular: string, plural: string) {
    return `${value} ${value === 1 ? singular : plural}`;
}

function formatDuration(minutes: number, locale: string) {
    const safeMinutes = Math.max(0, Math.round(minutes));
    const hours = Math.floor(safeMinutes / 60);
    const mins = safeMinutes % 60;
    if (locale === 'ko') {
        if (hours > 0 && mins > 0) return `${hours}시간 ${mins}분`;
        if (hours > 0) return `${hours}시간`;
        return `${mins}분`;
    }
    if (locale === 'ja') {
        if (hours > 0 && mins > 0) return `${hours}時間${mins}分`;
        if (hours > 0) return `${hours}時間`;
        return `${mins}分`;
    }
    if (locale === 'zh-CN' || locale === 'zh-TW') {
        if (hours > 0 && mins > 0) return `${hours}小时${mins}分钟`;
        if (hours > 0) return `${hours}小时`;
        return `${mins}分钟`;
    }
    const parts = [];
    if (hours > 0) parts.push(pluralUnit(hours, 'hour', 'hours'));
    if (mins > 0 || parts.length === 0) parts.push(pluralUnit(mins, 'minute', 'minutes'));
    return parts.join(' ');
}

function detailFor(kind: MuseumOpenStatusKind, locale: string, remainingMinutes?: number, remainingKind?: 'untilClose' | 'untilOpen') {
    if (typeof remainingMinutes === 'number' && remainingKind === 'untilClose') {
        const duration = formatDuration(remainingMinutes, locale);
        return ({
            ko: `운영 종료까지 ${duration} 남았어요.`,
            en: `${duration} left until closing.`,
            ja: `閉館まで${duration}です。`,
            de: `Noch ${duration} bis zur Schließung.`,
            fr: `Il reste ${duration} avant la fermeture.`,
            es: `Quedan ${duration} para el cierre.`,
            pt: `Restam ${duration} até fechar.`,
            'zh-CN': `距离闭馆还有${duration}。`,
            'zh-TW': `距離休館還有${duration}。`,
            da: `${duration} til lukning.`,
            fi: `${duration} sulkemiseen.`,
            sv: `${duration} kvar till stängning.`,
            et: `Sulgemiseni on ${duration}.`,
        } as Record<string, string>)[locale] || `${duration} left until closing.`;
    }
    if (typeof remainingMinutes === 'number' && remainingKind === 'untilOpen') {
        const duration = formatDuration(remainingMinutes, locale);
        return ({
            ko: `운영 시작까지 ${duration} 남았어요.`,
            en: `${duration} until opening.`,
            ja: `開館まで${duration}です。`,
            de: `Noch ${duration} bis zur Öffnung.`,
            fr: `Ouverture dans ${duration}.`,
            es: `Abre en ${duration}.`,
            pt: `Abre em ${duration}.`,
            'zh-CN': `距离开放还有${duration}。`,
            'zh-TW': `距離開放還有${duration}。`,
            da: `${duration} til åbning.`,
            fi: `${duration} avaamiseen.`,
            sv: `${duration} till öppning.`,
            et: `Avamiseni on ${duration}.`,
        } as Record<string, string>)[locale] || `${duration} until opening.`;
    }
    return ({
        open: { ko: '현재 운영 중이에요.', en: 'Open right now.', ja: '現在営業中です。' },
        ended: { ko: '오늘 운영이 종료됐어요.', en: 'Closed for today.', ja: '本日の営業は終了しました。' },
        todayClosed: { ko: '오늘은 휴관일이에요.', en: 'Closed today.', ja: '本日は休館です。' },
        closed: { ko: '장기 휴관으로 확인돼요.', en: 'Marked as a long-term closure.', ja: '長期休館として表示されています。' },
        unknown: { ko: '운영 시간을 확인해야 해요.', en: 'Hours need to be checked.', ja: '営業時間の確認が必要です。' },
    } as Record<MuseumOpenStatusKind, Record<string, string>>)[kind]?.[locale]
        || ({
            open: 'Open right now.',
            ended: 'Closed for today.',
            todayClosed: 'Closed today.',
            closed: 'Marked as a long-term closure.',
            unknown: 'Hours need to be checked.',
        } as Record<MuseumOpenStatusKind, string>)[kind];
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

function isValidCoordinate(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value);
}

function resolveMuseumTimeZone(country: string | undefined, latitude?: unknown, longitude?: unknown) {
    if (isValidCoordinate(latitude) && isValidCoordinate(longitude)) {
        try {
            return tzLookup(latitude as number, longitude as number);
        } catch {
            // Fall back to country-level mapping when a coordinate is outside the
            // lookup polygon or the bundled timezone data cannot resolve it.
        }
    }
    return COUNTRY_TIMEZONES[country || ''] || 'UTC';
}

function parseLocalParts(timeZone: string, now: Date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(now);
    const weekday = parts.find(p => p.type === 'weekday')?.value || 'Monday';
    const hour = Number(parts.find(p => p.type === 'hour')?.value || 0);
    const minute = Number(parts.find(p => p.type === 'minute')?.value || 0);
    return { weekday, minutes: hour * 60 + minute };
}

function parseClockMinutes(raw: string) {
    const source = raw.trim();
    const meridiem = /PM|오후/i.test(source) ? 'pm' : /AM|오전/i.test(source) ? 'am' : null;
    const match = source.match(/(\d{1,2})(?::(\d{2})|(?:\s*시\s*(\d{1,2})?\s*분?)?)?/);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] || match[3] || 0);
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    return hour * 60 + minute;
}

function inferStartClockMeridiem(startRaw: string, endRaw: string) {
    if (/PM|AM|오후|오전/i.test(startRaw) || !/PM|AM|오후|오전/i.test(endRaw)) return startRaw;
    const startHour = Number(startRaw.match(/(\d{1,2})/)?.[1] || NaN);
    const endHour = Number(endRaw.match(/(\d{1,2})/)?.[1] || NaN);
    if (Number.isNaN(startHour) || Number.isNaN(endHour)) return startRaw;
    if (/PM|오후/i.test(endRaw)) return `${startRaw} ${startHour === 12 || startHour <= endHour ? 'PM' : 'AM'}`;
    return `${startRaw} AM`;
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
    const dayNames = [dayName, koFull, koShort];
    const parts = hoursValue
        .replace(/\r?\n/g, ' / ')
        .split(/\s*(?:\/|,|;|。|\.)(?=\s*(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|[일월화수목금토]|월요일|화요일|수요일|목요일|금요일|토요일|일요일))/i)
        .map(part => part.trim())
        .filter(Boolean);

    const explicit = parts.find(part => {
        const normalizedPart = part.replace(/\s+/g, ' ');
        return dayNames.some(day => new RegExp(`(^|\\b|\\s)${day}(요일)?\\s*[:：]?`, 'i').test(normalizedPart))
            || koDayPartIncludesToday(normalizedPart, dayIndex);
    });
    if (explicit) return explicit;

    const compactClosed = new RegExp(`(^|[\\s,·/~-])${koShort}(요일)?\\s*(정기\\s*)?휴관`, 'i');
    if (compactClosed.test(hoursValue)) return `${koFull}: 휴관`;
    const closedClauses = hoursValue.match(/[일월화수목금토](?:요일)?(?:\s*[·,\/~-]\s*[일월화수목금토](?:요일)?)*\s*(?:정기\s*)?휴관/g) || [];
    if (closedClauses.some(clause => new RegExp(`${koShort}(요일)?`).test(clause))) return `${koFull}: 휴관`;

    return hoursValue;
}

export function resolveOpenStatusFromHours(hoursValue: string | undefined, country: string | undefined, locale: string, location?: { latitude?: unknown; longitude?: unknown }, now: Date = new Date()): MuseumOpenStatus {
    if (!hoursValue) {
        return { kind: 'unknown', label: labelFor('unknown', locale), detailLabel: detailFor('unknown', locale) };
    }
    const timeZone = resolveMuseumTimeZone(country, location?.latitude, location?.longitude);
    const local = parseLocalParts(timeZone, now);
    const dayIndex = WEEKDAY_KEYS.indexOf(local.weekday as any);
    const koDay = WEEKDAY_KO[dayIndex < 0 ? 1 : dayIndex];
    const dayName = local.weekday;
    const todaySegment = getTodayHoursSegment(hoursValue, dayName, dayIndex);
    const normalized = todaySegment.replace(/\s+/g, ' ');
    const hasExplicitTodaySegment = todaySegment !== hoursValue
        || new RegExp(`(^|\\b|\\s)(${dayName}|${koDay}(요일)?)\\s*[:：]?`, 'i').test(normalized)
        || koDayPartIncludesToday(normalized, dayIndex);
    const closedRegex = new RegExp(`(${dayName}|${koDay}(요일)?)\\s*[:：]?\\s*(Closed|휴관|정기\\s*휴관|closed)`, 'i');
    const genericClosedOnly = /^(closed|휴관|정기\s*휴관|休館|闭馆)$/i.test(normalized);
    const todayClosedClauses = normalized.match(/[일월화수목금토](?:요일)?(?:\s*[·,\/~-]\s*[일월화수목금토](?:요일)?)*\s*(?:정기\s*)?휴관/g) || [];
    const todayClosedByClause = todayClosedClauses.some(clause => koDayPartIncludesToday(clause, dayIndex));
    const hasClockRange = CLOCK_RANGE_PATTERN.test(normalized);
    if (closedRegex.test(normalized)
        || todayClosedByClause
        || (hasExplicitTodaySegment && !hasClockRange && /closed|휴관|休館|闭馆/i.test(normalized))
        || genericClosedOnly) {
        const kind: MuseumOpenStatusKind = hasExplicitTodaySegment || todayClosedByClause || closedRegex.test(normalized)
            ? 'todayClosed'
            : 'closed';
        return { kind, label: labelFor(kind, locale), detailLabel: detailFor(kind, locale) };
    }
    if (/open\s*24\s*hours|24\s*시간|24시간/i.test(normalized)) {
        return { kind: 'open', label: labelFor('open', locale), detailLabel: detailFor('open', locale) };
    }
    const ranges = Array.from(normalized.matchAll(CLOCK_RANGE_PATTERN_GLOBAL));
    if (ranges.length === 0) {
        return { kind: 'unknown', label: labelFor('unknown', locale), detailLabel: detailFor('unknown', locale) };
    }
    const normalizedRanges = ranges
        .map(match => {
            const start = parseClockMinutes(inferStartClockMeridiem(match[1], match[2]));
            let end = parseClockMinutes(match[2]);
            if (start == null || end == null) return null;
            if (end < start) end += 24 * 60;
            const current = end >= 24 * 60 && local.minutes < start ? local.minutes + 24 * 60 : local.minutes;
            return { start, end, current };
        })
        .filter((range): range is { start: number; end: number; current: number } => Boolean(range));
    const openRange = normalizedRanges.find(range => range.current >= range.start && range.current <= range.end);
    if (openRange) {
        const remainingMinutes = Math.max(0, openRange.end - openRange.current);
        return {
            kind: 'open',
            label: labelFor('open', locale),
            detailLabel: detailFor('open', locale, remainingMinutes, 'untilClose'),
            remainingMinutes,
            remainingKind: 'untilClose',
        };
    }
    const nextRange = normalizedRanges
        .filter(range => range.current < range.start)
        .sort((a, b) => a.start - b.start)[0];
    if (nextRange) {
        const remainingMinutes = Math.max(0, nextRange.start - nextRange.current);
        return {
            kind: 'ended',
            label: labelFor('ended', locale),
            detailLabel: detailFor('ended', locale, remainingMinutes, 'untilOpen'),
            remainingMinutes,
            remainingKind: 'untilOpen',
        };
    }
    const anyOpen = ranges.some(match => {
        const start = parseClockMinutes(inferStartClockMeridiem(match[1], match[2]));
        let end = parseClockMinutes(match[2]);
        if (start == null || end == null) return false;
        if (end < start) end += 24 * 60;
        const current = end >= 24 * 60 && local.minutes < start ? local.minutes + 24 * 60 : local.minutes;
        return current >= start && current <= end;
    });
    const kind: MuseumOpenStatusKind = anyOpen ? 'open' : 'ended';
    return { kind, label: labelFor(kind, locale), detailLabel: detailFor(kind, locale) };
}

export function resolveMuseumOpenStatus(museum: any, locale: string): MuseumOpenStatus {
    const quickHoursItem = findVisitorHoursItem(museum?.visitorInfo)?.item;
    const hoursValue = normalizeOpeningHoursSource(museum?.openingHours) || quickHoursItem?.value;
    return resolveOpenStatusFromHours(hoursValue, museum?.country, locale, {
        latitude: museum?.latitude,
        longitude: museum?.longitude,
    });
}
