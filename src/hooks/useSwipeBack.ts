'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * useSwipeBack - 왼쪽 가장자리에서 오른쪽으로 스와이프하면 뒤로가기
 * iOS Safari 스타일 제스처. touch + pointer 이벤트 모두 지원.
 * 
 * onSwipeRight 옵션이 있으면 전체 화면에서 오른쪽 스와이프 시 해당 콜백 실행
 * (예: 박물관 상세 → 지도 이동)
 */
export function useSwipeBack(options?: {
    threshold?: number;
    edgeWidth?: number;
    onSwipeRight?: () => void;  // 전체 화면 오른쪽 스와이프 콜백
}) {
    const router = useRouter();
    const threshold = options?.threshold ?? 60;
    const edgeWidth = options?.edgeWidth ?? 40;
    const onSwipeRight = options?.onSwipeRight;

    const startX = useRef(0);
    const startY = useRef(0);
    const isActive = useRef(false);
    const isEdge = useRef(false);

    const onStart = useCallback((clientX: number, clientY: number) => {
        isActive.current = true;
        startX.current = clientX;
        startY.current = clientY;
        isEdge.current = clientX <= edgeWidth;
    }, [edgeWidth]);

    const onEnd = useCallback((clientX: number, clientY: number) => {
        if (!isActive.current) return;

        const deltaX = clientX - startX.current;
        const deltaY = Math.abs(clientY - startY.current);

        if (deltaX > threshold && deltaX > deltaY) {
            if (onSwipeRight && !isEdge.current) {
                // 전체 화면 스와이프 → 콜백 (지도 이동 등)
                onSwipeRight();
            } else {
                // 가장자리 스와이프 → 뒤로가기
                router.back();
            }
        }

        isActive.current = false;
        isEdge.current = false;
    }, [router, threshold, onSwipeRight]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // 데이터 속성 [data-no-swipe-back] 조상에서 시작한 제스처는 무시 (이미지 캐러셀 등)
        const isInOptOut = (target: EventTarget | null) => {
            const el = target as HTMLElement | null;
            return !!(el && typeof el.closest === 'function' && el.closest('[data-no-swipe-back]'));
        };

        // Touch events (mobile)
        const handleTouchStart = (e: TouchEvent) => {
            if (isInOptOut(e.target)) { isActive.current = false; return; }
            onStart(e.touches[0].clientX, e.touches[0].clientY);
        };
        const handleTouchEnd = (e: TouchEvent) => {
            onEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        };

        // Pointer events (desktop + mobile fallback)
        let pointerDown = false;
        const handlePointerDown = (e: PointerEvent) => {
            if (isInOptOut(e.target)) { pointerDown = false; isActive.current = false; return; }
            pointerDown = true;
            onStart(e.clientX, e.clientY);
        };
        const handlePointerUp = (e: PointerEvent) => {
            if (!pointerDown) return;
            pointerDown = false;
            onEnd(e.clientX, e.clientY);
        };

        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });
        document.addEventListener('pointerdown', handlePointerDown, { passive: true });
        document.addEventListener('pointerup', handlePointerUp, { passive: true });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchend', handleTouchEnd);
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('pointerup', handlePointerUp);
        };
    }, [onStart, onEnd]);
}
