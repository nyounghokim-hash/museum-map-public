'use client';
import { useEffect, useState } from 'react';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'v1.6.1';
const CREATOR_INSTAGRAM = 'https://instagram.com/haerang4a_archive';

const SPLASH_SUBTITLES: Record<string, string> = {
    ko: '예술과 여행이 만나는 지도',
    en: 'Where art and travel meet',
    ja: 'アートと旅が出会う地図',
    zh: '艺术与旅行相遇的地图',
    de: 'Wo Kunst und Reisen zusammenfinden',
    fr: 'Là où l’art rencontre le voyage',
    es: 'Donde el arte se encuentra con el viaje',
    pt: 'Onde arte e viagem se encontram',
    sv: 'Där konst och resor möts',
    fi: 'Kartta, jossa taide ja matka kohtaavat',
    da: 'Hvor kunst og rejser mødes',
    et: 'Kaart, kus kunst ja reisimine kohtuvad',
};

const SPLASH_LABELS: Record<string, { kicker: string; loading: string; madeBy: string; aria: string; progress: string }> = {
    ko: {
        kicker: '예술 여행 지도',
        loading: '지도 불러오는 중',
        madeBy: '제작',
        aria: 'Museum Map을 불러오는 중',
        progress: '불러오기 진행률',
    },
    en: {
        kicker: 'Art travel atlas',
        loading: 'Loading map',
        madeBy: 'Made by',
        aria: 'Museum Map loading',
        progress: 'Loading progress',
    },
    ja: {
        kicker: 'アート旅の地図',
        loading: '地図を読み込み中',
        madeBy: '制作',
        aria: 'Museum Mapを読み込み中',
        progress: '読み込み進捗',
    },
    zh: {
        kicker: '艺术旅行地图',
        loading: '正在加载地图',
        madeBy: '制作',
        aria: '正在加载 Museum Map',
        progress: '加载进度',
    },
    de: {
        kicker: 'Atlas für Kunstreisen',
        loading: 'Karte wird geladen',
        madeBy: 'Erstellt von',
        aria: 'Museum Map wird geladen',
        progress: 'Ladefortschritt',
    },
    fr: {
        kicker: 'Atlas des voyages d’art',
        loading: 'Chargement de la carte',
        madeBy: 'Créé par',
        aria: 'Chargement de Museum Map',
        progress: 'Progression du chargement',
    },
    es: {
        kicker: 'Atlas de viajes de arte',
        loading: 'Cargando mapa',
        madeBy: 'Creado por',
        aria: 'Cargando Museum Map',
        progress: 'Progreso de carga',
    },
    pt: {
        kicker: 'Atlas de viagens de arte',
        loading: 'Carregando mapa',
        madeBy: 'Criado por',
        aria: 'Carregando Museum Map',
        progress: 'Progresso do carregamento',
    },
    sv: {
        kicker: 'Atlas för konstresor',
        loading: 'Laddar karta',
        madeBy: 'Skapad av',
        aria: 'Museum Map laddas',
        progress: 'Laddningsförlopp',
    },
    fi: {
        kicker: 'Taideretkien kartasto',
        loading: 'Karttaa ladataan',
        madeBy: 'Tekijä',
        aria: 'Museum Map latautuu',
        progress: 'Latauksen edistyminen',
    },
    da: {
        kicker: 'Atlas for kunstrejser',
        loading: 'Indlæser kort',
        madeBy: 'Skabt af',
        aria: 'Museum Map indlæses',
        progress: 'Indlæsningsstatus',
    },
    et: {
        kicker: 'Kunstireiside atlas',
        loading: 'Kaarti laaditakse',
        madeBy: 'Loonud',
        aria: 'Museum Map laadimine',
        progress: 'Laadimise edenemine',
    },
};

const MIN_SHOW_MS = 500;
const MAX_SHOW_MS = 1100;
const FADE_MS = 260;
const COMPLETE_HOLD_MS = 80;

function finishFoucOverlay() {
    if (typeof document === 'undefined') return;
    document.body.classList.add('splash-done');
    const styleEl = document.getElementById('splash-fouc');
    if (styleEl) {
        window.setTimeout(() => styleEl.remove(), FADE_MS);
    }
}

function shouldShowSplash(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return window.innerWidth <= 1024 && window.location.pathname === '/' && !sessionStorage.getItem('splashShown');
    } catch {
        return window.innerWidth <= 1024 && window.location.pathname === '/';
    }
}

function getDeviceLang(): string {
    if (typeof window === 'undefined') return 'en';
    try {
        const saved = localStorage.getItem('locale');
        if (saved && SPLASH_LABELS[saved]) return saved;
        if (saved) {
            const short = saved.split('-')[0].toLowerCase();
            if (SPLASH_LABELS[short]) return short;
        }
    } catch { }

    const lang = navigator.language || (navigator as any).userLanguage || 'en';
    const short = lang.split('-')[0].toLowerCase();
    return SPLASH_LABELS[short] ? short : 'en';
}

