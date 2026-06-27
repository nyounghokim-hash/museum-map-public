/**
 * Localized name helper functions for Museum, Artwork, and Exhibition entities.
 * Uses JSON translations columns (nameTranslations, cityTranslations, etc.)
 * with fallback to Ko/En specific fields.
 */

/**
 * Get localized museum name.
 * Priority: nameTranslations[locale] → nameKo/nameEn → name
 */
export function getLocalizedMuseumName(museum: any, locale: string): string {
    if (!museum) return '';
    if (locale === 'ko') return museum.nameKo || museum.name;
    if (locale === 'en') return museum.nameEn || museum.name;
    return museum.nameTranslations?.[locale] || museum.nameEn || museum.name;
}

/**
 * Get localized city name.
 * Priority: cityTranslations[locale] → cityKo → city
 */
export function getLocalizedCityName(museum: any, locale: string): string {
    if (!museum) return '';
    if (locale === 'ko') return museum.cityKo || museum.city || '';
    if (locale === 'en') return museum.city || '';
    return museum.cityTranslations?.[locale] || museum.city || '';
}

/**
 * Get localized artwork title.
 * Priority: titleTranslations[locale] → titleKo/titleEn → title
 */
export function getLocalizedArtworkTitle(artwork: any, locale: string): string {
    if (!artwork) return '';
    if (locale === 'ko') return artwork.titleKo || artwork.title;
    if (locale === 'en') return artwork.titleEn || artwork.title;
    return artwork.titleTranslations?.[locale] || artwork.titleEn || artwork.title;
}

/**
 * Get localized exhibition title.
 * Priority: titleTranslations[locale] → titleTranslations.en → title
 */
export function getLocalizedExhibitionTitle(exhibition: any, locale: string): string {
    if (!exhibition) return '';
    const translations = exhibition.titleTranslations;
    if (translations && typeof translations === 'object' && !Array.isArray(translations)) {
        const localized = translations[locale];
        if (typeof localized === 'string' && localized.trim()) return localized;
        const english = translations.en;
        if (locale !== 'ko' && typeof english === 'string' && english.trim()) return english;
    }
    return exhibition.title || '';
}

/**
 * Get localized artist name.
 * Priority: artistTranslations[locale] → artistKo/artistEn → artist
 */
export function getLocalizedArtistName(artwork: any, locale: string): string {
    if (!artwork) return '';
    if (locale === 'ko') return artwork.artistKo || artwork.artist || '';
    if (locale === 'en') return artwork.artistEn || artwork.artist || '';
    return artwork.artistTranslations?.[locale] || artwork.artistEn || artwork.artist || '';
}
