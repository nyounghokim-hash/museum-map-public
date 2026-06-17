'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

        const clearServiceWorkerShell = async () => {
            try {
                const cleanupKey = 'mm-sw-cleaned-v4';
                if (localStorage.getItem(cleanupKey) === '1') return;
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map((registration) => registration.unregister()));
                if ('caches' in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.filter((key) => key.startsWith('mm-')).map((key) => caches.delete(key)));
                }
                localStorage.setItem(cleanupKey, '1');
                const reloadKey = 'mm-sw-cleared-v4';
                if (registrations.length > 0 && !sessionStorage.getItem(reloadKey)) {
                    sessionStorage.setItem(reloadKey, '1');
                    window.location.reload();
                }
            } catch {
                // If cleanup fails, keep running without blocking the app.
            }
        };

        // Temporarily disable the service worker. A stale app-shell cache can mix
        // old CSS with new React markup and break the mobile map layout.
        clearServiceWorkerShell();
    }, []);

    return null;
}
