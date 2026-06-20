'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/components/AppContext';
import { formatDate, t, type Locale } from '@/lib/i18n';
import { useTranslatedTexts } from '@/hooks/useTranslation';
import LoadingAnimation from '@/components/ui/LoadingAnimation';
import { backWithFallback } from '@/lib/route-pending';

export default function NotificationDetailPage() {
    const { id } = useParams();
    const [notification, setNotification] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const { locale } = useApp();

    useEffect(() => {
        // Fetch all notifications and find current one
        fetch('/api/notifications')
            .then(r => r.json())
            .then(data => {
                const all = Array.isArray(data) ? data : [];
                const found = all.find((n: any) => n.id === id);
                setNotification(found || null);
                setLoading(false);

                // Mark as read
                if (found && !found.isRead) {
                    fetch(`/api/notifications/${id}/read`, { method: 'POST' });
                }
            })
            .catch(() => setLoading(false));
    }, [id]);

    // Translate title and message
    const srcTitle = notification ? (notification.titleEn || notification.title || '') : '';
    const srcMessage = notification ? (notification.messageEn || notification.message || '') : '';
    const translations = useTranslatedTexts([srcTitle, srcMessage], locale as Locale);

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <LoadingAnimation size={160} />
        </div>
    );

    if (!notification) return (
        <div className="w-full max-w-[1080px] mx-auto px-4 py-20 text-center">
            <div className="w-24 h-24 bg-gray-50 dark:bg-neutral-800/50 rounded-full flex items-center justify-center mb-8 mx-auto">
                <img src="/logo.svg" alt="Museum Map" className="w-16 h-16 opacity-20 dark:invert dark:opacity-[0.6]" />
            </div>
            <h1 className="text-xl font-bold dark:text-white mb-4">
                {t('notif.notFound', locale)}
            </h1>
            <Link href="/notifications" className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-sm">
                ← {t('notif.backToList', locale)}
            </Link>
        </div>
    );

    const title = locale === 'ko' ? notification.title : (translations.get(srcTitle) || srcTitle);
    const message = locale === 'ko' ? notification.message : (translations.get(srcMessage) || srcMessage);

    return (
        <>
            <div className="w-full max-w-[1080px] mx-auto px-4 py-4 sm:px-6 sm:py-8 md:px-8 mt-4 sm:mt-8 page-slide-in">
                <Link
                    href="/notifications"
                    className="hidden lg:inline-flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-6 sm:mb-8 group"
                >
                    <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    {t('notif.list', locale)}
                </Link>

                <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-gray-100 dark:border-neutral-800 shadow-sm overflow-hidden">
                    <div className="p-6 sm:p-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                                    {t('notif.label', locale)}
                                </span>
                                <p className="text-xs text-gray-400 dark:text-neutral-500 font-medium">
                                    {formatDate(notification.createdAt, locale)}
                                </p>
                            </div>
                        </div>

                        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mb-6 leading-tight" style={{ wordBreak: 'break-word' }}>
                            {title}
                        </h1>

                        <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed" style={{ wordBreak: 'break-word' }}>
                            <p className="whitespace-pre-wrap text-sm sm:text-base">{message}</p>
                        </div>

                        {notification.link && (
                            <div className="mt-8 pt-6 border-t dark:border-neutral-800">
                                <a
                                    href={notification.link}
                                    className="inline-flex items-center gap-2 px-6 py-3 gradient-btn text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all"
                                >
                                    {t('notif.goToLink', locale)}
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile/Tablet: Floating back button */}
            <div className="lg:hidden fixed bottom-8 right-8 z-[9998] flex flex-col gap-2">
                <button
                    onClick={() => backWithFallback('/notifications', locale)}
                    className="w-14 h-14 flex items-center justify-center rounded-full bg-neutral-800/90 dark:bg-white/90 backdrop-blur-md text-white dark:text-gray-800 shadow-lg border border-neutral-700/60 dark:border-gray-200/60 active:scale-95 transition-all hover:bg-neutral-700 dark:hover:bg-gray-100"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            </div>
        </>
    );
}
