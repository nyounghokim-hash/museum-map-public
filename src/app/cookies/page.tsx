'use client';
import { createPortal } from 'react-dom';
import { useApp } from '@/components/AppContext';
import Link from 'next/link';
import { backWithFallback } from '@/lib/route-pending';

const content: Record<string, { title: string; intro: string; sections: { heading: string; body: string }[] }> = {
    ko: {
        title: '쿠키 정책',
        intro: 'Museum Map은 사용자 경험 개선을 위해 쿠키 및 유사 기술을 사용합니다.',
        sections: [
            {
                heading: '쿠키란?',
                body: '쿠키는 웹사이트를 방문할 때 브라우저에 저장되는 작은 텍스트 파일입니다. 쿠키를 통해 웹사이트는 사용자의 환경설정을 기억하고, 더 나은 서비스를 제공할 수 있습니다.'
            },
            {
                heading: '사용하는 쿠키 종류',
                body: '• 필수 쿠키: 로그인 세션 유지, 언어 설정 저장 등 서비스 운영에 필수적인 쿠키입니다.\n• 분석 쿠키: Google Analytics를 통해 페이지 방문 수, 체류 시간 등을 익명으로 수집하여 서비스 개선에 활용합니다.\n• 기능 쿠키: 다크 모드, 최근 본 미술관 등 사용자 환경설정을 저장합니다.'
            },
            {
                heading: '제3자 쿠키',
                body: '• Google Analytics (GA4): 웹사이트 트래픽 분석\n• Google OAuth: 소셜 로그인 인증\n• Supabase: 데이터베이스 세션 관리'
            },
            {
                heading: '쿠키 관리 방법',
                body: '브라우저 설정에서 쿠키를 삭제하거나 차단할 수 있습니다. 단, 필수 쿠키를 차단하면 일부 기능이 제한될 수 있습니다.\n\n• Chrome: 설정 > 개인정보 및 보안 > 쿠키 및 기타 사이트 데이터\n• Safari: 환경설정 > 개인정보 보호\n• Firefox: 설정 > 개인정보 및 보안'
            },
            {
                heading: '데이터 보관 기간',
                body: '• 세션 쿠키: 브라우저 종료 시 삭제\n• 분석 쿠키: 최대 2년\n• 기능 쿠키: 최대 1년\n• localStorage: 사용자가 직접 삭제할 때까지'
            },
            {
                heading: '문의',
                body: '쿠키 사용에 관한 문의사항은 앱 내 피드백 기능 또는 이메일(museummap@contact.com)로 연락해 주세요.'
            }
        ]
    },
    en: {
        title: 'Cookie Policy',
        intro: 'Museum Map uses cookies and similar technologies to improve your experience.',
        sections: [
            {
                heading: 'What are cookies?',
                body: 'Cookies are small text files stored in your browser when you visit a website. They help the website remember your preferences and provide a better service.'
            },
            {
                heading: 'Types of cookies we use',
                body: '• Essential cookies: Required for login sessions, language settings, and core functionality.\n• Analytics cookies: Google Analytics collects anonymous data such as page views and session duration to improve our service.\n• Functional cookies: Store your preferences like dark mode and recently viewed museums.'
            },
            {
                heading: 'Third-party cookies',
                body: '• Google Analytics (GA4): Website traffic analysis\n• Google OAuth: Social login authentication\n• Supabase: Database session management'
            },
            {
                heading: 'Managing cookies',
                body: 'You can delete or block cookies in your browser settings. Note that blocking essential cookies may limit some features.\n\n• Chrome: Settings > Privacy and Security > Cookies\n• Safari: Preferences > Privacy\n• Firefox: Settings > Privacy & Security'
            },
            {
                heading: 'Data retention',
                body: '• Session cookies: Deleted when browser closes\n• Analytics cookies: Up to 2 years\n• Functional cookies: Up to 1 year\n• localStorage: Until manually cleared by user'
            },
            {
                heading: 'Contact',
                body: 'For questions about our cookie usage, please use the in-app feedback feature or email museummap@contact.com.'
            }
        ]
    }
};

export default function CookiePolicyPage() {
    const { locale } = useApp();
    const t = content[locale] || content.en;

    return (
        <div className="mm-legal-page2 mm-library-page2 no-back-swipe w-full max-w-[640px] mx-auto px-4 py-6 sm:px-6 sm:py-10 mt-2 sm:mt-6 animate-fadeInUp">
            <div className="mb-6 sm:mb-8">
                <button onClick={() => backWithFallback('/info', locale)} className="hidden lg:flex w-9 h-9 items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-600 dark:text-gray-300 rounded-full mb-4 transition-colors active:scale-95">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h1 className="text-xl sm:text-2xl font-bold dark:text-white">{t.title}</h1>
                <p className="text-gray-400 dark:text-gray-500 mt-1 text-xs">Last updated: 2026-03-09</p>
            </div>

            {/* Intro */}
            <div className="flex items-start gap-3 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-xl px-4 py-3.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100/80 dark:bg-amber-900/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-lg">🍪</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{t.intro}</p>
            </div>

            {/* Sections */}
            <div className="flex flex-col gap-3 stagger-children">
                {t.sections.map((section, i) => (
                    <div key={i} className="border rounded-xl px-4 py-3.5" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-gray-400 dark:text-gray-500">{i + 1}</span>
                            </div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-white">{section.heading}</p>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 ml-11 leading-relaxed whitespace-pre-line">
                            {section.body}
                        </p>
                    </div>
                ))}
            </div>

            {/* Back links */}
            <div className="mt-6 flex gap-3">
                <Link href="/privacy" className="text-blue-500 hover:underline text-xs font-medium">
                    {locale === 'ko' ? '← 개인정보처리방침' : '← Privacy Policy'}
                </Link>
                <Link href="/info" className="text-blue-500 hover:underline text-xs font-medium">
                    {locale === 'ko' ? '이용 정보' : 'Info'}
                </Link>
            </div>

            {/* Mobile: Floating back — portal to escape transform container */}
            {typeof document !== 'undefined' && createPortal(
                <div className="lg:hidden fixed bottom-8 right-8 z-[9998] flex flex-col gap-2">
                    <button
                        onClick={() => backWithFallback('/info', locale)}
                        className="w-14 h-14 flex items-center justify-center rounded-full bg-neutral-800/90 dark:bg-white/90 backdrop-blur-md text-white dark:text-gray-800 shadow-lg border border-neutral-700/60 dark:border-gray-200/60 active:scale-95 transition-all hover:bg-neutral-700 dark:hover:bg-gray-100"
                        aria-label="Back"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
}
