'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
    onReorder: (fromIndex: number, toIndex: number) => void;
    longPressMs?: number;
    /** Shared key used to scope elementFromPoint lookup (data-drag-scope="..."). Falls back to data-drag-index only. */
    scope?: string;
}

/**
 * Long-press + drag reorder hook with pointer-capture semantics.
 *
 * Usage:
 *   const drag = useDragReorder({ onReorder: (from, to) => ... });
 *   <div
 *     data-drag-index={i}
 *     data-drag-scope={drag.scope}
 *     onPointerDown={e => drag.onPointerDown(i, e)}
 *     onPointerLeave={drag.cancelPress}
 *     onPointerCancel={drag.cancelPress}
 *     className="touch-none select-none"
 *   >
 *
 * Unlike onPointerEnter-based approaches, this tracks pointer movement at the
 * document level via elementFromPoint so it works on touch devices where
 * onPointerEnter fires only on initial contact.
 */
export function useDragReorder({ onReorder, longPressMs = 500, scope }: Options) {
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [overIndex, setOverIndex] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startPosRef = useRef<{ x: number; y: number } | null>(null);

    const cancelPress = useCallback(() => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    }, []);

    const onPointerDown = useCallback((index: number, e: React.PointerEvent) => {
        startPosRef.current = { x: e.clientX, y: e.clientY };
        cancelPress();
        longPressTimer.current = setTimeout(() => {
            setDragIndex(index);
            setOverIndex(index);
            setIsDragging(true);
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30);
            longPressTimer.current = null;
        }, longPressMs);
    }, [longPressMs, cancelPress]);

    // Cancel long-press if finger moves significantly before timer fires
    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (longPressTimer.current && startPosRef.current) {
            const dx = Math.abs(e.clientX - startPosRef.current.x);
            const dy = Math.abs(e.clientY - startPosRef.current.y);
            if (dx > 8 || dy > 8) cancelPress();
        }
    }, [cancelPress]);

    // Document-level pointermove → elementFromPoint → data-drag-index
    useEffect(() => {
        if (!isDragging) return;
        const findIdx = (x: number, y: number): number | null => {
            const el = document.elementFromPoint(x, y);
            if (!el) return null;
            let node: Element | null = el;
            while (node) {
                if (node instanceof HTMLElement && node.dataset.dragIndex !== undefined) {
                    if (scope && node.dataset.dragScope !== scope) { node = node.parentElement; continue; }
                    return Number(node.dataset.dragIndex);
                }
                node = node.parentElement;
            }
            return null;
        };
        const onMove = (e: PointerEvent) => {
            e.preventDefault();
            const idx = findIdx(e.clientX, e.clientY);
            if (idx !== null) setOverIndex(idx);
        };
        const onUp = () => {
            // Commit reorder
            setDragIndex(prev => {
                const target = overIndex;
                if (prev !== null && target !== null && prev !== target) {
                    onReorder(prev, target);
                }
                return null;
            });
            setOverIndex(null);
            setIsDragging(false);
            startPosRef.current = null;
        };
        document.addEventListener('pointermove', onMove, { passive: false });
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onUp);
        return () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.removeEventListener('pointercancel', onUp);
        };
    }, [isDragging, overIndex, onReorder, scope]);

    // Cleanup timer on unmount
    useEffect(() => () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }, []);

    return {
        dragIndex,
        overIndex,
        isDragging,
        onPointerDown,
        onPointerMove,
        cancelPress,
        scope,
    };
}
