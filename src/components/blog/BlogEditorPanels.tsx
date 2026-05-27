'use client';
import { useState } from 'react';
import { TicketIcon, ClockIcon, MapPinIcon, TrainIcon, FrameIcon, MuseumIcon } from '@/components/ui/Icons';

function museumDisplayName(museum: any) {
    return museum?.nameKo || museum?.name || museum?.nameEn || '';
}

function museumDisplayCity(museum: any) {
    return museum?.cityKo || museum?.city || '';
}

/* ── Info Table Editor ── */
export function InfoTableEditor({ value, onChange }: { value: any[]; onChange: (v: any[]) => void }) {
    const addRow = () => onChange([...value, { label: '', value: '' }]);
    const removeRow = (i: number) => onChange(value.filter((_, idx) => idx !== i));
    const updateRow = (i: number, key: string, val: string) => {
        const next = [...value];
        next[i] = { ...next[i], [key]: val };
        onChange(next);
    };

    const presets = [
        { label: '🎫 입장료', value: '' },
        { label: '🕐 운영시간', value: '' },
        { label: '📍 위치', value: '' },
        { label: '🚇 교통', value: '' },
        { label: '⏱️ 관람시간', value: '' },
        { label: '🎯 전략', value: '' },
    ];
    const addPresets = () => onChange([...value, ...presets.filter(p => !value.some(v => v.label === p.label))]);

    return (
        <div className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-tight dark:text-white flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg> 방문 정보 테이블</h3>
                <div className="flex gap-2">
                    <button type="button" onClick={addPresets} className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 transition-colors">
                        프리셋 추가
                    </button>
                    <button type="button" onClick={addRow} className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors">
                        + 행 추가
                    </button>
                </div>
            </div>
            {value.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">정보가 없습니다. 프리셋 또는 행을 추가하세요.</p>
            ) : (
                <div className="space-y-2">
                    {value.map((row, i) => (
                        <div key={i} className="flex gap-2 items-center">
                            <input
                                type="text" value={row.label} onChange={(e) => updateRow(i, 'label', e.target.value)}
                                placeholder="라벨 (예: 🎫 입장료)"
                                className="w-[140px] flex-shrink-0 bg-gray-50 dark:bg-neutral-800 border-none rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-black dark:focus:ring-white outline-none dark:text-white"
                            />
                            <input
                                type="text" value={row.value} onChange={(e) => updateRow(i, 'value', e.target.value)}
                                placeholder="값 (예: 16유로)"
                                className="flex-1 bg-gray-50 dark:bg-neutral-800 border-none rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-black dark:focus:ring-white outline-none dark:text-white"
                            />
                            <button type="button" onClick={() => removeRow(i)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ── Artwork Cards Editor ── */
export function ArtworksEditor({ value, onChange }: { value: any[]; onChange: (v: any[]) => void }) {
    const addWork = () => onChange([...value, { image: '', artist: '', title: '', description: '' }]);
    const removeWork = (i: number) => onChange(value.filter((_, idx) => idx !== i));
    const updateWork = (i: number, key: string, val: string) => {
        const next = [...value];
        next[i] = { ...next[i], [key]: val };
        onChange(next);
    };

    return (
        <div className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-tight dark:text-white flex items-center gap-1.5"><FrameIcon className="w-4 h-4" /> 작품</h3>
                <button type="button" onClick={addWork} className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors">
                    + 작품 추가
                </button>
            </div>
            {value.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">작품이 없습니다. 추가 버튼을 눌러주세요.</p>
            ) : (
                <div className="space-y-4">
                    {value.map((work, i) => (
                        <div key={i} className="bg-gray-50 dark:bg-neutral-800/50 rounded-2xl p-4 relative">
                            <button type="button" onClick={() => removeWork(i)} className="absolute top-3 right-3 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <input type="text" value={work.artist} onChange={(e) => updateWork(i, 'artist', e.target.value)}
                                    placeholder="작가명" className="bg-white dark:bg-neutral-900 border-none rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-black dark:focus:ring-white outline-none dark:text-white" />
                                <input type="text" value={work.title} onChange={(e) => updateWork(i, 'title', e.target.value)}
                                    placeholder="작품명" className="bg-white dark:bg-neutral-900 border-none rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-black dark:focus:ring-white outline-none dark:text-white" />
                            </div>
                            <input type="text" value={work.image} onChange={(e) => updateWork(i, 'image', e.target.value)}
                                placeholder="이미지 URL (https://...)" className="w-full bg-white dark:bg-neutral-900 border-none rounded-xl px-3 py-2.5 text-xs font-mono focus:ring-2 focus:ring-black dark:focus:ring-white outline-none dark:text-white mb-3" />
                            <textarea value={work.description} onChange={(e) => updateWork(i, 'description', e.target.value)}
                                placeholder="작품 설명 (선택)" rows={2} className="w-full bg-white dark:bg-neutral-900 border-none rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-black dark:focus:ring-white outline-none dark:text-white resize-none" />
                            {work.image && (
                                <img src={work.image} alt={work.title} className="w-20 h-20 rounded-xl object-cover mt-2" onError={(e) => { e.currentTarget.src = '/logo.svg'; e.currentTarget.className = 'w-20 h-20 rounded-xl object-contain p-4 mt-2 bg-gray-100 dark:bg-neutral-800 opacity-20 dark:invert dark:opacity-60'; }} />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ── Museum Search/Link Editor ── */
export function MuseumLinker({ selectedMuseums, onChange }: { selectedMuseums: any[]; onChange: (v: any[]) => void }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    const search = async () => {
        if (!query.trim()) return;
        setSearching(true);
        try {
            const res = await fetch(`/api/museums?q=${encodeURIComponent(query)}&limit=10`);
            const json = await res.json();
            // API returns { data: { data: [...], total } } via successResponse
            const list = json?.data?.data || json?.data || [];
            setResults(Array.isArray(list) ? list : []);
        } catch { setResults([]); }
        setSearching(false);
    };

    const addMuseum = (m: any) => {
        if (!selectedMuseums.some(s => s.id === m.id)) {
            onChange([...selectedMuseums, {
                id: m.id,
                name: m.name,
                nameKo: m.nameKo,
                nameEn: m.nameEn,
                city: m.city,
                cityKo: m.cityKo,
                country: m.country,
                imageUrl: m.imageUrl,
            }]);
        }
    };

    const removeMuseum = (id: string) => {
        onChange(selectedMuseums.filter(m => m.id !== id));
    };

    return (
        <div className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-tight dark:text-white mb-4 flex items-center gap-1.5"><MuseumIcon className="w-4 h-4" /> 관련 박물관</h3>

            {/* Search */}
            <div className="flex gap-2 mb-4">
                <input
                    type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())}
                    placeholder="박물관/미술관 검색..."
                    className="flex-1 bg-gray-50 dark:bg-neutral-800 border-none rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-black dark:focus:ring-white outline-none dark:text-white"
                />
                <button type="button" onClick={search} disabled={searching}
                    className="px-4 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-black hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                    {searching ? '...' : '검색'}
                </button>
            </div>

            {/* Search Results */}
            {results.length > 0 && (
                <div className="bg-gray-50 dark:bg-neutral-800/50 rounded-2xl p-3 mb-4 max-h-[200px] overflow-y-auto space-y-1">
                    {results.map((m) => (
                        <button key={m.id} type="button" onClick={() => addMuseum(m)}
                            disabled={selectedMuseums.some(s => s.id === m.id)}
                            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-neutral-800 transition-colors text-left disabled:opacity-30">
                            {m.imageUrl ? (
                                <img src={m.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" onError={(e) => { e.currentTarget.src = '/logo.svg'; e.currentTarget.className = 'w-8 h-8 rounded-lg object-contain p-1 opacity-20 dark:invert dark:opacity-60'; }} />
                            ) : (
                                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0"><MuseumIcon className="w-4 h-4 text-purple-600" /></div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold dark:text-white truncate">{museumDisplayName(m)}</p>
                                <p className="text-[10px] text-gray-400">{museumDisplayCity(m)}, {m.country}</p>
                            </div>
                            <span className="text-[10px] text-purple-500 font-bold">+ 추가</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Selected Museums */}
            {selectedMuseums.length > 0 ? (
                <div className="space-y-2">
                    {selectedMuseums.map((m) => (
                        <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20">
                            {m.imageUrl ? (
                                <img src={m.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" onError={(e) => { e.currentTarget.src = '/logo.svg'; e.currentTarget.className = 'w-8 h-8 rounded-lg object-contain p-1 opacity-20 dark:invert dark:opacity-60'; }} />
                            ) : (
                                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0 text-sm">🏛️</div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold dark:text-white truncate">{museumDisplayName(m)}</p>
                                <p className="text-[10px] text-gray-400">{museumDisplayCity(m)}, {m.country}</p>
                            </div>
                            <button type="button" onClick={() => removeMuseum(m.id)} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-xs text-gray-400 text-center py-4">연결된 박물관이 없습니다.</p>
            )}
        </div>
    );
}

/* ── Artwork Search/Link Editor ── */
export function ArtworkLinker({ selectedArtworks, onChange }: { selectedArtworks: any[]; onChange: (v: any[]) => void }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    const search = async () => {
        if (!query.trim()) return;
        setSearching(true);
        try {
            const res = await fetch(`/api/artworks?q=${encodeURIComponent(query)}&limit=10`);
            const json = await res.json();
            const list = json?.data?.artworks || [];
            setResults(Array.isArray(list) ? list : []);
        } catch { setResults([]); }
        setSearching(false);
    };

    const addArtwork = (a: any) => {
        if (!selectedArtworks.some(s => s.id === a.id)) {
            onChange([...selectedArtworks, { id: a.id, title: a.title, artist: a.artist, image: a.image }]);
        }
    };

    const removeArtwork = (id: string) => {
        onChange(selectedArtworks.filter(a => a.id !== id));
    };

    return (
        <div className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-tight dark:text-white mb-4 flex items-center gap-1.5"><FrameIcon className="w-4 h-4" /> 연동 작품</h3>

            {/* Search */}
            <div className="flex gap-2 mb-4">
                <input
                    type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())}
                    placeholder="작품명 또는 작가명 검색..."
                    className="flex-1 bg-gray-50 dark:bg-neutral-800 border-none rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-black dark:focus:ring-white outline-none dark:text-white"
                />
                <button type="button" onClick={search} disabled={searching}
                    className="px-4 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-black hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                    {searching ? '...' : '검색'}
                </button>
            </div>

            {/* Search Results */}
            {results.length > 0 && (
                <div className="bg-gray-50 dark:bg-neutral-800/50 rounded-2xl p-3 mb-4 max-h-[200px] overflow-y-auto space-y-1">
                    {results.map((a) => (
                        <button key={a.id} type="button" onClick={() => addArtwork(a)}
                            disabled={selectedArtworks.some(s => s.id === a.id)}
                            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-neutral-800 transition-colors text-left disabled:opacity-30">
                            {a.image ? (
                                <img src={a.image} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0"><FrameIcon className="w-4 h-4 text-purple-600" /></div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold dark:text-white truncate">{a.title}</p>
                                {a.artist && <p className="text-[10px] text-gray-400">{a.artist}</p>}
                            </div>
                            <span className="text-[10px] text-purple-500 font-bold">+ 추가</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Selected Artworks */}
            {selectedArtworks.length > 0 ? (
                <div className="space-y-2">
                    {selectedArtworks.map((a) => (
                        <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20">
                            {a.image ? (
                                <img src={a.image} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0 text-sm">🖼️</div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold dark:text-white truncate">{a.title}</p>
                                {a.artist && <p className="text-[10px] text-gray-400">{a.artist}</p>}
                            </div>
                            <button type="button" onClick={() => removeArtwork(a.id)} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-xs text-gray-400 text-center py-4">연동된 작품이 없습니다. 검색하여 추가하세요.</p>
            )}
        </div>
    );
}
