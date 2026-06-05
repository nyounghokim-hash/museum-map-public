"use client";

interface LoadingAnimationProps {
    size?: number;
    className?: string;
    /** If true, no fixed overlay — just the animation inline */
    inline?: boolean;
}

/**
 * 단순한 블루 스피너.
 * 이전에는 lottie-react + /loading.json 으로 운영했으나 번들 크기와
 * 초기 로딩 지연 때문에 CSS 스피너로 대체.
 */
const LoadingAnimation = ({ size = 160, className = "", inline = false }: LoadingAnimationProps) => {
    const ringSize = Math.max(24, size * 0.3);

    const content = (
        <div
            className="flex items-center justify-center"
            style={{ width: size, height: size }}
        >
            <div
                className="rounded-full border-4 border-blue-200 border-t-blue-600 dark:border-neutral-700 dark:border-t-blue-400 animate-spin"
                style={{ width: ringSize, height: ringSize }}
            />
        </div>
    );

    if (inline) return content;

    return (
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white/60 dark:bg-black/60 backdrop-blur-sm ${className}`}>
            {content}
        </div>
    );
};

export default LoadingAnimation;
