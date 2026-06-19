export default function CollectionsLoading() {
    return (
        <div data-mm-page="collections" className="no-back-swipe mm-editorial-page2 mm-travel-page2 w-full lg:max-w-[960px] mx-auto px-4 pt-4 sm:px-6 sm:pt-8 md:px-8 pb-32 lg:pb-10">
            <div className="mm-gallery-hero p-5 sm:p-7 mb-5 sm:mb-6">
                <div className="mm-skel-line w-24 mb-4 opacity-40" />
                <div className="mm-skel-line h-8 w-44 mb-3 opacity-50" />
                <div className="mm-skel-line w-64 opacity-40" />
            </div>
            <div className="flex gap-2 mb-6">
                <div className="mm-skel-pill h-10 flex-1" />
                <div className="mm-skel-pill h-10 flex-1" />
            </div>
            <div className="flex flex-col gap-3 sm:gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="mm-actual-skeleton p-5">
                        <div className="mm-skel-line h-6 w-3/5 mb-3" />
                        <div className="flex items-center gap-3 mt-2">
                            <div className="flex -space-x-2">
                                {Array.from({ length: 4 }).map((__, thumbIndex) => (
                                    <div key={thumbIndex} className="mm-skel-circle w-7 h-7 border-2 border-white dark:border-neutral-900" />
                                ))}
                            </div>
                            <div className="mm-skel-line w-20" />
                            <div className="hidden sm:block mm-skel-pill w-16" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
