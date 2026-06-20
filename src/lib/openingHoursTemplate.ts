export type OpeningDayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type OpeningRange = {
    start: string;
    end: string;
};

export type OpeningDayTemplate = {
    day: OpeningDayKey;
    open: boolean | null;
    ranges: OpeningRange[];
    note?: string;
};

export type OpeningHoursTemplate = {
    schema: 'museum_map_opening_hours_v1';
    source: 'google_places' | 'official' | 'manual' | 'visitor_info' | 'unknown';
    timezone?: string;
    weekly: OpeningDayTemplate[];
    raw?: unknown;
    note?: string;
    fetchedAt?: string;
    normalizedAt: string;
    confidence: 'high' | 'medium' | 'low';
};

const DAY_KEYS: OpeningDayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<OpeningDayKey, string> = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
};
const KO_DAY_INDEX: Record<string, number> = { 월: 0, 화: 1, 수: 2, 목: 3, 금: 4, 토: 5, 일: 6 };
const EN_DAY_INDEX: Record<string, number> = {
    monday: 0, mon: 0,
    tuesday: 1, tue: 1, tues: 1,
    wednesday: 2, wed: 2,
    thursday: 3, thu: 3, thur: 3, thurs: 3,
    friday: 4, fri: 4,
    saturday: 5, sat: 5,
    sunday: 6, sun: 6,
};
const FI_DAY_INDEX: Record<string, number> = {
    maanantai: 0,
    tiistai: 1,
    keskiviikko: 2,
    torstai: 3,
    perjantai: 4,
    lauantai: 5,
    sunnuntai: 6,
};
const DAY_PATTERN = String.raw`(?:maanantai|tiistai|keskiviikko|torstai|perjantai|lauantai|sunnuntai|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun|월요일|화요일|수요일|목요일|금요일|토요일|일요일|매일|연중무휴|[월화수목금토일])`;

function emptyWeekly(): OpeningDayTemplate[] {
    return DAY_KEYS.map(day => ({ day, open: null, ranges: [] }));
}

