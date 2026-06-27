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
let documentNavigationResetTimer: number | undefined;

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

export function clearDocumentNavigationStarted() {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.remove('mm-document-nav-started');
    if (typeof window !== 'undefined' && documentNavigationResetTimer) {
        window.clearTimeout(documentNavigationResetTimer);
        documentNavigationResetTimer = undefined;
    }
}

export function markDocumentNavigationStarted() {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.add('mm-document-nav-started');
    if (typeof window === 'undefined') return;
    if (documentNavigationResetTimer) window.clearTimeout(documentNavigationResetTimer);
    documentNavigationResetTimer = window.setTimeout(() => {
        clearDocumentNavigationStarted();
    }, 1800);
}

function currentDocumentPath() {
    if (typeof window === 'undefined') return '';
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function openDocument(href: string, replace = false) {
    markDocumentNavigationStarted();
    const run = () => {
        if (replace) window.location.replace(href);
        else window.location.assign(href);
    };
    if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => window.setTimeout(run, 0));
        return;
    }
    window.setTimeout(run, 0);
}

export function navigateWithPending(href: string, locale?: string | null, replace = false) {
    if (typeof window === 'undefined') return;
    startRoutePending(locale);
    openDocument(href, replace);
}

export function navigateDocument(href: string, replace = false) {
    if (typeof window === 'undefined') return;
    openDocument(href, replace);
}

export function backLikeBrowser(
    fallbackHref = '/',
    options: { replaceFallback?: boolean } = {},
) {
    if (typeof window === 'undefined') return;

    if (window.history.length > 1) {
        window.history.back();
        return;
    }

    navigateDocument(fallbackHref, options.replaceFallback ?? true);
}

export function backWithFallback(
    fallbackHref = '/',
    locale?: string | null,
    options: { timeoutMs?: number; pendingOnFallback?: boolean } = {},
) {
    if (typeof window === 'undefined') return;
    // Flag the back navigation so the destination can play its back-direction
    // entrance animation (page-slide-in-back). Destinations consume + clear this
    // with a short freshness guard; see RoutePendingReset (it no longer wipes it).
    try { sessionStorage.setItem('navigating-back', String(Date.now())); } catch { }
    const timeoutMs = options.timeoutMs ?? 650;
    const shouldShowPending = options.pendingOnFallback === true;
    const currentPath = currentDocumentPath();
    if (window.history.length > 1) {
        markDocumentNavigationStarted();
        window.history.back();
        window.setTimeout(() => {
            if (currentDocumentPath() === currentPath) {
                if (shouldShowPending) navigateWithPending(fallbackHref, locale);
                else navigateDocument(fallbackHref);
            }
        }, timeoutMs);
        return;
    }

    if (shouldShowPending) navigateWithPending(fallbackHref, locale);
    else navigateDocument(fallbackHref);
}
