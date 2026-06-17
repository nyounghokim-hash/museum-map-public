'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';

export const ACCOUNT_SAVES_CHANGE_EVENT = 'accountSavesChange';

export type AccountSaveRecord = {
    id?: string;
    museumId?: string | null;
    museum?: ({ id?: string | null } & Record<string, unknown>) | null;
    [key: string]: unknown;
};
type SessionUserLike = { email?: string | null; name?: string | null };
type SessionLike = { user?: SessionUserLike | null } | null | undefined;
type CacheEntry = { data: AccountSaveRecord[]; ts: number };
type UseAccountSavesOptions = {
    onUnauthorized?: () => void;
    initialFetch?: 'immediate' | 'idle';
    idleTimeout?: number;
};

const CACHE_TTL_MS = 30_000;
const savesCache = new Map<string, CacheEntry>();
const savesInflight = new Map<string, Promise<AccountSaveRecord[]>>();

export class AccountSavesUnauthorizedError extends Error {
    constructor() {
        super('Unauthorized account saves request');
        this.name = 'AccountSavesUnauthorizedError';
    }
}

function getSessionUser(session: unknown): SessionUserLike | null {
    if (!session || typeof session !== 'object') return null;
    const user = (session as SessionLike)?.user;
    return user && typeof user === 'object' ? user : null;
}

export function getSessionAccountKey(session: unknown, status: string) {
    if (status !== 'authenticated') return null;
    const user = getSessionUser(session);
    if (user?.name?.startsWith('guest_')) return null;
    return user?.email || user?.name || 'authenticated';
}

function normalizeSaves(raw: unknown): AccountSaveRecord[] {
    const list = raw && typeof raw === 'object' && 'data' in raw ? (raw as { data?: unknown }).data : raw;
    return Array.isArray(list) ? list.filter((item): item is AccountSaveRecord => Boolean(item) && typeof item === 'object') : [];
}

function getSaveMuseumId(save: AccountSaveRecord) {
    return save?.museum?.id || save?.museumId || null;
}

function sameSaveList(a: AccountSaveRecord[], b: AccountSaveRecord[]) {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    return a.every((item, index) => item?.id === b[index]?.id && getSaveMuseumId(item) === getSaveMuseumId(b[index]));
}

function emitSavesChanged(accountKey: string | null) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(ACCOUNT_SAVES_CHANGE_EVENT, { detail: { accountKey } }));
}

function scheduleIdle(callback: () => void, timeout = 2500) {
    if (typeof window === 'undefined') {
        callback();
        return undefined;
    }
    const win = window as Window & typeof globalThis & {
        requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
        cancelIdleCallback?: (handle: number) => void;
    };
    if (typeof win.requestIdleCallback === 'function' && typeof win.cancelIdleCallback === 'function') {
        const id = win.requestIdleCallback(callback, { timeout });
        return () => win.cancelIdleCallback?.(id);
    }
    const id = win.setTimeout(callback, timeout);
    return () => win.clearTimeout(id);
}

export function getCachedAccountSaves(accountKey: string | null) {
    if (!accountKey) return [];
    return savesCache.get(accountKey)?.data ?? [];
}

export function setAccountSavesCache(accountKey: string | null, saves: AccountSaveRecord[]) {
    if (!accountKey) return;
    savesCache.set(accountKey, { data: saves, ts: Date.now() });
    emitSavesChanged(accountKey);
}

export function updateAccountSavesCache(
    accountKey: string | null,
    updater: AccountSaveRecord[] | ((previous: AccountSaveRecord[]) => AccountSaveRecord[]),
) {
    if (!accountKey) return;
    const previous = getCachedAccountSaves(accountKey);
    const next = typeof updater === 'function' ? updater(previous) : updater;
    setAccountSavesCache(accountKey, next);
}

export function invalidateAccountSaves(accountKey?: string | null) {
    if (accountKey) {
        savesCache.delete(accountKey);
        emitSavesChanged(accountKey);
        return;
    }
    savesCache.clear();
    emitSavesChanged(null);
}

