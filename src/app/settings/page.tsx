'use client';

import { signOut, useSession } from 'next-auth/react';
import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '@/components/AppContext';
import { LOCALE_NAMES, type Locale } from '@/lib/i18n';
import LoginRequiredModal from '@/components/ui/LoginRequiredModal';
import { clearClientAccountStateForLogout } from '@/lib/client-account-state';

type MapSettingKey = 'location' | 'nearby' | 'weather' | 'leftHanded';
type MapPrefs = Record<MapSettingKey, boolean>;
type MapLocationSource = 'current' | 'manual';

const MAP_PREF_KEYS: Record<MapSettingKey, string> = {
  location: 'mm_map_show_location',
  nearby: 'mm_map_show_nearby',
  weather: 'mm_map_show_weather',
  leftHanded: 'mm_map_left_handed_mode',
};

const DEFAULT_MAP_PREFS: MapPrefs = {
  location: true,
  nearby: true,
  weather: true,
  leftHanded: false,
};

const MAP_SETTING_ICONS: Record<MapSettingKey, ReactNode> = {
  location: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s6.5-5.2 6.5-11A6.5 6.5 0 105.5 10c0 5.8 6.5 11 6.5 11Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5Z" />
    </svg>
  ),
  nearby: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 20.25h15M6.75 20.25V9.75L12 5.25l5.25 4.5v10.5M9.25 20.25v-5.5h5.5v5.5M8.5 11.25h.01M12 11.25h.01M15.5 11.25h.01" />
    </svg>
  ),
  weather: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3m0 14v3m10-10h-3M5 12H2m16.95-6.95l-2.12 2.12M7.17 16.83l-2.12 2.12m0-13.9l2.12 2.12m9.66 9.66l2.12 2.12" />
    </svg>
  ),
  leftHanded: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.75 4.75 8.25l3.5 3.5M5 8.25h14.25M15.75 12.25l3.5 3.5-3.5 3.5M4.75 15.75H19" />
    </svg>
  ),
};
const MAP_LOCATION_SOURCE_KEY = 'mm_map_location_source';

function getLocalValue(key: string) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setLocalValue(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch { }
}

function readMapLocationSource(): MapLocationSource {
  if (typeof window === 'undefined') return 'current';
  return getLocalValue(MAP_LOCATION_SOURCE_KEY) === 'manual' ? 'manual' : 'current';
}

function mapLocationAccountKey(email: string, kind: 'source' | 'manual') {
  return `mm_map_location_${kind}:${email.trim().toLowerCase()}`;
}

function readMapLocationSourceForAccount(email?: string | null): MapLocationSource {
  if (typeof window === 'undefined') return 'current';
  const globalSource = readMapLocationSource();
  if (!email) return 'current';
  const accountSource = getLocalValue(mapLocationAccountKey(email, 'source'));
  if (accountSource === 'current' || accountSource === 'manual') return accountSource;
  if (globalSource === 'current' || globalSource === 'manual') return globalSource;
  return 'current';
}

