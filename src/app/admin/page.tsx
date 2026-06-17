'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/components/AppContext';
import { useModal } from '@/components/ui/Modal';
import { t } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import LoadingAnimation from '@/components/ui/LoadingAnimation';
import { MuseumEditModal, ArtworkEditModal } from './AdminModals';
import { TrashIcon, MapPinIcon, ChatIcon, SparkleIcon, RefreshIcon, SearchIcon, LinkIcon, GlobeIcon, MobileIcon, MoneyIcon, EmailIcon, QuestionIcon, FrameIcon, DesktopIcon, TabletIcon } from '@/components/ui/Icons';

type AdminTab = 'dashboard' | 'users' | 'blog' | 'museums' | 'notifications' | 'ai' | 'analytics' | 'artworks';

const ADMIN_TABS: Array<{ id: AdminTab; label: string; shortLabel: string }> = [
    { id: 'dashboard', label: '대시보드', shortLabel: '대시보드' },
    { id: 'analytics', label: '구글 애널리틱스', shortLabel: '애널리틱스' },
    { id: 'users', label: '사용자 & 피드백', shortLabel: '사용자' },
    { id: 'blog', label: '스토리 관리', shortLabel: '스토리' },
    { id: 'museums', label: '미술관/박물관 관리', shortLabel: '뮤지엄' },
    { id: 'artworks', label: '작품 관리', shortLabel: '작품' },
    { id: 'notifications', label: '알림 전송', shortLabel: '알림' },
    { id: 'ai', label: 'AI 사용량', shortLabel: 'AI' },
];

