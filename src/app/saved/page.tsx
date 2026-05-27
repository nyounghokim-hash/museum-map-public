'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { GlassPanel } from '@/components/ui/glass';
import { useApp } from '@/components/AppContext';
import { useModal } from '@/components/ui/Modal';
import { t, translateCategory } from '@/lib/i18n';
import { getCountryName, getCityName } from '@/lib/countries';
import { getLocalizedMuseumName, getLocalizedCityName } from '@/lib/getLocalizedName';
import { getMuseumHistory, clearMuseumHistory } from '@/lib/museum-history';
import { useCompare } from '@/hooks/useCompare';
import * as gtag from '@/lib/gtag';

/* ── i18n for tabs & sort ── */
type L = Record<string, string>;
const ui: Record<string, L> = {
    tabSaved: { ko: '내 픽', en: 'My Pick', ja: 'お気に入り', de: 'Gespeichert', fr: 'Favoris', es: 'Guardados', pt: 'Salvos', 'zh-CN': '收藏', 'zh-TW': '收藏', da: 'Gemt', fi: 'Tallennettu', sv: 'Sparade', et: 'Salvestatud' },
    tabHistory: { ko: '살펴보기', en: 'Explored', ja: '閲覧履歴', de: 'Verlauf', fr: 'Consultés', es: 'Explorados', pt: 'Explorados', 'zh-CN': '浏览记录', 'zh-TW': '瀏覽紀錄', da: 'Udforsket', fi: 'Selattu', sv: 'Utforskade', et: 'Vaadatud' },
    sortNewest: { ko: '최신순', en: 'Newest', ja: '新しい順', de: 'Neueste', fr: 'Récents', es: 'Recientes', pt: 'Recentes', 'zh-CN': '最新', 'zh-TW': '最新', da: 'Nyeste', fi: 'Uusimmat', sv: 'Senaste', et: 'Uusimad' },
    sortRating: { ko: '별점순', en: 'Top Rated', ja: '評価順', de: 'Bestbewertet', fr: 'Mieux notés', es: 'Mejor valorados', pt: 'Melhor avaliados', 'zh-CN': '评分最高', 'zh-TW': '評分最高', da: 'Bedst bedømt', fi: 'Parhaat', sv: 'Bäst betyg', et: 'Parimad' },
    sortAlpha: { ko: '가나다순', en: 'A-Z', ja: '名前順', de: 'A-Z', fr: 'A-Z', es: 'A-Z', pt: 'A-Z', 'zh-CN': '字母顺序', 'zh-TW': '字母順序', da: 'A-Z', fi: 'A-Ö', sv: 'A-Ö', et: 'A-Z' },
    sortOldest: { ko: '오래된순', en: 'Oldest', ja: '古い順', de: 'Älteste', fr: 'Anciens', es: 'Antiguos', pt: 'Antigos', 'zh-CN': '最早', 'zh-TW': '最早', da: 'Ældste', fi: 'Vanhimmat', sv: 'Äldsta', et: 'Vanimad' },
    sortNearby: { ko: '위치순', en: 'Nearby', ja: '距離順', de: 'In der Nähe', fr: 'Proximité', es: 'Cercanos', pt: 'Próximos', 'zh-CN': '附近', 'zh-TW': '附近', da: 'Nærmeste', fi: 'Lähellä', sv: 'Nära', et: 'Lähedal' },
    noHistory: { ko: '아직 둘러본 미술관이 없어요', en: 'No museums explored yet', ja: 'まだ閲覧した美術館はありません', de: 'Noch keine Museen erkundet', fr: 'Aucun musée consulté', es: 'Aún no has explorado museos', pt: 'Nenhum museu explorado', 'zh-CN': '暂无浏览记录', 'zh-TW': '暫無瀏覽紀錄', da: 'Ingen museer udforsket endnu', fi: 'Ei selattuja museoita', sv: 'Inga utforskade museer', et: 'Pole veel vaadatud muuseume' },
    clearHistory: { ko: '기록 삭제', en: 'Clear', ja: '履歴削除', de: 'Löschen', fr: 'Effacer', es: 'Borrar', pt: 'Limpar', 'zh-CN': '清除', 'zh-TW': '清除', da: 'Ryd', fi: 'Tyhjennä', sv: 'Rensa', et: 'Tühjenda' },
    clearHistoryConfirm: { ko: '최근 살펴본 미술관 기록을 모두 삭제할까요?\n삭제 후에는 복구할 수 없습니다.', en: 'Clear all recently explored museum records?\nThis action cannot be undone.', ja: '最近閲覧した美術館の履歴をすべて削除しますか？\nこの操作は元に戻せません。', de: 'Alle kürzlich erkundeten Museen löschen?\nDiese Aktion kann nicht rückgängig gemacht werden.', fr: 'Effacer tout l\'historique des musées consultés ?\nCette action est irréversible.', es: '¿Eliminar todo el historial de museos explorados?\nEsta acción no se puede deshacer.', pt: 'Limpar todo o histórico de museus explorados?\nEsta ação não pode ser desfeita.', 'zh-CN': '清除所有最近浏览的博物馆记录？\n此操作无法撤销。', 'zh-TW': '清除所有最近瀏覽的博物館紀錄？\n此操作無法撤銷。', da: 'Ryd alle nyligt udforskede museer?\nDenne handling kan ikke fortrydes.', fi: 'Tyhjennä kaikki viimeksi selatut museot?\nToimintoa ei voi kumota.', sv: 'Rensa alla nyligen utforskade museer?\nDenna åtgärd kan inte ångras.', et: 'Kustuta kõik hiljuti vaadatud muuseumid?\nSeda toimingut ei saa tagasi võtta.' },
};
const g = (key: string, locale: string) => ui[key]?.[locale] || ui[key]?.['en'] || key;

