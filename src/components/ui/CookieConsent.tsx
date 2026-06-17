'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/components/AppContext';
import Link from 'next/link';

const CONSENT_KEY = 'cookie-consent';

const texts: Record<string, { message: string; accept: string; decline: string }> = {
    ko: { message: '이 사이트는 사용자 경험 개선을 위해 쿠키를 사용합니다.', accept: '동의', decline: '거부' },
    en: { message: 'We use cookies to improve your experience.', accept: 'Accept', decline: 'Decline' },
    ja: { message: 'より良い体験のためにCookieを使用しています。', accept: '同意', decline: '拒否' },
    zh: { message: '我们使用Cookie来改善您的体验。', accept: '同意', decline: '拒绝' },
    de: { message: 'Wir verwenden Cookies, um Ihre Erfahrung zu verbessern.', accept: 'Akzeptieren', decline: 'Ablehnen' },
    fr: { message: 'Nous utilisons des cookies pour améliorer votre expérience.', accept: 'Accepter', decline: 'Refuser' },
    es: { message: 'Usamos cookies para mejorar su experiencia.', accept: 'Aceptar', decline: 'Rechazar' },
    pt: { message: 'Usamos cookies para melhorar sua experiência.', accept: 'Aceitar', decline: 'Recusar' },
    da: { message: 'Vi bruger cookies for at forbedre din oplevelse.', accept: 'Acceptér', decline: 'Afvis' },
    fi: { message: 'Käytämme evästeitä parantaaksemme kokemustasi.', accept: 'Hyväksy', decline: 'Hylkää' },
    sv: { message: 'Vi använder cookies för att förbättra din upplevelse.', accept: 'Acceptera', decline: 'Avvisa' },
    et: { message: 'Kasutame küpsiseid teie kogemuse parandamiseks.', accept: 'Nõustu', decline: 'Keeldu' },
};

export default function CookieConsent() {
    const [show, setShow] = useState(false);
    const [closing, setClosing] = useState(false);
    const { locale } = useApp();

    useEffect(() => {
        const consent = localStorage.getItem(CONSENT_KEY);
        if (!consent) {
            const timer = setTimeout(() => setShow(true), 2000);
            return () => clearTimeout(timer);
        }
    }, []);

    const dismiss = (decision: string) => {
        localStorage.setItem(CONSENT_KEY, decision);
        setClosing(true);
        setTimeout(() => setShow(false), 250);
    };

    if (!show) return null;

    const t = texts[locale] || texts.en;

    return (
        <div className="mm-cookie-consent fixed inset-x-0 bottom-0 z-[89] pointer-events-none px-4 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] sm:pb-6">
            <div className={`pointer-events-auto glass-popup gradient-border rounded-2xl p-4 sm:p-5 mx-auto max-w-md w-full text-center ${closing ? 'animate-fadeOutDown' : 'animate-fadeInUp'}`} style={{ boxShadow: 'var(--glass-shadow-lg)' }}>
                <h3 className="text-base font-bold dark:text-white mb-1.5">
                    {locale === 'ko' ? '쿠키 사용 안내' : 'Cookie Notice'}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
                    {t.message}
                </p>
                <Link href="/cookies" onClick={() => dismiss('declined')} className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium mb-3 block">
                    {locale === 'ko' ? '자세히 보기 →' : 'Learn more →'}
                </Link>
                <div className="flex gap-2">
                    <button
                        onClick={() => dismiss('declined')}
                        className="flex-1 py-3 px-3 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 bg-white/40 dark:bg-white/5 border border-gray-200/50 dark:border-white/10 hover:bg-white/60 dark:hover:bg-white/10 transition-all active:scale-95"
                    >
                        {t.decline}
                    </button>
                    <button
                        onClick={() => dismiss('accepted')}
                        className="flex-1 py-3 px-3 rounded-xl text-sm font-bold text-white gradient-btn transition-all shadow-lg active:scale-95"
                    >
                        {t.accept}
                    </button>
                </div>
            </div>
        </div>
    );
}
