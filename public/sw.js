// Museum Map — Service Worker for Offline Support
const CACHE_VERSION = 'mm-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Static assets to precache on install
const PRECACHE_URLS = [
    '/offline',
    '/manifest.json',
];

// Cache size limits
const IMAGE_CACHE_LIMIT = 200;
const API_CACHE_LIMIT = 100;
const DYNAMIC_CACHE_LIMIT = 50;

// ── Install: precache essential assets ──
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            return cache.addAll(PRECACHE_URLS);
        }).then(() => self.skipWaiting())
    );
});

// ── Activate: clean old caches ──
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key.startsWith('mm-') && key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== IMAGE_CACHE && key !== API_CACHE)
                    .map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// ── Trim cache to limit ──
async function trimCache(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
        await cache.delete(keys[0]);
        return trimCache(cacheName, maxItems);
    }
}

// ── Fetch strategies ──
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip external requests (analytics, auth, etc.)
    if (url.origin !== self.location.origin && !url.hostname.includes('supabase')) return;

    // Skip NextAuth and API mutations
    if (url.pathname.startsWith('/api/auth')) return;

    // Strategy 1: Cache-first for images (Supabase + static)
    if (request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|webp|svg|gif|ico)$/i) || url.hostname.includes('supabase')) {
        event.respondWith(cacheFirst(request, IMAGE_CACHE, IMAGE_CACHE_LIMIT));
        return;
    }

    // Strategy 2: Stale-while-revalidate for API data
    if (url.pathname.startsWith('/api/museums') || url.pathname.startsWith('/api/saves') || url.pathname.startsWith('/api/collections')) {
        event.respondWith(staleWhileRevalidate(request, API_CACHE, API_CACHE_LIMIT));
        return;
    }

    // Strategy 3: Cache-first for static assets (JS, CSS, fonts)
    if (request.destination === 'script' || request.destination === 'style' || request.destination === 'font' ||
        url.pathname.startsWith('/_next/static')) {
        event.respondWith(cacheFirst(request, STATIC_CACHE));
        return;
    }

    // Strategy 4: Network-first for HTML pages with offline fallback
    if (request.destination === 'document' || request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(networkFirstWithFallback(request));
        return;
    }

    // Default: network-first for everything else
    event.respondWith(networkFirst(request, DYNAMIC_CACHE, DYNAMIC_CACHE_LIMIT));
});

// ── Cache-first: serve from cache, fallback to network ──
async function cacheFirst(request, cacheName, limit) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
            if (limit) trimCache(cacheName, limit);
        }
        return response;
    } catch {
        return new Response('', { status: 408, statusText: 'Offline' });
    }
}

// ── Stale-while-revalidate: serve cached, update in background ──
async function staleWhileRevalidate(request, cacheName, limit) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
            cache.put(request, response.clone());
            if (limit) trimCache(cacheName, limit);
        }
        return response;
    }).catch(() => cached || new Response(JSON.stringify({ data: null, offline: true }), {
        headers: { 'Content-Type': 'application/json' }
    }));

    return cached || fetchPromise;
}

// ── Network-first with offline page fallback ──
async function networkFirstWithFallback(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        return caches.match('/offline');
    }
}

// ── Network-first: try network, fallback to cache ──
async function networkFirst(request, cacheName, limit) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
            if (limit) trimCache(cacheName, limit);
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        return cached || new Response('', { status: 408, statusText: 'Offline' });
    }
}
