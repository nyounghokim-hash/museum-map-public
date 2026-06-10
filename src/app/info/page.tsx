'use client';
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useApp } from '@/components/AppContext';
import { useModal } from '@/components/ui/Modal';

interface InfoTexts {
    title: string; subtitle: string;
    feedback: string; feedbackDesc: string;
    terms: string; termsTitle: string; termsBody: string;
    privacy: string; privacyTitle: string; privacyBody: string;
    sources: string; sourcesTitle: string;
    mapData: string; imageData: string; museumData: string;
    disclaimer: string; disclaimerText: string;
    goFeedback: string;
    consentTitle: string; locationConsent: string; locationConsentDesc: string;
    marketingConsent: string; marketingConsentDesc: string;
}

const TEXTS: Record<string, InfoTexts> = {
    ko: {
        title: '이용 정보',
        subtitle: '서비스 이용에 대한 안내사항입니다.',
        feedback: '의견 보내기',
        feedbackDesc: '서비스 개선을 위한 의견을 보내주세요.',
        terms: '이용약관',
        termsTitle: '서비스 이용약관',
        termsBody: '본 서비스는 개인 프로젝트로 운영되며, 무료로 제공됩니다. 서비스 이용 시 발생하는 모든 데이터는 서비스 개선 목적으로만 사용됩니다.',
        privacy: '개인정보 처리방침',
        privacyTitle: '개인정보 처리방침',
        privacyBody: '개인정보는 서비스 이용에 필요한 최소한의 정보만 수집하며, 제3자에게 제공하지 않습니다. 소셜 로그인 시 이메일과 프로필 이름만 저장됩니다.',
        sources: '데이터 출처',
        sourcesTitle: '데이터 및 이미지 출처 · 라이선스',
        mapData: '지도: © OpenStreetMap contributors, MapLibre GL JS, © CARTO',
        imageData: '사진: Google Places API (2,086개), Wikimedia Commons (CC BY-SA/Public Domain)',
        museumData: '미술관/박물관 정보: Wikidata/Wikipedia (3,394개) · 평점/운영시간: Google Places API · 관람정보/교통: 각 기관 공식 사이트 기반 큐레이션 · 작품: Met Museum, Art Institute of Chicago, Cleveland Museum of Art (CC0) · 번역: Google Gemini AI (13개 언어)',
        disclaimer: '면책 사항',
        disclaimerText: '본 서비스에서 제공하는 박물관/미술관 정보(평점, 운영시간 등)는 수집 시점 기준의 참고용이며, 실시간 데이터가 아닐 수 있습니다. 정확한 정보는 각 기관의 공식 사이트를 확인해 주세요.',
        goFeedback: '의견 보내기 →',
        consentTitle: '수신 동의 설정',
        locationConsent: '위치정보 수신 동의',
        locationConsentDesc: '내 위치 기반 미술관 추천 및 위치순 정렬을 허용합니다.',
        marketingConsent: '마케팅 수신 동의',
        marketingConsentDesc: '새로운 전시, 이벤트 등 마케팅 알림을 받습니다.',
    },
    en: {
        title: 'Service Info',
        subtitle: 'Service information and guidelines.',
        feedback: 'Send Feedback',
        feedbackDesc: 'Help us improve the service with your feedback.',
        terms: 'Terms of Service',
        termsTitle: 'Terms of Service',
        termsBody: 'This service is operated as a personal project and provided free of charge. All data generated during use is solely used for service improvement.',
        privacy: 'Privacy Policy',
        privacyTitle: 'Privacy Policy',
        privacyBody: 'We collect minimal personal information necessary for service use and do not share it with third parties. Only email and profile name are stored via social login.',
        sources: 'Data Sources',
        sourcesTitle: 'Data & Image Sources · Licenses',
        mapData: 'Map: © OpenStreetMap contributors, MapLibre GL JS, © CARTO',
        imageData: 'Photos: Google Places API (2,086), Wikimedia Commons (CC BY-SA/Public Domain)',
        museumData: 'Museums: Wikidata/Wikipedia (3,394) · Ratings/Hours: Google Places API · Visitor Info/Transport: Curated from official sources · Artworks: Met Museum, AIC, Cleveland Museum of Art (CC0) · Translations: Google Gemini AI (13 languages)',
        disclaimer: 'Disclaimer',
        disclaimerText: 'Museum/gallery information (ratings, hours, etc.) is based on the time of collection and may not reflect real-time data. Please check official websites for accurate information.',
        goFeedback: 'Send Feedback →',
        consentTitle: 'Consent Settings',
        locationConsent: 'Location Consent',
        locationConsentDesc: 'Allow location-based museum recommendations and nearby sorting.',
        marketingConsent: 'Marketing Consent',
        marketingConsentDesc: 'Receive notifications about new exhibitions and events.',
    },
    ja: {
        title: '利用情報',
        subtitle: 'サービスに関するご案内です。',
        feedback: 'フィードバック',
        feedbackDesc: 'サービス向上のためにご意見をお聞かせください。',
        terms: '利用規約',
        termsTitle: '利用規約',
        termsBody: '本サービスは個人プロジェクトとして運営されており、無料で提供されています。利用中に発生するすべてのデータは、サービス改善の目的でのみ使用されます。',
        privacy: 'プライバシーポリシー',
        privacyTitle: 'プライバシーポリシー',
        privacyBody: '個人情報はサービスの利用に必要な最小限の情報のみ収集し、第三者に提供しません。ソーシャルログイン時にメールアドレスとプロフィール名のみ保存されます。',
        sources: 'データソース',
        sourcesTitle: 'データ・画像ソース',
        mapData: '地図データ: © OpenStreetMap contributors, © CARTO',
        imageData: '画像: Wikipedia、各博物館/美術館公式サイト',
        museumData: '博物館情報: 各博物館/美術館公式サイトおよび公開データ',
        disclaimer: '免責事項',
        disclaimerText: '提供する博物館/美術館情報は参考用です。正確な営業時間や入場料は各機関の公式サイトをご確認ください。',
        goFeedback: 'フィードバックへ →',
        consentTitle: '同意設定',
        locationConsent: '位置情報の同意',
        locationConsentDesc: '位置情報に基づく美術館の推薦と距離順の並び替えを許可します。',
        marketingConsent: 'マーケティングの同意',
        marketingConsentDesc: '新しい展覧会やイベントに関する通知を受け取ります。',
    },
    de: {
        title: 'Serviceinformation',
        subtitle: 'Informationen und Richtlinien zum Service.',
        feedback: 'Feedback senden',
        feedbackDesc: 'Helfen Sie uns, den Service mit Ihrem Feedback zu verbessern.',
        terms: 'Nutzungsbedingungen',
        termsTitle: 'Nutzungsbedingungen',
        termsBody: 'Dieser Dienst wird als persönliches Projekt betrieben und kostenlos angeboten. Alle bei der Nutzung generierten Daten werden ausschließlich zur Verbesserung des Dienstes verwendet.',
        privacy: 'Datenschutzrichtlinie',
        privacyTitle: 'Datenschutzrichtlinie',
        privacyBody: 'Wir erheben nur die für die Nutzung des Dienstes erforderlichen Mindestinformationen und geben diese nicht an Dritte weiter. Beim Social Login werden nur E-Mail und Profilname gespeichert.',
        sources: 'Datenquellen',
        sourcesTitle: 'Daten- & Bildquellen',
        mapData: 'Kartendaten: © OpenStreetMap contributors, © CARTO',
        imageData: 'Bilder: Wikipedia, offizielle Museum-/Galerie-Websites',
        museumData: 'Museumsinformationen: Offizielle Museum-/Galerie-Websites und öffentliche Daten',
        disclaimer: 'Haftungsausschluss',
        disclaimerText: 'Die bereitgestellten Museum-/Galerie-Informationen dienen nur als Referenz. Bitte prüfen Sie die offiziellen Websites für genaue Öffnungszeiten und Eintrittspreise.',
        goFeedback: 'Feedback senden →',
        consentTitle: 'Einstellungen', locationConsent: 'Standortzustimmung', locationConsentDesc: 'Standortbasierte Museumsempfehlungen und Sortierung ermöglichen.', marketingConsent: 'Marketing-Zustimmung', marketingConsentDesc: 'Benachrichtigungen über neue Ausstellungen und Veranstaltungen erhalten.',
    },
    fr: {
        title: 'Informations',
        subtitle: 'Informations et directives du service.',
        feedback: 'Envoyer un commentaire',
        feedbackDesc: 'Aidez-nous à améliorer le service avec vos commentaires.',
        terms: 'Conditions d\'utilisation',
        termsTitle: 'Conditions d\'utilisation',
        termsBody: 'Ce service est exploité comme un projet personnel et fourni gratuitement. Toutes les données générées lors de l\'utilisation sont uniquement utilisées pour l\'amélioration du service.',
        privacy: 'Politique de confidentialité',
        privacyTitle: 'Politique de confidentialité',
        privacyBody: 'Nous collectons uniquement les informations personnelles minimales nécessaires à l\'utilisation du service et ne les partageons pas avec des tiers. Seuls l\'e-mail et le nom de profil sont enregistrés via la connexion sociale.',
        sources: 'Sources des données',
        sourcesTitle: 'Sources des données et images',
        mapData: 'Données cartographiques : © OpenStreetMap contributors, © CARTO',
        imageData: 'Images : Wikipédia, sites officiels des musées/galeries',
        museumData: 'Informations muséales : Sites officiels et données publiques',
        disclaimer: 'Avertissement',
        disclaimerText: 'Les informations fournies sur les musées/galeries sont à titre indicatif uniquement. Veuillez consulter les sites officiels pour les horaires et tarifs exacts.',
        goFeedback: 'Envoyer un commentaire →',
        consentTitle: 'Paramètres', locationConsent: 'Consentement de localisation', locationConsentDesc: 'Autoriser les recommandations basées sur la localisation.', marketingConsent: 'Consentement marketing', marketingConsentDesc: 'Recevoir des notifications sur les nouvelles expositions.',
    },
    es: {
        title: 'Información',
        subtitle: 'Información y directrices del servicio.',
        feedback: 'Enviar comentario',
        feedbackDesc: 'Ayúdanos a mejorar el servicio con tus comentarios.',
        terms: 'Términos de servicio',
        termsTitle: 'Términos de servicio',
        termsBody: 'Este servicio se opera como un proyecto personal y se ofrece de forma gratuita. Todos los datos generados durante el uso se utilizan únicamente para mejorar el servicio.',
        privacy: 'Política de privacidad',
        privacyTitle: 'Política de privacidad',
        privacyBody: 'Recopilamos la información personal mínima necesaria para el uso del servicio y no la compartimos con terceros. Solo se almacenan el correo electrónico y el nombre de perfil mediante el inicio de sesión social.',
        sources: 'Fuentes de datos',
        sourcesTitle: 'Fuentes de datos e imágenes',
        mapData: 'Datos del mapa: © OpenStreetMap contributors, © CARTO',
        imageData: 'Imágenes: Wikipedia, sitios oficiales de museos/galerías',
        museumData: 'Información de museos: Sitios oficiales y datos públicos',
        disclaimer: 'Descargo de responsabilidad',
        disclaimerText: 'La información proporcionada sobre museos/galerías es solo de referencia. Consulte los sitios oficiales para horarios y precios exactos.',
        goFeedback: 'Enviar comentario →',
        consentTitle: 'Ajustes', locationConsent: 'Consentimiento de ubicación', locationConsentDesc: 'Permitir recomendaciones basadas en ubicación.', marketingConsent: 'Consentimiento de marketing', marketingConsentDesc: 'Recibir notificaciones sobre nuevas exposiciones y eventos.',
    },
    pt: {
        title: 'Informações',
        subtitle: 'Informações e diretrizes do serviço.',
        feedback: 'Enviar feedback',
        feedbackDesc: 'Ajude-nos a melhorar o serviço com o seu feedback.',
        terms: 'Termos de serviço',
        termsTitle: 'Termos de serviço',
        termsBody: 'Este serviço é operado como um projeto pessoal e fornecido gratuitamente. Todos os dados gerados durante o uso são utilizados exclusivamente para melhoria do serviço.',
        privacy: 'Política de privacidade',
        privacyTitle: 'Política de privacidade',
        privacyBody: 'Coletamos apenas as informações pessoais mínimas necessárias para o uso do serviço e não as compartilhamos com terceiros. Apenas e-mail e nome de perfil são armazenados via login social.',
        sources: 'Fontes de dados',
        sourcesTitle: 'Fontes de dados e imagens',
        mapData: 'Dados do mapa: © OpenStreetMap contributors, © CARTO',
        imageData: 'Imagens: Wikipédia, sites oficiais de museus/galerias',
        museumData: 'Informações de museus: Sites oficiais e dados públicos',
        disclaimer: 'Aviso legal',
        disclaimerText: 'As informações fornecidas sobre museus/galerias são apenas para referência. Consulte os sites oficiais para horários e preços exatos.',
        goFeedback: 'Enviar feedback →',
        consentTitle: 'Configurações', locationConsent: 'Consentimento de localização', locationConsentDesc: 'Permitir recomendações baseadas em localização.', marketingConsent: 'Consentimento de marketing', marketingConsentDesc: 'Receber notificações sobre novas exposições e eventos.',
    },
    'zh-CN': {
        title: '使用信息',
        subtitle: '服务信息和使用指南。',
        feedback: '发送反馈',
        feedbackDesc: '请提供您的反馈意见帮助我们改善服务。',
        terms: '服务条款',
        termsTitle: '服务条款',
        termsBody: '本服务作为个人项目运营，免费提供。使用过程中产生的所有数据仅用于服务改善。',
        privacy: '隐私政策',
        privacyTitle: '隐私政策',
        privacyBody: '我们仅收集服务使用所需的最少个人信息，不与第三方共享。社交登录时仅存储电子邮件和个人资料名称。',
        sources: '数据来源',
        sourcesTitle: '数据与图片来源',
        mapData: '地图数据：© OpenStreetMap contributors、© CARTO',
        imageData: '图片：维基百科、各博物馆/美术馆官方网站',
        museumData: '博物馆信息：各博物馆/美术馆官方网站及公开数据',
        disclaimer: '免责声明',
        disclaimerText: '提供的博物馆/美术馆信息仅供参考。请查看官方网站获取准确的营业时间和门票信息。',
        goFeedback: '发送反馈 →',
        consentTitle: '设置', locationConsent: '位置同意', locationConsentDesc: '允许基于位置的博物馆推荐和排序。', marketingConsent: '营销同意', marketingConsentDesc: '接收新展览和活动的通知。',
    },
    'zh-TW': {
        title: '使用資訊',
        subtitle: '服務資訊和使用指南。',
        feedback: '發送回饋',
        feedbackDesc: '請提供您的回饋意見幫助我們改善服務。',
        terms: '服務條款',
        termsTitle: '服務條款',
        termsBody: '本服務作為個人專案運營，免費提供。使用過程中產生的所有數據僅用於服務改善。',
        privacy: '隱私政策',
        privacyTitle: '隱私政策',
        privacyBody: '我們僅收集服務使用所需的最少個人資訊，不與第三方共享。社交登入時僅儲存電子郵件和個人資料名稱。',
        sources: '資料來源',
        sourcesTitle: '資料與圖片來源',
        mapData: '地圖資料：© OpenStreetMap contributors、© CARTO',
        imageData: '圖片：維基百科、各博物館/美術館官方網站',
        museumData: '博物館資訊：各博物館/美術館官方網站及公開資料',
        disclaimer: '免責聲明',
        disclaimerText: '提供的博物館/美術館資訊僅供參考。請查看官方網站獲取準確的營業時間和門票資訊。',
        goFeedback: '發送回饋 →',
        consentTitle: '設定', locationConsent: '位置同意', locationConsentDesc: '允許基於位置的博物館推薦和排序。', marketingConsent: '行銷同意', marketingConsentDesc: '接收新展覽和活動的通知。',
    },
    da: {
        title: 'Information',
        subtitle: 'Serviceinformation og retningslinjer.',
        feedback: 'Send feedback',
        feedbackDesc: 'Hjælp os med at forbedre tjenesten med din feedback.',
        terms: 'Servicevilkår',
        termsTitle: 'Servicevilkår',
        termsBody: 'Denne tjeneste drives som et personligt projekt og tilbydes gratis. Alle data genereret under brug anvendes udelukkende til forbedring af tjenesten.',
        privacy: 'Privatlivspolitik',
        privacyTitle: 'Privatlivspolitik',
        privacyBody: 'Vi indsamler kun de nødvendige personlige oplysninger til brug af tjenesten og deler dem ikke med tredjeparter. Kun e-mail og profilnavn gemmes via socialt login.',
        sources: 'Datakilder',
        sourcesTitle: 'Data- og billedkilder',
        mapData: 'Kortdata: © OpenStreetMap contributors, © CARTO',
        imageData: 'Billeder: Wikipedia, officielle museums-/gallerisider',
        museumData: 'Museumsinformation: Officielle sider og offentlige data',
        disclaimer: 'Ansvarsfraskrivelse',
        disclaimerText: 'De angivne museums-/gallerioplysninger er kun til reference. Se venligst officielle hjemmesider for nøjagtige åbningstider og priser.',
        goFeedback: 'Send feedback →',
        consentTitle: 'Indstillinger', locationConsent: 'Placeringssamtykke', locationConsentDesc: 'Tillad placeringsbaserede anbefalinger.', marketingConsent: 'Marketingsamtykke', marketingConsentDesc: 'Modtag notifikationer om nye udstillinger.',
    },
    fi: {
        title: 'Tiedot',
        subtitle: 'Palvelun tiedot ja ohjeet.',
        feedback: 'Lähetä palautetta',
        feedbackDesc: 'Auta meitä parantamaan palvelua palautteellasi.',
        terms: 'Käyttöehdot',
        termsTitle: 'Käyttöehdot',
        termsBody: 'Tämä palvelu toimii henkilökohtaisena projektina ja tarjotaan maksutta. Kaikki käytön aikana syntyvät tiedot käytetään ainoastaan palvelun parantamiseen.',
        privacy: 'Tietosuojakäytäntö',
        privacyTitle: 'Tietosuojakäytäntö',
        privacyBody: 'Keräämme vain palvelun käyttöön tarvittavat vähimmäistiedot emmekä jaa niitä kolmansille osapuolille. Sosiaalisen kirjautumisen yhteydessä tallennetaan vain sähköposti ja profiilin nimi.',
        sources: 'Tietolähteet',
        sourcesTitle: 'Tieto- ja kuvalähteet',
        mapData: 'Karttatiedot: © OpenStreetMap contributors, © CARTO',
        imageData: 'Kuvat: Wikipedia, museoiden/gallerioiden viralliset sivustot',
        museumData: 'Museotiedot: Viralliset sivustot ja julkiset tiedot',
        disclaimer: 'Vastuuvapauslauseke',
        disclaimerText: 'Tarjotut museo-/galleriatiedot ovat vain viitteellisiä. Tarkista virallisilta sivustoilta tarkat aukioloajat ja pääsymaksut.',
        goFeedback: 'Lähetä palautetta →',
        consentTitle: 'Asetukset', locationConsent: 'Sijaintisuostumus', locationConsentDesc: 'Salli sijaintiin perustuvat suositukset.', marketingConsent: 'Markkinointisuostumus', marketingConsentDesc: 'Vastaanota ilmoituksia uusista näyttelyistä.',
    },
    sv: {
        title: 'Information',
        subtitle: 'Serviceinformation och riktlinjer.',
        feedback: 'Skicka feedback',
        feedbackDesc: 'Hjälp oss att förbättra tjänsten med din feedback.',
        terms: 'Användarvillkor',
        termsTitle: 'Användarvillkor',
        termsBody: 'Denna tjänst drivs som ett personligt projekt och erbjuds gratis. All data som genereras under användning används enbart för att förbättra tjänsten.',
        privacy: 'Integritetspolicy',
        privacyTitle: 'Integritetspolicy',
        privacyBody: 'Vi samlar endast in den minsta nödvändiga personliga informationen för tjänstens användning och delar den inte med tredje part. Endast e-post och profilnamn lagras via social inloggning.',
        sources: 'Datakällor',
        sourcesTitle: 'Data- och bildkällor',
        mapData: 'Kartdata: © OpenStreetMap contributors, © CARTO',
        imageData: 'Bilder: Wikipedia, officiella museum-/gallerisajter',
        museumData: 'Museuminformation: Officiella sajter och offentliga data',
        disclaimer: 'Ansvarsfriskrivning',
        disclaimerText: 'All museum-/galleriinformation är enbart för referens. Kontrollera officiella webbplatser för exakta öppettider och priser.',
        goFeedback: 'Skicka feedback →',
        consentTitle: 'Inställningar', locationConsent: 'Platssamtycke', locationConsentDesc: 'Tillåt platsbaserade rekommendationer.', marketingConsent: 'Marknadsföringssamtycke', marketingConsentDesc: 'Ta emot meddelanden om nya utställningar.',
    },
    et: {
        title: 'Teave',
        subtitle: 'Teenuse teave ja juhised.',
        feedback: 'Saada tagasiside',
        feedbackDesc: 'Aidake meil teenust oma tagasisidega parandada.',
        terms: 'Kasutustingimused',
        termsTitle: 'Kasutustingimused',
        termsBody: 'See teenus toimib isikliku projektina ja on tasuta. Kõiki kasutamise käigus tekkivaid andmeid kasutatakse ainult teenuse parandamiseks.',
        privacy: 'Privaatsuspoliitika',
        privacyTitle: 'Privaatsuspoliitika',
        privacyBody: 'Kogume ainult teenuse kasutamiseks vajalikku minimaalset isiklikku teavet ega jaga seda kolmandate osapooltega. Sotsiaalse sisselogimise kaudu salvestatakse ainult e-post ja profiilinimi.',
        sources: 'Andmeallikad',
        sourcesTitle: 'Andme- ja pildiallikad',
        mapData: 'Kaardidandmed: © OpenStreetMap contributors, © CARTO',
        imageData: 'Pildid: Vikipeedia, muuseumide/galeriide ametlikud veebilehed',
        museumData: 'Muuseumiteave: Ametlikud veebilehed ja avalikud andmed',
        disclaimer: 'Vastutusest loobumine',
        disclaimerText: 'Esitatud muuseumi-/galeriiteave on ainult viitamiseks. Täpsete lahtiolekuaegade ja piletihindade jaoks kontrollige ametlikke veebilehti.',
        goFeedback: 'Saada tagasiside →',
        consentTitle: 'Seaded', locationConsent: 'Asukohanõusolek', locationConsentDesc: 'Luba asukohapõhised soovitused.', marketingConsent: 'Turundusluba', marketingConsentDesc: 'Saa teateid uutest näitustest.',
    },
};

