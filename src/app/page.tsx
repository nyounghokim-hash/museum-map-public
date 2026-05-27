'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useCompare } from '@/hooks/useCompare';
import { useDragReorder } from '@/hooks/useDragReorder';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { GlassPanel, FilterChip } from '@/components/ui/glass';
import dynamic from 'next/dynamic';
import { buildMapLinks, isAppleDevice } from '@/lib/mapLinks';
import { useApp } from '@/components/AppContext';
import { useModal } from '@/components/ui/Modal';
import { t, translateCategory, translateDescription, type Locale } from '@/lib/i18n';
import { getLocalizedMuseumName, getLocalizedCityName } from '@/lib/getLocalizedName';
import { useTranslatedText } from '@/hooks/useTranslation';
import MuseumDetailCard from '@/components/museum/MuseumDetailCard';
import LoadingAnimation from '@/components/ui/LoadingAnimation';
import * as gtag from '@/lib/gtag';
import { SparkleIcon, StarIcon, AirplaneIcon } from '@/components/ui/Icons';
import { clearActiveTripForAccount, getActiveTripForAccount, setActiveTripForAccount } from '@/lib/accountStorage';
import { getMuseumImageSrc } from '@/lib/getMuseumImage';
import { getDisplayStoryTitle } from '@/lib/storyTitle';

const MapLibreViewer = dynamic(() => import('@/components/map/MapLibreViewer'), { ssr: false });
import type { MapBounds } from '@/components/map/MapLibreViewer';
const RouteMapViewer = dynamic(() => import('@/components/map/RouteMapViewer'), { ssr: false });
const TripDetailPanel = dynamic(() => import('@/components/map/TripDetailPanel'), { ssr: false });
const NearbyPopup = dynamic(() => import('@/components/map/NearbyPopup'), { ssr: false });
const WeatherPopup = dynamic(() => import('@/components/map/WeatherPopup'), { ssr: false });
const RETURN_TO_MUSEUM_DETAIL_KEY = 'mm-return-to-museum-detail';

function getAiRecommendationImage(museum: any) {
  return getMuseumImageSrc(museum) || '';
}

function AiRecommendationCard({ museum, locale, compact = false, onSelect }: { museum: any; locale: Locale; compact?: boolean; onSelect: () => void }) {
  const image = getAiRecommendationImage(museum);
  const title = getLocalizedMuseumName(museum, locale);
  const summary = locale === 'ko' ? museum.summary : (museum.summaryTranslations?.[locale] || museum.summaryTranslations?.en || museum.summary);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`mm-card flex-shrink-0 text-left overflow-hidden active:scale-[0.98] transition-all duration-200 ${compact ? 'w-56' : 'w-64'} p-0`}
      aria-label={title}
    >
      <div className="flex h-full">
        <div className={`${compact ? 'w-[72px]' : 'w-[80px]'} h-[72px] shrink-0 overflow-hidden`} style={{ background: 'var(--mm-surface-secondary)' }}>
          {image ? (
            <img
              src={image}
              alt=""
              className="w-full h-full object-cover opacity-0 transition-opacity duration-300"
              onLoad={(e) => { e.currentTarget.classList.remove('opacity-0'); e.currentTarget.classList.add('opacity-100'); }}
              onError={(e) => { e.currentTarget.src = '/logo.svg'; e.currentTarget.className = 'w-full h-full object-contain p-4 opacity-20 dark:invert dark:opacity-60'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <img src="/logo.svg" alt="" className="w-7 h-7 opacity-20 dark:invert dark:opacity-60" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: 'var(--mm-brand-bg)', color: 'var(--mm-brand)' }}>
              <SparkleIcon className="w-3 h-3" />
              AI
            </span>
            {museum.googleRating && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-500 shrink-0">
                <StarIcon className="w-3 h-3" />
                {museum.googleRating}
              </span>
            )}
          </div>
          <h4 className="mt-1 text-xs font-extrabold truncate" style={{ color: 'var(--mm-text-primary)' }}>
            {title}
          </h4>
          <div className="mt-1 flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-bold truncate" style={{ color: 'var(--mm-brand)' }}>{translateCategory(museum.type || '', locale)}</span>
          </div>
          <p className="mt-1 text-[10px] leading-snug truncate" style={{ color: 'var(--mm-text-secondary)' }}>
            {museum.reason || summary || (locale === 'ko' ? '현재 검색 조건에 잘 맞는 추천 장소입니다.' : 'A strong match for your search.')}
          </p>
        </div>
      </div>
    </button>
  );
}

function stripHtml(value: string) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getStorySearchImage(story: any) {
  if (story?.previewImage) return story.previewImage;
  const artworkImage = story?.storyArtworks?.[0]?.artwork?.image;
  if (artworkImage) return artworkImage;
  const museum = story?.museums?.[0]?.museum;
  return getMuseumImageSrc(museum) || '';
}

function getStorySearchTitle(story: any, locale: Locale) {
  return getDisplayStoryTitle(locale === 'ko' ? story.title : (story.titleEn || story.title), story.museums);
}

function SearchResultButton({ result, locale, onMuseumSelect, onStorySelect }: {
  result: { kind: 'museum'; museum: any } | { kind: 'story'; story: any };
  locale: Locale;
  onMuseumSelect: (museum: any) => void;
  onStorySelect: (story: any) => void;
}) {
  const isStory = result.kind === 'story';
  const item = isStory ? result.story : result.museum;
  const image = isStory ? getStorySearchImage(item) : getMuseumImageSrc(item);
  const title = isStory ? getStorySearchTitle(item, locale) : getLocalizedMuseumName(item, locale);
  const subtitle = isStory
    ? stripHtml(locale === 'ko' ? item.content : (item.contentEn || item.content)).slice(0, 86)
    : [getLocalizedCityName(item, locale) || item.city, (() => {
      try { return new Intl.DisplayNames([locale], { type: 'region' }).of(item.country); } catch { return item.country; }
    })()].filter(Boolean).join(', ');

  return (
    <button
      className="w-full text-left px-4 py-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors border-b border-gray-50 dark:border-neutral-800/50 last:border-0 flex items-center gap-3"
      onClick={() => isStory ? onStorySelect(item) : onMuseumSelect(item)}
    >
      <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 dark:bg-neutral-800 flex-shrink-0">
        {image ? (
          <img src={image} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.parentElement?.querySelector('.sf') as HTMLElement; if (fb) fb.style.display = 'flex'; }} />
        ) : null}
        <div className={`sf w-full h-full items-center justify-center ${image ? 'hidden' : 'flex'}`}>
          <img src="/logo.svg" alt="" className="w-5 h-5 opacity-20 dark:invert dark:opacity-60" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-gray-800 dark:text-white truncate">{title}</span>
          {isStory && <span className="mm-chip mm-chip--brand shrink-0 text-[9px] px-1.5 py-0.5">{locale === 'ko' ? '스토리' : 'Story'}</span>}
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5 truncate">{subtitle}</div>
      </div>
    </button>
  );
}

