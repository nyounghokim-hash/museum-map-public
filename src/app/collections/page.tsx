'use client';
import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import { useModal } from '@/components/ui/Modal';
import { t, Locale, translateCategory } from '@/lib/i18n';
import { useTranslatedText } from '@/hooks/useTranslation';
import { getMuseumImageSrc } from '@/lib/getMuseumImage';
import EmptyStateGame from '@/components/ui/EmptyStateGame';
import LoginRequiredModal from '@/components/ui/LoginRequiredModal';

const INITIAL_PUBLIC_COLLECTIONS = 40;
const PUBLIC_COLLECTIONS_INCREMENT = 40;
const COLLECTIONS_PUBLIC_CACHE_KEY = 'mm-public-collections-cache-v2';
const COLLECTIONS_CACHE_TTL_MS = 5 * 60 * 1000;

type PublicCollectionsCache = {
    ts?: number;
    data?: any[];
    hasMore?: boolean;
    nextOffset?: number | null;
    total?: number;
};

function readPublicCollectionsCache(): PublicCollectionsCache | null {
    if (typeof window === 'undefined') return null;
    try {
        const cached = JSON.parse(sessionStorage.getItem(COLLECTIONS_PUBLIC_CACHE_KEY) || 'null') as PublicCollectionsCache | null;
        if (cached?.data && Date.now() - (cached.ts || 0) < COLLECTIONS_CACHE_TTL_MS) return cached;
    } catch { }
    return null;
}