type SortType = 'newest' | 'rating' | 'alpha' | 'oldest' | 'nearby';

export default function SavedPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'saved' | 'history'>('saved');
    const [saves, setSaves] = useState<any[]>([]);
    const [historyMuseums, setHistoryMuseums] = useState<any[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [selectedMuseums, setSelectedMuseums] = useState<Set<string>>(new Set());
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [sortBy, setSortBy] = useState<SortType>('newest');
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
    const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
    const { locale } = useApp();
    const { showAlert, showConfirm } = useModal();
    const { addToCompare, compareCount } = useCompare();

    // Fetch saves for "저장" tab
    useEffect(() => {
        if (activeTab === 'saved') fetchSaves(selectedFolder);
    }, [selectedFolder, activeTab]);

    // Load history for "살펴보기" tab
    useEffect(() => {
        if (activeTab === 'history') loadHistory();
    }, [activeTab]);

    // Re-fetch on visibility change
    useEffect(() => {
        let lastFetch = Date.now();
        const onVisible = () => {
            if (document.visibilityState === 'visible' && Date.now() - lastFetch > 5000) {
                lastFetch = Date.now();
                if (activeTab === 'saved') fetchSaves(selectedFolder);
                else loadHistory();
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [selectedFolder, activeTab]);

    // Get user location for "위치순"
    useEffect(() => {
        if (sortBy === 'nearby' && !userLocation) {
            if (!navigator.geolocation) {
                showAlert('위치 정보를 사용할 수 없습니다.');
                setSortBy('newest');
                return;
            }
            navigator.geolocation.getCurrentPosition(
                pos => setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
                (err) => {
                    showAlert(locale === 'ko' ? '현재 위치를 사용하려면 권한이 필요해요. 브라우저 설정에서 위치 접근을 허용해주세요.' : 'Location permission is required. Please allow in browser settings.');
                    setSortBy('newest');
                }
            );
        }
    }, [sortBy]);

    const fetchSaves = async (folderId: string | null) => {
        setLoading(true);
        let url = '/api/me/saves';
        if (folderId) url += `?folderId=${folderId}`;
        try {
            const res = await fetch(url).then(r => r.json());
            if (res.data) setSaves(res.data);
        } finally {
            setLoading(false);
        }
    };

    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const history = getMuseumHistory();
            if (history.length === 0) { setHistoryMuseums([]); return; }
            const res = await fetch('/api/museums/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: history.map(h => h.id) })
            }).then(r => r.json());
            if (res.data) {
                // Preserve history order and add viewedAt
                const museumMap = new Map(res.data.map((m: any) => [m.id, m]));
                const ordered = history
                    .map(h => {
                        const m = museumMap.get(h.id);
                        return m ? { ...(m as Record<string, any>), viewedAt: h.viewedAt } : null;
                    })
                    .filter(Boolean);
                setHistoryMuseums(ordered);
            }
        } finally {
            setHistoryLoading(false);
        }
    };

    // Sort logic
    const distanceTo = (lat: number, lon: number) => {
        if (!userLocation) return Infinity;
        const R = 6371;
        const dLat = (lat - userLocation.lat) * Math.PI / 180;
        const dLon = (lon - userLocation.lon) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const sortItems = (items: any[]) => {
        const sorted = [...items];
        switch (sortBy) {
            case 'newest': return sorted; // API already returns newest first
            case 'oldest': return sorted.reverse();
            case 'rating':
                return sorted.sort((a, b) => {
                    const rA = (activeTab === 'saved' ? a.museum?.googleRating : a.googleRating) || 0;
                    const rB = (activeTab === 'saved' ? b.museum?.googleRating : b.googleRating) || 0;
                    return rB - rA;
                });
            case 'alpha':
                return sorted.sort((a, b) => {
                    const mA = activeTab === 'saved' ? a.museum : a;
                    const mB = activeTab === 'saved' ? b.museum : b;
                    const nameA = getLocalizedMuseumName(mA, locale).toLowerCase();
                    const nameB = getLocalizedMuseumName(mB, locale).toLowerCase();
                    return nameA.localeCompare(nameB, locale);
                });
            case 'nearby':
                return sorted.sort((a, b) => {
                    const mA = activeTab === 'saved' ? a.museum : a;
                    const mB = activeTab === 'saved' ? b.museum : b;
                    return distanceTo(mA.latitude, mA.longitude) - distanceTo(mB.latitude, mB.longitude);
                });
            default: return sorted;
        }
    };

    const displayItems = activeTab === 'saved' ? sortItems(saves) : sortItems(historyMuseums);
    const isLoading = activeTab === 'saved' ? loading : historyLoading;

    const toggleSelect = (museumId: string) => {
        const next = new Set(selectedMuseums);
        if (next.has(museumId)) next.delete(museumId);
        else next.add(museumId);
        setSelectedMuseums(next);
    };

    const handleCreateAutoRoute = () => {
        if (selectedMuseums.size === 0) { showAlert(t('saved.selectAtLeast', locale)); return; }
        const ids = Array.from(selectedMuseums).join(',');
        gtag.event('generate_autoroute', { category: 'autoroute', label: ids, value: selectedMuseums.size });
        router.push(`/plans/new?museums=${ids}`);
    };

    const handleClearHistory = () => {
        showConfirm(g('clearHistoryConfirm', locale), () => {
            clearMuseumHistory();
            setHistoryMuseums([]);
        });
    };

    // Get museum object from item (save or history museum)
    const getMuseum = (item: any) => activeTab === 'saved' ? item.museum : item;

    return (
        <div className="no-back-swipe w-full lg:max-w-[1080px] mx-auto px-4 py-4 sm:px-6 sm:py-8 md:px-8 mt-4 sm:mt-8 pb-32 lg:pb-8">
            {/* Header */}
            <div className="mb-4 sm:mb-6">
                {isLoading && activeTab === 'saved' && saves.length === 0 ? (
                    <>
                        <div className="skeleton skeleton-text w-20 mb-3" />
                        <div className="skeleton skeleton-title w-40 mb-2" />
                        <div className="skeleton skeleton-text w-64 mt-2" />
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                            <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-[0.2em]">{activeTab === 'saved' ? 'My Collection' : 'Museum Log'}</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight dark:text-white">{t('saved.title', locale)}</h1>
                        <p className="text-gray-400 dark:text-neutral-500 mt-1 text-xs font-medium">{t('saved.subtitle', locale)}</p>
                    </>
                )}
            </div>

            {/* Purple Toggle Tabs */}
            <div className="flex gap-2 mb-4">
                <button onClick={() => { setActiveTab('saved'); setIsSelectMode(false); setSelectedMuseums(new Set()); }} className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 ${activeTab === 'saved' ? 'gradient-btn text-white shadow-lg' : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'}`}>
                    <svg className="w-4 h-4 inline -mt-0.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>
                    {g('tabSaved', locale)}
                </button>
                <button onClick={() => { setActiveTab('history'); setIsSelectMode(false); setSelectedMuseums(new Set()); }} className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 ${activeTab === 'history' ? 'gradient-btn text-white shadow-lg' : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'}`}>
                    <svg className="w-4 h-4 inline -mt-0.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {g('tabHistory', locale)}
                </button>
            </div>

            {/* Controls Bar: Select (saved tab only) + Sort Filter */}
            <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-2">
                    {activeTab === 'saved' && saves.length > 0 && (
                        <button
                            onClick={() => { setIsSelectMode(!isSelectMode); if (isSelectMode) setSelectedMuseums(new Set()); }}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors border shadow-sm ${isSelectMode ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700 dark:hover:bg-neutral-700'}`}
                        >
                            {isSelectMode ? t('modal.cancel', locale) || 'Cancel' : t('global.select', locale)}
                        </button>
                    )}
                    {activeTab === 'history' && historyMuseums.length > 0 && (
                        <button onClick={handleClearHistory} className="px-4 py-2 rounded-xl text-sm font-bold transition-colors border shadow-sm bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700 dark:hover:bg-neutral-700">
                            {g('clearHistory', locale)}
                        </button>
                    )}
                </div>
                <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as SortType)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-200 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                    <option value="newest">{g('sortNewest', locale)}</option>
                    <option value="rating">{g('sortRating', locale)}</option>
                    <option value="alpha">{g('sortAlpha', locale)}</option>
                    <option value="oldest">{g('sortOldest', locale)}</option>
                    <option value="nearby">{g('sortNearby', locale)}</option>
                </select>
            </div>

            {/* Selection Action Bar (animated) */}
            <div className={`bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800 rounded-xl flex justify-between items-center transition-all duration-300 ease-out overflow-hidden ${selectedMuseums.size > 0 ? 'p-4 mb-6 opacity-100 translate-y-0 max-h-24' : 'p-0 mb-0 opacity-0 -translate-y-2 max-h-0 border-transparent'}`}>
                <span className="text-purple-800 dark:text-purple-300 font-semibold text-sm">{selectedMuseums.size} {t('saved.selected', locale)}</span>
                <div className="flex items-center gap-2">
                    <button onClick={handleCreateAutoRoute} className="gradient-btn text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900">
                        {t('saved.createAutoRoute', locale)}
                    </button>
                    <button
                        onClick={() => {
                            const ids = Array.from(selectedMuseums);
                            const available = Math.max(0, 3 - compareCount);
                            if (available === 0) { showAlert(t('compare.full', locale)); return; }
                            const toAdd = ids.slice(0, available);
                            let addedCount = 0;
                            toAdd.forEach(id => { if (addToCompare(id)) addedCount++; });
                            setSelectedMuseums(new Set());
                            setIsSelectMode(false);
                            if (addedCount > 0) router.push('/compare');
                        }}
                        className="bg-white dark:bg-neutral-800 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900"
                        aria-label={t('compare.title', locale)}
                    >
                        {t('compare.title', locale)}
                    </button>
                    <button
                        onClick={() => {
                            showConfirm(t('modal.deleteCollection', locale), async () => {
                                const idsToDelete = new Set(selectedMuseums);
                                setDeletingIds(idsToDelete);
                                await new Promise(r => setTimeout(r, 300));
                                const saveIds = saves.filter(s => idsToDelete.has(s.museum.id)).map(s => s.id);
                                await Promise.all(saveIds.map(id => fetch(`/api/me/saves/${id}`, { method: 'DELETE' })));
                                setSaves(prev => prev.filter(s => !idsToDelete.has(s.museum.id)));
                                setSelectedMuseums(new Set());
                                setDeletingIds(new Set());
                            });
                        }}
                        className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition"
                        title="Delete selected"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            </div>

            {/* Museum Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <GlassPanel key={i} className="overflow-hidden">
                            <div className="h-40 skeleton" style={{ borderRadius: 0 }}>
                                <div className="absolute top-3 right-3 w-16 h-6 skeleton skeleton-text" />
                            </div>
                            <div className="p-4">
                                <div className="skeleton skeleton-title w-3/4 mb-2" />
                                <div className="skeleton skeleton-text w-1/2" />
                            </div>
                        </GlassPanel>
                    ))}
                </div>
            ) : displayItems.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {displayItems.map((item: any, i: number) => {
                        const museum = getMuseum(item);
                        const itemId = activeTab === 'saved' ? item.id : museum.id;
                        return (
                            <GlassPanel
                                key={`${activeTab}-${sortBy}-${itemId}`}
                                style={{ animation: `fadeInUp 0.4s ${Math.min(i, 15) * 50}ms both` }}
                                className={`overflow-hidden group cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.98] ${deletingIds.has(museum.id) ? 'animate-slideOutLeft' : ''}`}
                                onClick={() => {
                                    if (isSelectMode && activeTab === 'saved') toggleSelect(museum.id);
                                    else router.push(`/museums/${museum.id}`);
                                }}
                            >
                                <div className="h-40 bg-gray-100 dark:bg-neutral-800 relative overflow-hidden">
                                    {(() => {
                                        const cached = Array.isArray(museum.cachedPhotoUrls) ? museum.cachedPhotoUrls : (typeof museum.cachedPhotoUrls === 'string' ? (() => { try { return JSON.parse(museum.cachedPhotoUrls); } catch { return []; } })() : []);
                                        const imgSrc = cached[0] || museum.imageUrl;
                                        const fallbackSrc = cached[0] ? museum.imageUrl : null;
                                        return imgSrc ? (
                                            <img
                                                src={imgSrc}
                                                alt={museum.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 will-change-transform opacity-0"
                                                onLoad={(e) => { (e.target as HTMLImageElement).classList.remove('opacity-0'); (e.target as HTMLImageElement).classList.add('opacity-100'); }}
                                                onError={(e) => {
                                                    const el = e.target as HTMLImageElement;
                                                    if (fallbackSrc && el.src !== fallbackSrc) {
                                                        el.src = fallbackSrc;
                                                    } else {
                                                        el.style.display = 'none';
                                                        el.parentElement?.querySelector('.logo-fallback')?.classList.remove('hidden');
                                                    }
                                                }}
                                            />
                                        ) : null;
                                    })()}
                                    <div className={`logo-fallback absolute inset-0 flex items-center justify-center ${(Array.isArray(museum.cachedPhotoUrls) ? museum.cachedPhotoUrls.length > 0 : false) || museum.imageUrl ? 'hidden' : ''}`}>
                                        <img src="/logo.svg" alt="Museum Map" className="w-36 h-36 opacity-20 dark:invert dark:opacity-[0.6]" />
                                    </div>

                                    {/* Checkbox — only in saved tab + select mode */}
                                    {isSelectMode && activeTab === 'saved' && (
                                        <div className={`absolute top-3 left-3 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${selectedMuseums.has(museum.id) ? 'bg-gradient-to-br from-orange-400 to-orange-600 border-orange-300 shadow-lg shadow-orange-500/30 scale-110' : 'bg-black/20 backdrop-blur-md border-white/60'}`}>
                                            {selectedMuseums.has(museum.id) && (
                                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                            )}
                                        </div>
                                    )}
                                    {museum.type && (
                                        <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-white/80 dark:bg-black/60 backdrop-blur-md shadow-sm">
                                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200 capitalize">{translateCategory(museum.type, locale)}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-md">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="font-bold text-lg mb-1 dark:text-white capitalize truncate flex-1">{getLocalizedMuseumName(museum, locale)}</h3>
                                        {museum.googleRating && (
                                            <span className="flex items-center gap-0.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full shrink-0">
                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                                {museum.googleRating.toFixed(1)}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase truncate">{getLocalizedCityName(museum, locale) || getCityName(museum.city, locale)}, {getCountryName(museum.country, locale)}</p>
                                </div>
                            </GlassPanel>
                        );
                    })}
                </div>
            ) : (
                <div className="col-span-full py-16 sm:py-20 text-center text-gray-400 dark:text-gray-500 w-full">
                    {activeTab === 'saved' ? t('saved.noSaves', locale) : g('noHistory', locale)}
                </div>
            )}
        </div>
    );
}