const LOCATION_SETTING_LABELS: Record<string, {
  title: string;
  body: string;
  current: string;
  manual: string;
  choose: string;
  saved: string;
  savedPrefix: string;
}> = {
  ko: { title: '위치 기준', body: '날씨와 주변 박물관을 계산할 기준 위치를 정해요.', current: '현재 위치', manual: '선택 위치', choose: '지도에서 위치 선택', saved: '선택한 위치 저장됨', savedPrefix: '선택 위치' },
  en: { title: 'Location source', body: 'Choose the location used for weather and nearby museums.', current: 'Current location', manual: 'Selected place', choose: 'Choose on map', saved: 'Selected location saved', savedPrefix: 'Selected place' },
  ja: { title: '位置の基準', body: '天気と周辺ミュージアムに使う位置を選びます。', current: '現在地', manual: '選択位置', choose: '地図で位置を選択', saved: '選択した位置を保存済み', savedPrefix: '選択位置' },
  de: { title: 'Standortquelle', body: 'Wähle den Standort für Wetter und Museen in der Nähe.', current: 'Aktueller Standort', manual: 'Auf Karte wählen', choose: 'Auf Karte wählen', saved: 'Gewählter Standort gespeichert', savedPrefix: 'Gewählter Standort' },
  fr: { title: 'Position de référence', body: 'Choisissez la position utilisée pour la météo et les musées proches.', current: 'Position actuelle', manual: 'Choisir sur la carte', choose: 'Choisir sur la carte', saved: 'Position choisie enregistrée', savedPrefix: 'Position choisie' },
  es: { title: 'Ubicación de referencia', body: 'Elige la ubicación para el clima y los museos cercanos.', current: 'Ubicación actual', manual: 'Elegir en mapa', choose: 'Elegir en mapa', saved: 'Ubicación elegida guardada', savedPrefix: 'Ubicación elegida' },
  pt: { title: 'Localização de referência', body: 'Escolha a localização usada para clima e museus próximos.', current: 'Localização atual', manual: 'Escolher no mapa', choose: 'Escolher no mapa', saved: 'Localização escolhida salva', savedPrefix: 'Localização escolhida' },
  'zh-CN': { title: '位置基准', body: '选择用于天气和附近博物馆的位置。', current: '当前位置', manual: '在地图选择', choose: '在地图上选择位置', saved: '已保存所选位置', savedPrefix: '所选位置' },
  'zh-TW': { title: '位置基準', body: '選擇用於天氣和附近博物館的位置。', current: '目前位置', manual: '在地圖選擇', choose: '在地圖上選擇位置', saved: '已儲存所選位置', savedPrefix: '所選位置' },
  da: { title: 'Placeringskilde', body: 'Vælg placering til vejr og museer i nærheden.', current: 'Aktuel placering', manual: 'Vælg på kort', choose: 'Vælg på kort', saved: 'Valgt placering gemt', savedPrefix: 'Valgt placering' },
  fi: { title: 'Sijainnin lähde', body: 'Valitse säässä ja lähimuseoissa käytettävä sijainti.', current: 'Nykyinen sijainti', manual: 'Valitse kartalta', choose: 'Valitse kartalta', saved: 'Valittu sijainti tallennettu', savedPrefix: 'Valittu sijainti' },
  sv: { title: 'Platskälla', body: 'Välj platsen för väder och museer i närheten.', current: 'Aktuell plats', manual: 'Välj på kartan', choose: 'Välj på kartan', saved: 'Vald plats sparad', savedPrefix: 'Vald plats' },
  et: { title: 'Asukoha allikas', body: 'Vali asukoht ilma ja lähedal muuseumide jaoks.', current: 'Praegune asukoht', manual: 'Vali kaardil', choose: 'Vali kaardil', saved: 'Valitud asukoht salvestatud', savedPrefix: 'Valitud asukoht' },
};

