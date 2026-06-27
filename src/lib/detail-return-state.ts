'use client';

export type DetailReturnKind = 'museum' | 'story' | 'artwork';

export type DetailReturnState = {
    path: string;
    scrollX: number;
    scrollY: number;
    ts: number;
};

const DETAIL_RETURN_TTL_MS = 10 * 60 * 1000;

function getKey(kind: DetailReturnKind, id: string) {
    return `mm-detail-return:${kind}:${id}`;
}

function getCurrentPath() {
    if (typeof window === 'undefined') return '';
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function recordDetailReturnState(kind: DetailReturnKind, id: string | number | null | undefined) {
    if (typeof window === 'undefined' || id == null) return;
    const normalizedId = String(id);
    if (!normalizedId) return;

    const state: DetailReturnState = {
        path: getCurrentPath(),
        scrollX: window.scrollX || 0,
        scrollY: window.scrollY || 0,
        ts: Date.now(),
    };

    try {
        sessionStorage.setItem(getKey(kind, normalizedId), JSON.stringify(state));
    } catch { }
}

export function consumeDetailReturnState(kind: DetailReturnKind, id: string | number | null | undefined): DetailReturnState | null {
    if (typeof window === 'undefined' || id == null) return null;
    const normalizedId = String(id);
    if (!normalizedId) return null;

    const key = getKey(kind, normalizedId);
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        sessionStorage.removeItem(key);
        const parsed = JSON.parse(raw) as Partial<DetailReturnState>;
        if (!parsed || typeof parsed.ts !== 'number' || Date.now() - parsed.ts > DETAIL_RETURN_TTL_MS) return null;
        if (typeof parsed.path === 'string' && parsed.path && parsed.path !== getCurrentPath()) return null;
        return {
            path: parsed.path || getCurrentPath(),
            scrollX: typeof parsed.scrollX === 'number' ? parsed.scrollX : 0,
            scrollY: typeof parsed.scrollY === 'number' ? parsed.scrollY : 0,
            ts: parsed.ts,
        };
    } catch {
        try { sessionStorage.removeItem(key); } catch { }
        return null;
    }
}

export function restoreDetailReturnScroll(state: DetailReturnState | null) {
    if (typeof window === 'undefined' || !state) return;
    const left = Math.max(0, state.scrollX || 0);
    const top = Math.max(0, state.scrollY || 0);
    const restore = () => window.scrollTo({ left, top, behavior: 'auto' });

    restore();
    window.requestAnimationFrame(() => {
        restore();
        window.requestAnimationFrame(restore);
    });
    window.setTimeout(restore, 80);
    window.setTimeout(restore, 180);
}
