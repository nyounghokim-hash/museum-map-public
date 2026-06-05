'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const TEXTS: Record<string, { title: string; subtitle: string; home: string }> = {
    ko: { title: '페이지를 찾지 못했어요', subtitle: '주소가 바뀌었거나 삭제된 페이지일 수 있어요.', home: '홈으로 돌아가기' },
    en: { title: 'Page not found', subtitle: 'Please wait a moment!', home: 'Back to Home' },
    ja: { title: 'ページが見つかりません', subtitle: '少々お待ちください！', home: 'ホームへ戻る' },
    de: { title: 'Seite nicht gefunden', subtitle: 'Bitte warten Sie einen Moment!', home: 'Zurück zur Startseite' },
    fr: { title: 'Page introuvable', subtitle: 'Veuillez patienter !', home: "Retour à l'accueil" },
    es: { title: 'Página no encontrada', subtitle: '¡Espere un momento!', home: 'Volver al inicio' },
    pt: { title: 'Página não encontrada', subtitle: 'Aguarde um momento!', home: 'Voltar ao início' },
    'zh-CN': { title: '页面未找到', subtitle: '请稍等！', home: '返回首页' },
    'zh-TW': { title: '頁面未找到', subtitle: '請稍等！', home: '返回首頁' },
    da: { title: 'Siden blev ikke fundet', subtitle: 'Vent venligst!', home: 'Tilbage til forsiden' },
    fi: { title: 'Sivua ei löydy', subtitle: 'Odota hetki!', home: 'Takaisin etusivulle' },
    sv: { title: 'Sidan hittades inte', subtitle: 'Vänta ett ögonblick!', home: 'Tillbaka till startsidan' },
    et: { title: 'Lehte ei leitud', subtitle: 'Palun oodake!', home: 'Tagasi avalehele' },
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

export default function NotFound() {
    const [locale, setLocale] = useState('en');

    useEffect(() => {
        setLocale(detectLocale());
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const raw = window.location.pathname + window.location.search;
        const decoded = decodeURIComponent(raw);
        const match = decoded.match(/https?:\/\/(?:www\.)?museummap\.app(\/[^?#]*)?(\?[^#]*)?/i);
        if (!match) return;
        const nextPath = `${match[1] || '/'}${match[2] || ''}`;
        if (nextPath !== raw) window.location.replace(nextPath);
    }, []);

    const txt = TEXTS[locale] || TEXTS.en;

    return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-20 text-center">
            <svg className="w-24 h-24 text-blue-400 dark:text-blue-500 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-3">
                {txt.title}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base mb-2">
                {txt.subtitle}
            </p>

            <div className="mt-4 mb-8 px-4 py-2 rounded-full bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700">
                <span className="text-xs font-mono font-bold text-gray-400 dark:text-gray-500 tracking-wider">
                    ERROR 404 — PAGE NOT FOUND
                </span>
            </div>

            <Link
                href="/"
                className="px-6 py-3 rounded-xl gradient-btn text-white text-sm font-bold shadow-md active:scale-95 transition-all"
            >
                {txt.home}
            </Link>
        </div>
    );
}