export default function AdminPage() {
    const router = useRouter();
    const { data: session, status: authStatus } = useSession();
    const { showConfirm, showAlert } = useModal();
    const [authenticated, setAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [users, setUsers] = useState<any[]>([]);
    const [feedbacks, setFeedbacks] = useState<any[]>([]);
    const [posts, setPosts] = useState<any[]>([]);
    const [museums, setMuseums] = useState<any[]>([]);
    const [museumTotal, setMuseumTotal] = useState(0);
    const [museumQuery, setMuseumQuery] = useState('');
    const [museumPage, setMuseumPage] = useState(1);
    const [isMuseumModalOpen, setIsMuseumModalOpen] = useState(false);
    const [editingMuseum, setEditingMuseum] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [exhibitionStats, setExhibitionStats] = useState<any[]>([]);
    const [aiUsage, setAiUsage] = useState<any>(null);
    const [gaData, setGaData] = useState<any>(null);
    const [gaLoading, setGaLoading] = useState(false);
    const [billingData, setBillingData] = useState<any>(null);
    const [tab, setTab] = useState<AdminTab>('dashboard');
    const [adminArtworks, setAdminArtworks] = useState<any[]>([]);
    const [artworkTotal, setArtworkTotal] = useState(0);
    const [artworkQuery, setArtworkQuery] = useState('');
    const [artworkPage, setArtworkPage] = useState(1);
    const [isArtworkModalOpen, setIsArtworkModalOpen] = useState(false);
    const [editingArtwork, setEditingArtwork] = useState<any>(null);
    const [notifForm, setNotifForm] = useState({ title: '', message: '', link: '', targetUserId: '', marketingOnly: false });
    const [replyingId, setReplyingId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [sortCol, setSortCol] = useState<string>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const toggleSort = (col: string) => {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortDir('asc'); }
    };
    const sortArrow = (col: string) => sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

    const sortedMuseums = [...museums].sort((a, b) => {
        let va: any, vb: any;
        if (sortCol === 'name') { va = a.name?.toLowerCase(); vb = b.name?.toLowerCase(); }
        else if (sortCol === 'city') { va = a.city?.toLowerCase(); vb = b.city?.toLowerCase(); }
        else if (sortCol === 'type') { va = a.type?.toLowerCase(); vb = b.type?.toLowerCase(); }
        else if (sortCol === 'popularity') { va = a.popularityScore || 0; vb = b.popularityScore || 0; }
        else { va = a.name?.toLowerCase(); vb = b.name?.toLowerCase(); }
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });
    const [sortBy, setSortBy] = useState<'views' | 'date'>('views');
    const { locale } = useApp();

    const handleLogin = async () => {
        setLoading(true);
        // Validate password against API
        try {
            const res = await fetch('/api/users', {
                headers: { 'x-admin-password': password }
            });
            if (res.ok) {
                setAuthenticated(true);
                setError('');
                sessionStorage.setItem('admin-auth', '1');
                sessionStorage.setItem('admin-pw', password);
            } else {
                setError(t('admin.wrongPassword', locale) || 'Invalid password');
            }
        } catch {
            setError('Connection error');
        }
        setLoading(false);
    };

    const fetchAdminData = (silent = false) => {
        if (!silent) setLoading(true);
        let endpoints: string[] = [];

        if (tab === 'dashboard') {
            endpoints = ['/api/admin/dashboard'];
            // Fetch GA, AI, and Billing data in parallel for dashboard summary
            fetch('/api/admin/analytics').then(r => r.json()).then(res => setGaData(res.data)).catch(() => { });
            fetch('/api/admin/ai-usage').then(r => r.json()).then(res => setAiUsage(res.data)).catch(() => { });
            fetch('/api/admin/billing').then(r => r.json()).then(res => setBillingData(res)).catch(() => { });
        } else if (tab === 'users') {
            const adminPw = sessionStorage.getItem('admin-pw') || password;
            const adminHeaders = { 'x-admin-password': adminPw };
            endpoints = ['/api/users', '/api/feedback'];
            // Fetch with headers
            Promise.all(endpoints.map(url => fetch(url, { headers: adminHeaders }).then(r => r.json()))).then(([usersRes, feedbackRes]) => {
                const allUsers = Array.isArray(usersRes.data) ? usersRes.data : [];
                setUsers(allUsers.filter((u: any) => !u.name?.startsWith('guest_') && !u.email?.startsWith('guest_')));
                setFeedbacks(Array.isArray(feedbackRes) ? feedbackRes : []);
                if (!silent) setLoading(false);
            }).catch(() => { if (!silent) setLoading(false); });
            return;
        } else if (tab === 'blog') {
            endpoints = ['/api/blog?includeDrafts=true'];
        } else if (tab === 'museums') {
            endpoints = [`/api/admin/museums?query=${museumQuery}&page=${museumPage}`];
        } else if (tab === 'ai') {
            endpoints = ['/api/admin/ai-usage'];
            fetch('/api/admin/billing').then(r => r.json()).then(res => setBillingData(res)).catch(() => { });
        } else if (tab === 'artworks') {
            endpoints = [`/api/admin/artworks?query=${artworkQuery}&page=${artworkPage}`];
        } else if (tab === 'analytics') {
            setGaLoading(true);
            fetch('/api/admin/analytics').then(r => r.json()).then(res => { setGaData(res.data); setGaLoading(false); setLoading(false); }).catch(() => { setGaLoading(false); setLoading(false); });
            return;
        }

        Promise.all(endpoints.map(e => fetch(e).then(r => r.json())))
            .then((results) => {
                if (tab === 'dashboard') {
                    setDashboardData(results[0]?.data);
                } else if (tab === 'blog') {
                    setPosts(Array.isArray(results[0]?.data) ? results[0].data : []);
                } else if (tab === 'museums') {
                    setMuseums(results[0]?.data?.data || []);
                    setMuseumTotal(results[0]?.data?.total || 0);
                } else if (tab === 'ai') {
                    setAiUsage(results[0]?.data || null);
                } else if (tab === 'artworks') {
                    setAdminArtworks(results[0]?.data?.data || []);
                    setArtworkTotal(results[0]?.data?.total || 0);
                }
                setLoading(false);
            })
            .catch((err) => {
                console.error('Admin fetch error:', err);
                if (!silent) showAlert(err?.message || '데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
                setLoading(false);
            });
    };

    useEffect(() => {
        if (typeof window !== 'undefined' && sessionStorage.getItem('admin-auth')) {
            setAuthenticated(true);
        }
    }, []);

    useEffect(() => {
        if (session?.user && (session.user as any).role === 'ADMIN') {
            setAuthenticated(true);
        }
    }, [session]);

    useEffect(() => {
        if (authenticated) {
            fetchAdminData();
        }
    }, [authenticated, tab, museumPage, artworkPage]);

    // 탭 전환 시 검색어·페이지 리셋 (다른 탭 검색 상태가 남아 UX 혼란 방지)
    useEffect(() => {
        setMuseumQuery('');
        setArtworkQuery('');
        setMuseumPage(1);
        setArtworkPage(1);
    }, [tab]);

    // Debounced search for museums and artworks
    useEffect(() => {
        if (!authenticated) return;
        if (tab !== 'museums') return;
        const timer = setTimeout(() => { setMuseumPage(1); fetchAdminData(true); }, 400);
        return () => clearTimeout(timer);
    }, [museumQuery]);

    useEffect(() => {
        if (!authenticated) return;
        if (tab !== 'artworks') return;
        const timer = setTimeout(() => { setArtworkPage(1); fetchAdminData(true); }, 400);
        return () => clearTimeout(timer);
    }, [artworkQuery]);

    const handleMuseumSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setMuseumPage(1);
        fetchAdminData();
    };

    const handleSaveMuseum = async (museumData: any) => {
        try {
            const method = museumData.id ? 'PUT' : 'POST';
            const res = await fetch('/api/admin/museums', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(museumData)
            });
            if (res.ok) {
                setIsMuseumModalOpen(false);
                setEditingMuseum(null);
                fetchAdminData();
            } else {
                const err = await res.json();
                showAlert(err.message || (locale === 'ko' ? '미술관 정보를 저장하지 못했어요.' : 'Failed to save museum'));
            }
        } catch (err) {
            console.error('Save museum error:', err);
        }
    };

    const handleDeleteMuseum = (id: string) => {
        showConfirm('이 미술관을 영구적으로 삭제하시겠습니까?', async () => {
            const res = await fetch(`/api/admin/museums?id=${id}`, { method: 'DELETE' });
            if (res.ok) fetchAdminData();
        });
    };

    const handleClearExhibitionCache = async (museumId?: string) => {
        const msg = museumId ? '이 미술관의 전시회 캐시를 비우시겠습니까?' : '모든 전시회 캐시를 비우시겠습니까?';
        showConfirm(msg, async () => {
            const url = museumId ? `/api/admin/exhibitions?museumId=${museumId}` : '/api/admin/exhibitions';
            const res = await fetch(url, { method: 'DELETE' });
            if (res.ok) fetchAdminData();
        });
    };

    const handleUpdateStatus = async (id: string, status: string) => {
        try {
            await fetch(`/api/blog/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            fetchAdminData();
        } catch (err) {
            console.error('Failed to update status:', err);
        }
    };

    const handleDeletePost = (id: string) => {
        showConfirm('이 게시물을 영구적으로 삭제하시겠습니까?', async () => {
            await fetch(`/api/blog/${id}`, { method: 'DELETE' });
            fetchAdminData();
        });
    };

    const handleSendNotification = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/admin/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(notifForm)
            });
            if (res.ok) {
                showAlert('알림을 전송했어요.');
                setNotifForm({ title: '', message: '', link: '', targetUserId: '', marketingOnly: false });
            } else {
                const err = await res.json();
                showAlert(err.error || (locale === 'ko' ? '알림 전송 실패' : 'Failed to send notification'));
            }
        } catch (err) {
            console.error('Send notification error:', err);
        }
        setLoading(false);
    };

    const handleDeleteUser = async (userId: string, userEmail?: string) => {
        const isProtected = userEmail === 'nyoungho.kim@gmail.com';
        if (isProtected) {
            const superPw = prompt('이 계정을 삭제하려면 Super Admin 비밀번호를 입력하세요:');
            if (!superPw) return;
            const adminPw = sessionStorage.getItem('admin-pw') || password;
            const res = await fetch(`/api/users?id=${userId}`, {
                method: 'DELETE',
                headers: { 'x-admin-password': adminPw, 'x-super-password': superPw }
            });
            const data = await res.json();
            if (!res.ok) {
                showAlert(data.message || '삭제 실패');
                return;
            }
        } else {
            showConfirm(`이 사용자를 탈퇴 처리하시겠습니까? (${userEmail || userId})`, async () => {
                const adminPw = sessionStorage.getItem('admin-pw') || password;
                const res = await fetch(`/api/users?id=${userId}`, {
                    method: 'DELETE',
                    headers: { 'x-admin-password': adminPw }
                });
                if (!res.ok) {
                    const data = await res.json();
                    showAlert(data.message || '삭제 실패');
                    return;
                }
                fetchAdminData();
            });
            return;
        }
        fetchAdminData();
    };

    if (authStatus === 'loading' && !authenticated) {
        return (
            <div className="admin-auth-overlay">
                <div className="admin-auth-card">
                    <LoadingAnimation size={96} />
                    <p className="mt-4 text-sm font-black text-gray-500 dark:text-slate-300">관리자 권한을 확인하는 중입니다...</p>
                </div>
            </div>
        );
    }

    if (!authenticated) {
        return (
            <div className="admin-auth-overlay">
                <div className="admin-auth-card">
                    <button
                        onClick={() => router.push('/')}
                        className="admin-auth-close"
                        aria-label="닫기"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <div className="admin-auth-kicker">MM ADMIN</div>
                    <h2 className="text-2xl font-black mb-2 text-slate-950 dark:text-white">관리자 인증</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-300 mb-6 leading-relaxed">관리자 Google 계정으로 로그인하거나 비밀번호로 진입해 주세요.</p>
                    {authStatus === 'unauthenticated' && (
                        <button
                            type="button"
                            onClick={() => signIn('google', { callbackUrl: '/admin' })}
                            className="mb-3 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95"
                        >
                            Google로 관리자 로그인
                        </button>
                    )}
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        placeholder="비밀번호"
                        className="admin-input mb-3"
                        autoFocus
                    />
                    {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
                    <button
                        onClick={handleLogin}
                        className="w-full rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-blue-700 shadow-sm transition-all hover:bg-blue-50 active:scale-95 dark:border-blue-500/20 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-500/10"
                    >
                        비밀번호로 입장
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-shell">
            <div className="admin-page-header">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                        <h1 className="text-2xl sm:text-4xl font-black dark:text-white tracking-tight uppercase">관리자 센터</h1>
                        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full border border-green-100 dark:border-green-800/30">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black text-green-700 dark:text-green-400 uppercase tracking-widest whitespace-nowrap">관리자</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => router.replace('/profile')}
                            className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/90 px-4 py-2 text-xs font-black text-blue-700 shadow-sm transition-all hover:bg-blue-50 active:scale-95 dark:border-blue-500/20 dark:bg-slate-900/80 dark:text-blue-300 dark:hover:bg-blue-500/10"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.1}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                            마이페이지
                        </button>
                    </div>
                    <div className="admin-tabs" role="tablist" aria-label="관리자 메뉴">
                        {ADMIN_TABS.map((item) => (
                            <button
                                key={item.id}
                                role="tab"
                                type="button"
                                aria-selected={tab === item.id}
                                aria-current={tab === item.id ? 'page' : undefined}
                                onClick={() => setTab(item.id)}
                                className={`admin-tab-button ${tab === item.id ? 'admin-tab-button--active' : ''}`}
                            >
                                <span className="hidden sm:inline">{item.label}</span>
                                <span className="sm:hidden">{item.shortLabel}</span>
                                {item.id === 'artworks' && artworkTotal > 0 && (
                                    <span className="admin-tab-badge">{artworkTotal}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 min-h-[400px]">
                    <LoadingAnimation size={120} />
                    <p className="mt-4 text-sm font-medium text-gray-500 dark:text-neutral-400">
                        데이터를 불러오는 중입니다...
                    </p>
                </div>
            ) : tab === 'dashboard' ? (
                <div className="animate-fadeIn">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-4">
                        <div onClick={() => setTab('users')} className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all active:scale-[0.98]">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">가입 사용자</h3>
                            <div className="text-3xl font-black dark:text-white">{dashboardData?.stats?.users || 0}</div>
                        </div>
                        <div onClick={() => setTab('blog')} className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all active:scale-[0.98]">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">작성된 스토리</h3>
                            <div className="text-3xl font-black dark:text-white">{dashboardData?.stats?.stories || 0}</div>
                        </div>
                        <div onClick={() => setTab('museums')} className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all active:scale-[0.98]">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">등록된 미술관/박물관</h3>
                            <div className="text-3xl font-black dark:text-white">{dashboardData?.stats?.museums || 0}</div>
                        </div>
                    </div>

                    {/* AI Usage Summary */}
                    <div className="mt-6 mb-10">
                        <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                            AI · API 사용 현황
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                            <div onClick={() => setTab('ai')} className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all active:scale-[0.98]">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                                    </div>
                                    <span className="text-[9px] font-black text-gray-400 uppercase">Gemini AI</span>
                                </div>
                                <div className="text-lg font-black text-blue-600 dark:text-blue-400">{aiUsage?.month?.requests?.toLocaleString() || 0}</div>
                                <div className="text-[9px] font-bold text-gray-400">30일 호출 · {aiUsage?.costEstimate?.monthKRW ? `₩${aiUsage.costEstimate.monthKRW.toLocaleString()}` : '₩0'}</div>
                            </div>
                            <div onClick={() => setTab('ai')} className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all active:scale-[0.98]">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                                    </div>
                                    <span className="text-[9px] font-black text-gray-400 uppercase">오늘 토큰</span>
                                </div>
                                <div className="text-lg font-black text-blue-600 dark:text-blue-400">{aiUsage?.today?.tokens?.toLocaleString() || 0}</div>
                                <div className="text-[9px] font-bold text-gray-400">{aiUsage?.today?.requests || 0}건 호출</div>
                            </div>
                            <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                                    </div>
                                    <span className="text-[9px] font-black text-gray-400 uppercase">Maps · Places</span>
                                </div>
                                <div className="text-lg font-black text-green-600 dark:text-green-400">
                                    {billingData?.summary?.totalCalls?.toLocaleString() || '—'}<span className="text-[10px] text-gray-400 ml-1">회/30일</span>
                                </div>
                                <div className="text-[9px] font-bold text-gray-400">
                                    청구 예상: ${billingData?.summary?.totalEstimatedCostUSD?.toFixed(2) || '0.00'}
                                </div>
                            </div>
                        </div>
                        <div className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-neutral-800 dark:to-neutral-900 rounded-2xl px-5 py-3.5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div>
                                    <p className="text-[9px] font-bold text-white/40 uppercase">30일 AI 호출</p>
                                    <p className="text-sm font-black text-green-400">{(aiUsage?.month?.requests || 0).toLocaleString()}</p>
                                </div>
                                <div className="w-px h-8 bg-white/10" />
                                <div>
                                    <p className="text-[9px] font-bold text-white/40 uppercase">AI 추정 비용</p>
                                    <p className="text-sm font-black text-red-400">
                                        {aiUsage?.costEstimate?.monthKRW
                                            ? `₩${aiUsage.costEstimate.monthKRW.toLocaleString()}`
                                            : '₩0'}
                                    </p>
                                    <p className="text-[8px] font-bold text-red-400/50">
                                        ≈ ${aiUsage?.costEstimate?.monthUSD || 0} (토큰 기반)
                                    </p>
                                </div>
                                <div className="w-px h-8 bg-white/10" />
                                <div>
                                    <p className="text-[9px] font-bold text-white/40 uppercase">총 토큰</p>
                                    <p className="text-sm font-black text-white">{(aiUsage?.month?.tokens || 0).toLocaleString()}</p>
                                </div>
                                <div className="w-px h-8 bg-white/10" />
                                <div>
                                    <p className="text-[9px] font-bold text-white/40 uppercase">Maps 월 무료</p>
                                    <p className="text-sm font-black text-white">$200/월</p>
                                </div>
                            </div>
                            <button onClick={() => setTab('ai')} className="text-[9px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-colors">
                                상세 보기 →
                            </button>
                        </div>
                    </div>

                    {/* GA4 & AI Key Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
                        <div onClick={() => setTab('analytics')} className="admin-metric-card admin-metric-card-green p-5 cursor-pointer hover:scale-[1.02] transition-all active:scale-[0.98]">
                            <h3 className="text-[10px] font-black uppercase tracking-widest">실시간 사용자</h3>
                            <div className="admin-metric-value text-2xl font-black mt-1">{gaData?.realtime ?? '-'}</div>
                            <p className="text-[9px] font-bold mt-0.5">Google Analytics</p>
                        </div>
                        <div onClick={() => setTab('analytics')} className="admin-metric-card admin-metric-card-blue p-5 cursor-pointer hover:scale-[1.02] transition-all active:scale-[0.98]">
                            <h3 className="text-[10px] font-black uppercase tracking-widest">30일 페이지뷰</h3>
                            <div className="admin-metric-value text-2xl font-black mt-1">{gaData?.totals30d?.pageViews?.toLocaleString() ?? '-'}</div>
                            <p className="text-[9px] font-bold mt-0.5">Google Analytics</p>
                        </div>
                        <div onClick={() => setTab('ai')} className="admin-metric-card admin-metric-card-blue p-5 cursor-pointer hover:scale-[1.02] transition-all active:scale-[0.98]">
                            <h3 className="text-[10px] font-black uppercase tracking-widest">오늘 AI 호출</h3>
                            <div className="admin-metric-value text-2xl font-black mt-1">{aiUsage?.today?.requests ?? '-'}</div>
                            <p className="text-[9px] font-bold mt-0.5">Gemini API</p>
                        </div>
                        <div onClick={() => setTab('ai')} className="admin-metric-card admin-metric-card-orange p-5 cursor-pointer hover:scale-[1.02] transition-all active:scale-[0.98]">
                            <h3 className="text-[10px] font-black uppercase tracking-widest">이번 달 AI</h3>
                            <div className="admin-metric-value text-2xl font-black mt-1">{aiUsage?.month?.requests ?? '-'}</div>
                            <p className="text-[9px] font-bold mt-0.5">Gemini API</p>
                        </div>
                    </div>

                    {/* Demographics: Gender & Age */}
                    {(gaData?.gender?.length > 0 || gaData?.ageBrackets?.length > 0) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
                            {gaData?.gender?.length > 0 && (
                                <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm">
                                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-pink-500 rounded-full" />
                                        성별 (30일)
                                    </h3>
                                    <div className="space-y-2">
                                        {gaData.gender.map((g: any) => {
                                            const totalG = gaData.gender.reduce((s: number, x: any) => s + x.users, 0);
                                            const pct = totalG > 0 ? Math.round((g.users / totalG) * 100) : 0;
                                            const GL: Record<string, string> = { male: '남성', female: '여성', unknown: '미확인' };
                                            const GC: Record<string, string> = { male: 'bg-blue-500', female: 'bg-pink-500', unknown: 'bg-gray-400' };
                                            return (
                                                <div key={g.gender}>
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span className="font-bold dark:text-white">{GL[g.gender] || g.gender}</span>
                                                        <span className="font-bold text-gray-500">{pct}% ({g.users}명)</span>
                                                    </div>
                                                    <div className="h-2 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                                        <div className={`h-full ${GC[g.gender] || 'bg-gray-400'} rounded-full`} style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {gaData?.ageBrackets?.length > 0 && (
                                <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm">
                                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                                        연령대 (30일)
                                    </h3>
                                    <div className="space-y-2">
                                        {gaData.ageBrackets.map((a: any) => {
                                            const totalA = gaData.ageBrackets.reduce((s: number, x: any) => s + x.users, 0);
                                            const pct = totalA > 0 ? Math.round((a.users / totalA) * 100) : 0;
                                            return (
                                                <div key={a.age}>
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span className="font-bold dark:text-white">{a.age}</span>
                                                        <span className="font-bold text-gray-500">{pct}% ({a.users}명)</span>
                                                    </div>
                                                    <div className="h-2 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
                        <div>
                            <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
                                인기 스토리 TOP 5
                            </h2>
                            <div className="space-y-4">
                                {dashboardData?.popularStories?.map((s: any) => (
                                    <div key={s.id} className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-gray-100 dark:border-neutral-800 flex justify-between items-center shadow-sm">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <h4 className="font-black text-sm dark:text-white truncate">{s.title}</h4>
                                            <p className="text-[10px] text-gray-400 font-bold mt-1">{s.author || '관리자'}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-black text-blue-600 dark:text-blue-400">{s.views} views</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                                최근 피드백
                                {dashboardData?.recentFeedback?.length > 0 && (
                                    <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-lg text-[10px]">
                                        총 {dashboardData?.stats?.feedbacks || dashboardData?.recentFeedback?.length || 0}건
                                    </span>
                                )}
                            </h2>
                            {dashboardData?.recentFeedback?.slice(0, 1).map((f: any) => (
                                <div key={f.id} className="bg-indigo-50/30 dark:bg-indigo-900/10 p-5 rounded-2xl border border-indigo-50 dark:border-indigo-900/20">
                                    <p className="text-sm text-gray-700 dark:text-neutral-300 font-medium line-clamp-2 mb-2 italic">"{f.content}"</p>
                                    <div className="flex justify-between items-center text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                                        <span>{f.user?.name || f.user?.email || f.userId?.slice(0, 8) || '비회원'}</span>
                                        <span>{new Date(f.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    {f.reply && (
                                        <div className="bg-white dark:bg-neutral-800 rounded-2xl p-3 mt-3 border border-indigo-100 dark:border-neutral-700">
                                            <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">관리자 답변</p>
                                            <p className="text-xs text-gray-600 dark:text-neutral-400">{f.reply}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {(!dashboardData?.recentFeedback || dashboardData.recentFeedback.length === 0) && (
                                <p className="text-sm text-gray-400 dark:text-neutral-600">아직 접수된 피드백이 없어요.</p>
                            )}
                            <button
                                onClick={() => setTab('users')}
                                className="mt-4 text-xs font-bold text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                            >
                                사용자 & 피드백 탭에서 전체 보기 →
                            </button>
                        </div>
                    </div>
                    <div className="h-12" />
                </div>
            ) : tab === 'users' ? (
                <div className="animate-fadeIn">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                        <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm">
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">가입 사용자</div>
                            <div className="text-2xl font-black dark:text-white">{users.length}</div>
                        </div>
                        <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm">
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">피드백</div>
                            <div className="text-2xl font-black text-indigo-500">{feedbacks.length}</div>
                        </div>
                        <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm">
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">대시보드 사용자 수</div>
                            <div className="text-2xl font-black text-blue-600">{dashboardData?.stats?.users || '-'}</div>
                        </div>
                    </div>

                    <div className="overflow-x-auto mb-16 border border-gray-100 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900 shadow-sm">
                        <table className="w-full min-w-[700px] text-left text-sm text-gray-500 dark:text-gray-400">
                            <thead className="text-[10px] text-gray-400 uppercase bg-gray-50 dark:bg-neutral-800/50 dark:text-neutral-500 font-black tracking-widest">
                                <tr>
                                    <th scope="col" className="px-6 py-4">사용자</th>
                                    <th scope="col" className="px-6 py-4">가입 유형</th>
                                    <th scope="col" className="px-6 py-4">약관 동의</th>
                                    <th scope="col" className="px-6 py-4">로케일</th>
                                    <th scope="col" className="px-6 py-4">성별</th>
                                    <th scope="col" className="px-6 py-4">연령대</th>
                                    <th scope="col" className="px-6 py-4">마지막 접속</th>
                                    <th scope="col" className="px-6 py-4">가입일</th>
                                    <th scope="col" className="px-6 py-4">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                                {users.map((u) => (
                                    <tr key={u.id} className="bg-white hover:bg-gray-50/50 dark:bg-neutral-900 dark:hover:bg-neutral-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">{u.name || '—'}</p>
                                                {u.email && <p className="text-[10px] text-gray-400 dark:text-neutral-500">{u.email}</p>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {(() => {
                                                const provider = u.authProvider || 'unknown';
                                                const hasConsent = !!u.termsAgreedAt;
                                                const isAdminEmail = u.email === 'nyoungho.kim@gmail.com';
                                                const config: Record<string, { label: string; bg: string; text: string }> = {
                                                    admin: { label: 'Admin', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400' },
                                                    'google-signup': { label: 'Google 가입', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400' },
                                                    'google-login': { label: 'Google 로그인', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400' },
                                                    credentials: { label: 'Credentials', bg: 'bg-gray-50 dark:bg-gray-900/20', text: 'text-gray-700 dark:text-gray-400' },
                                                    legacy: { label: 'Legacy', bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-400' },
                                                    unknown: { label: 'Unknown', bg: 'bg-gray-50 dark:bg-gray-900/20', text: 'text-gray-400 dark:text-neutral-500' },
                                                };
                                                const key = isAdminEmail ? 'admin' : provider === 'google' ? (hasConsent ? 'google-signup' : 'google-login') : (provider || 'unknown');
                                                const c = config[key] || config.unknown;
                                                return <span className={`px-2 py-0.5 rounded-lg ${c.bg} ${c.text} text-[10px] font-black uppercase`}>{c.label}</span>;
                                            })()}
                                        </td>
                                        <td className="px-6 py-4">
                                            {u.termsAgreedAt ? (
                                                <div className="flex flex-col items-start gap-0.5">
                                                    <span className="text-emerald-500 text-sm">✅</span>
                                                    <span className="text-[9px] text-gray-400 dark:text-neutral-500">{new Date(u.termsAgreedAt).toLocaleDateString('ko-KR')}</span>
                                                </div>
                                            ) : (
                                                <span className="text-red-400 text-sm">❌</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-xs">
                                            {u.preferences && typeof u.preferences === 'object' && (u.preferences as any).locale
                                                ? <span className="px-2 py-0.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-[10px] font-black uppercase">{(u.preferences as any).locale}</span>
                                                : <span className="text-gray-300 dark:text-neutral-600">—</span>}
                                        </td>
                                        <td className="px-6 py-4 text-xs">
                                            {u.gender
                                                ? <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-[10px] font-bold">{u.gender}</span>
                                                : <span className="text-gray-300 dark:text-neutral-600">—</span>}
                                        </td>
                                        <td className="px-6 py-4 text-xs">
                                            {u.ageRange
                                                ? <span className="px-2 py-0.5 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 text-[10px] font-bold">{u.ageRange}</span>
                                                : <span className="text-gray-300 dark:text-neutral-600">—</span>}
                                        </td>
                                        <td className="px-6 py-4 text-[11px] font-bold text-gray-400">
                                            {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('ko-KR') : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-[11px] font-bold text-gray-400">
                                            {new Date(u.createdAt).toLocaleDateString('ko-KR')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleDeleteUser(u.id, u.email)}
                                                className="px-3 py-1.5 bg-red-50 dark:bg-red-900/10 text-red-500 dark:text-red-400 rounded-lg text-[10px] font-black hover:bg-red-100 dark:hover:bg-red-900/20 active:scale-95 transition-all uppercase tracking-wider"
                                            >
                                                탈퇴
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mb-6 text-sm font-black text-gray-400 dark:text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                        {feedbacks.length}개의 사용자 피드백 접수
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {feedbacks.map((f: any) => (
                            <div key={f.id} className="border border-indigo-50 dark:border-indigo-900/20 rounded-2xl p-6 bg-white dark:bg-neutral-900 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                                            사용자: {f.user?.name || f.user?.email || (f.userId ? f.userId.slice(0, 8) : '비회원')}
                                        </span>
                                        {f.type === 'report' && (
                                            <span className="text-[9px] font-black bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full uppercase">
                                                🚨 정보수정
                                            </span>
                                        )}
                                        {f.type === 'cheer' && (
                                            <span className="text-[9px] font-black bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200 px-2 py-0.5 rounded-full uppercase">
                                                응원 메시지
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-300 dark:text-neutral-600">
                                        {new Date(f.createdAt).toLocaleDateString('ko-KR')}
                                    </span>
                                </div>
                                {f.targetName && (
                                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 px-3 py-1.5 rounded-lg">
                                        <MapPinIcon className="w-3.5 h-3.5 inline" /> {f.targetName} ({f.category === 'museum_info' ? '박물관' : '스토리'})
                                    </p>
                                )}
                                <p className="text-sm text-gray-700 dark:text-neutral-300 leading-relaxed font-medium">{f.content}</p>

                                {/* Reply Section */}
                                {f.reply && !replyingId?.startsWith(f.id) ? (
                                    <div className="bg-blue-50 dark:bg-blue-900/10 rounded-2xl p-4 border border-blue-100 dark:border-blue-800/20">
                                        <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">관리자 답변</p>
                                        <p className="text-xs text-gray-600 dark:text-neutral-400 leading-relaxed">{f.reply}</p>
                                        <button
                                            onClick={() => { setReplyingId(f.id); setReplyText(f.reply || ''); }}
                                            className="mt-2 text-[10px] font-bold text-blue-500 hover:text-blue-700 transition-colors"
                                        >수정하기</button>
                                    </div>
                                ) : replyingId === f.id ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            placeholder="답변을 입력하세요..."
                                            className="w-full bg-gray-50 dark:bg-neutral-800 border-none rounded-2xl px-4 py-3 text-xs focus:ring-2 focus:ring-blue-500 outline-none dark:text-white min-h-[80px] leading-relaxed"
                                            autoFocus
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const adminPw = sessionStorage.getItem('admin-pw') || '';
                                                        await fetch('/api/feedback', {
                                                            method: 'PATCH',
                                                            headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPw },
                                                            body: JSON.stringify({ id: f.id, reply: replyText })
                                                        });
                                                        f.reply = replyText;
                                                        setReplyingId(null);
                                                        setReplyText('');
                                                    } catch (err) { console.error(err); }
                                                }}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[11px] font-black hover:bg-blue-700 active:scale-95 transition-all"
                                            >저장</button>
                                            <button
                                                onClick={() => { setReplyingId(null); setReplyText(''); }}
                                                className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 text-gray-500 rounded-xl text-[11px] font-bold hover:bg-gray-200 dark:hover:bg-neutral-700 active:scale-95 transition-all"
                                            >취소</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setReplyingId(f.id); setReplyText(''); }}
                                            className="self-start px-4 py-2 bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 rounded-xl text-[11px] font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/20 active:scale-95 transition-all"
                                        ><ChatIcon className="w-3.5 h-3.5 inline mr-1" />답변 작성</button>
                                        <button
                                            onClick={() => {
                                                showConfirm('이 피드백을 삭제하시겠습니까?', async () => {
                                                    const adminPw = sessionStorage.getItem('admin-pw') || '';
                                                    await fetch(`/api/feedback?id=${f.id}`, {
                                                        method: 'DELETE',
                                                        headers: { 'x-admin-password': adminPw }
                                                    });
                                                    fetchAdminData();
                                                });
                                            }}
                                            className="self-start px-4 py-2 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-xl text-[11px] font-bold hover:bg-red-100 dark:hover:bg-red-900/20 active:scale-95 transition-all"
                                        ><TrashIcon className="w-3.5 h-3.5 inline mr-1" />삭제</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ) : tab === 'blog' ? (
                <div className="animate-fadeIn">
                    <div className="flex justify-between items-center mb-8">
                        <div className="text-sm font-black text-gray-400 dark:text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                            총 {posts.length}개의 스토리 목록
                        </div>
                        <div className="flex items-center gap-4">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="bg-gray-50 dark:bg-neutral-800 border-none rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            >
                                <option value="views">조회수순</option>
                                <option value="date">최신순</option>
                            </select>
                            <button onClick={() => router.push('/blog/new')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl text-xs font-black shadow-xl shadow-blue-600/20 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest">스토리 작성</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {[...posts].sort((a, b) => {
                            if (sortBy === 'views') return b.views - a.views;
                            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                        }).map((post) => {
                            const catConfig: Record<string, { emoji: string; label: string; bg: string; text: string }> = {
                                MUSEUM: { emoji: '📍', label: '뮤지엄', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400' },
                                TRAVEL: { emoji: '✈️', label: '여행', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400' },
                                ART: { emoji: '🎨', label: '아트', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400' },
                                SPECIAL: { emoji: '✨', label: '특이', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400' },
                            };
                            const cc = catConfig[post.category || 'MUSEUM'] || catConfig.MUSEUM;
                            return (
                            <div key={post.id} className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-2xl p-6 flex justify-between items-center shadow-sm hover:shadow-md transition-all">
                                <div className="flex-1 pr-4">
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${post.status === 'PUBLISHED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                                            {post.status === 'PUBLISHED' ? '발행됨' : '초안'}
                                        </span>
                                        <select
                                            value={post.category || 'MUSEUM'}
                                            onChange={async (e) => {
                                                const newCat = e.target.value;
                                                try {
                                                    await fetch(`/api/blog/${post.id}`, {
                                                        method: 'PUT',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ category: newCat })
                                                    });
                                                    post.category = newCat;
                                                    setPosts([...posts]);
                                                } catch {}
                                            }}
                                            className={`text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-widest border-none outline-none cursor-pointer ${cc.bg} ${cc.text}`}
                                        >
                                            <option value="MUSEUM">📍 뮤지엄</option>
                                            <option value="TRAVEL">✈️ 여행</option>
                                            <option value="ART">🎨 아트</option>
                                            <option value="SPECIAL">✨ 특이</option>
                                        </select>
                                        <span className="text-[10px] font-bold text-gray-300 dark:text-neutral-600 font-mono">{new Date(post.createdAt).toLocaleDateString('ko-KR')}</span>
                                        <span className="px-2 py-0.5 rounded-lg bg-gray-50 dark:bg-neutral-800 text-[10px] font-black text-blue-600 uppercase tracking-tight">{post.views} views</span>
                                    </div>
                                    <h3 className="font-black text-lg dark:text-white leading-tight">{post.title}</h3>
                                    <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest">작성자: {post.author || '관리자'}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => router.push(`/blog/edit/${post.id}`)} className="px-5 py-2.5 bg-gray-50 dark:bg-neutral-800 rounded-xl text-[11px] font-black text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors uppercase tracking-widest">수정</button>
                                    <button onClick={() => handleDeletePost(post.id)} className="px-5 py-2.5 bg-red-50 dark:bg-red-900/10 rounded-xl text-[11px] font-black text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors uppercase tracking-widest">삭제</button>
                                </div>
                            </div>
                        )})}
                    </div>
                </div>
            ) : tab === 'museums' ? (
                <div className="animate-fadeIn">
                    <div className="mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <form onSubmit={handleMuseumSearch} className="relative w-full sm:max-w-md">
                            <input
                                type="text"
                                value={museumQuery}
                                onChange={(e) => setMuseumQuery(e.target.value)}
                                placeholder="미술관명, 도시 또는 국가로 검색..."
                                className="w-full bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white shadow-sm"
                            />
                            <button type="submit" aria-label="미술관 검색" className="absolute right-4 top-4 text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </button>
                        </form>
                        <button
                            onClick={() => {
                                setEditingMuseum(null);
                                setIsMuseumModalOpen(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl text-sm font-black shadow-xl shadow-blue-600/20 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
                        >
                            미술관/박물관 추가
                        </button>
                    </div>

                    <div className="text-sm font-black text-gray-400 dark:text-neutral-500 uppercase tracking-widest flex items-center gap-2 mb-6">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                        총 {museumTotal}개의 미술관/박물관
                    </div>

                    <div className="overflow-x-auto border border-gray-100 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900 shadow-sm mb-10">
                        <table className="w-full min-w-[800px] text-left text-sm text-gray-500 dark:text-gray-400">
                            <thead className="text-[10px] text-gray-400 uppercase bg-gray-50 dark:bg-neutral-800/50 dark:text-neutral-500 font-black tracking-widest">
                                <tr>
                                    <th scope="col" className="px-8 py-5 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors select-none" onClick={() => toggleSort('name')}>미술관/박물관명{sortArrow('name')}</th>
                                    <th scope="col" className="px-8 py-5 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors select-none" onClick={() => toggleSort('city')}>위치{sortArrow('city')}</th>
                                    <th scope="col" className="px-8 py-5 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors select-none" onClick={() => toggleSort('type')}>유형{sortArrow('type')}</th>
                                    <th scope="col" className="px-8 py-5 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors select-none" onClick={() => toggleSort('popularity')}>인기상태{sortArrow('popularity')}</th>
                                    <th scope="col" className="px-8 py-5">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                                {sortedMuseums.map((m) => (
                                    <tr key={m.id} className="hover:bg-gray-50/50 dark:hover:bg-neutral-800/50 transition-colors">
                                        <td className="px-8 py-5">
                                            <div className="font-black text-gray-900 dark:text-white">{m.nameKo || m.name}</div>
                                            {m.nameKo && m.name && <div className="text-[10px] text-gray-400 mt-0.5">{m.name}</div>}
                                        </td>
                                        <td className="px-8 py-5 text-[11px] font-bold text-gray-400">{m.cityKo || m.city}, {(() => { try { return new Intl.DisplayNames(['ko'], { type: 'region' }).of(m.country); } catch { return m.country; } })()}</td>
                                        <td className="px-8 py-5 text-[10px] tracking-widest uppercase font-black text-blue-600 dark:text-blue-400">{({ MUSEUM: '박물관', GALLERY: '미술관', SCIENCE_CENTER: '과학관', HISTORIC_SITE: '유적지', OTHER: '기타' } as any)[m.type] || m.type}</td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-yellow-400" style={{ width: `${Math.min(m.popularityScore * 20, 100)}%` }} />
                                                </div>
                                                <span className="text-[10px] font-black">{m.popularityScore.toFixed(1)}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => {
                                                        setEditingMuseum(m);
                                                        setIsMuseumModalOpen(true);
                                                    }}
                                                    className="p-1.5 text-gray-300 hover:text-black dark:hover:text-white transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                                <button onClick={() => handleDeleteMuseum(m.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors" aria-label="미술관 삭제">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-center items-center gap-6 mb-12">
                        <button
                            disabled={museumPage === 1}
                            onClick={() => setMuseumPage(p => p - 1)}
                            className="px-6 py-3 border border-gray-100 dark:border-neutral-800 rounded-2xl text-[11px] font-black text-gray-400 uppercase tracking-widest disabled:opacity-20 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all shadow-sm"
                        >
                            이전
                        </button>
                        <div className="text-[11px] font-black dark:text-neutral-500 uppercase tracking-widest">
                            페이지 {museumPage} / {Math.max(1, Math.ceil(museumTotal / 20))}
                        </div>
                        <button
                            disabled={museumPage >= Math.ceil(museumTotal / 20)}
                            onClick={() => setMuseumPage(p => p + 1)}
                            className="px-6 py-3 border border-gray-100 dark:border-neutral-800 rounded-2xl text-[11px] font-black text-gray-400 uppercase tracking-widest disabled:opacity-20 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all shadow-sm"
                        >
                            다음
                        </button>
                    </div>
                </div>
            ) : tab === 'ai' ? (
                <div className="animate-fadeIn">
                    <div className="mb-8">
                        <h2 className="text-xl font-black dark:text-white uppercase tracking-tight">AI 토큰 사용 현황</h2>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Gemini API 호출 및 토큰 소모량을 실시간으로 모니터링합니다.</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                        {[{ label: '오늘', d: aiUsage?.today }, { label: '이번 주', d: aiUsage?.week }, { label: '이번 달', d: aiUsage?.month }, { label: '전체', d: aiUsage?.total }].map(({ label, d }) => (
                            <div key={label} className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</h3>
                                <div className="text-2xl font-black dark:text-white">{d?.requests || 0}</div>
                                <p className="text-[10px] text-blue-500 font-bold mt-1">~{((d?.tokens || 0) / 1000).toFixed(1)}K tokens</p>
                            </div>
                        ))}
                    </div>

                    <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm mb-8">
                        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-2">최근 7일 사용량</h3>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-blue-500 to-blue-400" />
                                <span className="text-[9px] font-bold text-gray-400">요청 수</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-0.5 bg-amber-400 rounded-full" />
                                <span className="text-[9px] font-bold text-gray-400">토큰 (K)</span>
                            </div>
                        </div>
                        {(() => {
                            const days = aiUsage?.dailyBreakdown || [];
                            const maxReq = Math.max(...days.map((x: any) => x.requests || 0), 1);
                            const maxTok = Math.max(...days.map((x: any) => x.tokens || 0), 1);
                            return (
                                <div className="relative">
                                    {/* Bar chart + labels */}
                                    <div className="flex items-end gap-1.5 h-36">
                                        {days.map((d: any, i: number) => {
                                            const barH = Math.max((d.requests / maxReq) * 100, 6);
                                            return (
                                                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group cursor-default">
                                                    <div className="text-center mb-0.5">
                                                        <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 block">{d.requests}</span>
                                                        <span className="text-[8px] font-bold text-amber-500 block">~{((d.tokens || 0) / 1000).toFixed(1)}K</span>
                                                    </div>
                                                    <div className="w-full rounded-t-lg relative overflow-hidden transition-all group-hover:opacity-90" style={{ height: `${barH}%` }}>
                                                        <div className="absolute inset-0 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg opacity-80" />
                                                    </div>
                                                    <span className="text-[8px] font-bold text-gray-300 dark:text-neutral-600 mt-0.5">{d.date.slice(5)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {/* Overlaid SVG line for tokens */}
                                    {days.length > 1 && (
                                        <svg className="absolute top-8 left-0 w-full pointer-events-none" style={{ height: 'calc(100% - 2.5rem)' }} viewBox={`0 0 ${days.length * 100} 100`} preserveAspectRatio="none">
                                            <polyline
                                                fill="none"
                                                stroke="#fbbf24"
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                points={days.map((d: any, i: number) => {
                                                    const x = (i / (days.length - 1)) * (days.length * 100 - 50) + 25;
                                                    const y = 100 - Math.max(((d.tokens || 0) / maxTok) * 85, 5);
                                                    return `${x},${y}`;
                                                }).join(' ')}
                                            />
                                            {days.map((d: any, i: number) => {
                                                const x = (i / (days.length - 1)) * (days.length * 100 - 50) + 25;
                                                const y = 100 - Math.max(((d.tokens || 0) / maxTok) * 85, 5);
                                                return <circle key={i} cx={x} cy={y} r="4" fill="#fbbf24" />;
                                            })}
                                        </svg>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b dark:border-neutral-800">
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">최근 AI 요청 로그</h3>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto">
                            {aiUsage?.recentLogs?.length ? aiUsage.recentLogs.map((l: any) => (
                                <div key={l.id} className="px-6 py-3 border-b dark:border-neutral-800 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-black text-gray-700 dark:text-neutral-300">{l.action}</span>
                                        <span className="text-[9px] font-bold text-gray-300 dark:text-neutral-600">{new Date(l.createdAt).toLocaleString('ko-KR')}</span>
                                    </div>
                                    {l.detail && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{l.detail}</p>}
                                </div>
                            )) : (
                                <div className="px-6 py-10 text-center text-sm text-gray-400">아직 AI 사용 로그가 없어요</div>
                            )}
                        </div>
                    </div>

                    {/* API Cost Summary — Token-based */}
                    <div className="mt-10">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-black dark:text-white uppercase tracking-tight mb-1">API 비용 요약</h2>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">DB 토큰 기록 기반 (30일)</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                        <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-gray-900 dark:text-white">Gemini AI</p>
                                        <p className="text-[9px] font-bold text-gray-400">번역 · 추천 · 요약</p>
                                    </div>
                                </div>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between"><span className="text-gray-400">30일 호출</span><span className="font-bold text-blue-600">{(aiUsage?.month?.requests || 0).toLocaleString()}회</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">30일 토큰</span><span className="font-bold text-blue-600">{(aiUsage?.month?.tokens || 0).toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">추정 비용</span><span className="font-bold text-red-500">{aiUsage?.costEstimate?.monthKRW ? `₩${aiUsage.costEstimate.monthKRW.toLocaleString()} (~$${aiUsage.costEstimate.monthUSD})` : '₩0'}</span></div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                        <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-gray-900 dark:text-white">Google Maps · Places</p>
                                        <p className="text-[9px] font-bold text-gray-400">SKU별 무료 cap (2025.03~)</p>
                                    </div>
                                </div>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between"><span className="text-gray-400">Text Search (30일)</span><span className="font-bold">{billingData?.freeTiers?.textSearch?.used?.toLocaleString() || 0} / {billingData?.freeTiers?.textSearch?.free?.toLocaleString() || '5,000'}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Place Details (30일)</span><span className="font-bold">{billingData?.freeTiers?.placeDetails?.used?.toLocaleString() || 0} / {billingData?.freeTiers?.placeDetails?.free?.toLocaleString() || '10,000'}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Place Photos (30일)</span><span className="font-bold text-orange-500">{billingData?.summary?.skus?.placePhotos?.calls?.toLocaleString() || 0}회 (유료)</span></div>
                                    <div className="border-t border-gray-100 dark:border-neutral-800 pt-2 mt-2 flex justify-between"><span className="text-gray-400 font-bold">30일 청구 예상</span><span className="font-black text-red-500">${billingData?.summary?.totalEstimatedCostUSD?.toFixed(2) || '0.00'}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">누적 전체</span><span className="font-bold text-gray-600 dark:text-gray-300">${billingData?.allTime?.totalCostUSD?.toFixed(2) || '0.00'}</span></div>
                                </div>
                                <a href="https://developers.google.com/maps/billing-and-pricing/pricing" target="_blank" rel="noopener noreferrer"
                                    className="mt-4 w-full block py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-center"
                                >
                                    공식 가격 정책 →
                                </a>
                            </div>
                            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                                        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-gray-900 dark:text-white">결제 계정</p>
                                        <p className="text-[9px] font-bold text-gray-400">{billingData?.billingAccount?.displayName || 'GCP Billing'}</p>
                                    </div>
                                </div>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between"><span className="text-gray-400">상태</span><span className={`font-bold ${billingData?.billingAccount?.open ? 'text-green-600' : 'text-yellow-500'}`}>{billingData?.billingAccount?.open ? '✅ 활성' : '⚠️ 미확인'}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">누적 AI 비용</span><span className="font-bold text-gray-700 dark:text-gray-300">{aiUsage?.costEstimate?.totalKRW ? `₩${aiUsage.costEstimate.totalKRW.toLocaleString()}` : '₩0'}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">데이터 기준</span><span className="font-bold text-gray-500">DB TokenUsage</span></div>
                                </div>
                            </div>
                        </div>

                        {/* Cost Summary Bar */}
                        <div className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-neutral-800 dark:to-neutral-900 rounded-2xl p-6 text-white">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[10px] font-black uppercase tracking-widest opacity-60">30일 AI 비용 요약</h3>
                                <span className="text-[9px] font-bold opacity-40">환율 기준: $1 ≈ ₩1,450 · Gemini 2.0 Flash 기준</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-[10px] font-bold opacity-50">30일 AI 호출</p>
                                    <p className="text-lg font-black text-blue-400">{(aiUsage?.month?.requests || 0).toLocaleString()}</p>
                                    <p className="text-[9px] font-bold opacity-40">Gemini API</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold opacity-50">30일 토큰 사용</p>
                                    <p className="text-lg font-black text-cyan-400">{(aiUsage?.month?.tokens || 0).toLocaleString()}</p>
                                    <p className="text-[9px] font-bold opacity-40">prompt + completion</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold opacity-50">30일 추정 비용</p>
                                    <p className="text-lg font-black text-red-400">
                                        {aiUsage?.costEstimate?.monthKRW
                                            ? `₩${aiUsage.costEstimate.monthKRW.toLocaleString()}`
                                            : '₩0'}
                                    </p>
                                    <p className="text-[9px] font-bold text-red-400/60">≈ ${aiUsage?.costEstimate?.monthUSD || 0}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold opacity-50">Maps 월 무료</p>
                                    <p className="text-lg font-black">$200/월</p>
                                    <p className="text-[9px] font-bold opacity-40">Google Maps Platform</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : tab === 'notifications' ? (
                <div className="animate-fadeIn">
                    <div className="max-w-2xl mx-auto">
                        <div className="mb-8">
                            <h2 className="text-xl font-black dark:text-white uppercase tracking-tight">알림 전송</h2>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">모든 사용자 또는 특정 사용자에게 알림을 보냅니다.</p>
                        </div>

                        <form onSubmit={handleSendNotification} className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-2xl p-8 shadow-sm space-y-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">알림 제목</label>
                                <input
                                    required
                                    value={notifForm.title}
                                    onChange={e => setNotifForm({ ...notifForm, title: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-neutral-800 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white font-bold"
                                    placeholder="새로운 전시 소식이 있습니다!"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">내용</label>
                                <textarea
                                    required
                                    value={notifForm.message}
                                    onChange={e => setNotifForm({ ...notifForm, message: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-neutral-800 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white min-h-[120px] leading-relaxed"
                                    placeholder="전시회 내용을 입력하세요..."
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">연결 링크 (선택사항)</label>
                                <input
                                    value={notifForm.link}
                                    onChange={e => setNotifForm({ ...notifForm, link: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-neutral-800 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white font-mono"
                                    placeholder="/blog/1230"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">대상 사용자 ID (비워두면 전체 전송)</label>
                                <input
                                    value={notifForm.targetUserId}
                                    onChange={e => setNotifForm({ ...notifForm, targetUserId: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-neutral-800 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white font-mono"
                                    placeholder="user-cuid-..."
                                />
                            </div>

                            <div className="flex items-center justify-between bg-gray-50 dark:bg-neutral-800 rounded-2xl px-5 py-4">
                                <div>
                                    <p className="text-xs font-bold text-gray-700 dark:text-gray-200">마케팅 동의자만</p>
                                    <p className="text-[9px] text-gray-400 mt-0.5">마케팅 수신 동의한 사용자에게만 전송</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setNotifForm({ ...notifForm, marketingOnly: !notifForm.marketingOnly })}
                                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${notifForm.marketingOnly ? 'bg-blue-600' : 'bg-gray-300 dark:bg-neutral-600'}`}
                                >
                                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${notifForm.marketingOnly ? 'translate-x-5' : ''}`} />
                                </button>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-600/20 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest"
                            >
                                알림 보내기
                            </button>
                        </form>
                    </div>
                </div>
            ) : tab === 'analytics' ? (
                <div className="animate-fadeIn">
                    <div className="mb-8">
                        <h2 className="text-xl font-black dark:text-white uppercase tracking-tight">Google Analytics</h2>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">GA4 실시간 트래픽 및 사용자 분석</p>
                    </div>
                    {gaLoading ? (
                        <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
                    ) : !gaData ? (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 rounded-2xl p-6">
                            <p className="text-sm font-bold text-yellow-800 dark:text-yellow-300">GA4 환경변수 설정 필요</p>
                            <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">Vercel에 <code className="bg-yellow-100 dark:bg-yellow-800/30 px-1 rounded">GA4_PROPERTY_ID</code>와 <code className="bg-yellow-100 dark:bg-yellow-800/30 px-1 rounded">GOOGLE_SERVICE_ACCOUNT_JSON</code>을 환경변수로 설정해주세요.</p>
                        </div>
                    ) : (
                        <div>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
                                <div className="admin-metric-card admin-metric-card-green p-5">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest">실시간</h3>
                                    <div className="admin-metric-value text-3xl font-black mt-1">{gaData.realtime || 0}</div>
                                    <p className="text-[10px] font-bold mt-1">활성 사용자</p>
                                </div>
                                {gaData.totals30d && [{ l: '30일 사용자', v: gaData.totals30d.users }, { l: '30일 세션', v: gaData.totals30d.sessions }, { l: '30일 페이지뷰', v: gaData.totals30d.pageViews }, { l: '이탈률', v: (gaData.totals30d.bounceRate * 100).toFixed(1) + '%' }, { l: '평균 세션', v: Math.floor(gaData.totals30d.avgSessionDuration / 60) + '분 ' + Math.floor(gaData.totals30d.avgSessionDuration % 60) + '초' }, { l: '신규 사용자', v: gaData.totals30d.newUsers }].map(({ l, v }) => (
                                    <div key={l} className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm">
                                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{l}</h3>
                                        <div className="text-2xl font-black dark:text-white mt-1">{typeof v === 'number' ? v.toLocaleString() : v}</div>
                                    </div>
                                ))}
                            </div>
                            {gaData.daily?.length > 0 && (() => {
                                const maxPv = Math.max(...gaData.daily.map((x: any) => x.pageViews || 1));
                                const maxUsers = Math.max(...gaData.daily.map((x: any) => x.users || 1));
                                return (
                                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-6 mb-8 shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-sm font-black dark:text-white uppercase tracking-tight">일별 트래픽 (7일)</h3>
                                            <div className="flex gap-3 text-[10px] font-bold">
                                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />페이지뷰</span>
                                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />사용자</span>
                                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />세션</span>
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <div className="flex items-end gap-3" style={{ height: '180px' }}>
                                                {gaData.daily.map((d: any, i: number) => {
                                                    const pvH = Math.max(6, (d.pageViews / maxPv) * 100);
                                                    const uH = Math.max(6, (d.users / maxUsers) * 100);
                                                    const sH = Math.max(6, (d.sessions / Math.max(...gaData.daily.map((x: any) => x.sessions || 1))) * 100);
                                                    const dateStr = d.date ? `${d.date.slice(4, 6)}/${d.date.slice(6)}` : '';
                                                    return (
                                                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                                                            <div className="text-[9px] font-bold text-blue-500">{d.pageViews}</div>
                                                            <div className="w-full flex items-end justify-center gap-[2px]" style={{ height: '140px' }}>
                                                                <div className="flex-1 rounded-t-md bg-gradient-to-t from-blue-500 to-blue-400 transition-all" style={{ height: `${uH}%` }} title={`사용자: ${d.users}`} />
                                                                <div className="flex-1 rounded-t-md bg-gradient-to-t from-blue-600 to-blue-400 transition-all" style={{ height: `${pvH}%` }} title={`페이지뷰: ${d.pageViews}`} />
                                                                <div className="flex-1 rounded-t-md bg-gradient-to-t from-emerald-500 to-emerald-400 transition-all" style={{ height: `${sH}%` }} title={`세션: ${d.sessions}`} />
                                                            </div>
                                                            <div className="text-[10px] font-bold text-gray-400 mt-1">{dateStr}</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* 🆕 유입 채널 (Traffic Sources) */}
                            {gaData.channels?.length > 0 && (
                                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-6 mb-8 shadow-sm">
                                    <h3 className="text-sm font-black dark:text-white uppercase tracking-tight mb-4">유입 경로 (30일)</h3>
                                    <div className="space-y-3">
                                        {gaData.channels.map((ch: any) => {
                                            const maxS = Math.max(...gaData.channels.map((c: any) => c.sessions));
                                            const pct = maxS > 0 ? (ch.sessions / maxS) * 100 : 0;
                                            const CL: Record<string, string> = { 'Organic Search': '자연 검색', 'Direct': '직접 방문', 'Referral': '참조(링크)', 'Organic Social': '소셜 미디어', 'Paid Search': '유료 검색', 'Email': '이메일', 'Unassigned': '미분류', 'Display': '디스플레이' };
                                            return (
                                                <div key={ch.channel}>
                                                    <div className="flex items-center justify-between text-xs mb-1">
                                                        <span className="font-bold dark:text-white">{CL[ch.channel] || ch.channel}</span>
                                                        <div className="flex gap-3 text-gray-400">
                                                            <span>{ch.sessions.toLocaleString()} 세션</span>
                                                            <span>{ch.users.toLocaleString()} 사용자</span>
                                                        </div>
                                                    </div>
                                                    <div className="h-2 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* 🆕 기기 + 신규/재방문 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                {gaData.devices?.length > 0 && (
                                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-6 shadow-sm">
                                        <h3 className="text-sm font-black dark:text-white uppercase tracking-tight mb-4">기기 (30일)</h3>
                                        <div className="space-y-3">
                                            {gaData.devices.map((d: any) => {
                                                const totalDU = gaData.devices.reduce((s: number, x: any) => s + x.users, 0);
                                                const pct = totalDU > 0 ? (d.users / totalDU * 100).toFixed(1) : '0';
                                                const DL: Record<string, string> = { 'desktop': '데스크탑', 'mobile': '모바일', 'tablet': '태블릿' };
                                                const DC: Record<string, string> = { 'desktop': 'bg-blue-500', 'mobile': 'bg-blue-500', 'tablet': 'bg-emerald-500' };
                                                return (
                                                    <div key={d.device} className="flex items-center justify-between">
                                                        <span className="text-xs font-bold dark:text-white">{DL[d.device] || d.device}</span>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-20 h-2 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                                                <div className={`h-full ${DC[d.device] || 'bg-gray-400'} rounded-full`} style={{ width: `${pct}%` }} />
                                                            </div>
                                                            <span className="text-xs font-black text-gray-500 w-12 text-right">{pct}%</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                {gaData.newVsReturning?.length > 0 && (
                                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-6 shadow-sm">
                                        <h3 className="text-sm font-black dark:text-white uppercase tracking-tight mb-4">신규 vs 재방문 (30일)</h3>
                                        <div className="space-y-3">
                                            {gaData.newVsReturning.map((nr: any) => {
                                                const totalNR = gaData.newVsReturning.reduce((s: number, x: any) => s + x.users, 0);
                                                const pct = totalNR > 0 ? (nr.users / totalNR * 100).toFixed(1) : '0';
                                                const label = nr.type === 'new' ? '신규 사용자' : nr.type === 'returning' ? '재방문 사용자' : nr.type;
                                                const color = nr.type === 'new' ? 'bg-emerald-500' : 'bg-blue-500';
                                                return (
                                                    <div key={nr.type}>
                                                        <div className="flex items-center justify-between text-xs mb-1">
                                                            <span className="font-bold dark:text-white">{label}</span>
                                                            <span className="font-black text-gray-500">{nr.users.toLocaleString()} ({pct}%)</span>
                                                        </div>
                                                        <div className="h-2 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                                            <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 🆕 유입 소스/매체 */}
                            {gaData.sourceMedium?.length > 0 && (
                                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-6 mb-8 shadow-sm">
                                    <h3 className="text-sm font-black dark:text-white uppercase tracking-tight mb-4">유입 소스 / 매체 (30일)</h3>
                                    <div className="space-y-2">
                                        {gaData.sourceMedium.map((sm: any, i: number) => {
                                            const maxS = Math.max(...gaData.sourceMedium.map((x: any) => x.sessions));
                                            const pct = maxS > 0 ? (sm.sessions / maxS) * 100 : 0;
                                            return (
                                                <div key={i}>
                                                    <div className="flex items-center justify-between text-xs mb-1">
                                                        <span className="font-bold dark:text-white">{sm.source} <span className="text-gray-400 font-normal">/ {sm.medium}</span></span>
                                                        <div className="flex gap-3 text-gray-400 text-[10px]">
                                                            <span>{sm.sessions.toLocaleString()} 세션</span>
                                                            <span>{sm.users.toLocaleString()} 사용자</span>
                                                            <span>{sm.pageViews.toLocaleString()} PV</span>
                                                        </div>
                                                    </div>
                                                    <div className="h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* 🆕 유입 링크 (Referrer) */}
                            {gaData.referrers?.length > 0 && (
                                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-6 mb-8 shadow-sm">
                                    <h3 className="text-sm font-black dark:text-white uppercase tracking-tight mb-4">유입 링크 (30일)</h3>
                                    <div className="space-y-2">
                                        {gaData.referrers.map((ref: any, i: number) => (
                                            <div key={i} className="flex items-center justify-between text-xs">
                                                <span className="text-gray-600 dark:text-gray-400 truncate max-w-[65%] font-mono text-[11px]">{ref.referrer || '(direct)'}</span>
                                                <div className="flex gap-3 text-[10px] text-gray-400">
                                                    <span className="font-black dark:text-white">{ref.sessions.toLocaleString()} 세션</span>
                                                    <span>{ref.users.toLocaleString()} 사용자</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 🆕 인구통계: 성별 + 나이 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                {gaData.gender?.length > 0 && (
                                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-6 shadow-sm">
                                        <h3 className="text-sm font-black dark:text-white uppercase tracking-tight mb-4">성별 (30일)</h3>
                                        <div className="space-y-3">
                                            {gaData.gender.map((g: any) => {
                                                const totalG = gaData.gender.reduce((s: number, x: any) => s + x.users, 0);
                                                const pct = totalG > 0 ? (g.users / totalG * 100).toFixed(1) : '0';
                                                const GL: Record<string, string> = { 'male': '👨 남성', 'female': '👩 여성', 'unknown': '❓ 미확인' };
                                                const GC: Record<string, string> = { 'male': 'bg-blue-500', 'female': 'bg-pink-500', 'unknown': 'bg-gray-400' };
                                                return (
                                                    <div key={g.gender}>
                                                        <div className="flex items-center justify-between text-xs mb-1">
                                                            <span className="font-bold dark:text-white">{GL[g.gender] || g.gender}</span>
                                                            <span className="font-black text-gray-500">{g.users.toLocaleString()} ({pct}%)</span>
                                                        </div>
                                                        <div className="h-2 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                                            <div className={`h-full ${GC[g.gender] || 'bg-gray-400'} rounded-full`} style={{ width: `${pct}%` }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                {gaData.ageBrackets?.length > 0 && (
                                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-6 shadow-sm">
                                        <h3 className="text-sm font-black dark:text-white uppercase tracking-tight mb-4">연령대 (30일)</h3>
                                        <div className="space-y-3">
                                            {gaData.ageBrackets.map((a: any) => {
                                                const totalA = gaData.ageBrackets.reduce((s: number, x: any) => s + x.users, 0);
                                                const pct = totalA > 0 ? (a.users / totalA * 100).toFixed(1) : '0';
                                                const AC: Record<string, string> = { '18-24': 'from-green-500 to-emerald-400', '25-34': 'from-blue-500 to-cyan-400', '35-44': 'from-blue-500 to-blue-400', '45-54': 'from-amber-500 to-yellow-400', '55-64': 'from-orange-500 to-red-400', '65+': 'from-rose-500 to-pink-400', 'unknown': 'from-gray-400 to-gray-300' };
                                                return (
                                                    <div key={a.age}>
                                                        <div className="flex items-center justify-between text-xs mb-1">
                                                            <span className="font-bold dark:text-white">{a.age === 'unknown' ? '❓ 미확인' : `📊 ${a.age}세`}</span>
                                                            <span className="font-black text-gray-500">{a.users.toLocaleString()} ({pct}%)</span>
                                                        </div>
                                                        <div className="h-2 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                                            <div className={`h-full bg-gradient-to-r ${AC[a.age] || 'from-gray-400 to-gray-300'} rounded-full`} style={{ width: `${pct}%` }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {gaData.topPages?.length > 0 && (
                                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-6 shadow-sm">
                                        <h3 className="text-sm font-black dark:text-white uppercase tracking-tight mb-4">인기 페이지 (7일)</h3>
                                        <div className="space-y-2">{gaData.topPages.map((p: any, i: number) => (<div key={i} className="flex items-center justify-between text-xs"><span className="text-gray-600 dark:text-gray-400 truncate max-w-[70%] font-mono">{p.path}</span><span className="font-black dark:text-white">{p.views.toLocaleString()}</span></div>))}</div>
                                    </div>
                                )}
                                {gaData.countries?.length > 0 && (
                                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-6 shadow-sm">
                                        <h3 className="text-sm font-black dark:text-white uppercase tracking-tight mb-4">국가별 사용자 (7일)</h3>
                                        <div className="space-y-2">{gaData.countries.map((c: any, i: number) => (<div key={i} className="flex items-center justify-between text-xs"><span className="text-gray-600 dark:text-gray-400">{c.country}</span><span className="font-black dark:text-white">{c.users.toLocaleString()}</span></div>))}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ) : tab === 'artworks' ? (
                <div className="animate-fadeIn">
                    <div className="mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <form onSubmit={(e) => { e.preventDefault(); setArtworkPage(1); fetchAdminData(); }} className="relative w-full sm:max-w-md">
                            <input
                                type="text"
                                value={artworkQuery}
                                onChange={(e) => setArtworkQuery(e.target.value)}
                                placeholder="작품명 또는 작가명으로 검색..."
                                className="w-full bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white shadow-sm"
                            />
                            <button type="submit" aria-label="작품 검색" className="absolute right-4 top-4 text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </button>
                        </form>
                        <button
                            onClick={() => { setEditingArtwork(null); setIsArtworkModalOpen(true); }}
                            className="bg-black dark:bg-white text-white dark:text-black px-8 py-4 rounded-2xl text-sm font-black shadow-xl hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
                        >
                            작품 등록
                        </button>
                    </div>

                    <div className="text-sm font-black text-gray-400 dark:text-neutral-500 uppercase tracking-widest flex items-center gap-2 mb-6">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                        총 {artworkTotal}개의 작품
                    </div>

                    <div className="space-y-2 mb-10">
                        {adminArtworks.map((aw: any) => (
                            <div key={aw.id} className="flex items-center gap-3 bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-xl px-4 py-3 hover:shadow-sm transition-all group">
                                {/* Small Thumbnail */}
                                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-neutral-800">
                                    {aw.image ? (
                                        <img src={aw.image} alt={aw.title} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = '/logo.svg'; e.currentTarget.className = 'w-full h-full object-contain p-2 opacity-20 dark:invert dark:opacity-60'; }} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <svg className="w-4 h-4 text-gray-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        </div>
                                    )}
                                </div>
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-sm dark:text-white truncate">{aw.titleKo || aw.title}</h3>
                                        {aw.artistKo || aw.artist ? <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold flex-shrink-0">{aw.artistKo || aw.artist}</span> : null}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        {aw.year && <span className="text-[10px] text-gray-400">{aw.year}</span>}
                                        {aw.museum && (
                                            <span className="inline-flex items-center gap-0.5 text-[9px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full font-bold">
                                                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                                {aw.museum.nameKo || aw.museum.name}
                                            </span>
                                        )}
                                        {aw.stories?.map((sa: any) => (
                                            <span key={sa.story?.id} className="inline-flex items-center gap-0.5 text-[9px] text-indigo-500 dark:text-indigo-400 truncate max-w-[100px]">
                                                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                                {sa.story?.title}
                                            </span>
                                        ))}
                                        {aw.stories?.flatMap((sa: any) => sa.story?.museums?.map((sm: any) => sm.museum) || []).filter((m: any, i: number, arr: any[]) => m?.id !== aw.museum?.id && arr.findIndex((x: any) => x?.id === m?.id) === i).map((m: any) => (
                                            <span key={m?.id} className="inline-flex items-center gap-0.5 text-[9px] text-amber-500 dark:text-amber-400 truncate max-w-[100px]">
                                                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                                {m?.nameKo || m?.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                {/* Actions */}
                                <div className="flex gap-1.5 flex-shrink-0">
                                    <button onClick={() => { setEditingArtwork(aw); setIsArtworkModalOpen(true); }} className="px-3 py-1.5 bg-gray-50 dark:bg-neutral-800 rounded-lg text-[10px] font-bold text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors">수정</button>
                                    <button onClick={() => { showConfirm('이 작품을 삭제하시겠습니까?', async () => { await fetch(`/api/admin/artworks?id=${aw.id}`, { method: 'DELETE' }); fetchAdminData(); }); }} className="px-3 py-1.5 bg-red-50 dark:bg-red-900/10 rounded-lg text-[10px] font-bold text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">삭제</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-center items-center gap-6 mb-12">
                        <button
                            disabled={artworkPage === 1}
                            onClick={() => setArtworkPage(p => p - 1)}
                            className="px-6 py-3 border border-gray-100 dark:border-neutral-800 rounded-2xl text-[11px] font-black text-gray-400 uppercase tracking-widest disabled:opacity-20 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all shadow-sm"
                        >
                            이전
                        </button>
                        <div className="text-[11px] font-black dark:text-neutral-500 uppercase tracking-widest">
                            페이지 {artworkPage} / {Math.max(1, Math.ceil(artworkTotal / 20))}
                        </div>
                        <button
                            disabled={artworkPage >= Math.ceil(artworkTotal / 20)}
                            onClick={() => setArtworkPage(p => p + 1)}
                            className="px-6 py-3 border border-gray-100 dark:border-neutral-800 rounded-2xl text-[11px] font-black text-gray-400 uppercase tracking-widest disabled:opacity-20 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all shadow-sm"
                        >
                            다음
                        </button>
                    </div>
                </div>
            ) : null
            }

            {
                isMuseumModalOpen && (
                    <MuseumEditModal
                        museum={editingMuseum}
                        onClose={() => setIsMuseumModalOpen(false)}
                        onSave={handleSaveMuseum}
                    />
                )
            }

            {
                isArtworkModalOpen && (
                    <ArtworkEditModal
                        artwork={editingArtwork}
                        onClose={() => setIsArtworkModalOpen(false)}
                        onSave={async (data: any) => {
                            try {
                                const method = data.id ? 'PUT' : 'POST';
                                const res = await fetch('/api/admin/artworks', {
                                    method,
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(data)
                                });
                                if (res.ok) {
                                    setIsArtworkModalOpen(false);
                                    setEditingArtwork(null);
                                    fetchAdminData();
                                } else {
                                    const err = await res.json();
                                    showAlert(err.message || '작품 정보를 저장하지 못했어요.');
                                }
                            } catch (err) {
                                console.error('Save artwork error:', err);
                            }
                        }}
                    />
                )
            }
        </div >
    );
}