function cleanText(value: unknown) {
    return String(value || '')
        .replace(/\u202f|\u2009|\u00a0/g, ' ')
        .replace(/[–—]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseClock(raw: string, endHint?: string) {
    let source = cleanText(raw);
    if (!/\b(?:AM|PM)\b|오전|오후/i.test(source) && endHint && /\b(?:AM|PM)\b|오전|오후/i.test(endHint)) {
        const startHour = Number(source.match(/(\d{1,2})/)?.[1] || NaN);
        const endHour = Number(endHint.match(/(\d{1,2})/)?.[1] || NaN);
        if (!Number.isNaN(startHour) && !Number.isNaN(endHour) && /\bPM\b|오후/i.test(endHint)) {
            source = `${source} ${startHour === 12 || startHour <= endHour ? 'PM' : 'AM'}`;
        } else if (!Number.isNaN(startHour) && /\bAM\b|오전/i.test(endHint)) {
            source = `${source} AM`;
        }
    }
    const meridiem = /\bPM\b|오후/i.test(source) ? 'pm' : /\bAM\b|오전/i.test(source) ? 'am' : null;
    const match = source.match(/(\d{1,2})(?:(?:[:.](\d{2})(?::\d{2})?)|(?:\s*시\s*(\d{1,2})?\s*분?)?)?/);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] || match[3] || 0);
    if (hour > 24 || minute > 59) return null;
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    if (hour === 24 && minute === 0) hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function inferEndClockMeridiem(startRaw: string, endRaw: string) {
    if (/\b(?:AM|PM)\b|오전|오후/i.test(endRaw)) return endRaw;
    const start = cleanText(startRaw);
    const end = cleanText(endRaw);
    const startHour = Number(start.match(/(\d{1,2})/)?.[1] || NaN);
    const endHour = Number(end.match(/(\d{1,2})/)?.[1] || NaN);
    if (Number.isNaN(endHour)) return endRaw;
    if (/\bPM\b|오후/i.test(start)) return `${endRaw} PM`;
    if (/\bAM\b|오전/i.test(start)) {
        return `${endRaw} ${!Number.isNaN(startHour) && (endHour < startHour || endHour === 12) ? 'PM' : 'AM'}`;
    }
    return endRaw;
}

function parseRanges(value: string): OpeningRange[] {
    const ranges: OpeningRange[] = [];
    const pattern = /((?:AM|PM|오전|오후)?\s*\d{1,2}(?:(?:[:.]\d{2}(?::\d{2})?)|(?:\s*시\s*(?:\d{1,2}\s*분?)?))?\s*(?:AM|PM|오전|오후)?)\s*[-~]\s*((?:AM|PM|오전|오후)?\s*\d{1,2}(?:(?:[:.]\d{2}(?::\d{2})?)|(?:\s*시\s*(?:\d{1,2}\s*분?)?))?\s*(?:AM|PM|오전|오후)?)/gi;
    for (const match of value.matchAll(pattern)) {
        const afterEnd = value.slice((match.index || 0) + match[0].length, (match.index || 0) + match[0].length + 3);
        if (/^\s*월/.test(afterEnd)) continue;
        const start = parseClock(match[1], match[2]);
        const end = parseClock(inferEndClockMeridiem(match[1], match[2]));
        if (start && end) ranges.push({ start, end });
    }
    return ranges;
}

function expandKoDays(raw: string): number[] {
    const source = cleanText(raw).replace(/요일/g, '').replace(/\s+/g, '');
    if (/^(매일|매주|상시|연중무휴|월[-~]일)$/.test(source)) return [0, 1, 2, 3, 4, 5, 6];
    const range = source.match(/^([월화수목금토일])[-~]([월화수목금토일])$/);
    if (range) return expandIndexRange(KO_DAY_INDEX[range[1]], KO_DAY_INDEX[range[2]]);
    return source
        .split(/[·,\/]/)
        .map(day => KO_DAY_INDEX[day])
        .filter(index => index !== undefined);
}

function expandEnDays(raw: string): number[] {
    const source = cleanText(raw).toLowerCase();
    const range = source.match(/^(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\s*[-~]\s*(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)$/i);
    if (range) return expandIndexRange(EN_DAY_INDEX[range[1].toLowerCase()], EN_DAY_INDEX[range[2].toLowerCase()]);
    const indexes = source
        .split(/[·,\/]/)
        .map(day => EN_DAY_INDEX[day.trim()])
        .filter(index => index !== undefined);
    if (indexes.length) return indexes;
    const single = EN_DAY_INDEX[source];
    return single === undefined ? [] : [single];
}

function expandFiDays(raw: string): number[] {
    const source = cleanText(raw).toLowerCase();
    const range = source.match(/^(maanantai|tiistai|keskiviikko|torstai|perjantai|lauantai|sunnuntai)\s*[-~]\s*(maanantai|tiistai|keskiviikko|torstai|perjantai|lauantai|sunnuntai)$/i);
    if (range) return expandIndexRange(FI_DAY_INDEX[range[1].toLowerCase()], FI_DAY_INDEX[range[2].toLowerCase()]);
    const indexes = source
        .split(/[·,\/]/)
        .map(day => FI_DAY_INDEX[day.trim()])
        .filter(index => index !== undefined);
    if (indexes.length) return indexes;
    const single = FI_DAY_INDEX[source];
    return single === undefined ? [] : [single];
}

function expandIndexRange(start: number, end: number): number[] {
    if (start === undefined || end === undefined) return [];
    const result: number[] = [];
    let cursor = start;
    while (true) {
        result.push(cursor);
        if (cursor === end) break;
        cursor = (cursor + 1) % 7;
        if (result.length > 7) break;
    }
    return result;
}

function parseDayToken(raw: string): number[] {
    const source = cleanText(raw);
    if (/[월화수목금토일]|매일|연중무휴/.test(source)) return expandKoDays(source);
    if (/maanantai|tiistai|keskiviikko|torstai|perjantai|lauantai|sunnuntai/i.test(source)) return expandFiDays(source);
    return expandEnDays(source);
}

function closedIndexesFromRows(rows: string[]): Set<number> {
    const closed = new Set<number>();
    const koDayToken = /((?:(?<![0-9당])[월화수목금토일](?:요일)?)(?:\s*[·,\/~-]\s*(?:(?<![0-9당])[월화수목금토일](?:요일)?))*)\s*(?:정기\s*)?(?:휴관|휴무|휴무일|休館|閉館)/g;
    const enDayToken = /((?:Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:\s*[·,\/~-]\s*(?:Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))*)\s*(?:Closed|closed)/g;
    for (const row of rows) {
        const text = cleanText(row);
        for (const match of text.matchAll(koDayToken)) parseDayToken(match[1]).forEach(index => closed.add(index));
        for (const match of text.matchAll(enDayToken)) parseDayToken(match[1]).forEach(index => closed.add(index));
        const closedPrefix = text.match(/^(?:Closed|closed)\s+(.+)$/);
        if (closedPrefix) parseDayToken(closedPrefix[1]).forEach(index => closed.add(index));
    }
    return closed;
}

function parentheticalEndOverrides(rowValue: string, rowIndexes: number[], ranges: OpeningRange[]): Map<number, OpeningRange> {
    const overrides = new Map<number, OpeningRange>();
    if (!ranges.length) return overrides;
    const baseStart = ranges[0].start;
    const exceptionPattern = /[（(]\s*((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun|월요일|화요일|수요일|목요일|금요일|토요일|일요일|[월화수목금토일])(?:\s*[·,\/~-]\s*(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun|월요일|화요일|수요일|목요일|금요일|토요일|일요일|[월화수목금토일]))*)\s*[-~]\s*((?:AM|PM|오전|오후)?\s*\d{1,2}(?:(?::\d{2}(?::\d{2})?)|(?:\s*시\s*(?:\d{1,2}\s*분?)?))?\s*(?:AM|PM|오전|오후)?)\s*[)）]/gi;
    const rowIndexSet = new Set(rowIndexes);
    for (const match of rowValue.matchAll(exceptionPattern)) {
        const indexes = parseDayToken(match[1]).filter(index => rowIndexSet.has(index));
        const end = parseClock(match[2], ranges[0].end);
        if (!indexes.length || !end) continue;
        indexes.forEach(index => {
            overrides.set(index, { start: baseStart, end });
        });
    }
    return overrides;
}

function splitRows(raw: string): string[] {
    return cleanText(raw)
        .replace(/\r?\n/g, ' / ')
        .split(/\s*(?:\/|,|;|。|\.)(?=\s*(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun|매일|연중무휴|[월화수목금토일]))/i)
        .map(row => row.trim())
        .filter(Boolean);
}

function rowsFromOpeningHours(value: unknown): string[] {
    if (!value) return [];
    if (isOpeningHoursTemplate(value)) return templateToDisplayRows(value);
    if (Array.isArray(value)) return value.map(item => typeof item === 'string' ? item.trim() : '').filter(Boolean);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try { return rowsFromOpeningHours(JSON.parse(trimmed)); } catch { /* use raw */ }
        }
        return splitRows(trimmed);
    }
    if (typeof value === 'object') {
        const objectValue = value as Record<string, unknown>;
        if (Array.isArray(objectValue.weekdayDescriptions)) {
            return objectValue.weekdayDescriptions.map(item => typeof item === 'string' ? item.trim() : '').filter(Boolean);
        }
        const rows: string[] = [];
        const push = (label: string, item: unknown) => {
            if (typeof item === 'string' && item.trim()) rows.push(`${label}: ${item.trim()}`);
        };
        push('Monday', objectValue.monday);
        push('Tuesday', objectValue.tuesday);
        push('Wednesday', objectValue.wednesday);
        push('Thursday', objectValue.thursday);
        push('Friday', objectValue.friday);
        push('Saturday', objectValue.saturday);
        push('Sunday', objectValue.sunday);
        push('월-금', objectValue.weekday);
        push('토-일', objectValue.weekend);
        if (typeof objectValue.closed === 'string' && objectValue.closed.trim()) rows.push(`${objectValue.closed.trim()} 휴관`);
        return rows.length ? rows : Object.values(objectValue).flatMap(rowsFromOpeningHours);
    }
    return [];
}

