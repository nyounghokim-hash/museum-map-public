// Museum view history — localStorage-based, max 20 entries, per-user

export interface MuseumHistoryEntry {
    id: string;
    viewedAt: number;
}

const BASE_KEY = 'museum-view-history';
const MAX_ENTRIES = 20;

// Derive per-user storage key
function getStorageKey(): string {
    if (typeof window === 'undefined') return '';
    // History is account-scoped only. Guests/logged-out users do not read or write history.
    const email = sessionStorage.getItem('user-email');
    return email ? `${BASE_KEY}:${email}` : '';
}

export function addMuseumView(museumId: string) {
    if (typeof window === 'undefined') return;
    try {
        const key = getStorageKey();
        if (!key) return;
        const history: MuseumHistoryEntry[] = JSON.parse(localStorage.getItem(key) || '[]');
        const filtered = history.filter(h => h.id !== museumId);
        filtered.unshift({ id: museumId, viewedAt: Date.now() });
        localStorage.setItem(key, JSON.stringify(filtered.slice(0, MAX_ENTRIES)));
    } catch { /* localStorage unavailable */ }
}

export function getMuseumHistory(): MuseumHistoryEntry[] {
    if (typeof window === 'undefined') return [];
    try {
        const key = getStorageKey();
        if (!key) return [];
        return JSON.parse(localStorage.getItem(key) || '[]');
    } catch { return []; }
}

export function clearMuseumHistory() {
    if (typeof window === 'undefined') return;
    try {
        const key = getStorageKey();
        if (key) localStorage.removeItem(key);
    } catch { }
}
