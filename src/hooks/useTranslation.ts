'use client';
import { useState, useEffect } from 'react';
import { Locale } from '@/lib/i18n';

// Client-side localStorage cache
const memoryCache = new Map<string, string>();
const TRANSLATION_TIMEOUT_MS = 5000;

function getCacheKey(text: string, locale: Locale): string {
    return `tr:${locale}:${text.slice(0, 100)}`;
}

function containsKorean(text: string): boolean {
    return /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text);
}

export function useTranslatedText(text: string | null | undefined, locale: Locale): string;
export function useTranslatedText(text: string | null | undefined, locale: Locale, opts: { withLoading: true }): { text: string; isTranslating: boolean };
export function useTranslatedText(text: string | null | undefined, locale: Locale, opts?: { withLoading: boolean }): string | { text: string; isTranslating: boolean } {
    const needsTranslation = locale !== 'ko' && (locale !== 'en' || containsKorean(text || ''));
    const [translated, setTranslated] = useState(needsTranslation ? '' : (text || ''));
    const [isTranslating, setIsTranslating] = useState(needsTranslation && !!text);

    useEffect(() => {
        if (!text) {
            setTranslated(text || '');
            setIsTranslating(false);
            return;
        }

        // Korean text in Korean UI, or non-Korean text in English UI: no translation needed
        if (locale === 'ko' || (locale === 'en' && !containsKorean(text))) {
            setTranslated(text);
            setIsTranslating(false);
            return;
        }

        const key = getCacheKey(text, locale);

        // Check memory cache first
        if (memoryCache.has(key)) {
            const cached = memoryCache.get(key)!;
            if (cached && cached !== text) {
                setTranslated(cached);
                setIsTranslating(false);
                return;
            }
            memoryCache.delete(key);
        }

        // Check localStorage
        try {
            const cached = localStorage.getItem(key);
            if (cached && cached !== text) {
                memoryCache.set(key, cached);
                setTranslated(cached);
                setIsTranslating(false);
                return;
            }
            if (cached === text) localStorage.removeItem(key);
        } catch { }

        // No cache — mark as translating and fetch. Translation is progressive
        // enhancement, so it must never leave the UI in a permanent loading state.
        setIsTranslating(true);

        let cancelled = false;
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), TRANSLATION_TIMEOUT_MS);

        fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, targetLang: locale }),
            signal: controller.signal,
        })
            .then(r => r.json())
            .then(data => {
                if (cancelled) return;
                const result = data.translated || '';
                if (result && result !== text) {
                    memoryCache.set(key, result);
                    try { localStorage.setItem(key, result); } catch { }
                    setTranslated(result);
                } else {
                    setTranslated(prev => (prev && prev !== text ? prev : ''));
                }
                setIsTranslating(false);
            })
            .catch(() => {
                if (!cancelled) {
                    setTranslated(prev => (prev && prev !== text ? prev : ''));
                    setIsTranslating(false);
                }
            })
            .finally(() => {
                window.clearTimeout(timeoutId);
            });

        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
            controller.abort();
        };
    }, [text, locale]);

    if (opts?.withLoading) {
        return { text: translated, isTranslating };
    }
    return translated;
}

/**
 * Translate multiple texts at once. Returns a Map<original, translated>.
 * Only translates when locale is not 'ko'. English UI translates Korean fallback text.
 */
export function useTranslatedTexts(texts: string[], locale: Locale): Map<string, string> {
    const [map, setMap] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        if (!texts.length || locale === 'ko') {
            setMap(new Map(texts.map(t => [t, t])));
            return;
        }

        let cancelled = false;
        const result = new Map<string, string>();
        const toFetch: string[] = [];

        // Check caches first
        for (const text of texts) {
            if (!text) { result.set(text, text); continue; }
            if (locale === 'en' && !containsKorean(text)) {
                result.set(text, text);
                continue;
            }
            const key = getCacheKey(text, locale);
            if (memoryCache.has(key)) {
                const cached = memoryCache.get(key)!;
                if (cached && cached !== text) {
                    result.set(text, cached);
                } else {
                    memoryCache.delete(key);
                    toFetch.push(text);
                    result.set(text, text);
                }
            } else {
                try {
                    const cached = localStorage.getItem(key);
                    if (cached && cached !== text) {
                        memoryCache.set(key, cached);
                        result.set(text, cached);
                        continue;
                    }
                    if (cached === text) localStorage.removeItem(key);
                } catch { }
                toFetch.push(text);
                result.set(text, text); // default to original while loading
            }
        }

        setMap(new Map(result));

        if (toFetch.length === 0) return;

        // Fetch translations in parallel. These are progressive enhancements;
        // timeout each request so slow translation cannot hold UI feedback open.
        const controllers: AbortController[] = [];
        Promise.all(
            toFetch.map(text => {
                const controller = new AbortController();
                controllers.push(controller);
                const timeoutId = window.setTimeout(() => controller.abort(), TRANSLATION_TIMEOUT_MS);
                return fetch('/api/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, targetLang: locale }),
                    signal: controller.signal,
                })
                    .then(r => r.json())
                    .then(data => ({ text, translated: data.translated || '' }))
                    .catch(() => ({ text, translated: '' }))
                    .finally(() => window.clearTimeout(timeoutId));
            })
        ).then(results => {
            if (cancelled) return;
            const updated = new Map(result);
            for (const { text, translated } of results) {
                if (translated && translated !== text) {
                    updated.set(text, translated);
                    const key = getCacheKey(text, locale);
                    memoryCache.set(key, translated);
                    try { localStorage.setItem(key, translated); } catch { }
                }
            }
            setMap(updated);
        });

        return () => {
            cancelled = true;
            controllers.forEach(controller => controller.abort());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(texts), locale]);

    return map;
}