export function findVisitorHoursItem(visitorInfo: unknown): { index: number; item: any } | null {
    if (!Array.isArray(visitorInfo)) return null;
    const index = visitorInfo.findIndex(item => {
        const label = String(item?.label || '').toLowerCase();
        return item?.icon === '🕐'
            || item?.icon === 'clock'
            || /운영시간|영업시간|개관|휴관|opening|hours/.test(label);
    });
    return index >= 0 ? { index, item: visitorInfo[index] } : null;
}

export function isOpeningHoursTemplate(value: unknown): value is OpeningHoursTemplate {
    return Boolean(value && typeof value === 'object' && (value as any).schema === 'museum_map_opening_hours_v1' && Array.isArray((value as any).weekly));
}

function hasSuspiciousMidnightRange(template: OpeningHoursTemplate) {
    return template.weekly.some(day => day.ranges.some(range => (
        (
            range.start === '00:00'
            && range.end !== '00:00'
            && range.end !== '23:59'
            && !/12:00\s*AM|오전\s*12/i.test(day.note || '')
        )
        || (
            range.end < range.start
            && !/\b12:00\s*AM\b|midnight|자정|00:00/i.test(day.note || '')
        )
    )));
}

function isSuspiciousMidnightRange(range: OpeningRange, note?: string) {
    return range.start === '00:00'
        && range.end !== '00:00'
        && range.end !== '23:59'
        && !/12:00\s*AM|오전\s*12/i.test(note || '');
}

