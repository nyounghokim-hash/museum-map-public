'use client';

import { useEffect, useState } from 'react';

const TEXTS: Record<string, { title: string; subtitle: string; retry: string; home: string }> = {
    ko: { title: '지금 열심히 보수공사 중입니다!', subtitle: '조금만 기다려주세요!', retry: '다시 시도하기', home: '홈으로' },
    en: { title: 'Something went wrong!', subtitle: 'Please wait a moment!', retry: 'Try Again', home: 'Home' },
    ja: { title: '現在メンテナンス中です！', subtitle: '少々お待ちください！', retry: 'もう一度', home: 'ホーム' },
    de: { title: 'Etwas ist schiefgelaufen!', subtitle: 'Bitte warten Sie einen Moment!', retry: 'Erneut versuchen', home: 'Startseite' },
    fr: { title: 'Une erreur est survenue !', subtitle: 'Veuillez patienter !', retry: 'Réessayer', home: 'Accueil' },
    es: { title: '¡Algo salió mal!', subtitle: '¡Espere un momento!', retry: 'Reintentar', home: 'Inicio' },
    pt: { title: 'Algo deu errado!', subtitle: 'Aguarde um momento!', retry: 'Tentar novamente', home: 'Início' },
    'zh-CN': { title: '出了点问题！', subtitle: '请稍等！', retry: '重试', home: '首页' },
    'zh-TW': { title: '出了點問題！', subtitle: '請稍等！', retry: '重試', home: '首頁' },
    da: { title: 'Noget gik galt!', subtitle: 'Vent venligst!', retry: 'Prøv igen', home: 'Hjem' },
    fi: { title: 'Jokin meni pieleen!', subtitle: 'Odota hetki!', retry: 'Yritä uudelleen', home: 'Etusivu' },
    sv: { title: 'Något gick fel!', subtitle: 'Vänta ett ögonblick!', retry: 'Försök igen', home: 'Hem' },
    et: { title: 'Midagi läks valesti!', subtitle: 'Palun oodake!', retry: 'Proovi uuesti', home: 'Avaleht' },
};

function detectLocale(): string {
    if (typeof window === 'undefined') return 'en';
    const saved = localStorage.getItem('locale');
    if (saved && TEXTS[saved]) return saved;
    const lang = navigator.language?.toLowerCase() || '';
    const map: Record<string, string> = {
        ko: 'ko', ja: 'ja', de: 'de', fr: 'fr', es: 'es', pt: 'pt',
        'zh-cn': 'zh-CN', 'zh-tw': 'zh-TW', 'zh-hans': 'zh-CN', 'zh-hant': 'zh-TW', zh: 'zh-CN',
        da: 'da', fi: 'fi', sv: 'sv', et: 'et',
    };
    return map[lang] || map[lang.split('-')[0]] || 'en';
}

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const [locale, setLocale] = useState('en');

    useEffect(() => {
        setLocale(detectLocale());
    }, []);

    useEffect(() => {
        console.error('App Error:', error);
    }, [error]);

    const txt = TEXTS[locale] || TEXTS.en;

    return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-20 text-center">
            <svg className="w-24 h-24 text-yellow-500 dark:text-yellow-400 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-3">
                {txt.title}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base mb-2">
                {txt.subtitle}
            </p>

            <div className="mt-4 mb-8 px-4 py-2 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <span className="text-xs font-mono font-bold text-red-400 dark:text-red-500 tracking-wider">
                    ERROR 500 — INTERNAL SERVER ERROR
                </span>
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={reset}
                    className="px-6 py-3 rounded-xl gradient-btn text-white text-sm font-bold shadow-md active:scale-95 transition-all"
                >
                    {txt.retry}
                </button>
                <a
                    href="/"
                    className="px-6 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-300 text-sm font-bold shadow-sm hover:bg-gray-50 dark:hover:bg-neutral-700 active:scale-95 transition-all"
                >
                    {txt.home}
                </a>
            </div>
        </div>
    );
}
