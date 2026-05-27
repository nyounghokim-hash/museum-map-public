'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

        // Register SW after page load to not block initial render
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then((reg) => {
                    reg.update().catch(() => { });
                    // Check for updates periodically (every 60 min)
                    setInterval(() => reg.update(), 60 * 60 * 1000);
                })
                .catch(() => {
                    // SW registration failed — app works fine without it
                });
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            // Do not force-reload on first control after a new deployment.
            // On mobile this made the splash screen appear to restart and flicker.
        });
    }, []);

    return null;
}
