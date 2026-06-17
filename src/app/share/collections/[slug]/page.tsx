'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GlassPanel } from '@/components/ui/glass';
import { useModal } from '@/components/ui/Modal';
import { useApp } from '@/components/AppContext';
import { t } from '@/lib/i18n';
import { navigateWithPending } from '@/lib/route-pending';

export default function SharedCollectionPage() {
    const { locale } = useApp();
    const { showAlert } = useModal();
    const { slug } = useParams();
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/share/collections/${slug}`)
            .then(r => r.json())
            .then(res => {
                setData(res.data);
                setLoading(false);
            });
    }, [slug]);

    const handleCloneToMap = () => {
        // In real app: save all museums in this collection to a user's local folder
        showAlert(t('share.cloned', locale));
        router.push('/saved'); // redirect to saved/collections
    };

    if (loading) return (
        <div className="flex flex-col gap-6 p-4 sm:p-8">
            <div className="skeleton h-8 rounded w-1/2 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="skeleton h-48 rounded-2xl"></div>
                ))}
            </div>
        </div>
    );
    if (!data) return <div className="p-20 text-center text-red-500 font-bold">{t('share.notFound', locale)}</div>;

    return (
        <div className="max-w-4xl mx-auto p-6 mt-10">
            {/* Header Profile & Title */}
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 gradient-btn text-white rounded-full flex justify-center items-center font-bold text-xl uppercase shadow-md">
                    {data.user?.name ? data.user.name[0] : 'U'}
                </div>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight dark:text-white">{data.title}</h1>
                    <p className="text-gray-500 font-medium text-sm">{t('collections.curatedBy', locale)} {data.user?.name || t('global.anonymous', locale)}</p>
                </div>
            </div>

            <p className="text-gray-700 text-lg mb-8 leading-relaxed max-w-2xl">{data.description}</p>

            {/* Action CTA for New Users entering loop */}
            <div className="gradient-btn text-white rounded-2xl p-8 flex flex-col items-center text-center shadow-xl mb-12">
                <h2 className="text-2xl font-bold mb-2">{t('share.inspired', locale)}</h2>
                <p className="text-blue-100 mb-6 font-medium">{t('share.inspiredDesc', locale)}</p>
                <button
                    onClick={handleCloneToMap}
                    className="bg-white text-blue-700 px-8 py-3 rounded-xl font-bold hover:bg-gray-100 transition shadow-md active:scale-95"
                >
                    {t('share.saveAndOpen', locale)}
                </button>
            </div>

            {/* Collection Items */}
            <h3 className="text-xl font-bold mb-6 border-b pb-2">{t('share.itinerary', locale)}</h3>
            <div className="grid gap-6">
                {data.items?.map((item: any, i: number) => (
                    <GlassPanel key={item.id} className="flex gap-4 p-4 items-center">
                        <div className="w-10 h-10 rounded-full bg-gray-100 text-black flex justify-center items-center font-bold border border-gray-200">
                            {i + 1}
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-lg">{item.museum.name}</h4>
                            <p className="text-xs text-gray-500 font-medium">{item.museum.city}, {(() => { try { return new Intl.DisplayNames([locale], { type: 'region' }).of(item.museum.country); } catch { return item.museum.country; } })()}</p>
                        </div>
                        <button
                            onClick={() => navigateWithPending(`/museums/${encodeURIComponent(item.museumId)}`, locale)}
                            className="text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline px-4 transition-colors"
                        >
                            {t('share.viewDetail', locale)}
                        </button>
                    </GlassPanel>
                ))}
            </div>
        </div>
    );
}
