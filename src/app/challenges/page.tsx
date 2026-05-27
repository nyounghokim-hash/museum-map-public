import { TrophyIcon } from '@/components/ui/Icons';

export default function ChallengesPage() {
    return (
        <div className="max-w-3xl mx-auto p-8 mt-10 text-center">
            <div className="w-24 h-24 bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <TrophyIcon className="w-12 h-12" />
            </div>
            <h1 className="text-3xl font-extrabold mb-4 dark:text-white">Monthly Challenges</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg">
                Visit 3 Contemporary Arts Museums in Europe this month to earn the Pioneer Badge!
            </p>

            <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-2xl p-8 shadow-sm">
                <div className="flex justify-between mb-2 text-sm font-semibold dark:text-white">
                    <span>Progress</span>
                    <span>1 / 3</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-neutral-700 rounded-full h-4 mb-6 relative overflow-hidden">
                    <div className="bg-orange-500 h-4 rounded-full" style={{ width: '33%' }}></div>
                </div>

                <button className="bg-black dark:bg-white text-white dark:text-black px-8 py-3 rounded-xl font-bold transition-all hover:opacity-90 active:scale-95 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-800">
                    Opt-in to Taste Matching
                </button>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Opt-in to see and compare challenges with other users</p>
            </div>
        </div>
    );
}
