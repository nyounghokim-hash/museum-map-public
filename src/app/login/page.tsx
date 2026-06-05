'use client';
import { useState, useEffect } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import * as gtag from '@/lib/gtag';
import Link from 'next/link';

/** Detect in-app browsers that block Google OAuth */
function detectInAppBrowser(): string | null {
    if (typeof navigator === 'undefined') return null;
    const ua = navigator.userAgent || '';
    // Instagram
    if (/Instagram/i.test(ua)) return 'Instagram';
    // KakaoTalk
    if (/KAKAOTALK/i.test(ua)) return 'KakaoTalk';
    // LINE
    if (/\bLine\//i.test(ua)) return 'LINE';
    // Facebook / Messenger
    if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i.test(ua)) return 'Facebook';
    // Twitter / X
    if (/Twitter/i.test(ua)) return 'X (Twitter)';
    // Naver
    if (/NAVER/i.test(ua)) return 'Naver';
    // Daum / KakaoStory
    if (/DaumApps/i.test(ua)) return 'Daum';
    // WeChat
    if (/MicroMessenger/i.test(ua)) return 'WeChat';
    // Generic WebView detection (Android)
    if (/wv\)|WebView/i.test(ua) && /Android/i.test(ua)) return 'WebView';
    return null;
}

function getBrowserOpenUrl(): string {
    if (typeof window === 'undefined') return 'https://museummap.app/login';
    const url = new URL(window.location.href);
    // Some in-app browsers restore OAuth/intermediate URLs poorly. Share a clean app URL instead.
    if (url.pathname.startsWith('/api/auth') || url.pathname === '/404' || url.pathname === '/_not-found') {
        url.pathname = '/login';
        url.search = '';
    }
    url.hash = '';
    return url.toString();
}

const FAMOUS_MUSEUMS = [
    'The Louvre', 'MoMA', 'The Met', 'Rijksmuseum', 'Uffizi Gallery',
    'British Museum', 'Musée d\'Orsay', 'Tate Modern', 'Prado Museum',
    'National Gallery', 'Guggenheim', 'Van Gogh Museum', 'Art Institute of Chicago',
    'Centre Pompidou', 'Hermitage Museum', 'Getty Center', 'LACMA',
];

/* ── i18n ─────────────────────────────── */
type L = Record<string, string>;
const txt = (m: L, locale: string) => m[locale] || m['en'] || Object.values(m)[0];

const consentLabels = {
    title: { ko: '서비스 이용 동의', en: 'Terms Agreement', ja: 'サービス利用同意', de: 'Zustimmung', fr: 'Accord de service', es: 'Acuerdo de servicio', pt: 'Acordo de serviço', 'zh-CN': '服务使用协议', 'zh-TW': '服務使用協議', da: 'Serviceaftale', fi: 'Palvelusopimus', sv: 'Tjänstavtal', et: 'Teenuse leping' },
    agreeAll: { ko: '전체 동의', en: 'Agree to All', ja: 'すべて同意', de: 'Alle akzeptieren', fr: 'Tout accepter', es: 'Aceptar todo', pt: 'Aceitar tudo', 'zh-CN': '全部同意', 'zh-TW': '全部同意', da: 'Accepter alle', fi: 'Hyväksy kaikki', sv: 'Acceptera alla', et: 'Nõustu kõigiga' },
    continue: { ko: '동의하고 계속하기', en: 'Agree & Continue', ja: '同意して続ける', de: 'Zustimmen & weiter', fr: 'Accepter et continuer', es: 'Aceptar y continuar', pt: 'Aceitar e continuar', 'zh-CN': '同意并继续', 'zh-TW': '同意並繼續', da: 'Accepter og fortsæt', fi: 'Hyväksy ja jatka', sv: 'Acceptera och fortsätt', et: 'Nõustu ja jätka' },
    cancel: { ko: '취소', en: 'Cancel', ja: 'キャンセル', de: 'Abbrechen', fr: 'Annuler', es: 'Cancelar', pt: 'Cancelar', 'zh-CN': '取消', 'zh-TW': '取消', da: 'Annuller', fi: 'Peruuta', sv: 'Avbryt', et: 'Tühista' },
    required: { ko: '(필수)', en: '(required)', ja: '(必須)', de: '(Pflicht)', fr: '(obligatoire)', es: '(obligatorio)', pt: '(obrigatório)', 'zh-CN': '(必需)', 'zh-TW': '(必要)', da: '(påkrævet)', fi: '(pakollinen)', sv: '(obligatoriskt)', et: '(kohustuslik)' },
    termsName: { ko: '서비스 이용약관', en: 'Terms of Service', ja: '利用規約', de: 'Nutzungsbedingungen', fr: "Conditions d'utilisation", es: 'Términos de servicio', pt: 'Termos de serviço', 'zh-CN': '服务条款', 'zh-TW': '服務條款', da: 'Servicevilkår', fi: 'Käyttöehdot', sv: 'Användarvillkor', et: 'Kasutustingimused' },
    privacyName: { ko: '개인정보처리방침', en: 'Privacy Policy', ja: 'プライバシーポリシー', de: 'Datenschutz', fr: 'Politique de confidentialité', es: 'Política de privacidad', pt: 'Política de privacidade', 'zh-CN': '隐私政策', 'zh-TW': '隱私政策', da: 'Privatlivspolitik', fi: 'Tietosuojakäytäntö', sv: 'Integritetspolicy', et: 'Privaatsuspoliitika' },
    termsSummary: { ko: 'Museum Map 서비스 이용, 계정 관리, 사진 업로드, AI 추천 기능 이용에 관한 규정입니다.', en: 'Terms covering Museum Map usage, account management, photo uploads, and AI recommendation features.', ja: 'Museum Mapの利用、アカウント管理、写真アップロード、AI推薦機能に関する規約です。' },
    privacySummary: { ko: '이메일, 프로필 이미지 수집 및 서비스 개선 목적 활용, 30일 내 삭제 요청 가능합니다.', en: 'We collect email and profile image for service improvement. Deletion requests are processed within 30 days.', ja: 'メール、プロフィール画像を収集し、サービス改善に活用します。30日以内の削除リクエストが可能です。' },
};

