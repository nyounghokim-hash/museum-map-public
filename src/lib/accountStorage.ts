'use client';

const ACTIVE_TRIP_KEY = 'activeTrip';
export const ACTIVE_TRIP_CHANGE_EVENT = 'activeTripChange';

function notifyActiveTripChange() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event(ACTIVE_TRIP_CHANGE_EVENT));
}

function getAccountEmail() {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('user-email');
}

export function getActiveTripForAccount<T = any>(): T | null {
    if (typeof window === 'undefined') return null;
    const email = getAccountEmail();
    if (!email) return null;
    try {
        const raw = localStorage.getItem(ACTIVE_TRIP_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed?.userEmail !== email) {
            localStorage.removeItem(ACTIVE_TRIP_KEY);
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
    localStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify({ ...trip, userEmail: email }));
    notifyActiveTripChange();
}

export function clearActiveTripForAccount() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ACTIVE_TRIP_KEY);
    notifyActiveTripChange();
}
