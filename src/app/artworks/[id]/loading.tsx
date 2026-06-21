export default function Loading() {
    return (
        <main className="mm-artwork-detail-page2 min-h-[100dvh] w-full px-4 pb-32 pt-4 sm:px-6 sm:pt-8 lg:pb-10">
            <div className="mx-auto w-full max-w-[920px]">
                <div className="mm-detail-hero2 overflow-hidden">
                    <div className="aspect-[4/3] w-full bg-slate-100 dark:bg-neutral-900">
                        <div className="h-full w-full mm-skel-block" />
                    </div>
                    <div className="mm-detail-hero-copy space-y-3">
                        <div className="mm-skel-line h-4 w-24 opacity-50" />
                        <div className="mm-skel-line h-8 w-56 opacity-60" />
                        <div className="mm-skel-line w-36 opacity-45" />
                    </div>
                </div>
                <div className="mm-artwork-detail-body2 mt-5 space-y-4">
                    <div className="mm-skel-line h-5 w-24" />
                    <div className="space-y-2">
                        <div className="mm-skel-line w-full" />
                        <div className="mm-skel-line w-11/12" />
                        <div className="mm-skel-line w-2/3" />
                    </div>
                </div>
            </div>
        </main>
    );
}