const choiceLabels = {
    title: { ko: '시작하기', en: 'Get Started', ja: '始める', de: 'Loslegen', fr: 'Commencer', es: 'Comenzar', pt: 'Começar', 'zh-CN': '开始', 'zh-TW': '開始', da: 'Kom i gang', fi: 'Aloita', sv: 'Kom igång', et: 'Alusta' },
    login: { ko: '로그인', en: 'Sign In', ja: 'ログイン', de: 'Anmelden', fr: 'Connexion', es: 'Iniciar sesión', pt: 'Entrar', 'zh-CN': '登录', 'zh-TW': '登入', da: 'Log ind', fi: 'Kirjaudu', sv: 'Logga in', et: 'Logi sisse' },
    loginDesc: { ko: '이미 계정이 있으신가요?', en: 'Already have an account?', ja: 'アカウントをお持ちですか？', de: 'Bereits ein Konto?', fr: 'Déjà un compte ?', es: '¿Ya tienes cuenta?', pt: 'Já tem conta?', 'zh-CN': '已有账号？', 'zh-TW': '已有帳號？', da: 'Har du allerede en konto?', fi: 'Onko sinulla jo tili?', sv: 'Har du redan ett konto?', et: 'Sul on juba konto?' },
    signup: { ko: '회원가입', en: 'Sign Up', ja: '新規登録', de: 'Registrieren', fr: "S'inscrire", es: 'Registrarse', pt: 'Cadastrar', 'zh-CN': '注册', 'zh-TW': '註冊', da: 'Tilmeld dig', fi: 'Rekisteröidy', sv: 'Registrera dig', et: 'Registreeru' },
    signupDesc: { ko: '처음이라면 필수 약관에 동의하고 시작해요', en: 'New here? Agree to terms and get started', ja: '初めてですか？規約に同意して始めましょう', de: 'Neu hier? Stimmen Sie den Bedingungen zu', fr: 'Nouveau ? Acceptez les conditions', es: '¿Eres nuevo? Acepta los términos', pt: 'Novo por aqui? Aceite os termos', 'zh-CN': '新用户？同意条款后开始', 'zh-TW': '新用戶？同意條款後開始', da: 'Ny her? Accepter vilkår', fi: 'Uusi? Hyväksy ehdot', sv: 'Ny här? Godkänn villkoren', et: 'Uus? Nõustu tingimustega' },
};

