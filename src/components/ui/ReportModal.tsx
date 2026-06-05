'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getReportModalLabels } from '@/lib/visitorInfoI18n';
import { PencilIcon } from '@/components/ui/Icons';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (message: string) => void;
    locale: string;
    targetName?: string;
}

export default function ReportModal({ isOpen, onClose, onSubmit, locale, targetName }: ReportModalProps) {
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [closing, setClosing] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const labels = getReportModalLabels(locale);

    // Reset closing state when modal opens
    useEffect(() => {
        if (isOpen) setClosing(false);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleClose = () => {
        setClosing(true);
        setTimeout(() => onClose(), 250);
    };

    const handleSubmit = async () => {
        if (!message.trim()) return;
        setSending(true);
        await onSubmit(message.trim());
        setSending(false);
        setMessage('');
        handleClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end justify-center" onClick={handleClose}>
            {/* Backdrop */}
            <div className={`absolute inset-0 bg-black/40 backdrop-blur-sm ${closing ? 'animate-fadeOut' : 'animate-backdropIn'}`} />

            {/* Modal */}
            <div
                className={`relative w-full sm:max-w-[440px] glass-popup gradient-border rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 ${closing ? 'animate-slideOutDown' : 'animate-slideUp'}`}
                style={{ boxShadow: 'var(--glass-shadow-lg)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center">
                            <PencilIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-extrabold dark:text-white">
                                {labels.title}
                            </h3>
                            {targetName && (
                                <p className="text-[10px] text-gray-400 font-bold mt-0.5 truncate max-w-[250px]">{targetName}</p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-8 h-8 rounded-full bg-white/50 dark:bg-white/10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white/70 dark:hover:bg-white/20 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Textarea */}
                <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder={labels.placeholder}
                    className="w-full h-28 p-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-white/40 dark:border-white/10 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-neutral-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 transition-all"
                    onFocus={() => {
                        setTimeout(() => {
                            textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 300);
                    }}
                />

                {/* Submit */}
                <button
                    onClick={handleSubmit}
                    disabled={!message.trim() || sending}
                    className="mt-4 w-full py-3.5 rounded-2xl gradient-btn disabled:bg-gray-200 dark:disabled:bg-neutral-700 disabled:text-gray-400 dark:disabled:text-neutral-500 text-sm font-bold transition-all active:scale-[0.98] shadow-lg disabled:shadow-none disabled:opacity-60"
                >
                    {sending ? labels.sending : labels.submit}
                </button>

                <p className="text-[10px] text-gray-300 dark:text-neutral-600 text-center mt-3">
                    {labels.note}
                </p>
            </div>
        </div>,
        document.body
    );
}
