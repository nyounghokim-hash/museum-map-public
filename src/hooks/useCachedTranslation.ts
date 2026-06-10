'use client';
import { useState, useEffect } from 'react';

/**
 * Hook to fetch DB-cached translations for a given entity.
 * Returns a Map<field, translatedText>.
 * Only fetches for non-ko/en locales.
 */
export function useCachedTranslation(
    entityType: 'story' | 'museum' | 'artwork',
    entityId: string | undefined,
    locale: string
): { translations: Record<string, string>; loading: boolean; partial: boolean; error: boolean } {
    const [translations, setTranslations] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [partial, setPartial] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!entityId || locale === 'ko' || locale === 'en') {
            setTranslations({});
            setLoading(false);
            setPartial(false);
            setError(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setPartial(false);
        setError(false);

        fetch(`/api/translations?entityType=${entityType}&entityId=${entityId}&locale=${locale}`)
            .then(r => r.json())
            .then(data => {
                if (!cancelled) {
                    setTranslations(data.translations || {});
                    setPartial(Boolean(data.partial));
                    setError(Boolean(data.error));
                    setLoading(false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setTranslations({});
                    setPartial(true);
                    setError(true);
                    setLoading(false);
                }
            });

        return () => { cancelled = true; };
    }, [entityType, entityId, locale]);

    return { translations, loading, partial, error };
}
