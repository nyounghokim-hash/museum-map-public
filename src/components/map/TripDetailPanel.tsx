'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { t } from '@/lib/i18n';
import { useApp } from '@/components/AppContext';
import { getActiveTripForAccount, setActiveTripForAccount } from '@/lib/accountStorage';

interface TripStop {
    museumId: string;
    name: string;
    latitude: number;
    longitude: number;
    order: number;
}

interface TripData {
    planId: string;
    title: string;
    stops: TripStop[];
}

export default function TripDetailPanel({
    trip,
    onClose,
    onMuseumClick
}: {
    trip: TripData;
    onClose: () => void;
    onMuseumClick: (id: string) => void;
}) {
    const { locale } = useApp();
    const [stops, setStops] = useState(trip.stops);
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Drag state (same as plans/[id])
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [overIndex, setOverIndex] = useState<number | null>(null);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        setStops(trip.stops);
    }, [trip]);

    const handlePointerDown = useCallback((index: number) => {
        longPressTimer.current = setTimeout(() => {
            setDragIndex(index);
            setIsDragging(true);
            if (navigator.vibrate) navigator.vibrate(50);
        }, 500);
    }, []);

    const handlePointerUp = useCallback(() => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        if (isDragging && dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
            const newStops = [...stops];
            const [moved] = newStops.splice(dragIndex, 1);
            newStops.splice(overIndex, 0, moved);
            const updated = newStops.map((s, i) => ({ ...s, order: i }));
            setStops(updated);

            // Auto-save to localStorage
            if (typeof window !== 'undefined') {
                const parsed = getActiveTripForAccount();
                if (parsed) {
                    setActiveTripForAccount({ ...parsed, stops: updated });
                    window.dispatchEvent(new Event('storage'));
                }
            }
        }
        setDragIndex(null);
        setOverIndex(null);
        setIsDragging(false);
    }, [isDragging, dragIndex, overIndex, stops]);

    const handlePointerCancel = useCallback(() => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        setDragIndex(null);
        setOverIndex(null);
        setIsDragging(false);
    }, []);

    if (isCollapsed) {
        return (
            <div className="fixed top-20 right-4 sm:right-8 z-50">
                <button
                    onClick={() => setIsCollapsed(false)}
                    className="w-12 h-12 gradient-btn text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95 relative"
                    title={t('plans.viewActiveRoute', locale)}
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-neutral-900">
                        {stops.length}
                    </div>
                </button>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col pt-2 sm:pt-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 px-4 sm:px-0">
                <button
                    onClick={onClose}
                    className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded-full transition-colors shadow-sm active:scale-95 shrink-0"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                <button
                    onClick={() => setIsCollapsed(true)}
                    className="w-10 h-10 flex items-center justify-center bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded-full transition-colors shadow-sm active:scale-95 shrink-0"
                    title={locale === 'ko' ? '숨기기' : 'Collapse'}
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-neutral-950 sm:bg-white/80 sm:dark:bg-neutral-900/80 sm:backdrop-blur-xl sm:rounded-3xl sm:border sm:border-gray-100 sm:dark:border-neutral-800 sm:shadow-xl overflow-hidden">
                <div className="p-5 sm:p-6 flex-1 flex flex-col overflow-y-auto hide-scrollbar">
                    {/* Title section */}
                    <div className="mb-5 shrink-0">
                        <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                <svg className="w-3.5 h-3.5 text-purple-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                            </div>
                            <p className="text-xs font-bold tracking-widest text-purple-600 dark:text-purple-400 uppercase">
                                {t('plans.viewActiveRoute', locale)}
                            </p>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                            {trip.title}
                        </h1>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{stops.length} {t('plans.stops', locale)}</p>
                    </div>

                    {/* Stops list - same drag style as plans/[id] */}
                    <div className="space-y-3 relative flex-1">
                        <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-purple-100 dark:bg-purple-900/30" />

                        {stops.map((stop, i) => (
                            <div
                                key={stop.museumId + '-' + i}
                                className={`w-full flex gap-3 text-left group relative z-10 transition-all ${dragIndex === i ? 'opacity-50 scale-95' : ''} ${overIndex === i && dragIndex !== null && dragIndex !== i ? 'translate-y-1' : ''}`}
                                onPointerEnter={() => { if (isDragging) setOverIndex(i); }}
                            >
                                <div
                                    onPointerDown={() => handlePointerDown(i)}
                                    onPointerUp={handlePointerUp}
                                    onPointerCancel={handlePointerCancel}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 cursor-grab active:cursor-grabbing transition-all touch-none ${isDragging && dragIndex === i ? 'bg-purple-700 text-white shadow-lg scale-110' : 'bg-purple-500 text-white shadow-sm'}`}
                                >
                                    {i + 1}
                                </div>
                                <div
                                    onClick={() => onMuseumClick(stop.museumId)}
                                    className="flex-1 min-w-0 p-3.5 rounded-xl border bg-white dark:bg-neutral-900 border-gray-100 dark:border-neutral-800 shadow-sm hover:shadow-md hover:border-purple-200 dark:hover:border-purple-800 transition-all cursor-pointer"
                                >
                                    <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                                        {stop.name}
                                    </h3>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                        {t('global.viewDetails', locale as any) || 'View details'} →
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
