'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Locale, getLocaleFromCountry, t } from '@/lib/i18n';
import { useSession, signOut } from 'next-auth/react';

export type ThemeMode = 'light' | 'dark' | 'system';

interface AppContextType {
    locale: Locale;
    setLocale: (l: Locale) => void;
    darkMode: boolean;
    setDarkMode: (d: boolean) => void;
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    t: (key: string, loc?: Locale) => string;
}

const AppContext = createContext<AppContextType>({
    locale: 'en',
    setLocale: () => { },
    darkMode: false,
    setDarkMode: () => { },
    themeMode: 'light',
    setThemeMode: () => { },
    t: (key: string) => key,
});

const VALID_LOCALES: Locale[] = ['en', 'ko', 'ja', 'de', 'fr', 'es', 'pt', 'zh-CN', 'zh-TW', 'da', 'fi', 'sv', 'et'];

function isLocale(value: string | null): value is Locale {
    return !!value && VALID_LOCALES.includes(value as Locale);
}

function detectBrowserLocale(): Locale | null {
    if (typeof navigator === 'undefined') return null;
    const browserLang = (navigator.language || '').toLowerCase();
    const langMap: Record<string, Locale> = {
        'ko': 'ko', 'ja': 'ja', 'de': 'de', 'fr': 'fr', 'es': 'es',
        'pt': 'pt', 'zh-cn': 'zh-CN', 'zh-tw': 'zh-TW', 'zh-hans': 'zh-CN',
        'zh-hant': 'zh-TW', 'zh': 'zh-CN', 'da': 'da', 'fi': 'fi', 'sv': 'sv', 'et': 'et'
    };
    const shortLang = browserLang.split('-')[0];
    return langMap[browserLang] || langMap[shortLang] || null;
}

function persistLocaleCookie(locale: Locale) {
    if (typeof document === 'undefined') return;
    document.cookie = `mm_locale=${locale}; path=/; max-age=31536000; samesite=lax`;
}

function getSystemDarkMode() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getEffectiveDarkMode(mode: ThemeMode) {
    return mode === 'system' ? getSystemDarkMode() : mode === 'dark';
}

function applyEffectiveTheme(isDark: boolean) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const themeColor = isDark ? '#020617' : '#f8fbff';
    root.classList.toggle('dark', isDark);
    root.dataset.theme = isDark ? 'dark' : 'light';
    root.style.colorScheme = isDark ? 'dark' : 'light';

    const themeColorMetas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    const primaryThemeColorMeta = themeColorMetas[0] || document.createElement('meta');
    primaryThemeColorMeta.setAttribute('name', 'theme-color');
    primaryThemeColorMeta.setAttribute('content', themeColor);
    primaryThemeColorMeta.removeAttribute('media');
    if (!primaryThemeColorMeta.parentNode) document.head.appendChild(primaryThemeColorMeta);
    themeColorMetas.slice(1).forEach((meta) => meta.remove());

    let statusBarMeta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!statusBarMeta) {
        statusBarMeta = document.createElement('meta');
        statusBarMeta.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
        document.head.appendChild(statusBarMeta);
    }
    statusBarMeta.setAttribute('content', isDark ? 'black-translucent' : 'default');
}

export function useApp() {
    return useContext(AppContext);
}

