'use client';
import { useState } from 'react';
import { GlassPanel } from '@/components/ui/glass';
import { useRouter } from 'next/navigation';
import { useModal } from '@/components/ui/Modal';
import { useApp } from '@/components/AppContext';
import { TrophyIcon } from '@/components/ui/Icons';

export default function ChallengePage() {
    const router = useRouter();
    const { showAlert } = useModal();
    const { locale } = useApp();
    const [joined, setJoined] = useState(false);
    const [progress, setProgress] = useState(0); // mock progress

    const handleJoin = async () => {
        // mock challenge ID call
        await fetch('/api/challenges/cm0abc123/join', { method: 'POST' });
        setJoined(true);
        showAlert(locale === 'ko' ? '챌린지에 참여하셨습니다!' : 'You have joined the challenge!');
    };

    const handleCheckProgress = async () => {
        // Instead of completing it instantly, pretend they visited 2 museums
        if (progress < 2) {
            setProgress(p => p + 1);
            showAlert(locale === 'ko' ? '진행 상황이 확인되었습니다! 다음 단계를 향해 나아가세요.' : 'Progress Validated! Keep going.');
        } else {
            const nextProgress = progress + 1;
            setProgress(nextProgress);
            await fetch('/api/challenges/cm0abc123/complete', { method: 'POST' });
            showAlert(locale === 'ko' ? '챌린지 완료! 뱃지가 수여되었습니다.' : 'Challenge Completed! Badge Awarded.');
            router.push('/collections');
        }
    };

    return (
        <div className="max-w-3xl mx-auto p-6 mt-10 text-center">
            <GlassPanel intensity="heavy" className="p-10 relative overflow-hidden">
                {/* Glow effect */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-orange-400/20 rounded-full blur-3xl -z-10"></div>

                <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-red-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                    <TrophyIcon className="w-12 h-12" />
                </div>

                <h1 className="text-3xl font-extrabold mb-4 tracking-tight">Monthly Pioneer Challenge</h1>
                <p className="text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
                    Visit and write 3-line reviews for any 3 Contemporary Arts Museums globally this month to earn the Pioneer Profile Badge.
                </p>

                {!joined ? (
                    <button
                        onClick={handleJoin}
                        className="gradient-btn text-white px-8 py-4 rounded-xl font-bold shadow-xl transition-all active:scale-95 w-full sm:w-auto"
                    >
                        Accept Challenge & Opt-in Match
                    </button>
                ) : (
                    <div className="bg-white/80 border border-gray-100 rounded-2xl p-6 shadow-sm">
                        <div className="flex justify-between mb-3 text-sm font-bold text-gray-700">
                            <span>Your Progress</span>
                            <span className="text-orange-600">{progress} / 3 Visited</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-4 mb-6 relative overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-orange-400 to-red-500 h-4 rounded-full transition-all duration-500"
                                style={{ width: `${(progress / 3) * 100}%` }}
                            ></div>
                        </div>

                        <button
                            onClick={handleCheckProgress}
                            className="bg-orange-500 text-white px-8 py-3 rounded-xl font-bold shadow-md hover:bg-orange-600 transition-all active:scale-95"
                        >
                            {progress >= 3 ? 'Claim Reward' : 'Check My Visits'}
                        </button>
                    </div>
                )}
            </GlassPanel>
        </div>
    );
}
