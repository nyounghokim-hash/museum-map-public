'use client';

const ROUTE_PENDING_LABELS: Record<string, string> = {
    ko: '화면을 여는 중',
    en: 'Opening page',
    ja: '画面を開いています',
    de: 'Seite wird geöffnet',
    fr: 'Ouverture de la page',
    es: 'Abriendo la página',
    pt: 'Abrindo a página',
    'zh-CN': '正在打开页面',
    'zh-TW': '正在開啟頁面',
    da: 'Åbner siden',
    fi: 'Avataan sivua',
    sv: 'Öppnar sidan',
    et: 'Lehte avatakse',
};

let slowTimer: number | undefined;

function getRoutePendingLabel(locale?: string | null) {
    return ROUTE_PENDING_LABELS[locale || ''] || ROUTE_PENDING_LABELS.en;
}

export function startRoutePending(locale?: string | null) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.add('mm-route-pending');
    root.classList.remove('mm-route-pending-slow');
    document.body?.setAttribute('data-route-pending-label', getRoutePendingLabel(locale));
    if (typeof window === 'undefined') return;
    if (slowTimer) window.clearTimeout(slowTimer);
    slowTimer = window.setTimeout(() => {
        root.classList.add('mm-route-pending-slow');
    }, 700);
}

export function clearRoutePending() {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.remove('mm-route-pending', 'mm-route-pending-slow');
    document.body?.removeAttribute('data-route-pending-label');
    if (typeof window !== 'undefined' && slowTimer) {
        window.clearTimeout(slowTimer);
        slowTimer = undefined;
    }
}

function currentDocumentPath() {
    if (typeof window === 'undefined') return '';
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function navigateWithPending(href: string, locale?: string | null, replace = false) {
    if (typeof window === 'undefined') return;
    startRoutePending(locale);
    if (replace) window.location.replace(href);
    else window.location.assign(href);
}

export function backWithFallback(
    fallbackHref = '/',
    locale?: string | null,
    options: { timeoutMs?: number } = {},
) {
    if (typeof window === 'undefined') return;
    const timeoutMs = options.timeoutMs ?? 650;
    const currentPath = currentDocumentPath();
    startRoutePending(locale);
    try {
        sessionStorage.setItem('navigating-back', String(Date.now()));
    } catch { }

    if (window.history.length > 1) {
        window.history.back();
        window.setTimeout(() => {
            if (currentDocumentPath() === currentPath) {
                navigateWithPending(fallbackHref, locale);
            }
        }, timeoutMs);
        return;
    }

    navigateWithPending(fallbackHref, locale);
}