export function AppProvider({ children, initialLocale = 'en' }: { children: ReactNode; initialLocale?: Locale }) {
    const { data: session } = useSession();
    const [locale, setLocaleState] = useState<Locale>(initialLocale);
    const [darkMode, setDarkModeState] = useState(false);
    const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
    const [initialized, setInitialized] = useState(false);

    // Guest Session Guard: Log out if isGuest but sessionStorage is empty (new tab/restart) or IP changed
    useEffect(() => {
        if (session?.user?.name?.startsWith('guest_')) {
            const isGuestFlag = sessionStorage.getItem('isGuest');
            if (!isGuestFlag) {
                signOut({ redirect: false });
                return;
            }

            // IP Change Check
            fetch('/api/auth/guest-check')
                .then(r => r.json())
                .then(data => {
                    const savedIp = localStorage.getItem('guestIpHash');
                    if (data.ipHash) {
                        if (savedIp && savedIp !== data.ipHash) {
                            console.log('IP changed, signing out guest');
                            localStorage.removeItem('guestIpHash');
                            sessionStorage.removeItem('isGuest');
                            signOut({ redirect: false });
                        } else {
                            localStorage.setItem('guestIpHash', data.ipHash);
                        }
                    }
                })
                .catch(err => console.error('Guest IP check failed', err));
        }
    }, [session]);

    // Load from localStorage
    useEffect(() => {
        const savedLocale = localStorage.getItem('locale') as Locale | null;
        const savedTheme = localStorage.getItem('themeMode') as ThemeMode | null;
        const savedDark = localStorage.getItem('darkMode');

        if (isLocale(savedLocale)) {
            setLocaleState(savedLocale);
            persistLocaleCookie(savedLocale);
        } else {
            const detected = detectBrowserLocale();

            if (detected) {
                setLocaleState(detected);
                localStorage.setItem('locale', detected);
                persistLocaleCookie(detected);
            } else {
                // Fallback: auto-detect from IP
                fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) })
                    .then(r => r.json())
                    .then(data => {
                        if (data.country_code) {
                            const ipDetected = getLocaleFromCountry(data.country_code);
                            setLocaleState(ipDetected);
                            localStorage.setItem('locale', ipDetected);
                            persistLocaleCookie(ipDetected);
                        }
                    })
                    .catch(() => { });
            }
        }

        const nextThemeMode: ThemeMode = savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system'
            ? savedTheme
            : savedDark === 'true'
                ? 'dark'
                : 'light';
        const nextDarkMode = getEffectiveDarkMode(nextThemeMode);
        setThemeModeState(nextThemeMode);
        setDarkModeState(nextDarkMode);
        applyEffectiveTheme(nextDarkMode);
        setInitialized(true);
    }, []);

    useEffect(() => {
        if (themeMode !== 'system' || typeof window === 'undefined') return;
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const syncSystemTheme = () => {
            const nextDark = media.matches;
            setDarkModeState(nextDark);
            applyEffectiveTheme(nextDark);
        };
        syncSystemTheme();
        media.addEventListener('change', syncSystemTheme);
        return () => media.removeEventListener('change', syncSystemTheme);
    }, [themeMode]);

    // Persist locale to DB when it changes or on first load
    useEffect(() => {
        if (initialized && session?.user && !(session.user as any).name?.startsWith('guest_')) {
            fetch('/api/me/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locale })
            }).catch(() => { });
        }
    }, [initialized, locale, session]);

    const setLocale = (l: Locale) => {
        setLocaleState(l);
        localStorage.setItem('locale', l);
        persistLocaleCookie(l);
        // Persist locale to user preferences in DB (fire-and-forget)
        if (session?.user) {
            fetch('/api/me/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locale: l })
            }).catch(() => { });
        }
    };

    const setDarkMode = (d: boolean) => {
        const mode: ThemeMode = d ? 'dark' : 'light';
        setThemeModeState(mode);
        setDarkModeState(d);
        localStorage.setItem('themeMode', mode);
        localStorage.setItem('darkMode', String(d));
        applyEffectiveTheme(d);
    };

    const setThemeMode = (mode: ThemeMode) => {
        const nextDark = getEffectiveDarkMode(mode);
        setThemeModeState(mode);
        setDarkModeState(nextDark);
        localStorage.setItem('themeMode', mode);
        localStorage.setItem('darkMode', String(nextDark));
        applyEffectiveTheme(nextDark);
    };

    return (
        <AppContext.Provider value={{ locale, setLocale, darkMode, setDarkMode, themeMode, setThemeMode, t: (key, loc) => t(key as any, loc || locale) }}>
            {children}
        </AppContext.Provider>
    );
}
