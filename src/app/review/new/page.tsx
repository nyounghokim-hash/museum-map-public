'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GlassPanel } from '@/components/ui/glass';
import { useModal } from '@/components/ui/Modal';
import { useApp } from '@/components/AppContext';
import LoadingAnimation from '@/components/ui/LoadingAnimation';
function ReviewCreateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const museumId = searchParams.get('museumId');
  const { showAlert } = useModal();
  const { locale } = useApp();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Call Review API
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ museumId, content, photos: [] }) // Skipping photo upload logic for MVP mock
    });
    // Automatically flag as visited as part of review creation (UI/UX logic)
    await fetch('/api/visited', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ museumId })
    });
    setLoading(false);
    showAlert(locale === 'ko' ? '리뷰가 제출되었으며 박물관이 방문한 곳으로 등록되었습니다!' : 'Review Submitted & Museum marked as Visited!');
    router.push(`/museums/${museumId}`);
  };
  const lines = content.split('\n');
  const lineCount = lines.length;
  return (
    <div className="max-w-2xl mx-auto p-6 mt-10">
      <GlassPanel className="p-8">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Write a Review</h1>
        <p className="text-gray-500 mb-8 border-b border-gray-100 pb-4">
          Share your experience. Keep it concise.
        </p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="block text-sm font-bold text-gray-700">Your 3-Line Review</label>
              <span className={`text-xs font-semibold ${lineCount > 3 ? 'text-red-500' : 'text-gray-400'}`}>
                {lineCount} / 3 lines
              </span>
            </div>
            <textarea
              required
              rows={3}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="1st line... 2nd line... 3rd line..."
              className={`w-full p-4 bg-white/50 backdrop-blur-sm border rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-black transition-all ${lineCount > 3 ? 'border-red-500 focus:ring-red-500' : 'border-gray-200'}`}
            />
            {lineCount > 3 && <p className="text-xs text-red-500 mt-1">You have exceeded the 3-line limit.</p>}
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Upload Photos (Max 3)</label>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50/50 hover:bg-gray-100 transition-colors cursor-pointer">
              <p className="text-sm font-semibold text-gray-500">Click to upload or drag and drop</p>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</p>
            </div>
          </div>
          <button
            type="submit"
            disabled={lineCount > 3 || loading}
            className="w-full bg-black text-white font-bold py-4 rounded-xl shadow-lg hover:bg-neutral-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            {loading ? 'Submitting...' : 'Complete & Submit'}
          </button>
        </form>
      </GlassPanel>
    </div>
  );
}
export default function ReviewCreatePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><LoadingAnimation size={120} /></div>}>
      <ReviewCreateForm />
    </Suspense>
  );
}
