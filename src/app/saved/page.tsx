'use client';
import { useCallback, useState, useEffect } from 'react';
import { useApp } from '@/components/AppContext';
import { useModal } from '@/components/ui/Modal';
import { t, translateCategory } from '@/lib/i18n';
import { getCountryName, getCityName } from '@/lib/countries';
import { getLocalizedMuseumName, getLocalizedCityName } from '@/lib/getLocalizedName';
import { getMuseumHistory, clearMuseumHistory } from '@/lib/museum-history';
import { useCompare } from '@/hooks/useCompare';
import { useAccountSaves } from '@/hooks/useAccountSaves';
import * as gtag from '@/lib/gtag';
import EmptyStateGame from '@/components/ui/EmptyStateGame';
import { navigateDocument } from '@/lib/route-pending';

/* ── i18n for tabs & sort ── */
type L = Record<string, string>;
const ui: Record<string, L> = {
    tabSaved: { ko: '내 픽', en: 'My Pick', ja: 'お気に入り', de: 'Gespeichert', fr: 'Favoris', es: 'Guardados', pt: 'Salvos', 'zh-CN': '收藏', 'zh-TW': '收藏', da: 'Gemt', fi: 'Tallennettu', sv: 'Sparade', et: 'Salvestatud' },
    tabHistory: { ko: '최근 본 장소', en: 'Explored', ja: '閲覧履歴', de: 'Verlauf', fr: 'Consultés', es: 'Explorados', pt: 'Explorados', 'zh-CN': '浏览记录', 'zh-TW': '瀏覽紀錄', da: 'Udforsket', fi: 'Selattu', sv: 'Utforskade', et: 'Vaadatud' },
    kickerSaved: { ko: 'MY PICK', en: 'MY PICK', ja: 'MY PICK', de: 'MY PICK', fr: 'MY PICK', es: 'MY PICK', pt: 'MY PICK', 'zh-CN': 'MY PICK', 'zh-TW': 'MY PICK', da: 'MY PICK', fi: 'MY PICK', sv: 'MY PICK', et: 'MY PICK' },
    kickerHistory: { ko: 'HISTORY', en: 'HISTORY', ja: 'HISTORY', de: 'HISTORY', fr: 'HISTORY', es: 'HISTORY', pt: 'HISTORY', 'zh-CN': 'HISTORY', 'zh-TW': 'HISTORY', da: 'HISTORY', fi: 'HISTORY', sv: 'HISTORY', et: 'HISTORY' },
    sortNewest: { ko: '최신순', en: 'Newest', ja: '新しい順', de: 'Neueste', fr: 'Récents', es: 'Recientes', pt: 'Recentes', 'zh-CN': '最新', 'zh-TW': '最新', da: 'Nyeste', fi: 'Uusimmat', sv: 'Senaste', et: 'Uusimad' },
    sortRating: { ko: '별점순', en: 'Top Rated', ja: '評価順', de: 'Bestbewertet', fr: 'Mieux notés', es: 'Mejor valorados', pt: 'Melhor avaliados', 'zh-CN': '评分最高', 'zh-TW': '評分最高', da: 'Bedst bedømt', fi: 'Parhaat', sv: 'Bäst betyg', et: 'Parimad' },
    sortAlpha: { ko: '가나다순', en: 'A-Z', ja: '名前順', de: 'A-Z', fr: 'A-Z', es: 'A-Z', pt: 'A-Z', 'zh-CN': '字母顺序', 'zh-TW': '字母順序', da: 'A-Z', fi: 'A-Ö', sv: 'A-Ö', et: 'A-Z' },
    sortOldest: { ko: '오래된순', en: 'Oldest', ja: '古い順', de: 'Älteste', fr: 'Anciens', es: 'Antiguos', pt: 'Antigos', 'zh-CN': '最早', 'zh-TW': '最早', da: 'Ældste', fi: 'Vanhimmat', sv: 'Äldsta', et: 'Vanimad' },
    sortNearby: { ko: '위치순', en: 'Nearby', ja: '距離順', de: 'In der Nähe', fr: 'Proximité', es: 'Cercanos', pt: 'Próximos', 'zh-CN': '附近', 'zh-TW': '附近', da: 'Nærmeste', fi: 'Lähellä', sv: 'Nära', et: 'Lähedal' },
    noHistory: { ko: '아직 최근에 본 미술관이 없어요', en: 'No museums explored yet', ja: 'まだ閲覧した美術館はありません', de: 'Noch keine Museen erkundet', fr: 'Aucun musée consulté', es: 'Aún no has explorado museos', pt: 'Nenhum museu explorado', 'zh-CN': '暂无浏览记录', 'zh-TW': '暫無瀏覽紀錄', da: 'Ingen museer udforsket endnu', fi: 'Ei selattuja museoita', sv: 'Inga utforskade museer', et: 'Pole veel vaadatud muuseume' },
    clearHistory: { ko: '기록 삭제', en: 'Clear', ja: '履歴削除', de: 'Löschen', fr: 'Effacer', es: 'Borrar', pt: 'Limpar', 'zh-CN': '清除', 'zh-TW': '清除', da: 'Ryd', fi: 'Tyhjennä', sv: 'Rensa', et: 'Tühjenda' },
    clearHistoryConfirm: { ko: '최근에 본 미술관 기록을 모두 삭제할까요?\n삭제하면 다시 복구할 수 없어요.', en: 'Clear all recently explored museum records?\nThis action cannot be undone.', ja: '最近閲覧した美術館の履歴をすべて削除しますか？\nこの操作は元に戻せません。', de: 'Alle kürzlich erkundeten Museen löschen?\nDiese Aktion kann nicht rückgängig gemacht werden.', fr: 'Effacer tout l\'historique des musées consultés ?\nCette action est irréversible.', es: '¿Eliminar todo el historial de museos explorados?\nEsta acción no se puede deshacer.', pt: 'Limpar todo o histórico de museus explorados?\nEsta ação não pode ser desfeita.', 'zh-CN': '清除所有最近浏览的博物馆记录？\n此操作无法撤销。', 'zh-TW': '清除所有最近瀏覽的博物館紀錄？\n此操作無法撤銷。', da: 'Ryd alle nyligt udforskede museer?\nDenne handling kan ikke fortrydes.', fi: 'Tyhjennä kaikki viimeksi selatut museot?\nToimintoa ei voi kumota.', sv: 'Rensa alla nyligen utforskade museer?\nDenna åtgärd kan inte ångras.', et: 'Kustuta kõik hiljuti vaadatud muuseumid?\nSeda toimingut ei saa tagasi võtta.' },
    choosePlaces: { ko: '장소 고르기', en: 'Choose places', ja: '場所を選ぶ', de: 'Orte wählen', fr: 'Choisir des lieux', es: 'Elegir lugares', pt: 'Escolher lugares', 'zh-CN': '选择地点', 'zh-TW': '選擇地點', da: 'Vælg steder', fi: 'Valitse kohteet', sv: 'Välj platser', et: 'Vali kohad' },
    doneChoosing: { ko: '고르기 완료', en: 'Done', ja: '完了', de: 'Fertig', fr: 'Terminé', es: 'Listo', pt: 'Concluir', 'zh-CN': '完成', 'zh-TW': '完成', da: 'Færdig', fi: 'Valmis', sv: 'Klar', et: 'Valmis' },
    savedSection: { ko: '내 픽한 곳', en: 'Picked places', ja: '選んだ場所', de: 'Ausgewählte Orte', fr: 'Lieux choisis', es: 'Lugares elegidos', pt: 'Locais escolhidos', 'zh-CN': '已收藏地点', 'zh-TW': '已收藏地點', da: 'Valgte steder', fi: 'Valitut kohteet', sv: 'Valda platser', et: 'Valitud kohad' },
    quickTitle: { ko: '여행 준비', en: 'Plan a trip', ja: '旅の準備', de: 'Reise planen', fr: 'Préparer le voyage', es: 'Preparar viaje', pt: 'Preparar viagem', 'zh-CN': '准备行程', 'zh-TW': '準備行程', da: 'Planlæg tur', fi: 'Suunnittele matka', sv: 'Planera resa', et: 'Planeeri reis' },
    quickBodyIdle: { ko: '여행에 넣을 곳을 고르면 보기 좋은 순서로 경로를 만들 수 있어요.', en: 'Choose places to build a route in a helpful order.', ja: '行きたい場所を選ぶと、回りやすい順にルートを作れます。', de: 'Wählen Sie Orte, um eine sinnvolle Route zu erstellen.', fr: 'Choisissez des lieux pour créer un itinéraire clair.', es: 'Elige lugares para crear una ruta ordenada.', pt: 'Escolha locais para criar uma rota organizada.', 'zh-CN': '选择地点后，可生成更顺路的行程。', 'zh-TW': '選擇地點後，可生成更順路的行程。', da: 'Vælg steder for at lave en god rute.', fi: 'Valitse kohteet, niin reitti järjestetään selkeästi.', sv: 'Välj platser för att skapa en smart rutt.', et: 'Vali kohad, et luua mugav marsruut.' },
    quickBodySelected: { ko: '고른 곳으로 바로 여행 경로를 만들 수 있어요.', en: 'Create a trip route from the places you chose.', ja: '選んだ場所で旅行ルートを作れます。', de: 'Erstellen Sie eine Route aus Ihren gewählten Orten.', fr: 'Créez un itinéraire avec les lieux choisis.', es: 'Crea una ruta con los lugares elegidos.', pt: 'Crie uma rota com os locais escolhidos.', 'zh-CN': '可用所选地点生成行程。', 'zh-TW': '可用所選地點生成行程。', da: 'Lav en rute med de valgte steder.', fi: 'Luo reitti valituista kohteista.', sv: 'Skapa en rutt med valda platser.', et: 'Loo marsruut valitud kohtadest.' },
    comparePicked: { ko: '비교하기', en: 'Compare', ja: '比較する', de: 'Vergleichen', fr: 'Comparer', es: 'Comparar', pt: 'Comparar', 'zh-CN': '比较', 'zh-TW': '比較', da: 'Sammenlign', fi: 'Vertaa', sv: 'Jämför', et: 'Võrdle' },
};
const g = (key: string, locale: string) => ui[key]?.[locale] || ui[key]?.['en'] || key;

