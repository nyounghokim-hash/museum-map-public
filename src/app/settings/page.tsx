'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import type { ReactNode } from 'react';
import { useApp } from '@/components/AppContext';
import { LOCALE_NAMES, type Locale } from '@/lib/i18n';

const LABELS: Record<string, {
  title: string;
  general: string;
  language: string;
  theme: string;
  light: string;
  dark: string;
  map: string;
  location: string;
  nearby: string;
  weather: string;
  account: string;
  profile: string;
  saves: string;
  alerts: string;
  logout: string;
  version: string;
}> = {
  ko: {
    title: '설정',
    general: '일반',
    language: '언어',
    theme: '테마',
    light: '라이트',
    dark: '다크',
    map: '지도 설정',
    location: '현위치 추적',
    nearby: '주변 박물관 알림',
    weather: '날씨 표시',
    account: '계정',
    profile: '프로필 관리',
    saves: '내 픽 관리',
    alerts: '알림 설정',
    logout: '로그아웃',
    version: '버전 2.0.0',
  },
  en: {
    title: 'Settings',
    general: 'General',
    language: 'Language',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    map: 'Map Settings',
    location: 'Location Tracking',
    nearby: 'Nearby Museum Alerts',
    weather: 'Show Weather',
    account: 'Account',
    profile: 'Profile',
    saves: 'Saved Space',
    alerts: 'Notifications',
    logout: 'Logout',
    version: 'Version 2.0.0',
  },
  ja: { title: '設定', general: '一般', language: '言語', theme: 'テーマ', light: 'ライト', dark: 'ダーク', map: '地図設定', location: '現在地の追跡', nearby: '周辺ミュージアム通知', weather: '天気を表示', account: 'アカウント', profile: 'プロフィール', saves: '保存済み', alerts: '通知設定', logout: 'ログアウト', version: 'バージョン 2.0.0' },
  de: { title: 'Einstellungen', general: 'Allgemein', language: 'Sprache', theme: 'Design', light: 'Hell', dark: 'Dunkel', map: 'Karteneinstellungen', location: 'Standortverfolgung', nearby: 'Museen in der Nähe', weather: 'Wetter anzeigen', account: 'Konto', profile: 'Profil', saves: 'Gespeicherte Orte', alerts: 'Benachrichtigungen', logout: 'Abmelden', version: 'Version 2.0.0' },
  fr: { title: 'Paramètres', general: 'Général', language: 'Langue', theme: 'Thème', light: 'Clair', dark: 'Sombre', map: 'Paramètres de carte', location: 'Suivi de position', nearby: 'Alertes musées proches', weather: 'Afficher la météo', account: 'Compte', profile: 'Profil', saves: 'Espaces enregistrés', alerts: 'Notifications', logout: 'Déconnexion', version: 'Version 2.0.0' },
  es: { title: 'Ajustes', general: 'General', language: 'Idioma', theme: 'Tema', light: 'Claro', dark: 'Oscuro', map: 'Ajustes del mapa', location: 'Seguimiento de ubicación', nearby: 'Alertas de museos cercanos', weather: 'Mostrar clima', account: 'Cuenta', profile: 'Perfil', saves: 'Guardados', alerts: 'Notificaciones', logout: 'Cerrar sesión', version: 'Versión 2.0.0' },
  pt: { title: 'Configurações', general: 'Geral', language: 'Idioma', theme: 'Tema', light: 'Claro', dark: 'Escuro', map: 'Configurações do mapa', location: 'Rastreamento de localização', nearby: 'Alertas de museus próximos', weather: 'Mostrar clima', account: 'Conta', profile: 'Perfil', saves: 'Salvos', alerts: 'Notificações', logout: 'Sair', version: 'Versão 2.0.0' },
  'zh-CN': { title: '设置', general: '通用', language: '语言', theme: '主题', light: '浅色', dark: '深色', map: '地图设置', location: '当前位置追踪', nearby: '附近博物馆提醒', weather: '显示天气', account: '账户', profile: '个人资料', saves: '已保存', alerts: '通知设置', logout: '退出登录', version: '版本 2.0.0' },
  'zh-TW': { title: '設定', general: '一般', language: '語言', theme: '主題', light: '淺色', dark: '深色', map: '地圖設定', location: '目前位置追蹤', nearby: '附近博物館提醒', weather: '顯示天氣', account: '帳號', profile: '個人資料', saves: '已儲存', alerts: '通知設定', logout: '登出', version: '版本 2.0.0' },
  da: { title: 'Indstillinger', general: 'Generelt', language: 'Sprog', theme: 'Tema', light: 'Lys', dark: 'Mørk', map: 'Kortindstillinger', location: 'Positionssporing', nearby: 'Museer i nærheden', weather: 'Vis vejr', account: 'Konto', profile: 'Profil', saves: 'Gemte steder', alerts: 'Notifikationer', logout: 'Log ud', version: 'Version 2.0.0' },
  fi: { title: 'Asetukset', general: 'Yleiset', language: 'Kieli', theme: 'Teema', light: 'Vaalea', dark: 'Tumma', map: 'Kartta-asetukset', location: 'Sijainnin seuranta', nearby: 'Lähimuseoilmoitukset', weather: 'Näytä sää', account: 'Tili', profile: 'Profiili', saves: 'Tallennetut', alerts: 'Ilmoitukset', logout: 'Kirjaudu ulos', version: 'Versio 2.0.0' },
  sv: { title: 'Inställningar', general: 'Allmänt', language: 'Språk', theme: 'Tema', light: 'Ljust', dark: 'Mörkt', map: 'Kartinställningar', location: 'Platsspårning', nearby: 'Museer i närheten', weather: 'Visa väder', account: 'Konto', profile: 'Profil', saves: 'Sparade', alerts: 'Aviseringar', logout: 'Logga ut', version: 'Version 2.0.0' },
  et: { title: 'Seaded', general: 'Üldine', language: 'Keel', theme: 'Teema', light: 'Hele', dark: 'Tume', map: 'Kaardi seaded', location: 'Asukoha jälgimine', nearby: 'Lähedal muuseumide teavitused', weather: 'Kuva ilm', account: 'Konto', profile: 'Profiil', saves: 'Salvestatud', alerts: 'Teavitused', logout: 'Logi välja', version: 'Versioon 2.0.0' },
};

