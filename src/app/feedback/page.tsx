'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import { useModal } from '@/components/ui/Modal';
import { t } from '@/lib/i18n';
import LoadingAnimation from '@/components/ui/LoadingAnimation';

export default function FeedbackPage() {
    const { locale } = useApp();
    const router = useRouter();
    const { showAlert } = useModal();
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!message) return;
        setLoading(true);
        try {
            await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: message })
            });
            setSuccess(true);
        } catch (err) {
            showAlert(t('feedback.error', locale) || 'Error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="mm-legal-page2 mm-library-page2 no-back-swipe w-full max-w-[640px] mx-auto px-4 py-6 sm:px-6 sm:py-10 mt-2 sm:mt-6 animate-fadeInUp">
            <div className="mb-6 sm:mb-8">
                <h1 className="text-xl sm:text-2xl font-bold dark:text-white">
                    {t('feedback.title', locale)}
                </h1>
                <p className="text-gray-400 dark:text-gray-500 mt-1 text-xs">
                    {t('feedback.subtitle', locale)}
                </p>
            </div>

            <div className="flex flex-col gap-3 stagger-children">
                {success ? (
                    <div className="flex items-start gap-3 bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20 rounded-xl px-4 py-3.5">
                        <div className="w-8 h-8 rounded-lg bg-green-100/80 dark:bg-green-900/20 flex items-center justify-center shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 dark:text-white">
                                {t('feedback.success', locale)}
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Textarea Card */}
                        <div className="border rounded-xl px-4 py-3.5" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                                    <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                                    </svg>
                                </div>
                                <p className="text-sm font-semibold text-gray-800 dark:text-white">
                                    {t('feedback.title', locale)}
                                </p>
                            </div>
                            <form onSubmit={handleSubmit} className="space-y-3 ml-11">
                                <textarea
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    rows={5}
                                    className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm text-gray-900 dark:text-white p-3 focus:ring-1 focus:ring-blue-400 focus:border-blue-400 dark:focus:ring-blue-500 dark:focus:border-blue-500 resize-none outline-none transition-all"
                                    placeholder={t('feedback.subtitle', locale)}
                                />
                                <button
                                    type="submit"
                                    disabled={loading || !message}
                                    className="w-full py-2.5 gradient-btn text-white text-sm font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading && <LoadingAnimation size={20} className="brightness-150 dark:brightness-0" />}
                                    {loading ? t('feedback.sending', locale) : t('feedback.send', locale)}
                                </button>
                            </form>
                        </div>
                    </>
                )}

                {/* Terms Link */}
                <Link href="/terms" className="block group">
                    <div className="flex items-center gap-3 border rounded-xl px-4 py-3.5 hover:border-gray-300 dark:hover:border-neutral-600 transition-all" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
                        <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-white group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors flex-1">{t('legal.termsTitle', locale)}</p>
                        <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                    </div>
                </Link>

                {/* Privacy Link */}
                <Link href="/privacy" className="block group">
                    <div className="flex items-center gap-3 border rounded-xl px-4 py-3.5 hover:border-gray-300 dark:hover:border-neutral-600 transition-all" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
                        <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                            </svg>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-white group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors flex-1">{t('legal.privacyTitle', locale)}</p>
                        <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                    </div>
                </Link>
            </div>

            {/* Mobile: Floating back — portal to escape transform container */}
            {typeof document !== 'undefined' && createPortal(
                <div className="lg:hidden fixed bottom-8 right-8 z-[9998] flex flex-col gap-2">
                    <button
                        onClick={() => router.back()}
                        className="w-14 h-14 flex items-center justify-center rounded-full bg-neutral-800/90 dark:bg-white/90 backdrop-blur-md text-white dark:text-gray-800 shadow-lg border border-neutral-700/60 dark:border-gray-200/60 active:scale-95 transition-all hover:bg-neutral-700 dark:hover:bg-gray-100"
                        aria-label="Back"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
}
