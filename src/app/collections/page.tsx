'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import { useModal } from '@/components/ui/Modal';
import { t, Locale, formatDate, translateCategory } from '@/lib/i18n';
import * as gtag from '@/lib/gtag';
import { useTranslatedText } from '@/hooks/useTranslation';
import { getMuseumImageSrc } from '@/lib/getMuseumImage';

// Sub-component for translating collection titles
function TranslatedTitle({ text, locale }: { text: string; locale: string }) {
    const translated = useTranslatedText(text, locale as Locale);
    return <>{translated}</>;
}

export default function CollectionsPage() {
    const [tab, setTab] = useState<'my' | 'public'>('public');
    const [myCollections, setMyCollections] = useState<any[]>([]);
    const [publicCollections, setPublicCollections] = useState<any[]>([]);
    const [loadingMy, setLoadingMy] = useState(true);
    const [loadingPublic, setLoadingPublic] = useState(true);
    const { locale } = useApp();
    const { showConfirm, showAlert } = useModal();
    const { data: session } = useSession();
    const router = useRouter();

    useEffect(() => {
        fetch('/api/collections')
            .then(r => r.json())
            .then(res => { setMyCollections(res.data || []); setLoadingMy(false); })
            .catch(() => setLoadingMy(false));

        fetch('/api/collections?public=true')
            .then(r => r.json())
            .then(res => { setPublicCollections(res.data || []); setLoadingPublic(false); })
            .catch(() => setLoadingPublic(false));
    }, []);

    const handleDelete = (id: string) => {
        showConfirm(t('modal.deleteCollection', locale), async () => {
            await fetch(`/api/collections/${id}`, { method: 'DELETE' });
            setMyCollections(prev => prev.filter(c => c.id !== id));
        });
    };

    const collections = tab === 'my' ? myCollections : publicCollections;
    const loading = tab === 'my' ? loadingMy : loadingPublic;

    const tabLabel = (key: string) => {
        const labels: Record<string, Record<string, string>> = {
            my: { ko: '내 컬렉션', en: 'My Collections', ja: '私のコレクション', de: 'Meine Sammlungen', fr: 'Mes collections', es: 'Mis colecciones', pt: 'Minhas coleções', zh: '我的收藏', it: 'Le mie collezioni', ru: 'Мои коллекции', ar: 'مجموعاتي', hi: 'मेरे संग्रह', et: 'Minu kogud' },
            public: { ko: '공용 컬렉션', en: 'Public Collections', ja: '公開コレクション', de: 'Öffentliche Sammlungen', fr: 'Collections publiques', es: 'Colecciones públicas', pt: 'Coleções públicas', zh: '公共收藏', it: 'Collezioni pubbliche', ru: 'Публичные коллекции', ar: 'مجموعات عامة', hi: 'सार्वजनिक संग्रह', et: 'Avalikud kogud' },
        };
        return labels[key]?.[locale] || labels[key]?.['en'] || key;
    };

    // Swipe to switch tabs
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const handleSwipeStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    };
    const handleSwipeEnd = (e: React.TouchEvent) => {
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const dy = e.changedTouches[0].clientY - touchStartY.current;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx < 0 && tab === 'public') setTab('my');
            else if (dx > 0 && tab === 'my') setTab('public');
        }
    };

    return (
        <div
            className="no-back-swipe w-full lg:max-w-[1080px] mx-auto px-4 py-4 sm:px-6 sm:py-8 md:px-8 mt-4 sm:mt-8 pb-32 lg:pb-8"
            onTouchStart={handleSwipeStart}
            onTouchEnd={handleSwipeEnd}
        >
            <div className="mb-6 sm:mb-8">
                {loading ? (
                    <>
                        <div className="skeleton skeleton-title w-36 mb-2" />
                        <div className="skeleton skeleton-text w-56 mt-2" />
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                            <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-[0.2em]">Collection</span>
                            {collections.length > 0 && (
                                <span className="text-[10px] font-black text-gray-400 dark:text-neutral-500 bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">{collections.length}</span>
                            )}
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight dark:text-white">{t('collections.title', locale)}</h1>
                        <p className="text-gray-400 dark:text-neutral-500 mt-1 text-xs font-medium">{t('collections.subtitle', locale)}</p>
                    </>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-8">
                {(['public', 'my'] as const).map((key) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 ${tab === key
                            ? 'gradient-btn text-white shadow-lg'
                            : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                            }`}
                    >
                        {tabLabel(key)}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="skeleton-card p-5" style={{ borderColor: 'var(--glass-border)' }}>
                            <div className="skeleton h-6 rounded-lg w-3/5 mb-3" />
                            <div className="flex items-center gap-3 mt-2">
                                <div className="flex -space-x-2">
                                    {Array.from({ length: 4 }).map((_, idx) => (
                                        <div key={idx} className="skeleton w-7 h-7 rounded-full border-2 border-white dark:border-neutral-900" />
                                    ))}
                                </div>
                                <div className="skeleton h-4 rounded w-20" />
                                <div className="hidden sm:block skeleton h-5 rounded-full w-16" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : collections.length === 0 ? (
                <div className="py-20 text-center">
                    <div className="text-6xl mb-4">
                        {tab === 'my' ? (
                            <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                        ) : (
                            <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        )}
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                        {tab === 'my' ? t('collections.empty', locale) : t('collections.publicEmpty', locale)}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                        {tab === 'my' ? t('collections.emptyDesc', locale) : t('collections.publicEmptyDesc', locale)}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {collections.map((col: any) => (
                        <Link key={col.id} href={`/collections/${col.id}`}>
                            <div className="border rounded-xl p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group relative active:scale-[0.98]" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
                                {tab === 'my' && (
                                    <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(col.id); }}
                                        className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                )}
                                <div>
                                    <h3 className="text-lg font-bold group-hover:text-purple-600 dark:text-white dark:group-hover:text-purple-400 transition-colors leading-snug pr-8">{locale === 'ko' ? col.title : <TranslatedTitle text={col.title} locale={locale} />}</h3>
                                    {tab === 'public' && col.user?.name && (
                                        <span className="inline-block mt-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                                            {(col.user.email === 'nyongho.kim@gmail.com' || col.user.name === 'System Admin') ? 'MM Editor' : col.user.name.startsWith('guest_') ? (locale === 'ko' ? '익명' : 'Anonymous') : col.user.name}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-2 flex-wrap">
                                    {/* Thumbnail previews */}
                                    {col.items && col.items.length > 0 && (
                                        <div className="flex -space-x-2">
                                            {col.items.slice(0, 5).map((item: any, idx: number) => (
                                                <div key={idx} className="w-7 h-7 rounded-full border-2 border-white dark:border-neutral-900 overflow-hidden bg-gray-100 dark:bg-neutral-800 shrink-0 relative" title={item.museum?.name}>
                                                    {getMuseumImageSrc(item.museum) ? (
                                                        <img
                                                            src={getMuseumImageSrc(item.museum)!}
                                                            alt=""
                                                            className="w-full h-full object-cover opacity-0 transition-opacity duration-500"
                                                            onLoad={(e) => { (e.target as HTMLImageElement).classList.remove('opacity-0'); (e.target as HTMLImageElement).classList.add('opacity-100'); }}
                                                            onError={(e) => { e.currentTarget.src = '/logo.svg'; e.currentTarget.className = 'w-full h-full object-contain p-2 opacity-20 dark:invert dark:opacity-60'; }}
                                                        />
                                                    ) : (
                                                        <img src="/logo.svg" alt="" className="w-5 h-5 absolute inset-0 m-auto opacity-20 dark:invert dark:opacity-[0.6]" />
                                                    )}
                                                </div>
                                            ))}
                                            {(col._count?.items || 0) > 5 && (
                                                <div className="w-7 h-7 rounded-full border-2 border-white dark:border-neutral-900 bg-gray-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                                                    <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400">+{(col._count?.items || 0) - 5}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                        {col._count?.items || 0} {t('collections.items', locale)}
                                    </span>
                                    {/* Museum type category tags */}
                                    {col.items && col.items.length > 0 && (() => {
                                        const types = [...new Set(col.items.map((item: any) => item.museum?.type).filter(Boolean))];
                                        return (
                                            <>
                                                {types.length > 0 && (
                                                    <>
                                                        <span className="text-gray-300 dark:text-neutral-600">•</span>
                                                        {types.slice(0, 3).map((type: any) => (
                                                            <span key={type} className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full capitalize">
                                                                {translateCategory(type, locale)}
                                                            </span>
                                                        ))}
                                                    </>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {tab === 'my' && !loadingMy && (
                <div
                    onClick={() => {
                        if (session?.user?.name?.startsWith('guest_')) {
                            showConfirm(t('auth.loginRequired', locale), () => {
                                router.push('/login');
                            });
                        } else {
                            router.push('/collections/new');
                        }
                    }}
                    className="block mt-4"
                >
                    <div className="border-2 border-dashed border-purple-200 dark:border-purple-800/50 rounded-2xl p-6 flex flex-col items-center justify-center hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-all cursor-pointer group active:scale-[0.98]">
                        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 group-hover:bg-purple-600 dark:group-hover:bg-purple-600 flex items-center justify-center transition-colors mb-2">
                            <svg className="w-5 h-5 text-purple-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                        </div>
                        <span className="text-sm font-semibold text-purple-500 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">{t('collections.newCollection', locale)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
