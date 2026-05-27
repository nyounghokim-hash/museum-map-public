'use client';

export default function OfflinePage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 p-6">
            <div className="text-center max-w-sm">
                {/* Offline icon */}
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <svg className="w-12 h-12 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                </div>

                <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-3">
                    오프라인 상태예요
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-8">
                    인터넷 연결이 필요합니다.<br />
                    이전에 본 미술관 정보는<br />
                    캐시에서 확인할 수 있어요.
                </p>

                <div className="space-y-3">
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full px-6 py-3 gradient-btn text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-transform"
                    >
                        다시 시도
                    </button>
                    <button
                        onClick={() => window.history.back()}
                        className="w-full px-6 py-3 bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 font-bold rounded-2xl active:scale-95 transition-transform"
                    >
                        뒤로 가기
                    </button>
                </div>

                <p className="mt-8 text-xs text-gray-400 dark:text-neutral-600">
                    Museum Map • Offline Mode
                </p>
            </div>
        </div>
    );
}
