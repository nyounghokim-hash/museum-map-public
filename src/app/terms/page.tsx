'use client';
import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/components/AppContext';
import { useSearchParams } from 'next/navigation';
import { backWithFallback } from '@/lib/route-pending';

/* ── i18n data ─────────────────────────────────── */
type L = Record<string, string>;
const ui: Record<string, L> = {
    tabTerms: { ko: '서비스 이용약관', en: 'Terms of Service', ja: '利用規約', de: 'Nutzungsbedingungen', fr: "Conditions d'utilisation", es: 'Términos de servicio', pt: 'Termos de serviço', 'zh-CN': '服务条款', 'zh-TW': '服務條款', da: 'Servicevilkår', fi: 'Käyttöehdot', sv: 'Användarvillkor', et: 'Kasutustingimused' },
    tabPrivacy: { ko: '개인정보처리방침', en: 'Privacy Policy', ja: 'プライバシーポリシー', de: 'Datenschutz', fr: 'Politique de confidentialité', es: 'Política de privacidad', pt: 'Política de privacidade', 'zh-CN': '隐私政策', 'zh-TW': '隱私政策', da: 'Privatlivspolitik', fi: 'Tietosuojakäytäntö', sv: 'Integritetspolicy', et: 'Privaatsuspoliitika' },
    lastUpdated: { ko: '최종 수정일: 2026년 3월 17일', en: 'Last updated: March 17, 2026', ja: '最終更新日：2026年3月17日', de: 'Letzte Aktualisierung: 17. März 2026', fr: 'Dernière mise à jour : 17 mars 2026', es: 'Última actualización: 17 de marzo de 2026', pt: 'Última atualização: 17 de março de 2026', 'zh-CN': '最后更新：2026年3月17日', 'zh-TW': '最後更新：2026年3月17日', da: 'Sidst opdateret: 17. marts 2026', fi: 'Viimeksi päivitetty: 17. maaliskuuta 2026', sv: 'Senast uppdaterad: 17 mars 2026', et: 'Viimati muudetud: 17. märts 2026' },
    keyTerms: { ko: '핵심 조항', en: 'Key Terms', ja: '主な条項', de: 'Wichtige Bestimmungen', fr: 'Dispositions clés', es: 'Términos clave', pt: 'Termos principais', 'zh-CN': '核心条款', 'zh-TW': '核心條款', da: 'Nøglevilkår', fi: 'Keskeiset ehdot', sv: 'Nyckelvillkor', et: 'Põhitingimused' },
    dataSources: { ko: '데이터 출처', en: 'Data Sources', ja: 'データソース', de: 'Datenquellen', fr: 'Sources de données', es: 'Fuentes de datos', pt: 'Fontes de dados', 'zh-CN': '数据来源', 'zh-TW': '數據來源', da: 'Datakilder', fi: 'Tietolähteet', sv: 'Datakällor', et: 'Andmeallikad' },
    imageSources: { ko: '이미지 출처 및 라이선스', en: 'Image Sources & Licenses', ja: '画像の出典とライセンス', de: 'Bildquellen & Lizenzen', fr: 'Sources des images & licences', es: 'Fuentes de imágenes y licencias', pt: 'Fontes de imagens e licenças', 'zh-CN': '图片来源与许可', 'zh-TW': '圖片來源與授權', da: 'Billedkilder & licenser', fi: 'Kuvalähteet ja lisenssit', sv: 'Bildkällor & licenser', et: 'Pildiallikad ja litsentsid' },
    userRightsSummary: { ko: '사용자 권리 요약', en: 'Your Rights Summary', ja: 'ユーザーの権利', de: 'Zusammenfassung Ihrer Rechte', fr: 'Résumé de vos droits', es: 'Resumen de sus derechos', pt: 'Resumo dos seus direitos', 'zh-CN': '用户权利概要', 'zh-TW': '用戶權利概要', da: 'Oversigt over dine rettigheder', fi: 'Oikeuksiesi yhteenveto', sv: 'Sammanfattning av dina rättigheter', et: 'Teie õiguste kokkuvõte' },
    required: { ko: '필수', en: 'Required', ja: '必須', de: 'Pflicht', fr: 'Obligatoire', es: 'Obligatorio', pt: 'Obrigatório', 'zh-CN': '必需', 'zh-TW': '必要', da: 'Påkrævet', fi: 'Pakollinen', sv: 'Obligatorisk', et: 'Kohustuslik' },
    auto: { ko: '자동', en: 'Auto', ja: '自動', de: 'Auto', fr: 'Auto', es: 'Auto', pt: 'Auto', 'zh-CN': '自动', 'zh-TW': '自動', da: 'Auto', fi: 'Auto', sv: 'Auto', et: 'Auto' },
    optional: { ko: '선택', en: 'Optional', ja: '任意', de: 'Optional', fr: 'Optionnel', es: 'Opcional', pt: 'Opcional', 'zh-CN': '可选', 'zh-TW': '選填', da: 'Valgfri', fi: 'Valinnainen', sv: 'Valfritt', et: 'Valikuline' },
    uploadFormat: { ko: '업로드 가능 형식:', en: 'Upload format:', ja: 'アップロード形式:', de: 'Upload-Format:', fr: 'Format:', es: 'Formato:', pt: 'Formato:', 'zh-CN': '上传格式:', 'zh-TW': '上傳格式:', da: 'Format:', fi: 'Muoto:', sv: 'Format:', et: 'Vorming:' },
    dailyLimit: { ko: '일일 업로드 제한:', en: 'Daily limit:', ja: '1日上限:', de: 'Tägliches Limit:', fr: 'Limite quotidienne:', es: 'Límite diario:', pt: 'Limite diário:', 'zh-CN': '每日限额:', 'zh-TW': '每日限額:', da: 'Daglig grænse:', fi: 'Päiväraja:', sv: 'Daglig gräns:', et: 'Päevalimiit:' },
    approvalProcess: { ko: '승인 절차:', en: 'Approval:', ja: '承認:', de: 'Genehmigung:', fr: 'Approbation:', es: 'Aprobación:', pt: 'Aprovação:', 'zh-CN': '审核:', 'zh-TW': '審核:', da: 'Godkendelse:', fi: 'Hyväksyntä:', sv: 'Godkännande:', et: 'Kinnitus:' },
};
const g = (key: string, locale: string) => ui[key]?.[locale] || ui[key]?.['en'] || key;

