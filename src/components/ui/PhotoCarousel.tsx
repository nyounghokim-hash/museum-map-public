'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface PhotoCarouselProps {
    photos: string[];
    alt: string;
    className?: string;
    children?: React.ReactNode; // overlay elements (back btn, etc)
}

/**
 * PhotoCarousel — 스와이프 + 도트 인디케이터 + 좌우 버튼
 * Museum 상세 히어로 이미지에 사용
 */
export default function PhotoCarousel({ photos, alt, className = '', children }: PhotoCarouselProps) {
    const [current, setCurrent] = useState(0);
    const [zoomOpen, setZoomOpen] = useState(false);
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [zoomDragOffset, setZoomDragOffset] = useState(0);
    const [isZoomDragging, setIsZoomDragging] = useState(false);
    const [heroLoaded, setHeroLoaded] = useState(false);
    const [loadedPhotos, setLoadedPhotos] = useState<Set<number>>(new Set());
    const containerRef = useRef<HTMLDivElement>(null);
    const zoomOverlayRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef(0);
    const zoomTouchStart = useRef({ x: 0, y: 0 });
    const zoomNativeTouchStart = useRef({ x: 0, y: 0 });

    const safePhotos = photos?.length > 0 ? photos : [];
    const total = safePhotos.length;

    const handlePhotoLoad = useCallback((index: number) => {
        setLoadedPhotos(prev => {
            if (prev.has(index)) return prev;
            const next = new Set(prev);
            next.add(index);
            return next;
        });
        if (index === 0) setHeroLoaded(true);
    }, []);

    const heroImageClass = (index: number, base = '') => {
        const loaded = loadedPhotos.has(index);
        return `${base} no-dissolve transition-[opacity,filter] duration-700 ease-out ${loaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'}`;
    };

    const goTo = useCallback((idx: number) => {
        setCurrent(Math.max(0, Math.min(idx, total - 1)));
    }, [total]);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        setIsDragging(true);
        setDragOffset(0);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const delta = e.touches[0].clientX - touchStartX.current;
        // Block vertical scroll when swiping horizontally
        if (Math.abs(delta) > 10) {
            e.preventDefault();
        }
        // Resist at edges
        if ((current === 0 && delta > 0) || (current === total - 1 && delta < 0)) {
            setDragOffset(delta * 0.3);
        } else {
            setDragOffset(delta);
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        if (Math.abs(dragOffset) > 50) {
            if (dragOffset < 0 && current < total - 1) goTo(current + 1);
            else if (dragOffset > 0 && current > 0) goTo(current - 1);
        }
        setDragOffset(0);
    };

    // Zoom modal: push history state to prevent back-swipe navigation
    const openZoom = useCallback(() => {
        setZoomOpen(true);
        window.history.pushState({ photoZoom: true }, '');
    }, []);

    const closeZoom = useCallback(() => {
        setZoomOpen(false);
    }, []);

    // iOS edge-swipe(뒤로가기) 차단:
    // 화면 왼쪽 25px 이내에서 시작된 터치는 preventDefault하여 브라우저 뒤로가기 대신
    // 캐러셀 스와이프로만 동작하도록 한다. React onTouchStart는 passive라 non-passive
    // 리스너를 직접 등록한다.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onTouchStart = (e: TouchEvent) => {
            const t = e.touches[0];
            if (!t) return;
            if (t.clientX < 25) {
                // 가장자리 시작 — 뒤로가기 유발 가능. 차단하고 자체 스와이프만 쓰도록.
                e.preventDefault();
            }
        };
        el.addEventListener('touchstart', onTouchStart, { passive: false });
        return () => el.removeEventListener('touchstart', onTouchStart);
    }, []);

    useEffect(() => {
        if (!zoomOpen) return;
        // Lock body scroll
        const originalOverflow = document.body.style.overflow;
        const originalOverscroll = document.body.style.overscrollBehavior;
        const originalTouchAction = document.body.style.touchAction;
        const originalHtmlOverscroll = document.documentElement.style.overscrollBehavior;
        document.body.style.overflow = 'hidden';
        document.body.style.overscrollBehavior = 'none';
        document.body.style.touchAction = 'none';
        document.documentElement.style.overscrollBehavior = 'none';
        const onTouchStart = (e: TouchEvent) => {
            const t = e.touches[0];
            if (!t) return;
            zoomNativeTouchStart.current = { x: t.clientX, y: t.clientY };
            if (t.clientX < 36 || t.clientX > window.innerWidth - 36) {
                e.preventDefault();
            }
        };
        const onTouchMove = (e: TouchEvent) => {
            const t = e.touches[0];
            if (!t) return;
            const dx = t.clientX - zoomNativeTouchStart.current.x;
            const dy = t.clientY - zoomNativeTouchStart.current.y;
            if (Math.abs(dx) > 4 && Math.abs(dx) >= Math.abs(dy)) {
                e.preventDefault();
            }
        };
        const onPop = (e: PopStateEvent) => {
            if (zoomOpen) {
                setZoomOpen(false);
            }
        };
        const overlay = zoomOverlayRef.current;
        overlay?.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });
        overlay?.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
        window.addEventListener('popstate', onPop);
        return () => {
            document.body.style.overflow = originalOverflow;
            document.body.style.overscrollBehavior = originalOverscroll;
            document.body.style.touchAction = originalTouchAction;
            document.documentElement.style.overscrollBehavior = originalHtmlOverscroll;
            overlay?.removeEventListener('touchstart', onTouchStart, { capture: true });
            overlay?.removeEventListener('touchmove', onTouchMove, { capture: true });
            window.removeEventListener('popstate', onPop);
        };
    }, [zoomOpen]);

    const handleCloseZoom = useCallback(() => {
        if (window.history.state?.photoZoom) {
            window.history.back(); // triggers popstate → close
        } else {
            setZoomOpen(false);
        }
    }, []);

    // Calculate transform for the track
    const containerWidth = containerRef.current?.offsetWidth || 0;
    const dragPercent = containerWidth > 0 ? (dragOffset / containerWidth) * 100 : 0;
    const trackTranslate = -(current * 100) + dragPercent;

    const ZoomModal = zoomOpen && typeof document !== 'undefined' ? createPortal(
        <div
            ref={zoomOverlayRef}
            data-photo-zoom
            className="fixed inset-0 z-[9999] bg-black flex items-center justify-center animate-fadeIn"
            style={{ touchAction: 'none', overscrollBehavior: 'none' }}
        >
            <button
                onClick={handleCloseZoom}
                className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center bg-white/10 backdrop-blur-md text-white rounded-full"
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            {/* Photo counter */}
            {total > 1 && (
                <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10 text-white/60 text-xs font-bold tracking-widest">
                    {current + 1} / {total}
                </div>
            )}
            {/* Prev/Next buttons */}
            {current > 0 && (
                <button
                    onClick={(e) => { e.stopPropagation(); goTo(current - 1); }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center bg-white/10 backdrop-blur-md text-white rounded-full hover:bg-white/20 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            )}
            {current < total - 1 && (
                <button
                    onClick={(e) => { e.stopPropagation(); goTo(current + 1); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center bg-white/10 backdrop-blur-md text-white rounded-full hover:bg-white/20 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}
            {/* Swipeable photo track */}
            <div
                className="w-full h-full overflow-hidden"
                style={{ touchAction: 'none' }}
                onTouchStart={(e) => {
                    e.stopPropagation();
                    zoomTouchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                    setIsZoomDragging(true);
                    setZoomDragOffset(0);
                }}
                onTouchMove={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const dx = e.touches[0].clientX - zoomTouchStart.current.x;
                    // Resist at edges
                    if ((current === 0 && dx > 0) || (current === total - 1 && dx < 0)) {
                        setZoomDragOffset(dx * 0.2);
                    } else {
                        setZoomDragOffset(dx);
                    }
                }}
                onTouchEnd={(e) => {
                    e.stopPropagation();
                    setIsZoomDragging(false);
                    const dx = zoomDragOffset;
                    const dy = e.changedTouches[0].clientY - zoomTouchStart.current.y;
                    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
                        if (dx < 0 && current < total - 1) goTo(current + 1);
                        else if (dx > 0 && current > 0) goTo(current - 1);
                    } else if (dy > 80 && Math.abs(dy) > Math.abs(dx)) {
                        handleCloseZoom();
                    }
                    setZoomDragOffset(0);
                }}
                onClick={handleCloseZoom}
            >
                <div
                    className={`flex h-full items-center ${isZoomDragging ? '' : 'transition-transform duration-300 ease-out'}`}
                    style={{
                        transform: `translateX(calc(${-(current * 100)}vw + ${zoomDragOffset}px))`,
                        width: `${total * 100}vw`,
                    }}
                >
                    {safePhotos.map((url, i) => (
                        <div key={i} className="flex items-center justify-center" style={{ width: '100vw', height: '100vh' }}>
                            <img
                                src={url}
                                alt={`${alt} ${i + 1}`}
                                className="max-w-[90vw] max-h-[85vh] object-contain no-dissolve"
                                draggable={false}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    if (total <= 1) {
        return (
            <div className={`relative overflow-hidden ${className}`}>
                {/* Skeleton shimmer while image loads */}
                {!heroLoaded && (
                    <div className="absolute inset-0 bg-gray-200 dark:bg-neutral-800">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent animate-shimmer" />
                    </div>
                )}
                {safePhotos[0] ? (
                    <img
                        src={safePhotos[0]} alt={alt}
                        className={heroImageClass(0, 'w-full h-full object-cover cursor-zoom-in')}
                        style={{ touchAction: 'none' }}
                        onClick={openZoom}
                        ref={(img) => { if (img?.complete && img.naturalWidth > 0) handlePhotoLoad(0); }}
                        onLoad={() => handlePhotoLoad(0)}
                        onError={() => handlePhotoLoad(0)}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-neutral-800">
                        <img src="/logo.svg" alt="" className="w-48 h-48 opacity-20 dark:invert dark:opacity-60" />
                    </div>
                )}
                {children}
                {ZoomModal}
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`relative overflow-hidden ${className}`}
            data-carousel="true"
            style={{ touchAction: 'none', overscrollBehaviorX: 'none' }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Skeleton shimmer while image loads */}
            {!heroLoaded && (
                <div className="absolute inset-0 bg-gray-200 dark:bg-neutral-800 z-[1]">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent animate-shimmer" />
                </div>
            )}
            {/* Photos track */}
            <div
                className={`flex h-full ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
                style={{ transform: `translateX(${trackTranslate}%)` }}
            >
                {safePhotos.map((url, i) => (
                    <img
                        key={i}
                        src={url}
                        alt={`${alt} ${i + 1}`}
                        className={heroImageClass(i, 'w-full h-full object-cover flex-shrink-0 cursor-zoom-in')}
                        draggable={false}
                        onClick={() => openZoom()}
                        ref={(img) => { if (img?.complete && img.naturalWidth > 0) handlePhotoLoad(i); }}
                        onLoad={() => handlePhotoLoad(i)}
                        onError={() => handlePhotoLoad(i)}
                    />
                ))}
            </div>

            {/* Dot indicators */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {safePhotos.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => goTo(i)}
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === current
                            ? 'bg-white w-4 shadow-md'
                            : 'bg-white/50 hover:bg-white/80'
                            }`}
                        aria-label={`Photo ${i + 1}`}
                    />
                ))}
            </div>

            {/* Left/Right buttons */}
            {current > 0 && (
                <button
                    onClick={() => goTo(current - 1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 flex items-center justify-center text-white/90 hover:text-white transition-all active:scale-90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            )}
            {current < total - 1 && (
                <button
                    onClick={() => goTo(current + 1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 flex items-center justify-center text-white/90 hover:text-white transition-all active:scale-90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}

            {/* Children overlay (back button, pick button, etc) */}
            {children}
            {ZoomModal}
        </div>
    );
}