const SHOW_MORE_LABELS: Record<string, string> = {
    ko: '더 보기',
    en: 'Show more',
    ja: 'さらに表示',
    de: 'Mehr anzeigen',
    fr: 'Afficher plus',
    es: 'Ver más',
    pt: 'Ver mais',
    'zh-CN': '显示更多',
    'zh-TW': '顯示更多',
    da: 'Vis flere',
    fi: 'Näytä lisää',
    sv: 'Visa fler',
    et: 'Näita rohkem',
};

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
    const [loadingMorePublic, setLoadingMorePublic] = useState(false);
    const [publicHasMore, setPublicHasMore] = useState(false);
    const [publicNextOffset, setPublicNextOffset] = useState<number | null>(null);
    const [publicTotal, setPublicTotal] = useState(0);
    const [loginModalOpen, setLoginModalOpen] = useState(false);
    const { locale } = useApp();
    const { showConfirm } = useModal();
    const { data: session, status } = useSession();
    const router = useRouter();
    const isSignedInUser = status === 'authenticated' && !!session?.user && !session.user.name?.startsWith('guest_');

    useEffect(() => {
        try {
            const cached = readPublicCollectionsCache();
            if (cached?.data) {
                setPublicCollections(cached.data);
                setPublicHasMore(cached.hasMore ?? false);
                setPublicNextOffset(cached.nextOffset ?? null);
                setPublicTotal(cached.total || cached.data.length);
                setLoadingPublic(false);
                return;
            }
        } catch { }
        fetch(`/api/collections?public=true&limit=${INITIAL_PUBLIC_COLLECTIONS}`)
            .then(r => r.json())
            .then(res => {
                const payload = res.data || {};
                const data = Array.isArray(payload) ? payload : (payload.items || []);
                const hasMore = Array.isArray(payload) ? false : !!payload.hasMore;
                const nextOffset = Array.isArray(payload) ? null : (payload.nextOffset ?? null);
                const total = Array.isArray(payload) ? data.length : (payload.total || data.length);
                setPublicCollections(data);
                setPublicHasMore(hasMore);
                setPublicNextOffset(nextOffset);
                setPublicTotal(total);
                try { sessionStorage.setItem(COLLECTIONS_PUBLIC_CACHE_KEY, JSON.stringify({ ts: Date.now(), data, hasMore, nextOffset, total })); } catch { }
                setLoadingPublic(false);
            })
            .catch(() => setLoadingPublic(false));
    }, []);

    const loadMorePublicCollections = () => {
        if (loadingMorePublic || !publicHasMore || publicNextOffset == null) return;
        setLoadingMorePublic(true);
        fetch(`/api/collections?public=true&limit=${PUBLIC_COLLECTIONS_INCREMENT}&offset=${publicNextOffset}`)
            .then(r => r.json())
            .then(res => {
                const payload = res.data || {};
                const nextItems = Array.isArray(payload) ? payload : (payload.items || []);
                const hasMore = Array.isArray(payload) ? false : !!payload.hasMore;
                const nextOffset = Array.isArray(payload) ? null : (payload.nextOffset ?? null);
                const total = Array.isArray(payload) ? publicCollections.length + nextItems.length : (payload.total || publicTotal);
                setPublicCollections(prev => {
                    const merged = [...prev, ...nextItems];
                    try { sessionStorage.setItem(COLLECTIONS_PUBLIC_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: merged, hasMore, nextOffset, total })); } catch { }
                    return merged;
                });
                setPublicHasMore(hasMore);
                setPublicNextOffset(nextOffset);
                setPublicTotal(total);
            })
            .catch(() => { })
            .finally(() => setLoadingMorePublic(false));
    };

    useEffect(() => {
        if (tab !== 'my') {
            setLoadingMy(false);
            return;
        }
        if (status === 'loading') return;
        if (!isSignedInUser) {
            setMyCollections([]);
            setLoadingMy(false);
            return;
        }

        setLoadingMy(true);
        fetch('/api/collections')
            .then(r => r.json())
            .then(res => { setMyCollections(res.data || []); setLoadingMy(false); })
            .catch(() => setLoadingMy(false));
    }, [status, isSignedInUser, tab]);

    const handleDelete = (id: string) => {
        showConfirm(t('modal.deleteCollection', locale), async () => {
            await fetch(`/api/collections/${id}`, { method: 'DELETE' });
            setMyCollections(prev => prev.filter(c => c.id !== id));
        });
    };

    const collections = tab === 'my' ? myCollections : publicCollections;
    const loading = tab === 'my' ? loadingMy : loadingPublic;
    const visibleCollections = collections;
    const hasMorePublicCollections = tab === 'public' && publicHasMore;

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
    const openCollectionTab = (nextTab: 'my' | 'public') => {
        if (nextTab === 'my' && !isSignedInUser) {
            setLoginModalOpen(true);
            return;
        }
        setTab(nextTab);
    };

    const handleSwipeStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    };
    const handleSwipeEnd = (e: React.TouchEvent) => {
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const dy = e.changedTouches[0].clientY - touchStartY.current;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx < 0 && tab === 'public') openCollectionTab('my');
            else if (dx > 0 && tab === 'my') openCollectionTab('public');
        }
    };

    return (
        <div
            data-mm-page="collections"
            className="mm-nav-page-enter no-back-swipe mm-editorial-page2 mm-travel-page2 w-full lg:max-w-[960px] mx-auto px-4 pt-4 sm:px-6 sm:pt-8 md:px-8 pb-32 lg:pb-10"
            onTouchStart={handleSwipeStart}
            onTouchEnd={handleSwipeEnd}
        >
            <div className="mm-gallery-hero p-5 sm:p-7 mb-5 sm:mb-6">
                {loading ? (
                    <>
                        <div className="mm-skel-line w-24 mb-4 opacity-40" />
                        <div className="mm-skel-line h-8 w-44 mb-3 opacity-50" />
                        <div className="mm-skel-line w-64 opacity-40" />
                    </>
                ) : (
                    <>
                        <div className="mm-gallery-kicker mb-3">
                            Collection
                            {(tab === 'public' ? publicTotal : collections.length) > 0 && (
                                <span className="ml-2 rounded-full bg-white/12 px-2 py-0.5 text-[10px] text-blue-100">{tab === 'public' ? publicTotal : collections.length}</span>
                            )}
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">{t('collections.title', locale)}</h1>
                        <p className="text-blue-100/80 mt-2 text-sm font-medium">{t('collections.subtitle', locale)}</p>
                    </>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                {(['public', 'my'] as const).map((key) => (
                    <button
                        key={key}
                        onClick={() => openCollectionTab(key)}
                        className={`mm-gallery-chip flex-1 justify-center ${tab === key
                            ? 'is-active'
                            : ''
                            }`}
                    >
                        {tabLabel(key)}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex flex-col gap-3 sm:gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="mm-actual-skeleton p-5">
                            <div className="mm-skel-line h-6 w-3/5 mb-3" />
                            <div className="flex items-center gap-3 mt-2">
                                <div className="flex -space-x-2">
                                    {Array.from({ length: 4 }).map((_, idx) => (
                                        <div key={idx} className="mm-skel-circle w-7 h-7 border-2 border-white dark:border-neutral-900" />
                                    ))}
                                </div>
                                <div className="mm-skel-line w-20" />
                                <div className="hidden sm:block mm-skel-pill w-16" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : collections.length === 0 ? (
                <EmptyStateGame
                    locale={locale}
                    title={tab === 'my' ? t('collections.empty', locale) : t('collections.publicEmpty', locale)}
                    description={tab === 'my' ? t('collections.emptyDesc', locale) : t('collections.publicEmptyDesc', locale)}
                />
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {visibleCollections.map((col: any) => (
                            <a key={col.id} href={`/collections/${col.id}`}>
                                <div className="mm-collection-card2 p-4 sm:p-5 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group relative active:scale-[0.98]">
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
                                    <div className="min-w-0 pr-8 sm:pr-10">
                                        <div className="flex items-center gap-2">
                                            <h3 className="min-w-0 truncate text-base sm:text-lg font-bold group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400 transition-colors leading-snug">{locale === 'ko' ? col.title : <TranslatedTitle text={col.title} locale={locale} />}</h3>
                                            {col.isVisitedCollection && (
                                                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                    {locale === 'ko' ? '다녀간 컬렉션' : 'Visited'}
                                                </span>
                                            )}
                                            {Number(col.tripCount) > 0 && (
                                                <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                                                    {locale === 'ko' ? `여행 ${col.tripCount}회` : `${col.tripCount} trips`}
                                                </span>
                                            )}
                                            <span className="shrink-0 text-[10px] sm:text-xs font-bold text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                                                {col._count?.items || 0} {t('collections.items', locale)}
                                            </span>
                                        </div>
                                        {tab === 'public' && col.user?.name && (
                                            <span className="inline-block mt-1.5 text-[10px] font-bold text-gray-500 dark:text-blue-200/60 bg-gray-100 dark:bg-blue-950/40 px-2 py-0.5 rounded-full">
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
                                                                loading="lazy"
                                                                className="w-full h-full object-cover opacity-0 transition-opacity duration-500"
                                                                onLoad={(e) => { (e.target as HTMLImageElement).classList.remove('opacity-0'); (e.target as HTMLImageElement).classList.add('opacity-100'); }}
                                                                onError={(e) => { e.currentTarget.src = '/logo.svg'; e.currentTarget.className = 'w-full h-full object-contain p-2 opacity-20 dark:invert dark:opacity-60'; }}
                                                            />
                                                        ) : (
                                                            <img src="/logo.svg" alt="" loading="lazy" className="w-5 h-5 absolute inset-0 m-auto opacity-20 dark:invert dark:opacity-[0.6]" />
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
                                        {/* Museum type category tags */}
                                        {col.items && col.items.length > 0 && (() => {
                                            const types = [...new Set(col.items.map((item: any) => item.museum?.type).filter(Boolean))];
                                            return (
                                                <>
                                                    {types.length > 0 && (
                                                        <>
                                                            <span className="text-gray-300 dark:text-blue-900/50">•</span>
                                                            {types.slice(0, 3).map((type: any) => (
                                                                <span key={type} className="text-[10px] font-bold text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/25 px-2 py-0.5 rounded-full capitalize">
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
                            </a>
                        ))}
                    </div>
                    {hasMorePublicCollections && (
                        <button
                            type="button"
                            onClick={loadMorePublicCollections}
                            disabled={loadingMorePublic}
                            className="mm-gallery-chip mx-auto mt-5 flex justify-center px-5"
                        >
                            {loadingMorePublic ? (t('global.loading', locale) || 'Loading') : (SHOW_MORE_LABELS[locale] || SHOW_MORE_LABELS.en)}
                        </button>
                    )}
                </>
            )}

            {tab === 'my' && !loadingMy && (
                <div
                    onClick={() => {
                        if (!isSignedInUser) {
                            setLoginModalOpen(true);
                        } else {
                            router.push('/collections/new');
                        }
                    }}
                    className="block mt-4"
                >
                    <div className="mm-collection-create-card border-2 border-dashed border-blue-200 dark:border-blue-800/50 rounded-3xl p-6 flex flex-col items-center justify-center hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all cursor-pointer group active:scale-[0.98]">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 group-hover:bg-blue-600 dark:group-hover:bg-blue-600 flex items-center justify-center transition-colors mb-2">
                            <svg className="w-5 h-5 text-blue-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                        </div>
                        <span className="text-sm font-semibold text-blue-500 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">{t('collections.newCollection', locale)}</span>
                    </div>
                </div>
            )}
            <LoginRequiredModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} callbackUrl="/collections" />
        </div>
    );
}
