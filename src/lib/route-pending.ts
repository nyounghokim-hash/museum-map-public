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

function getPendingPath(href?: string | null) {
    if (!href) return '';
    try {
        const url = new URL(href, window.location.origin);
        return url.pathname;
    } catch {
        return href.split('?')[0] || '';
    }
}

function getRoutePendingTitle(locale?: string | null, href?: string | null) {
    const path = getPendingPath(href);
    const isKo = locale === 'ko';
    if (path === '/') return isKo ? '홈을 여는 중' : 'Opening home';
    if (path.startsWith('/saved')) return isKo ? '내 픽을 여는 중' : 'Opening My Pick';
    if (path.startsWith('/plans')) return isKo ? '내 여행을 여는 중' : 'Opening trips';
    if (path.startsWith('/collections')) return isKo ? '컬렉션을 여는 중' : 'Opening collections';
    if (path.startsWith('/compare')) return isKo ? '비교 화면을 여는 중' : 'Opening compare';
    if (path.startsWith('/blog')) return isKo ? '스토리를 여는 중' : 'Opening stories';
    if (path.startsWith('/artworks')) return isKo ? '작품을 여는 중' : 'Opening artworks';
    if (path.startsWith('/museums')) return isKo ? '상세 정보를 여는 중' : 'Opening details';
    if (path.startsWith('/settings')) return isKo ? '설정을 여는 중' : 'Opening settings';
    if (path.startsWith('/login')) return isKo ? '로그인을 여는 중' : 'Opening login';
    return getRoutePendingLabel(locale);
}

function getRoutePendingKind(href?: string | null) {
    const path = getPendingPath(href);
    if (path === '/') return 'map';
    if (path.startsWith('/museums') || path.startsWith('/artworks/') || (path.startsWith('/blog/') && path !== '/blog')) return 'detail';
    return 'list';
}

export function startRoutePending(locale?: string | null, href?: string | null) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.add('mm-route-pending', 'mm-route-pending-view');
    root.classList.remove('mm-route-pending-slow');
    document.body?.setAttribute('data-route-pending-label', getRoutePendingLabel(locale));
    document.body?.setAttribute('data-route-pending-title', getRoutePendingTitle(locale, href));
    document.body?.setAttribute('data-route-pending-kind', getRoutePendingKind(href));
    if (typeof window === 'undefined') return;
    if (slowTimer) window.clearTimeout(slowTimer);
    slowTimer = window.setTimeout(() => {
        root.classList.add('mm-route-pending-slow');
    }, 1500);
}

export function clearRoutePending() {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.remove('mm-route-pending', 'mm-route-pending-slow', 'mm-route-pending-view');
    document.body?.removeAttribute('data-route-pending-label');
    document.body?.removeAttribute('data-route-pending-title');
    document.body?.removeAttribute('data-route-pending-kind');
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
    startRoutePending(locale, href);
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
    startRoutePending(locale, fallbackHref);
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
