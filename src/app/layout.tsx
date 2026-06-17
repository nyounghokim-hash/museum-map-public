import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Permanent_Marker } from 'next/font/google'
import './globals.css'
import NavHeader from '@/components/layout/NavHeader'
import MobileBottomNav from '@/components/layout/MobileBottomNav'
import FloatingBackButton from '@/components/layout/FloatingBackButton'
import MainContent from '@/components/layout/MainContent'
import { AppProvider } from '@/components/AppContext'
import { ModalProvider } from '@/components/ui/Modal'
import { GoogleAnalytics } from '@next/third-parties/google'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fbff' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
}

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const acceptLanguage = headersList.get('accept-language') || '';
  const isKorean = acceptLanguage.toLowerCase().includes('ko');

  const title = isKorean ? 'Museum Map - 나만의 미술관/박물관 여행 계획' : 'Museum Map - Plan Your Art & History Journey';
  const description = isKorean
    ? '전 세계 주요 현대미술관과 박물관을 탐험하고, 나만의 특별한 여행 경로를 만들어보세요.'
    : 'Discover contemporary art museums and historical museums around the globe, and create your personalized itinerary.';

  return {
    title,
    description,
    keywords: isKorean
      ? ['미술관', '박물관', '여행', '현대미술', '전시회', '뮤지엄맵', '아트투어', '미술관 지도', '박물관 추천', '숨은 미술관', '세계 박물관', '미술관 여행코스', '뮤지엄 투어', '겟어 뮤지엄']
      : ['museum', 'art gallery', 'travel', 'contemporary art', 'exhibitions', 'museum map', 'art tour', 'itinerary', 'best museums', 'hidden gem museums', 'world museums', 'museum guide', 'art travel planner'],
    icons: {
      icon: [
        { url: '/icon.svg', type: 'image/svg+xml' },
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
        { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      ],
      apple: [
        { url: '/apple-icon-180x180.png', sizes: '180x180' },
        { url: '/apple-icon-152x152.png', sizes: '152x152' },
        { url: '/apple-icon-144x144.png', sizes: '144x144' },
        { url: '/apple-icon-120x120.png', sizes: '120x120' },
      ],
    },
    manifest: '/manifest.json',
    metadataBase: new URL('https://museummap.app'),
    alternates: {
      canonical: '/',
      languages: {
        'ko-KR': '/',
        'en-US': '/',
        'ja-JP': '/',
        'zh-CN': '/',
        'zh-TW': '/',
        'de-DE': '/',
        'fr-FR': '/',
        'es-ES': '/',
        'pt-PT': '/',
        'da-DK': '/',
        'fi-FI': '/',
        'sv-SE': '/',
        'et-EE': '/',
      },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large' as const,
        'max-snippet': -1,
      },
    },
    openGraph: {
      title,
      description,
      siteName: 'Museum Map',
      images: [
        {
          url: '/og-image.png?v=3',
          width: 1200,
          height: 630,
          alt: 'Museum Map Preview',
        },
      ],
      locale: isKorean ? 'ko_KR' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-image.png?v=3'],
    },
  };
}

import AuthProvider from '@/components/AuthProvider'
import SplashScreen from '@/components/ui/SplashScreen'
import CookieConsent from '@/components/ui/CookieConsent'
import MarketingConsentPrompt from '@/components/MarketingConsentPrompt'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import type { Locale } from '@/lib/i18n'

const SUPPORTED_LAYOUT_LOCALES: Locale[] = ['en', 'ko', 'ja', 'de', 'fr', 'es', 'pt', 'zh-CN', 'zh-TW', 'da', 'fi', 'sv', 'et'];

const brandDisplayFont = Permanent_Marker({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-brand-display',
  display: 'swap',
});

function isSupportedLayoutLocale(value: string | undefined | null): value is Locale {
  return !!value && SUPPORTED_LAYOUT_LOCALES.includes(value as Locale);
}

function getCookieLocale(cookieHeader: string | null): Locale | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)mm_locale=([^;]+)/);
  if (!match) return null;
  const value = decodeURIComponent(match[1]);
  return isSupportedLayoutLocale(value) ? value : null;
}

