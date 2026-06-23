import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Permanent_Marker } from 'next/font/google'
import './globals.css'
import NavHeader from '@/components/layout/NavHeader'
import MobileBottomNav from '@/components/layout/MobileBottomNav'
import FloatingBackButton from '@/components/layout/FloatingBackButton'
import MainContent from '@/components/layout/MainContent'
import RoutePendingReset from '@/components/layout/RoutePendingReset'
import { AppProvider } from '@/components/AppContext'
import { ModalProvider } from '@/components/ui/Modal'
import { GoogleAnalytics } from '@next/third-parties/google'
import DeferredAdSense from '@/components/layout/DeferredAdSense'

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
import type { Locale } from '@/lib/locale-core'

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
              html, body {
                font-family: var(--mm-force-sans);
              }
              button, input, select, textarea, optgroup, option {
                font: inherit;
              }
            `,
          }}
        />
        <style
          id="mm-floating-back-pc"
          dangerouslySetInnerHTML={{
            __html: `
              @media (min-width: 768px) {
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
        {/* FOUC prevention: stable mobile splash overlay until React takes over */}
        <script dangerouslySetInnerHTML={{
          __html: `
          (function(){
            var shown=false;
            try{shown=!!(sessionStorage.getItem('splashShown')||localStorage.getItem('mmSplashSeenV2'));}catch(e){}
            if(window.innerWidth<768 && window.location.pathname==='/' && !shown){
              var s=document.createElement('style');
              s.id='splash-fouc';
              s.textContent='body::before{content:"";position:fixed;inset:0;z-index:99998;background:#071426;background-image:linear-gradient(180deg,rgba(1,15,38,.86) 0%,rgba(15,70,162,.56) 48%,rgba(2,8,23,.88) 100%);pointer-events:none;transition:opacity .16s ease}body.splash-done::before{opacity:0;pointer-events:none}';
              document.head.appendChild(s);
              setTimeout(function(){var b=document.body;if(b)b.classList.add('splash-done');var el=document.getElementById('splash-fouc');if(el)setTimeout(function(){el.remove()},180);},900);
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
            if(isInApp){
              root.classList.add('is-inapp-browser');
              var meta=document.querySelector('meta[name="theme-color"]');
              if(!meta){
                meta=document.createElement('meta');
                meta.setAttribute('name','theme-color');
                document.head.appendChild(meta);
              }
              var prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
              meta.setAttribute('content',prefersDark?'#020617':'#f8fbff');
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
              <RoutePendingReset />
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
        {/* Google AdSense — keep the 673KB third-party payload away from the first
            mobile interaction window. Auto Ads still load, but only after load + idle. */}
        <DeferredAdSense />
      </body>
    </html>
  )
}
