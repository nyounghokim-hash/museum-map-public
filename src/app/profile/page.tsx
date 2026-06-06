'use client';

import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/AppContext';
import type { Locale } from '@/lib/i18n';

type ProfileLabels = {
  title: string;
  subtitle: string;
  guestTitle: string;
  guestBody: string;
  login: string;
  account: string;
  member: string;
  admin: string;
  email: string;
  saved: string;
  plans: string;
  collections: string;
  notifications: string;
  quick: string;
  savedDesc: string;
  plansDesc: string;
  collectionsDesc: string;
  notificationsDesc: string;
  preferences: string;
  preferencesDesc: string;
  adminDesc: string;
  logout: string;
  loading: string;
};

const LABELS: Record<string, ProfileLabels> = {
  ko: {
    title: '프로필',
    subtitle: '내 취향과 여행 준비를 한곳에서 확인해요.',
    guestTitle: '로그인이 필요해요',
    guestBody: '내 픽, 여행, 컬렉션을 내 계정에 안전하게 담아두려면 로그인해 주세요.',
    login: '로그인하기',
    account: '계정',
    member: '멤버',
    admin: '관리자',
    email: '이메일',
    saved: '내 픽',
    plans: '내 여행',
    collections: '컬렉션',
    notifications: '알림',
    quick: '바로가기',
    savedDesc: '마음에 든 박물관 및 미술관',
    plansDesc: '준비 중인 여행 경로',
    collectionsDesc: '정리해 둔 장소 묶음',
    notificationsDesc: '최근 받은 소식',
    preferences: '설정',
    preferencesDesc: '언어, 테마, 계정 관리',
    adminDesc: '관리자 센터로 이동',
    logout: '로그아웃',
    loading: '불러오는 중',
  },
  en: {
    title: 'Profile',
    subtitle: 'Keep your picks, trips, and collections in one place.',
    guestTitle: 'Sign in required',
    guestBody: 'Sign in to keep your saved places, trips, and collections attached to your account.',
    login: 'Sign in',
    account: 'Account',
    member: 'Member',
    admin: 'Admin',
    email: 'Email',
    saved: 'My Picks',
    plans: 'My Trips',
    collections: 'Collections',
    notifications: 'Notifications',
    quick: 'Shortcuts',
    savedDesc: 'Museums and galleries you picked',
    plansDesc: 'Routes you are preparing',
    collectionsDesc: 'Groups of places you organized',
    notificationsDesc: 'Recent updates',
    preferences: 'Settings',
    preferencesDesc: 'Language, theme, and account',
    adminDesc: 'Open admin center',
    logout: 'Log out',
    loading: 'Loading',
  },
};

