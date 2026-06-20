'use client';

const ROUTE_PENDING_LABELS: Record<string, string> = {
    ko: '화면을 준비하고 있어요',
    en: 'Getting the page ready',
    ja: '画面を準備しています',
    de: 'Seite wird vorbereitet',
    fr: 'Préparation de la page',
    es: 'Preparando la página',
    pt: 'Preparando a página',
    'zh-CN': '正在准备页面',
    'zh-TW': '正在準備頁面',
    da: 'Gør siden klar',
    fi: 'Valmistellaan sivua',
    sv: 'Förbereder sidan',
    et: 'Valmistame lehte ette',
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
    }, 1500);
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