export default function LoginPage() {
    const { locale } = useApp();
    const { status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [signupRequired, setSignupRequired] = useState(false);

    // Handle ?signup=required redirect
    useEffect(() => {
        if (searchParams?.get('signup') === 'required') {
            // Sign out the unconsented account first
            signOut({ redirect: false }).then(() => {
                setSignupRequired(true);
            });
            // Clean URL
            const url = new URL(window.location.href);
            url.searchParams.delete('signup');
            window.history.replaceState({}, '', url.pathname);
        }
    }, [searchParams]);

    // Auto-redirect if already authenticated (but not if signup required)
    useEffect(() => {
        if (status === 'authenticated' && !signupRequired && searchParams?.get('signup') !== 'required') {
            router.replace('/');
        }
    }, [status, router, signupRequired, searchParams]);

    // Museum name scroll
    const [museumIdx, setMuseumIdx] = useState(0);
    const [museumVisible, setMuseumVisible] = useState(true);

    // UI states
    const [showChoice, setShowChoice] = useState(false);
    const [consentView, setConsentView] = useState<'main' | 'terms' | 'privacy'>('main');
    const [inAppBrowser, setInAppBrowser] = useState<string | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);
    const [showConsent, setShowConsent] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('consentModal');
            if (saved) return true;
        }
        return false;
    });
    const [termsAgreed, setTermsAgreed] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('consentModal');
            if (saved) { try { return JSON.parse(saved).terms || false; } catch { } }
        }
        return false;
    });
    const [privacyAgreed, setPrivacyAgreed] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('consentModal');
            if (saved) { try { return JSON.parse(saved).privacy || false; } catch { } }
        }
        return false;
    });

    // Clear sessionStorage after restoring
    useEffect(() => { sessionStorage.removeItem('consentModal'); }, []);

    // Save consent state before navigating to terms/privacy
    const saveConsentState = () => {
        sessionStorage.setItem('consentModal', JSON.stringify({ terms: termsAgreed, privacy: privacyAgreed }));
    };

    useEffect(() => {
        const interval = setInterval(() => {
            setMuseumVisible(false);
            setTimeout(() => { setMuseumIdx(prev => (prev + 1) % FAMOUS_MUSEUMS.length); setMuseumVisible(true); }, 400);
        }, 2500);
        return () => clearInterval(interval);
    }, []);

    // Detect in-app browser on mount
    useEffect(() => {
        setInAppBrowser(detectInAppBrowser());
    }, []);

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(getBrowserOpenUrl());
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch {
            // Fallback: select input trick
            const input = document.createElement('input');
            input.value = getBrowserOpenUrl();
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        }
    };

    const handleGoogleClick = () => {
        setShowChoice(true);
    };

    const handleLogin = () => {
        setShowChoice(false);
        gtag.event('login', { category: 'auth', label: 'google', value: 1 });
        signIn('google', { callbackUrl: '/' });
    };

    const handleSignup = () => {
        setShowChoice(false);
        setTermsAgreed(false);
        setPrivacyAgreed(false);
        setShowConsent(true);
        setConsentView('main');
    };

    const handleConsent = () => {
        gtag.event('signup', { category: 'auth', label: 'google', value: 1 });
        signIn('google', { callbackUrl: '/?consent=new' });
    };

    const handleAgreeAll = () => {
        setTermsAgreed(true);
        setPrivacyAgreed(true);
    };

    const allAgreed = termsAgreed && privacyAgreed;

    // i18n
    const labels: Record<string, { desc: string; google: string; terms: string; privacy: string; agree: string }> = {
        ko: { desc: '세계의 박물관과 미술관을 지도에서 찾아보세요', google: 'Google로 계속하기', terms: '이용약관', privacy: '개인정보처리방침', agree: '로그인하면 아래 내용에 동의하게 돼요:' },
        en: { desc: 'Explore museums and galleries worldwide', google: 'Continue with Google', terms: 'Terms of Service', privacy: 'Privacy Policy', agree: 'By signing in, you agree to our:' },
        ja: { desc: '世界の美術館・博物館を探索しよう', google: 'Googleで続ける', terms: '利用規約', privacy: 'プライバシーポリシー', agree: 'ログインすると以下に同意します：' },
        de: { desc: 'Entdecken Sie Museen und Galerien weltweit', google: 'Mit Google fortfahren', terms: 'Nutzungsbedingungen', privacy: 'Datenschutz', agree: 'Mit der Anmeldung stimmen Sie zu:' },
        fr: { desc: 'Explorez les musées et galeries du monde', google: 'Continuer avec Google', terms: 'Conditions', privacy: 'Confidentialité', agree: 'En vous connectant, vous acceptez :' },
        es: { desc: 'Explora museos y galerías del mundo', google: 'Continuar con Google', terms: 'Términos', privacy: 'Privacidad', agree: 'Al iniciar sesión, aceptas:' },
        pt: { desc: 'Explore museus e galerias pelo mundo', google: 'Continuar com o Google', terms: 'Termos', privacy: 'Privacidade', agree: 'Ao fazer login, você concorda com:' },
        'zh-CN': { desc: '探索全球博物馆与美术馆', google: '使用 Google 继续', terms: '服务条款', privacy: '隐私政策', agree: '登录即表示您同意：' },
        'zh-TW': { desc: '探索全球博物館與美術館', google: '使用 Google 繼續', terms: '服務條款', privacy: '隱私政策', agree: '登入即表示您同意：' },
        da: { desc: 'Udforsk museer og gallerier verden over', google: 'Fortsæt med Google', terms: 'Vilkår', privacy: 'Privatliv', agree: 'Ved at logge ind accepterer du:' },
        fi: { desc: 'Tutustu museoihin ja gallerioihin ympäri maailmaa', google: 'Jatka Googlella', terms: 'Käyttöehdot', privacy: 'Tietosuoja', agree: 'Kirjautumalla hyväksyt:' },
        sv: { desc: 'Utforska museer och gallerier världen över', google: 'Fortsätt med Google', terms: 'Villkor', privacy: 'Integritet', agree: 'Genom att logga in godkänner du:' },
        et: { desc: 'Avasta muuseume ja galeriisid üle maailma', google: 'Jätka Google\'iga', terms: 'Tingimused', privacy: 'Privaatsus', agree: 'Sisse logides nõustute:' },
    };
    const l = labels[locale] || labels['en'];

    return (
        <div className="login-2-shell fixed inset-0 flex flex-col selection:bg-blue-200 selection:text-slate-950 transition-colors duration-300 overflow-hidden lg:overflow-y-auto animate-[fadeIn_0.8s_ease]">
            <button
                type="button"
                onClick={() => router.push('/')}
                className="fixed right-4 top-[max(16px,env(safe-area-inset-top,0px))] z-50 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/70 bg-white/76 text-slate-700 shadow-xl shadow-blue-950/10 backdrop-blur-xl transition-all active:scale-95 hover:bg-white/90 dark:border-white/20 dark:bg-blue-950/58 dark:text-white dark:shadow-blue-950/20 dark:hover:bg-blue-950/72"
                aria-label={locale === 'ko' ? '닫기' : 'Close'}
            >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            {/* Background */}
            <div className="login-2-map-bg absolute inset-0 z-0 pointer-events-none overflow-hidden" />

            {/* Content */}
            <div className="relative z-10 grid min-h-full grid-rows-[1fr_auto] px-5 pb-8 pt-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-1 lg:items-center lg:gap-16 lg:px-16 lg:py-16">
                {/* Top — branding */}
                <div className="flex flex-col items-center justify-center text-center lg:items-start lg:text-left">
                    <div className="mb-7 flex h-20 w-20 items-center justify-center rounded-[1.65rem] border border-blue-200/70 bg-white/76 text-blue-700 shadow-2xl shadow-blue-950/12 backdrop-blur-xl dark:border-white/12 dark:bg-white/10 dark:text-white dark:shadow-blue-950/30">
                        <svg viewBox="0 0 510 286" className="h-11 w-auto fill-current" aria-hidden="true">
                            <path d="M45.69,238.06v-50.84c0-7.74,5.24-14.49,12.73-16.41l44.69-11.47c16.99-4.36,16.97-28.5-.03-32.83l-44.64-11.37c-7.51-1.91-12.76-8.67-12.76-16.42v-50.76c0-9.36,7.59-16.94,16.94-16.94h165.97c9.36,0,16.94,7.59,16.94,16.94v16.51c0,9.36-7.59,16.94-16.94,16.94h-.33c-19.94,0-23.5,28.44-4.18,33.37l8.7,2.22c7.51,1.91,12.76,8.67,12.76,16.42v19.27c0,7.75-5.26,14.51-12.77,16.42l-8.43,2.14c-19.33,4.91-15.77,33.37,4.18,33.37h.08c9.36,0,16.94,7.59,16.94,16.94v16.51c0,9.36-7.59,16.94-16.94,16.94H62.63c-9.36,0-16.94-7.59-16.94-16.94Z" />
                            <path d="M464.31,47.94v50.85c0,7.73-5.23,14.48-12.72,16.41l-44.5,11.47c-16.97,4.37-16.95,28.48.03,32.83l44.45,11.37c7.5,1.92,12.75,8.68,12.75,16.42v50.78c0,9.36-7.59,16.94-16.94,16.94h-165.21c-9.36,0-16.94-7.59-16.94-16.94v-16.51c0-9.36,7.59-16.94,16.94-16.94h.25c19.93,0,23.51-28.42,4.2-33.36l-8.64-2.21c-7.5-1.92-12.75-8.68-12.75-16.42v-19.3c0-7.74,5.25-14.5,12.75-16.42l8.38-2.14c19.31-4.93,15.74-33.36-4.19-33.36h0c-9.36,0-16.94-7.59-16.94-16.94v-16.51c0-9.36,7.59-16.94,16.94-16.94h165.21c9.36,0,16.94,7.59,16.94,16.94Z" />
                        </svg>
                    </div>
                    <div className="h-8 overflow-hidden mb-2">
                        <p className={`text-xs font-black uppercase tracking-[0.22em] text-blue-700/70 transition-all duration-400 dark:text-blue-200/70 ${museumVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'}`}>
                            {FAMOUS_MUSEUMS[museumIdx]}
                        </p>
                    </div>
                    <h1 className="font-serif text-5xl font-semibold leading-none tracking-normal text-slate-950 sm:text-6xl lg:text-7xl dark:text-white">
                        Museum Map
                    </h1>
                    <p className="mt-5 max-w-sm text-base font-semibold leading-relaxed text-slate-600 sm:text-lg dark:text-blue-100/78">
                        {l.desc}
                    </p>
                </div>

                {/* Login card */}
                <div className="w-full max-w-md mx-auto shrink-0">
                    <div className="rounded-[2rem] border border-white/80 bg-white/95 p-7 shadow-2xl shadow-blue-950/25 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/88 sm:p-8">
                        {/* In-app browser warning */}
                        {inAppBrowser && (
                            <div className="mb-5 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center shrink-0 mt-0.5">
                                        <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">
                                            {locale === 'ko' ? `${inAppBrowser} 앱 안에서는 로그인이 제한돼요` :
                                                locale === 'ja' ? `${inAppBrowser}アプリ内ブラウザを検出` :
                                                    `${inAppBrowser} in-app browser detected`}
                                        </p>
                                        <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                                            {locale === 'ko' ? 'Google 로그인은 Safari 또는 Chrome에서 열어야 해요. 링크를 복사해 브라우저에서 열어 주세요.' :
                                                locale === 'ja' ? 'Googleログインは SafariまたはChromeでのみ可能です。下のリンクをコピーしてブラウザで開いてください。' :
                                                    'Google sign-in requires Safari or Chrome. Copy the link below and open it in your browser.'}
                                        </p>
                                        <div className="flex gap-2 mt-3">
                                            <button
                                                onClick={handleCopyLink}
                                                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97] flex items-center justify-center gap-1.5 ${linkCopied
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-amber-100 dark:bg-amber-800/40 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/60'}`}
                                            >
                                                {linkCopied ? (
                                                    <>
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                        </svg>
                                                        {locale === 'ko' ? '링크를 복사했어요' : locale === 'ja' ? 'コピー済み!' : 'Copied!'}
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                        </svg>
                                                        {locale === 'ko' ? '링크 복사' : locale === 'ja' ? 'リンクをコピー' : 'Copy Link'}
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    // Try to open in external browser
                                                    const url = getBrowserOpenUrl();
                                                    // Android Intent scheme
                                                    if (/Android/i.test(navigator.userAgent)) {
                                                        window.location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
                                                    } else {
                                                        // iOS: try x-safari scheme or just window.open
                                                        window.open(url, '_system');
                                                    }
                                                }}
                                                className="flex-1 py-2.5 rounded-xl text-xs font-bold gradient-btn transition-all active:scale-[0.97] flex items-center justify-center gap-1.5"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                                </svg>
                                                {locale === 'ko' ? '브라우저로 열기' : locale === 'ja' ? 'ブラウザで開く' : 'Open in Browser'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleGoogleClick}
                            className="w-full py-4 rounded-2xl font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            <span className="text-[15px] whitespace-nowrap">{l.google}</span>
                        </button>

                        <div className="mt-5 text-center">
                            <p className="text-[11px] text-gray-600 dark:text-neutral-400 leading-relaxed">
                                {l.agree}{' '}
                                <Link href="/terms" className="text-blue-600 hover:underline font-semibold">{l.terms}</Link>
                                {' & '}
                                <Link href="/terms?tab=privacy" className="text-blue-600 hover:underline font-semibold">{l.privacy}</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
                @keyframes panLeft {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            ` }}></style>

            {/* ═══ Choice Sheet: Login / Signup ═══ */}
            {showChoice && (
                <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowChoice(false)} />

                    <div className="relative w-full sm:max-w-sm mx-0 sm:mx-4 glass-popup gradient-border rounded-t-3xl sm:rounded-3xl overflow-hidden animate-slideUp" style={{ boxShadow: 'var(--glass-shadow-lg)' }}>
                        <div className="px-6 pt-6 pb-2">
                            <div className="flex items-center justify-end mb-3">
                                <button onClick={() => setShowChoice(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/50 dark:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            {/* Login */}
                            <button
                                onClick={handleLogin}
                                className="w-full text-left p-4 rounded-2xl border border-white/50 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-700 bg-white/90 dark:bg-white/8 hover:bg-white dark:hover:bg-blue-900/10 transition-all active:scale-[0.98] mb-3 group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-2xl bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center shrink-0">
                                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
                                    </div>
                                    <div>
                                        <span className="text-base font-extrabold text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{txt(choiceLabels.login, locale)}</span>
                                        <p className="text-[11px] text-gray-600 dark:text-neutral-400 mt-0.5">{txt(choiceLabels.loginDesc, locale)}</p>
                                    </div>
                                    <svg className="w-4 h-4 text-gray-300 dark:text-neutral-600 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                </div>
                            </button>

                            {/* Signup */}
                            <button
                                onClick={handleSignup}
                                className="w-full text-left p-4 rounded-2xl border border-white/50 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-700 bg-white/90 dark:bg-white/8 hover:bg-white dark:hover:bg-blue-900/10 transition-all active:scale-[0.98] mb-3 group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                                        <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" /></svg>
                                    </div>
                                    <div>
                                        <span className="text-base font-extrabold text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{txt(choiceLabels.signup, locale)}</span>
                                        <p className="text-[11px] text-gray-600 dark:text-neutral-400 mt-0.5">{txt(choiceLabels.signupDesc, locale)}</p>
                                    </div>
                                    <svg className="w-4 h-4 text-gray-300 dark:text-neutral-600 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                </div>
                            </button>
                        </div>
                        <div className="px-6 pb-6 pt-2">
                            <p className="text-[10px] text-center text-gray-500 dark:text-neutral-400">Google OAuth 2.0</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Consent Modal (Signup flow) ═══ */}
            {showConsent && (
                <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowConsent(false)} />

                    <div className="relative w-full sm:max-w-md mx-0 sm:mx-4 glass-panel gradient-border rounded-t-3xl sm:rounded-3xl overflow-hidden animate-slideUp" style={{ boxShadow: 'var(--glass-shadow-lg)' }}>
                        {/* Header */}
                        <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-neutral-800">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                                    {txt(consentLabels.title, locale)}
                                </h2>
                                <button onClick={() => setShowConsent(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/50 dark:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <button onClick={handleAgreeAll} className={`mt-4 w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all active:scale-[0.98] ${allAgreed ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-700'}`}>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${allAgreed ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-neutral-600'}`}>
                                    {allAgreed && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                <span className={`text-sm font-bold ${allAgreed ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'}`}>{txt(consentLabels.agreeAll, locale)}</span>
                            </button>
                        </div>

                        {/* Items */}
                        <div className="px-6 py-4 space-y-3 max-h-[50vh] overflow-y-auto">
                            {/* Terms */}
                            <div onClick={() => setTermsAgreed((prev: boolean) => !prev)} className={`rounded-2xl border p-4 cursor-pointer transition-all active:scale-[0.98] ${termsAgreed ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10' : 'border-white/40 dark:border-white/10 bg-white/30 dark:bg-white/5'}`}>
                                <div className="flex items-start gap-3">
                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${termsAgreed ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-neutral-600'}`}>
                                        {termsAgreed && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-bold text-gray-800 dark:text-white">{txt(consentLabels.termsName, locale)}</span>
                                            <span className="text-[10px] font-bold text-blue-500">{txt(consentLabels.required, locale)}</span>
                                        </div>
                                        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1.5 leading-relaxed">{txt(consentLabels.termsSummary, locale)}</p>
                                        <button onClick={(e) => { e.stopPropagation(); setConsentView('terms'); }} className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                            {l.terms}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Privacy */}
                            <div onClick={() => setPrivacyAgreed((prev: boolean) => !prev)} className={`rounded-2xl border p-4 cursor-pointer transition-all active:scale-[0.98] ${privacyAgreed ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10' : 'border-white/40 dark:border-white/10 bg-white/30 dark:bg-white/5'}`}>
                                <div className="flex items-start gap-3">
                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${privacyAgreed ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-neutral-600'}`}>
                                        {privacyAgreed && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-bold text-gray-800 dark:text-white">{txt(consentLabels.privacyName, locale)}</span>
                                            <span className="text-[10px] font-bold text-blue-500">{txt(consentLabels.required, locale)}</span>
                                        </div>
                                        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1.5 leading-relaxed">{txt(consentLabels.privacySummary, locale)}</p>
                                        <button onClick={(e) => { e.stopPropagation(); setConsentView('privacy'); }} className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                            {l.privacy}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-5 border-t border-gray-100 dark:border-neutral-800 flex gap-3">
                            <button onClick={() => setShowConsent(false)} className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-gray-500 dark:text-gray-400 bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/10 hover:bg-white/60 dark:hover:bg-white/10 active:scale-[0.98] transition-all">
                                {txt(consentLabels.cancel, locale)}
                            </button>
                            <button onClick={handleConsent} disabled={!allAgreed} className={`flex-[2] py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] ${allAgreed ? 'gradient-btn shadow-lg' : 'bg-gray-200 dark:bg-neutral-700 text-gray-400 dark:text-neutral-500 cursor-not-allowed'}`}>
                                {txt(consentLabels.continue, locale)}
                            </button>
                        </div>

                        {/* ═══ Slide-in Panel: Terms / Privacy ═══ */}
                        <div className={`absolute inset-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col ${consentView !== 'main' ? 'translate-x-0' : 'translate-x-full'}`} style={{ background: 'var(--glass-bg-heavy)', backdropFilter: 'blur(24px) saturate(200%)', WebkitBackdropFilter: 'blur(24px) saturate(200%)' }}>
                            <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-3">
                                <button onClick={() => setConsentView('main')} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/50 dark:bg-white/10 text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors active:scale-95">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
                                    {consentView === 'terms' ? txt(consentLabels.termsName, locale) : txt(consentLabels.privacyName, locale)}
                                </h2>
                            </div>
                            <div className="flex-1 overflow-y-auto px-6 py-5">
                                {consentView === 'terms' ? (
                                    <div className="text-xs text-gray-600 dark:text-neutral-400 leading-relaxed space-y-3">
                                        {[
                                            <p key="t0" className="font-bold text-gray-800 dark:text-white">Museum Map 서비스 이용약관</p>,
                                            <p key="t1">본 약관은 Museum Map 서비스(이하 '서비스')의 이용에 관한 기본 사항을 규정합니다.</p>,
                                            <p key="t2" className="font-semibold text-gray-700 dark:text-gray-300">제1조 (목적)</p>,
                                            <p key="t3">이 약관은 서비스 이용 조건 및 절차, 이용자와 회사의 권리·의무를 규정합니다.</p>,
                                            <p key="t4" className="font-semibold text-gray-700 dark:text-gray-300">제2조 (서비스 내용)</p>,
                                            <p key="t5">박물관/미술관 검색, AI 추천, 여행 계획, 컬렉션 관리, 스토리 등의 기능을 제공합니다.</p>,
                                            <p key="t6" className="font-semibold text-gray-700 dark:text-gray-300">제3조 (계정)</p>,
                                            <p key="t7">Google OAuth를 통해 가입하며, 계정 정보의 정확성은 이용자 본인에게 있습니다.</p>,
                                            <p key="t8" className="font-semibold text-gray-700 dark:text-gray-300">제4조 (금지 행위)</p>,
                                            <p key="t9">부정 접근, 서비스 방해, 타인의 권리 침해 등의 행위를 금지합니다.</p>,
                                            <p key="t10" className="mt-4"><button onClick={() => router.push('/terms')} className="text-blue-500 hover:underline font-medium">전체 약관 보기 →</button></p>,
                                        ].map((el, i) => <div key={i} style={{ animation: `fadeSlideIn 0.4s ease ${i * 50}ms both` }}>{el}</div>)}
                                    </div>
                                ) : (
                                    <div className="text-xs text-gray-600 dark:text-neutral-400 leading-relaxed space-y-3">
                                        {[
                                            <p key="p0" className="font-bold text-gray-800 dark:text-white">개인정보 처리방침</p>,
                                            <p key="p1">Museum Map은 이용자의 개인정보를 중요시하며, 관련 법률을 준수합니다.</p>,
                                            <p key="p2" className="font-semibold text-gray-700 dark:text-gray-300">수집 정보</p>,
                                            <p key="p3">이메일, 프로필 이미지 (Google OAuth를 통해 자동 수집)</p>,
                                            <p key="p4" className="font-semibold text-gray-700 dark:text-gray-300">수집 목적</p>,
                                            <p key="p5">서비스 회원 관리, 맞춤 추천 제공, 서비스 품질 개선</p>,
                                            <p key="p6" className="font-semibold text-gray-700 dark:text-gray-300">보관 기간</p>,
                                            <p key="p7">회원 탈퇴 시 즉시 삭제. 별도 삭제 요청은 30일 내 처리.</p>,
                                            <p key="p8" className="font-semibold text-gray-700 dark:text-gray-300">제3자 제공</p>,
                                            <p key="p9">이용자의 동의 없이 제3자에게 개인정보를 제공하지 않습니다.</p>,
                                            <p key="p10" className="mt-4"><button onClick={() => router.push('/terms?tab=privacy')} className="text-blue-500 hover:underline font-medium">전체 방침 보기 →</button></p>,
                                        ].map((el, i) => <div key={i} style={{ animation: `fadeSlideIn 0.4s ease ${i * 50}ms both` }}>{el}</div>)}
                                    </div>
                                )}
                            </div>
                            <div className="px-6 py-4 border-t border-gray-100 dark:border-neutral-800">
                                <button onClick={() => { setConsentView('main'); consentView === 'terms' ? setTermsAgreed(true) : setPrivacyAgreed(true); }} className="w-full py-3 rounded-2xl text-sm font-bold gradient-btn active:scale-[0.98] transition-all shadow-lg">
                                    {consentView === 'terms' ? txt(consentLabels.termsName, locale) : txt(consentLabels.privacyName, locale)} 동의하기
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Signup Required Popup ═══ */}
            {signupRequired && !showConsent && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div className="relative glass-panel gradient-border rounded-3xl p-8 mx-6 max-w-sm w-full text-center" style={{ boxShadow: 'var(--glass-shadow-lg)' }}>
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center">
                            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-extrabold dark:text-white mb-2">
                            {txt({
                                ko: '회원가입이 필요해요',
                                en: 'Sign Up Required',
                                ja: '会員登録が必要です',
                                de: 'Registrierung erforderlich',
                                fr: 'Inscription requise',
                                es: 'Registro necesario',
                                pt: 'Cadastro necessário',
                                'zh-CN': '需要注册',
                                'zh-TW': '需要註冊',
                                da: 'Tilmelding påkrævet',
                                fi: 'Rekisteröityminen vaaditaan',
                                sv: 'Registrering krävs',
                                et: 'Registreerimine vajalik',
                            }, locale)}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            {txt({
                                ko: '필수 약관에 동의하면 회원가입을 계속할 수 있어요.',
                                en: 'Please agree to the terms and sign up to use the service.',
                                ja: 'サービスをご利用いただくには、規約に同意して会員登録をお願いします。',
                                de: 'Bitte stimmen Sie den Bedingungen zu und registrieren Sie sich.',
                                fr: 'Veuillez accepter les conditions et vous inscrire.',
                                es: 'Por favor, acepta los términos y regístrate.',
                                pt: 'Por favor, aceite os termos e cadastre-se.',
                                'zh-CN': '请同意条款并注册以使用服务。',
                                'zh-TW': '請同意條款並註冊以使用服務。',
                                da: 'Accepter venligst vilkårene og tilmeld dig.',
                                fi: 'Hyväksy ehdot ja rekisteröidy.',
                                sv: 'Godkänn villkoren och registrera dig.',
                                et: 'Palun nõustuge tingimustega ja registreeruge.',
                            }, locale)}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setSignupRequired(false)}
                                className="flex-1 py-3 rounded-xl border border-white/40 dark:border-white/10 text-gray-600 dark:text-gray-400 font-bold text-sm hover:bg-white/40 dark:hover:bg-white/5 transition-colors active:scale-95"
                            >
                                {txt(consentLabels.cancel, locale)}
                            </button>
                            <button
                                onClick={() => { setSignupRequired(false); handleSignup(); }}
                                className="flex-[2] py-3 rounded-xl gradient-btn font-bold text-sm shadow-lg transition-colors active:scale-95"
                            >
                                {txt(choiceLabels.signup, locale)}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
