export default function BlogLoading() {
    return (
        <div data-mm-page="blog" className="no-back-swipe mm-editorial-page2 mm-library-page2 w-full max-w-[960px] mx-auto px-4 pt-4 sm:px-6 sm:pt-8 md:px-8 pb-32 lg:pb-10">
            <div className="mm-gallery-hero p-5 sm:p-7 mb-4 sm:mb-6">
                <div className="mm-skel-line w-20 mb-4 opacity-40" />
                <div className="mm-skel-line h-8 w-52 mb-3 opacity-50" />
                <div className="mm-skel-line w-64 opacity-40" />
                <div className="flex mt-5 gap-2 overflow-hidden">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="mm-skel-pill h-8 w-20 shrink-0" />
                    ))}
                </div>
            </div>
            <div className="mb-5">
                <div className="mm-skel-pill h-[58px] w-full" />
            </div>
            <div className="mm-section-heading">
                <div className="mm-skel-line h-5 w-28" />
            </div>
            <div className="flex gap-4 overflow-hidden pb-2">
                {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="mm-actual-skeleton w-[220px] shrink-0 overflow-hidden">
                        <div className="mm-skel-block h-32" style={{ borderRadius: 0 }} />
                        <div className="space-y-2 p-3.5">
                            <div className="mm-skel-line w-16" />
                            <div className="mm-skel-line h-5 w-36" />
                            <div className="mm-skel-line w-28" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
