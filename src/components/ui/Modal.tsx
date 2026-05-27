'use client';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ModalState {
    type: 'alert' | 'confirm';
    title?: string;
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
}

interface ModalContextType {
    showAlert: (message: string, title?: string) => void;
    showConfirm: (message: string, onConfirm: () => void, title?: string) => void;
}

const ModalContext = createContext<ModalContextType | null>(null);

export function useModal() {
    const ctx = useContext(ModalContext);
    if (!ctx) throw new Error('useModal must be inside ModalProvider');
    return ctx;
}

// Locale-aware default labels
function getLocale(): string {
    if (typeof window === 'undefined') return 'en';
    return localStorage.getItem('locale') || navigator.language?.slice(0, 2) || 'en';
}

function getLabels() {
    const locale = getLocale();
    const labels: Record<string, { notice: string; confirm: string; ok: string; cancel: string }> = {
        ko: { notice: '알림', confirm: '확인', ok: '확인', cancel: '취소' },
        ja: { notice: 'お知らせ', confirm: '確認', ok: '確認', cancel: 'キャンセル' },
        zh: { notice: '通知', confirm: '确认', ok: '确定', cancel: '取消' },
        de: { notice: 'Hinweis', confirm: 'Bestätigen', ok: 'OK', cancel: 'Abbrechen' },
        fr: { notice: 'Avis', confirm: 'Confirmer', ok: 'OK', cancel: 'Annuler' },
        es: { notice: 'Aviso', confirm: 'Confirmar', ok: 'Aceptar', cancel: 'Cancelar' },
        en: { notice: 'Notice', confirm: 'Confirm', ok: 'OK', cancel: 'Cancel' },
    };
    return labels[locale] || labels['en'];
}

export function ModalProvider({ children }: { children: ReactNode }) {
    const [modal, setModal] = useState<ModalState | null>(null);

    const showAlert = useCallback((message: string, title?: string) => {
        setModal({ type: 'alert', message, title });
    }, []);

    const showConfirm = useCallback((message: string, onConfirm: () => void, title?: string) => {
        setModal({ type: 'confirm', message, title, onConfirm });
    }, []);

    const [closing, setClosing] = useState(false);
    const close = () => {
        setClosing(true);
        setTimeout(() => { setModal(null); setClosing(false); }, 200);
    };

    const labels = modal ? getLabels() : { notice: '', confirm: '', ok: '', cancel: '' };

    return (
        <ModalContext.Provider value={{ showAlert, showConfirm }}>
            {children}
            {modal && (
                <div className={`fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-sm ${closing ? 'animate-fadeOut' : 'animate-backdropIn'}`} onClick={close}>
                    <div
                        className={`glass-popup gradient-border rounded-2xl w-full max-w-sm mx-4 overflow-hidden ${closing ? 'animate-scaleDown' : 'animate-scaleUp'}`}
                        style={{ boxShadow: 'var(--glass-shadow-lg)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header with X */}
                        <div className="flex items-center justify-between px-5 pt-4 pb-0">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">{modal.title || (modal.type === 'confirm' ? labels.confirm : labels.notice)}</h3>
                            <button onClick={close} className="p-2 rounded-full bg-white/50 dark:bg-white/10 hover:bg-white/70 dark:hover:bg-white/20 transition-colors">
                                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        {/* Body */}
                        <div className="px-5 py-4">
                            <p className="text-sm text-gray-600 dark:text-gray-300">{modal.message}</p>
                        </div>
                        {/* Actions — gradient buttons */}
                        <div className="flex gap-2 px-5 pb-5">
                            {modal.type === 'confirm' && (
                                <button
                                    onClick={close}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200/60 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-white/40 dark:hover:bg-white/5 transition-colors"
                                >
                                    {labels.cancel}
                                </button>
                            )}
                            <button
                                onClick={() => { modal.onConfirm?.(); close(); }}
                                className="flex-1 py-2.5 rounded-xl text-sm font-bold gradient-btn"
                            >
                                <span className="relative z-10">{labels.ok}</span>
                                <div className="absolute inset-0 gradient-shimmer rounded-xl" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style jsx global>{`
                @keyframes scaleUp {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                @keyframes scaleDown {
                    from { transform: scale(1); opacity: 1; }
                    to { transform: scale(0.95); opacity: 0; }
                }
                .animate-scaleUp { animation: scaleUp 150ms ease-out; }
                .animate-scaleDown { animation: scaleDown 200ms ease-in forwards; }
            `}</style>
        </ModalContext.Provider>
    );
}
