'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';

const TEXTS: Record<string, { title: string; message: string; login: string; cancel: string }> = {
    ko: { title: '로그인하면 사용할 수 있어요', message: '내 픽, 여행, 컬렉션은 로그인 후 저장돼요.', login: '로그인하기', cancel: '나중에' },
    en: { title: 'Login Required', message: 'Please log in to use this feature.', login: 'Log In', cancel: 'Cancel' },
    ja: { title: 'ログインが必要です', message: 'この機能を利用するにはログインが必要です。', login: 'ログイン', cancel: 'キャンセル' },
    zh: { title: '需要登录', message: '请登录以使用此功能。', login: '登录', cancel: '取消' },
    'zh-CN': { title: '需要登录', message: '请登录以使用此功能。', login: '登录', cancel: '取消' },
    'zh-TW': { title: '需要登入', message: '請登入以使用此功能。', login: '登入', cancel: '取消' },
    de: { title: 'Anmeldung erforderlich', message: 'Bitte melden Sie sich an, um diese Funktion zu nutzen.', login: 'Anmelden', cancel: 'Abbrechen' },
    fr: { title: 'Connexion requise', message: 'Veuillez vous connecter pour utiliser cette fonctionnalité.', login: 'Se connecter', cancel: 'Annuler' },
    es: { title: 'Inicio de sesión requerido', message: 'Inicia sesión para usar esta función.', login: 'Iniciar sesión', cancel: 'Cancelar' },
    pt: { title: 'Login necessário', message: 'Faça login para usar este recurso.', login: 'Entrar', cancel: 'Cancelar' },
    da: { title: 'Login påkrævet', message: 'Log ind for at bruge denne funktion.', login: 'Log ind', cancel: 'Annuller' },
    fi: { title: 'Kirjautuminen vaaditaan', message: 'Kirjaudu sisään käyttääksesi tätä ominaisuutta.', login: 'Kirjaudu', cancel: 'Peruuta' },
    sv: { title: 'Inloggning krävs', message: 'Logga in för att använda den här funktionen.', login: 'Logga in', cancel: 'Avbryt' },
    et: { title: 'Sisselogimine nõutav', message: 'Palun logige sisse, et seda funktsiooni kasutada.', login: 'Logi sisse', cancel: 'Tühista' },
};

interface LoginRequiredModalProps {
    isOpen: boolean;
    onClose: () => void;
    callbackUrl?: string;
}

export default function LoginRequiredModal({ isOpen, onClose, callbackUrl }: LoginRequiredModalProps) {
    const router = useRouter();
    const { locale } = useApp();
    const [closing, setClosing] = useState(false);

    if (!isOpen) return null;

    const t = TEXTS[locale] || TEXTS.en;

    const handleClose = () => {
        setClosing(true);
        setTimeout(() => { onClose(); setClosing(false); }, 200);
    };

    const handleLogin = () => {
        const url = callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/login';
        router.push(url);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center" onClick={handleClose}>
            <div className={`absolute inset-0 bg-black/40 backdrop-blur-sm ${closing ? 'animate-fadeOut' : 'animate-backdropIn'}`} />
            <div
                className={`relative glass-popup gradient-border rounded-2xl p-6 sm:p-8 mx-6 max-w-sm w-full text-center ${closing ? 'animate-scaleDown' : 'animate-scaleUp'}`}
                style={{ boxShadow: 'var(--glass-shadow-lg)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Lock icon */}
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center">
                    <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                </div>

                <h3 className="text-lg font-bold dark:text-white mb-2">{t.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">{t.message}</p>

                <div className="flex gap-2">
                    <button
                        onClick={handleClose}
                        className="flex-1 py-3 px-3 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 bg-white/40 dark:bg-white/5 border border-gray-200/50 dark:border-white/10 hover:bg-white/60 dark:hover:bg-white/10 transition-all active:scale-95"
                    >
                        {t.cancel}
                    </button>
                    <button
                        onClick={handleLogin}
                        className="flex-1 py-3 px-3 rounded-xl text-sm font-bold text-white gradient-btn transition-all shadow-lg active:scale-95"
                    >
                        {t.login} →
                    </button>
                </div>
            </div>

            <style jsx global>{`
                @keyframes scaleUp {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                @keyframes scaleDown {
                    from { transform: scale(1); opacity: 1; }
                    to { transform: scale(0.95); opacity: 0; }
                }
                .animate-scaleUp { animation: scaleUp 150ms ease-out; }
                .animate-scaleDown { animation: scaleDown 200ms ease-in forwards; }
            `}</style>
        </div>
    );
}