export default function SplashScreen() {
    const [visible, setVisible] = useState(false);
    const [entered, setEntered] = useState(false);
    const [fadeOut, setFadeOut] = useState(false);
    const [complete, setComplete] = useState(false);
    const [lang, setLang] = useState('en');
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (!shouldShowSplash()) {
            finishFoucOverlay();
            return;
        }

        setVisible(true);
    }, []);

    useEffect(() => {
        if (!visible) return;

        setLang(getDeviceLang());
        setComplete(false);
        try { sessionStorage.setItem('splashShown', '1'); } catch { }

        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced) {
            setEntered(true);
            setComplete(true);
            setProgress(100);
            const quick = setTimeout(() => {
                finishFoucOverlay();
                setFadeOut(true);
            }, 600);
            const hide = setTimeout(() => setVisible(false), 600 + FADE_MS);
            return () => { clearTimeout(quick); clearTimeout(hide); };
        }

        const startTs = performance.now();
        let enterFrame = requestAnimationFrame(() => setEntered(true));

        let progressFrame = 0;
        const animateProgress = (now: number) => {
            const elapsed = now - startTs;
            const t = Math.min(1, elapsed / MAX_SHOW_MS);
            const eased = 1 - Math.pow(1 - t, 2.8);
            setProgress(prev => Math.max(prev, Math.min(96, eased * 96)));
            progressFrame = requestAnimationFrame(animateProgress);
        };
        progressFrame = requestAnimationFrame(animateProgress);

        let ended = false;
        let completeTimer: ReturnType<typeof setTimeout> | null = null;
        let hideTimer: ReturnType<typeof setTimeout> | null = null;
        const tryEnd = () => {
            if (ended) return;
            ended = true;
            setComplete(true);
            setProgress(100);
            if (progressFrame) cancelAnimationFrame(progressFrame);
            completeTimer = setTimeout(() => {
                finishFoucOverlay();
                setFadeOut(true);
                hideTimer = setTimeout(() => setVisible(false), FADE_MS);
            }, COMPLETE_HOLD_MS);
        };

        const maxCap = setTimeout(tryEnd, MAX_SHOW_MS);
        const onReady = () => {
            const elapsed = performance.now() - startTs;
            setTimeout(tryEnd, Math.max(0, MIN_SHOW_MS - elapsed));
        };

        if (document.readyState === 'complete') onReady();
        else window.addEventListener('load', onReady, { once: true });

        return () => {
            cancelAnimationFrame(enterFrame);
            if (progressFrame) cancelAnimationFrame(progressFrame);
            clearTimeout(maxCap);
            if (completeTimer) clearTimeout(completeTimer);
            if (hideTimer) clearTimeout(hideTimer);
            window.removeEventListener('load', onReady);
        };
    }, [visible]);

    const labels = SPLASH_LABELS[lang] || SPLASH_LABELS.en;

    if (!visible) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            aria-label={labels.aria}
            className={`splash-screen ${entered ? 'is-entered' : ''} ${complete ? 'is-complete' : ''} ${fadeOut ? 'is-exiting' : ''}`}
        >
            <div className="splash-bg" aria-hidden="true">
                <div className="splash-frame" />
            </div>

            <div className="splash-spacer" />

            <main className="splash-main">
                <div className="splash-copy">
                    <p className="splash-kicker">{labels.kicker}</p>
                    <div className="splash-logo-mark" aria-hidden="true">
                        <svg viewBox="0 0 510 286" fill="currentColor">
                            <path d="M45.69,238.06v-50.84c0-7.74,5.24-14.49,12.73-16.41l44.69-11.47c16.99-4.36,16.97-28.5-.03-32.83l-44.64-11.37c-7.51-1.91-12.76-8.67-12.76-16.42v-50.76c0-9.36,7.59-16.94,16.94-16.94h165.97c9.36,0,16.94,7.59,16.94,16.94v16.51c0,9.36-7.59,16.94-16.94,16.94h-.33c-19.94,0-23.5,28.44-4.18,33.37l8.7,2.22c7.51,1.91,12.76,8.67,12.76,16.42v19.27c0,7.75-5.26,14.51-12.77,16.42l-8.43,2.14c-19.33,4.91-15.77,33.37,4.18,33.37h.08c9.36,0,16.94,7.59,16.94,16.94v16.51c0,9.36-7.59,16.94-16.94,16.94H62.63c-9.36,0-16.94-7.59-16.94-16.94Z" />
                            <path d="M464.31,47.94v50.85c0,7.73-5.23,14.48-12.72,16.41l-44.5,11.47c-16.97,4.37-16.95,28.48.03,32.83l44.45,11.37c7.5,1.92,12.75,8.68,12.75,16.42v50.78c0,9.36-7.59,16.94-16.94,16.94h-165.21c-9.36,0-16.94-7.59-16.94-16.94v-16.51c0-9.36,7.59-16.94,16.94-16.94h.25c19.93,0,23.51-28.42,4.2-33.36l-8.64-2.21c-7.5-1.92-12.75-8.68-12.75-16.42v-19.3c0-7.74,5.25-14.5,12.75-16.42l8.38-2.14c19.31-4.93,15.74-33.36-4.19-33.36h0c-9.36,0-16.94-7.59-16.94-16.94v-16.51c0-9.36,7.59-16.94,16.94-16.94h165.21c9.36,0,16.94,7.59,16.94,16.94Z" />
                        </svg>
                    </div>
                    <h1 className="splash-title">
                        <span>Museum</span>
                        <span>Map</span>
                    </h1>
                    <p className="splash-subtitle">{SPLASH_SUBTITLES[lang] || SPLASH_SUBTITLES.en}</p>
                </div>

                <div className="splash-progress-wrap">
                    <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(progress)}
                        aria-label={labels.progress}
                        className="splash-progress"
                    >
                        <div
                            data-splash-progress-fill
                            className="splash-progress-fill"
                        />
                    </div>
                    <div className="splash-progress-meta">
                        <span>{labels.loading}</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                </div>
            </main>

            <footer className="splash-footer">
                <a
                    href={CREATOR_INSTAGRAM}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Haerangsa Instagram"
                    className="splash-creator"
                >
                    <span className="splash-creator-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                        </svg>
                    </span>
                    <span className="splash-creator-text">
                        <span>{labels.madeBy}</span>
                        <strong>Haerangsa</strong>
                    </span>
                </a>

                <span className="splash-version">{APP_VERSION}</span>
            </footer>
        </div>
    );
}