function Icon({ children }: { children: ReactNode }) {
  return <span className="flex h-7 w-7 shrink-0 items-center justify-center text-slate-500 dark:text-neutral-400">{children}</span>;
}

function Chevron() {
  return (
    <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function Toggle({ on }: { on: boolean }) {
  return <span className={`mm-settings-toggle ${on ? 'is-on' : ''}`}><span /></span>;
}

function SettingsRow({ icon, label, value, href, onClick }: { icon: ReactNode; label: string; value?: string; href?: string; onClick?: () => void }) {
  const inner = (
    <>
      <Icon>{icon}</Icon>
      <span className="min-w-0 flex-1 text-[15px] font-semibold text-slate-700 dark:text-neutral-200">{label}</span>
      {value && <span className="text-sm font-medium text-slate-400 dark:text-neutral-500">{value}</span>}
      <Chevron />
    </>
  );
  if (href) return <Link href={href} className="mm-settings-row">{inner}</Link>;
  return <button type="button" onClick={onClick} className="mm-settings-row w-full text-left">{inner}</button>;
}

export default function SettingsPage() {
  const { locale, setLocale, darkMode, setDarkMode } = useApp();
  const { data: session } = useSession();
  const labels = LABELS[locale] || LABELS.en;
  const isGuest = !session || session.user?.name?.startsWith('guest_');

  return (
    <div className="mm-settings-page2 no-back-swipe mx-auto w-full max-w-[640px] px-5 pb-32 pt-[max(28px,env(safe-area-inset-top,0px))] lg:pb-12">
      <h1 className="mm-settings-title mb-12 text-center text-2xl text-slate-900 dark:text-white">{labels.title}</h1>

      <section className="mb-9">
        <h2 className="mb-3 px-2 text-[15px] font-semibold text-slate-500 dark:text-neutral-400">{labels.general}</h2>
        <div className="mm-settings-card">
          <div className="mm-settings-row">
            <Icon><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18m0 18a9 9 0 010-18m0 18c2.2-2.2 3.3-5.2 3.3-9S14.2 5.2 12 3m0 18c-2.2-2.2-3.3-5.2-3.3-9S9.8 5.2 12 3M3.6 9h16.8M3.6 15h16.8" /></svg></Icon>
            <label className="min-w-0 flex-1 text-[15px] font-semibold text-slate-700 dark:text-neutral-200" htmlFor="locale-select">{labels.language}</label>
            <select id="locale-select" value={locale} onChange={(e) => setLocale(e.target.value as Locale)} className="max-w-[130px] bg-transparent text-right text-sm font-medium text-slate-400 outline-none dark:text-neutral-500">
              {(Object.keys(LOCALE_NAMES) as Locale[]).map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
            </select>
            <Chevron />
          </div>
          <div className="mm-settings-row">
            <Icon><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.12a3 3 0 013.35-3.35l1.2.24a3 3 0 003.43-3.43l-.24-1.2a3 3 0 013.35-3.35A9 9 0 1112 3" /></svg></Icon>
            <span className="min-w-0 flex-1 text-[15px] font-semibold text-slate-700 dark:text-neutral-200">{labels.theme}</span>
            <div className="flex gap-2">
              <button onClick={() => setDarkMode(false)} className={`rounded-full px-4 py-2 text-sm font-semibold ${!darkMode ? 'bg-blue-700 text-white shadow-lg shadow-blue-700/20' : 'bg-white/60 text-slate-500 ring-1 ring-slate-200 dark:bg-neutral-900 dark:text-neutral-400 dark:ring-neutral-800'}`}>{labels.light}</button>
              <button onClick={() => setDarkMode(true)} className={`rounded-full px-4 py-2 text-sm font-semibold ${darkMode ? 'bg-blue-700 text-white shadow-lg shadow-blue-700/20' : 'bg-white/60 text-slate-500 ring-1 ring-slate-200 dark:bg-neutral-900 dark:text-neutral-400 dark:ring-neutral-800'}`}>{labels.dark}</button>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-9">
        <h2 className="mb-3 px-2 text-[15px] font-semibold text-slate-500 dark:text-neutral-400">{labels.map}</h2>
        <div className="mm-settings-card">
          {([
            [labels.location, true],
            [labels.nearby, true],
            [labels.weather, true],
          ] as Array<[string, boolean]>).map(([label, on]) => (
            <div key={String(label)} className="mm-settings-row">
              <Icon><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3m0 14v3m10-10h-3M5 12H2m16.95-6.95l-2.12 2.12M7.17 16.83l-2.12 2.12m0-13.9l2.12 2.12m9.66 9.66l2.12 2.12" /></svg></Icon>
              <span className="min-w-0 flex-1 text-[15px] font-semibold text-slate-700 dark:text-neutral-200">{String(label)}</span>
              <Toggle on={Boolean(on)} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 px-2 text-[15px] font-semibold text-slate-500 dark:text-neutral-400">{labels.account}</h2>
        <div className="mm-settings-card">
          <SettingsRow href="/profile" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0" /></svg>} label={labels.profile} value={isGuest ? '' : session?.user?.name || ''} />
          <SettingsRow href="/saved" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M5 7.5A2.5 2.5 0 017.5 5h9A2.5 2.5 0 0119 7.5v14l-7-4-7 4v-14z" /></svg>} label={labels.saves} />
          <SettingsRow href="/notifications" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.85 18.25a2.85 2.85 0 01-5.7 0M18 10.5a6 6 0 10-12 0c0 3-1.5 4.5-2 5.5h16c-.5-1-2-2.5-2-5.5z" /></svg>} label={labels.alerts} />
          <button type="button" onClick={() => signOut({ callbackUrl: '/' })} className="mm-settings-row w-full text-left">
            <Icon><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m-3-3h8.25m0 0l-3-3m3 3l-3 3" /></svg></Icon>
            <span className="min-w-0 flex-1 text-[15px] font-semibold text-slate-700 dark:text-neutral-200">{labels.logout}</span>
          </button>
        </div>
      </section>

      <p className="mt-8 text-center text-sm font-medium text-slate-300 dark:text-neutral-700">{labels.version}</p>
    </div>
  );
}