const LABELS: Record<string, {
  title: string;
  general: string;
  language: string;
  theme: string;
  light: string;
  dark: string;
  system: string;
  map: string;
  location: string;
  nearby: string;
  weather: string;
  leftHanded: string;
  account: string;
  profile: string;
  saves: string;
  alerts: string;
  logout: string;
  version: string;
  loginTitle: string;
  loginBody: string;
  loginCta: string;
}> = {
  ko: {
    title: '설정',
    general: '일반',
    language: '언어',
    theme: '테마',
    light: '라이트',
    dark: '다크',
    system: '시스템',
    map: '지도 설정',
    location: '현위치/선택위치',
    nearby: '주변 박물관',
    weather: '날씨 표시',
    leftHanded: '왼손잡이 모드',
    account: '계정',
    profile: '프로필 관리',
    saves: '내 픽 관리',
    alerts: '알림',
    logout: '로그아웃',
    version: '버전 2.0.0',
    loginTitle: '로그인하면 내 픽과 여행을 저장할 수 있어요',
    loginBody: '마음에 든 곳, 여행 경로, 컬렉션, 알림을 계정에 보관해요.',
    loginCta: '로그인하기',
  },
  en: {
    title: 'Settings',
    general: 'General',
    language: 'Language',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    map: 'Map Settings',
    location: 'Current/Selected location',
    nearby: 'Nearby Museums',
    weather: 'Show Weather',
    leftHanded: 'Left-handed mode',
    account: 'Account',
    profile: 'Profile',
    saves: 'Saved Space',
    alerts: 'Notifications',
    logout: 'Logout',
    version: 'Version 2.0.0',
    loginTitle: 'Sign in to complete your museum map',
    loginBody: 'Keep your picks, trips, collections, and alerts safely attached to your account.',
    loginCta: 'Sign in',
  },
  ja: { title: '設定', general: '一般', language: '言語', theme: 'テーマ', light: 'ライト', dark: 'ダーク', system: 'システム', map: '地図設定', location: '現在地/選択位置', nearby: '周辺ミュージアム', weather: '天気を表示', leftHanded: '左手モード', account: 'アカウント', profile: 'プロフィール', saves: '保存済み', alerts: '通知', logout: 'ログアウト', version: 'バージョン 2.0.0', loginTitle: 'ログインすると保存と旅行を残せます', loginBody: '気に入った場所、旅行ルート、コレクション、通知をアカウントに保存できます。', loginCta: 'ログイン' },
  de: { title: 'Einstellungen', general: 'Allgemein', language: 'Sprache', theme: 'Design', light: 'Hell', dark: 'Dunkel', system: 'System', map: 'Karteneinstellungen', location: 'Aktueller/gewählter Standort', nearby: 'Museen in der Nähe', weather: 'Wetter anzeigen', leftHanded: 'Linkshänder-Modus', account: 'Konto', profile: 'Profil', saves: 'Gespeicherte Orte', alerts: 'Benachrichtigungen', logout: 'Abmelden', version: 'Version 2.0.0', loginTitle: 'Einloggen, um Favoriten und Reisen zu speichern', loginBody: 'Bewahre Lieblingsorte, Routen, Sammlungen und Hinweise sicher in deinem Konto auf.', loginCta: 'Einloggen' },
  fr: { title: 'Paramètres', general: 'Général', language: 'Langue', theme: 'Thème', light: 'Clair', dark: 'Sombre', system: 'Système', map: 'Paramètres de carte', location: 'Position actuelle/choisie', nearby: 'Musées proches', weather: 'Afficher la météo', leftHanded: 'Mode gaucher', account: 'Compte', profile: 'Profil', saves: 'Espaces enregistrés', alerts: 'Notifications', logout: 'Déconnexion', version: 'Version 2.0.0', loginTitle: 'Connectez-vous pour garder vos lieux et voyages', loginBody: 'Enregistrez vos coups de cœur, itinéraires, collections et alertes dans votre compte.', loginCta: 'Se connecter' },
  es: { title: 'Ajustes', general: 'General', language: 'Idioma', theme: 'Tema', light: 'Claro', dark: 'Oscuro', system: 'Sistema', map: 'Ajustes del mapa', location: 'Ubicación actual/elegida', nearby: 'Museos cercanos', weather: 'Mostrar clima', leftHanded: 'Modo zurdo', account: 'Cuenta', profile: 'Perfil', saves: 'Guardados', alerts: 'Notificaciones', logout: 'Cerrar sesión', version: 'Versión 2.0.0', loginTitle: 'Inicia sesión para guardar tus lugares y viajes', loginBody: 'Guarda tus favoritos, rutas, colecciones y alertas en tu cuenta.', loginCta: 'Iniciar sesión' },
  pt: { title: 'Configurações', general: 'Geral', language: 'Idioma', theme: 'Tema', light: 'Claro', dark: 'Escuro', system: 'Sistema', map: 'Configurações do mapa', location: 'Localização atual/selecionada', nearby: 'Museus próximos', weather: 'Mostrar clima', leftHanded: 'Modo canhoto', account: 'Conta', profile: 'Perfil', saves: 'Salvos', alerts: 'Notificações', logout: 'Sair', version: 'Versão 2.0.0', loginTitle: 'Entre para salvar lugares e viagens', loginBody: 'Guarde favoritos, rotas, coleções e alertas na sua conta.', loginCta: 'Entrar' },
  'zh-CN': { title: '设置', general: '通用', language: '语言', theme: '主题', light: '浅色', dark: '深色', system: '系统', map: '地图设置', location: '当前位置/所选位置', nearby: '附近博物馆', weather: '显示天气', leftHanded: '左手模式', account: '账户', profile: '个人资料', saves: '已保存', alerts: '通知', logout: '退出登录', version: '版本 2.0.0', loginTitle: '登录后可保存心选地点和旅行', loginBody: '将喜欢的地点、旅行路线、收藏集和提醒保存到你的账户。', loginCta: '登录' },
  'zh-TW': { title: '設定', general: '一般', language: '語言', theme: '主題', light: '淺色', dark: '深色', system: '系統', map: '地圖設定', location: '目前位置/所選位置', nearby: '附近博物館', weather: '顯示天氣', leftHanded: '左手模式', account: '帳號', profile: '個人資料', saves: '已儲存', alerts: '通知', logout: '登出', version: '版本 2.0.0', loginTitle: '登入後可保存心選地點和旅行', loginBody: '將喜歡的地點、旅行路線、收藏集和提醒保存到你的帳號。', loginCta: '登入' },
  da: { title: 'Indstillinger', general: 'Generelt', language: 'Sprog', theme: 'Tema', light: 'Lys', dark: 'Mørk', system: 'System', map: 'Kortindstillinger', location: 'Aktuel/valgt placering', nearby: 'Museer i nærheden', weather: 'Vis vejr', leftHanded: 'Venstrehåndstilstand', account: 'Konto', profile: 'Profil', saves: 'Gemte steder', alerts: 'Notifikationer', logout: 'Log ud', version: 'Version 2.0.0', loginTitle: 'Log ind for at gemme steder og rejser', loginBody: 'Gem favoritter, ruter, samlinger og beskeder sikkert på din konto.', loginCta: 'Log ind' },
  fi: { title: 'Asetukset', general: 'Yleiset', language: 'Kieli', theme: 'Teema', light: 'Vaalea', dark: 'Tumma', system: 'Järjestelmä', map: 'Kartta-asetukset', location: 'Nykyinen/valittu sijainti', nearby: 'Lähimuseot', weather: 'Näytä sää', leftHanded: 'Vasenkätinen tila', account: 'Tili', profile: 'Profiili', saves: 'Tallennetut', alerts: 'Ilmoitukset', logout: 'Kirjaudu ulos', version: 'Versio 2.0.0', loginTitle: 'Kirjaudu sisään tallentaaksesi paikat ja matkat', loginBody: 'Tallenna suosikit, reitit, kokoelmat ja ilmoitukset omalle tilillesi.', loginCta: 'Kirjaudu' },
  sv: { title: 'Inställningar', general: 'Allmänt', language: 'Språk', theme: 'Tema', light: 'Ljust', dark: 'Mörkt', system: 'System', map: 'Kartinställningar', location: 'Aktuell/vald plats', nearby: 'Museer i närheten', weather: 'Visa väder', leftHanded: 'Vänsterhänt läge', account: 'Konto', profile: 'Profil', saves: 'Sparade', alerts: 'Aviseringar', logout: 'Logga ut', version: 'Version 2.0.0', loginTitle: 'Logga in för att spara platser och resor', loginBody: 'Spara favoriter, rutter, samlingar och aviseringar på ditt konto.', loginCta: 'Logga in' },
  et: { title: 'Seaded', general: 'Üldine', language: 'Keel', theme: 'Teema', light: 'Hele', dark: 'Tume', system: 'Süsteem', map: 'Kaardi seaded', location: 'Praegune/valitud asukoht', nearby: 'Lähedal muuseumid', weather: 'Kuva ilm', leftHanded: 'Vasakukäeline režiim', account: 'Konto', profile: 'Profiil', saves: 'Salvestatud', alerts: 'Teavitused', logout: 'Logi välja', version: 'Versioon 2.0.0', loginTitle: 'Logi sisse, et salvestada kohad ja reisid', loginBody: 'Hoia lemmikud, marsruudid, kogud ja teavitused oma kontol.', loginCta: 'Logi sisse' },
};

