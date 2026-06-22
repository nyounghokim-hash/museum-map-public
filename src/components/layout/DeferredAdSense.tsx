'use client';

import { useEffect } from 'react';

const ADSENSE_SCRIPT_ID = 'adsbygoogle-js';
const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5736725257134757';
const MOBILE_DELAY_MS = 8000;
const DESKTOP_DELAY_MS = 3500;

type IdleWindow = Window & typeof globalThis & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (handle: number) => void;
};

export default function DeferredAdSense() {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'production') return;
        if (document.getElementById(ADSENSE_SCRIPT_ID)) return;

        const win = window as IdleWindow;
        let cancelled = false;
        let delayTimer: number | undefined;
        let idleId: number | undefined;

        const injectScript = () => {
            if (cancelled || document.getElementById(ADSENSE_SCRIPT_ID)) return;
            const script = document.createElement('script');
            script.id = ADSENSE_SCRIPT_ID;
            script.async = true;
            script.crossOrigin = 'anonymous';
            script.src = ADSENSE_SRC;
            document.head.appendChild(script);
        };

        const scheduleIdleInject = () => {
            if (cancelled) return;
            const isMobile = window.matchMedia('(max-width: 767px)').matches;
            const delay = isMobile ? MOBILE_DELAY_MS : DESKTOP_DELAY_MS;
            delayTimer = window.setTimeout(() => {
                if (document.visibilityState !== 'visible') return;
                if (typeof win.requestIdleCallback === 'function') {
                    idleId = win.requestIdleCallback(injectScript, { timeout: 3000 });
                } else {
                    injectScript();
                }
            }, delay);
        };

        const startWhenVisible = () => {
            if (document.visibilityState !== 'visible') return;
            document.removeEventListener('visibilitychange', startWhenVisible);
            scheduleIdleInject();
        };

        const startAfterLoad = () => {
            if (document.visibilityState === 'visible') {
                scheduleIdleInject();
            } else {
                document.addEventListener('visibilitychange', startWhenVisible);
            }
        };

        if (document.readyState === 'complete') {
            startAfterLoad();
        } else {
            window.addEventListener('load', startAfterLoad, { once: true });
        }

        return () => {
            cancelled = true;
            window.removeEventListener('load', startAfterLoad);
            document.removeEventListener('visibilitychange', startWhenVisible);
            if (delayTimer) window.clearTimeout(delayTimer);
            if (idleId && typeof win.cancelIdleCallback === 'function') win.cancelIdleCallback(idleId);
        };
    }, []);

    return null;
}
