type TripLike = {
    date?: string | Date | null;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    stops?: TripStopLike[] | null;
};

export type TripStopLike = {
    id?: string | null;
    museumId?: string | null;
    museum?: { id?: string | null } | null;
    visitedAt?: string | Date | null;
    reviewId?: string | null;
};

function toDateKey(input?: string | Date | null): string | null {
    if (!input) return null;
    const date = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getTodayDateKey(now: Date = new Date()) {
    return toDateKey(now) || '';
}

export function isTripEnded(trip?: TripLike | null, now: Date = new Date()) {
    if (!trip) return false;
    const lastTripDay = toDateKey(trip.endDate || trip.startDate || trip.date);
    if (!lastTripDay) return false;
    return lastTripDay < getTodayDateKey(now);
}

export function isTripPending(trip?: TripLike | null, now: Date = new Date()) {
    if (!trip?.startDate) return false;
    const firstTripDay = toDateKey(trip.startDate);
    if (!firstTripDay) return false;
    return firstTripDay > getTodayDateKey(now);
}

export function isStopVisited(stop?: TripStopLike | null) {
    return !!(stop?.visitedAt || stop?.reviewId);
}

export function getTripVisitStats(stops: TripStopLike[] = []) {
    const total = stops.length;
    const visited = stops.filter(isStopVisited).length;
    return {
        total,
        visited,
        remaining: Math.max(total - visited, 0),
        complete: total > 0 && visited >= total,
    };
}

export function getStopMuseumId(stop?: TripStopLike | null) {
    return stop?.museumId || stop?.museum?.id || null;
}

export function findTripStopForMuseum(trip: TripLike | null | undefined, museumId: string) {
    return (trip?.stops || []).find((stop) => getStopMuseumId(stop) === museumId) || null;
}

export function updateTripStopVisitState<T extends TripStopLike>(
    stops: T[] = [],
    target: Pick<TripStopLike, 'id' | 'museumId'>,
    visited: { visitedAt?: string | Date | null; reviewId?: string | null } | null
) {
    return stops.map((stop) => {
        const sameStop = target.id ? stop.id === target.id : false;
        const sameMuseum = target.museumId ? getStopMuseumId(stop) === target.museumId : false;
        if (!sameStop && !sameMuseum) return stop;
        return {
            ...stop,
            visitedAt: visited?.visitedAt || null,
            reviewId: visited?.reviewId || null,
        };
    });
}
