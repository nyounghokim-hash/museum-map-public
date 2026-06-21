'use client';
import { createPortal } from 'react-dom';
import { useApp } from '@/components/AppContext';
import { t } from '@/lib/i18n';
import { backWithFallback } from '@/lib/route-pending';

export default function PrivacyPage() {
    const { locale } = useApp();

    const sections = Array.from({ length: 9 }, (_, i) => i + 1);

    return (
        <div className="mm-legal-page2 mm-library-page2 no-back-swipe w-full max-w-[640px] mx-auto px-4 py-6 sm:px-6 sm:py-10 mt-2 sm:mt-6 animate-fadeInUp">
            <div className="mb-6 sm:mb-8">
                {/* PC: Inline back button */}
                <button onClick={() => backWithFallback('/settings', locale, { timeoutMs: 900, pendingOnFallback: false })} className="hidden lg:flex w-9 h-9 items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-600 dark:text-gray-300 rounded-full mb-4 transition-colors active:scale-95">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h1 className="text-xl sm:text-2xl font-bold dark:text-white">{t('legal.privacyTitle', locale)}</h1>
                <p className="text-gray-400 dark:text-gray-500 mt-1 text-xs">{t('legal.effectiveDate', locale)}</p>
            </div>

            <div className="flex flex-col gap-3 stagger-children">
                {/* Controller */}
                <div className="flex items-start gap-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-xl px-4 py-3.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-100/80 dark:bg-blue-900/20 flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-white">{t('legal.privacyTitle', locale)}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t('legal.privacyController', locale)}</p>
                    </div>
                </div>

                {/* Sections */}
                {sections.map(i => (
                    <div key={i} className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-xl px-4 py-3.5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-gray-400 dark:text-gray-500">{i}</span>
                            </div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-white">
                                {(t(`legal.privacy.s${i}.title` as any, locale) as string).replace(/^\d+\.\s*/, '')}
                            </p>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 ml-11 leading-relaxed">
                            {t(`legal.privacy.s${i}.content` as any, locale)}
                        </p>
                    </div>
                ))}
            </div>

            {/* Mobile: Floating back — portal to escape transform container */}
            {typeof document !== 'undefined' && createPortal(
                <div className="lg:hidden fixed bottom-8 right-8 z-[9998] flex flex-col gap-2">
                    <button
                        onClick={() => backWithFallback('/settings', locale, { timeoutMs: 900, pendingOnFallback: false })}
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
