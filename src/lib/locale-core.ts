export type Locale = 'en' | 'ko' | 'ja' | 'de' | 'fr' | 'es' | 'pt' | 'zh-CN' | 'zh-TW' | 'da' | 'fi' | 'sv' | 'et';

export const LOCALE_NAMES: Record<Locale, string> = {
    en: 'English',
    ko: '한국어',
    ja: '日本語',
    de: 'Deutsch',
    fr: 'Français',
    es: 'Español',
    pt: 'Português',
    'zh-CN': '简体中文',
    'zh-TW': '繁體中文',
    da: 'Dansk',
    fi: 'Suomi',
    sv: 'Svenska',
    et: 'Eesti',
};

const COUNTRY_LOCALE_MAP: Record<string, Locale> = {
    KR: 'ko',
    JP: 'ja',
    DE: 'de',
    AT: 'de',
    CH: 'de',
    FR: 'fr',
    BE: 'fr',
    ES: 'es',
    MX: 'es',
    AR: 'es',
    CO: 'es',
    CL: 'es',
    PT: 'pt',
    BR: 'pt',
    CN: 'zh-CN',
    TW: 'zh-TW',
    HK: 'zh-TW',
    DK: 'da',
    FI: 'fi',
    SE: 'sv',
    EE: 'et',
};

export function getLocaleFromCountry(countryCode: string): Locale {
    return COUNTRY_LOCALE_MAP[countryCode?.toUpperCase()] || 'en';
}