const LOCALE_ALIASES: Record<string, Partial<ProfileLabels>> = {
  ja: { title: 'プロフィール', subtitle: 'お気に入り、旅行、コレクションを一か所で確認できます。', guestTitle: 'ログインが必要です', login: 'ログイン', account: 'アカウント', saved: 'マイピック', plans: '旅行', collections: 'コレクション', notifications: '通知', preferences: '設定', logout: 'ログアウト' },
  de: { title: 'Profil', subtitle: 'Deine Favoriten, Reisen und Sammlungen an einem Ort.', guestTitle: 'Anmeldung erforderlich', login: 'Anmelden', account: 'Konto', saved: 'Meine Picks', plans: 'Reisen', collections: 'Sammlungen', notifications: 'Benachrichtigungen', preferences: 'Einstellungen', logout: 'Abmelden' },
  fr: { title: 'Profil', subtitle: 'Vos favoris, voyages et collections au même endroit.', guestTitle: 'Connexion requise', login: 'Se connecter', account: 'Compte', saved: 'Mes choix', plans: 'Voyages', collections: 'Collections', notifications: 'Notifications', preferences: 'Paramètres', logout: 'Déconnexion' },
  es: { title: 'Perfil', subtitle: 'Tus guardados, viajes y colecciones en un solo lugar.', guestTitle: 'Inicia sesión', login: 'Iniciar sesión', account: 'Cuenta', saved: 'Mis favoritos', plans: 'Viajes', collections: 'Colecciones', notifications: 'Notificaciones', preferences: 'Ajustes', logout: 'Cerrar sesión' },
  pt: { title: 'Perfil', subtitle: 'Seus favoritos, viagens e coleções em um só lugar.', guestTitle: 'Login necessário', login: 'Entrar', account: 'Conta', saved: 'Meus picks', plans: 'Viagens', collections: 'Coleções', notifications: 'Notificações', preferences: 'Configurações', logout: 'Sair' },
  'zh-CN': { title: '个人资料', subtitle: '集中查看你的收藏、旅行和合集。', guestTitle: '需要登录', login: '登录', account: '账户', saved: '我的收藏', plans: '我的旅行', collections: '合集', notifications: '通知', preferences: '设置', logout: '退出登录' },
  'zh-TW': { title: '個人資料', subtitle: '集中查看你的收藏、旅行和合集。', guestTitle: '需要登入', login: '登入', account: '帳號', saved: '我的收藏', plans: '我的旅行', collections: '合集', notifications: '通知', preferences: '設定', logout: '登出' },
  da: { title: 'Profil', subtitle: 'Dine favoritter, rejser og samlinger samlet ét sted.', guestTitle: 'Login kræves', login: 'Log ind', account: 'Konto', saved: 'Mine valg', plans: 'Rejser', collections: 'Samlinger', notifications: 'Notifikationer', preferences: 'Indstillinger', logout: 'Log ud' },
  fi: { title: 'Profiili', subtitle: 'Suosikit, matkat ja kokoelmat yhdessä paikassa.', guestTitle: 'Kirjautuminen vaaditaan', login: 'Kirjaudu', account: 'Tili', saved: 'Omat valinnat', plans: 'Matkat', collections: 'Kokoelmat', notifications: 'Ilmoitukset', preferences: 'Asetukset', logout: 'Kirjaudu ulos' },
  sv: { title: 'Profil', subtitle: 'Dina val, resor och samlingar på ett ställe.', guestTitle: 'Inloggning krävs', login: 'Logga in', account: 'Konto', saved: 'Mina val', plans: 'Resor', collections: 'Samlingar', notifications: 'Aviseringar', preferences: 'Inställningar', logout: 'Logga ut' },
  et: { title: 'Profiil', subtitle: 'Sinu valikud, reisid ja kogud ühes kohas.', guestTitle: 'Sisselogimine on vajalik', login: 'Logi sisse', account: 'Konto', saved: 'Minu valikud', plans: 'Reisid', collections: 'Kogud', notifications: 'Teavitused', preferences: 'Seaded', logout: 'Logi välja' },
};

function labelsFor(locale: Locale): ProfileLabels {
  return { ...LABELS.en, ...LOCALE_ALIASES[locale], ...(LABELS[locale] || {}) };
}

function readDataCount(payload: any): number {
  const data = payload?.data ?? payload;
  return Array.isArray(data) ? data.length : 0;
}

