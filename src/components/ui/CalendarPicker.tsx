'use client';
import { useState, useMemo } from 'react';

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAYS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_KO = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const MONTHS_JA = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function getWeekdays(locale: string) {
    if (locale === 'ko') return WEEKDAYS_KO;
    if (locale === 'ja') return WEEKDAYS_JA;
    return WEEKDAYS_EN;
}

function getMonthLabel(locale: string, month: number, year: number) {
    if (locale === 'ko') return `${year}년 ${MONTHS_KO[month]}`;
    if (locale === 'ja') return `${year}年 ${MONTHS_JA[month]}`;
    if (locale === 'zh-TW' || locale === 'zh-CN') return `${year}年 ${month + 1}月`;
    return `${MONTHS_EN[month]} ${year}`;
}

interface CalendarPickerProps {
    value?: string; // YYYY-MM-DD (single mode)
    onChange: (date: string) => void;
    locale?: string;
    minDate?: string;
    // Range mode
    rangeMode?: boolean;
    startDate?: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD
    onRangeChange?: (start: string, end: string | null) => void;
}

export default function CalendarPicker({ value, onChange, locale = 'en', minDate, rangeMode, startDate, endDate, onRangeChange }: CalendarPickerProps) {
    const today = new Date();
    const initialDate = rangeMode
        ? (startDate ? new Date(startDate + 'T00:00:00') : today)
        : (value ? new Date(value + 'T00:00:00') : today);
    const [viewYear, setViewYear] = useState(initialDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

    const selectedStr = value || '';
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const days = useMemo(() => {
        const firstDay = new Date(viewYear, viewMonth, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

        const cells: { day: number; dateStr: string; isCurrentMonth: boolean; isPast: boolean }[] = [];

        // Previous month padding
        for (let i = firstDay - 1; i >= 0; i--) {
            const d = daysInPrevMonth - i;
            const m = viewMonth === 0 ? 12 : viewMonth;
            const y = viewMonth === 0 ? viewYear - 1 : viewYear;
            const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            cells.push({ day: d, dateStr, isCurrentMonth: false, isPast: minDate ? dateStr < minDate : false });
        }

        // Current month
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            cells.push({ day: d, dateStr, isCurrentMonth: true, isPast: minDate ? dateStr < minDate : false });
        }

        // Next month padding (fill to complete row)
        const remaining = 7 - (cells.length % 7);
        if (remaining < 7) {
            for (let d = 1; d <= remaining; d++) {
                const m = viewMonth === 11 ? 1 : viewMonth + 2;
                const y = viewMonth === 11 ? viewYear + 1 : viewYear;
                const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                cells.push({ day: d, dateStr, isCurrentMonth: false, isPast: false });
            }
        }

        return cells;
    }, [viewYear, viewMonth, minDate]);

    const goToPrevMonth = () => {
        if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
        else setViewMonth(m => m - 1);
    };

    const goToNextMonth = () => {
        if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
        else setViewMonth(m => m + 1);
    };

    const handleDayClick = (dateStr: string) => {
        if (rangeMode && onRangeChange) {
            if (!startDate || (startDate && endDate)) {
                // No start or both set → new start
                onRangeChange(dateStr, null);
            } else {
                // Start set, no end
                if (dateStr < startDate) {
                    // Clicked before start → reset to new start
                    onRangeChange(dateStr, null);
                } else if (dateStr === startDate) {
                    // Same day → clear
                    onRangeChange(dateStr, null);
                } else {
                    // Set end
                    onRangeChange(startDate, dateStr);
                }
            }
        } else {
            onChange(dateStr);
        }
    };

    const weekdays = getWeekdays(locale);

    return (
        <div className="glass-panel rounded-2xl p-4 select-none">
            {/* Range display */}
            {rangeMode && startDate && (
                <div className="flex items-center gap-2 mb-3 text-xs font-bold">
                    <span className="px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                        {new Date(startDate + 'T00:00:00').toLocaleDateString(locale === 'ko' ? 'ko-KR' : locale, { month: 'short', day: 'numeric' })}
                    </span>
                    {endDate && (
                        <>
                            <span className="text-gray-300 dark:text-gray-600">→</span>
                            <span className="px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                {new Date(endDate + 'T00:00:00').toLocaleDateString(locale === 'ko' ? 'ko-KR' : locale, { month: 'short', day: 'numeric' })}
                            </span>
                        </>
                    )}
                </div>
            )}
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <button type="button" onClick={goToPrevMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-gray-400 transition-colors active:scale-95">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <span className="text-sm font-black dark:text-white tracking-tight">
                    {getMonthLabel(locale, viewMonth, viewYear)}
                </span>
                <button type="button" onClick={goToNextMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-gray-400 transition-colors active:scale-95">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-0 mb-1">
                {weekdays.map((wd, i) => (
                    <div key={wd} className={`text-center text-[10px] font-bold uppercase tracking-wider py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400 dark:text-neutral-500'}`}>
                        {wd}
                    </div>
                ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-0">
                {days.map((cell, i) => {
                    const isDisabled = cell.isPast;
                    let isSelected = false;
                    let isStart = false;
                    let isEnd = false;
                    let inRange = false;

                    if (rangeMode) {
                        isStart = cell.dateStr === startDate;
                        isEnd = cell.dateStr === endDate;
                        isSelected = isStart || isEnd;
                        if (startDate && endDate && cell.dateStr > startDate && cell.dateStr < endDate) {
                            inRange = true;
                        }
                    } else {
                        isSelected = cell.dateStr === selectedStr;
                    }

                    const isToday = cell.dateStr === todayStr;

                    return (
                        <button
                            key={i}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => { if (!isDisabled && cell.isCurrentMonth) handleDayClick(cell.dateStr); }}
                            className={`
                                relative w-full aspect-square flex items-center justify-center text-xs font-medium rounded-xl transition-all
                                ${!cell.isCurrentMonth ? 'text-gray-200 dark:text-neutral-700 cursor-default' : ''}
                                ${cell.isCurrentMonth && !isSelected && !inRange && !isDisabled ? 'text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer active:scale-90' : ''}
                                ${isSelected ? 'bg-purple-600 text-white font-black shadow-md shadow-purple-500/20 scale-105' : ''}
                                ${inRange && cell.isCurrentMonth ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-semibold' : ''}
                                ${isToday && !isSelected ? 'font-black text-purple-600 dark:text-purple-400' : ''}
                                ${isDisabled && cell.isCurrentMonth ? 'text-gray-300 dark:text-neutral-600 cursor-not-allowed line-through' : ''}
                            `}
                        >
                            {cell.day}
                            {isToday && !isSelected && (
                                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-purple-500" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
