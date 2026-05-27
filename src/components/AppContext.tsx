'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Locale, getLocaleFromCountry, t } from '@/lib/i18n';
import { useSession, signOut } from 'next-auth/react';

interface AppContextType {
    locale: Locale;
    setLocale: (l: Locale) => void;
    darkMode: boolean;
    setDarkMode: (d: boolean) => void;
    t: (key: string, loc?: Locale) => string;
}

const AppContext = createContext<AppContextType>({
    locale: 'en',
    setLocale: () => { },
    darkMode: false,
    setDarkMode: () => { },
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

export function useApp() {
    return useContext(AppContext);
}

export function AppProvider({ children, initialLocale = 'en' }: { children: ReactNode; initialLocale?: Locale }) {
    const { data: session } = useSession();
    const [locale, setLocaleState] = useState<Locale>(initialLocale);
    const [darkMode, setDarkModeState] = useState(false);
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

        if (savedDark === 'true') {
            setDarkModeState(true);
            document.documentElement.classList.add('dark');
        }
        setInitialized(true);
    }, []);

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
        setDarkModeState(d);
        localStorage.setItem('darkMode', String(d));
        if (d) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    return (
        <AppContext.Provider value={{ locale, setLocale, darkMode, setDarkMode, t: (key, loc) => t(key as any, loc || locale) }}>
            {children}
        </AppContext.Provider>
    );
}
