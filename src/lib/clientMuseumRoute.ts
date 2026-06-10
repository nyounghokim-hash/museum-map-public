function normalizeValue(value: unknown) {
    return String(value || '').trim();
}

function normalizeComparable(value: unknown) {
    return normalizeValue(value).toLowerCase().replace(/\s+/g, ' ');
}

const routeCache = new Map<string, string>();

const KNOWN_MUSEUM_ROUTE_IDS: Record<string, string> = {
    'art institute of chicago': '2tazkqm9',
    'the art institute of chicago': '2tazkqm9',
    '시카고 미술관': '2tazkqm9',
    'シカゴ美術館': '2tazkqm9',
    'cleveland museum of art': '16560957-826d-4533-9694-57bd8e26fb50',
    'the cleveland museum of art': '16560957-826d-4533-9694-57bd8e26fb50',
    '클리블랜드 미술관': '16560957-826d-4533-9694-57bd8e26fb50',
    'クリーブランド美術館': '16560957-826d-4533-9694-57bd8e26fb50',
};

function isRouteIdCandidate(value: string) {
    if (!value) return false;
    if (/^https?:\/\//i.test(value)) return false;
    if (value.includes('/')) return false;
    return true;
}

async function museumExists(id: string) {
    try {
        const res = await fetch(`/api/museums/${encodeURIComponent(id)}`);
        return res.ok;
    } catch {
        return false;
    }
}

function getMuseumsFromSearchPayload(payload: any) {
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.data)) return payload.data.data;
    if (Array.isArray(payload?.museums)) return payload.museums;
    return [];
}

function findKnownMuseumRouteId(museum: any) {
    const values = [
        museum?.nameKo,
        museum?.name,
        museum?.nameEn,
        ...Object.values(museum?.nameTranslations || {}),
    ].map(normalizeComparable).filter(Boolean);

    for (const value of values) {
        const routeId = KNOWN_MUSEUM_ROUTE_IDS[value];
        if (routeId) return routeId;
    }

    return '';
}

async function findMuseumByName(museum: any) {
    const names = [museum?.nameKo, museum?.name, museum?.nameEn]
        .map(normalizeValue)
        .filter(Boolean);

    for (const name of names) {
        try {
            const res = await fetch(`/api/museums?q=${encodeURIComponent(name)}&limit=8`);
            if (!res.ok) continue;
            const payload = await res.json();
            const data = getMuseumsFromSearchPayload(payload);
            const expectedNames = new Set(names.map(normalizeComparable));
            const expectedCity = normalizeComparable(museum?.cityKo || museum?.city);
            const expectedCountry = normalizeComparable(museum?.country);
            const exact = data.find((item: any) => {
                const itemNames = [item?.nameKo, item?.name, item?.nameEn].map(normalizeComparable);
                const nameMatches = itemNames.some((itemName) => expectedNames.has(itemName));
                if (!nameMatches) return false;
                const cityMatches = !expectedCity || [item?.cityKo, item?.city].map(normalizeComparable).includes(expectedCity);
                const countryMatches = !expectedCountry || normalizeComparable(item?.country) === expectedCountry;
                return cityMatches && countryMatches;
            }) || data.find((item: any) => [item?.nameKo, item?.name, item?.nameEn].map(normalizeComparable).some((itemName) => expectedNames.has(itemName)));
            if (exact?.id) return String(exact.id);
        } catch {
            continue;
        }
    }

    return '';
}

export async function resolveMuseumRouteId(museum: any) {
    const cacheKey = [
        museum?.id,
        museum?.museumId,
        museum?.museum?.id,
        museum?.nameKo,
        museum?.name,
        museum?.nameEn,
    ].map(normalizeValue).filter(Boolean).join('|');
    if (cacheKey && routeCache.has(cacheKey)) return routeCache.get(cacheKey) || '';

    const knownRouteId = findKnownMuseumRouteId(museum);
    if (knownRouteId && await museumExists(knownRouteId)) {
        if (cacheKey) routeCache.set(cacheKey, knownRouteId);
        return knownRouteId;
    }

    const candidates = [
        museum?.id,
        museum?.museumId,
        museum?.museum?.id,
    ].map(normalizeValue).filter(isRouteIdCandidate);

    for (const candidate of candidates) {
        if (await museumExists(candidate)) {
            if (cacheKey) routeCache.set(cacheKey, candidate);
            return candidate;
        }
    }

    const found = await findMuseumByName(museum);
    if (cacheKey) routeCache.set(cacheKey, found);
    return found;
}
