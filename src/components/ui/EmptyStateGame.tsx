'use client';

import type { ReactNode } from 'react';

type EmptyStateGameProps = {
    locale?: string;
    title: string;
    description?: string;
    className?: string;
    compact?: boolean;
    children?: ReactNode;
};

export default function EmptyStateGame({ title, description, className = '', compact = false, children }: EmptyStateGameProps) {
    return (
        <div className={`col-span-full w-full py-14 sm:py-18 text-center ${className}`}>
            <div className={`mx-auto ${compact ? 'max-w-sm' : 'max-w-md'}`}>
                <p className="text-sm sm:text-base font-semibold leading-relaxed text-slate-500 dark:text-blue-100/65">{title}</p>
                {description && (
                    <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-400 dark:text-blue-100/45">{description}</p>
                )}
            </div>
            {children && <div className="mt-6">{children}</div>}
        </div>
    );
}