/* Section data: { title, paragraphs } per locale */
type Section = { title: L; paragraphs: L[]; isList?: boolean };

const termsSections: Section[] = [
    {
        title: { ko: '일반 이용약관', en: 'General Terms', ja: '一般利用規約', de: 'Allgemeine Nutzungsbedingungen', fr: 'Conditions générales', es: 'Términos generales', pt: 'Termos gerais' },
        paragraphs: [
            { ko: '본 서비스(이하 "Museum Map", "뮤지엄맵")는 전 세계 미술관 및 박물관 정보를 제공하고, 사용자가 자신만의 여행 계획을 세울 수 있도록 돕는 플랫폼입니다.', en: 'This service ("Museum Map") is a platform that provides information about museums and galleries worldwide and helps users plan their visits.' },
            { ko: '서비스를 이용함으로써 귀하는 본 약관에 동의하는 것으로 간주됩니다.', en: 'By using the service, you agree to these terms. If you do not agree, please discontinue use.' },
            { ko: '서비스는 만 14세 이상의 사용자를 대상으로 하며, 14세 미만의 사용자는 법정 대리인의 동의가 필요합니다.', en: 'The service is intended for users aged 14 and above. Users under 14 require parental consent.' },
            { ko: '관리자는 사전 고지 없이 서비스의 전부 또는 일부를 변경, 중단할 수 있으며, 이로 인해 발생하는 손해에 대해 책임지지 않습니다.', en: 'The administrator may modify or discontinue the service without prior notice and is not responsible for any resulting damages.' },
            { ko: '본 약관은 서비스 운영상 필요한 경우 사전 고지 후 변경될 수 있으며, 변경된 약관은 서비스 내 공지 후 7일 이후 효력이 발생합니다.', en: 'These terms may be updated as needed. Updated terms take effect 7 days after being posted on the service.' },
        ]
    },
    {
        title: { ko: '계정 및 이용자 의무', en: 'Account & User Obligations', ja: 'アカウントとユーザーの義務', de: 'Konto & Nutzerpflichten', fr: 'Compte & obligations', es: 'Cuenta y obligaciones', pt: 'Conta e obrigações' },
        isList: true,
        paragraphs: [
            { ko: '사용자는 본인의 계정 정보를 안전하게 관리할 책임이 있습니다.', en: 'Users are responsible for keeping their account information secure.' },
            { ko: '타인의 계정을 도용하거나 허위 정보를 등록하는 행위는 금지됩니다.', en: 'Impersonating others or registering false information is prohibited.' },
            { ko: '서비스를 이용하여 불법적인 활동을 수행하거나, 다른 사용자에게 피해를 주는 행위는 금지됩니다.', en: 'Illegal activities or actions that harm other users are prohibited.' },
            { ko: '서비스에 대한 무단 크롤링, 스크래핑, 자동화된 접근은 금지됩니다.', en: 'Unauthorized crawling, scraping, or automated access is prohibited.' },
            { ko: '위반 시 관리자는 사전 고지 없이 계정을 정지하거나 삭제할 수 있습니다.', en: 'Violations may result in account suspension or deletion without notice.' },
        ]
    },
    {
        title: { ko: '콘텐츠 및 AI 서비스', en: 'Content & AI Services', ja: 'コンテンツとAIサービス', de: 'Inhalte & KI-Dienste', fr: 'Contenu & services IA', es: 'Contenido y servicios de IA', pt: 'Conteúdo e serviços de IA' },
        paragraphs: [
            { ko: '서비스에서 제공하는 미술관/작품 정보, AI 요약, 추천 결과, 자동 번역은 참고용이며 정확성·완전성·최신성을 보장하지 않습니다.', en: 'Museum/artwork information, AI summaries, recommendations, and translations are for reference only. Accuracy, completeness, and timeliness are not guaranteed.' },
            { ko: 'AI 기반 요약, 추천, 번역 기능은 외부 AI API를 활용할 수 있으며, 입력된 검색어와 서비스 이용 맥락이 기능 제공을 위해 처리될 수 있습니다.', en: 'AI summaries, recommendations, and translations may use external AI APIs. Search terms and service context may be processed to provide these features.' },
            { ko: '사용자가 작성한 리뷰, 여행 계획, 컬렉션, 피드백 등의 콘텐츠는 서비스 제공 및 개선 목적으로 활용될 수 있습니다.', en: 'User-generated reviews, trips, collections, and feedback may be used to provide and improve the service.' },
        ]
    },
    {
        title: { ko: '이미지 출처 및 라이선스', en: 'Image Sources & Licenses', ja: '画像の出典とライセンス', de: 'Bildquellen & Lizenzen', fr: 'Sources des images & licences', es: 'Fuentes de imágenes y licencias', pt: 'Fontes de imagens e licenças' },
        paragraphs: [
            { ko: '미술관 외관/실내 사진은 Google Places API를 통해 제공되며, Google의 이용약관에 따라 표시됩니다. 해당 사진에는 "Powered by Google" 출처가 표기됩니다.', en: 'Museum exterior/interior photos are provided via Google Places API and displayed per Google\'s terms. These photos are attributed with "Powered by Google".' },
            { ko: '작품 이미지는 Art Institute of Chicago, Metropolitan Museum of Art, Smithsonian 등의 오픈 액세스 API로부터 CC0(퍼블릭 도메인) 라이선스 하에 제공됩니다.', en: 'Artwork images are sourced from open access APIs (Art Institute of Chicago, Metropolitan Museum, Smithsonian) under CC0 (public domain) license.' },
            { ko: 'Wikimedia Commons의 CC-BY 라이선스 이미지를 사용하는 경우, 해당 저작자 출처가 함께 표시됩니다.', en: 'When using CC-BY licensed images from Wikimedia Commons, proper author attribution is displayed.' },
            { ko: '서비스에 표시된 이미지 중 저작권 관련 이의가 있는 경우 즉시 연락 주시면 확인 후 조치하겠습니다.', en: 'If you have copyright concerns about any displayed images, please contact us for prompt resolution.' },
        ]
    },
    {
        title: { ko: '데이터 출처 및 갱신 정책', en: 'Data Sources & Refresh Policy', ja: 'データソースと更新ポリシー', de: 'Datenquellen & Aktualisierung', fr: 'Sources de données & mise à jour', es: 'Fuentes de datos y actualización', pt: 'Fontes de dados e atualização' },
        paragraphs: [
            { ko: '미술관 위치, 평점, 운영시간 정보는 Google Maps Platform을 통해 수집될 수 있으며, 관람 정보와 교통 정보는 각 기관의 공식 사이트 및 공개 자료를 바탕으로 정리됩니다.', en: 'Museum locations, ratings, and opening hours may be sourced from Google Maps Platform. Visitor and transport information is curated from official websites and public sources.' },
            { ko: '서비스 품질 관리를 위해 각 미술관의 Google Place ID 등 공개 식별 정보를 저장할 수 있습니다.', en: 'Public identifiers such as Google Place IDs may be stored to maintain service quality.' },
            { ko: '실시간 정보는 해당 미술관의 공식 웹사이트를 참고하시기 바랍니다. 서비스에 표시된 평점, 운영시간 등은 수집 시점 기준이며 실제와 차이가 있을 수 있습니다.', en: 'For real-time information, please refer to the museum\'s official website. Displayed ratings, operating hours, and other data are based on the time of collection and may differ from current information.' },
        ]
    },
    {
        title: { ko: '저작권 및 지식재산권', en: 'Copyright & Intellectual Property', ja: '著作権と知的財産権', de: 'Urheberrecht & geistiges Eigentum', fr: 'Droits d\'auteur & propriété intellectuelle', es: 'Derechos de autor y propiedad intelectual', pt: 'Direitos autorais e propriedade intelectual' },
        paragraphs: [
            { ko: '서비스의 디자인, 로고, 소프트웨어 등에 대한 지식재산권은 Museum Map 운영진에게 있습니다.', en: 'Intellectual property rights for the design, logo, and software belong to the Museum Map team.' },
            { ko: '서비스에 표시된 이미지 중 저작권 관련 이의가 있는 경우 즉시 연락 주시면 확인 후 조치하겠습니다.', en: 'If you have copyright concerns about any displayed images, please contact us for prompt resolution.' },
            { ko: '사용자는 서비스 내 콘텐츠를 개인적, 비상업적 용도로만 이용할 수 있습니다.', en: 'Users may only use service content for personal, non-commercial purposes.' },
        ]
    },
    {
        title: { ko: '면책 조항', en: 'Disclaimer', ja: '免責事項', de: 'Haftungsausschluss', fr: 'Clause de non-responsabilité', es: 'Descargo de responsabilidad', pt: 'Isenção de responsabilidade' },
        paragraphs: [
            { ko: 'Museum Map은 미술관/박물관의 실제 운영 상황에 대해 책임지지 않습니다. 평점, 운영시간 등의 정보는 정기적으로 갱신되지만 실시간 데이터가 아닐 수 있습니다. 방문 전 해당 기관의 공식 웹사이트를 확인해 주세요.', en: 'Museum Map is not responsible for actual museum operations. Ratings, opening hours, and other information are periodically updated but may not reflect real-time data. Please check the official website before visiting.' },
            { ko: '서비스는 "있는 그대로(AS IS)" 제공되며, 특정 목적에의 적합성, 정확성에 대해 보증하지 않습니다.', en: 'The service is provided "AS IS" without warranties of fitness or accuracy.' },
            { ko: '천재지변, 시스템 장애 등 불가항력적 사유로 인한 서비스 중단에 대해 책임지지 않습니다.', en: 'The service is not liable for disruptions caused by force majeure or system failures.' },
            { ko: '본 약관에서 규정하지 않은 사항은 대한민국 관련 법령에 따릅니다.', en: 'Matters not covered by these terms are governed by the laws of South Korea.' },
        ]
    },
];

