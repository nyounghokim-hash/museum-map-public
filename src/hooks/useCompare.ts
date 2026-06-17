'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

const STORAGE_KEY = 'compareMuseums';
const COMPARE_CHANGE_EVENT = 'compareChange';
const MAX_COMPARE = 3;

function clearLegacyStored() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { }
}

function notifyCompareChanged(ids: string[]) {
    window.dispatchEvent(new CustomEvent<string[]>(COMPARE_CHANGE_EVENT, { detail: ids }));
}

function sameIds(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    return a.every((id, index) => id === b[index]);
}

/** Push current compare IDs to server. Silently ignores 401 (not signed in). */
async function pushToServer(ids: string[]) {
    try {
        const res = await fetch('/api/me/compare', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids }),
            keepalive: true,
        });
        if (!res.ok && res.status !== 401) {
            console.warn('[compare] server sync failed:', res.status);
        }
    } catch { /* offline or network error */ }
}

export function useCompare() {
    const { data: session, status } = useSession();
    const [compareIds, setCompareIds] = useState<string[]>([]);
    const isAuthed = status === 'authenticated' && !session?.user?.name?.startsWith('guest_');

    // Account-scoped compare list. Legacy localStorage values are cleared so logged-out
    // or different-account sessions never inherit a stale compare count.
    useEffect(() => {
        let cancelled = false;

        if (status === 'loading') return;

        if (!isAuthed) {
            setCompareIds(prev => (prev.length > 0 ? [] : prev));
            clearLegacyStored();
            return;
        }

        clearLegacyStored();
        fetch('/api/me/compare')
            .then(async (r) => {
                if (r.status === 401) {
                    return [];
                }
                if (!r.ok) return null;
                const json = await r.json();
                return (json?.data?.ids as string[] | undefined) ?? [];
            })
            .then((serverIds) => {
                if (cancelled || serverIds == null) return;
                setCompareIds(prev => (sameIds(prev, serverIds) ? prev : serverIds));
                notifyCompareChanged(serverIds);
            })
            .catch(() => {
                if (!cancelled) setCompareIds(prev => (prev.length > 0 ? [] : prev));
            });

        return () => {
            cancelled = true;
        };
    }, [isAuthed, status]);

    useEffect(() => {
        const handleCompareChanged = (event: Event) => {
            const ids = (event as CustomEvent<string[]>).detail;
            if (Array.isArray(ids)) setCompareIds(prev => (sameIds(prev, ids) ? prev : ids));
        };

        window.addEventListener(COMPARE_CHANGE_EVENT, handleCompareChanged);
        return () => window.removeEventListener(COMPARE_CHANGE_EVENT, handleCompareChanged);
    }, []);

    const syncIfAuthed = useCallback((ids: string[]) => {
        if (isAuthed) pushToServer(ids);
    }, [isAuthed]);

    const addToCompare = useCallback((id: string): boolean => {
        if (!isAuthed) return false;
        const current = compareIds;
        if (current.length >= MAX_COMPARE || current.includes(id)) return false;
        const next = [...current, id];
        setCompareIds(next);
        notifyCompareChanged(next);
        syncIfAuthed(next);
        return true;
    }, [compareIds, isAuthed, syncIfAuthed]);

    const removeFromCompare = useCallback((id: string) => {
        if (!isAuthed) return;
        const next = compareIds.filter(x => x !== id);
        setCompareIds(next);
        notifyCompareChanged(next);
        syncIfAuthed(next);
    }, [compareIds, isAuthed, syncIfAuthed]);

    const clearCompare = useCallback(() => {
        clearLegacyStored();
        setCompareIds(prev => (prev.length > 0 ? [] : prev));
        notifyCompareChanged([]);
        syncIfAuthed([]);
    }, [syncIfAuthed]);

    const isInCompare = useCallback((id: string) => {
        return compareIds.includes(id);
    }, [compareIds]);

    return {
        compareIds,
        addToCompare,
        removeFromCompare,
        clearCompare,
        isInCompare,
        compareCount: compareIds.length,
        isFull: compareIds.length >= MAX_COMPARE,
        isAuthenticated: isAuthed,
        isReady: status !== 'loading',
    };
}
