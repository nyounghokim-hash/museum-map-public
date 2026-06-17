'use client';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useApp } from '@/components/AppContext';
import { t, LOCALE_NAMES, Locale } from '@/lib/i18n';
import { ACTIVE_TRIP_CHANGE_EVENT, getActiveTripForAccount } from '@/lib/accountStorage';
import { clearClientAccountStateForLogout } from '@/lib/client-account-state';
import { useTranslatedTexts } from '@/hooks/useTranslation';
import { useModal } from '@/components/ui/Modal';
import LoginRequiredModal from '@/components/ui/LoginRequiredModal';

export default function NavHeader() {
    const { data: session } = useSession();
    const { showAlert, showConfirm } = useModal();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [mobileClosing, setMobileClosing] = useState(false);
    const [langOpen, setLangOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loginModalOpen, setLoginModalOpen] = useState(false);
    const [loginCallbackUrl, setLoginCallbackUrl] = useState('');
    const pathname = usePathname();
    const drawerRef = useRef<HTMLDivElement>(null);
    const langRef = useRef<HTMLDivElement>(null);
    const langBtnRef = useRef<HTMLButtonElement>(null);
    const [langPopoverStyle, setLangPopoverStyle] = useState<{ top: number; left: number } | null>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const userMenuBtnRef = useRef<HTMLButtonElement>(null);
    const [userMenuStyle, setUserMenuStyle] = useState<{ top: number; left: number } | null>(null);
    const notifRef = useRef<HTMLDivElement>(null);
    const { locale, setLocale, darkMode, setDarkMode } = useApp();
    const [isMapMobileHome, setIsMapMobileHome] = useState(false);
    const [isDesktopViewport, setIsDesktopViewport] = useState(false);
    const [activeTrip, setActiveTrip] = useState<any>(null);

    useEffect(() => {
        try {
            if (sessionStorage.getItem('mm-logout-done')) {
                sessionStorage.removeItem('mm-logout-done');
                const msgs: Record<string, string> = {
                    ko: '로그아웃이 완료되었습니다',
                    en: 'You have been signed out.',
                    ja: 'ログアウトしました。',
                    de: 'Du wurdest abgemeldet.',
                    fr: 'Vous avez été déconnecté.',
                    es: 'Has cerrado sesión.',
                };
                showAlert(msgs[locale] || msgs.en);
            }
        } catch { /* ignore */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const update = () => setIsMapMobileHome(pathname === '/' && window.innerWidth < 768);
        update();
        window.addEventListener('resize', update, { passive: true });
        window.addEventListener('orientationchange', update, { passive: true });
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
        };
    }, [pathname]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const update = () => setIsDesktopViewport(window.innerWidth >= 768);
        update();
        window.addEventListener('resize', update, { passive: true });
        window.addEventListener('orientationchange', update, { passive: true });
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const refresh = () => setActiveTrip(getActiveTripForAccount());
        refresh();
        window.addEventListener('storage', refresh);
        window.addEventListener('focus', refresh);
        window.addEventListener(ACTIVE_TRIP_CHANGE_EVENT, refresh);
        return () => {
            window.removeEventListener('storage', refresh);
            window.removeEventListener('focus', refresh);
            window.removeEventListener(ACTIVE_TRIP_CHANGE_EVENT, refresh);
        };
    }, [session?.user?.email]);

    // Translate notification texts for dropdown
    const notifTexts = notifications.flatMap((n: any) => [
        n.titleEn || n.title || '',
        n.messageEn || n.message || ''
    ]);
    const notifTranslations = useTranslatedTexts(notifTexts, locale);
    const getNotifTitle = (n: any) => {
        if (locale === 'ko') return n.title;
        const src = n.titleEn || n.title || '';
        return notifTranslations.get(src) || src;
    };
    const getNotifMessage = (n: any) => {
        if (locale === 'ko') return n.message;
        const src = n.messageEn || n.message || '';
        return notifTranslations.get(src) || src;
    };

    const NAV_LINKS = [
        { href: '/', label: t('nav.mapExplore', locale) },
        { href: '/saved', label: t('nav.favorites', locale) },
        { href: '/compare', label: t('compare.title', locale) },
        { href: '/plans', label: t('nav.myPlans', locale) },
        { href: '/collections', label: t('nav.myCollections', locale) },
        { href: '/blog', label: t('nav.mmStory', locale) },
        { href: '/artworks', label: t('nav.artworks', locale) },
    ];

    const closeMobile = () => {
        if (!mobileOpen || mobileClosing) return;
        setMobileClosing(true);
        setTimeout(() => { setMobileOpen(false); setMobileClosing(false); }, 250);
    };

    const rememberSettingsReturn = () => {
        if (typeof window === 'undefined') return;
        try {
            sessionStorage.setItem('mm_settings_return_to', pathname || '/');
        } catch { /* ignore */ }
    };

    // Close transient header UI only when the route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { closeMobile(); setLangOpen(false); setUserMenuOpen(false); setNotifOpen(false); }, [pathname]);

    useEffect(() => {
        if (!mobileOpen) return;
        const handler = (e: MouseEvent) => {
            if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) setMobileOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [mobileOpen]);

    useEffect(() => {
        if (!langOpen) return;
        const handler = (e: MouseEvent) => {
            const t = e.target as Node;
            if (langRef.current?.contains(t)) return;
            const panel = document.getElementById('lang-popover-panel');
            if (panel?.contains(t)) return;
            setLangOpen(false);
        };
        // 다음 틱에 등록 — 버튼 클릭 자체가 외부로 인식되지 않도록
        const tid = setTimeout(() => document.addEventListener('mousedown', handler), 0);
        return () => { clearTimeout(tid); document.removeEventListener('mousedown', handler); };
    }, [langOpen]);

    // 드롭다운 위치 계산 (열릴 때 / 스크롤·리사이즈 시)
    useLayoutEffect(() => {
        if (!langOpen) { setLangPopoverStyle(null); return; }
        const update = () => {
            const rect = langBtnRef.current?.getBoundingClientRect();
            if (!rect) return;
            const popupWidth = 140;
            const left = Math.max(8, Math.min(rect.right - popupWidth, window.innerWidth - popupWidth - 8));
            setLangPopoverStyle({ top: rect.bottom + 4, left });
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [langOpen]);

    useEffect(() => {
        if (!notifOpen) return;
        const handler = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [notifOpen]);

    useEffect(() => {
        if (!userMenuOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (userMenuRef.current?.contains(target)) return;
            const panel = document.getElementById('user-menu-popover-panel');
            if (panel?.contains(target)) return;
            setUserMenuOpen(false);
        };
        const tid = setTimeout(() => document.addEventListener('mousedown', handler), 0);
        return () => { clearTimeout(tid); document.removeEventListener('mousedown', handler); };
    }, [userMenuOpen]);

    useLayoutEffect(() => {
        if (!userMenuOpen) { setUserMenuStyle(null); return; }
        const update = () => {
            const rect = userMenuBtnRef.current?.getBoundingClientRect();
            if (!rect) return;
            const popupWidth = 192;
            const left = Math.max(8, Math.min(rect.right - popupWidth, window.innerWidth - popupWidth - 8));
            setUserMenuStyle({ top: rect.bottom + 8, left });
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [userMenuOpen]);

    // Fetch notifications (broadcast + user-specific, works for guests too)
    useEffect(() => {
        fetch('/api/notifications')
            .then(res => {
                if (!res.ok) return [];
                return res.text().then(text => text ? JSON.parse(text) : []);
            })
            .then(data => {
                if (Array.isArray(data)) {
                    setNotifications(data);
                } else {
                    setNotifications([]);
                }
            })
            .catch(err => {
                console.error('Failed to fetch notifications:', err);
                setNotifications([]);
            });
    }, [session]);

    // Scroll direction: hide header on scroll down, show on scroll up
    // On detail pages (mobile/tablet only), header hides more aggressively
    const [headerHidden, setHeaderHidden] = useState(false);
    const lastScrollY = useRef(0);
    const isDetailPage = (pathname?.startsWith('/museums/') || pathname?.startsWith('/artworks/') || (pathname?.startsWith('/blog/') && pathname !== '/blog')) ?? false;

    useEffect(() => {
        const onScroll = () => {
            const y = window.scrollY;
            // On detail pages (mobile/tablet), use lower threshold for snappier hide
            const isNarrow = window.innerWidth < 1280; // below xl breakpoint
            const threshold = (isDetailPage && isNarrow) ? 30 : 100;
            if (y < threshold) { setHeaderHidden(false); lastScrollY.current = y; return; }
            if (y > lastScrollY.current + 10) setHeaderHidden(true);
            else if (y < lastScrollY.current - 10) setHeaderHidden(false);
            lastScrollY.current = y;
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [isDetailPage]);

    const isStandaloneDetailRoute = pathname?.startsWith('/museums/')
        || pathname?.startsWith('/artworks/')
        || (pathname?.startsWith('/blog/') && pathname !== '/blog');

    const isHeaderlessEditorialRoute = pathname === '/saved'
        || pathname === '/blog'
        || pathname?.startsWith('/blog/')
        || pathname === '/artworks'
        || pathname?.startsWith('/artworks/')
        || pathname?.startsWith('/museums/')
        || pathname === '/collections'
        || pathname?.startsWith('/collections/')
        || pathname === '/plans'
        || pathname?.startsWith('/plans/')
        || pathname === '/compare'
        || pathname === '/settings'
        || pathname === '/profile'
        || pathname === '/admin'
        || pathname === '/login'
        || pathname === '/notifications'
        || pathname?.startsWith('/notifications/')
        || pathname === '/privacy'
        || pathname === '/terms'
        || pathname === '/cookies'
        || pathname === '/info'
        || pathname === '/feedback';

    if (!isDesktopViewport && (isStandaloneDetailRoute || isMapMobileHome || isHeaderlessEditorialRoute)) return null;

    return (
        <>
            <header className={`sticky top-0 z-50 w-full glass-nav app-header transition-transform duration-300 ease-in-out ${pathname === '/' ? 'max-md:hidden mm-map-home-header' : ''} ${headerHidden ? '-translate-y-full' : 'translate-y-0'}`}>
                <div className="w-full xl:max-w-screen-xl xl:mx-auto flex h-14 items-center gap-2 lg:gap-4 px-3 lg:px-8">
                    <Link href="/" className="font-bold text-lg flex items-center gap-1.5 shrink-0 dark:text-white">
                        <svg viewBox="0 0 510 286" className="h-4 w-auto fill-current lg:h-4" aria-label="Museum Map"><path d="M45.69,238.06v-50.84c0-7.74,5.24-14.49,12.73-16.41l44.69-11.47c16.99-4.36,16.97-28.5-.03-32.83l-44.64-11.37c-7.51-1.91-12.76-8.67-12.76-16.42v-50.76c0-9.36,7.59-16.94,16.94-16.94h165.97c9.36,0,16.94,7.59,16.94,16.94v16.51c0,9.36-7.59,16.94-16.94,16.94h-.33c-19.94,0-23.5,28.44-4.18,33.37l8.7,2.22c7.51,1.91,12.76,8.67,12.76,16.42v19.27c0,7.75-5.26,14.51-12.77,16.42l-8.43,2.14c-19.33,4.91-15.77,33.37,4.18,33.37h.08c9.36,0,16.94,7.59,16.94,16.94v16.51c0,9.36-7.59,16.94-16.94,16.94H62.63c-9.36,0-16.94-7.59-16.94-16.94Z" /><path d="M464.31,47.94v50.85c0,7.73-5.23,14.48-12.72,16.41l-44.5,11.47c-16.97,4.37-16.95,28.48.03,32.83l44.45,11.37c7.5,1.92,12.75,8.68,12.75,16.42v50.78c0,9.36-7.59,16.94-16.94,16.94h-165.21c-9.36,0-16.94-7.59-16.94-16.94v-16.51c0-9.36,7.59-16.94,16.94-16.94h.25c19.93,0,23.51-28.42,4.2-33.36l-8.64-2.21c-7.5-1.92-12.75-8.68-12.75-16.42v-19.3c0-7.74,5.25-14.5,12.75-16.42l8.38-2.14c19.31-4.93,15.74-33.36-4.19-33.36h0c-9.36,0-16.94-7.59-16.94-16.94v-16.51c0-9.36,7.59-16.94,16.94-16.94h165.21c9.36,0,16.94,7.59,16.94,16.94Z" /></svg>
                        <span className="mm-brand-word hidden sm:inline">Museum Map</span>
                    </Link>

                    <nav className="hidden lg:flex items-center gap-6 text-sm font-medium">
                        {NAV_LINKS.map(link => {
                            const isGuest = !session || session?.user?.name?.startsWith('guest_');
                            const isProtectedRoute = ['/saved', '/plans', '/collections', '/compare'].includes(link.href);

                            const handleDesktopClick = (e: React.MouseEvent) => {
                                if (isGuest && isProtectedRoute) {
                                    e.preventDefault();
                                    setLoginCallbackUrl(link.href);
                                    setLoginModalOpen(true);
                                }
                            };

                            return (
                                <a
                                    key={link.href}
                                    href={link.href}
                                    onClick={handleDesktopClick}
                                    className={`relative transition-colors hover:text-blue-700 dark:hover:text-blue-300 ${pathname === link.href
                                        ? 'text-blue-700 dark:text-blue-300'
                                        : 'text-gray-500 dark:text-gray-400'
                                        }`}
                                >
                                    {link.label}
                                </a>
                            );
                        })}
                    </nav>

                    <div className="ml-auto flex items-center space-x-2 sm:space-x-3">
                        {/* Notification — visible on all screens */}
                        <div className="relative" ref={notifRef}>
                            <Link
                                href="/notifications"
                                className="lg:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-gray-500 dark:text-gray-400 relative focus:outline-none focus:ring-2 focus:ring-blue-500"
                                title={t('notif.title', locale)}
                                aria-label={t('notif.title', locale)}
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                {Array.isArray(notifications) && notifications.some(n => !n.isRead) && (
                                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-neutral-900" />
                                )}
                            </Link>
                            <button
                                onClick={() => setNotifOpen(!notifOpen)}
                                className="hidden lg:flex p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-gray-500 dark:text-gray-400 relative focus:outline-none focus:ring-2 focus:ring-blue-500"
                                title={t('notif.title', locale)}
                                aria-label={t('notif.title', locale)}
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                {Array.isArray(notifications) && notifications.some(n => !n.isRead) && (
                                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-neutral-900" />
                                )}
                            </button>
                            {notifOpen && (
                                <div className="absolute right-[-8px] top-full mt-1 glass-popup gradient-border rounded-2xl py-0 min-w-[300px] max-w-[350px] z-50 overflow-hidden mx-4" style={{ boxShadow: 'var(--glass-shadow-lg)' }}>
                                    <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-700 flex items-center justify-between">
                                        <span className="text-sm font-bold dark:text-white">{t('notif.title', locale)}</span>
                                        {notifications.length > 0 && (
                                            <button
                                                onClick={() => {
                                                    fetch('/api/notifications/read-all', { method: 'POST' })
                                                        .then(() => setNotifications(prev => prev.map(n => ({ ...n, isRead: true }))));
                                                }}
                                                className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline"
                                            >
                                                {t('notif.markAllRead', locale)}
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-[400px] overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="px-4 py-10 text-center">
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{t('notif.noNew', locale)}</p>
                                            </div>
                                        ) : (
                                            notifications.map(n => (
                                                <div
                                                    key={n.id}
                                                    className={`px-4 py-3 border-b last:border-0 border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${!n.isRead ? 'bg-blue-50/70 dark:bg-blue-900/30' : ''}`}
                                                    onClick={() => {
                                                        if (!n.isRead) {
                                                            fetch(`/api/notifications/${n.id}/read`, { method: 'POST' });
                                                            setNotifications(prev => prev.map(notif => notif.id === n.id ? { ...notif, isRead: true } : notif));
                                                        }
                                                        setNotifOpen(false);
                                                        window.location.href = '/notifications';
                                                    }}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className={`w-2 h-2 shrink-0 rounded-full mt-1.5 ${!n.isRead ? 'bg-blue-500' : 'bg-transparent'}`} />
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-gray-900 dark:text-white mb-0.5">{getNotifTitle(n)}</p>
                                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{getNotifMessage(n)}</p>
                                                            <p className="text-[9px] text-gray-400 dark:text-neutral-600 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {activeTrip && !activeTrip.pending && (
                            <button
                                type="button"
                                onClick={() => { if (typeof window !== 'undefined') window.location.assign('/?trip=active'); }}
                                className="hidden lg:inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 shadow-sm shadow-blue-500/10 transition-all hover:bg-blue-100 active:scale-95 dark:border-blue-500/20 dark:bg-blue-500/12 dark:text-blue-300"
                                aria-label={locale === 'ko' ? '여행 경로 보기' : 'View active trip route'}
                            >
                                <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_0_4px_rgba(37,99,235,0.14)]" />
                                {locale === 'ko' ? '여행 중' : 'On trip'}
                            </button>
                        )}

                        {/* Dark mode toggle - desktop only */}
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className="hidden lg:flex p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-gray-500 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            title={darkMode ? t('theme.light', locale) : t('theme.dark', locale)}
                            aria-label={darkMode ? t('theme.light', locale) : t('theme.dark', locale)}
                        >
                            {darkMode ? (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                </svg>
                            )}
                        </button>

                        {/* Settings icon - PC only (gear) */}
                        <a
                            href="/settings"
                            onClick={rememberSettingsReturn}
                            className="hidden lg:flex p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-gray-500 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            title={locale === 'ko' ? '설정' : 'Settings'}
                            aria-label={locale === 'ko' ? '설정' : 'Settings'}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </a>

                        {/* Language dropdown */}
                        <div className="relative" ref={langRef}>
                            <button
                                ref={langBtnRef}
                                onClick={() => setLangOpen(!langOpen)}
                                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                            >
                                {LOCALE_NAMES[locale]}
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>

                        {/* Auth UI */}
                        {session ? (
                            <div className="flex items-center gap-2">
                                {/* Admin button - left of profile */}
                                {(session.user as any)?.role === 'ADMIN' && (
                                    <Link
                                        href="/admin"
                                        className="p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-blue-600 dark:text-blue-400"
                                        title="Admin"
                                    >
                                        <span className="w-5 h-5 flex items-center justify-center font-black text-sm">A</span>
                                    </Link>
                                )}
                                {/* Guest: just Login button / User: profile icon with menu */}
                                {session.user?.name?.startsWith('guest_') ? (
                                    <a
                                        href="/login"
                                        className="px-4 py-1.5 rounded-full gradient-btn text-xs font-bold shadow-sm active:scale-95 transition-all"
                                    >
                                        {t('login.title', locale) || 'Login'}
                                    </a>
                                ) : (
                                    <div className="relative" ref={userMenuRef}>
                                        <button
                                            ref={userMenuBtnRef}
                                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                                            className="flex items-center ring-2 ring-transparent hover:ring-blue-500 rounded-full transition-all"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold text-xs overflow-hidden">
                                                {session.user?.image ? (
                                                    <img src={session.user.image} alt={session.user.name || 'User'} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span>{session.user?.name ? session.user.name.charAt(0).toUpperCase() : 'U'}</span>
                                                )}
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <a
                                href="/login"
                                className="px-4 py-1.5 rounded-full gradient-btn text-xs font-bold shadow-sm active:scale-95 transition-all"
                            >
                                {t('login.title', locale) || 'Login'}
                            </a>
                        )}

                        <button
                            className="lg:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                            onClick={() => setMobileOpen(prev => !prev)}
                            aria-label="Toggle menu"
                        >
                            <svg className="w-6 h-6 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                {mobileOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile drawer */}
            {mobileOpen && (
                <div className="fixed inset-0 z-[9999] lg:hidden">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" style={{ animation: mobileClosing ? 'fadeOut 200ms ease-out forwards' : 'fadeIn 200ms ease-out' }} onClick={closeMobile} />
                    <div
                        ref={drawerRef}
                        className="absolute top-0 right-0 h-full w-72 shadow-2xl flex flex-col"
                        style={{ animation: mobileClosing ? 'slideOutRight 250ms ease-in forwards' : 'slideInRight 250ms ease-out', background: 'var(--glass-bg-heavy)', backdropFilter: 'blur(24px) saturate(200%)', WebkitBackdropFilter: 'blur(24px) saturate(200%)' }}
                    >
                        {/* Gradient accent on left edge */}
                        <div className="absolute top-0 left-0 w-[2px] h-full" style={{ background: 'var(--gradient-blue-orange)' }} />
                        <div className="flex items-center justify-between p-4 border-b dark:border-neutral-800">
                            <span className="font-bold text-lg dark:text-white">{t('nav.menu', locale)}</span>
                            <button onClick={closeMobile} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                                <svg className="w-5 h-5 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <nav className="flex-1 p-4 space-y-1">
                            {NAV_LINKS.map(link => {
                                const isGuest = !session || session?.user?.name?.startsWith('guest_');
                                const isProtectedRoute = ['/saved', '/plans', '/collections', '/compare'].includes(link.href);

                                    const handleDrawerClick = (e: React.MouseEvent) => {
                                        if (isGuest && isProtectedRoute) {
                                            e.preventDefault();
                                            closeMobile();
                                            setLoginCallbackUrl(link.href);
                                            setLoginModalOpen(true);
                                        }
                                    };

                                    return (
                                        <a
                                            key={link.href}
                                            href={link.href}
                                            onClick={handleDrawerClick}
                                            className={`block px-4 py-3 rounded-xl text-sm font-medium transition-all ${pathname === link.href
                                            ? 'gradient-btn !rounded-xl shadow-lg shadow-blue-500/18'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-white/40 dark:hover:bg-white/10'
                                            }`}
                                    >
                                        {link.label}
                                    </a>
                                );
                            })}
                        </nav>



                        {/* Mobile profile/admin/settings */}
                        <div className="px-4 py-2">
                            {session && !session.user?.name?.startsWith('guest_') && (
                                <Link
                                    href="/profile"
                                    onClick={() => setMobileOpen(false)}
                                    className="mb-1 flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-all"
                                >
                                    <span className="h-8 w-8 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-semibold text-blue-700 dark:text-blue-300">
                                        {session.user?.image ? <img src={session.user.image} alt="" className="h-full w-full object-cover" /> : (session.user?.name?.charAt(0).toUpperCase() || 'U')}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate">
                                        {session.user?.name || (locale === 'ko' ? '프로필' : 'Profile')}
                                    </span>
                                </Link>
                            )}
                            {(session?.user as any)?.role === 'ADMIN' && (
                                <Link
                                    href="/admin"
                                    onClick={() => setMobileOpen(false)}
                                    className="mb-1 flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                                >
                                    <span className="flex h-5 w-5 items-center justify-center rounded-md border border-blue-200 text-[11px] font-semibold dark:border-blue-800">A</span>
                                    Admin
                                </Link>
                            )}
                            <a
                                href="/settings"
                                onClick={() => { rememberSettingsReturn(); setMobileOpen(false); }}
                                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-all"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {(() => { const s: Record<string, string> = { ko: '설정', en: 'Settings', ja: '設定', de: 'Einstellungen', fr: 'Paramètres', es: 'Ajustes', pt: 'Configurações', 'zh-CN': '设置', 'zh-TW': '設定', da: 'Indstillinger', fi: 'Asetukset', sv: 'Inställningar', et: 'Seaded' }; return s[locale] || s['en']; })()}
                            </a>
                        </div>

                        {/* Mobile language selector */}
                        <div className="px-4 pb-2">
                            <select
                                value={locale}
                                onChange={e => setLocale(e.target.value as Locale)}
                                className="block w-full box-border px-4 py-2.5 rounded-xl text-xs border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-300"
                            >
                                {(Object.keys(LOCALE_NAMES) as Locale[]).map(l => (
                                    <option key={l} value={l}>{LOCALE_NAMES[l]}</option>
                                ))}
                            </select>
                        </div>

                        <div className="p-4 border-t dark:border-neutral-800 space-y-1">
                            {session?.user?.name?.startsWith('guest_') && (
                                <a
                                    href="/login"
                                    onClick={() => setMobileOpen(false)}
                                    className="block w-full px-4 py-3 rounded-xl text-sm font-bold text-center text-white gradient-btn active:scale-95 transition-all mb-2"
                                >
                                    <span className="inline-flex items-center gap-1.5">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                                        </svg>
                                        {t('login.title', locale) || 'Login'}
                                    </span>
                                </a>
                            )}
                            <button
                                onClick={() => setDarkMode(!darkMode)}
                                className="block w-full px-4 py-3 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-all text-left"
                            >
                                <span className="inline-flex items-center gap-1.5">
                                    {darkMode ? (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                        </svg>
                                    )}
                                    {darkMode ? t('theme.light', locale) : t('theme.dark', locale)}
                                </span>
                            </button>

                            {/* Delete account - only for non-admin authenticated users */}
                            {session && (session.user as any)?.role !== 'ADMIN' && !session.user?.name?.startsWith('guest_') && (
                                <button
                                    onClick={() => {
                                        setMobileOpen(false);
                                        const deleteLabels: Record<string, { title: string; confirm: string; done: string; fail: string }> = {
                                            ko: { title: '회원 탈퇴', confirm: '계정을 탈퇴할까요?\n내 픽, 컬렉션, 여행 계획이 모두 삭제되며\n복구할 수 없어요.', done: '회원 탈퇴가 완료됐어요.\n이용해 주셔서 감사합니다.', fail: '회원 탈퇴를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.' },
                                            en: { title: 'Delete Account', confirm: 'Are you sure you want to delete your account?\nAll your saves, collections, and plans will be permanently removed.', done: 'Your account has been deleted.\nThank you for using Museum Map.', fail: 'Failed to delete account.' },
                                            ja: { title: 'アカウント削除', confirm: '本当にアカウントを削除しますか？\nお気に入り、コレクション、旅行プランがすべて削除されます。', done: 'アカウントが削除されました。\nご利用ありがとうございました。', fail: 'アカウント削除に失敗しました。' },
                                            de: { title: 'Konto löschen', confirm: 'Möchten Sie Ihr Konto wirklich löschen?\nAlle Favoriten, Sammlungen und Pläne werden dauerhaft entfernt.', done: 'Ihr Konto wurde gelöscht.\nVielen Dank für die Nutzung.', fail: 'Konto konnte nicht gelöscht werden.' },
                                            fr: { title: 'Supprimer le compte', confirm: 'Êtes-vous sûr de vouloir supprimer votre compte ?\nTous vos favoris, collections et plans seront supprimés.', done: 'Votre compte a été supprimé.\nMerci d\'avoir utilisé Museum Map.', fail: 'Échec de la suppression du compte.' },
                                            es: { title: 'Eliminar cuenta', confirm: '¿Seguro que quieres eliminar tu cuenta?\nTodos tus favoritos, colecciones y planes serán eliminados.', done: 'Tu cuenta ha sido eliminada.\nGracias por usar Museum Map.', fail: 'Error al eliminar la cuenta.' },
                                            pt: { title: 'Excluir conta', confirm: 'Tem certeza de que deseja excluir sua conta?\nTodos os seus favoritos, coleções e planos serão removidos.', done: 'Sua conta foi excluída.\nObrigado por usar o Museum Map.', fail: 'Falha ao excluir a conta.' },
                                            'zh-CN': { title: '删除账户', confirm: '确定要删除账户吗？\n所有收藏、合集和旅行计划\n将被永久删除。', done: '账户已删除。\n感谢使用 Museum Map。', fail: '删除账户失败。' },
                                            'zh-TW': { title: '刪除帳戶', confirm: '確定要刪除帳戶嗎？\n所有收藏、合集和旅行計劃\n將被永久刪除。', done: '帳戶已刪除。\n感謝使用 Museum Map。', fail: '刪除帳戶失敗。' },
                                            da: { title: 'Slet konto', confirm: 'Er du sikker på, at du vil slette din konto?\nAlle dine favoritter, samlinger og planer slettes permanent.', done: 'Din konto er blevet slettet.\nTak fordi du brugte Museum Map.', fail: 'Kunne ikke slette kontoen.' },
                                            fi: { title: 'Poista tili', confirm: 'Haluatko varmasti poistaa tilisi?\nKaikki suosikkisi, kokoelmasi ja suunnitelmasi poistetaan pysyvästi.', done: 'Tilisi on poistettu.\nKiitos Museum Mapin käytöstä.', fail: 'Tilin poistaminen epäonnistui.' },
                                            sv: { title: 'Radera konto', confirm: 'Är du säker på att du vill radera ditt konto?\nAlla dina favoriter, samlingar och planer raderas permanent.', done: 'Ditt konto har raderats.\nTack för att du använde Museum Map.', fail: 'Kunde inte radera kontot.' },
                                            et: { title: 'Kustuta konto', confirm: 'Kas olete kindel, et soovite oma konto kustutada?\nKõik teie lemmikud, kogud ja plaanid kustutatakse jäädavalt.', done: 'Teie konto on kustutatud.\nTäname, et kasutasite Museum Mapi.', fail: 'Konto kustutamine ebaõnnestus.' },
                                        };
                                        const dl = deleteLabels[locale] || deleteLabels['en'];
                                        showConfirm(dl.confirm, async () => {
                                            try {
                                                const res = await fetch('/api/auth/delete-account', { method: 'DELETE' });
                                                if (res.ok) {
                                                    showAlert(dl.done);
                                                    setTimeout(() => {
                                                        clearClientAccountStateForLogout();
                                                        signOut({ callbackUrl: '/login' });
                                                    }, 1500);
                                                } else {
                                                    showAlert(dl.fail);
                                                }
                                            } catch {
                                                showAlert(dl.fail);
                                            }
                                        }, dl.title);
                                    }}
                                    className="block w-full px-4 py-2 text-[11px] text-gray-400 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 transition-colors text-left"
                                >
                                    {(() => {
                                        const dtl: Record<string, string> = {
                                            ko: '회원 탈퇴', en: 'Delete Account', ja: 'アカウント削除',
                                            de: 'Konto löschen', fr: 'Supprimer le compte', es: 'Eliminar cuenta',
                                            pt: 'Excluir conta', 'zh-CN': '删除账户', 'zh-TW': '刪除帳戶',
                                            da: 'Slet konto', fi: 'Poista tili', sv: 'Radera konto', et: 'Kustuta konto',
                                        };
                                        return dtl[locale] || dtl['en'];
                                    })()}
                                </button>
                            )}
                        </div>

                        <style jsx global>{`
                            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                            @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
                            @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
                            @keyframes slideOutRight { from { transform: translateX(0); } to { transform: translateX(100%); } }
                        `}</style>
                    </div>
                </div>
            )}
            {/* Login Required Modal */}
            <LoginRequiredModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} callbackUrl={loginCallbackUrl} />
            {/* Language popover (portal) */}
            {langOpen && langPopoverStyle && typeof document !== 'undefined' && createPortal(
                <div
                    id="lang-popover-panel"
                    className="glass-popup gradient-border rounded-xl py-1 min-w-[140px]"
                    style={{
                        position: 'fixed',
                        top: langPopoverStyle.top,
                        left: langPopoverStyle.left,
                        zIndex: 9999,
                        boxShadow: 'var(--glass-shadow-lg)',
                    }}
                >
                    {(Object.keys(LOCALE_NAMES) as Locale[]).map(l => (
                        <button
                            key={l}
                            onClick={() => { setLocale(l); setLangOpen(false); }}
                            className={`block w-full text-left px-4 py-2 text-sm hover:bg-blue-50/80 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:bg-blue-50 dark:focus-visible:bg-neutral-800 transition-colors ${l === locale ? 'font-bold text-black dark:text-white bg-blue-50/50 dark:bg-neutral-800/70' : 'text-gray-700 dark:text-gray-300'}`}
                        >
                            {LOCALE_NAMES[l]}
                        </button>
                    ))}
                </div>,
                document.body,
            )}
            {/* User menu popover (portal) */}
            {userMenuOpen && userMenuStyle && session && !session.user?.name?.startsWith('guest_') && typeof document !== 'undefined' && createPortal(
                <div
                    id="user-menu-popover-panel"
                    className="glass-popup gradient-border rounded-xl py-2 w-48"
                    style={{
                        position: 'fixed',
                        top: userMenuStyle.top,
                        left: userMenuStyle.left,
                        zIndex: 10000,
                        boxShadow: 'var(--glass-shadow-lg)',
                    }}
                >
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-neutral-700 mb-1">
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{session.user?.name}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{session.user?.email}</p>
                    </div>
                    <Link
                        href="/profile"
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/25 transition-colors focus-visible:outline-none focus-visible:bg-blue-50 dark:focus-visible:bg-blue-900/25"
                    >
                        {locale === 'ko' ? '프로필' : 'Profile'}
                    </Link>
                    <button
                        onClick={() => {
                            clearClientAccountStateForLogout();
                            try { sessionStorage.setItem('mm-logout-done', '1'); } catch { }
                            signOut({ callbackUrl: '/' });
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/35 transition-colors focus-visible:outline-none focus-visible:bg-red-50 dark:focus-visible:bg-red-900/35"
                    >
                        {t('auth.logout', locale)}
                    </button>
                </div>,
                document.body,
            )}
        </>
    );
}