type PolicyLabels = {
  section: string;
  privacy: string;
  privacyDesc: string;
  terms: string;
  termsDesc: string;
  cookies: string;
  cookiesDesc: string;
  info: string;
  infoDesc: string;
  feedback: string;
  feedbackDesc: string;
};

const POLICY_LABELS: Record<string, PolicyLabels> = {
  ko: {
    section: '정책 및 지원',
    privacy: '개인정보 처리방침',
    privacyDesc: '수집 정보와 보호 기준을 확인해요',
    terms: '서비스 이용약관',
    termsDesc: 'Museum Map 이용 규칙을 확인해요',
    cookies: '쿠키 정책',
    cookiesDesc: '쿠키와 로컬 저장소 사용 방식을 확인해요',
    info: '서비스 정보',
    infoDesc: '데이터 출처와 운영 정보를 확인해요',
    feedback: '의견 보내기',
    feedbackDesc: '불편한 점이나 개선 의견을 남겨요',
  },
  en: {
    section: 'Policies & Support',
    privacy: 'Privacy Policy',
    privacyDesc: 'Review how your data is collected and protected',
    terms: 'Terms of Service',
    termsDesc: 'Review the rules for using Museum Map',
    cookies: 'Cookie Policy',
    cookiesDesc: 'Review cookie and local storage usage',
    info: 'Service Information',
    infoDesc: 'Review data sources and operating notes',
    feedback: 'Send Feedback',
    feedbackDesc: 'Share issues or improvement ideas',
  },
  ja: { section: 'ポリシーとサポート', privacy: 'プライバシーポリシー', privacyDesc: '収集情報と保護基準を確認', terms: '利用規約', termsDesc: 'Museum Mapの利用ルールを確認', cookies: 'Cookieポリシー', cookiesDesc: 'Cookieとローカル保存の使用を確認', info: 'サービス情報', infoDesc: 'データ出典と運営情報を確認', feedback: 'フィードバック', feedbackDesc: '不具合や改善案を送信' },
  de: { section: 'Richtlinien & Support', privacy: 'Datenschutz', privacyDesc: 'Datenerhebung und Schutz prüfen', terms: 'Nutzungsbedingungen', termsDesc: 'Regeln für Museum Map prüfen', cookies: 'Cookie-Richtlinie', cookiesDesc: 'Cookies und lokale Speicherung prüfen', info: 'Serviceinformationen', infoDesc: 'Datenquellen und Betriebshinweise prüfen', feedback: 'Feedback senden', feedbackDesc: 'Probleme oder Ideen teilen' },
  fr: { section: 'Politiques & support', privacy: 'Confidentialité', privacyDesc: 'Consultez la collecte et la protection des données', terms: 'Conditions d’utilisation', termsDesc: 'Consultez les règles de Museum Map', cookies: 'Politique cookies', cookiesDesc: 'Consultez l’usage des cookies et du stockage local', info: 'Informations du service', infoDesc: 'Sources de données et notes d’exploitation', feedback: 'Envoyer un avis', feedbackDesc: 'Signalez un problème ou une idée' },
  es: { section: 'Políticas y soporte', privacy: 'Política de privacidad', privacyDesc: 'Revisa cómo se recopilan y protegen tus datos', terms: 'Términos de servicio', termsDesc: 'Revisa las reglas de Museum Map', cookies: 'Política de cookies', cookiesDesc: 'Revisa cookies y almacenamiento local', info: 'Información del servicio', infoDesc: 'Revisa fuentes de datos y notas operativas', feedback: 'Enviar comentarios', feedbackDesc: 'Comparte problemas o mejoras' },
  pt: { section: 'Políticas e suporte', privacy: 'Política de privacidade', privacyDesc: 'Revise coleta e proteção de dados', terms: 'Termos de serviço', termsDesc: 'Revise as regras do Museum Map', cookies: 'Política de cookies', cookiesDesc: 'Revise cookies e armazenamento local', info: 'Informações do serviço', infoDesc: 'Revise fontes de dados e notas operacionais', feedback: 'Enviar feedback', feedbackDesc: 'Compartilhe problemas ou ideias' },
  'zh-CN': { section: '政策与支持', privacy: '隐私政策', privacyDesc: '查看数据收集与保护标准', terms: '服务条款', termsDesc: '查看 Museum Map 使用规则', cookies: 'Cookie 政策', cookiesDesc: '查看 Cookie 与本地存储使用方式', info: '服务信息', infoDesc: '查看数据来源与运营说明', feedback: '发送反馈', feedbackDesc: '提交问题或改进建议' },
  'zh-TW': { section: '政策與支援', privacy: '隱私政策', privacyDesc: '查看資料收集與保護標準', terms: '服務條款', termsDesc: '查看 Museum Map 使用規則', cookies: 'Cookie 政策', cookiesDesc: '查看 Cookie 與本機儲存使用方式', info: '服務資訊', infoDesc: '查看資料來源與營運說明', feedback: '傳送意見', feedbackDesc: '提交問題或改善建議' },
  da: { section: 'Politikker & support', privacy: 'Privatlivspolitik', privacyDesc: 'Gennemgå dataindsamling og beskyttelse', terms: 'Servicevilkår', termsDesc: 'Gennemgå reglerne for Museum Map', cookies: 'Cookiepolitik', cookiesDesc: 'Gennemgå cookies og lokal lagring', info: 'Serviceoplysninger', infoDesc: 'Gennemgå datakilder og driftsnoter', feedback: 'Send feedback', feedbackDesc: 'Del problemer eller forbedringsidéer' },
  fi: { section: 'Käytännöt ja tuki', privacy: 'Tietosuojakäytäntö', privacyDesc: 'Tarkista tietojen keruu ja suojaus', terms: 'Käyttöehdot', termsDesc: 'Tarkista Museum Mapin säännöt', cookies: 'Evästekäytäntö', cookiesDesc: 'Tarkista evästeet ja paikallinen tallennus', info: 'Palvelutiedot', infoDesc: 'Tarkista tietolähteet ja toimintatiedot', feedback: 'Lähetä palaute', feedbackDesc: 'Jaa ongelma tai parannusidea' },
  sv: { section: 'Policyer & support', privacy: 'Integritetspolicy', privacyDesc: 'Granska datainsamling och skydd', terms: 'Användarvillkor', termsDesc: 'Granska reglerna för Museum Map', cookies: 'Cookiepolicy', cookiesDesc: 'Granska cookies och lokal lagring', info: 'Serviceinformation', infoDesc: 'Granska datakällor och driftinfo', feedback: 'Skicka feedback', feedbackDesc: 'Dela problem eller förbättringsidéer' },
  et: { section: 'Eeskirjad ja tugi', privacy: 'Privaatsuspoliitika', privacyDesc: 'Vaata andmete kogumist ja kaitset', terms: 'Kasutustingimused', termsDesc: 'Vaata Museum Mapi kasutusreegleid', cookies: 'Küpsiste poliitika', cookiesDesc: 'Vaata küpsiste ja kohaliku salvestuse kasutust', info: 'Teenuse teave', infoDesc: 'Vaata andmeallikaid ja töömärkusi', feedback: 'Saada tagasisidet', feedbackDesc: 'Jaga probleeme või ideid' },
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

function SettingsRow({ icon, label, description, value, href, onClick }: { icon: ReactNode; label: string; description?: string; value?: string; href?: string; onClick?: () => void }) {
  const inner = (
    <>
      <Icon>{icon}</Icon>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-slate-700 dark:text-neutral-200">{label}</span>
        {description && <span className="mt-0.5 block text-[12px] font-medium leading-snug text-slate-400 dark:text-neutral-500">{description}</span>}
      </span>
      {value && <span className="text-sm font-medium text-slate-400 dark:text-neutral-500">{value}</span>}
      <Chevron />
    </>
  );
  if (href) return <a href={href} className="mm-settings-row">{inner}</a>;
  return <button type="button" onClick={onClick} className="mm-settings-row w-full text-left">{inner}</button>;
}

export default function SettingsPage() {
  const { locale, setLocale, themeMode, setThemeMode } = useApp();
  const { data: session, status } = useSession();
  const [mapPrefs, setMapPrefs] = useState<MapPrefs>(DEFAULT_MAP_PREFS);
  const [locationSource, setLocationSource] = useState<MapLocationSource>('current');
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const labels = LABELS[locale] || LABELS.en;
  const policyLabels = POLICY_LABELS[locale] || POLICY_LABELS.en;
  const locationLabels = LOCATION_SETTING_LABELS[locale] || LOCATION_SETTING_LABELS.en;
  const isSessionLoading = status === 'loading';
  const isAuthenticatedUser = status === 'authenticated' && !!session?.user && !session.user?.name?.startsWith('guest_');
  const isGuest = !isSessionLoading && !isAuthenticatedUser;
  const showLocationSource = isSessionLoading || isAuthenticatedUser;
  const accountLocationEmail = isAuthenticatedUser && session?.user?.email
    ? session.user.email
    : null;

  useEffect(() => {
    const savedLocationSource = readMapLocationSourceForAccount(accountLocationEmail);
    setMapPrefs({
      location: getLocalValue(MAP_PREF_KEYS.location) !== 'false',
      nearby: getLocalValue(MAP_PREF_KEYS.nearby) !== 'false',
      weather: getLocalValue(MAP_PREF_KEYS.weather) !== 'false',
      leftHanded: getLocalValue(MAP_PREF_KEYS.leftHanded) === 'true',
    });
    setLocationSource(savedLocationSource);
  }, [accountLocationEmail]);

  const updateMapPref = (key: MapSettingKey) => {
    setMapPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      setLocalValue(MAP_PREF_KEYS[key], String(next[key]));
      window.dispatchEvent(new CustomEvent('mm-map-prefs-change', { detail: next }));
      return next;
    });
  };

  const updateLocationSource = (source: MapLocationSource) => {
    setLocationSource(source);
    if (accountLocationEmail) {
      setLocalValue(mapLocationAccountKey(accountLocationEmail, 'source'), source);
    }
    setLocalValue(MAP_LOCATION_SOURCE_KEY, source);
    window.dispatchEvent(new CustomEvent('mm-map-location-source-change', { detail: { source } }));
  };

  return (
    <div className="mm-settings-page2 no-back-swipe mx-auto w-full max-w-[640px] px-5 pb-32 pt-[max(28px,env(safe-area-inset-top,0px))] lg:pb-12 mm-settings-page2--enter">
      <div className="mb-12 flex items-center justify-center">
        <h1 className="mm-settings-title text-center text-2xl text-slate-900 dark:text-white">{labels.title}</h1>
      </div>

      {isGuest && (
        <section className="mm-settings-login-card mb-9">
          <div className="min-w-0 flex-1">
            <p>{labels.loginTitle || LABELS.en.loginTitle}</p>
            <span>{labels.loginBody || LABELS.en.loginBody}</span>
          </div>
          <a href="/login?callbackUrl=%2Fsettings" className="mm-settings-login-cta">
            {labels.loginCta || LABELS.en.loginCta}
          </a>
        </section>
      )}

      <section className="mb-9">
        <h2 className="mb-3 px-2 text-[15px] font-semibold text-slate-500 dark:text-neutral-400">{labels.general}</h2>
        <div className="mm-settings-card">
          <div className="mm-settings-row">
            <Icon><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18m0 18a9 9 0 010-18m0 18c2.2-2.2 3.3-5.2 3.3-9S14.2 5.2 12 3m0 18c-2.2-2.2-3.3-5.2-3.3-9S9.8 5.2 12 3M3.6 9h16.8M3.6 15h16.8" /></svg></Icon>
            <label className="min-w-0 flex-1 text-[15px] font-semibold text-slate-700 dark:text-neutral-200" htmlFor="locale-select">{labels.language}</label>
            <select id="locale-select" value={locale} onChange={(e) => setLocale(e.target.value as Locale)} className="max-w-[130px] bg-transparent text-right text-sm font-medium text-slate-400 outline-none dark:text-neutral-500">
              {(Object.keys(LOCALE_NAMES) as Locale[]).map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
            </select>
          </div>
          <div className="mm-settings-row">
            <Icon><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.12a3 3 0 013.35-3.35l1.2.24a3 3 0 003.43-3.43l-.24-1.2a3 3 0 013.35-3.35A9 9 0 1112 3" /></svg></Icon>
            <span className="min-w-0 flex-1 text-[15px] font-semibold text-slate-700 dark:text-neutral-200">{labels.theme}</span>
            <div className="flex gap-2">
              {(['light', 'dark', 'system'] as const).map(mode => (
                <button key={mode} onClick={() => setThemeMode(mode)} className={`mm-settings-theme-option rounded-full px-3.5 py-2 text-sm font-semibold ${themeMode === mode ? 'is-active bg-blue-700 text-white shadow-lg shadow-blue-700/20' : 'bg-white/60 text-slate-500 ring-1 ring-slate-200 dark:bg-neutral-900 dark:text-neutral-400 dark:ring-neutral-800'}`}>
                  {mode === 'light' ? labels.light : mode === 'dark' ? labels.dark : labels.system}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-9">
        <h2 className="mb-3 px-2 text-[15px] font-semibold text-slate-500 dark:text-neutral-400">{labels.account}</h2>
        <div className="mm-settings-card">
          <SettingsRow onClick={!isAuthenticatedUser ? () => setLoginModalOpen(true) : undefined} href={isAuthenticatedUser ? '/profile' : undefined} icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0" /></svg>} label={labels.profile} value={isAuthenticatedUser ? session?.user?.name || '' : ''} />
          <SettingsRow href="/notifications" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.85 18.25a2.85 2.85 0 01-5.7 0M18 10.5a6 6 0 10-12 0c0 3-1.5 4.5-2 5.5h16c-.5-1-2-2.5-2-5.5z" /></svg>} label={labels.alerts} />
          {isAuthenticatedUser && (
            <button type="button" onClick={() => { clearClientAccountStateForLogout(); try { sessionStorage.setItem('mm-logout-done', '1'); } catch { } signOut({ callbackUrl: '/' }); }} className="mm-settings-row w-full text-left">
              <Icon><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m-3-3h8.25m0 0l-3-3m3 3l-3 3" /></svg></Icon>
              <span className="min-w-0 flex-1 text-[15px] font-semibold text-slate-700 dark:text-neutral-200">{labels.logout}</span>
            </button>
          )}
        </div>
      </section>

      <section className="mb-9">
        <h2 className="mb-3 px-2 text-[15px] font-semibold text-slate-500 dark:text-neutral-400">{labels.map}</h2>
        <div className="mm-settings-card">
          {showLocationSource && (
            <div className={`mm-settings-location-source ${isSessionLoading ? 'is-loading' : ''}`}>
              <div>
                <strong>{locationLabels.title}</strong>
                <span>{locationLabels.body}</span>
              </div>
              <div
                className={`mm-settings-location-source-toggle mm-settings-location-mode-switch is-${locationSource}`}
                role="group"
                aria-label={locationLabels.title}
              >
                <button
                  type="button"
                  className={`mm-settings-location-source-option ${locationSource === 'current' ? 'is-active' : ''}`}
                  aria-pressed={locationSource === 'current'}
                  disabled={isSessionLoading}
                  onClick={() => updateLocationSource('current')}
                >
                  {locationLabels.current}
                </button>
                <button
                  type="button"
                  className={`mm-settings-location-source-option ${locationSource === 'manual' ? 'is-active' : ''}`}
                  aria-pressed={locationSource === 'manual'}
                  disabled={isSessionLoading}
                  onClick={() => updateLocationSource('manual')}
                >
                  {locationLabels.manual}
                </button>
              </div>
            </div>
          )}
          {([
            ['location', labels.location],
            ['nearby', labels.nearby],
            ['weather', labels.weather],
            ['leftHanded', labels.leftHanded],
          ] as Array<[MapSettingKey, string]>).map(([key, label]) => (
            <button key={key} type="button" className="mm-settings-row w-full text-left" onClick={() => updateMapPref(key)}>
              <Icon>{MAP_SETTING_ICONS[key]}</Icon>
              <span className="min-w-0 flex-1 text-[15px] font-semibold text-slate-700 dark:text-neutral-200">{String(label)}</span>
              <Toggle on={mapPrefs[key]} />
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 px-2 text-[15px] font-semibold text-slate-500 dark:text-neutral-400">{policyLabels.section}</h2>
        <div className="mm-settings-card">
          <SettingsRow href="/privacy" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75 5.25 6v5.25c0 4.25 2.72 8.02 6.75 9 4.03-.98 6.75-4.75 6.75-9V6L12 3.75z" /><path strokeLinecap="round" strokeLinejoin="round" d="m9.75 12 1.5 1.5 3-3" /></svg>} label={policyLabels.privacy} description={policyLabels.privacyDesc} />
          <SettingsRow href="/terms" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75h6.75L19.5 9v11.25H7.5A3 3 0 014.5 17.25V6.75a3 3 0 013-3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 3.75V9h6M8.25 13.5h7.5M8.25 16.5h5.25" /></svg>} label={policyLabels.terms} description={policyLabels.termsDesc} />
          <SettingsRow href="/cookies" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12.4A7.5 7.5 0 1111.6 4.5a3 3 0 003.9 3.9 3 3 0 004 4z" /><path strokeLinecap="round" strokeLinejoin="round" d="M8.5 10.5h.01M11 16h.01M15.5 14h.01" /></svg>} label={policyLabels.cookies} description={policyLabels.cookiesDesc} />
          <SettingsRow href="/info" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 17v-5M12 8h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} label={policyLabels.info} description={policyLabels.infoDesc} />
          <SettingsRow href="/feedback" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9M7.5 12h5.25M21 12a8.25 8.25 0 01-11.94 7.37L4.5 20.25l.88-4.56A8.25 8.25 0 1121 12z" /></svg>} label={policyLabels.feedback} description={policyLabels.feedbackDesc} />
        </div>
      </section>

      <p className="mt-8 text-center text-sm font-medium text-slate-300 dark:text-neutral-700">{labels.version}</p>
      <LoginRequiredModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} callbackUrl="/profile" />
    </div>
  );
}
