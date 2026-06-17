'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import { useModal } from '@/components/ui/Modal';
import { t } from '@/lib/i18n';

const tx: Record<string, Record<string, string>> = {
    subtitle: {
        ko: '완료된 여행을 다른 사람들에게 영감을 주는 컬렉션으로 만들어보세요.',
        en: 'Turn your completed trips into inspiring collections for others.',
        ja: '完了した旅行を他の人のためのインスピレーションあふれるコレクションにしましょう。',
        de: 'Verwandeln Sie Ihre abgeschlossenen Reisen in inspirierende Sammlungen für andere.',
        fr: 'Transformez vos voyages terminés en collections inspirantes pour les autres.',
        es: 'Convierte tus viajes completados en colecciones inspiradoras para otros.',
        pt: 'Transforme suas viagens concluídas em coleções inspiradoras para outros.',
    },
    titleLabel: { ko: '컬렉션 제목', en: 'Collection Title', ja: 'コレクションタイトル', de: 'Sammlungstitel', fr: 'Titre de la collection', es: 'Título de la colección', pt: 'Título da coleção' },
    titlePlaceholder: { ko: '예: 파리 현대미술 3일 여행', en: 'e.g. 3 Days of Contemporary Art in Paris', ja: '例: パリの現代アート3日間', de: 'z.B. 3 Tage zeitgenössische Kunst in Paris', fr: 'ex. 3 jours d\'art contemporain à Paris', es: 'ej. 3 Días de Arte Contemporáneo en París', pt: 'ex. 3 Dias de Arte Contemporânea em Paris' },
    descLabel: { ko: '설명', en: 'Description', ja: '説明', de: 'Beschreibung', fr: 'Description', es: 'Descripción', pt: 'Descrição' },
    descPlaceholder: { ko: '이 경로가 특별한 이유를 알려주세요...', en: 'Tell others what makes this route special...', ja: 'このルートの特別なところを教えてください...', de: 'Erzählen Sie anderen, was diese Route besonders macht...', fr: 'Dites aux autres ce qui rend cet itinéraire spécial...', es: 'Cuéntales a los demás qué hace especial esta ruta...', pt: 'Conte aos outros o que torna esta rota especial...' },
    selectPlan: { ko: '경로 / 플랜 선택', en: 'Select a Route / Plan', ja: 'ルート/プランを選択', de: 'Route / Plan auswählen', fr: 'Sélectionner un itinéraire / plan', es: 'Seleccionar una Ruta / Plan', pt: 'Selecionar uma Rota / Plano' },
    choosePlan: { ko: '-- 플랜을 선택하세요 --', en: '-- Choose a Plan --', ja: '-- プランを選択 --', de: '-- Plan auswählen --', fr: '-- Choisir un plan --', es: '-- Elegir un Plan --', pt: '-- Escolher um Plano --' },
    makePublic: { ko: '이 컬렉션을 공개 (공유 가능)', en: 'Make this collection Public (Shareable)', ja: 'このコレクションを公開（共有可能）にする', de: 'Diese Sammlung öffentlich machen (teilbar)', fr: 'Rendre cette collection publique (partageable)', es: 'Hacer esta colección pública (compartible)', pt: 'Tornar esta coleção pública (compartilhável)' },
};

function lx(key: string, locale: string): string {
    return tx[key]?.[locale] || tx[key]?.['en'] || key;
}

export default function CreateCollectionPage() {
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [plans, setPlans] = useState<any[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState<string>('');
    const { locale } = useApp();
    const { showAlert } = useModal();

    useEffect(() => {
        fetch('/api/plans').then(r => r.json()).then(res => {
            if (res.data) setPlans(res.data);
        });
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlanId) return showAlert(t('collections.selectPlan', locale));

        const plan = plans.find(p => p.id === selectedPlanId);
        if (!plan) return;

        const items = plan.stops.map((s: any) => ({
            museumId: s.museumId,
            reviewId: s.reviewId || null,
            order: s.order
        }));

        const res = await fetch('/api/collections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description: desc, isPublic, items })
        });
        const data = await res.json();

        if (data.data) {
            showAlert(t('collections.collectionPublished', locale));
            if (isPublic && data.data.shareSlug) {
                router.push(`/share/collections/${data.data.shareSlug}`);
            } else {
                router.push(`/collections`);
            }
        }
    };

    return (
        <div className="w-full max-w-[1080px] mx-auto px-4 py-4 sm:px-6 sm:py-8 md:px-8 mt-4 sm:mt-8 pb-32 lg:pb-8">
            <button
                onClick={() => router.back()}
                className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded-full mb-4 transition-colors shadow-sm active:scale-95 shrink-0"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
            </button>
            <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight dark:text-white">{t('collections.publishCollection', locale)}</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1 sm:mt-2 text-sm">
                    {lx('subtitle', locale)}
                </p>
            </div>

            <form onSubmit={handleCreate} className="glass-panel gradient-border-subtle p-6 rounded-2xl space-y-5">
                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{lx('titleLabel', locale)}</label>
                    <input
                        required type="text" value={title} onChange={e => setTitle(e.target.value)}
                        placeholder={lx('titlePlaceholder', locale)}
                        className="w-full border-gray-300 dark:border-neutral-700 rounded-lg p-3 bg-gray-50 dark:bg-neutral-800 border focus:bg-white dark:focus:bg-neutral-900 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition dark:text-white"
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{lx('descLabel', locale)}</label>
                    <textarea
                        rows={3} value={desc} onChange={e => setDesc(e.target.value)}
                        placeholder={lx('descPlaceholder', locale)}
                        className="w-full border-gray-300 dark:border-neutral-700 rounded-lg p-3 bg-gray-50 dark:bg-neutral-800 border focus:bg-white dark:focus:bg-neutral-900 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition dark:text-white"
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{lx('selectPlan', locale)}</label>
                    <select
                        required value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)}
                        className="w-full border-gray-300 dark:border-neutral-700 rounded-lg p-3 bg-gray-50 dark:bg-neutral-800 border focus:bg-white dark:focus:bg-neutral-900 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition dark:text-white"
                    >
                        <option value="">{lx('choosePlan', locale)}</option>
                        {plans.map(p => (
                            <option key={p.id} value={p.id}>{p.title || `Plan ${p.id}`}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-3 bg-gray-50 dark:bg-neutral-800 p-4 rounded-xl">
                    <input
                        type="checkbox" id="isPublic" checked={isPublic} onChange={e => setIsPublic(e.target.checked)}
                        className="w-5 h-5 accent-blue-600"
                    />
                    <label htmlFor="isPublic" className="text-sm font-bold text-gray-800 dark:text-gray-200">{lx('makePublic', locale)}</label>
                </div>

                <button type="submit" className="w-full gradient-btn text-white font-bold py-3 rounded-xl shadow-lg transition active:scale-95 disabled:opacity-50">
                    {t('collections.publishCollection', locale)}
                </button>
            </form>
        </div>
    );
}
