'use client';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html>
            <body className="bg-white dark:bg-neutral-950">
                <div className="min-h-screen flex flex-col items-center justify-center px-6 py-20 text-center">
                    <svg className="w-24 h-24 text-red-400 dark:text-red-500 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>

                    <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-3">
                        화면을 불러오지 못했어요
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">
                        잠시 후 다시 시도해 주세요.
                    </p>

                    <div className="mt-4 mb-8 px-4 py-2 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <span className="text-xs font-mono font-bold text-red-400 dark:text-red-500 tracking-wider">
                            CRITICAL ERROR
                        </span>
                    </div>

                    <button
                        onClick={reset}
                        className="px-6 py-3 rounded-xl gradient-btn text-white text-sm font-bold shadow-md transition-all"
                    >
                        다시 시도하기
                    </button>
                </div>
            </body>
        </html>
    );
}
