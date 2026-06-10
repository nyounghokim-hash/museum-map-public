'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState, useEffect } from 'react';
import MuseumDetailCard from '@/components/museum/MuseumDetailCard';
import { useSwipeBack } from '@/hooks/useSwipeBack';
import { addMuseumView } from '@/lib/museum-history';

export default function MuseumClient({ museumId, initialData }: { museumId: string; initialData?: any }) {
    const router = useRouter();
    const [isExiting, setIsExiting] = useState(false);
    const [isFromBack, setIsFromBack] = useState(false);
    const [isFromForward, setIsFromForward] = useState(false);
    const isBackingRef = useRef(false);

    useEffect(() => {
        // Track museum view in localStorage history
        addMuseumView(museumId);

        if (typeof window !== 'undefined') {
            const backTs = sessionStorage.getItem('navigating-back');
            if (backTs && Date.now() - parseInt(backTs) < 500) {
                setIsFromBack(true);
            }
            sessionStorage.removeItem('navigating-back');

            const forwardTs = sessionStorage.getItem('navigating-forward');
            if (forwardTs && Date.now() - parseInt(forwardTs) < 900) {
                setIsFromForward(true);
            }
            sessionStorage.removeItem('navigating-forward');

            // 외부 링크/직접 진입(referrer가 없거나 외부)이면 history에 맵을 미리 넣어
            // 사용자가 브라우저 뒤로가기를 누를 때 사이트를 떠나지 않고 맵으로 이동하도록.
            try {
                const ref = document.referrer;
                const sameOrigin = !!ref && new URL(ref).origin === window.location.origin;
                const hasArtworkReturn = !!sessionStorage.getItem('artwork-to-museum-return');
                const hasDetailSource = new URLSearchParams(window.location.search).has('from');
                if (!sameOrigin && !hasArtworkReturn && !hasDetailSource && !sessionStorage.getItem('back-anchor-set')) {
                    const here = window.location.pathname + window.location.search;
                    window.history.replaceState({ backAnchor: true }, '', '/');
                    window.history.pushState({ detail: true }, '', here);
                    sessionStorage.setItem('back-anchor-set', '1');
                }
            } catch { /* ignore */ }
        }
    }, [museumId]);

    const handleBack = useCallback(() => {
        if (isBackingRef.current) return;
        isBackingRef.current = true;
        setIsExiting(true);
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('navigating-back', String(Date.now()));
            const artworkReturn = sessionStorage.getItem('artwork-to-museum-return');
            if (artworkReturn && window.history.length <= 1) {
                sessionStorage.removeItem('artwork-to-museum-return');
                router.replace(artworkReturn);
                return;
            }
            const historyState = window.history.state;
            if (historyState?.backAnchor) {
                router.replace('/');
                return;
            }
        }
        router.back();
    }, [router]);

    useSwipeBack({ onBack: handleBack });

    return (
        <div className={`w-full xl:max-w-4xl mx-auto p-0 sm:p-6 pb-0 sm:pb-6 mt-0 sm:mt-6 bg-white dark:bg-neutral-950 xl:bg-transparent xl:dark:bg-transparent min-h-screen xl:min-h-0 ${isExiting ? 'page-slide-out' : isFromBack ? 'page-slide-in-back' : isFromForward ? 'page-slide-in-forward' : 'page-slide-in'}`}>
            <MuseumDetailCard museumId={museumId} onClose={handleBack} initialData={initialData} />
        </div>
    );
}
