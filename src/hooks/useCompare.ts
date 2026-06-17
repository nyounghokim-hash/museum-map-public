'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

const STORAGE_KEY = 'compareMuseums';
export const COMPARE_CHANGE_EVENT = 'compareChange';
const MAX_COMPARE = 3;
const compareCache = new Map<string, string[]>();
const compareInflight = new Map<string, Promise<string[] | null>>();

function clearLegacyStored() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { }
}

function notifyCompareChanged(ids: string[]) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<string[]>(COMPARE_CHANGE_EVENT, { detail: ids }));
}

function sameIds(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    return a.every((id, index) => id === b[index]);
}

function normalizeIds(ids: string[]) {
    return Array.from(new Set(ids.filter(Boolean))).slice(0, MAX_COMPARE);
}

function getCompareAccountKey(session: unknown, status: string) {
    if (status !== 'authenticated') return null;
    const user = session && typeof session === 'object' && 'user' in session
        ? (session as { user?: { email?: string | null; name?: string | null } | null }).user
        : null;
    if (user?.name?.startsWith('guest_')) return null;
    return user?.email || user?.name || 'authenticated';
}

function getCachedCompare(accountKey: string | null) {
    if (!accountKey) return [];
    return compareCache.get(accountKey) ?? [];
}

function setCompareCache(accountKey: string | null, ids: string[]) {
    if (!accountKey) return;
    const next = normalizeIds(ids);
    compareCache.set(accountKey, next);
    notifyCompareChanged(next);
}

export function invalidateCompareCache() {
    compareInflight.clear();
    compareCache.clear();
    notifyCompareChanged([]);
}

async function fetchCompareFromServer(accountKey: string | null, force = false) {
    if (!accountKey) return [];
    if (!force && compareCache.has(accountKey)) return compareCache.get(accountKey) ?? [];
    const existing = compareInflight.get(accountKey);
    if (existing) return existing;

    const promise = fetch('/api/me/compare')
        .then(async (r) => {
            if (r.status === 401) return [];
            if (!r.ok) return null;
            const json = await r.json();
            const ids = normalizeIds((json?.data?.ids as string[] | undefined) ?? []);
            compareCache.set(accountKey, ids);
            notifyCompareChanged(ids);
            return ids;
        })
        .finally(() => {
            compareInflight.delete(accountKey);
        });

    compareInflight.set(accountKey, promise);
    return promise;
}

async function writeCompareToServer(accountKey: string | null, ids: string[]) {
    if (!accountKey) return false;
    const next = normalizeIds(ids);
    try {
        const res = await fetch('/api/me/compare', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: next }),
            keepalive: true,
        });
        if (res.status === 401) return false;
        if (!res.ok) {
            console.warn('[compare] server sync failed:', res.status);
            return false;
        }
        compareCache.set(accountKey, next);
        notifyCompareChanged(next);
        return true;
    } catch {
        return false;
    }
}

export function useCompare() {
    const { data: session, status } = useSession();
    const accountKey = getCompareAccountKey(session, status);
    const [compareIds, setCompareIds] = useState<string[]>(() => getCachedCompare(accountKey));
    const isAuthed = Boolean(accountKey);

    // Account-scoped compare list. Legacy localStorage values are cleared so logged-out
    // or different-account sessions never inherit a stale compare count.
    useEffect(() => {
        let cancelled = false;

        if (status === 'loading') return;

        if (!accountKey) {
            setCompareIds(prev => (prev.length > 0 ? [] : prev));
            return;
        }

        clearLegacyStored();
        const cached = getCachedCompare(accountKey);
        if (cached.length > 0) setCompareIds(prev => (sameIds(prev, cached) ? prev : cached));
        fetchCompareFromServer(accountKey)
            .then((serverIds) => {
                if (cancelled || serverIds == null) return;
                setCompareIds(prev => (sameIds(prev, serverIds) ? prev : serverIds));
            })
            .catch(() => {
                if (!cancelled) setCompareIds(prev => (prev.length > 0 ? [] : prev));
            });

        return () => {
            cancelled = true;
        };
    }, [accountKey, status]);

    useEffect(() => {
        const handleCompareChanged = (event: Event) => {
            const ids = (event as CustomEvent<string[]>).detail;
            if (Array.isArray(ids)) setCompareIds(prev => (sameIds(prev, ids) ? prev : ids));
        };

        window.addEventListener(COMPARE_CHANGE_EVENT, handleCompareChanged);
        return () => window.removeEventListener(COMPARE_CHANGE_EVENT, handleCompareChanged);
    }, []);

    const syncIfAuthed = useCallback((ids: string[]) => {
        if (accountKey) void writeCompareToServer(accountKey, ids);
    }, [accountKey]);

    const replaceCompare = useCallback(async (ids: string[]) => {
        if (!accountKey) return false;
        const next = normalizeIds(ids);
        setCompareIds(prev => (sameIds(prev, next) ? prev : next));
        setCompareCache(accountKey, next);
        const ok = await writeCompareToServer(accountKey, next);
        if (!ok) {
            void fetchCompareFromServer(accountKey, true);
        }
        return ok;
    }, [accountKey]);

    const addToCompare = useCallback((id: string): boolean => {
        if (!accountKey) return false;
        const current = compareIds;
        if (current.length >= MAX_COMPARE || current.includes(id)) return false;
        const next = [...current, id];
        setCompareIds(next);
        setCompareCache(accountKey, next);
        syncIfAuthed(next);
        return true;
    }, [compareIds, accountKey, syncIfAuthed]);

    const removeFromCompare = useCallback((id: string) => {
        if (!accountKey) return;
        const next = compareIds.filter(x => x !== id);
        setCompareIds(next);
        setCompareCache(accountKey, next);
        syncIfAuthed(next);
    }, [compareIds, accountKey, syncIfAuthed]);

    const clearCompare = useCallback(() => {
        clearLegacyStored();
        setCompareIds(prev => (prev.length > 0 ? [] : prev));
        setCompareCache(accountKey, []);
        syncIfAuthed([]);
    }, [accountKey, syncIfAuthed]);

    const isInCompare = useCallback((id: string) => {
        return compareIds.includes(id);
    }, [compareIds]);

    return {
        compareIds,
        addToCompare,
        removeFromCompare,
        clearCompare,
        replaceCompare,
        isInCompare,
        compareCount: compareIds.length,
        isFull: compareIds.length >= MAX_COMPARE,
        isAuthenticated: isAuthed,
        isReady: status !== 'loading',
    };
}