function getTexts(locale: string) {
    return TEXTS[locale] || TEXTS.en;
}

/* Reusable SVG icon components */
const MapIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
    </svg>
);
const PhotoIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
    </svg>
);
const BuildingIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
    </svg>
);

export default function InfoPage() {
    const { locale } = useApp();
    const router = useRouter();
    const { data: session } = useSession();
    const { showAlert, showConfirm } = useModal();
    const baseTx = getTexts(locale);

    // Fetch dynamic counts
    const [museumCount, setMuseumCount] = useState(3505);
    const [photoCount, setPhotoCount] = useState(2200);
    useEffect(() => {
        fetch('/api/museums?limit=1').then(r => r.json()).then(res => {
            if (res.data?.total) setMuseumCount(res.data.total);
        }).catch(() => {});
        fetch('/api/admin/dashboard').then(r => r.json()).then(res => {
            if (res.data?.photos) setPhotoCount(res.data.photos);
        }).catch(() => {});
    }, []);

    // Replace hardcoded counts in texts with dynamic values
    const tx = useMemo(() => ({
        ...baseTx,
        imageData: baseTx.imageData.replace(/[\d,]+(?=\))/, photoCount.toLocaleString()),
        museumData: baseTx.museumData.replace(/[\d,]+(?=개\)|\))/, museumCount.toLocaleString()),
    }), [baseTx, museumCount, photoCount]);

    const isLoggedIn = session && !session.user?.name?.startsWith('guest_');
    const [locationConsent, setLocationConsent] = useState(false);
    const [marketingConsent, setMarketingConsent] = useState(false);
    const [consentLoaded, setConsentLoaded] = useState(false);

    useEffect(() => {
        if (!isLoggedIn) return;
        fetch('/api/me/consent').then(r => r.json()).then(data => {
            if (data.locationConsent !== undefined) setLocationConsent(data.locationConsent);
            if (data.marketingConsent !== undefined) setMarketingConsent(data.marketingConsent);
            setConsentLoaded(true);
        }).catch(() => { });
    }, [isLoggedIn]);

    // Consent modal texts — GDPR / ePrivacy compliant
    const consentModals: Record<string, { locTitle: string; locDenied: string; mktTitle: string; mktBody: string; mktOff: string }> = {
        ko: {
            locTitle: '위치정보 이용 동의',
            locDenied: '현재 위치를 사용하려면 브라우저에서 위치 접근을 허용해 주세요.\n설정 > 개인정보 보호 > 위치 서비스에서 변경할 수 있습니다.',
            mktTitle: '마케팅 정보 수신 동의',
            mktBody: '새로운 전시·이벤트 안내, 추천 미술관 소식을\n앱 내 알림으로 받아보시겠어요?\n\n· 저장한 미술관, 관심 지역 기반 맞춤 알림\n· 설정에서 언제든 해제 가능\n\n* 동의하지 않아도 서비스 이용에 제한이 없습니다.',
            mktOff: '마케팅 수신 동의가 해제되었습니다.\n더 이상 마케팅 관련 알림을 받지 않습니다.',
        },
        en: {
            locTitle: 'Location Access Consent',
            locDenied: 'Please allow location access in your browser.\nYou can change this in Settings > Privacy > Location Services.',
            mktTitle: 'Marketing Communications Consent',
            mktBody: 'Do you agree to receive the following?\n\n· Content: New exhibition & event announcements, museum recommendations\n· Method: In-app notifications\n· Data used: Saved museums, areas of interest\n· Withdrawal: You can opt out anytime in Settings\n\n* You may use the service without consent.',
            mktOff: 'Marketing consent has been withdrawn.\nYou will no longer receive marketing notifications.',
        },
        ja: {
            locTitle: '位置情報利用の同意',
            locDenied: 'ブラウザで位置情報の許可をしてください。\n設定 > プライバシー > 位置情報サービスで変更できます。',
            mktTitle: 'マーケティング情報受信の同意',
            mktBody: '以下の内容に同意しますか？\n\n· 受信内容：新しい展覧会・イベントのお知らせ、おすすめ美術館\n· 受信方法：アプリ内通知\n· 利用情報：保存した美術館、関心地域\n· 撤回方法：設定ページからいつでも解除可能\n\n※ 同意しなくてもサービス利用に制限はありません。',
            mktOff: 'マーケティング同意が解除されました。\n今後マーケティング通知は届きません。',
        },
        de: {
            locTitle: 'Standortzugriff',
            locDenied: 'Bitte erlauben Sie den Standortzugriff in Ihrem Browser.',
            mktTitle: 'Marketing-Einwilligung',
            mktBody: 'Stimmen Sie dem Erhalt folgender Mitteilungen zu?\n\n· Inhalt: Neue Ausstellungen, Veranstaltungen, Empfehlungen\n· Methode: In-App-Benachrichtigungen\n· Genutzte Daten: Gespeicherte Museen, Interessengebiete\n· Widerruf: Jederzeit in den Einstellungen\n\n* Der Service ist auch ohne Zustimmung nutzbar.',
            mktOff: 'Marketing-Einwilligung wurde widerrufen.',
        },
        fr: {
            locTitle: 'Accès à la localisation',
            locDenied: 'Veuillez autoriser l\'accès à la localisation dans votre navigateur.',
            mktTitle: 'Consentement marketing',
            mktBody: 'Acceptez-vous de recevoir:\n\n· Contenu: Nouvelles expositions, événements, recommandations\n· Méthode: Notifications in-app\n· Données: Musées sauvegardés, centres d\'intérêt\n· Retrait: À tout moment dans les paramètres\n\n* Le service reste accessible sans consentement.',
            mktOff: 'Le consentement marketing a été retiré.',
        },
        es: {
            locTitle: 'Acceso a ubicación',
            locDenied: 'Permita el acceso a la ubicación en su navegador.',
            mktTitle: 'Consentimiento de marketing',
            mktBody: '¿Acepta recibir lo siguiente?\n\n· Contenido: Nuevas exposiciones, eventos, recomendaciones\n· Método: Notificaciones en la app\n· Datos: Museos guardados, áreas de interés\n· Revocación: En cualquier momento desde Ajustes\n\n* El servicio es accesible sin consentimiento.',
            mktOff: 'El consentimiento de marketing ha sido revocado.',
        },
        pt: {
            locTitle: 'Acesso à localização',
            locDenied: 'Permita o acesso à localização no seu navegador.',
            mktTitle: 'Consentimento de marketing',
            mktBody: 'Você concorda em receber:\n\n· Conteúdo: Novas exposições, eventos, recomendações\n· Método: Notificações no app\n· Dados: Museus salvos, áreas de interesse\n· Revogação: A qualquer momento nas Configurações\n\n* O serviço pode ser usado sem consentimento.',
            mktOff: 'O consentimento de marketing foi revogado.',
        },
        'zh-CN': {
            locTitle: '位置访问',
            locDenied: '请在浏览器中允许位置访问。',
            mktTitle: '营销通讯同意',
            mktBody: '您是否同意接收以下内容？\n\n· 内容：新展览、活动通知、博物馆推荐\n· 方式：应用内通知\n· 使用数据：收藏的博物馆、感兴趣的地区\n· 撤回：可随时在设置中取消\n\n* 不同意也不影响服务使用。',
            mktOff: '营销同意已撤回。',
        },
        'zh-TW': {
            locTitle: '位置存取',
            locDenied: '請在瀏覽器中允許位置存取。',
            mktTitle: '行銷通訊同意',
            mktBody: '您是否同意接收以下內容？\n\n· 內容：新展覽、活動通知、博物館推薦\n· 方式：應用內通知\n· 使用資料：收藏的博物館、感興趣的地區\n· 撤回：可隨時在設定中取消\n\n* 不同意也不影響服務使用。',
            mktOff: '行銷同意已撤回。',
        },
        da: {
            locTitle: 'Placeringsadgang',
            locDenied: 'Tillad venligst placeringsadgang i din browser.',
            mktTitle: 'Marketing-samtykke',
            mktBody: 'Accepterer du at modtage:\n\n· Indhold: Nye udstillinger, begivenheder, anbefalinger\n· Metode: In-app notifikationer\n· Data: Gemte museer, interesseområder\n· Tilbagetrækning: Når som helst i Indstillinger\n\n* Tjenesten kan bruges uden samtykke.',
            mktOff: 'Marketing-samtykke er trukket tilbage.',
        },
        fi: {
            locTitle: 'Sijainnin käyttö',
            locDenied: 'Salli sijainnin käyttö selaimessasi.',
            mktTitle: 'Markkinointisuostumus',
            mktBody: 'Hyväksytkö seuraavat:\n\n· Sisältö: Uudet näyttelyt, tapahtumat, suositukset\n· Tapa: Sovelluksen sisäiset ilmoitukset\n· Tiedot: Tallennetut museot, kiinnostusalueet\n· Peruutus: Milloin tahansa asetuksissa\n\n* Palvelu on käytettävissä ilman suostumusta.',
            mktOff: 'Markkinointisuostumus on peruutettu.',
        },
        sv: {
            locTitle: 'Platsåtkomst',
            locDenied: 'Tillåt platsåtkomst i din webbläsare.',
            mktTitle: 'Marknadsföringssamtycke',
            mktBody: 'Godkänner du att ta emot:\n\n· Innehåll: Nya utställningar, evenemang, rekommendationer\n· Metod: Meddelanden i appen\n· Data: Sparade museer, intresseområden\n· Återkallelse: När som helst i Inställningar\n\n* Tjänsten kan användas utan samtycke.',
            mktOff: 'Marknadsföringssamtycke har återkallats.',
        },
        et: {
            locTitle: 'Asukoha juurdepääs',
            locDenied: 'Palun lubage asukoha juurdepääs oma brauseris.',
            mktTitle: 'Turundusnõusolek',
            mktBody: 'Kas nõustute saama:\n\n· Sisu: Uued näitused, üritused, soovitused\n· Meetod: Rakendusesisesed teated\n· Andmed: Salvestatud muuseumid, huvikohad\n· Tagasivõtmine: Igal ajal seadetes\n\n* Teenust saab kasutada ilma nõusolekuta.',
            mktOff: 'Turundusnõusolek on tagasi võetud.',
        },
    };
    const cm = consentModals[locale] || consentModals['en'];

    const toggleConsent = (field: 'locationConsent' | 'marketingConsent', value: boolean) => {
        // Location consent ON → trigger browser geolocation permission prompt
        if (field === 'locationConsent' && value) {
            if (!navigator.geolocation) {
                showAlert(cm.locDenied);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                () => {
                    setLocationConsent(true);
                    fetch('/api/me/consent', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ locationConsent: true })
                    });
                },
                () => {
                    setLocationConsent(false);
                    showAlert(cm.locDenied);
                }
            );
            return;
        }

        // Marketing consent ON → GDPR-compliant confirmation modal
        if (field === 'marketingConsent' && value) {
            showConfirm(cm.mktBody, () => {
                setMarketingConsent(true);
                fetch('/api/me/consent', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ marketingConsent: true })
                });
            }, cm.mktTitle);
            return;
        }

        // Marketing consent OFF → notify user
        if (field === 'marketingConsent' && !value) {
            setMarketingConsent(false);
            fetch('/api/me/consent', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ marketingConsent: false })
            });
            showAlert(cm.mktOff);
            return;
        }

        // Location consent OFF
        if (field === 'locationConsent') setLocationConsent(value);
        fetch('/api/me/consent', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: value })
        });
    };

    return (
        <div className="mm-legal-page2 mm-library-page2 no-back-swipe w-full max-w-[640px] mx-auto px-4 py-6 sm:px-6 sm:py-10 mt-2 sm:mt-6 animate-fadeInUp">
            <div className="mb-6 sm:mb-8">
                <div className="flex items-center gap-2.5">
                    <h1 className="text-xl sm:text-2xl font-bold dark:text-white">{tx.title}</h1>
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 tracking-wide">v1.6.0</span>
                </div>
                <p className="text-gray-400 dark:text-gray-500 mt-1 text-xs">{tx.subtitle}</p>
            </div>

            <div className="flex flex-col gap-3">
                {/* Consent Toggles — logged-in users only */}
                {isLoggedIn && consentLoaded && (
                    <div className="border rounded-xl px-4 py-3.5" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-white">{tx.consentTitle}</p>
                        </div>
                        <div className="space-y-4 ml-11">
                            {/* Location Consent */}
                            <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{tx.locationConsent}</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{tx.locationConsentDesc}</p>
                                </div>
                                <button
                                    onClick={() => toggleConsent('locationConsent', !locationConsent)}
                                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out cursor-pointer focus:outline-none ${locationConsent ? 'bg-blue-600' : 'bg-gray-200 dark:bg-neutral-700'}`}
                                >
                                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${locationConsent ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                            {/* Marketing Consent */}
                            <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{tx.marketingConsent}</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{tx.marketingConsentDesc}</p>
                                </div>
                                <button
                                    onClick={() => toggleConsent('marketingConsent', !marketingConsent)}
                                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out cursor-pointer focus:outline-none ${marketingConsent ? 'bg-blue-600' : 'bg-gray-200 dark:bg-neutral-700'}`}
                                >
                                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${marketingConsent ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* Feedback */}
                <Link href="/feedback" className="block group">
                    <div className="flex items-center gap-3 border rounded-xl px-4 py-3.5 hover:border-blue-300 dark:hover:border-blue-700 transition-all" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                            </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{tx.feedback}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{tx.feedbackDesc}</p>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                    </div>
                </Link>

                {/* Terms — link to /terms */}
                <Link href="/terms" className="block group">
                    <div className="flex items-start gap-3 border rounded-xl px-4 py-3.5 hover:border-blue-300 dark:hover:border-blue-700 transition-all" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
                        <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-neutral-800 flex items-center justify-center shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{tx.termsTitle}</p>
                            <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">2026.03.17</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 leading-relaxed">{tx.termsBody}</p>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                    </div>
                </Link>

                {/* Privacy — link to /terms?tab=privacy */}
                <Link href="/terms?tab=privacy" className="block group">
                    <div className="flex items-start gap-3 border rounded-xl px-4 py-3.5 hover:border-blue-300 dark:hover:border-blue-700 transition-all" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
                        <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-neutral-800 flex items-center justify-center shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                            </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{tx.privacyTitle}</p>
                            <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">2026.03.17</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 leading-relaxed">{tx.privacyBody}</p>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                    </div>
                </Link>

                {/* Data Sources */}
                <div className="border rounded-xl px-4 py-3.5" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                            </svg>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-white">{tx.sourcesTitle}</p>
                    </div>
                    <div className="space-y-2 ml-11">
                        <div className="flex items-start gap-2">
                            <MapIcon className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-gray-400 dark:text-gray-500">{tx.mapData}</p>
                        </div>
                        <div className="flex items-start gap-2">
                            <PhotoIcon className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-gray-400 dark:text-gray-500">{tx.imageData}</p>
                        </div>
                        <div className="flex items-start gap-2">
                            <BuildingIcon className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-gray-400 dark:text-gray-500">{tx.museumData}</p>
                        </div>
                    </div>
                </div>

                {/* Disclaimer */}
                <div className="flex items-start gap-3 bg-amber-50/50 dark:bg-amber-900/5 border border-amber-100 dark:border-amber-900/20 rounded-xl px-4 py-3.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-100/80 dark:bg-amber-900/20 flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-amber-500 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-white">{tx.disclaimer}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 leading-relaxed">{tx.disclaimerText}</p>
                    </div>
                </div>
            </div>

            {/* Mobile: Floating back — portal to escape transform container */}
            {typeof document !== 'undefined' && createPortal(
                <div className="lg:hidden fixed bottom-8 right-8 z-[9998] flex flex-col gap-2">
                    <button
                        onClick={() => { if (typeof window !== 'undefined') sessionStorage.setItem('navigating-back', String(Date.now())); router.back(); }}
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
