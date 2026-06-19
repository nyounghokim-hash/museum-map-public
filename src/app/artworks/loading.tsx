export default function ArtworksLoading() {
    return (
        <div data-mm-page="artworks" className="no-back-swipe mm-editorial-page2 mm-library-page2 w-full max-w-[960px] mx-auto px-4 pt-4 sm:px-6 sm:pt-8 md:px-8 pb-32 lg:pb-10">
            <div className="mm-gallery-hero p-5 sm:p-7 mb-5 sm:mb-6">
                <div className="mm-skel-line w-20 mb-4 opacity-40" />
                <div className="mm-skel-line h-8 w-40 mb-3 opacity-50" />
                <div className="mm-skel-line w-64 opacity-40" />
            </div>
            <div className="mb-5">
                <div className="mm-skel-pill h-[58px] w-full" />
            </div>
            <div className="mm-section-heading">
                <div className="mm-skel-line h-5 w-24" />
                <div className="flex items-center gap-2">
                    <div className="mm-skel-line w-12" />
                    <div className="mm-skel-pill w-24" />
                </div>
            </div>
            <div className="mm-artwork-grid2">
                {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="mm-actual-skeleton overflow-hidden">
                        <div className="aspect-[4/3] mm-skel-block" style={{ borderRadius: 0 }} />
                        <div className="space-y-2 p-3.5">
                            <div className="mm-skel-line w-16" />
                            <div className="mm-skel-line h-5 w-28" />
                            <div className="mm-skel-line w-20" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
