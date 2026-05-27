'use client';
import { useState, useEffect, useMemo } from 'react';
import { CameraIcon } from '@/components/ui/Icons';
import { COUNTRY_NAMES } from '@/lib/countries';

export function MuseumEditModal({ museum, onClose, onSave }: { museum: any, onClose: () => void, onSave: (data: any) => void }) {
    const initPhotos = () => {
        try {
            const pp = museum?.placePhotos;
            if (Array.isArray(pp)) return pp.filter(Boolean).slice(0, 5);
            if (typeof pp === 'string') return JSON.parse(pp).filter(Boolean).slice(0, 5);
        } catch { /* */ }
        return museum?.imageUrl ? [museum.imageUrl] : [];
    };
    const [formData, setFormData] = useState({
        id: museum?.id || '',
        name: museum?.name || '',
        description: museum?.description || '',
        country: museum?.country || '',
        city: museum?.city || '',
        type: museum?.type || 'MUSEUM',
        latitude: museum?.latitude || 0,
        longitude: museum?.longitude || 0,
        imageUrl: museum?.imageUrl || '',
        website: museum?.website || '',
        visitorInfo: museum?.visitorInfo || [],
        placePhotos: initPhotos(),
    });
    const [newPhotoUrl, setNewPhotoUrl] = useState('');
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [loading, setLoading] = useState(!!museum?.id);
    const [saving, setSaving] = useState(false);
    // ISO 3166-1 alpha-2 전체 국가 목록 (CO­UNTRY_NAMES 기반). API 호출 불필요.
    const countryOptions = useMemo(() => {
        const base = Object.entries(COUNTRY_NAMES).map(([code, names]) => ({
            code,
            name: (names as any).ko || (names as any).en || code,
        }));
        // 현재 저장된 국가 코드가 COUNTRY_NAMES에 없을 경우 동적 추가
        const current = (museum?.country || '').trim();
        if (current && !base.some(o => o.code === current)) {
            let label = current;
            try { label = new Intl.DisplayNames(['ko'], { type: 'region' }).of(current) || current; } catch { }
            base.push({ code: current, name: label });
        }
        return base.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }, [museum?.country]);

    useEffect(() => {
        if (!museum?.id) { setLoading(false); return; }
        fetch(`/api/museums/${museum.id}`)
            .then(r => r.json())
            .then(res => {
                const d = res.data;
                if (d) setFormData(prev => ({ ...prev, visitorInfo: d.visitorInfo || [], description: d.description || prev.description }));
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [museum?.id]);

    const handleSubmit = async (e?: any) => {
        if (e?.preventDefault) e.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
            const data = { ...formData, imageUrl: formData.placePhotos.length > 0 ? formData.placePhotos[0] : '' };
            await onSave(data);
        } finally {
            setSaving(false);
        }
    };

    const addPhoto = () => {
        const url = newPhotoUrl.trim();
        if (!url || formData.placePhotos.length >= 5) return;
        // URL 형식 + http(s) 프로토콜 + 이미지 확장자 or 허용 도메인 검증
        try {
            const u = new URL(url);
            if (!/^https?:$/i.test(u.protocol)) return;
        } catch { return; }
        if (formData.placePhotos.includes(url)) return; // duplicate
        setFormData({ ...formData, placePhotos: [...formData.placePhotos, url] });
        setNewPhotoUrl('');
    };
    const removePhoto = (i: number) => setFormData({ ...formData, placePhotos: formData.placePhotos.filter((_: string, j: number) => j !== i) });
    const movePhoto = (from: number, to: number) => {
        if (to < 0 || to >= formData.placePhotos.length) return;
        const arr = [...formData.placePhotos];
        [arr[from], arr[to]] = [arr[to], arr[from]];
        setFormData({ ...formData, placePhotos: arr });
    };

    const addVisitorInfo = () => setFormData({ ...formData, visitorInfo: [...formData.visitorInfo, { label: '', value: '', icon: '📌' }] });
    const updateVi = (i: number, f: string, v: string) => { const u = [...formData.visitorInfo]; u[i] = { ...u[i], [f]: v }; setFormData({ ...formData, visitorInfo: u }); };
    const removeVi = (i: number) => setFormData({ ...formData, visitorInfo: formData.visitorInfo.filter((_: any, j: number) => j !== i) });

    const ICONS = ['🎫', '🕐', '📍', '🚇', '⏱️', '📌', '🌐', '🎨'];
    const LABELS = ['입장료', '운영시간', '위치', '교통', '관람시간', '가는 길'];

    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div className="admin-modal max-w-2xl" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="admin-modal-header">
                    <div>
                        <h2>{museum ? '정보 수정' : '박물관/미술관 등록'}</h2>
                        <p>미술관/박물관</p>
                    </div>
                    <button onClick={onClose} className="admin-btn-icon">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="admin-modal-body space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="admin-label">명칭</label>
                                    <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="admin-input" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="admin-label">설명</label>
                                    <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="admin-textarea" />
                                </div>
                                <div>
                                    <label className="admin-label">국가</label>
                                    <select required value={formData.country} onChange={e => setFormData({ ...formData, country: e.target.value })}
                                        className="admin-select">
                                        <option value="">국가 선택</option>
                                        {countryOptions.map(c => (
                                            <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="admin-label">도시</label>
                                    <input required value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })}
                                        className="admin-input" />
                                </div>
                                <div>
                                    <label className="admin-label">위도</label>
                                    <input type="number" step="any" required value={formData.latitude} onChange={e => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                                        className="admin-input" />
                                </div>
                                <div>
                                    <label className="admin-label">경도</label>
                                    <input type="number" step="any" required value={formData.longitude} onChange={e => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                                        className="admin-input" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="admin-label">웹사이트</label>
                                    <input value={formData.website} onChange={e => setFormData({ ...formData, website: e.target.value })}
                                        className="admin-input" />
                                </div>
                            </div>

                            {/* Photo Management */}
                            <div className="admin-section">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="admin-section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CameraIcon className="w-4 h-4" /> 사진 관리 <span style={{ fontSize: 'var(--mm-font-sm)', fontWeight: 400, color: 'var(--mm-text-tertiary)' }}>({formData.placePhotos.length}/5 · 첫번째 = 썸네일)</span></h3>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                                    {formData.placePhotos.map((url: string, idx: number) => (
                                        <div key={idx} className={`admin-photo-item ${idx === 0 ? 'admin-photo-item--active' : ''} group`}
                                            draggable onDragStart={() => setDragIdx(idx)}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={() => { if (dragIdx !== null && dragIdx !== idx) movePhoto(dragIdx, idx); setDragIdx(null); }}>
                                            <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover"
                                                onError={(e) => { e.currentTarget.src = '/logo.svg'; e.currentTarget.className = 'w-full h-full object-contain p-4 opacity-20'; }} />
                                            {idx === 0 && <span className="absolute top-1 left-1 text-white text-[8px] px-1.5 py-0.5 rounded-md font-black" style={{ background: 'var(--mm-brand)' }}>썸네일</span>}
                                            {/* 삭제 버튼 — 항상 보이게 (모바일 대응) */}
                                            <button type="button" onClick={() => removePhoto(idx)}
                                                className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full text-white text-[10px] font-black shadow-md"
                                                style={{ background: '#EF4444' }}>✕</button>
                                            {/* 이동 버튼 — 데스크탑 호버 시만 */}
                                            <div className="absolute inset-x-0 bottom-0 bg-black/50 hidden group-hover:flex items-center justify-center gap-1 py-1">
                                                {idx > 0 && <button type="button" onClick={() => movePhoto(idx, idx - 1)} className="p-0.5 bg-white/80 rounded text-[10px]">◀</button>}
                                                {idx < formData.placePhotos.length - 1 && <button type="button" onClick={() => movePhoto(idx, idx + 1)} className="p-0.5 bg-white/80 rounded text-[10px]">▶</button>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {formData.placePhotos.length < 5 && (
                                    <div className="flex gap-2">
                                        <input value={newPhotoUrl} onChange={e => setNewPhotoUrl(e.target.value)} placeholder="https://... 사진 URL 입력"
                                            className="admin-input admin-input--mono flex-1"
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPhoto(); } }} />
                                        <button type="button" onClick={addPhoto}
                                            className="admin-btn admin-btn-primary admin-btn-sm">추가</button>
                                    </div>
                                )}
                            </div>

                            {/* 방문 정보 */}
                            <div className="admin-section">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="admin-section-title">방문 정보</h3>
                                    <button type="button" onClick={addVisitorInfo} className="admin-btn admin-btn-primary admin-btn-sm">+ 추가</button>
                                </div>
                                <div className="space-y-3">
                                    {formData.visitorInfo.map((item: any, idx: number) => (
                                        <div key={idx} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-start p-3" style={{ background: 'var(--mm-surface-secondary)', borderRadius: 'var(--mm-radius-xl)' }}>
                                            <select value={item.icon || '📌'} onChange={e => updateVi(idx, 'icon', e.target.value)}
                                                className="admin-select" style={{ width: 'auto', padding: '0.5rem', fontSize: '1rem' }}>
                                                {ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                                            </select>
                                            <div className="flex-1 space-y-2">
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <select value={LABELS.includes(item.label) ? item.label : '__custom'} onChange={e => { if (e.target.value !== '__custom') updateVi(idx, 'label', e.target.value); }}
                                                        className="admin-select" style={{ width: 'auto', padding: '0.5rem 0.75rem', fontSize: 'var(--mm-font-sm)' }}>
                                                        {LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                                                        <option value="__custom">직접 입력</option>
                                                    </select>
                                                    <input value={item.label} onChange={e => updateVi(idx, 'label', e.target.value)} placeholder="라벨"
                                                        className="admin-input flex-1" style={{ padding: '0.5rem 0.75rem', fontSize: 'var(--mm-font-sm)' }} />
                                                </div>
                                                <textarea value={item.value} onChange={e => updateVi(idx, 'value', e.target.value)} placeholder="값 (예: 무료, 화~일 10:00-18:00)"
                                                    className="admin-textarea" style={{ minHeight: '50px', padding: '0.5rem 0.75rem', fontSize: 'var(--mm-font-sm)' }} />
                                            </div>
                                            <button type="button" onClick={() => removeVi(idx)} className="admin-btn-icon admin-btn-icon--danger">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                    {formData.visitorInfo.length === 0 && (
                                        <p style={{ fontSize: 'var(--mm-font-sm)', color: 'var(--mm-text-tertiary)', textAlign: 'center', padding: '1rem 0' }}>방문 정보 없음. &quot;추가&quot;를 클릭하세요.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="admin-modal-footer">
                            <button type="button" onClick={onClose} className="admin-btn admin-btn-secondary" disabled={saving}>취소</button>
                            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                                {saving ? <><span className="admin-spinner" /> 저장 중...</> : '저장하기'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

export function ArtworkEditModal({ artwork, onClose, onSave }: { artwork: any, onClose: () => void, onSave: (data: any) => void }) {
    const [formData, setFormData] = useState({
        id: artwork?.id || '',
        title: artwork?.title || '',
        titleKo: artwork?.titleKo || '',
        artist: artwork?.artist || '',
        artistKo: artwork?.artistKo || '',
        image: artwork?.image || '',
        description: artwork?.description || '',
        descriptionKo: artwork?.descriptionKo || '',
        year: artwork?.year || '',
        museumId: artwork?.museumId || artwork?.museum?.id || '',
    });
    const [museumSearch, setMuseumSearch] = useState('');
    const [museumResults, setMuseumResults] = useState<any[]>([]);
    const [selectedMuseumName, setSelectedMuseumName] = useState(artwork?.museum?.nameKo || artwork?.museum?.name || '');
    const [showMuseumDropdown, setShowMuseumDropdown] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!museumSearch || museumSearch.length < 2) { setMuseumResults([]); return; }
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/admin/museums?query=${encodeURIComponent(museumSearch)}&limit=8`);
                const json = await res.json();
                setMuseumResults(json?.data?.data || []);
            } catch { setMuseumResults([]); }
        }, 300);
        return () => clearTimeout(timer);
    }, [museumSearch]);

    const handleSubmit = async (e?: any) => {
        e?.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
            await onSave(formData);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div className="admin-modal max-w-lg" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="admin-modal-header">
                    <div>
                        <h2>{artwork ? '작품 수정' : '작품 등록'}</h2>
                        <p>작품 관리</p>
                    </div>
                    <button onClick={onClose} className="admin-btn-icon">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="admin-modal-body space-y-5">
                        <div>
                            <label className="admin-label">작품명 원문 *</label>
                            <input required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
                                className="admin-input" placeholder="Mona Lisa" />
                        </div>
                        <div>
                            <label className="admin-label">작품명 한글</label>
                            <input value={formData.titleKo} onChange={e => setFormData({ ...formData, titleKo: e.target.value })}
                                className="admin-input" placeholder="모나리자" />
                        </div>
                        <div>
                            <label className="admin-label">작가 원문</label>
                            <input value={formData.artist} onChange={e => setFormData({ ...formData, artist: e.target.value })}
                                className="admin-input" placeholder="Leonardo da Vinci" />
                        </div>
                        <div>
                            <label className="admin-label">작가 한글</label>
                            <input value={formData.artistKo} onChange={e => setFormData({ ...formData, artistKo: e.target.value })}
                                className="admin-input" placeholder="레오나르도 다 빈치" />
                        </div>

                        {/* Museum Selector */}
                        <div className="relative">
                            <label className="admin-label">소속 미술관/박물관</label>
                            {selectedMuseumName ? (
                                <div className="flex items-center gap-2 px-5 py-3.5" style={{ background: 'var(--mm-brand-bg)', borderRadius: 'var(--mm-radius-xl)', border: '1px solid var(--mm-brand-light)' }}>
                                    <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--mm-brand)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                    <span className="text-sm font-bold flex-1 truncate" style={{ color: 'var(--mm-brand)' }}>{selectedMuseumName}</span>
                                    <button type="button" onClick={() => { setFormData({ ...formData, museumId: '' }); setSelectedMuseumName(''); }}
                                        className="admin-btn-icon admin-btn-icon--danger" style={{ padding: '2px' }}>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <input
                                        value={museumSearch}
                                        onChange={e => { setMuseumSearch(e.target.value); setShowMuseumDropdown(true); }}
                                        onFocus={() => setShowMuseumDropdown(true)}
                                        className="admin-input"
                                        placeholder="미술관 이름으로 검색 (2글자 이상)..."
                                    />
                                    {showMuseumDropdown && museumResults.length > 0 && (
                                        <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto" style={{ background: 'var(--mm-surface)', borderRadius: 'var(--mm-radius-xl)', boxShadow: 'var(--mm-shadow-lg)', border: '1px solid var(--mm-surface-border)' }}>
                                            {museumResults.map((m: any) => (
                                                <button key={m.id} type="button"
                                                    onClick={() => {
                                                        setFormData({ ...formData, museumId: m.id });
                                                        setSelectedMuseumName(m.nameKo || m.name);
                                                        setMuseumSearch('');
                                                        setShowMuseumDropdown(false);
                                                    }}
                                                    className="w-full text-left px-5 py-3 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                                                    style={{ color: 'var(--mm-text-primary)' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--mm-surface-secondary)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <span className="text-sm font-bold block truncate">{m.nameKo || m.name}</span>
                                                    <span style={{ fontSize: 'var(--mm-font-xs)', color: 'var(--mm-text-tertiary)' }}>{m.cityKo || m.city}, {m.country}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Image URL with delete button */}
                        <div>
                            <label className="admin-label">이미지 URL</label>
                            <div className="flex gap-2">
                                <input value={formData.image} onChange={e => setFormData({ ...formData, image: e.target.value })}
                                    className="admin-input admin-input--mono flex-1"
                                    placeholder="https://..." />
                                {formData.image && (
                                    <button type="button" onClick={() => setFormData({ ...formData, image: '' })}
                                        className="admin-btn admin-btn-danger admin-btn-sm" title="이미지 삭제">✕</button>
                                )}
                            </div>
                            {formData.image && (
                                <div className="mt-3 overflow-hidden aspect-video" style={{ borderRadius: 'var(--mm-radius-xl)', border: '1px solid var(--mm-surface-border)', background: 'var(--mm-surface-secondary)' }}>
                                    <img src={formData.image} alt="Preview" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = '/logo.svg'; e.currentTarget.className = 'w-full h-full object-contain p-12 opacity-20'; }} />
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="admin-label">연도</label>
                            <input value={formData.year} onChange={e => setFormData({ ...formData, year: e.target.value })}
                                className="admin-input" placeholder="1503-1519" />
                        </div>
                        <div>
                            <label className="admin-label">설명 원문</label>
                            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="admin-textarea" placeholder="Artwork description..." />
                        </div>
                        <div>
                            <label className="admin-label">설명 한글</label>
                            <textarea value={formData.descriptionKo} onChange={e => setFormData({ ...formData, descriptionKo: e.target.value })}
                                className="admin-textarea" placeholder="작품에 대한 한국어 설명..." />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="admin-modal-footer">
                        <button type="button" onClick={onClose} className="admin-btn admin-btn-secondary" disabled={saving}>취소</button>
                        <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                            {saving ? <><span className="admin-spinner" /> 저장 중...</> : (artwork ? '변경사항 저장' : '작품 등록')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
