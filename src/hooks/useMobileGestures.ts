'use client';
import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Swipe-to-go-back gesture (left edge → right swipe)
 * Only triggers from the left 30px edge of the screen
 */
export function useSwipeBack() {
    const router = useRouter();
    const touchStart = useRef<{ x: number; y: number } | null>(null);
    const indicator = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const isMobile = () => window.innerWidth < 1024;
        const EDGE_WIDTH = 30; // px from left edge
        const THRESHOLD = 100; // px to trigger back

        const createIndicator = () => {
            if (indicator.current) return indicator.current;
            const el = document.createElement('div');
            el.style.cssText = 'position:fixed;top:50%;left:0;transform:translateY(-50%);z-index:99999;width:32px;height:32px;border-radius:50%;background:rgba(128,90,213,0.3);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.15s;pointer-events:none;';
            el.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5m0 0l7 7m-7-7l7-7"/></svg>';
            document.body.appendChild(el);
            indicator.current = el;
            return el;
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (!isMobile()) return;
            const touch = e.touches[0];
            if (touch.clientX <= EDGE_WIDTH) {
                touchStart.current = { x: touch.clientX, y: touch.clientY };
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!touchStart.current || !isMobile()) return;
            const touch = e.touches[0];
            const dx = touch.clientX - touchStart.current.x;
            const dy = touch.clientY - touchStart.current.y;

            if (Math.abs(dx) > Math.abs(dy) && dx > 10) {
                const el = createIndicator();
                const progress = Math.min(dx / THRESHOLD, 1);
                el.style.opacity = `${progress}`;
                el.style.left = `${Math.min(dx - 16, 50)}px`;
                el.style.width = `${32 + progress * 8}px`;
                el.style.height = `${32 + progress * 8}px`;
                el.style.background = progress >= 1
                    ? 'rgba(128,90,213,0.7)'
                    : 'rgba(128,90,213,0.3)';
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (!touchStart.current || !isMobile()) return;
            const touch = e.changedTouches[0];
            const dx = touch.clientX - touchStart.current.x;
            const dy = touch.clientY - touchStart.current.y;

            // Cleanup indicator
            if (indicator.current) {
                indicator.current.style.opacity = '0';
            }

            if (dx > THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
                router.back();
            }

            touchStart.current = null;
        };

        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: true });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
            if (indicator.current) {
                indicator.current.remove();
                indicator.current = null;
            }
        };
    }, [router]);
}

/**
 * Pull-to-refresh gesture  
 * Only triggers when scrolled to top and pulling down
 */
export function usePullToRefresh() {
    const touchStart = useRef<{ y: number; scrollTop: number } | null>(null);
    const refreshIndicator = useRef<HTMLDivElement | null>(null);
    const isRefreshing = useRef(false);

    useEffect(() => {
        const isMobile = () => window.innerWidth < 1024;
        const THRESHOLD = 80;

        const createRefreshIndicator = () => {
            if (refreshIndicator.current) return refreshIndicator.current;
            const el = document.createElement('div');
            el.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%) translateY(-60px);z-index:99999;width:40px;height:40px;border-radius:50%;background:rgba(128,90,213,0.9);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);pointer-events:none;box-shadow:0 2px 12px rgba(0,0,0,0.15);';
            el.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>';
            document.body.appendChild(el);
            refreshIndicator.current = el;
            return el;
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (!isMobile() || isRefreshing.current) return;
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            if (scrollTop <= 5) {
                touchStart.current = { y: e.touches[0].clientY, scrollTop };
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!touchStart.current || !isMobile() || isRefreshing.current) return;
            const dy = e.touches[0].clientY - touchStart.current.y;

            if (dy > 10 && window.scrollY <= 5) {
                const el = createRefreshIndicator();
                const progress = Math.min(dy / THRESHOLD, 1.2);
                const translateY = Math.min(dy * 0.4, 80);
                el.style.transform = `translateX(-50%) translateY(${translateY}px) rotate(${progress * 360}deg)`;
                el.style.opacity = `${Math.min(progress, 1)}`;

                if (progress >= 1) {
                    el.style.background = 'rgba(128,90,213,1)';
                } else {
                    el.style.background = 'rgba(128,90,213,0.6)';
                }
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (!touchStart.current || !isMobile() || isRefreshing.current) return;
            const dy = e.changedTouches[0].clientY - touchStart.current.y;

            if (dy > THRESHOLD && window.scrollY <= 5) {
                isRefreshing.current = true;
                const el = createRefreshIndicator();
                // Spin animation
                el.style.transition = 'none';
                el.style.transform = 'translateX(-50%) translateY(50px)';
                el.style.opacity = '1';

                let rotation = 0;
                const spin = setInterval(() => {
                    rotation += 20;
                    if (el) el.style.transform = `translateX(-50%) translateY(50px) rotate(${rotation}deg)`;
                }, 30);

                // Reload after brief delay
                setTimeout(() => {
                    clearInterval(spin);
                    window.location.reload();
                }, 500);
            } else {
                // Snap back
                if (refreshIndicator.current) {
                    refreshIndicator.current.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
                    refreshIndicator.current.style.transform = 'translateX(-50%) translateY(-60px)';
                    refreshIndicator.current.style.opacity = '0';
                }
            }

            touchStart.current = null;
        };

        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
            if (refreshIndicator.current) {
                refreshIndicator.current.remove();
                refreshIndicator.current = null;
            }
        };
    }, []);
}