export default function ProfilePage() {
  const { locale } = useApp();
  const { data: session, status } = useSession();
  const labels = labelsFor(locale);
  const [counts, setCounts] = useState({ saved: 0, plans: 0, collections: 0, notifications: 0 });
  const [loadingCounts, setLoadingCounts] = useState(false);
  const isGuest = status !== 'authenticated' || session?.user?.name?.startsWith('guest_');
  const isAdmin = (session?.user as any)?.role === 'ADMIN';
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'Museum Map';
  const initial = useMemo(() => (userName || 'U').trim().charAt(0).toUpperCase(), [userName]);

  useEffect(() => {
    if (isGuest) return;
    let mounted = true;
    setLoadingCounts(true);
    Promise.all([
      fetch('/api/me/saves').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/plans').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/collections').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/notifications').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([saved, plans, collections, notifications]) => {
      if (!mounted) return;
      setCounts({
        saved: readDataCount(saved),
        plans: readDataCount(plans),
        collections: readDataCount(collections),
        notifications: readDataCount(notifications),
      });
    }).finally(() => {
      if (mounted) setLoadingCounts(false);
    });
    return () => { mounted = false; };
  }, [isGuest]);

  if (status === 'loading') {
    return (
      <div className="mm-profile-page2 mm-library-page2 no-back-swipe mx-auto w-full max-w-[760px] px-5 pb-32 pt-[max(28px,env(safe-area-inset-top,0px))] lg:pb-12">
        <div className="mm-profile-hero2 p-6">
          <div className="mm-skel-line h-5 w-24 mb-4 opacity-50" />
          <div className="mm-skel-line h-10 w-52 mb-3 opacity-60" />
          <div className="mm-skel-line w-72 opacity-45" />
        </div>
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="mm-profile-page2 mm-library-page2 no-back-swipe mx-auto w-full max-w-[760px] px-5 pb-32 pt-[max(28px,env(safe-area-inset-top,0px))] lg:pb-12">
        <section className="mm-profile-hero2 p-6 sm:p-8">
          <div className="mm-gallery-kicker mb-4">{labels.account}</div>
          <h1>{labels.guestTitle}</h1>
          <p>{labels.guestBody}</p>
          <button type="button" onClick={() => signIn('google', { callbackUrl: '/profile' })} className="mm-profile-primary-btn mt-6">
            {labels.login}
          </button>
        </section>
      </div>
    );
  }

  const statCards = [
    { href: '/saved', label: labels.saved, value: counts.saved, desc: labels.savedDesc },
    { href: '/plans', label: labels.plans, value: counts.plans, desc: labels.plansDesc },
    { href: '/collections', label: labels.collections, value: counts.collections, desc: labels.collectionsDesc },
    { href: '/notifications', label: labels.notifications, value: counts.notifications, desc: labels.notificationsDesc },
  ];

  return (
    <div className="mm-profile-page2 mm-library-page2 no-back-swipe mx-auto w-full max-w-[760px] px-5 pb-32 pt-[max(28px,env(safe-area-inset-top,0px))] lg:pb-12">
      <section className="mm-profile-hero2 p-6 sm:p-8">
        <div className="mm-gallery-kicker mb-4">{labels.title}</div>
        <div className="flex items-end justify-between gap-5">
          <div className="min-w-0">
            <h1>{userName}</h1>
            <p>{labels.subtitle}</p>
          </div>
          <div className="mm-profile-avatar2">
            {session?.user?.image ? <img src={session.user.image} alt="" /> : <span>{initial}</span>}
          </div>
        </div>
        <div className="mm-profile-account-line mt-6">
          <span>{isAdmin ? labels.admin : labels.member}</span>
          {session?.user?.email && <strong>{session.user.email}</strong>}
        </div>
      </section>

      <section className="mt-6">
        <div className="mm-section-heading">
          <h2>{labels.quick}</h2>
          <span>{loadingCounts ? labels.loading : labels.account}</span>
        </div>
        <div className="mm-profile-stat-grid2">
          {statCards.map(card => (
            <Link key={card.href} href={card.href} className="mm-profile-stat-card2">
              <span>{card.label}</span>
              <strong>{loadingCounts ? '-' : card.value.toLocaleString()}</strong>
              <p>{card.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="mm-profile-action-list2">
          {isAdmin && (
            <Link href="/admin" className="mm-profile-action-row2">
              <span>
                <strong>{labels.admin}</strong>
                <em>{labels.adminDesc}</em>
              </span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </Link>
          )}
          <Link href="/settings" className="mm-profile-action-row2">
            <span>
              <strong>{labels.preferences}</strong>
              <em>{labels.preferencesDesc}</em>
            </span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </Link>
          <button type="button" onClick={() => signOut({ callbackUrl: '/' })} className="mm-profile-action-row2 is-danger">
            <span>
              <strong>{labels.logout}</strong>
              <em>{session?.user?.email || labels.account}</em>
            </span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m-3-3h8.25m0 0l-3-3m3 3l-3 3" /></svg>
          </button>
        </div>
      </section>
    </div>
  );
}
