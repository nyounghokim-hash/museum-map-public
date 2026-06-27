'use client';

import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';

type DragDownDismissOptions = {
    enabled?: boolean;
    threshold?: number;
    scrollableSelector?: string;
};

type DragState = {
    active: boolean;
    dragging: boolean;
    startX: number;
    startY: number;
    pointerId: number | null;
    blockedByScroll: boolean;
    root: HTMLElement | null;
};

const DEFAULT_SCROLLABLE_SELECTOR = [
    '[data-drag-dismiss-scroll]',
    '.mm-map2-new-museums-popover',
    '.mm-map2-new-museums-list',
    '.mm-map2-category-menu-grid',
    '.mm-map2-side-menu',
    '.mm-nearby-popup2-scroll',
    '.mm-weather-popup2-body',
].join(',');

function findScrollableElement(target: EventTarget | null, root: HTMLElement, selector: string): HTMLElement | null {
    if (!(target instanceof HTMLElement)) return null;
    const selected = target.closest(selector);
    if (selected instanceof HTMLElement && root.contains(selected)) return selected;

    let node: HTMLElement | null = target;
    while (node && node !== root.parentElement) {
        if (root.contains(node) && node.scrollHeight > node.clientHeight + 2) {
            const overflowY = window.getComputedStyle(node).overflowY;
            if (overflowY === 'auto' || overflowY === 'scroll') return node;
        }
        if (node === root) break;
        node = node.parentElement;
    }
    return null;
}

function resetDraggedRoot(root: HTMLElement | null) {
    if (!root) return;
    root.style.transform = '';
    root.style.opacity = '';
    root.style.transition = '';
}

export function useDragDownDismiss(onDismiss: () => void, options: DragDownDismissOptions = {}) {
    const enabled = options.enabled ?? true;
    const threshold = options.threshold ?? 48;
    const scrollableSelector = options.scrollableSelector ?? DEFAULT_SCROLLABLE_SELECTOR;
    const suppressClickRef = useRef(false);
    const stateRef = useRef<DragState>({
        active: false,
        dragging: false,
        startX: 0,
        startY: 0,
        pointerId: null,
        blockedByScroll: false,
        root: null,
    });

    const finish = useCallback((clientX: number, clientY: number) => {
        const state = stateRef.current;
        if (!state.active) return;

        const dx = clientX - state.startX;
        const dy = clientY - state.startY;
        const absDx = Math.abs(dx);
        const shouldDismiss = !state.blockedByScroll && dy >= threshold && dy > absDx * 1.15;
        const root = state.root;

        if (shouldDismiss) {
            suppressClickRef.current = true;
            resetDraggedRoot(root);
            onDismiss();
            window.setTimeout(() => {
                suppressClickRef.current = false;
            }, 180);
        } else if (state.dragging && root) {
            root.style.transition = 'transform 160ms ease, opacity 160ms ease';
            root.style.transform = '';
            root.style.opacity = '';
            window.setTimeout(() => {
                if (stateRef.current.root === root) root.style.transition = '';
            }, 170);
        }

        stateRef.current = {
            active: false,
            dragging: false,
            startX: 0,
            startY: 0,
            pointerId: null,
            blockedByScroll: false,
            root: null,
        };
    }, [onDismiss, threshold]);

    const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        if (!enabled) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        const root = event.currentTarget;
        const scrollable = findScrollableElement(event.target, root, scrollableSelector);
        stateRef.current = {
            active: true,
            dragging: false,
            startX: event.clientX,
            startY: event.clientY,
            pointerId: event.pointerId,
            blockedByScroll: Boolean(scrollable && scrollable.scrollTop > 2),
            root,
        };
    }, [enabled, scrollableSelector]);

    const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        const state = stateRef.current;
        if (!state.active || state.pointerId !== event.pointerId || state.blockedByScroll || !state.root) return;

        const dx = event.clientX - state.startX;
        const dy = event.clientY - state.startY;
        const absDx = Math.abs(dx);
        if (dy <= 8 || dy <= absDx * 1.1) return;

        state.dragging = true;
        const dragY = Math.min(dy, 120);
        const visualY = Math.round(dragY * 0.42);
        const opacity = Math.max(0.72, 1 - dragY / 360);
        state.root.style.transition = 'none';
        state.root.style.transform = `translate3d(0, ${visualY}px, 0) scale(${1 - Math.min(dragY, 120) * 0.0006})`;
        state.root.style.opacity = `${opacity}`;
    }, []);

    const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        finish(event.clientX, event.clientY);
    }, [finish]);

    const onPointerCancel = useCallback(() => {
        const state = stateRef.current;
        if (state.dragging && state.root) resetDraggedRoot(state.root);
        stateRef.current = {
            active: false,
            dragging: false,
            startX: 0,
            startY: 0,
            pointerId: null,
            blockedByScroll: false,
            root: null,
        };
    }, []);

    const onClickCapture = useCallback((event: ReactMouseEvent<HTMLElement>) => {
        if (!suppressClickRef.current) return;
        event.preventDefault();
        event.stopPropagation();
    }, []);

    return {
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        onClickCapture,
    };
}