function getHeaderLocale(acceptLang: string): Locale {
  const lower = acceptLang.toLowerCase();
  return lower.includes('ko') ? 'ko'
    : lower.includes('ja') ? 'ja'
      : lower.includes('zh-cn') || lower.includes('zh-hans') ? 'zh-CN'
        : lower.includes('zh-tw') || lower.includes('zh-hant') || lower.includes('zh') ? 'zh-TW'
          : lower.includes('de') ? 'de'
            : lower.includes('fr') ? 'fr'
              : lower.includes('es') ? 'es'
                : lower.includes('pt') ? 'pt'
                  : lower.includes('da') ? 'da'
                    : lower.includes('fi') ? 'fi'
                      : lower.includes('sv') ? 'sv'
                        : lower.includes('et') ? 'et'
                          : 'en';
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers();
  const acceptLang = headersList.get('accept-language') || '';
  const lang = getCookieLocale(headersList.get('cookie')) || getHeaderLocale(acceptLang);
  return (
    <html lang={lang} className={brandDisplayFont.variable} suppressHydrationWarning>
      <head>
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f8fbff" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#020617" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://cdn.jsdelivr.net/gh/sunn-us/SUIT/fonts/static/woff2/SUIT.css"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style
          id="mm-force-sans"
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --mm-force-sans: "SUIT", "Noto Sans KR", "Noto Sans JP", "Noto Sans SC", "Noto Sans TC", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Segoe UI", sans-serif;
              }
              html, body,
              body *:not(svg):not(path):not(circle):not(rect):not(line):not(polyline):not(polygon):not(.mm-brand-word):not(.splash-title):not(.mm-login-brand-title) {
                font-family: var(--mm-force-sans) !important;
              }
              button, input, select, textarea, optgroup, option {
                font-family: var(--mm-force-sans) !important;
              }
            `,
          }}
        />
        <style
          id="mm-critical-mobile-2"
          dangerouslySetInnerHTML={{
            __html: `
              @media (max-width: 767px) {
                .mm-map-home-header {
                  display: none !important;
                }
                main.mm-map-shell {
                  position: relative !important;
                  display: flex !important;
                  width: 100vw !important;
                  max-width: 100vw !important;
                  height: var(--mm-viewport-height, 100dvh) !important;
                  min-height: 320px !important;
                  overflow: hidden !important;
                  padding-bottom: 0 !important;
                  background: #eef6ff !important;
                }
                .mm-map-shell > .relative,
                .mm-map-shell .maplibregl-map,
                .mm-map-shell canvas {
                  min-width: 0 !important;
                  width: 100% !important;
                  height: 100% !important;
                }
                .mm-map2-top {
                  position: absolute !important;
                  left: 0 !important;
                  right: 0 !important;
                  top: max(12px, env(safe-area-inset-top, 0px)) !important;
                  z-index: 80 !important;
                  padding: 0 18px !important;
                  pointer-events: none !important;
                }
                .mm-map2-search-row,
                .mm-map2-pill-row {
                  display: flex !important;
                  align-items: center !important;
                  gap: 10px !important;
                  width: 100% !important;
                }
                .mm-map2-search {
                  flex: 1 1 auto !important;
                  min-width: 0 !important;
                  height: 58px !important;
                  display: flex !important;
                  align-items: center !important;
                  gap: 10px !important;
                  padding: 0 18px !important;
                  border-radius: 999px !important;
                  color: #0f172a !important;
                  background: rgba(255,255,255,.96) !important;
                  border: 1px solid rgba(226,232,240,.8) !important;
                  box-shadow: 0 12px 30px rgba(15,23,42,.14), inset 0 1px 0 rgba(255,255,255,.9) !important;
                  backdrop-filter: blur(18px) saturate(160%) !important;
                  -webkit-backdrop-filter: blur(18px) saturate(160%) !important;
                  pointer-events: auto !important;
                }
                .mm-map2-search input {
                  flex: 1 1 auto !important;
                  min-width: 0 !important;
                  display: block !important;
                  border: 0 !important;
                  outline: 0 !important;
                  background: transparent !important;
                  color: #0f172a !important;
                  font-size: 15px !important;
                  font-weight: 800 !important;
                  line-height: 1 !important;
                }
                .mm-map2-search input::placeholder {
                  color: #94a3b8 !important;
                }
                .mm-map2-search button,
                .mm-map2-icon-pill,
                .mm-map2-tool-pill,
                .mm-map2-float-btn {
                  display: inline-flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                  border: 0 !important;
                  outline: 0 !important;
                  text-decoration: none !important;
                  pointer-events: auto !important;
                }
                .mm-map2-icon-pill {
                  flex: 0 0 54px !important;
                  width: 54px !important;
                  height: 54px !important;
                  border-radius: 999px !important;
                  color: #334155 !important;
                  background: rgba(255,255,255,.96) !important;
                  box-shadow: 0 12px 30px rgba(15,23,42,.14), inset 0 1px 0 rgba(255,255,255,.9) !important;
                }
                .mm-map2-pill-row {
                  display: grid !important;
                  grid-template-columns: 54px !important;
                  position: absolute !important;
                  top: 74px !important;
                  right: 18px !important;
                  width: 54px !important;
                  align-items: start !important;
                  gap: 8px !important;
                  margin-top: 0 !important;
                  justify-content: stretch !important;
                  overflow: visible !important;
                  padding-bottom: 8px !important;
                  scrollbar-width: none !important;
                }
                .mm-map2-trip-slot {
                  min-width: 0 !important;
                  justify-self: start !important;
                  pointer-events: auto !important;
                }
                .mm-map2-tool-stack {
                  display: flex !important;
                  flex-direction: column !important;
                  align-items: flex-end !important;
                  justify-self: end !important;
                  gap: 8px !important;
                  pointer-events: auto !important;
                }
                .mm-map2-top.is-left-handed .mm-map2-pill-row {
                  left: 18px !important;
                  right: auto !important;
                }
                .mm-map2-top.is-left-handed .mm-map2-tool-stack {
                  align-items: flex-start !important;
                  justify-self: start !important;
                }
                .mm-map2-top.is-left-handed .mm-map2-new-museums-mobile {
                  left: auto !important;
                  right: 18px !important;
                  flex-direction: row-reverse !important;
                }
                .mm-map2-top.is-left-handed .mm-map2-new-museums-popover {
                  left: auto !important;
                  right: 0 !important;
                }
                .mm-map2-pill-row::-webkit-scrollbar {
                  display: none !important;
                }
                .mm-map2-tool-pill {
                  flex: 0 0 auto !important;
                  height: 46px !important;
                  gap: 7px !important;
                  padding: 0 15px !important;
                  border-radius: 999px !important;
                  color: #0f172a !important;
                  background: rgba(255,255,255,.96) !important;
                  box-shadow: 0 12px 28px rgba(15,23,42,.13), inset 0 1px 0 rgba(255,255,255,.9) !important;
                  font-size: 14px !important;
                  font-weight: 850 !important;
                  white-space: nowrap !important;
                }
                .mm-map2-tool-stack .mm-map2-tool-pill {
                  width: 54px !important;
                  min-width: 54px !important;
                  height: 54px !important;
                  padding: 0 !important;
                  border-radius: 999px !important;
                  box-shadow: 0 4px 10px rgba(15,23,42,.06) !important;
                }
                .mm-map2-trip-pill {
                  width: auto !important;
                  min-width: 0 !important;
                  height: 42px !important;
                  padding: 0 14px !important;
                  font-size: 13px !important;
                  font-weight: 520 !important;
                  box-shadow: 0 4px 10px rgba(15,23,42,.05) !important;
                }
                .mm-map2-trip-pill.is-on-trip {
                  background: #2563eb !important;
                  border-color: #2563eb !important;
                  color: #fff !important;
                }
                .mm-map2-tool-pill strong {
                  color: #2563eb !important;
                  font-weight: 850 !important;
                }
                .mm-map2-tool-pill-icon {
                  width: 46px !important;
                  padding: 0 !important;
                }
                .mm-map2-tool-pill-icon svg {
                  color: #2563eb !important;
                }
                .mm-map2-icon-pill.is-active,
                .mm-map2-tool-pill.is-active {
                  color: #fff !important;
                  background: #2563eb !important;
                }
                .mm-map2-tool-pill.is-active strong {
                  color: currentColor !important;
                }
                .mm-map2-floating-list,
                .mm-map2-category-menu {
                  position: absolute !important;
                  z-index: 120 !important;
                  overflow: hidden !important;
                  border-radius: 24px !important;
                  background: rgba(255,255,255,.98) !important;
                  border: 1px solid rgba(226,232,240,.82) !important;
                  box-shadow: 0 26px 60px rgba(15,23,42,.18) !important;
                  pointer-events: auto !important;
                }
                .mm-map2-category-menu {
                  left: auto !important;
                  right: 80px !important;
                  width: min(300px, calc(100vw - 104px)) !important;
                  max-width: calc(100vw - 104px) !important;
                }
                .mm-map2-category-menu.is-left-handed {
                  left: 80px !important;
                  right: auto !important;
                  width: min(300px, calc(100vw - 104px)) !important;
                  max-width: calc(100vw - 104px) !important;
                }
                .mm-map2-floating-list {
                  top: calc(max(12px, env(safe-area-inset-top, 0px)) + 61px) !important;
                  z-index: 132 !important;
                  max-height: 290px !important;
                  overflow-y: auto !important;
                }
                .mm-map2-search-result {
                  color: #0f172a !important;
                  border-color: rgba(226,232,240,.72) !important;
                }
                .mm-map2-search-result:hover {
                  background: #eff6ff !important;
                }
                .mm-map2-search-result-title {
                  color: #0f172a !important;
                  font-size: 15px !important;
                  font-weight: 650 !important;
                  line-height: 1.25 !important;
                }
                .mm-map2-search-result-subtitle {
                  margin-top: 4px !important;
                  color: #64748b !important;
                  font-size: 12px !important;
                  font-weight: 600 !important;
                  line-height: 1.25 !important;
                }
                .mm-map2-category-menu {
                  top: calc(max(12px, env(safe-area-inset-top, 0px)) + 124px) !important;
                  display: flex !important;
                  flex-direction: column !important;
                  gap: 0 !important;
                  padding: 0 !important;
                  max-height: min(360px, calc(100dvh - 250px)) !important;
                  overflow: hidden !important;
                }
                .mm-map2-category-menu-head {
                  display: flex !important;
                  align-items: center !important;
                  justify-content: space-between !important;
                  gap: 10px !important;
                  padding: 12px 16px !important;
                  border-bottom: 1px solid rgba(226,232,240,.78) !important;
                }
                .mm-map2-category-menu-grid {
                  display: grid !important;
                  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                  gap: 8px !important;
                  padding: 12px !important;
                  max-height: min(306px, calc(100dvh - 306px)) !important;
                  overflow-y: auto !important;
                }
                .mm-map2-category-menu-grid button {
                  min-width: 0 !important;
                  width: 100% !important;
                  min-height: 46px !important;
                  padding: 12px 11px !important;
                  border-radius: 16px !important;
                  color: #475569 !important;
                  background: #f8fafc !important;
                  font-size: 12px !important;
                  font-weight: 600 !important;
                  text-align: left !important;
                  word-break: keep-all !important;
                }
                .mm-map2-category-menu-grid button.is-active {
                  color: #fff !important;
                  background: #2563eb !important;
                }
                .mm-map2-float-actions {
                  position: absolute !important;
                  left: 20px !important;
                  right: 20px !important;
                  bottom: 222px !important;
                  z-index: 62 !important;
                  display: flex !important;
                  align-items: center !important;
                  justify-content: flex-end !important;
                  pointer-events: none !important;
                }
                .mm-map2-float-btn {
                  width: 54px !important;
                  height: 54px !important;
                  border-radius: 999px !important;
                  color: #334155 !important;
                  background: rgba(255,255,255,.96) !important;
                  box-shadow: 0 16px 34px rgba(15,23,42,.16), inset 0 1px 0 rgba(255,255,255,.9) !important;
                }
                .mm-map2-side-layer {
                  position: fixed !important;
                  inset: 0 !important;
                  z-index: 130 !important;
                  pointer-events: auto !important;
                }
                .mm-map2-side-backdrop {
                  position: absolute !important;
                  inset: 0 !important;
                  background: rgba(15,23,42,.22) !important;
                  border: 0 !important;
                }
                .mm-map2-side-menu {
                  position: absolute !important;
                  top: max(10px, env(safe-area-inset-top, 0px)) !important;
                  right: 12px !important;
                  width: min(324px, calc(100vw - 24px)) !important;
                  max-height: calc(100dvh - max(10px, env(safe-area-inset-top, 0px)) - 112px) !important;
                  overflow-y: auto !important;
                  padding: 16px !important;
                  border-radius: 28px !important;
                  color: #0f172a !important;
                  background: rgba(255,255,255,.98) !important;
                  border: 1px solid rgba(226,232,240,.86) !important;
                  box-shadow: 0 30px 80px rgba(15,23,42,.24), inset 0 1px 0 rgba(255,255,255,.94) !important;
                  backdrop-filter: blur(20px) saturate(170%) !important;
                  -webkit-backdrop-filter: blur(20px) saturate(170%) !important;
                }
                .mm-map2-side-actions,
                .mm-map2-side-grid {
                  display: grid !important;
                  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                  gap: 8px !important;
                }
                .mm-map2-side-actions {
                  margin-bottom: 16px !important;
                }
                .mm-map2-side-grid {
                  margin-top: 8px !important;
                }
                .mm-map2-side-grid button.is-active {
                  color: #fff !important;
                  background: #2563eb !important;
                }
                .mm-map2-place-sheet {
                  position: absolute !important;
                  left: 0 !important;
                  right: 0 !important;
                  bottom: calc(78px + env(safe-area-inset-bottom, 0px)) !important;
                  z-index: 70 !important;
                  min-height: 124px !important;
                  padding: 10px 18px 16px !important;
                  border-radius: 30px 30px 0 0 !important;
                  color: #0f172a !important;
                  background: rgba(255,255,255,.97) !important;
                  border-top: 1px solid rgba(226,232,240,.78) !important;
                  box-shadow: 0 -22px 56px rgba(15,23,42,.14), inset 0 1px 0 rgba(255,255,255,.95) !important;
                  pointer-events: auto !important;
                }
                .mm-map2-place-sheet.is-expanded {
                  min-height: min(520px, calc(100dvh - 158px)) !important;
                }
                .mm-map2-sheet-handle {
                  display: flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                  width: 100% !important;
                  height: 18px !important;
                }
                .mm-map2-sheet-handle span {
                  display: block !important;
                  width: 44px !important;
                  height: 5px !important;
                  border-radius: 999px !important;
                  background: #cbd5e1 !important;
                }
                .mm-map2-preview-card {
                  width: 100% !important;
                  display: flex !important;
                  align-items: center !important;
                  gap: 14px !important;
                  padding: 10px 0 2px !important;
                  text-align: left !important;
                  color: #0f172a !important;
                }
                .mm-map2-preview-image,
                .mm-map2-list-image {
                  flex: 0 0 auto !important;
                  overflow: hidden !important;
                  background: #eaf2ff !important;
                }
                .mm-map2-preview-image {
                  width: 112px !important;
                  height: 82px !important;
                  border-radius: 18px !important;
                }
                .mm-map2-preview-image img,
                .mm-map2-list-image img {
                  width: 100% !important;
                  height: 100% !important;
                  object-fit: cover !important;
                }
                .mm-map2-preview-card h3 {
                  margin: 0 0 8px !important;
                  color: #0f172a !important;
                  font-size: 18px !important;
                  font-weight: 1000 !important;
                  line-height: 1.12 !important;
                }
                .mm-map2-preview-card p {
                  display: flex !important;
                  min-width: 0 !important;
                  align-items: center !important;
                  gap: 8px !important;
                  color: #64748b !important;
                  font-size: 13px !important;
                  font-weight: 850 !important;
                }
                .mm-map2-bookmark {
                  width: 48px !important;
                  height: 48px !important;
                  display: inline-flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                  flex: 0 0 auto !important;
                  border-radius: 999px !important;
                  color: #2563eb !important;
                  background: rgba(255,255,255,.84) !important;
                  box-shadow: 0 8px 24px rgba(15,23,42,.08) !important;
                }
                .mm-map2-list-panel {
                  display: flex !important;
                  flex-direction: column !important;
                  height: min(460px, calc(100dvh - 206px)) !important;
                  padding-top: 2px !important;
                }
                .mm-map2-list-header {
                  display: flex !important;
                  align-items: center !important;
                  justify-content: space-between !important;
                  gap: 12px !important;
                  padding: 8px 0 12px !important;
                }
                .mm-map2-list-header strong {
                  color: #0f172a !important;
                  font-size: 18px !important;
                  font-weight: 1000 !important;
                }
                .mm-map2-list-header span,
                .mm-map2-list-item small {
                  color: #64748b !important;
                  font-size: 12px !important;
                  font-weight: 850 !important;
                }
                .mm-map2-list-header button {
                  width: 38px !important;
                  height: 38px !important;
                  display: inline-flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                  flex: 0 0 auto !important;
                  border-radius: 999px !important;
                  color: #475569 !important;
                  background: #f1f5f9 !important;
                }
                .mm-map2-scroll-list {
                  min-height: 0 !important;
                  flex: 1 1 auto !important;
                  overflow-y: auto !important;
                  padding: 0 0 12px !important;
                }
                .mm-map2-list-item {
                  width: 100% !important;
                  display: flex !important;
                  align-items: center !important;
                  gap: 12px !important;
                  padding: 10px 0 !important;
                  text-align: left !important;
                  border-bottom: 1px solid rgba(226,232,240,.72) !important;
                }
                .mm-map2-list-image {
                  width: 68px !important;
                  height: 58px !important;
                  border-radius: 16px !important;
                }
                .mm-map2-list-item strong {
                  display: block !important;
                  overflow: hidden !important;
                  color: #0f172a !important;
                  font-size: 14px !important;
                  font-weight: 950 !important;
                  text-overflow: ellipsis !important;
                  white-space: nowrap !important;
                }
                .mobile-bottom-nav.mm-mobile-nav2 {
                  position: fixed !important;
                  left: 0 !important;
                  right: 0 !important;
                  bottom: 0 !important;
                  z-index: 90 !important;
                  display: block !important;
                  width: 100vw !important;
                  max-width: 100vw !important;
                  pointer-events: none !important;
                }
                .mm-mobile-nav2-inner {
                  pointer-events: auto !important;
                  display: grid !important;
                  grid-template-columns: 1fr 1fr 78px 1fr 1fr !important;
                  align-items: end !important;
                  min-height: 78px !important;
                  padding: 8px 14px max(8px, env(safe-area-inset-bottom, 0px)) !important;
                  border-radius: 28px 28px 0 0 !important;
                  background: rgba(255,255,255,.96) !important;
                  border-top: 1px solid rgba(226,232,240,.76) !important;
                  box-shadow: 0 -18px 48px rgba(15,23,42,.10), inset 0 1px 0 rgba(255,255,255,.88) !important;
                  backdrop-filter: blur(18px) saturate(170%) !important;
                  -webkit-backdrop-filter: blur(18px) saturate(170%) !important;
                }
                .mm-mobile-nav2-item,
                .mm-mobile-nav2-center {
                  min-width: 0 !important;
                  display: flex !important;
                  flex-direction: column !important;
                  align-items: center !important;
                  justify-content: center !important;
                  gap: 3px !important;
                  color: #64748b !important;
                  text-align: center !important;
                  text-decoration: none !important;
                }
                .mm-mobile-nav2-item {
                  height: 58px !important;
                }
                .mm-mobile-nav2-center {
                  height: 70px !important;
                  justify-content: flex-end !important;
                  color: #0f172a !important;
                  background: transparent !important;
                  border: 0 !important;
                }
                .mm-mobile-nav2-item.is-active {
                  color: #1d4ed8 !important;
                }
                .mm-mobile-nav2-item span:last-child,
                .mm-mobile-nav2-center strong {
                  max-width: 100% !important;
                  overflow: hidden !important;
                  color: currentColor !important;
                  font-size: 11px !important;
                  font-weight: 900 !important;
                  line-height: 1.1 !important;
                  text-overflow: ellipsis !important;
                  white-space: nowrap !important;
                }
                .mm-mobile-nav2-center > span {
                  width: 58px !important;
                  height: 58px !important;
                  display: inline-flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                  border-radius: 999px !important;
                  background: linear-gradient(180deg,#2563eb 0%,#123fbd 100%) !important;
                  border: 1px solid rgba(255,255,255,.62) !important;
                  box-shadow: 0 16px 34px rgba(37,99,235,.34), inset 0 1px 0 rgba(255,255,255,.30) !important;
                }
                :is(.dark, [data-theme="dark"]) .mm-map2-search,
                :is(.dark, [data-theme="dark"]) .mm-map2-icon-pill,
                :is(.dark, [data-theme="dark"]) .mm-map2-tool-pill,
                :is(.dark, [data-theme="dark"]) .mm-map2-float-btn {
                  color: #e2e8f0 !important;
                  background: rgba(7,20,38,.92) !important;
                  border-color: rgba(96,165,250,.22) !important;
                  box-shadow: 0 14px 34px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.08) !important;
                }
                :is(.dark, [data-theme="dark"]) .mm-map2-search input,
                :is(.dark, [data-theme="dark"]) .mm-map2-search-result-title,
                :is(.dark, [data-theme="dark"]) .mm-map2-side-head strong {
                  color: #f8fafc !important;
                }
                :is(.dark, [data-theme="dark"]) .mm-map2-tool-pill-icon svg {
                  color: #93c5fd !important;
                }
                :is(.dark, [data-theme="dark"]) .mm-map2-search-result,
                :is(.dark, [data-theme="dark"]) .mm-map2-floating-list,
                :is(.dark, [data-theme="dark"]) .mm-map2-category-menu,
                :is(.dark, [data-theme="dark"]) .mm-map2-side-menu {
                  color: #f8fafc !important;
                  background: rgba(7,20,38,.96) !important;
                  border-color: rgba(96,165,250,.22) !important;
                  box-shadow: 0 30px 80px rgba(0,0,0,.44) !important;
                }
                :is(.dark, [data-theme="dark"]) .mm-map2-search-result-subtitle,
                :is(.dark, [data-theme="dark"]) .mm-map2-side-head span,
                :is(.dark, [data-theme="dark"]) .mm-map2-side-section > span {
                  color: #cbd5e1 !important;
                }
                :is(.dark, [data-theme="dark"]) .mm-map2-category-menu-grid button,
                :is(.dark, [data-theme="dark"]) .mm-map2-side-grid button {
                  color: #e2e8f0 !important;
                  background: rgba(15,23,42,.88) !important;
                }
                :is(.dark, [data-theme="dark"]) .mm-map2-side-grid button.is-active,
                :is(.dark, [data-theme="dark"]) .mm-map2-category-menu-grid button.is-active,
                :is(.dark, [data-theme="dark"]) .mm-map2-icon-pill.is-active,
                :is(.dark, [data-theme="dark"]) .mm-map2-tool-pill.is-active {
                  color: #fff !important;
                  background: #2563eb !important;
                }
              }
            `,
          }}
        />
        <style
          id="mm-map-home-popover-unified-v4"
          dangerouslySetInnerHTML={{
            __html: `
              .mm-weather-popup2,
              .mm-nearby-popup2,
              .mm-map2-category-menu {
                width: min(320px, calc(100vw - 24px)) !important;
                max-width: min(320px, calc(100vw - 24px)) !important;
                padding: 0 !important;
                overflow: hidden !important;
                border-radius: 24px !important;
                color: #0f172a !important;
                background: radial-gradient(circle at 88% 8%, rgba(37,99,235,.07), transparent 34%), rgba(255,255,255,.98) !important;
                border: 1px solid rgba(226,232,240,.9) !important;
                box-shadow: 0 20px 48px rgba(15,23,42,.13), inset 0 1px 0 rgba(255,255,255,.95) !important;
                backdrop-filter: blur(22px) saturate(170%) !important;
                -webkit-backdrop-filter: blur(22px) saturate(170%) !important;
              }
              @media (max-width: 767px) {
                .mm-map2-category-menu:not(.mm-map2-category-menu-pc) {
                  width: min(300px, calc(100vw - 104px)) !important;
                  max-width: calc(100vw - 104px) !important;
                }
              }
              .mm-weather-popup2-head,
              .mm-map2-category-menu-head,
              .mm-nearby-popup2 > div:first-child {
                min-height: 52px !important;
                padding: 12px 16px !important;
                border-bottom: 1px solid rgba(226,232,240,.78) !important;
                background: transparent !important;
              }
              .mm-weather-popup2 h3,
              .mm-map2-category-menu-head h3,
              .mm-nearby-popup2 h3 {
                color: #0f172a !important;
                font-size: 14px !important;
                font-weight: 650 !important;
                line-height: 1.2 !important;
                letter-spacing: 0 !important;
              }
              .mm-weather-popup2-head-icon,
              .mm-map2-category-menu-head-icon {
                width: 28px !important;
                height: 28px !important;
                color: #2563eb !important;
                background: #eff6ff !important;
                border: 1px solid rgba(191,219,254,.62) !important;
                border-radius: 999px !important;
              }
              .mm-map2-category-menu-close,
              .mm-weather-popup2 button[aria-label],
              .mm-nearby-popup2 button[aria-label] {
                color: #64748b !important;
                background: transparent !important;
                box-shadow: none !important;
              }
              .mm-map2-category-menu-grid {
                display: grid !important;
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                gap: 8px !important;
                padding: 12px !important;
                max-height: min(306px, calc(100dvh - 306px)) !important;
                overflow-y: auto !important;
              }
              .mm-map2-category-menu-grid button {
                min-width: 0 !important;
                width: 100% !important;
                min-height: 46px !important;
                padding: 12px 11px !important;
                border-radius: 16px !important;
                color: #334155 !important;
                background: #f8fafc !important;
                border: 1px solid rgba(226,232,240,.74) !important;
                box-shadow: none !important;
                font-size: 13px !important;
                font-weight: 600 !important;
                line-height: 1.2 !important;
                text-align: left !important;
                word-break: keep-all !important;
              }
              .mm-map2-category-menu-grid button.is-active {
                color: #fff !important;
                background: linear-gradient(180deg,#2f75ff 0%,#1d4ed8 100%) !important;
                border-color: rgba(37,99,235,.92) !important;
              }
              .mm-weather-popup2-body {
                padding: 16px !important;
              }
              .mm-weather-popup2-hero,
              .mm-weather-popup2-rec {
                border-radius: 18px !important;
                background: rgba(248,250,252,.94) !important;
                border: 1px solid rgba(226,232,240,.88) !important;
                box-shadow: none !important;
              }
              .mm-weather-popup2-temp {
                color: #0f172a !important;
                font-weight: 760 !important;
              }
              .mm-weather-popup2-desc,
              .mm-weather-popup2-provider,
              .mm-weather-popup2-location {
                color: #64748b !important;
                font-weight: 560 !important;
              }
              .mm-nearby-popup2 button:not([aria-label]) {
                padding: 10px 16px !important;
                border-bottom: 1px solid rgba(226,232,240,.68) !important;
                background: transparent !important;
              }
              .mm-nearby-popup2 h4 {
                color: #0f172a !important;
                font-size: 13px !important;
                font-weight: 650 !important;
                line-height: 1.25 !important;
              }
              .mm-nearby-popup2 p {
                color: #64748b !important;
                font-size: 11.5px !important;
                font-weight: 520 !important;
              }
              .mm-map2-pc-control {
                width: 54px !important;
                height: 54px !important;
                min-width: 54px !important;
                min-height: 54px !important;
                padding: 0 !important;
                border-radius: 999px !important;
                color: #2563eb !important;
                background: rgba(255,255,255,.96) !important;
                border: 1px solid rgba(226,232,240,.8) !important;
                box-shadow: 0 4px 10px rgba(15,23,42,.06), inset 0 1px 0 rgba(255,255,255,.9) !important;
                backdrop-filter: blur(18px) saturate(160%) !important;
                -webkit-backdrop-filter: blur(18px) saturate(160%) !important;
              }
              .mm-map2-pc-control-wide span,
              .mm-map2-pc-control-wide svg:last-child {
                display: none !important;
              }
              .mm-map2-pc-control.is-active,
              .mm-map2-pc-location-control.is-active {
                color: #fff !important;
                background: linear-gradient(180deg,#2f75ff 0%,#1d4ed8 100%) !important;
                border-color: rgba(37,99,235,.92) !important;
              }
              .mm-map2-category-menu-pc {
                position: absolute !important;
                top: 0 !important;
                right: calc(100% + 8px) !important;
                left: auto !important;
                width: min(320px, calc(100vw - 24px)) !important;
              }
              @media (min-width: 768px) {
                .mm-map2-category-menu:not(.mm-map2-category-menu-pc) {
                  display: none !important;
                }
                .mm-weather-popup2,
                .mm-nearby-popup2,
                .mm-map2-category-menu {
                  width: 320px !important;
                  max-width: 320px !important;
                }
              }
              :is(.dark, [data-theme="dark"]) .mm-weather-popup2,
              :is(.dark, [data-theme="dark"]) .mm-nearby-popup2,
              :is(.dark, [data-theme="dark"]) .mm-map2-category-menu {
                color: #e2e8f0 !important;
                background: radial-gradient(circle at 88% 8%, rgba(37,99,235,.08), transparent 34%), #020617 !important;
                border-color: rgba(96,165,250,.18) !important;
                box-shadow: 0 24px 64px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.06) !important;
              }
              :is(.dark, [data-theme="dark"]) .mm-weather-popup2-head,
              :is(.dark, [data-theme="dark"]) .mm-map2-category-menu-head,
              :is(.dark, [data-theme="dark"]) .mm-nearby-popup2 > div:first-child {
                border-bottom-color: rgba(96,165,250,.16) !important;
              }
              :is(.dark, [data-theme="dark"]) .mm-weather-popup2 h3,
              :is(.dark, [data-theme="dark"]) .mm-map2-category-menu-head h3,
              :is(.dark, [data-theme="dark"]) .mm-nearby-popup2 h3,
              :is(.dark, [data-theme="dark"]) .mm-nearby-popup2 h4,
              :is(.dark, [data-theme="dark"]) .mm-weather-popup2-temp {
                color: #f8fafc !important;
              }
              :is(.dark, [data-theme="dark"]) .mm-weather-popup2-desc,
              :is(.dark, [data-theme="dark"]) .mm-weather-popup2-provider,
              :is(.dark, [data-theme="dark"]) .mm-weather-popup2-location,
              :is(.dark, [data-theme="dark"]) .mm-nearby-popup2 p {
                color: #94a3b8 !important;
              }
              :is(.dark, [data-theme="dark"]) .mm-weather-popup2-head-icon,
              :is(.dark, [data-theme="dark"]) .mm-map2-category-menu-head-icon {
                color: #93c5fd !important;
                background: rgba(30,64,175,.22) !important;
                border-color: rgba(96,165,250,.20) !important;
              }
              :is(.dark, [data-theme="dark"]) .mm-weather-popup2-hero,
              :is(.dark, [data-theme="dark"]) .mm-weather-popup2-rec,
              :is(.dark, [data-theme="dark"]) .mm-map2-category-menu-grid button {
                color: #e2e8f0 !important;
                background: rgba(7,20,38,.88) !important;
                border-color: rgba(96,165,250,.14) !important;
              }
              :is(.dark, [data-theme="dark"]) .mm-map2-category-menu-grid button.is-active {
                color: #fff !important;
                background: linear-gradient(180deg,#2f75ff 0%,#1d4ed8 100%) !important;
                border-color: rgba(96,165,250,.38) !important;
              }
              :is(.dark, [data-theme="dark"]) .mm-nearby-popup2 button:not([aria-label]) {
                border-bottom-color: rgba(96,165,250,.12) !important;
              }
              :is(.dark, [data-theme="dark"]) .mm-nearby-popup2 button:not([aria-label]):hover {
                background: rgba(37,99,235,.08) !important;
              }
              :is(.dark, [data-theme="dark"]) .mm-map2-pc-control {
                color: #93c5fd !important;
                background: rgba(7,20,38,.92) !important;
                border-color: rgba(96,165,250,.22) !important;
                box-shadow: 0 8px 20px rgba(0,0,0,.26), inset 0 1px 0 rgba(255,255,255,.08) !important;
              }
              :is(.dark, [data-theme="dark"]) .mm-map2-pc-control.is-active,
              :is(.dark, [data-theme="dark"]) .mm-map2-pc-location-control.is-active {
                color: #fff !important;
                background: linear-gradient(180deg,#2f75ff 0%,#1d4ed8 100%) !important;
              }
              @media (min-width: 768px) {
                .mm-map2-top,
                .mm-map2-side-layer {
                  display: none !important;
                }
                .mm-map2-pc-overlay {
                  display: flex !important;
                  position: absolute !important;
                  top: 16px !important;
                  left: 24px !important;
                  z-index: 90 !important;
                  width: auto !important;
                  max-width: none !important;
                  pointer-events: none !important;
                  opacity: 1 !important;
                  visibility: visible !important;
                }
                .mm-map2-pc-overlay.is-panel-closed {
                  right: 24px !important;
                }
                .mm-map2-pc-overlay.is-panel-open {
                  right: 724px !important;
                }
                .mm-map2-pc-search-wrap {
                  display: block !important;
                  width: calc(100% - 76px) !important;
                  max-width: none !important;
                  pointer-events: auto !important;
                  opacity: 1 !important;
                  visibility: visible !important;
                }
                .mm-map2-pc-search,
                .mm-map2-pc-search-input {
                  display: block !important;
                  width: 100% !important;
                  opacity: 1 !important;
                  visibility: visible !important;
                }
                .mm-map2-pc-tools {
                  display: flex !important;
                  position: absolute !important;
                  top: 0 !important;
                  right: 0 !important;
                  width: 54px !important;
                  flex-direction: column !important;
                  gap: 8px !important;
                  align-items: center !important;
                  pointer-events: auto !important;
                  opacity: 1 !important;
                  visibility: visible !important;
                }
                .mm-map2-pc-category-anchor {
                  order: 1 !important;
                  margin-left: 0 !important;
                }
                .mm-map2-pc-weather-anchor {
                  order: 2 !important;
                }
                .mm-map2-pc-nearby-anchor {
                  order: 3 !important;
                }
                .mm-map2-pc-location-control {
                  order: 4 !important;
                }
                .mm-floating-back-button.mm-floating-back-button--pc-only {
                  display: inline-flex !important;
                  right: 32px !important;
                  bottom: calc(32px + env(safe-area-inset-bottom, 0px)) !important;
                  z-index: 9998 !important;
                }
              }
            `,
          }}
        />
        {/* Google AdSense */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5736725257134757"
          crossOrigin="anonymous"
        />
        {/* FOUC prevention: 2.0 gallery-photo mobile splash overlay until React takes over */}
        <script dangerouslySetInnerHTML={{
          __html: `
          (function(){
            var shown=false;
            try{shown=!!sessionStorage.getItem('splashShown');}catch(e){}
            if(window.innerWidth<768 && window.location.pathname==='/' && !shown){
              var splashImages=['/splash/gallery-splash.jpg','/splash/gallery-splash-2.jpg','/splash/gallery-splash-3.jpg','/splash/gallery-splash-4.jpg','/splash/gallery-splash-5.jpg','/splash/gallery-splash-6.jpg'];
              var splashImage='';
              try{splashImage=sessionStorage.getItem('mmSplashBackground')||'';}catch(e){}
              if(splashImages.indexOf(splashImage)===-1){
                splashImage=splashImages[Math.floor(Math.random()*splashImages.length)]||splashImages[0];
                try{sessionStorage.setItem('mmSplashBackground',splashImage);}catch(e){}
              }
              document.documentElement.style.setProperty('--mm-splash-bg-image','url("'+splashImage+'")');
              var s=document.createElement('style');
              s.id='splash-fouc';
              s.textContent='body::before{content:"";position:fixed;inset:0;z-index:99998;background-color:#071426;background-image:linear-gradient(180deg,rgba(1,15,38,.76) 0%,rgba(15,70,162,.56) 42%,rgba(2,8,23,.86) 100%),linear-gradient(115deg,rgba(37,99,235,.34) 0%,rgba(14,165,233,.16) 46%,rgba(2,8,23,.22) 100%),var(--mm-splash-bg-image);background-position:center;background-repeat:no-repeat;background-size:cover,cover,cover;pointer-events:none;transition:opacity .28s ease}body.splash-done::before{opacity:0;pointer-events:none}';
              document.head.appendChild(s);
              setTimeout(function(){var b=document.body;if(b)b.classList.add('splash-done');var el=document.getElementById('splash-fouc');if(el)setTimeout(function(){el.remove()},320);},3200);
            }
          })();
        `}} />
        <script dangerouslySetInnerHTML={{
          __html: `
          (function(){
            var root=document.documentElement;
            var ua=navigator.userAgent||'';
            var isTelegram=/Telegram|TelegramBot|Telegram-iOS|TelegramAndroid/i.test(ua)||!!(window.Telegram&&window.Telegram.WebApp);
            var isInApp=/Telegram|TelegramBot|Telegram-iOS|TelegramAndroid|KAKAOTALK|Line\\/|NAVER\\(inapp|FBAN|FBAV|Instagram|DaumApps|wv\\)|; wv/i.test(ua)||isTelegram;
            if(isTelegram) root.classList.add('is-telegram-webview');
            var savedTheme='light';
            var savedDark='false';
            try{
              savedTheme=localStorage.getItem('themeMode')||'light';
              savedDark=localStorage.getItem('darkMode')||'false';
            }catch(e){}
            var systemDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
            var appDark=savedTheme==='system'?systemDark:(savedTheme==='dark'||(savedTheme!=='light'&&savedDark==='true'));
            var themeColor=appDark?'#020617':'#f8fbff';
            root.classList.toggle('dark',appDark);
            root.dataset.theme=appDark?'dark':'light';
            root.style.colorScheme=appDark?'dark':'light';
            var metas=document.querySelectorAll('meta[name="theme-color"]');
            var meta=metas[0];
            if(!meta){
              meta=document.createElement('meta');
              meta.setAttribute('name','theme-color');
              document.head.appendChild(meta);
            }
            meta.removeAttribute('media');
            meta.setAttribute('content',themeColor);
            for(var i=1;i<metas.length;i++){metas[i].remove();}
            var statusMeta=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
            if(!statusMeta){
              statusMeta=document.createElement('meta');
              statusMeta.setAttribute('name','apple-mobile-web-app-status-bar-style');
              document.head.appendChild(statusMeta);
            }
            statusMeta.setAttribute('content',appDark?'black-translucent':'default');
            if(isInApp){
              root.classList.add('is-inapp-browser');
              }
            var lastH=0,lastW=0,viewportFrame=0;
            function setViewportVars(){
              if(viewportFrame)return;
              viewportFrame=requestAnimationFrame(function(){
              viewportFrame=0;
              var vv=window.visualViewport;
              var h=Math.round((vv&&vv.height)||window.innerHeight||document.documentElement.clientHeight||0);
              var w=Math.round((vv&&vv.width)||window.innerWidth||document.documentElement.clientWidth||0);
              if(h>0&&h!==lastH){
                lastH=h;
                root.style.setProperty('--mm-vh',(h*0.01)+'px');
                root.style.setProperty('--mm-viewport-height',h+'px');
              }
              if(w>0&&w!==lastW){lastW=w;root.style.setProperty('--mm-viewport-width',w+'px');}
              });
            }
            setViewportVars();
            window.addEventListener('resize',setViewportVars,{passive:true});
            window.addEventListener('orientationchange',function(){setTimeout(setViewportVars,80);setTimeout(setViewportVars,320);},{passive:true});
            if(window.visualViewport){
              window.visualViewport.addEventListener('resize',setViewportVars,{passive:true});
              window.visualViewport.addEventListener('scroll',setViewportVars,{passive:true});
            }
          })();
        `}} />
        <script dangerouslySetInnerHTML={{
          __html: `
          (function(){
            var d=document,l=d.getElementById('dynamic-favicon');
            function u(){var m=window.matchMedia('(prefers-color-scheme:dark)').matches;
              if(!l){l=d.createElement('link');l.id='dynamic-favicon';l.rel='icon';l.type='image/svg+xml';d.head.appendChild(l);}
              l.href=m?'/icon-dark.svg':'/icon-light.svg';
            }
            u();window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change',u);
          })();
        `}} />
        <script dangerouslySetInnerHTML={{
          __html: `(function(){
          function m(i){if(!i||i.tagName!=='IMG'||i.classList.contains('no-dissolve')||i.getAttribute('data-loaded'))return;
            if(i.complete&&i.naturalWidth>0){i.setAttribute('data-loaded','true');return;}
            i.addEventListener('load',function(){this.setAttribute('data-loaded','true');},{once:true});
            i.addEventListener('error',function(){this.setAttribute('data-loaded','true');},{once:true});}
          document.addEventListener('load',function(e){if(e.target&&e.target.tagName==='IMG')m(e.target);},true);
          var o=new MutationObserver(function(ml){ml.forEach(function(mu){mu.addedNodes.forEach(function(n){
            if(n.nodeType!==1)return;if(n.tagName==='IMG')m(n);
            else if(n.querySelectorAll)n.querySelectorAll('img').forEach(m);});});});
          var scanFrame=0;
          function s(){document.querySelectorAll('img:not([data-loaded]):not(.no-dissolve)').forEach(m);}
          function rs(){if(scanFrame)return;scanFrame=requestAnimationFrame(function(){scanFrame=0;s();});}
          if(document.body){o.observe(document.body,{childList:true,subtree:true});s();}
          else document.addEventListener('DOMContentLoaded',function(){o.observe(document.body,{childList:true,subtree:true});s();});
          var c=0,iv=setInterval(function(){rs();if(++c>=4)clearInterval(iv);},650);
        })();`}} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'WebSite',
                  name: 'Museum Map',
                  alternateName: '뮤지엄 맵',
                  url: 'https://museummap.app',
                  description: 'Explore 3,700+ museums and art galleries worldwide. AI-powered recommendations, curated MM Story guides, and personalized travel planning.',
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: 'https://museummap.app/?q={search_term_string}',
                    'query-input': 'required name=search_term_string'
                  }
                },
                {
                  '@type': 'Organization',
                  name: 'Museum Map',
                  url: 'https://museummap.app',
                  logo: 'https://museummap.app/icon.svg',
                  sameAs: [],
                  description: 'Global museum and art gallery discovery platform featuring AI-powered recommendations, searchable MM Story guides, hidden gem museums, and personalized trip planning for art lovers worldwide.',
                  alternateName: '뮤지엄 맵 - 전 세계 미술관/박물관 탐험'
                }
              ]
            })
          }}
        />
      </head>
      <body className={`${brandDisplayFont.variable} min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col transition-colors`} style={{ minHeight: 'var(--mm-viewport-height, 100dvh)' }}>
        <SplashScreen />
        <ServiceWorkerRegistration />
        <AuthProvider>
          <AppProvider initialLocale={lang}>
            <ModalProvider>
              <NavHeader />
              <MainContent>
                {children}
              </MainContent>
              <MobileBottomNav />
              <FloatingBackButton />
              <CookieConsent />
              <MarketingConsentPrompt />
            </ModalProvider>
          </AppProvider>
        </AuthProvider>
        {process.env.NODE_ENV === 'production' && (
          <>
            {/* Exclude internal traffic from GA */}
            <script dangerouslySetInnerHTML={{
              __html: `(function(){
                var GA_ID='${process.env.NEXT_PUBLIC_GA_ID || 'G-8XMCJMKLSF'}';
                var INTERNAL_EMAILS=['nyoungho.kim@gmail.com'];
                try{
                  var s=document.cookie.match(/next-auth.session-token=([^;]+)/);
                  if(!s) return;
                  fetch('/api/auth/session').then(function(r){return r.json()}).then(function(d){
                    if(d&&d.user&&d.user.email&&INTERNAL_EMAILS.indexOf(d.user.email)!==-1){
                      window['ga-disable-'+GA_ID]=true;
                      console.log('[GA] Internal traffic excluded');
                    }
                  }).catch(function(){});
                }catch(e){}
              })();`
            }} />
            <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID || 'G-8XMCJMKLSF'} />
          </>
        )}
      </body>
    </html>
  )
}
