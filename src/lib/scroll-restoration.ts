'use client';

export type ScrollSnapshot = {
    x: number;
    y: number;
    ts: number;
};

const SCROLL_PREFIX = 'mm-scroll-position:';
const SCROLL_LOCK_PREFIX = 'mm-scroll-position-lock:';
const PENDING_RESTORE_KEY = 'mm-scroll-restore-pending';
const SCROLL_TTL_MS = 30 * 60 * 1000;
const PENDING_RESTORE_TTL_MS = 12 * 1000;
const RESTORE_DELAYS_MS = [0, 40, 100, 180, 320, 520, 820, 1200, 1700, 2300];

function canUseDOM() {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function getScrollRestorationPath() {
    if (!canUseDOM()) return '';
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function getStorageCandidates(path: string) {
    const candidates = [path];
    if (path.includes('#')) candidates.push(path.replace(/#.*$/, ''));
    return candidates.filter(Boolean);
}

function isScrollLocked() {
    if (!canUseDOM()) return false;
    const html = document.documentElement;
    const body = document.body;
    return (
        html.classList.contains('mm-search-locking') ||
        body?.classList.contains('mm-search-locking') ||
        body?.style.position === 'fixed'
    );
}

export function setManualScrollRestoration() {
    if (!canUseDOM() || !('scrollRestoration' in window.history)) return undefined;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return previous;
}

export function restoreNativeScrollRestoration(previous: ScrollRestoration | undefined) {
    if (!canUseDOM() || !previous || !('scrollRestoration' in window.history)) return;
    window.history.scrollRestoration = previous;
}

export function saveScrollPosition(path = getScrollRestorationPath()) {
    if (!canUseDOM() || !path || isScrollLocked()) return;
    const snapshot: ScrollSnapshot = {
        x: window.scrollX || 0,
        y: window.scrollY || 0,
        ts: Date.now(),
    };

    try {
        sessionStorage.setItem(`${SCROLL_PREFIX}${path}`, JSON.stringify(snapshot));
        sessionStorage.setItem(`${SCROLL_LOCK_PREFIX}${path}`, String(snapshot.ts));
    } catch { }
}

function readScrollSnapshot(path: string): ScrollSnapshot | null {
    if (!canUseDOM() || !path) return null;
    try {
        for (const candidate of getStorageCandidates(path)) {
            const raw = sessionStorage.getItem(`${SCROLL_PREFIX}${candidate}`);
            if (!raw) continue;
            const parsed = JSON.parse(raw) as Partial<ScrollSnapshot>;
            if (!parsed || typeof parsed.ts !== 'number' || Date.now() - parsed.ts > SCROLL_TTL_MS) {
                sessionStorage.removeItem(`${SCROLL_PREFIX}${candidate}`);
                sessionStorage.removeItem(`${SCROLL_LOCK_PREFIX}${candidate}`);
                continue;
            }
            return {
                x: typeof parsed.x === 'number' ? parsed.x : 0,
                y: typeof parsed.y === 'number' ? parsed.y : 0,
                ts: parsed.ts,
            };
        }
    } catch { }
    return null;
}

export function markPendingScrollRestore(path = getScrollRestorationPath()) {
    if (!canUseDOM() || !path) return;
    try {
        sessionStorage.setItem(PENDING_RESTORE_KEY, JSON.stringify({ path, ts: Date.now() }));
    } catch { }
}

export function consumePendingScrollRestore(path = getScrollRestorationPath()) {
    if (!canUseDOM() || !path) return false;
    try {
        const raw = sessionStorage.getItem(PENDING_RESTORE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as { path?: unknown; ts?: unknown };
        const restorePath = typeof parsed.path === 'string' ? parsed.path : '';
        const ts = typeof parsed.ts === 'number' ? parsed.ts : 0;
        const isFresh = Date.now() - ts < PENDING_RESTORE_TTL_MS;
        const matches = restorePath === path || getStorageCandidates(restorePath).includes(path);
        if (!isFresh || matches) sessionStorage.removeItem(PENDING_RESTORE_KEY);
        return isFresh && matches;
    } catch {
        try { sessionStorage.removeItem(PENDING_RESTORE_KEY); } catch { }
        return false;
    }
}

export function restoreSavedScrollPosition(path = getScrollRestorationPath()) {
    if (!canUseDOM() || !path) return false;
    const snapshot = readScrollSnapshot(path);
    if (!snapshot) return false;

    const left = Math.max(0, snapshot.x || 0);
    const top = Math.max(0, snapshot.y || 0);
    if (left <= 0 && top <= 0) return false;

    const restore = () => {
        if (!canUseDOM() || isScrollLocked()) return;
        window.scrollTo({ left, top, behavior: 'auto' });
    };

    restore();
    window.requestAnimationFrame(() => {
        restore();
        window.requestAnimationFrame(restore);
    });
    RESTORE_DELAYS_MS.forEach((delay) => window.setTimeout(restore, delay));
    return true;
}