const privacySections: Section[] = [
    {
        title: { ko: '수집하는 개인정보', en: 'Information We Collect', ja: '収集する個人情報', de: 'Gesammelte Daten', fr: 'Informations collectées', es: 'Información recopilada', pt: 'Informações coletadas' },
        isList: true,
        paragraphs: [
            { ko: '이메일 주소, 프로필 이미지 (소셜 로그인 제공 정보)', en: 'Email address, profile image (from social login)' },
            { ko: '접속 IP, 브라우저 종류, 접속 시간, 페이지 열람 기록', en: 'IP address, browser type, access time, page views' },
            { ko: '미술관 리뷰, 여행 계획, 컬렉션, 피드백', en: 'Museum reviews, travel plans, collections, feedback' },
        ]
    },
    {
        title: { ko: '수집 목적', en: 'Purpose of Collection', ja: '収集目的', de: 'Zweck der Erhebung', fr: 'Objectif de la collecte', es: 'Propósito de la recopilación', pt: 'Finalidade da coleta' },
        isList: true,
        paragraphs: [
            { ko: '서비스 제공 및 계정 관리', en: 'Service provision and account management' },
            { ko: 'AI 기반 맞춤형 추천 (사용자 선호도 분석)', en: 'AI-powered personalized recommendations' },
            { ko: '서비스 이용 통계 및 품질 개선', en: 'Usage statistics and quality improvement' },
            { ko: '부정 이용 방지 및 서비스 안정성 확보', en: 'Fraud prevention and service stability' },
        ]
    },
    {
        title: { ko: '보관 및 파기', en: 'Retention & Deletion', ja: '保管と廃棄', de: 'Aufbewahrung & Löschung', fr: 'Conservation & suppression', es: 'Retención y eliminación', pt: 'Retenção e exclusão' },
        isList: true,
        paragraphs: [
            { ko: '계정 삭제 요청 시 30일 내 파기', en: 'Data deleted within 30 days of account deletion request' },
            { ko: '서비스 이용 기록: 최종 접속일로부터 1년간 보관 후 파기', en: 'Service usage logs: retained for 1 year from last access, then deleted' },
            { ko: '법적 의무에 따른 보관이 필요한 경우 해당 기간 동안 보관', en: 'Data may be retained as required by law for the applicable period' },
        ]
    },
    {
        title: { ko: '제3자 제공 및 외부 서비스', en: 'Third-Party Services', ja: '第三者提供と外部サービス', de: 'Drittanbieter-Dienste', fr: 'Services tiers', es: 'Servicios de terceros', pt: 'Serviços de terceiros' },
        paragraphs: [
            { ko: 'Google Analytics: 익명화된 사용 통계 수집', en: 'Google Analytics: anonymous usage statistics' },
            { ko: 'Google Gemini API: AI 추천/번역 시 사용자 쿼리 전송 (개인정보 미포함)', en: 'Google Gemini API: user queries for AI recommendations/translation (no personal data)' },
            { ko: 'Google Maps Platform (Places API): 미술관 사진, 주소, 평점, 운영시간 제공. 사진 표시 시 Google 출처를 표기합니다.', en: 'Google Maps Platform (Places API): museum photos, addresses, ratings, and opening hours. Google attribution is displayed alongside photos.' },
            { ko: '오픈 액세스 API (AIC, Met, Smithsonian): 퍼블릭 도메인(CC0) 작품 이미지 제공. 개인정보는 전송되지 않습니다.', en: 'Open access APIs (AIC, Met, Smithsonian): public domain (CC0) artwork images. No personal data is transmitted.' },
            { ko: '원칙적으로 제3자에게 개인정보를 제공하지 않습니다. 단, 법적 요구가 있는 경우 예외로 합니다.', en: 'We do not share personal data with third parties unless required by law.' },
        ]
    },
    {
        title: { ko: '쿠키 정책', en: 'Cookie Policy', ja: 'クッキーポリシー', de: 'Cookie-Richtlinie', fr: 'Politique de cookies', es: 'Política de cookies', pt: 'Política de cookies' },
        paragraphs: [
            { ko: '서비스는 세션 관리, 사용자 설정(언어, 다크 모드) 유지를 위해 쿠키를 사용합니다. 브라우저 설정을 통해 쿠키를 거부할 수 있으나, 일부 서비스 기능이 제한될 수 있습니다.', en: 'We use cookies for session management and user preferences (language, dark mode). You can disable cookies in your browser, but some features may be limited.' },
        ]
    },
    {
        title: { ko: '사용자 권리', en: 'Your Rights', ja: 'ユーザーの権利', de: 'Ihre Rechte', fr: 'Vos droits', es: 'Sus derechos', pt: 'Seus direitos' },
        isList: true,
        paragraphs: [
            { ko: '사용자는 언제든지 본인의 개인정보 열람, 수정, 삭제를 요청할 수 있습니다.', en: 'You can request access to, correction, or deletion of your personal data at any time.' },
            { ko: '개인정보 열람 및 사본 요청권', en: 'Right to access and obtain copies of your data' },
            { ko: '개인정보 수정 및 업데이트 요청권', en: 'Right to correct and update your data' },
            { ko: '계정 및 개인정보 삭제 요청권', en: 'Right to delete your account and data' },
            { ko: '마케팅 목적의 개인정보 이용 거부권', en: 'Right to opt out of marketing use of your data' },
        ]
    },
];