export function templateToDisplayRows(template: OpeningHoursTemplate): string[] {
    return template.weekly.map(day => {
        const label = DAY_LABELS[day.day];
        if (day.open === false) return `${label}: Closed`;
        const ranges = day.ranges.filter(range => !isSuspiciousMidnightRange(range, day.note));
        if (day.open === true && ranges.length) {
            return `${label}: ${ranges.map(range => `${range.start} - ${range.end}`).join(', ')}`;
        }
        if (day.open === true) return `${label}: -`;
        return `${label}: ${day.note || '-'}`;
    });
}

export function openingHoursToDisplaySource(value: unknown): string | undefined {
    const rows = rowsFromOpeningHours(value);
    return rows.length ? rows.join(' / ') : undefined;
}

export function normalizeMuseumOpeningHours(input: {
    openingHours?: unknown;
    visitorInfo?: unknown;
    source?: OpeningHoursTemplate['source'];
    timezone?: string;
    fetchedAt?: string;
}): OpeningHoursTemplate | null {
    if (isOpeningHoursTemplate(input.openingHours)) {
        if ((input.openingHours.source === 'unknown' || hasSuspiciousMidnightRange(input.openingHours)) && input.openingHours.raw && !isOpeningHoursTemplate(input.openingHours.raw)) {
            const reparsed = normalizeMuseumOpeningHours({
                openingHours: input.openingHours.raw,
                visitorInfo: input.visitorInfo,
                source: input.source,
                timezone: input.timezone || input.openingHours.timezone,
                fetchedAt: input.fetchedAt || input.openingHours.fetchedAt,
            });
            if (reparsed) return reparsed;
        }
        return {
            ...input.openingHours,
        weekly: normalizeWeekly(input.openingHours.weekly),
        };
    }

    let rows = rowsFromOpeningHours(input.openingHours);
    let source: OpeningHoursTemplate['source'] = input.source || 'unknown';
    let raw: unknown = input.openingHours || null;

    if (rows.length === 0) {
        const visitorHours = findVisitorHoursItem(input.visitorInfo);
        if (visitorHours?.item?.value) {
            rows = splitRows(String(visitorHours.item.value));
            source = 'visitor_info';
            raw = visitorHours.item.value;
        }
    } else if (!input.source) {
        source = 'google_places';
    }

    if (rows.length === 0) return null;

    const weekly = emptyWeekly();
    const mentioned = new Set<number>();
    const explicitClosed = closedIndexesFromRows(rows);
    let parsedRows = 0;

    for (const rawRow of rows) {
        const row = cleanText(rawRow);
        const match = row.match(new RegExp(String.raw`^(${DAY_PATTERN}(?:\s*[·,\/~-]\s*${DAY_PATTERN})*)\s*[:：]?\s*(.+)$`, 'i'));
        if (!match) continue;
        const indexes = parseDayToken(match[1]);
        if (indexes.length === 0) continue;
        const value = match[2];
        const rowIsClosedOnly = /^(?:closed|suljettu|휴관|휴관일|휴무|휴무일|休館|闭馆|閉館)$/i.test(cleanText(value));
        const openTwentyFourHours = /open\s*24\s*hours|24\s*hours|24시간|全天|終日|종일/i.test(value);
        const ranges = rowIsClosedOnly ? [] : openTwentyFourHours ? [{ start: '00:00', end: '00:00' }] : parseRanges(value);
        const overrides = parentheticalEndOverrides(value, indexes, ranges);
        const open = rowIsClosedOnly ? false : ranges.length > 0 ? true : null;
        indexes.forEach(index => {
            mentioned.add(index);
            weekly[index] = {
                ...weekly[index],
                open,
                ranges: overrides.has(index) ? [overrides.get(index)!] : ranges,
                note: rowIsClosedOnly ? 'closed' : cleanText(value),
            };
        });
        parsedRows += 1;
    }

    explicitClosed.forEach(index => {
        mentioned.add(index);
        weekly[index] = { ...weekly[index], open: false, ranges: [], note: 'closed' };
    });
    if (explicitClosed.size) parsedRows += 1;

    const hasOpenRows = weekly.some(day => day.open === true);
    if (hasOpenRows && mentioned.size > 0 && mentioned.size < 7) {
        weekly.forEach((day, index) => {
            if (!mentioned.has(index) && day.open === null) {
                weekly[index] = { ...day, open: false, ranges: [], note: 'closed' };
            }
        });
    }

    if (parsedRows === 0 || weekly.every(day => day.open === null)) return null;
    return {
        schema: 'museum_map_opening_hours_v1',
        source,
        timezone: input.timezone,
        weekly,
        raw,
        fetchedAt: input.fetchedAt,
        normalizedAt: new Date().toISOString(),
        confidence: source === 'visitor_info' ? 'medium' : 'high',
    };
}

export function createUnknownOpeningHoursTemplate(input: {
    raw?: unknown;
    timezone?: string;
    fetchedAt?: string;
    note?: string;
} = {}): OpeningHoursTemplate {
    return {
        schema: 'museum_map_opening_hours_v1',
        source: 'unknown',
        timezone: input.timezone,
        weekly: emptyWeekly(),
        raw: input.raw ?? null,
        note: input.note || 'No reliable opening-hours source is available.',
        fetchedAt: input.fetchedAt,
        normalizedAt: new Date().toISOString(),
        confidence: 'low',
    };
}

function normalizeWeekly(weekly: OpeningDayTemplate[]): OpeningDayTemplate[] {
    const byDay = new Map<OpeningDayKey, OpeningDayTemplate>();
    for (const item of weekly) {
        if (DAY_KEYS.includes(item.day)) {
            byDay.set(item.day, {
                day: item.day,
                open: item.open === true ? true : item.open === false ? false : null,
                ranges: Array.isArray(item.ranges) ? item.ranges.filter(range => range?.start && range?.end) : [],
                note: item.note,
            });
        }
    }
    return DAY_KEYS.map(day => byDay.get(day) || { day, open: null, ranges: [] });
}