export default function MainPage() {
  const { compareIds: compareIdsArr } = useCompare();
  const compareIdsSet = useMemo(() => new Set(compareIdsArr), [compareIdsArr]);
  const [museums, setMuseums] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [selectedMuseum, setSelectedMuseum] = useState<any | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categoryDropdownClosing, setCategoryDropdownClosing] = useState(false);
  const [countExpanded, setCountExpanded] = useState(false);
  const { locale, darkMode } = useApp();
  const { showAlert } = useModal();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [isViewingActiveRoute, setIsViewingActiveRoute] = useState(false);
  const [tripExiting, setTripExiting] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [navToolbarReady, setNavToolbarReady] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showTripActivatedNotif, setShowTripActivatedNotif] = useState(false);
  const { data: session, status } = useSession();
  const [savedMuseumIds, setSavedMuseumIds] = useState<Set<string>>(new Set());
  const [showConsentGate, setShowConsentGate] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentSubmitting, setConsentSubmitting] = useState(false);

  // AI Recommend
  const [aiQuery, setAiQuery] = useState('');
  const [aiResults, setAiResults] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiClosing, setAiClosing] = useState(false);

  // Smooth close AI panel with exit animation
  const closeAi = useCallback(() => {
    setAiClosing(true);
    setTimeout(() => {
      setAiOpen(false);
      setAiResults([]);
      setAiQuery('');
      setAiClosing(false);
    }, 250);
  }, []);

  // Smooth close category dropdown with exit animation
  const closeCategoryDropdown = useCallback(() => {
    if (!categoryDropdownOpen) return;
    setCategoryDropdownClosing(true);
    setTimeout(() => {
      setCategoryDropdownOpen(false);
      setCategoryDropdownClosing(false);
    }, 220);
  }, [categoryDropdownOpen]);
  const [chipOpen, setChipOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMuseumsOpen, setNewMuseumsOpen] = useState(false);
  const [newMuseumsClosing, setNewMuseumsClosing] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [returnFromDetail, setReturnFromDetail] = useState(false);
  const [skipTransition, setSkipTransition] = useState(false);

  // Smooth close new museums dropdown with exit animation
  const closeNewMuseums = useCallback(() => {
    if (!newMuseumsOpen) return;
    setNewMuseumsClosing(true);
    setTimeout(() => {
      setNewMuseumsOpen(false);
      setNewMuseumsClosing(false);
    }, 220);
  }, [newMuseumsOpen]);

  // Helper: close all popups/dropdowns (mutual exclusion)
  const closeAllPopups = useCallback((except?: string) => {
    if (except !== 'newMuseums') {
      if (newMuseumsOpen) {
        setNewMuseumsClosing(true);
        setTimeout(() => { setNewMuseumsOpen(false); setNewMuseumsClosing(false); }, 220);
      }
    }
    if (except !== 'category') {
      if (categoryDropdownOpen) {
        setCategoryDropdownClosing(true);
        setTimeout(() => { setCategoryDropdownOpen(false); setCategoryDropdownClosing(false); }, 220);
      }
    }
    if (except !== 'chip') setChipOpen(false);
    if (except !== 'ai') { setAiOpen(false); setAiResults([]); setAiQuery(''); }
    if (except !== 'nearby') setNearbyOpen(false);
    if (except !== 'weather') setWeatherOpen(false);
  }, [categoryDropdownOpen, newMuseumsOpen]);
  const prevSelectedRef = useRef<any>(null);
  const selectedMuseumRef = useRef<any>(null);
  const isHandlingPopState = useRef(false);

  // Keep ref in sync with state for stable popstate access
  useEffect(() => { selectedMuseumRef.current = selectedMuseum; }, [selectedMuseum]);

  const closeMuseumPanel = useCallback(() => {
    selectedMuseumRef.current = null;
    setSelectedMuseum(null);

    if (typeof window !== 'undefined' && window.history.state?.museumPanel) {
      isHandlingPopState.current = true;
      setSkipTransition(true);
      window.history.back();
      setTimeout(() => {
        isHandlingPopState.current = false;
        setSkipTransition(false);
      }, 600);
    }
  }, []);

  const openMuseumPanel = useCallback((museum: any, zoom?: number) => {
    selectedMuseumRef.current = museum;
    setSelectedMuseum(museum);
    setMapFlyTo({ lat: museum.latitude, lng: museum.longitude, ...(zoom ? { zoom } : {}) });

    if (typeof window === 'undefined') return;
    if (window.history.state?.museumPanel) {
      window.history.replaceState({ museumPanel: true }, '');
    } else {
      window.history.pushState({ museumPanel: true }, '');
    }
  }, []);

  // Record consent after Google login redirect
  useEffect(() => {
    if (searchParams?.get('consent') === 'new' && status === 'authenticated') {
      fetch('/api/auth/consent', { method: 'POST' })
        .then(() => console.log('Consent recorded'))
        .catch(console.error);
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('consent');
      window.history.replaceState({}, '', url.pathname);
    }
  }, [searchParams, status]);

  // Consent gate: session check + API fallback
  useEffect(() => {
    if (status !== 'authenticated') { setShowConsentGate(false); return; }
    if (searchParams?.get('consent') === 'new') return;
    const user = session?.user as any;
    if (!user?.email) return;
    if (user.role === 'ADMIN') return;

    // Fast path: session token has termsAgreedAt
    if (user.termsAgreedAt) { setShowConsentGate(false); return; }

    // Fallback: API check (covers old sessions without termsAgreedAt in token)
    fetch('/api/auth/consent-check')
      .then(r => r.json())
      .then(data => {
        if (data.needsConsent) setShowConsentGate(true);
        else setShowConsentGate(false);
      })
      .catch(() => {});
  }, [status, session, searchParams]);

  // Handle consent gate submission
  const handleConsentGateSubmit = async () => {
    setConsentSubmitting(true);
    try {
      await fetch('/api/auth/consent', { method: 'POST' });
      setShowConsentGate(false);
      setConsentTerms(false);
      setConsentPrivacy(false);
      showAlert(locale === 'ko' ? '서비스 이용이 가능합니다! 🎉' : locale === 'ja' ? 'サービスをご利用いただけます！🎉' : 'You can now use the service! 🎉');
    } catch (err) {
      console.error('Consent submit error:', err);
    }
    setConsentSubmitting(false);
  };

  // New museums — only those created within last 3 days
  const newMuseums = useMemo(() => {
    const CACHE_KEY = 'newMuseums_cache_v2';
    const CACHE_TTL = 60 * 60 * 1000; // 1h cache (check recency more often)
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    if (museums.length === 0) return [];
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, ts, total } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL && total === museums.length) return data;
      }
    } catch { }
    const cutoff = Date.now() - THREE_DAYS_MS;
    const recent = [...museums]
      .filter(m => m.createdAt && new Date(m.createdAt).getTime() > cutoff)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: recent, ts: Date.now(), total: museums.length })); } catch { }
    return recent;
  }, [museums]);

  // Fetch saved museum IDs for map marker coloring
  const refreshSavedIds = useCallback(async () => {
    if (status !== 'authenticated') { setSavedMuseumIds(new Set()); return; }
    try {
      const res = await fetch('/api/me/saves');
      const data = await res.json();
      if (data.data) {
        setSavedMuseumIds(new Set(data.data.map((s: any) => s.museum?.id || s.museumId)));
      }
    } catch { }
  }, [status]);

  useEffect(() => { refreshSavedIds(); }, [refreshSavedIds]);

  // Prevent body scroll on map page only
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Show detailed panel if museum selected OR if viewing active route (and not seeing a specific museum)
  const isPanelOpen = !!selectedMuseum || (isViewingActiveRoute && !!activeTrip);

  // Signal to MobileBottomNav to hide when detail panel is open
  useEffect(() => {
    if (isPanelOpen) {
      document.body.setAttribute('data-detail-open', 'true');
    } else {
      document.body.removeAttribute('data-detail-open');
    }
    return () => document.body.removeAttribute('data-detail-open');
  }, [isPanelOpen]);

  // Trigger entrance animation when returning from detail panel
  useEffect(() => {
    if (prevSelectedRef.current && !selectedMuseum) {
      setReturnFromDetail(true);
      const timer = setTimeout(() => setReturnFromDetail(false), 600);
      return () => clearTimeout(timer);
    }
    prevSelectedRef.current = selectedMuseum;
  }, [selectedMuseum]);

  useEffect(() => {
    let retries = 0;
    const maxRetries = 5;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Instantly load from cache if available (avoids loading screen on page revisits)
    try {
      const cached = sessionStorage.getItem('museums_cache_v2');
      if (cached) {
        const data = JSON.parse(cached);
        if (Array.isArray(data) && data.length > 0) {
          setMuseums(data);
        }
      }
    } catch { }

    const fetchMuseums = () => {
      fetch('/api/museums?limit=5000')
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(res => {
          const data = res.data?.data || res.data || [];
          if (Array.isArray(data) && data.length > 0) {
            setMuseums(data);
            try { sessionStorage.setItem('museums_cache_v2', JSON.stringify(data)); } catch { }
          } else if (retries < maxRetries) {
            retries++;
            timer = setTimeout(fetchMuseums, 2000 * retries);
          }
        })
        .catch(() => {
          if (retries < maxRetries) {
            retries++;
            timer = setTimeout(fetchMuseums, 2000 * retries);
          }
        });
    };

    fetchMuseums();
    return () => { if (timer) clearTimeout(timer); };
  }, []);

  useEffect(() => {
    const CACHE_KEY = 'mm_stories_search_cache_v1';
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Array.isArray(data) && Date.now() - ts < 30 * 60 * 1000) {
          setStories(data);
          return;
        }
      }
    } catch { }

    fetch('/api/blog')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(res => {
        const data = res.data || [];
        if (Array.isArray(data)) {
          setStories(data);
          try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch { }
        }
      })
      .catch(() => setStories([]));
  }, []);

  // Show loading overlay only after 1s delay (avoids flash for fast loads)
  useEffect(() => {
    if (museums.length > 0) { setShowLoading(false); return; }
    const t = setTimeout(() => setShowLoading(true), 1000);
    return () => clearTimeout(t);
  }, [museums.length]);

  // Handle museumId query param (from swipe-to-map)
  const [initialMuseumId, setInitialMuseumId] = useState<string | null>(null);
  const initialSearchLoadedRef = useRef(false);
  useEffect(() => {
    let returnMuseumId: string | null = null;
    try {
      const raw = sessionStorage.getItem(RETURN_TO_MUSEUM_DETAIL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const isFresh = typeof parsed?.ts === 'number' && Date.now() - parsed.ts < 10 * 60 * 1000;
        if (parsed?.fromMap && parsed?.museumId && isFresh) {
          returnMuseumId = parsed.museumId;
        }
        sessionStorage.removeItem(RETURN_TO_MUSEUM_DETAIL_KEY);
      }
    } catch {
      try { sessionStorage.removeItem(RETURN_TO_MUSEUM_DETAIL_KEY); } catch { }
    }

    const mId = searchParams?.get('museumId') || returnMuseumId;
    if (mId) {
      setInitialMuseumId(mId);
      // Clean URL without reload
      window.history.replaceState({}, '', '/');
    }
  }, [searchParams]);

  useEffect(() => {
    if (initialSearchLoadedRef.current) return;
    const q = searchParams?.get('q');
    if (q) setSearchQuery(q);
    initialSearchLoadedRef.current = true;
  }, [searchParams]);

  // When museums load & we have an initialMuseumId, fly to it
  useEffect(() => {
    if (!initialMuseumId || museums.length === 0) return;
    const museum = museums.find(m => m.id === initialMuseumId);
    if (museum) {
      openMuseumPanel(museum, 4);
    }
    setInitialMuseumId(null);
  }, [initialMuseumId, museums, openMuseumPanel]);

  const handleAiRecommend = async () => {
    if (!aiQuery.trim() || aiLoading) return;
    gtag.event('ai_recommend', { category: 'ai', label: aiQuery, value: 1 });
    setAiLoading(true);
    setAiResults([]);
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiQuery, locale })
      });
      const data = await res.json();
      if (data.data?.length > 0) {
        setAiResults(data.data);
      } else {
        showAlert(translateCategory('ai.noResults', locale));
      }
    } catch {
      showAlert(translateCategory('ai.error', locale));
    } finally {
      setAiLoading(false);
    }
  };

  // Check for active trip
  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      setActiveTrip(null);
      setIsViewingActiveRoute(false);
      clearActiveTripForAccount();
      return;
    }
    const parsed = getActiveTripForAccount();
    if (parsed) {
      try {
        if (parsed?.planId) {
          // Auto-expire: if endDate has passed, end the trip
          if (parsed.endDate) {
            const endDate = new Date(parsed.endDate);
            endDate.setHours(23, 59, 59, 999); // End of day
            if (new Date() > endDate) {
              clearActiveTripForAccount();
              try { fetch(`/api/plans/${parsed.planId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: false }) }); } catch { }
              return;
            }
          }
          setActiveTrip(parsed);

          // Auto-activate pending trips
          if (parsed.pending) {
            const now = Date.now();
            // Admin: check adminAutoActivate timestamp
            if (parsed.adminAutoActivate && now >= parsed.adminAutoActivate) {
              const activated = { ...parsed, pending: false, adminAutoActivate: undefined };
              setActiveTripForAccount(activated);
              setActiveTrip(activated);
              setShowTripActivatedNotif(true);
              setTimeout(() => setShowTripActivatedNotif(false), 4000);
            } else if (parsed.adminAutoActivate && now < parsed.adminAutoActivate) {
              // Schedule admin auto-activate
              const delay = parsed.adminAutoActivate - now;
              const timer = setTimeout(() => {
                const activated = { ...parsed, pending: false, adminAutoActivate: undefined };
                setActiveTripForAccount(activated);
                setActiveTrip(activated);
                setShowTripActivatedNotif(true);
                setTimeout(() => setShowTripActivatedNotif(false), 4000);
              }, delay);
              return () => clearTimeout(timer);
            } else if (parsed.startDate) {
              // Normal user: check if startDate has arrived
              const startDate = new Date(parsed.startDate);
              startDate.setHours(0, 0, 0, 0); // Start of day
              if (new Date() >= startDate) {
                const activated = { ...parsed, pending: false };
                setActiveTripForAccount(activated);
                setActiveTrip(activated);
                setShowTripActivatedNotif(true);
                setTimeout(() => setShowTripActivatedNotif(false), 4000);
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse activeTrip', e);
      }
    } else {
      setActiveTrip(null);
      setIsViewingActiveRoute(false);
    }
  }, [status]);

  const handleMuseumClick = async (id: string) => {
    const museum = museums.find(m => m.id === id);
    if (museum) {
      openMuseumPanel(museum);
    } else {
      router.push(`/museums/${id}`);
    }
  };

  // Listen for browser back (swipe/button) to close panel instead of navigating away
  // NOTE: No dependency on selectedMuseum — uses ref to avoid stale closure & handler recreation
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // Guard against rapid double-fire
      if (isHandlingPopState.current) return;
      // If we're back to museumPanel state (e.g. photo zoom just closed), keep detail open
      if (window.history.state?.museumPanel) return;
      if (selectedMuseumRef.current) {
        isHandlingPopState.current = true;
        setSkipTransition(true);
        setSelectedMuseum(null);
        setTimeout(() => { isHandlingPopState.current = false; setSkipTransition(false); }, 600);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Map museums: filtered by category only (search should NOT hide markers)
  const mapMuseums = museums.filter(m => activeFilter === 'All' || m.type === activeFilter);

  // Search results: museums + MM Stories. Map markers are still filtered only by category.
  const museumSearchResults = mapMuseums.filter(m => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const values = [
      m.name,
      m.nameKo,
      m.nameEn,
      m.city,
      m.cityKo,
      m.country,
      m.type,
      m.summary,
      m.descriptionKo,
      getLocalizedMuseumName(m, locale),
      getLocalizedCityName(m, locale),
    ];
    return values.some(value => String(value || '').toLowerCase().includes(q));
  });
  const storySearchResults = stories.filter(story => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return false;
    const museumNames = Array.isArray(story.museums)
      ? story.museums.flatMap((sm: any) => [sm.museum?.name, sm.museum?.nameKo, sm.museum?.nameEn, sm.museum?.city, sm.museum?.cityKo])
      : [];
    const values = [
      story.title,
      story.titleEn,
      story.description,
      stripHtml(story.content || ''),
      stripHtml(story.contentEn || ''),
      story.category,
      ...museumNames,
    ];
    return values.some(value => String(value || '').toLowerCase().includes(q));
  });
  const searchResults = [
    ...museumSearchResults.slice(0, 6).map(museum => ({ kind: 'museum' as const, museum })),
    ...storySearchResults.slice(0, 4).map(story => ({ kind: 'story' as const, story })),
  ].slice(0, 8);

  // Alias for category counts and total display
  const filteredMuseums = mapMuseums;

  const isDarkMode = darkMode;
  const [mapFlyTo, setMapFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);


  const [tripSheetOpen, setTripSheetOpen] = useState(true);
  const [tripStopsLocal, setTripStopsLocal] = useState<any[]>([]);
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [detailPanelEntered, setDetailPanelEntered] = useState(false);
  const nearbyBtnRefMobile = useRef<HTMLButtonElement>(null);
  const weatherBtnRefMobile = useRef<HTMLButtonElement>(null);
  const nearbyBtnRefPC = useRef<HTMLButtonElement>(null);
  const weatherBtnRefPC = useRef<HTMLButtonElement>(null);
  // Track active viewport so we render a single popup tied to the visible trigger.
  // Rendering popups at both locations would double up via body portal.
  const [isLgViewport, setIsLgViewport] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsLgViewport(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!selectedMuseum || typeof window === 'undefined') {
      setDetailPanelEntered(false);
      return;
    }
    if (skipTransition) {
      setDetailPanelEntered(true);
      return;
    }
    setDetailPanelEntered(false);
    const frame = window.requestAnimationFrame(() => setDetailPanelEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, [selectedMuseum?.id, skipTransition]);

  const activeNearbyRef = isLgViewport ? nearbyBtnRefPC : nearbyBtnRefMobile;
  const activeWeatherRef = isLgViewport ? weatherBtnRefPC : weatherBtnRefMobile;

  // Sync local stops when activeTrip changes
  useEffect(() => {
    if (activeTrip?.stops) setTripStopsLocal(activeTrip.stops);
  }, [activeTrip?.stops]);

  const tripDrag = useDragReorder({
    scope: 'active-trip-stops',
    longPressMs: 400,
    onReorder: (fromIndex, toIndex) => {
      const newStops = [...tripStopsLocal];
      const [moved] = newStops.splice(fromIndex, 1);
      newStops.splice(toIndex, 0, moved);
      const reordered = newStops.map((s, i) => ({ ...s, order: i }));
      setTripStopsLocal(reordered);
      setActiveTrip((prev: any) => prev ? { ...prev, stops: reordered } : prev);
      // Persist locally + to API if this is a saved plan
      if (typeof window !== 'undefined') {
        const parsed = getActiveTripForAccount();
        if (parsed) setActiveTripForAccount({ ...parsed, stops: reordered });
      }
      if (activeTrip?.planId) {
        fetch(`/api/plans/${activeTrip.planId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stops: reordered.map((s: any) => ({ id: s.id, order: s.order })) }),
        }).catch(() => { });
      }
    },
  });
  const tripDragIndex = tripDrag.dragIndex;
  const tripOverIndex = tripDrag.overIndex;
  const tripIsDragging = tripDrag.isDragging;

  // Dynamic map padding for mobile active-trip view so route isn't hidden by the top drawer
  const [tripViewportH, setTripViewportH] = useState(0);
  useEffect(() => {
    const handler = () => setTripViewportH(window.innerHeight);
    handler();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    if (navToolbarReady) return;
    let frame = 0;
    let attempts = 0;
    const findToolbar = () => {
      if (document.getElementById('nav-toolbar')) {
        setNavToolbarReady(true);
        return;
      }
      attempts += 1;
      if (attempts < 20) {
        frame = window.requestAnimationFrame(findToolbar);
      }
    };
    frame = window.requestAnimationFrame(findToolbar);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [navToolbarReady]);
  const tripMobileMapPadding = useMemo(() => ({
    top: tripSheetOpen ? Math.round(tripViewportH * 0.55) + 24 : 80,
    bottom: 100,
    left: 40,
    right: 40,
  }), [tripSheetOpen, tripViewportH]);

  const getVisitDuration = (type?: string): number => {
    const tp = (type || '').toLowerCase();
    if (tp.includes('art') || tp.includes('미술')) return 120;
    if (tp.includes('science') || tp.includes('과학')) return 90;
    if (tp.includes('history') || tp.includes('역사')) return 90;
    if (tp.includes('gallery') || tp.includes('갤러리')) return 60;
    return 90;
  };
  const fmtDur = (min: number, loc: string): string => {
    const h = Math.floor(min / 60), m = min % 60;
    if (loc === 'ko') return h > 0 ? (m > 0 ? `약 ${h}시간 ${m}분` : `약 ${h}시간`) : `약 ${m}분`;
    return h > 0 ? (m > 0 ? `~${h}h ${m}m` : `~${h}h`) : `~${m}m`;
  };

  // When viewing active route, render plans/[id]-style layout
  if (isViewingActiveRoute && activeTrip) {
    const tripStops = tripStopsLocal.length > 0 ? tripStopsLocal : (activeTrip.stops || []);
    const handleEndTrip = () => setShowEndConfirm(true);
    const confirmEndTrip = async () => {
      setShowEndConfirm(false);
      setActiveTrip(null); setIsViewingActiveRoute(false);
      clearActiveTripForAccount();
      try { await fetch('/api/plans/active-trip', { method: 'DELETE' }); } catch { }
    };
    const isPendingTrip = !!activeTrip.pending;
    const dDayNum = activeTrip.startDate ? Math.ceil((new Date(activeTrip.startDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000) : null;
    const dDayText = dDayNum !== null ? (dDayNum > 0 ? `D-${dDayNum}` : dDayNum === 0 ? 'D-DAY' : '') : '';
    const tripDateRange = activeTrip.startDate ? (() => { const s = new Date(activeTrip.startDate); const e = activeTrip.endDate ? new Date(activeTrip.endDate) : null; const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`; return e ? `${fmt(s)} ~ ${fmt(e)}` : fmt(s); })() : '';
    return (
      <div style={{ animation: tripExiting ? 'slideToRight 0.35s cubic-bezier(0.32, 0.72, 0, 1) forwards' : 'slideFromRight 0.4s cubic-bezier(0.32, 0.72, 0, 1)' }}>
        {/* Desktop: side-by-side */}
        <div className="hidden sm:flex sm:flex-row h-[calc(100vh-3.5rem)]">
          <div className="flex flex-col w-96 shrink-0" style={{ background: 'var(--glass-bg-heavy)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', borderRight: '1px solid var(--glass-border)' }}>
            <div className="p-6 pb-0 flex flex-col shrink-0">
              <button onClick={() => { setTripExiting(true); setTimeout(() => { setTripExiting(false); setIsViewingActiveRoute(false); setReturnFromDetail(true); setTimeout(() => setReturnFromDetail(false), 500); }, 300); }} className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded-full mb-4 transition-colors shadow-sm active:scale-95 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              {isPendingTrip ? (
                /* 대기(Pending) 상태: amber 톤 + D-day + 캘린더 */
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <p className="text-xs font-bold tracking-widest text-amber-600 dark:text-amber-400 uppercase">{locale === 'ko' ? '여행 준비 중' : 'UPCOMING TRIP'}</p>
                    {dDayText && <span className="ml-auto text-lg font-black text-amber-500 dark:text-amber-400 animate-pulse">{dDayText}</span>}
                  </div>
                  <h1 className="text-4xl font-extrabold dark:text-white mb-2">{activeTrip.title}</h1>
                  {tripDateRange && <p className="text-sm text-amber-600/70 dark:text-amber-400/70 font-medium mb-4">📅 {tripDateRange}</p>}
                </>
              ) : (
                /* 진행 중(Active) 상태: 보라색 + 실시간 느낌 */
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-purple-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                    </div>
                    <p className="text-xs font-bold tracking-widest text-purple-600 dark:text-purple-400 uppercase">{t('plans.viewActiveRoute', locale)}</p>
                    <span className="ml-auto flex items-center gap-1 text-xs text-green-500"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>{locale === 'ko' ? '여행 중' : 'LIVE'}</span>
                  </div>
                  <h1 className="text-4xl font-extrabold dark:text-white mb-2">{activeTrip.title}</h1>
                  {tripDateRange && <p className="text-sm text-gray-400 dark:text-gray-500 font-medium mb-4">📅 {tripDateRange}</p>}
                </>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-4">
              <div className="space-y-3 relative">
                <div className={`absolute left-[27px] top-2 bottom-2 w-0.5 z-0 ${isPendingTrip ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-purple-100 dark:bg-purple-900/30'}`}></div>
                {tripStops.map((stop: any, i: number) => {
                  const isBeingDragged = tripDragIndex === i;
                  const isDropTarget = tripOverIndex === i && tripDragIndex !== i;
                  return (
                    <div key={stop.museumId + '-' + i}
                      data-drag-index={i}
                      data-drag-scope="active-trip-stops"
                      className={`relative z-10 flex gap-4 p-3 rounded-xl border transition-all select-none cursor-pointer touch-none
                        ${isBeingDragged ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 shadow-lg scale-[1.02] opacity-80'
                          : isDropTarget ? 'bg-green-50 dark:bg-green-900/20 border-green-300 border-dashed'
                            : 'border shadow-sm hover:shadow-md hover:border-purple-200 dark:hover:border-purple-800'}`} style={!isBeingDragged && !isDropTarget ? { background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' } : undefined}
                      onPointerDown={(e) => tripDrag.onPointerDown(i, e)}
                      onPointerMove={tripDrag.onPointerMove}
                      onPointerCancel={tripDrag.cancelPress}
                      onPointerLeave={tripDrag.cancelPress}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isBeingDragged ? 'bg-purple-600 text-white shadow-md' : 'bg-purple-500 text-white shadow-sm'}`}>{i + 1}</div>
                      <div className="min-w-0 flex-1" onClick={() => !tripIsDragging && handleMuseumClick(stop.museumId)}>
                        <h3 className="font-bold text-base truncate dark:text-white">{(() => { const m = museums.find(x => x.id === stop.museumId); return m ? getLocalizedMuseumName(m, locale) : stop.name; })()}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          <svg className="w-3 h-3 inline-block mr-0.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {fmtDur(getVisitDuration(stop.type), locale)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {tripIsDragging && <p className="text-xs text-blue-500 dark:text-blue-400 text-center mt-3 animate-pulse">{t('plans.dragReorder', locale)}</p>}
            </div>
            {/* Bottom buttons */}
            <div className="p-4 border-t space-y-2 shrink-0" style={{ background: 'var(--glass-bg-heavy)', borderColor: 'var(--glass-border)' }}>
              {isPendingTrip && dDayText && (
                <div className="text-center py-2 mb-1">
                  <span className="text-4xl font-black text-amber-500 dark:text-amber-400">{dDayText}</span>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{locale === 'ko' ? '출발까지' : 'until departure'}</p>
                </div>
              )}
              <button onClick={handleEndTrip} className={`w-full py-3 rounded-lg font-bold transition-colors active:scale-[0.98] ${isPendingTrip ? 'bg-gray-50 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-700' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50'}`}>{isPendingTrip ? (locale === 'ko' ? '여행 취소' : 'Cancel Trip') : t('plans.endTrip', locale)}</button>
            </div>
          </div>
          <div className="flex-1 relative">
            <RouteMapViewer stops={tripStops.map((s: any) => { const m = museums.find((x: any) => x.id === s.museumId); return m ? { ...s, name: getLocalizedMuseumName(m, locale) } : s; })} darkMode={isDarkMode} onStopClick={(stop) => { if (stop.museumId) handleMuseumClick(stop.museumId); }} padding={{ top: 80, bottom: 80, left: 80, right: 80 }} />
          </div>
        </div>
        {/* Mobile: fullscreen map + top drawer */}
        <div className="sm:hidden relative h-[calc(100vh-3.5rem)]">
          <div className="absolute inset-0">
            <RouteMapViewer stops={tripStops.map((s: any) => { const m = museums.find((x: any) => x.id === s.museumId); return m ? { ...s, name: getLocalizedMuseumName(m, locale) } : s; })} darkMode={isDarkMode} onStopClick={(stop) => { if (stop.museumId) handleMuseumClick(stop.museumId); }} padding={tripMobileMapPadding} />
          </div>
          {/* Top drawer — slides down from top */}
          <div className={`absolute left-0 right-0 top-0 z-30 rounded-b-3xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] flex flex-col transition-[max-height] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden ${tripSheetOpen ? 'max-h-[55vh]' : 'max-h-[56px]'}`} style={{ background: 'var(--glass-bg-heavy)', backdropFilter: 'blur(24px) saturate(200%)', WebkitBackdropFilter: 'blur(24px) saturate(200%)' }}>
            {/* Scrollable stop list */}
            <div className={`px-4 pt-3 overflow-y-auto flex-1 min-h-0 transition-opacity duration-300 ${tripSheetOpen ? 'opacity-100' : 'opacity-0 h-0'}`}>
              <div className="space-y-2.5 relative">
                <div className="absolute left-[23px] top-2 bottom-2 w-0.5 bg-purple-100 dark:bg-purple-900/30 z-0"></div>
                {tripStops.map((stop: any, i: number) => {
                  const isBeingDragged = tripDragIndex === i;
                  const isDropTarget = tripOverIndex === i && tripDragIndex !== i;
                  return (
                    <div key={stop.museumId + '-' + i}
                      data-drag-index={i}
                      data-drag-scope="active-trip-stops"
                      className={`relative z-10 flex gap-3 p-2.5 rounded-xl border transition-all select-none cursor-pointer touch-none
                        ${isBeingDragged ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 shadow-lg scale-[1.02] opacity-80'
                          : isDropTarget ? 'bg-green-50 dark:bg-green-900/20 border-green-300 border-dashed'
                            : 'border shadow-sm'}`} style={!isBeingDragged && !isDropTarget ? { background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' } : undefined}
                      onPointerDown={(e) => tripDrag.onPointerDown(i, e)}
                      onPointerMove={tripDrag.onPointerMove}
                      onPointerCancel={tripDrag.cancelPress}
                      onPointerLeave={tripDrag.cancelPress}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${isBeingDragged ? 'bg-purple-600 text-white' : 'bg-purple-500 text-white'}`}>{i + 1}</div>
                      <div className="min-w-0 flex-1" onClick={() => !tripIsDragging && handleMuseumClick(stop.museumId)}>
                        <h3 className="font-bold text-sm truncate dark:text-white">{(() => { const m = museums.find(x => x.id === stop.museumId); return m ? getLocalizedMuseumName(m, locale) : stop.name; })()}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          <svg className="w-3 h-3 inline-block mr-0.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {fmtDur(getVisitDuration(stop.type), locale)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* End trip button inside drawer */}
              <div className="pt-2 pb-2">
                <button onClick={handleEndTrip} className="w-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 py-2.5 rounded-xl font-bold text-sm transition-colors active:scale-[0.98]">{t('plans.endTrip', locale)}</button>
              </div>
            </div>
            {/* Drawer handle — at bottom */}
            <button onClick={() => setTripSheetOpen(prev => !prev)} className="flex flex-col items-center w-full pt-2 pb-3 shrink-0">
              <span className={`text-xs font-bold mb-1.5 ${isPendingTrip ? 'text-amber-600 dark:text-amber-400' : 'text-purple-600 dark:text-purple-400'}`}>
                {isPendingTrip && dDayText ? `${dDayText} • ` : ''}{activeTrip.title} • {tripStops.length} {t('plans.stops', locale)}{tripDateRange ? ` • 📅 ${tripDateRange}` : ''}
              </span>
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-neutral-600" />
            </button>
          </div>
          {/* Floating back button — via portal to stay fixed */}
          {typeof document !== 'undefined' && createPortal(
            <div className="lg:hidden fixed bottom-8 right-8 z-[9998] flex flex-col gap-2">
              <button
                onClick={() => { setTripExiting(true); setTimeout(() => { setTripExiting(false); setIsViewingActiveRoute(false); setReturnFromDetail(true); setTimeout(() => setReturnFromDetail(false), 500); }, 300); }}
                className="w-14 h-14 flex items-center justify-center rounded-full bg-neutral-800/90 dark:bg-white/90 backdrop-blur-md text-white dark:text-gray-800 shadow-lg border border-neutral-700/60 dark:border-gray-200/60 active:scale-95 transition-all hover:bg-neutral-700 dark:hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>,
            document.body
          )}
        </div>
        {/* End Trip Confirmation Modal */}
        {showEndConfirm && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={() => setShowEndConfirm(false)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div className="relative glass-popup gradient-border rounded-3xl p-8 mx-6 max-w-sm w-full text-center" style={{ boxShadow: 'var(--glass-shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/10 dark:bg-purple-400/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-extrabold dark:text-white mb-2">{locale === 'ko' ? '여행을 종료하시나요?' : 'End this trip?'}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 flex items-center gap-1">{locale === 'ko' ? '만족스러운 여행 되셨길 바라요!' : 'Hope you had a wonderful trip!'}<AirplaneIcon className="w-4 h-4 inline" /></p>
              <div className="flex gap-3">
                <button onClick={() => setShowEndConfirm(false)} className="flex-1 py-3 rounded-xl border border-gray-200/50 dark:border-white/10 text-gray-600 dark:text-gray-400 font-bold text-sm hover:bg-white/40 dark:hover:bg-white/5 transition-colors active:scale-95">
                  {locale === 'ko' ? '취소' : 'Cancel'}
                </button>
                <button onClick={confirmEndTrip} className="flex-1 py-3 rounded-xl gradient-btn font-bold text-sm shadow-lg transition-colors active:scale-95">
                  {locale === 'ko' ? '확인' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }


  // Consent gate modal for existing users without terms agreement
  if (showConsentGate) {
    const CL: Record<string, { title: string; agreeAll: string; submit: string; cancel: string; required: string; termsName: string; privacyName: string; termsSummary: string; privacySummary: string }> = {
      ko: { title: '서비스 이용 동의', agreeAll: '전체 동의', submit: '동의하고 계속하기', cancel: '로그아웃', required: '(필수)', termsName: '서비스 이용약관', privacyName: '개인정보처리방침', termsSummary: 'Museum Map 서비스 이용, 계정 관리, 사진 업로드, AI 추천 기능 이용에 관한 규정입니다.', privacySummary: '이메일, 프로필 이미지 수집 및 서비스 개선 목적 활용, 30일 내 삭제 요청 가능합니다.' },
      en: { title: 'Terms Agreement', agreeAll: 'Agree to All', submit: 'Agree & Continue', cancel: 'Sign Out', required: '(required)', termsName: 'Terms of Service', privacyName: 'Privacy Policy', termsSummary: 'Terms covering Museum Map usage, account management, photo uploads, and AI recommendation features.', privacySummary: 'We collect email and profile image for service improvement. Deletion requests are processed within 30 days.' },
      ja: { title: 'サービス利用同意', agreeAll: 'すべて同意', submit: '同意して続ける', cancel: 'ログアウト', required: '(必須)', termsName: '利用規約', privacyName: 'プライバシーポリシー', termsSummary: 'Museum Mapの利用、アカウント管理、写真アップロード、AI推薦機能に関する規約です。', privacySummary: 'メール、プロフィール画像を収集し、サービス改善に活用します。30日以内の削除リクエストが可能です。' },
    };
    const cl = CL[locale] || CL['en'];
    const allAgreed = consentTerms && consentPrivacy;
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="glass-popup gradient-border rounded-3xl p-6 sm:p-8 w-full max-w-md" style={{ boxShadow: 'var(--glass-shadow-lg)' }}>
          <h2 className="text-lg font-black dark:text-white mb-1">{cl.title}</h2>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mb-5">{session?.user?.email}</p>

          {/* Agree All */}
          <button onClick={() => { setConsentTerms(true); setConsentPrivacy(true); }} className="mb-4 w-full py-3 rounded-2xl border border-purple-300/50 dark:border-purple-700/50 text-purple-600 dark:text-purple-400 text-sm font-bold hover:bg-purple-50/50 dark:hover:bg-purple-900/20 active:scale-[0.98] transition-all" style={{ background: 'var(--gradient-purple-orange-soft)' }}>
            {cl.agreeAll}
          </button>

          {/* Terms */}
          <div onClick={() => setConsentTerms(v => !v)} className={`rounded-2xl border p-4 cursor-pointer transition-all mb-3 active:scale-[0.98] ${consentTerms ? 'border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/10' : 'border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${consentTerms ? 'border-purple-500 bg-purple-500' : 'border-gray-300 dark:border-neutral-600'}`}>
                {consentTerms && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold dark:text-white">{cl.termsName} <span className="text-purple-500 text-xs">{cl.required}</span></p>
                <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{cl.termsSummary}</p>
              </div>
            </div>
          </div>

          {/* Privacy */}
          <div onClick={() => setConsentPrivacy(v => !v)} className={`rounded-2xl border p-4 cursor-pointer transition-all mb-5 active:scale-[0.98] ${consentPrivacy ? 'border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/10' : 'border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${consentPrivacy ? 'border-purple-500 bg-purple-500' : 'border-gray-300 dark:border-neutral-600'}`}>
                {consentPrivacy && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold dark:text-white">{cl.privacyName} <span className="text-purple-500 text-xs">{cl.required}</span></p>
                <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{cl.privacySummary}</p>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleConsentGateSubmit}
            disabled={!allAgreed || consentSubmitting}
            className="w-full py-3.5 rounded-2xl gradient-btn disabled:bg-gray-200 dark:disabled:bg-neutral-700 disabled:text-gray-400 dark:disabled:text-neutral-500 text-sm font-bold transition-all active:scale-[0.98] shadow-lg disabled:shadow-none disabled:opacity-60"
          >
            {consentSubmitting ? '...' : cl.submit}
          </button>
          <button onClick={() => { import('next-auth/react').then(m => m.signOut({ callbackUrl: '/login' })); }} className="mt-3 w-full py-2.5 text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            {cl.cancel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mm-map-shell relative w-full flex overflow-hidden">
      {/* PC Click-outside Overlay */}
      {selectedMuseum && (
        <div
          className="hidden lg:block absolute inset-0 z-30 cursor-pointer"
          onClick={closeMuseumPanel}
          aria-label="Close detail panel"
        />
      )}

      {/* ── Mobile Controls Header (above map, not overlay) ── */}
      {!isViewingActiveRoute && (
        <div className={`lg:hidden absolute top-0 left-0 right-0 px-4 pt-3 pb-2 flex flex-col gap-2 z-10 pointer-events-none ${isPanelOpen ? 'hidden' : ''} ${returnFromDetail ? 'animate-fadeInUp' : ''}`}>
          {/* Search Bar */}
          <div className="relative pointer-events-auto">
            <div className={`relative rounded-2xl shadow-lg border-2 transition-colors duration-300 ${searchFocused ? 'border-purple-500' : 'border-gray-300 dark:border-neutral-600'}`}>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => { setSearchFocused(true); closeCategoryDropdown(); closeNewMuseums(); }}
                  onBlur={() => setSearchFocused(false)}
                  placeholder={translateCategory('search.placeholder', locale)}
                  className="w-full pl-8 pr-4 py-2.5 backdrop-blur-xl rounded-[14px] text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 outline-none transition-all"
                  style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
                />
              </div>
            </div>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-[5px] top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
            {searchQuery.trim().length > 0 && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 glass-popup gradient-border-subtle rounded-2xl max-h-60 overflow-y-auto z-[100]" style={{ boxShadow: 'var(--glass-shadow-lg)' }}>
                {searchResults.map(result => (
                  <SearchResultButton
                    key={result.kind === 'story' ? `story-${result.story.id}` : `museum-${result.museum.id}`}
                    result={result}
                    locale={locale}
                    onMuseumSelect={(m) => {
                      setSearchQuery('');
                      openMuseumPanel(m, 4);
                    }}
                    onStorySelect={(story) => {
                      setSearchQuery('');
                      router.push(`/blog/${story.id}?fromMap=1`);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* New Museums + Category Dropdown row */}
          <div className="flex items-center gap-2 pointer-events-auto w-full">
            {/* New Museums Button */}
            {newMuseums.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => { if (newMuseumsOpen) { closeNewMuseums(); } else { closeAllPopups('newMuseums'); setNewMuseumsOpen(true); } }}
                  className={`flex items-center gap-2 px-4 py-2 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl rounded-2xl shadow-lg border transition-all active:scale-95 ${newMuseumsOpen
                    ? 'border-purple-300 dark:border-purple-700 ring-2 ring-purple-500/30'
                    : 'border-gray-100/50 dark:border-neutral-800/50 hover:border-purple-200 dark:hover:border-purple-800'
                    }`}
                >
                  <SparkleIcon className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-bold text-gray-800 dark:text-white">
                    {({ ko: '새로 추가된 곳', en: 'Newly Added', ja: '新しく追加', de: 'Neu hinzugefügt', fr: 'Nouveautés', es: 'Recién añadidos', pt: 'Recém-adicionados', 'zh-CN': '新增地点', 'zh-TW': '新增地點', da: 'Nyligt tilføjet', fi: 'Juuri lisätyt', sv: 'Nyligen tillagda', et: 'Äsja lisatud' } as Record<string, string>)[locale] || 'Newly Added'}
                  </span>
                  <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-300 ${newMuseumsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {(newMuseumsOpen || newMuseumsClosing) && (
                  <div className={`absolute top-full left-0 right-0 mt-1 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-100/50 dark:border-neutral-800/50 max-h-72 overflow-y-auto z-50 min-w-[280px] ${newMuseumsClosing ? 'animate-fadeOutDown' : 'animate-fadeInUp'}`}>
                    {newMuseums.map((m: any, i: number) => {
                      const imageSrc = getMuseumImageSrc(m);
                      return (
                      <button
                        key={m.id}
                        className="w-full text-left px-4 py-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors border-b border-gray-50 dark:border-neutral-800/50 last:border-0 flex items-center gap-3 rounded-xl"
                        onClick={() => {
                          setNewMuseumsOpen(false);
                          openMuseumPanel(m, 4);
                        }}
                      >
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 dark:bg-neutral-800 flex-shrink-0 relative">
                          {imageSrc ? (
                            <img src={imageSrc} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.parentElement?.querySelector('.sf') as HTMLElement; if (fb) fb.style.display = 'flex'; }} />
                          ) : null}
                          <div className={`sf w-full h-full items-center justify-center ${imageSrc ? 'hidden' : 'flex'}`}>
                            <img src="/logo.svg" alt="" className="w-5 h-5 opacity-20 dark:invert dark:opacity-60" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-gray-800 dark:text-white truncate">{getLocalizedMuseumName(m, locale)}</span>
                            {(Date.now() - new Date(m.createdAt).getTime()) < 3 * 24 * 60 * 60 * 1000 && <span className="bg-purple-500 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full leading-none shrink-0">NEW</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-400">{getLocalizedCityName(m, locale) || m.city}</span>
                            {m.googleRating && (
                              <span className="text-[10px] text-yellow-500 flex items-center gap-0.5">
                                <StarIcon className="w-3 h-3" /> {m.googleRating}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-300 dark:text-neutral-600 shrink-0">
                          {(() => {
                            const d = new Date(m.createdAt);
                            return `${d.getMonth() + 1}/${d.getDate()}`;
                          })()}
                        </span>
                      </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Category Dropdown */}
            <div className="relative ml-auto">
              <button
                onClick={() => { if (categoryDropdownOpen) { closeCategoryDropdown(); } else { closeAllPopups('category'); setCategoryDropdownOpen(true); } }}
                className={`flex items-center gap-2 px-4 py-2 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl rounded-2xl shadow-lg border transition-all active:scale-95 ${categoryDropdownOpen
                  ? 'border-purple-300 dark:border-purple-700 ring-2 ring-purple-500/30'
                  : 'border-gray-100/50 dark:border-neutral-800/50 hover:border-purple-200 dark:hover:border-purple-800'
                  }`}
              >
                <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span className="text-xs font-bold text-gray-800 dark:text-white">
                  {activeFilter === 'All' ? (({ ko: '카테고리', en: 'Category', ja: 'カテゴリ', de: 'Kategorie', fr: 'Catégorie', es: 'Categoría', pt: 'Categoria', 'zh-CN': '分类', 'zh-TW': '分類' } as Record<string, string>)[locale] || 'Category') : translateCategory(activeFilter, locale)}
                </span>
                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-300 ${categoryDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {(categoryDropdownOpen || categoryDropdownClosing) && (
                <div className={`absolute top-full right-0 mt-1 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-100/50 dark:border-neutral-800/50 max-h-72 overflow-y-auto z-50 min-w-[160px] ${categoryDropdownClosing ? 'animate-fadeOutDown' : 'animate-fadeInUp'}`}>
                  {['All', 'Art Gallery', 'Contemporary Art', 'Modern Art', 'Fine Arts', 'General Museum', 'History Museum', 'Natural History', 'Science Museum', 'Maritime Museum', 'Archaeological Museum', 'Photography Museum', 'Design Museum', 'Cultural Center', 'Unusual Museum'].map(f => (
                    <button
                      key={f}
                      className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors border-b border-gray-50 dark:border-neutral-800/50 last:border-0 ${activeFilter === f ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'}`}
                      onClick={() => {
                        setActiveFilter(f);
                        setCategoryDropdownOpen(false);
                        setAiOpen(false);
                        setAiResults([]);
                        gtag.event('filter_museums', { category: 'filter', label: f, value: 1 });
                      }}
                    >
                      {translateCategory(f, locale)}
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Icon button row — My Location + Nearby + Weather (separate row so New Museums + Category never overflow) */}
          <div className="flex items-center gap-2 pointer-events-auto w-full justify-end">
            {/* My Location Button */}
            <button
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const nextLocation = { lng: pos.coords.longitude, lat: pos.coords.latitude };
                      setUserLocation(nextLocation);
                      setMapFlyTo({ ...nextLocation, zoom: 13 });
                    },
                    () => {
                      showAlert(locale === 'ko' ? '현재 위치를 불러오지 못했어요' : 'Unable to get your location');
                    }
                  );
                }
              }}
              className="w-10 h-10 flex items-center justify-center bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-100/50 dark:border-neutral-800/50 hover:border-purple-200 dark:hover:border-purple-800 transition-all active:scale-95 shrink-0"
              aria-label="My Location"
            >
              <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2m10-10h-2M4 12H2" />
              </svg>
            </button>

            {/* Nearby Museums button */}
            <div className="relative shrink-0">
              <button
                ref={nearbyBtnRefMobile}
                onClick={() => { if (nearbyOpen) { setNearbyOpen(false); } else { closeAllPopups('nearby'); setNearbyOpen(true); } }}
                aria-label={locale === 'ko' ? '내 주변' : 'Nearby museums'}
                aria-expanded={nearbyOpen}
                className={`w-10 h-10 flex items-center justify-center rounded-2xl shadow-lg border transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-purple-500 ${nearbyOpen ? 'bg-purple-600 text-white border-purple-600' : 'bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-gray-100/50 dark:border-neutral-800/50 hover:border-purple-200 dark:hover:border-purple-800 text-purple-500'}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>

            {/* Weather button */}
            <div className="relative shrink-0">
              <button
                ref={weatherBtnRefMobile}
                onClick={() => { if (weatherOpen) { setWeatherOpen(false); } else { closeAllPopups('weather'); setWeatherOpen(true); } }}
                aria-label={locale === 'ko' ? '오늘 날씨' : "Today's weather"}
                aria-expanded={weatherOpen}
                className={`w-10 h-10 flex items-center justify-center rounded-2xl shadow-lg border transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-purple-500 ${weatherOpen ? 'bg-purple-600 text-white border-purple-600' : 'bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-gray-100/50 dark:border-neutral-800/50 hover:border-purple-200 dark:hover:border-purple-800 text-purple-500'}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="relative flex-1 min-h-0">
        {isViewingActiveRoute && activeTrip ? (
          <RouteMapViewer
            stops={activeTrip.stops}
            darkMode={isDarkMode}
            onStopClick={(stop) => {
              if (stop.museumId) handleMuseumClick(stop.museumId);
            }}
          />
        ) : (
          <MapLibreViewer
            museums={mapMuseums}
            onMuseumClick={handleMuseumClick}
            darkMode={isDarkMode}
            locale={locale}
            flyTo={mapFlyTo}
            userLocation={userLocation}
            savedIds={savedMuseumIds}
            compareIds={compareIdsSet}
          />
        )}

        {/* Loading overlay — shown while museums are being fetched */}
        {museums.length === 0 && !isViewingActiveRoute && showLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none transition-opacity duration-700">
            <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px]" />
            <div className="relative flex flex-col items-center gap-6 animate-fadeInUp">
              <LoadingAnimation size={50} inline />
              <div className="text-center">
                <p className="text-white text-base font-bold tracking-wide drop-shadow-lg">
                  {({ ko: '박물관과 미술관을 불러오는 중이에요', en: 'Loading museums...', ja: '美術館を読み込んでいます', zh: '正在加载博物馆...', de: 'Museen werden geladen...', fr: 'Chargement des musées...', es: 'Cargando museos...', pt: 'Carregando museus...', sv: 'Laddar museer...', fi: 'Ladataan museoita...', da: 'Indlæser museer...', et: 'Muuseumide laadimine...' } as Record<string, string>)[locale] || 'Loading museums...'}
                </p>
                <p className="text-white/60 text-xs mt-1 font-medium drop-shadow">
                  {({ ko: '잠시만 기다려주세요', en: 'Please wait a moment', ja: '少々お待ちください', zh: '请稍等', de: 'Bitte warten', fr: 'Veuillez patienter', es: 'Espere un momento', pt: 'Aguarde um momento', sv: 'Vänta ett ögonblick', fi: 'Odota hetki', da: 'Vent venligst', et: 'Palun oodake' } as Record<string, string>)[locale] || 'Please wait a moment'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filters overlay — PC only (hidden on mobile, shown in header instead) */}
        {!isViewingActiveRoute && (
          <div className={`hidden lg:flex absolute top-4 left-4 z-20 flex-col gap-2 sm:gap-3 pointer-events-none transition-all duration-500 ${isPanelOpen ? 'lg:right-[716px]' : 'right-4'}`}>
            {/* Search Bar */}
            <div className="pointer-events-auto">
              <div className="relative">
                <div className={`relative rounded-2xl shadow-lg border-2 transition-colors duration-300 ${searchFocused ? 'border-purple-500' : 'border-gray-300 dark:border-neutral-600'}`}>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => { setSearchFocused(true); closeCategoryDropdown(); closeNewMuseums(); }}
                      onBlur={() => setSearchFocused(false)}
                      placeholder={translateCategory('search.placeholder', locale)}
                      className="w-full pl-8 pr-4 py-3 backdrop-blur-xl rounded-[14px] text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 outline-none transition-all"
                      style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
                    />
                  </div>
                </div>
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
                {searchQuery.trim().length > 0 && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 glass-popup gradient-border-subtle rounded-2xl max-h-60 overflow-y-auto z-[100]" style={{ boxShadow: 'var(--glass-shadow-lg)' }}>
                    {searchResults.map(result => (
                      <SearchResultButton
                        key={result.kind === 'story' ? `story-${result.story.id}` : `museum-${result.museum.id}`}
                        result={result}
                        locale={locale}
                        onMuseumSelect={(m) => {
                          setSearchQuery('');
                          openMuseumPanel(m, 4);
                        }}
                        onStorySelect={(story) => {
                          setSearchQuery('');
                          router.push(`/blog/${story.id}?fromMap=1`);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* New Museums + Category Dropdown row */}
            <div className="flex items-center gap-2 pointer-events-auto w-full">
              {/* New Museums Button */}
              {newMuseums.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => { if (newMuseumsOpen) { closeNewMuseums(); } else { closeAllPopups('newMuseums'); setNewMuseumsOpen(true); } }}
                    className={`flex items-center gap-2 px-4 py-2.5 bg-white/92 dark:bg-neutral-900/92 backdrop-blur-xl rounded-2xl shadow-lg border transition-all active:scale-95 ${newMuseumsOpen
                      ? 'border-purple-300 dark:border-purple-700 ring-2 ring-purple-500/30'
                      : 'border-gray-100/50 dark:border-neutral-800/50 hover:border-purple-200 dark:hover:border-purple-800'
                      }`}
                  >
                    <SparkleIcon className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-bold text-gray-800 dark:text-white">
                      {({ ko: '새로 추가된 곳', en: 'Newly Added', ja: '新しく追加', de: 'Neu hinzugefügt', fr: 'Nouveautés', es: 'Recién añadidos', pt: 'Recém-adicionados', 'zh-CN': '新增地点', 'zh-TW': '新增地點', da: 'Nyligt tilføjet', fi: 'Juuri lisätyt', sv: 'Nyligen tillagda', et: 'Äsja lisatud' } as Record<string, string>)[locale] || 'Newly Added'}
                    </span>
                    <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-300 ${newMuseumsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expandable List */}
                  {(newMuseumsOpen || newMuseumsClosing) && (
                    <div className={`absolute top-full left-0 right-0 mt-1 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-100/50 dark:border-neutral-800/50 max-h-72 overflow-y-auto z-50 min-w-[280px] sm:min-w-[360px] ${newMuseumsClosing ? 'animate-fadeOutDown' : 'animate-fadeInUp'}`}>
                      {newMuseums.map((m: any, i: number) => {
                        const imageSrc = getMuseumImageSrc(m);
                        return (
                        <button
                          key={m.id}
                          className="w-full text-left px-4 py-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors border-b border-gray-50 dark:border-neutral-800/50 last:border-0 flex items-center gap-3 rounded-xl"
                          onClick={() => {
                            setNewMuseumsOpen(false);
                            openMuseumPanel(m, 4);
                          }}
                        >
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 dark:bg-neutral-800 flex-shrink-0 relative">
                            {imageSrc ? (
                              <img src={imageSrc} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.parentElement?.querySelector('.sf') as HTMLElement; if (fb) fb.style.display = 'flex'; }} />
                            ) : null}
                            <div className={`sf w-full h-full items-center justify-center ${imageSrc ? 'hidden' : 'flex'}`}>
                              <img src="/logo.svg" alt="" className="w-5 h-5 opacity-20 dark:invert dark:opacity-60" />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-gray-800 dark:text-white truncate">{getLocalizedMuseumName(m, locale)}</span>
                              {(Date.now() - new Date(m.createdAt).getTime()) < 3 * 24 * 60 * 60 * 1000 && <span className="bg-purple-500 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full leading-none shrink-0">NEW</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-gray-400">{getLocalizedCityName(m, locale) || m.city}</span>
                              {m.googleRating && (
                                <span className="text-[10px] text-yellow-500 flex items-center gap-0.5">
                                  <StarIcon className="w-3 h-3" /> {m.googleRating}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-300 dark:text-neutral-600 shrink-0">
                            {(() => {
                              const d = new Date(m.createdAt);
                              return `${d.getMonth() + 1}/${d.getDate()}`;
                            })()}
                          </span>
                        </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Category Dropdown */}
              <div className="relative ml-auto">
                <button
                  onClick={() => { if (categoryDropdownOpen) { closeCategoryDropdown(); } else { closeAllPopups('category'); setCategoryDropdownOpen(true); } }}
                  className={`flex items-center gap-2 px-4 py-2.5 bg-white/92 dark:bg-neutral-900/92 backdrop-blur-xl rounded-2xl shadow-lg border transition-all active:scale-95 ${categoryDropdownOpen
                    ? 'border-purple-300 dark:border-purple-700 ring-2 ring-purple-500/30'
                    : 'border-gray-100/50 dark:border-neutral-800/50 hover:border-purple-200 dark:hover:border-purple-800'
                    }`}
                >
                  <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <span className="text-sm font-bold text-gray-800 dark:text-white">
                    {activeFilter === 'All' ? (({ ko: '카테고리', en: 'Category', ja: 'カテゴリ', de: 'Kategorie', fr: 'Catégorie', es: 'Categoría', pt: 'Categoria', 'zh-CN': '分类', 'zh-TW': '分類' } as Record<string, string>)[locale] || 'Category') : translateCategory(activeFilter, locale)}
                  </span>
                  <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-300 ${categoryDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {(categoryDropdownOpen || categoryDropdownClosing) && (
                  <div className={`absolute top-full right-0 mt-1 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-100/50 dark:border-neutral-800/50 max-h-72 overflow-y-auto z-50 min-w-[160px] ${categoryDropdownClosing ? 'animate-fadeOutDown' : 'animate-fadeInUp'}`}>
                    {['All', 'Art Gallery', 'Contemporary Art', 'Modern Art', 'Fine Arts', 'General Museum', 'History Museum', 'Natural History', 'Science Museum', 'Maritime Museum', 'Archaeological Museum', 'Photography Museum', 'Design Museum', 'Cultural Center', 'Unusual Museum'].map(f => (
                      <button
                        key={f}
                        className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors border-b border-gray-50 dark:border-neutral-800/50 last:border-0 ${activeFilter === f ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'}`}
                        onClick={() => {
                          setActiveFilter(f);
                          setCategoryDropdownOpen(false);
                          setAiOpen(false);
                          setAiResults([]);
                          gtag.event('filter_museums', { category: 'filter', label: f, value: 1 });
                        }}
                      >
                        {translateCategory(f, locale)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* My Location — Mobile */}
              <button
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        const nextLocation = { lng: pos.coords.longitude, lat: pos.coords.latitude };
                        setUserLocation(nextLocation);
                        setMapFlyTo({ ...nextLocation, zoom: 13 });
                      },
                      () => { showAlert(locale === 'ko' ? '위치 정보를 가져올 수 없습니다' : 'Unable to get your location'); }
                    );
                  }
                }}
                className="w-10 h-10 flex items-center justify-center bg-white/92 dark:bg-neutral-900/92 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-100/50 dark:border-neutral-800/50 transition-all active:scale-95 shrink-0"
                aria-label="My Location"
              >
                <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2m10-10h-2M4 12H2" />
                </svg>
              </button>

              {/* Nearby Museums (PC filter overlay) */}
              <div className="relative shrink-0">
                <button
                  ref={nearbyBtnRefPC}
                  onClick={() => { if (nearbyOpen) { setNearbyOpen(false); } else { closeAllPopups('nearby'); setNearbyOpen(true); } }}
                  aria-label={locale === 'ko' ? '내 주변' : 'Nearby museums'}
                  aria-expanded={nearbyOpen}
                  className={`w-10 h-10 flex items-center justify-center rounded-2xl shadow-lg border transition-all active:scale-95 ${nearbyOpen ? 'bg-purple-600 text-white border-purple-600' : 'bg-white/92 dark:bg-neutral-900/92 backdrop-blur-xl border-gray-100/50 dark:border-neutral-800/50 text-purple-500'}`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>

              {/* Weather (PC filter overlay) */}
              <div className="relative shrink-0">
                <button
                  ref={weatherBtnRefPC}
                  onClick={() => { if (weatherOpen) { setWeatherOpen(false); } else { closeAllPopups('weather'); setWeatherOpen(true); } }}
                  aria-label={locale === 'ko' ? '오늘 날씨' : "Today's weather"}
                  aria-expanded={weatherOpen}
                  className={`w-10 h-10 flex items-center justify-center rounded-2xl shadow-lg border transition-all active:scale-95 ${weatherOpen ? 'bg-purple-600 text-white border-purple-600' : 'bg-white/92 dark:bg-neutral-900/92 backdrop-blur-xl border-gray-100/50 dark:border-neutral-800/50 text-purple-500'}`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Route Button + AI Recommend — stacked */}
        {!isViewingActiveRoute && !isPanelOpen && (
          <>
            {/* Desktop: absolute positioned over map */}
            <div className="hidden lg:block absolute bottom-4 left-4 right-4 z-[51] pointer-events-none">
              <div className="pointer-events-auto flex flex-col-reverse gap-2 max-w-3xl">
                {!aiOpen ? (
                  <>
                    <button
                      onClick={() => setAiOpen(true)}
                      className="flex items-center gap-2 px-5 py-3 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.1)] border border-gray-100 dark:border-neutral-800 hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)] transition-all active:scale-95 w-fit"
                    >
                      <span className="text-lg">
                        <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                      </span>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        {translateCategory('ai.recommend', locale)}
                      </span>
                    </button>
                  </>
                ) : (
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleAiRecommend(); }}
                    className={`flex items-center gap-2 p-2 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200 dark:border-neutral-700 focus-within:border-purple-400 dark:focus-within:border-purple-600 transition-colors ${aiClosing ? 'animate-fadeOutDown' : 'animate-fadeInUp'}`}
                  >
                    <input type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder={translateCategory('ai.placeholder', locale)} className="flex-1 min-w-0 px-4 py-2 bg-gray-50 dark:bg-neutral-800 rounded-xl text-sm text-gray-800 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-700 transition-all" />
                    <button type="submit" disabled={aiLoading} className="w-10 h-10 flex items-center justify-center gradient-btn text-white rounded-xl text-sm font-bold active:scale-95 transition-all disabled:opacity-50 shrink-0">
                      {aiLoading ? '…' : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}
                    </button>
                    <button type="button" onClick={closeAi} className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-neutral-800 rounded-xl text-gray-500 hover:text-gray-800 dark:hover:text-white text-sm font-bold active:scale-95 transition-all shrink-0">✕</button>
                  </form>
                )}
                {activeTrip && !aiOpen && (
                  <div>
                    <button onClick={() => setIsViewingActiveRoute(true)} className={`px-4 py-2.5 rounded-2xl font-bold text-sm shadow-[0_2px_8px_rgba(0,0,0,0.15)] active:scale-95 transition-all flex items-center gap-2 ${activeTrip.pending ? 'bg-purple-200 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' : 'gradient-btn text-white'}`}>
                      <span className={activeTrip.pending ? '' : 'animate-pulse'}>{activeTrip.pending ? (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>) : (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>)}</span>
                      {activeTrip.pending ? (locale === 'ko' ? '여행 준비 중' : 'Trip Pending') : t('plans.viewActiveRoute', locale)}
                      <span className={`px-2 py-0.5 rounded-full text-xs ${activeTrip.pending ? 'bg-purple-300/30 dark:bg-purple-800/30' : 'bg-white/20'}`}>{activeTrip.title}</span>
                    </button>
                  </div>
                )}
                {aiOpen && aiResults.length > 0 && (
                  <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide animate-fadeInUp max-w-full w-full">
                    {aiResults.map((m: any) => (
                      <AiRecommendationCard
                        key={m.id}
                        museum={m}
                        locale={locale}
                        onSelect={() => { handleMuseumClick(m.id); setAiOpen(false); }}
                      />
                    ))}
                  </div>
                )}
                {aiOpen && aiLoading && (<div className="flex items-center gap-2 px-4 py-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-xl shadow-lg animate-fadeInUp"><div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /><span className="text-xs text-gray-500 dark:text-gray-400">{translateCategory('ai.loading', locale)}</span></div>)}
                {aiOpen && !aiLoading && aiResults.length === 0 && aiQuery && (<div className="px-4 py-2 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-xl shadow-lg animate-fadeInUp"><span className="text-xs text-gray-400">{translateCategory('ai.hint', locale)}</span></div>)}
              </div>
            </div>
            {/* Desktop: count badge */}
            {!aiOpen && !selectedMuseum && (
              <div className="hidden lg:block absolute bottom-4 right-4 z-[51]">
                {chipOpen && (
                  <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-md rounded-2xl shadow-xl p-3 min-w-[160px] animate-fadeInUp">
                    <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">{locale === 'ko' ? '카테고리별' : 'By Category'}</div>
                    {(() => {
                      const counts: Record<string, number> = {};
                      filteredMuseums.forEach((m: any) => { const type = m.type || 'OTHER'; if (type === 'Aquarium') return; const translated = translateCategory(type, locale); counts[translated] = (counts[translated] || 0) + 1; });
                      return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => (<div key={name} className="flex justify-between items-center py-1"><span className="text-[11px] text-white/80">{name}</span><span className="text-[11px] font-bold text-white ml-4">{count}</span></div>));
                    })()}
                    <div className="border-t border-white/10 mt-1.5 pt-1.5 flex justify-between items-center"><span className="text-[11px] font-bold text-white/60">{locale === 'ko' ? '전체' : 'Total'}</span><span className="text-sm font-black text-white">{filteredMuseums.length.toLocaleString()}</span></div>
                  </div>
                )}
                <button onClick={() => { closeAllPopups('chip'); setChipOpen(!chipOpen); }} className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all active:scale-95 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-lg border border-gray-200/50 dark:border-neutral-700/50">
                  <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{locale === 'ko' ? '박물관/미술관' : 'Museums'}</span>
                  <span className="font-bold text-xs text-purple-600 dark:text-purple-400">{filteredMuseums.length.toLocaleString()}</span>
                </button>
              </div>
            )}
            {/* Mobile: portal into nav toolbar */}
            {navToolbarReady && typeof document !== 'undefined' && document.getElementById('nav-toolbar') && createPortal(
              <div className={`lg:hidden px-3 pb-2 pt-1 ${returnFromDetail ? 'animate-fadeInUp' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {!aiOpen ? (
                      <>
                        <button
                          onClick={() => setAiOpen(true)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all active:scale-95 animate-fadeIn"
                        >
                          <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{translateCategory('ai.recommend', locale)}</span>
                        </button>
                        {activeTrip && (
                          <button onClick={() => setIsViewingActiveRoute(true)} className={`px-3 py-2 rounded-xl font-bold text-xs active:scale-95 transition-all flex items-center gap-1.5 ${activeTrip.pending ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300' : 'gradient-btn text-white'}`}>
                            <span className={activeTrip.pending ? '' : 'animate-pulse'}><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg></span>
                            {activeTrip.pending ? (locale === 'ko' ? '대기' : 'Pending') : t('plans.viewActiveRoute', locale)}
                          </button>
                        )}
                      </>
                    ) : (
                      <form onSubmit={(e) => { e.preventDefault(); handleAiRecommend(); }} className={`flex items-center gap-2 flex-1 ${aiClosing ? 'animate-fadeOutDown' : 'animate-fadeInUp'}`}>
                        <input type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder={translateCategory('ai.placeholder', locale)} className="flex-1 min-w-0 px-3 py-2 bg-gray-100 dark:bg-neutral-800 rounded-xl text-sm text-gray-800 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-700" />
                        <button type="submit" disabled={aiLoading} className="w-9 h-9 flex items-center justify-center gradient-btn text-white rounded-xl text-sm font-bold active:scale-95 disabled:opacity-50 shrink-0">{aiLoading ? '…' : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}</button>
                        <button type="button" onClick={closeAi} className="w-9 h-9 flex items-center justify-center bg-gray-100 dark:bg-neutral-800 rounded-xl text-gray-500 text-sm font-bold active:scale-95 shrink-0">✕</button>
                      </form>
                    )}
                  </div>
                  {!aiOpen && !selectedMuseum && (
                    <button onClick={() => { closeAllPopups('chip'); setChipOpen(!chipOpen); }} className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all active:scale-95 shrink-0 relative">
                      <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{locale === 'ko' ? '박물관/미술관' : 'Museums'}</span>
                      <span className="font-bold text-xs text-purple-600 dark:text-purple-400">{filteredMuseums.length.toLocaleString()}</span>
                      {chipOpen && (
                        <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-md rounded-2xl shadow-xl p-3 min-w-[160px] animate-fadeInUp">
                          <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">{locale === 'ko' ? '카테고리별' : 'By Category'}</div>
                          {(() => {
                            const counts: Record<string, number> = {};
                            filteredMuseums.forEach((m: any) => { const type = m.type || 'OTHER'; if (type === 'Aquarium') return; const translated = translateCategory(type, locale); counts[translated] = (counts[translated] || 0) + 1; });
                            return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => (<div key={name} className="flex justify-between items-center py-1"><span className="text-[11px] text-white/80">{name}</span><span className="text-[11px] font-bold text-white ml-4">{count}</span></div>));
                          })()}
                          <div className="border-t border-white/10 mt-1.5 pt-1.5 flex justify-between items-center"><span className="text-[11px] font-bold text-white/60">{locale === 'ko' ? '전체' : 'Total'}</span><span className="text-sm font-black text-white">{filteredMuseums.length.toLocaleString()}</span></div>
                        </div>
                      )}
                    </button>
                  )}
                </div>
                {/* AI Results — shown above in mobile too */}
                {aiOpen && aiResults.length > 0 && (
                  <div className="flex gap-3 overflow-x-auto pb-1 pt-1 scrollbar-hide animate-fadeInUp">
                    {aiResults.map((m: any) => (
                      <AiRecommendationCard
                        key={m.id}
                        museum={m}
                        locale={locale}
                        compact
                        onSelect={() => { handleMuseumClick(m.id); setAiOpen(false); }}
                      />
                    ))}
                  </div>
                )}
                {aiOpen && aiLoading && (<div className="flex items-center gap-2 px-2 py-2 animate-fadeInUp"><div className="w-3.5 h-3.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /><span className="text-xs text-gray-400">{translateCategory('ai.loading', locale)}</span></div>)}
              </div>,
              document.getElementById('nav-toolbar')!
            )}
          </>
        )}



        {/* Active Route Cancel Button — only when viewing route */}
        {activeTrip && isViewingActiveRoute && (
          <div className="absolute bottom-4 left-4 z-10">
            <button
              onClick={() => { setIsViewingActiveRoute(false); setReturnFromDetail(true); setTimeout(() => setReturnFromDetail(false), 500); }}
              className="bg-white/90 dark:bg-neutral-900/90 text-black dark:text-white px-4 py-2.5 rounded-2xl font-bold text-sm shadow-lg shadow-black/10 hover:bg-gray-50 dark:hover:bg-neutral-800 active:scale-95 transition-all flex items-center gap-2 backdrop-blur-md border border-gray-200 dark:border-neutral-800"
            >
              ✕ {t('modal.cancel', locale) || 'Cancel'}
            </button>
          </div>
        )}
      </div>

      {selectedMuseum && (
        <div
          className={`museum-detail-panel fixed left-0 right-0 bottom-0 top-0 lg:absolute lg:right-0 lg:left-auto lg:top-0 lg:h-full w-full lg:w-[700px] max-w-full
            lg:!bg-white/10 lg:dark:!bg-neutral-950/10
            shadow-2xl lg:shadow-none ${skipTransition ? '' : 'transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]'} z-50
            overflow-y-auto hide-scrollbar lg:pt-4 lg:px-8 lg:pb-2
            border-l border-gray-200 dark:border-neutral-800 lg:border-none
            bg-white dark:bg-neutral-950 translate-x-0 pointer-events-auto`}
          style={{
            overscrollBehavior: 'none',
            ...(isLgViewport ? {
              backgroundColor: isDarkMode ? 'rgba(10, 10, 10, 0.1)' : 'rgba(255, 255, 255, 0.1)',
              transform: detailPanelEntered ? 'translateX(0)' : 'translateX(100%)',
              transition: skipTransition ? 'none' : 'transform 420ms cubic-bezier(0.16, 1, 0.3, 1)',
            } : {}),
          }}
        >
          <div className="w-full flex flex-col pb-4 lg:pb-1">
            <MuseumDetailCard
              key={selectedMuseum.id}
              museumId={selectedMuseum.id}
              onClose={closeMuseumPanel}
              isMapContext={true}
              onSaveChange={refreshSavedIds}
            />
          </div>
        </div>
      )}

      {/* Trip activated notification toast */}
      {showTripActivatedNotif && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] animate-fadeInUp">
          <div className="gradient-btn text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-sm">
            <span className="text-lg">🎉</span>
            {locale === 'ko' ? '여행이 시작됐어요!' : 'Your trip has started!'}
          </div>
        </div>
      )}

      {/* Single instance of each popup, tied to whichever trigger is currently visible */}
      <NearbyPopup
        isOpen={nearbyOpen}
        onClose={() => setNearbyOpen(false)}
        museums={museums}
        onMuseumClick={handleMuseumClick}
        mode="popover"
        anchor="right"
        triggerRef={activeNearbyRef}
      />
      <WeatherPopup
        isOpen={weatherOpen}
        onClose={() => setWeatherOpen(false)}
        mode="popover"
        anchor="right"
        triggerRef={activeWeatherRef}
      />
    </div>
  );
}