type SortType = 'newest' | 'rating' | 'alpha' | 'oldest' | 'nearby';

function goLogin(callbackUrl: string) {
    if (typeof window === 'undefined') return;
    window.location.assign(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
}

function sameIds(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    return a.every((id, index) => id === b[index]);
}

export default function SavedPage() {
    const [activeTab, setActiveTab] = useState<'saved' | 'history'>('saved');
    const [historyMuseums, setHistoryMuseums] = useState<any[]>([]);
    const [selectedMuseums, setSelectedMuseums] = useState<Set<string>>(new Set());
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [sortBy, setSortBy] = useState<SortType>('newest');
    const [historyLoading, setHistoryLoading] = useState(false);
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
    const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
    const { locale } = useApp();
    const { showAlert, showConfirm } = useModal();
    const { compareIds, replaceCompare, isAuthenticated: isCompareAuthenticated, isReady: isCompareReady } = useCompare({
        initialFetch: 'idle',
        idleTimeout: 1500,
    });
    const handleSavesUnauthorized = useCallback(() => goLogin('/saved'), []);
    const { saves, loading, refresh: refreshSaves, setCachedSaves } = useAccountSaves({ onUnauthorized: handleSavesUnauthorized });

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
                if (activeTab === 'saved') void refreshSaves({ force: true }).catch(() => {});
                else loadHistory();
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [activeTab, refreshSaves]);

    // Get user location for "위치순"
    useEffect(() => {
        if (sortBy === 'nearby' && !userLocation) {
            if (!navigator.geolocation) {
                showAlert(locale === 'ko' ? '이 브라우저에서는 현재 위치를 사용할 수 없어요.' : 'Location is not available in this browser.');
                setSortBy('newest');
                return;
            }
            navigator.geolocation.getCurrentPosition(
                pos => setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
                (err) => {
                    showAlert(locale === 'ko' ? '현재 위치를 사용하려면 권한이 필요해요. 브라우저 설정에서 위치 접근을 허용해 주세요.' : 'Location permission is required. Please allow in browser settings.');
                    setSortBy('newest');
                }
            );
        }
    }, [sortBy]);

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
        window.location.assign(`/plans/new?museums=${encodeURIComponent(ids)}`);
    };

    const handleCompareSelected = async () => {
        if (selectedMuseums.size === 0) {
            setIsSelectMode(true);
            return;
        }
        if (!isCompareReady) {
            showAlert(locale === 'ko' ? '계정 정보를 확인하는 중이에요. 잠시 후 다시 시도해 주세요.' : 'Checking your account. Please try again in a moment.');
            return;
        }
        if (!isCompareAuthenticated) {
            goLogin('/saved');
            return;
        }

        const ids = Array.from(selectedMuseums);
        const nextCompareIds = compareIds.slice(0, 3);
        let skippedFull = false;

        for (const id of ids) {
            if (nextCompareIds.includes(id)) continue;
            if (nextCompareIds.length >= 3) {
                skippedFull = true;
                continue;
            }
            nextCompareIds.push(id);
        }

        if (sameIds(nextCompareIds, compareIds) && skippedFull) {
            showAlert(t('compare.full', locale));
            return;
        }

        try {
            if (!sameIds(nextCompareIds, compareIds)) {
                const saved = await replaceCompare(nextCompareIds);
                if (!saved) {
                    throw new Error('Failed to save compare list');
                }
            }
            setSelectedMuseums(new Set());
            setIsSelectMode(false);
            navigateDocument('/compare');
        } catch {
            showAlert(locale === 'ko' ? '비교 목록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' : 'Could not save the compare list. Please try again.');
        }
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
        <div data-mm-page="saved" className="no-back-swipe mm-editorial-page2 mm-library-page2 w-full max-w-[960px] mx-auto px-4 pt-4 sm:px-6 sm:pt-8 md:px-8 pb-32 lg:pb-10">
            {/* Header */}
            <div className="mm-gallery-hero p-5 sm:p-7 mb-4 sm:mb-6">
                {isLoading && activeTab === 'saved' && saves.length === 0 ? (
                    <>
                        <div className="skeleton skeleton-text w-20 mb-3" />
                        <div className="skeleton skeleton-title w-40 mb-2" />
                        <div className="skeleton skeleton-text w-64 mt-2" />
                    </>
                ) : (
                    <>
                        <div className="mm-gallery-kicker mb-3">{activeTab === 'saved' ? g('kickerSaved', locale) : g('kickerHistory', locale)}</div>
                        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">{t('saved.title', locale)}</h1>
                        <p className="text-blue-100/80 mt-2 text-sm font-medium">{t('saved.subtitle', locale)}</p>
                        <div className="flex mt-5 gap-2 overflow-x-auto scrollbar-hide">
                            <button onClick={() => { setActiveTab('saved'); setIsSelectMode(false); setSelectedMuseums(new Set()); }} className={`mm-gallery-chip mm-saved-mode-chip ${activeTab === 'saved' ? 'is-active' : ''}`}>
                                <svg className="w-4 h-4 inline -mt-0.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>
                                {g('tabSaved', locale)}
                            </button>
                            <button onClick={() => { setActiveTab('history'); setIsSelectMode(false); setSelectedMuseums(new Set()); }} className={`mm-gallery-chip mm-saved-mode-chip ${activeTab === 'history' ? 'is-active' : ''}`}>
                                <svg className="w-4 h-4 inline -mt-0.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {g('tabHistory', locale)}
                            </button>
                        </div>
                    </>
                )}
            </div>

            <div className="mm-section-heading">
                <h2>{activeTab === 'saved' ? g('savedSection', locale) : (locale === 'ko' ? '최근 살펴본 곳' : 'Recently explored')}</h2>
                <span>{displayItems.length.toLocaleString()} {locale === 'ko' ? '곳' : 'places'}</span>
            </div>

            {/* Controls Bar: Select (saved tab only) + Sort Filter */}
            <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-2">
                    {activeTab === 'saved' && saves.length > 0 && (
                        <button
                            onClick={() => { setIsSelectMode(!isSelectMode); if (isSelectMode) setSelectedMuseums(new Set()); }}
                            className={`mm-gallery-chip ${isSelectMode ? 'is-active' : ''}`}
                        >
                            {isSelectMode ? g('doneChoosing', locale) : g('choosePlaces', locale)}
                        </button>
                    )}
                    {activeTab === 'history' && historyMuseums.length > 0 && (
                        <button onClick={handleClearHistory} className="mm-gallery-chip">
                            {g('clearHistory', locale)}
                        </button>
                    )}
                </div>
                <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as SortType)}
                    className="mm-gallery-chip cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                    <option value="newest">{g('sortNewest', locale)}</option>
                    <option value="rating">{g('sortRating', locale)}</option>
                    <option value="alpha">{g('sortAlpha', locale)}</option>
                    <option value="oldest">{g('sortOldest', locale)}</option>
                    <option value="nearby">{g('sortNearby', locale)}</option>
                </select>
            </div>

            {/* Selection Action Bar (animated) */}
            <div className={`bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-xl flex justify-between items-center transition-all duration-300 ease-out overflow-hidden ${selectedMuseums.size > 0 ? 'p-4 mb-6 opacity-100 translate-y-0 max-h-24' : 'p-0 mb-0 opacity-0 -translate-y-2 max-h-0 border-transparent'}`}>
                <span className="text-blue-800 dark:text-blue-300 font-semibold text-sm">{selectedMuseums.size} {t('saved.selected', locale)}</span>
                <div className="flex items-center gap-2">
                    <button onClick={handleCreateAutoRoute} className="gradient-btn text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900">
                        {t('saved.createAutoRoute', locale)}
                    </button>
                    <button
                        onClick={handleCompareSelected}
                        className="bg-white dark:bg-neutral-800 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900"
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
                                try {
                                    const saveIds = saves
                                        .filter(s => {
                                            const museumId = s.museum?.id || s.museumId;
                                            return typeof s.id === 'string' && typeof museumId === 'string' && idsToDelete.has(museumId);
                                        })
                                        .map(s => s.id as string);
                                    const responses = await Promise.all(saveIds.map(id => fetch(`/api/me/saves/${id}`, { method: 'DELETE' })));
                                    const unauthorized = responses.some(response => response.status === 401);
                                    if (unauthorized) {
                                        goLogin('/saved');
                                        return;
                                    }
                                    if (responses.some(response => !response.ok)) throw new Error('Failed to delete saves');
                                    setCachedSaves(prev => prev.filter(s => {
                                        const museumId = s.museum?.id || s.museumId;
                                        return typeof museumId !== 'string' || !idsToDelete.has(museumId);
                                    }));
                                    setSelectedMuseums(new Set());
                                } catch {
                                    showAlert(locale === 'ko' ? '선택한 장소를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.' : 'Could not delete the selected places. Please try again.');
                                } finally {
                                    setDeletingIds(new Set());
                                }
                            });
                        }}
                        className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition"
                        title="Delete selected"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            </div>

            {/* Museum List */}
            {isLoading ? (
                <div className="mm-list-surface mm-saved-list-surface">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="mm-list-row2 w-full">
                            <div className="mm-saved-row-thumb mm-skel-block" />
                            <div className="min-w-0 flex-1">
                                <div className="mm-skel-line w-16 mb-2" />
                                <div className={`mm-skel-line h-4 ${i % 2 === 0 ? 'w-2/3' : 'w-1/2'} mb-2`} />
                                <div className="mm-skel-line w-1/3" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : displayItems.length > 0 ? (
                <div className="mm-list-surface mm-saved-list-surface">
                    {displayItems.map((item: any) => {
                        const museum = getMuseum(item);
                        const itemId = activeTab === 'saved' ? item.id : museum.id;
                        const cached = Array.isArray(museum.cachedPhotoUrls) ? museum.cachedPhotoUrls : (typeof museum.cachedPhotoUrls === 'string' ? (() => { try { return JSON.parse(museum.cachedPhotoUrls); } catch { return []; } })() : []);
                        const imgSrc = cached[0] || museum.imageUrl;
                        const fallbackSrc = cached[0] ? museum.imageUrl : null;
                        return (
                            <button
                                key={`${activeTab}-${sortBy}-${itemId}`}
                                className={`mm-list-row2 group w-full text-left transition-all duration-200 ${isSelectMode && activeTab === 'saved' ? 'mm-list-row-selectable' : ''} ${selectedMuseums.has(museum.id) ? 'is-selected' : ''} ${deletingIds.has(museum.id) ? 'animate-slideOutLeft' : ''}`}
                                onClick={() => {
                                    if (isSelectMode && activeTab === 'saved') toggleSelect(museum.id);
                                    else window.location.assign(`/museums/${museum.id}`);
                                }}
                            >
                                <div className="mm-saved-row-thumb relative">
                                    {imgSrc ? (
                                        <img
                                            src={imgSrc}
                                            alt={museum.name}
                                            className="opacity-0 transition-all duration-500 group-hover:scale-105"
                                            onLoad={(e) => { (e.target as HTMLImageElement).classList.remove('opacity-0'); (e.target as HTMLImageElement).classList.add('opacity-100'); }}
                                            onError={(e) => {
                                                const el = e.target as HTMLImageElement;
                                                if (fallbackSrc && el.src !== fallbackSrc) {
                                                    el.src = fallbackSrc;
                                                } else {
                                                    el.src = '/logo.svg';
                                                    el.className = 'w-full h-full object-contain p-3 opacity-20 dark:invert dark:opacity-60';
                                                }
                                            }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <img src="/logo.svg" alt="" className="w-8 h-8 opacity-20 dark:invert dark:opacity-60" />
                                        </div>
                                    )}
                                    {isSelectMode && activeTab === 'saved' && (
                                        <div className={`mm-pick-select-dot ${selectedMuseums.has(museum.id) ? 'is-selected' : ''}`}>
                                            {selectedMuseums.has(museum.id) && (
                                                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 min-w-0">
                                        {museum.type && <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 truncate">{translateCategory(museum.type, locale)}</span>}
                                        {museum.googleRating && <span className="text-[11px] font-extrabold text-slate-400 shrink-0">★ {museum.googleRating.toFixed(1)}</span>}
                                    </div>
                                    <h3 className="font-black text-[15px] sm:text-base dark:text-white capitalize truncate mt-0.5">{getLocalizedMuseumName(museum, locale)}</h3>
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 truncate mt-1">{getLocalizedCityName(museum, locale) || getCityName(museum.city, locale)}, {getCountryName(museum.country, locale)}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <EmptyStateGame
                    locale={locale}
                    title={activeTab === 'saved' ? (locale === 'ko' ? '아직 픽한 곳이 없어요.' : t('saved.noSaves', locale)) : g('noHistory', locale)}
                    description={activeTab === 'saved' && locale === 'ko' ? '마음에 드는 박물관이나 미술관을 내 픽에 담아보세요.' : undefined}
                />
            )}

            {activeTab === 'saved' && displayItems.length > 0 && (
                <>
                    <div className="mm-section-heading">
                        <h2>{g('quickTitle', locale)}</h2>
                    </div>
                    <div className="mm-decision-panel2 p-4">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedMuseums.size > 0 ? g('quickBodySelected', locale) : g('quickBodyIdle', locale)}</p>
                        <div className="grid grid-cols-2 gap-2 mt-3">
                            <button
                                onClick={selectedMuseums.size > 0 ? handleCreateAutoRoute : () => setIsSelectMode(prev => !prev)}
                                className="h-11 rounded-2xl bg-blue-600 text-white text-sm font-semibold active:scale-95 transition-all"
                            >
                                {selectedMuseums.size > 0 ? t('saved.createAutoRoute', locale) : (isSelectMode ? g('doneChoosing', locale) : g('choosePlaces', locale))}
                            </button>
                            <button onClick={handleCompareSelected} className="h-11 rounded-2xl bg-white text-slate-700 border border-blue-100 text-sm font-semibold active:scale-95 transition-all dark:bg-slate-900 dark:text-slate-100 dark:border-blue-900/50">
                                {g('comparePicked', locale)}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