/* ── Component ─────────────────────────────────── */
export default function TermsPage() {
    const { locale } = useApp();
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab') === 'privacy' ? 'privacy' : 'terms';
    const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab);

    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const handleSwipeStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; touchStartY.current = e.touches[0].clientY; };
    const handleSwipeEnd = (e: React.TouchEvent) => {
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const dy = e.changedTouches[0].clientY - touchStartY.current;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx < 0 && activeTab === 'terms') setActiveTab('privacy');
            else if (dx > 0 && activeTab === 'privacy') setActiveTab('terms');
        }
    };

    const t = (s: L) => s[locale] || s['en'] || Object.values(s)[0];
    const sections = activeTab === 'terms' ? termsSections : privacySections;
    return (
        <div className="mm-legal-page2 mm-library-page2 no-back-swipe w-full max-w-[800px] mx-auto px-4 py-4 sm:px-6 sm:py-8 md:px-8 mt-4 sm:mt-8 pb-32 lg:pb-8 animate-fadeInUp" onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}>
            {/* PC: Back */}
            <button onClick={() => backWithFallback('/info', locale)} className="hidden lg:flex w-10 h-10 items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded-full mb-6 transition-colors shadow-sm active:scale-95">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <button onClick={() => setActiveTab('terms')} className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all ${activeTab === 'terms' ? 'gradient-btn text-white shadow-lg' : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'}`}>
                    <svg className="w-4 h-4 inline -mt-0.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>
                    {g('tabTerms', locale)}
                </button>
                <button onClick={() => setActiveTab('privacy')} className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all ${activeTab === 'privacy' ? 'gradient-btn text-white shadow-lg' : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'}`}>
                    <svg className="w-4 h-4 inline -mt-0.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                    {g('tabPrivacy', locale)}
                </button>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-gray-100 dark:border-neutral-800 shadow-sm overflow-hidden">
                <div className="p-6 sm:p-10">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight">
                        {activeTab === 'terms' ? g('tabTerms', locale) : g('tabPrivacy', locale)}
                    </h1>
                    <p className="text-xs text-gray-400 dark:text-neutral-500 mb-8">{g('lastUpdated', locale)}</p>

                    {sections.map((sec, idx) => (
                        <section key={idx} className={idx < sections.length - 1 ? 'mb-10' : ''}>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${activeTab === 'terms'
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                    : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                    }`}>{idx + 1}</span>
                                {t(sec.title)}
                            </h2>
                            {sec.isList ? (
                                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                    {sec.paragraphs.map((p, pi) => (
                                        <li key={pi} className="flex gap-2"><span className="text-gray-300 dark:text-neutral-600 select-none">•</span><span>{t(p)}</span></li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                    {sec.paragraphs.map((p, pi) => (
                                        <p key={pi}>{t(p)}</p>
                                    ))}
                                </div>
                            )}
                        </section>
                    ))}
                </div>
            </div>

            {/* Mobile: Floating back — portal to escape transform container */}
            {typeof document !== 'undefined' && createPortal(
                <div className="lg:hidden fixed bottom-8 right-8 z-[9998] flex flex-col gap-2">
                    <button
                        onClick={() => backWithFallback('/info', locale)}
                        className="w-14 h-14 flex items-center justify-center rounded-full bg-neutral-800/90 dark:bg-white/90 backdrop-blur-md text-white dark:text-gray-800 shadow-lg border border-neutral-700/60 dark:border-gray-200/60 active:scale-95 transition-all hover:bg-neutral-700 dark:hover:bg-gray-100"
                    >   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
}
