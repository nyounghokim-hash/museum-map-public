'use client';

const ACTIVE_TRIP_KEY = 'activeTrip';
export const ACTIVE_TRIP_CHANGE_EVENT = 'activeTripChange';

function notifyActiveTripChange(trip?: any) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(ACTIVE_TRIP_CHANGE_EVENT, { detail: trip || null }));
}

function getAccountEmail(fallbackEmail?: string | null) {
    if (typeof window === 'undefined') return null;
    return fallbackEmail || sessionStorage.getItem('user-email');
}

export function getStoredActiveTrip<T = any>(): T | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(ACTIVE_TRIP_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        localStorage.removeItem(ACTIVE_TRIP_KEY);
        return null;
    }
}

export function getActiveTripForAccount<T = any>(fallbackEmail?: string | null): T | null {
    if (typeof window === 'undefined') return null;
    const email = getAccountEmail(fallbackEmail);
    if (!email) return null;
    try {
        const raw = localStorage.getItem(ACTIVE_TRIP_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed?.userEmail !== email) {
            return null;
        }
        return parsed;
    } catch {
        localStorage.removeItem(ACTIVE_TRIP_KEY);
        return null;
    }
}

export function setActiveTripForAccount<T extends Record<string, any>>(trip: T) {
    if (typeof window === 'undefined') return;
    const email = getAccountEmail();
    if (!email) return;
    const nextTrip = { ...trip, userEmail: email };
    localStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(nextTrip));
    notifyActiveTripChange(nextTrip);
}

export function clearActiveTripForAccount() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ACTIVE_TRIP_KEY);
    notifyActiveTripChange(null);
}