export async function fetchAccountSaves(accountKey: string | null, options: { force?: boolean } = {}) {
    if (!accountKey) return [];
    const cached = savesCache.get(accountKey);
    if (!options.force && cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

    const existing = savesInflight.get(accountKey);
    if (existing) return existing;

    const promise = fetch('/api/me/saves')
        .then(async response => {
            if (response.status === 401) throw new AccountSavesUnauthorizedError();
            if (!response.ok) throw new Error(`Failed to fetch saves: ${response.status}`);
            const json = await response.json();
            const saves = normalizeSaves(json);
            savesCache.set(accountKey, { data: saves, ts: Date.now() });
            emitSavesChanged(accountKey);
            return saves;
        })
        .finally(() => {
            savesInflight.delete(accountKey);
        });

    savesInflight.set(accountKey, promise);
    return promise;
}

export function useAccountSaves(options: UseAccountSavesOptions = {}) {
    const { data: session, status } = useSession();
    const { onUnauthorized, initialFetch = 'immediate', idleTimeout = 2500 } = options;
    const accountKey = getSessionAccountKey(session, status);
    const [saves, setSaves] = useState<AccountSaveRecord[]>(() => getCachedAccountSaves(accountKey));
    const [loading, setLoading] = useState(status === 'loading');
    const [error, setError] = useState<Error | null>(null);

    const syncFromCache = useCallback(() => {
        const cached = getCachedAccountSaves(accountKey);
        setSaves(prev => (sameSaveList(prev, cached) ? prev : cached));
    }, [accountKey]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handler = (event: Event) => {
            const changedKey = (event as CustomEvent<{ accountKey?: string | null }>).detail?.accountKey;
            if (!changedKey || changedKey === accountKey) syncFromCache();
        };
        window.addEventListener(ACCOUNT_SAVES_CHANGE_EVENT, handler);
        return () => window.removeEventListener(ACCOUNT_SAVES_CHANGE_EVENT, handler);
    }, [accountKey, syncFromCache]);

    useEffect(() => {
        let cancelled = false;

        if (status === 'loading') {
            setLoading(true);
            return;
        }

        if (!accountKey) {
            setLoading(false);
            setError(null);
            setSaves(prev => (prev.length > 0 ? [] : prev));
            return;
        }

        const cached = getCachedAccountSaves(accountKey);
        if (cached.length > 0) setSaves(prev => (sameSaveList(prev, cached) ? prev : cached));
        setLoading(!savesCache.has(accountKey) && initialFetch === 'immediate');
        setError(null);

        const load = () => {
            if (cancelled) return;
            if (!savesCache.has(accountKey)) setLoading(true);
            fetchAccountSaves(accountKey)
                .then(next => {
                    if (!cancelled) setSaves(prev => (sameSaveList(prev, next) ? prev : next));
                })
                .catch(err => {
                    if (cancelled) return;
                    setError(err instanceof Error ? err : new Error('Failed to fetch saves'));
                    if (err instanceof AccountSavesUnauthorizedError) onUnauthorized?.();
                })
                .finally(() => {
                    if (!cancelled) setLoading(false);
                });
        };

        const cancelIdle = initialFetch === 'idle' && !savesCache.has(accountKey)
            ? scheduleIdle(load, idleTimeout)
            : undefined;
        if (!cancelIdle) load();

        return () => {
            cancelled = true;
            cancelIdle?.();
        };
    }, [accountKey, status, onUnauthorized, initialFetch, idleTimeout]);

    const refresh = useCallback((refreshOptions: { force?: boolean } = { force: true }) => {
        if (!accountKey) {
            setSaves(prev => (prev.length > 0 ? [] : prev));
            return Promise.resolve([]);
        }
        setLoading(true);
        setError(null);
        return fetchAccountSaves(accountKey, refreshOptions)
            .then(next => {
                setSaves(prev => (sameSaveList(prev, next) ? prev : next));
                return next;
            })
            .catch(err => {
                setError(err instanceof Error ? err : new Error('Failed to fetch saves'));
                if (err instanceof AccountSavesUnauthorizedError) onUnauthorized?.();
                throw err;
            })
            .finally(() => setLoading(false));
    }, [accountKey, onUnauthorized]);

    const setCachedSaves = useCallback((
        updater: AccountSaveRecord[] | ((previous: AccountSaveRecord[]) => AccountSaveRecord[]),
    ) => {
        updateAccountSavesCache(accountKey, updater);
    }, [accountKey]);

    const savedIds = useMemo(() => {
        return new Set(saves.map(getSaveMuseumId).filter(Boolean) as string[]);
    }, [saves]);

    return {
        saves,
        savedIds,
        loading,
        error,
        accountKey,
        isAuthenticated: Boolean(accountKey),
        isReady: status !== 'loading',
        refresh,
        setCachedSaves,
    };
}
