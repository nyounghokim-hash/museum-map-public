'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import { t, formatDate, type Locale } from '@/lib/i18n';
import { useTranslatedTexts } from '@/hooks/useTranslation';
import LoadingAnimation from '@/components/ui/LoadingAnimation';

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { locale } = useApp();
    const router = useRouter();

    useEffect(() => {
        fetch('/api/notifications')
            .then(r => r.json())
            .then(data => {
                setNotifications(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    // Collect all translatable texts (use English version if available, otherwise Korean)
    const textsToTranslate = notifications.flatMap(n => [
        n.titleEn || n.title || '',
        n.messageEn || n.message || ''
    ]);
    const translations = useTranslatedTexts(textsToTranslate, locale as Locale);

    const getTitle = (n: any) => {
        if (locale === 'ko') return n.title;
        const src = n.titleEn || n.title || '';
        return translations.get(src) || src;
    };
    const getMessage = (n: any) => {
        if (locale === 'ko') return n.message;
        const src = n.messageEn || n.message || '';
        return translations.get(src) || src;
    };

    const markAllRead = () => {
        fetch('/api/notifications/read-all', { method: 'POST' })
            .then(() => setNotifications(prev => prev.map(n => ({ ...n, isRead: true }))));
    };

    const markRead = (id: string) => {
        fetch(`/api/notifications/${id}/read`, { method: 'POST' });
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <LoadingAnimation size={160} />
        </div>
    );

    return (
        <>
            {/* Floating back button — OUTSIDE animated wrapper to keep fixed positioning */}
            <button
                onClick={() => router.back()}
                className="lg:hidden fixed bottom-8 right-8 z-50 w-14 h-14 flex items-center justify-center rounded-full bg-neutral-800/90 dark:bg-white/90 backdrop-blur-md text-white dark:text-gray-800 shadow-lg border border-neutral-700/60 dark:border-gray-200/60 active:scale-95 transition-all hover:bg-neutral-700 dark:hover:bg-gray-100 animate-fadeIn"
                aria-label="Back"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
            </button>
            <div className="w-full max-w-[1080px] mx-auto px-4 py-4 sm:px-6 sm:py-8 md:px-8 mt-4 sm:mt-8 animate-slideInDown">
                <div className="flex items-center justify-between mb-6 sm:mb-8">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold dark:text-white">
                            {t('notif.title', locale)}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                            {unreadCount > 0
                                ? `${unreadCount} ${t('notif.unreadCount', locale)}`
                                : t('notif.allCaughtUp', locale)}
                        </p>
                    </div>
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllRead}
                            className="px-4 py-2 text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                        >
                            {t('notif.markAllRead', locale)}
                        </button>
                    )}
                </div>

                {notifications.length === 0 ? (
                    <div className="py-20 text-center">
                        <div className="text-6xl mb-4">
                            <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                            {t('notif.empty', locale)}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                            {t('notif.emptyDesc', locale)}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {notifications.map(n => (
                            <Link
                                key={n.id}
                                href={`/notifications/${n.id}`}
                                onClick={() => { if (!n.isRead) markRead(n.id); }}
                                className={`block rounded-2xl border shadow-sm transition-all hover:shadow-md active:scale-[0.99] ${!n.isRead
                                    ? 'bg-purple-50/50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-800/30'
                                    : 'border'}`}
                                style={n.isRead ? { background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' } : undefined}
                            >
                                <div className="p-4 sm:p-5 flex items-center gap-3">
                                    <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${!n.isRead ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-gray-100 dark:bg-neutral-800'}`}>
                                        <svg className={`w-5 h-5 ${!n.isRead ? 'text-purple-500 dark:text-purple-400' : 'text-gray-400 dark:text-neutral-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1" style={{ wordBreak: 'break-word' }}>
                                            {getTitle(n)}
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed" style={{ wordBreak: 'break-word' }}>
                                            {getMessage(n)}
                                        </p>
                                        <span className="text-[10px] text-gray-400 dark:text-neutral-600 mt-2 block font-medium">
                                            {formatDate(n.createdAt, locale)}
                                        </span>
                                    </div>
                                    <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
