// Museum Map service worker kill switch.
// The app no longer uses an app-shell service worker because stale shell/API
// caches can mix old route code with a newer deployment and break navigation.

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        try {
            const keys = await caches.keys();
            await Promise.all(keys.filter((key) => key.startsWith('mm-')).map((key) => caches.delete(key)));
        } catch { }

        try {
            await self.registration.unregister();
        } catch { }

        try {
            const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
            for (const client of clients) {
                client.postMessage({ type: 'MM_SERVICE_WORKER_DISABLED' });
            }
        } catch { }
    })());
});
