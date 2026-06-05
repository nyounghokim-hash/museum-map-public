'use client';
import { useState, useEffect, use } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import { useModal } from '@/components/ui/Modal';
import { t } from '@/lib/i18n';
import { InfoTableEditor, ArtworksEditor, MuseumLinker, ArtworkLinker } from '@/components/blog/BlogEditorPanels';
import 'react-quill/dist/quill.snow.css';

// Polyfill for findDOMNode in React 19
if (typeof window !== 'undefined') {
    const ReactDOM = require('react-dom');
    if (!ReactDOM.findDOMNode) {
        ReactDOM.findDOMNode = (n: any) => n;
    }
}

// Fix for react-quill SSR/React 18-19 compatibility
const ReactQuill = dynamic(async () => {
    const { default: RQ } = await import('react-quill');
    return function QuillWrapper(props: any) {
        return <RQ {...props} />;
    };
}, {
    ssr: false,
    loading: () => <div className="skeleton h-[320px] rounded-xl" />
});

export default function BlogEditPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const id = resolvedParams.id;
    const { locale } = useApp();
    const { showAlert } = useModal();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [author, setAuthor] = useState('');
    const [previewImage, setPreviewImage] = useState('');
    const [status, setStatus] = useState('DRAFT');
    const [loading, setLoading] = useState(false);
    const [infoTable, setInfoTable] = useState<any[]>([]);
    const [artworks, setArtworks] = useState<any[]>([]);
    const [selectedMuseums, setSelectedMuseums] = useState<any[]>([]);
    const [selectedArtworkLinks, setSelectedArtworkLinks] = useState<any[]>([]);

    useEffect(() => {
        if (id) {
            fetch(`/api/blog/${id}`)
                .then(r => r.json())
                .then(res => {
                    const post = res.data;
                    if (post) {
                        setTitle(post.title);
                        setContent(post.content);
                        setAuthor(post.author || '');
                        setPreviewImage(post.previewImage || '');
                        setStatus(post.status);
                        setInfoTable(post.infoTable || []);
                        setArtworks(post.artworks || []);
                        // Extract museum data from StoryMuseum relation
                        const museums = post.museums?.map((sm: any) => sm.museum || sm) || [];
                        setSelectedMuseums(museums);
                        // Extract linked artworks from StoryArtwork relation
                        const linkedArtworks = post.storyArtworks?.map((sa: any) => sa.artwork || sa) || [];
                        setSelectedArtworkLinks(linkedArtworks);
                    }
                });
        }
    }, [id]);

    const handleSave = async () => {
        if (!title || !content) {
            showAlert(locale.startsWith('ko') ? '제목과 내용을 모두 입력해 주세요.' : 'Please fill in both title and content.');
            return;
        }
        // Sanitize AI-like formatting from title and content
        const sanitizeText = (s: string) => s
            .replace(/\*\*/g, '')
            .replace(/(?:^|\n)#{1,6}\s*/g, '\n')
            .replace(/[""]/g, '')
            .replace(/['']/g, "'")
            .replace(/^\s*[-*•]\s+/gm, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        const sanitizeHtml = (s: string) => s
            .replace(/\*\*/g, '')
            .replace(/<h[1-6][^>]*>/gi, '<p><strong>')
            .replace(/<\/h[1-6]>/gi, '</strong></p>')
            .replace(/[""]/g, '')
            .replace(/['']/g, "'")
            .trim();
        const cleanTitle = sanitizeText(title);
        const cleanContent = sanitizeHtml(content);
        setLoading(true);
        try {
            const res = await fetch(`/api/blog/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: cleanTitle, content: cleanContent, author, previewImage, status,
                    infoTable: infoTable.length > 0 ? infoTable : null,
                    artworks: artworks.length > 0 ? artworks : null,
                    museumIds: selectedMuseums.map(m => m.id),
                    artworkIds: selectedArtworkLinks.map(a => a.id),
                })
            });
            if (res.ok) {
                router.push('/admin');
            } else {
                const err = await res.json();
                showAlert(locale.startsWith('ko') ? '저장하지 못했어요. 잠시 후 다시 시도해 주세요.' : 'Failed to save. Please try again.');
            }
        } catch (err) {
            console.error('Save error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-[1080px] w-full mx-auto p-4 sm:p-8 mt-4 sm:mt-10 min-h-[800px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2.5 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full transition-colors border border-gray-100 dark:border-neutral-800">
                        <svg className="w-5 h-5 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black dark:text-white uppercase tracking-tight">스토리 수정</h1>
                        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-0.5">ID: {id?.slice(0, 8)}...</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => router.back()}
                        className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-8 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-black shadow-lg shadow-black/10 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {loading ? '저장 중...' : '변경사항 저장'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Side: Editor */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-sm">
                        <div className="mb-6">
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">스토리 제목</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="제목을 입력하세요..."
                                className="w-full text-xl sm:text-2xl font-black bg-transparent border-none p-0 focus:ring-0 outline-none dark:text-white placeholder:text-gray-200 dark:placeholder:text-gray-700"
                            />
                        </div>

                        <div className="min-h-[500px] mb-4">
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">본문 내용</label>
                            <div className="quill-container border-none">
                                <ReactQuill
                                    theme="snow"
                                    value={content}
                                    onChange={setContent}
                                    placeholder="당신의 이야기를 들려주세요..."
                                    className="dark:text-white"
                                    modules={{
                                        toolbar: [
                                            [{ 'header': [1, 2, 3, false] }],
                                            ['bold', 'italic', 'underline'],
                                            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                            ['link', 'image'],
                                            ['clean']
                                        ]
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Info Table + Artworks + Museums (below editor) */}
                    <InfoTableEditor value={infoTable} onChange={setInfoTable} />
                    <ArtworksEditor value={artworks} onChange={setArtworks} />
                    <ArtworkLinker selectedArtworks={selectedArtworkLinks} onChange={setSelectedArtworkLinks} />
                    <MuseumLinker selectedMuseums={selectedMuseums} onChange={setSelectedMuseums} />
                </div>

                {/* Right Side: Metadata */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
                        <h3 className="text-sm font-black uppercase tracking-tight mb-6 dark:text-white">발행 정보</h3>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">작성자 명칭</label>
                                <input
                                    type="text"
                                    value={author}
                                    onChange={(e) => setAuthor(e.target.value)}
                                    placeholder="관리자"
                                    className="w-full bg-gray-50 dark:bg-neutral-800/50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-black dark:focus:ring-white outline-none dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">공개 상태 설정</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setStatus('DRAFT')}
                                        className={`py-3 rounded-2xl text-[11px] font-black tracking-widest uppercase transition-all ${status === 'DRAFT' ? 'bg-black text-white dark:bg-white dark:text-black shadow-lg' : 'bg-gray-50 dark:bg-neutral-800 text-gray-400'}`}
                                    >
                                        초안
                                    </button>
                                    <button
                                        onClick={() => setStatus('PUBLISHED')}
                                        className={`py-3 rounded-2xl text-[11px] font-black tracking-widest uppercase transition-all ${status === 'PUBLISHED' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-50 dark:bg-neutral-800 text-gray-400'}`}
                                    >
                                        전체공개
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">미리보기 이미지 URL</label>
                                <input
                                    type="text"
                                    value={previewImage}
                                    onChange={(e) => setPreviewImage(e.target.value)}
                                    placeholder="https://images.unsplash.com/..."
                                    className="w-full bg-gray-50 dark:bg-neutral-800/50 border-none rounded-2xl px-5 py-4 text-xs font-mono focus:ring-2 focus:ring-black dark:focus:ring-white outline-none dark:text-white shadow-inner"
                                />
                                {previewImage && (
                                    <div className="mt-4 rounded-2xl overflow-hidden border border-gray-100 dark:border-neutral-800 aspect-video bg-gray-50 dark:bg-neutral-800 shadow-sm relative group">
                                        <img src={previewImage} alt="Preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { e.currentTarget.src = '/logo.svg'; e.currentTarget.className = 'w-full h-full object-contain p-10 opacity-20 dark:invert dark:opacity-60'; }} />
                                        <div className="absolute inset-0 bg-black/10 transition-opacity group-hover:opacity-0" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-3xl p-6 border border-indigo-100 dark:border-indigo-900/20 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-xl">💡</span>
                            <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-200 uppercase tracking-tight">작성 팁</h4>
                        </div>
                        <p className="text-xs text-indigo-800/70 dark:text-indigo-300/60 leading-relaxed font-bold">
                            변경사항은 "변경사항 저장"을 클릭하는 즉시 반영됩니다. 초안 상태인 게시물은 일반 사용자에게 노출되지 않습니다.
                        </p>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                .ql-container.ql-snow { border: none !important; font-family: inherit; font-size: 1rem; }
                .ql-toolbar.ql-snow { border: none !important; border-bottom: 1px solid #f3f4f6 !important; padding: 12px 0 !important; }
                .dark .ql-toolbar.ql-snow { border-bottom: 1px solid #262626 !important; }
                .ql-editor { padding: 24px 0 !important; min-height: 480px !important; }
                .ql-editor.ql-blank::before { left: 0 !important; color: #d1d5db !important; font-style: normal !important; }
                .dark .ql-editor.ql-blank::before { color: #404040 !important; }
                .ql-snow .ql-stroke { stroke: #9ca3af !important; }
                .dark .ql-snow .ql-stroke { stroke: #525252 !important; }
                .ql-snow .ql-fill { fill: #9ca3af !important; }
            `}</style>
        </div>
    );
}
