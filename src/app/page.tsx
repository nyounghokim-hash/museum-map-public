'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ChangeEvent, CSSProperties, RefObject, SyntheticEvent } from 'react';
import { useCompare } from '@/hooks/useCompare';
import { useAccountSaves } from '@/hooks/useAccountSaves';
import { useDragReorder } from '@/hooks/useDragReorder';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { useApp } from '@/components/AppContext';
import { useModal } from '@/components/ui/Modal';
import { t, translateCategory, type Locale } from '@/lib/i18n';
import { getLocalizedMuseumName, getLocalizedCityName } from '@/lib/getLocalizedName';
import MuseumDetailCard from '@/components/museum/MuseumDetailCard';
import LoadingAnimation from '@/components/ui/LoadingAnimation';
import * as gtag from '@/lib/gtag';
import { SparkleIcon, StarIcon, AirplaneIcon } from '@/components/ui/Icons';
import { ACTIVE_TRIP_CHANGE_EVENT, clearActiveTripForAccount, getActiveTripForAccount, setActiveTripForAccount } from '@/lib/accountStorage';
import { clearClientAccountStateForLogout } from '@/lib/client-account-state';
import { getMuseumImageSrc } from '@/lib/getMuseumImage';
import { fetchLocationLabel } from '@/lib/locationLabel';
import { MUSEUM_CATEGORY_FILTERS, getMuseumCategoryIconSrc } from '@/lib/museumCategories';

const MapLibreViewer = dynamic(() => import('@/components/map/MapLibreViewer'), { ssr: false });
const RouteMapViewer = dynamic(() => import('@/components/map/RouteMapViewer'), { ssr: false });
const NearbyPopup = dynamic(() => import('@/components/map/NearbyPopup'), { ssr: false });
const WeatherPopup = dynamic(() => import('@/components/map/WeatherPopup'), { ssr: false });
const RETURN_TO_MUSEUM_DETAIL_KEY = 'mm-return-to-museum-detail';
type MapSettingKey = 'location' | 'nearby' | 'weather';
type MapPrefs = Record<MapSettingKey, boolean>;
type MapLocationSource = 'current' | 'manual';
type MapLocation = { lat: number; lng: number };
const MAP_PREF_KEYS: Record<MapSettingKey, string> = {
  location: 'mm_map_show_location',
  nearby: 'mm_map_show_nearby',
  weather: 'mm_map_show_weather',
};
const MAP_LOCATION_SOURCE_KEY = 'mm_map_location_source';
const MAP_MANUAL_LOCATION_KEY = 'mm_map_manual_location';
const MAP_LOCATION_PICK_MODE_KEY = 'mm_map_location_pick_mode';
const MAP_CATEGORY_FILTER_KEY = 'mm_map_category_filter';
const MUSEUMS_CACHE_PREFIX = 'museums_cache_v8_map_minimal';
const DEFAULT_MAP_PREFS: MapPrefs = { location: true, nearby: true, weather: true };
const MAP_ZOOM_MIN = 2;
const MAP_ZOOM_MAX = 18;
const MAP_ZOOM_LEVELS = [2, 4.5, 7, 9.5, 12, 15, 18] as const;
const MAP_ZOOM_LABELS: Record<string, { control: string; zoomIn: string; zoomOut: string }> = {
  ko: { control: '지도 확대/축소', zoomIn: '지도 확대', zoomOut: '지도 축소' },
  en: { control: 'Map zoom', zoomIn: 'Zoom in', zoomOut: 'Zoom out' },
  ja: { control: '地図のズーム', zoomIn: '拡大', zoomOut: '縮小' },
  de: { control: 'Kartenzoom', zoomIn: 'Vergrößern', zoomOut: 'Verkleinern' },
  fr: { control: 'Zoom de la carte', zoomIn: 'Zoomer', zoomOut: 'Dézoomer' },
  es: { control: 'Zoom del mapa', zoomIn: 'Acercar', zoomOut: 'Alejar' },
  pt: { control: 'Zoom do mapa', zoomIn: 'Aproximar', zoomOut: 'Afastar' },
  'zh-CN': { control: '地图缩放', zoomIn: '放大', zoomOut: '缩小' },
  'zh-TW': { control: '地圖縮放', zoomIn: '放大', zoomOut: '縮小' },
  da: { control: 'Kortzoom', zoomIn: 'Zoom ind', zoomOut: 'Zoom ud' },
  fi: { control: 'Kartan zoomaus', zoomIn: 'Lähennä', zoomOut: 'Loitonna' },
  sv: { control: 'Kartzoom', zoomIn: 'Zooma in', zoomOut: 'Zooma ut' },
  et: { control: 'Kaardi suum', zoomIn: 'Suurenda', zoomOut: 'Vähenda' },
};

function clampMapZoom(zoom: number) {
  return Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, zoom));
}

function getNearestMapZoomLevelIndex(zoom: number) {
  const clamped = clampMapZoom(zoom);
  return MAP_ZOOM_LEVELS.reduce((bestIndex, level, index) => (
    Math.abs(level - clamped) < Math.abs(MAP_ZOOM_LEVELS[bestIndex] - clamped) ? index : bestIndex
  ), 0);
}

function snapMapZoom(zoom: number) {
  return MAP_ZOOM_LEVELS[getNearestMapZoomLevelIndex(zoom)];
}

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

function getSessionValue(key: string) {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function setSessionValue(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch { }
}

function removeSessionValue(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch { }
}

function scheduleSessionJsonCache(key: string, data: unknown) {
  if (typeof window === 'undefined') return;
  const win = window as Window & typeof globalThis & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  const write = () => {
    try {
      win.sessionStorage.setItem(key, JSON.stringify(data));
    } catch { }
  };
  if (typeof win.requestIdleCallback === 'function' && typeof win.cancelIdleCallback === 'function') {
    const idleId = win.requestIdleCallback(write, { timeout: 3000 });
    return () => win.cancelIdleCallback?.(idleId);
  }
  const timer = win.setTimeout(write, 1200);
  return () => win.clearTimeout(timer);
}

function parseJsonOffMainThread<T = unknown>(text: string): Promise<T> {
  if (
    typeof window === 'undefined'
    || typeof Worker === 'undefined'
    || typeof Blob === 'undefined'
    || typeof URL === 'undefined'
  ) {
    return Promise.resolve(JSON.parse(text));
  }

  return new Promise((resolve, reject) => {
    const source = `
      self.onmessage = function(event) {
        try {
          self.postMessage({ ok: true, value: JSON.parse(event.data) });
        } catch (error) {
          self.postMessage({ ok: false, error: error && error.message ? error.message : String(error) });
        }
      };
    `;
    const url = URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
    const worker = new Worker(url);
    const cleanup = () => {
      worker.terminate();
      URL.revokeObjectURL(url);
    };

    worker.onmessage = (event: MessageEvent<{ ok: boolean; value?: T; error?: string }>) => {
      cleanup();
      if (event.data?.ok) {
        resolve(event.data.value as T);
      } else {
        reject(new Error(event.data?.error || 'JSON parse failed'));
      }
    };
    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || 'JSON worker failed'));
    };
    worker.postMessage(text);
  });
}

function hasSelectLocationQuery() {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('selectLocation') === '1';
  } catch {
    return false;
  }
}

function clearSelectLocationQuery() {
  if (typeof window === 'undefined' || !hasSelectLocationQuery()) return;
  try {
    window.history.replaceState({}, '', window.location.pathname || '/');
  } catch { }
}

function isUsableMuseumsCache(data: unknown) {
  if (!Array.isArray(data) || data.length === 0) return false;
  return data.slice(0, 24).some(museum => (
    museum
    && typeof museum.id === 'string'
    && Number.isFinite(Number(museum.latitude))
    && Number.isFinite(Number(museum.longitude))
  ));
}

function getMuseumsCacheKey(locale: string) {
  return `${MUSEUMS_CACHE_PREFIX}_${locale || 'ko'}`;
}

function readMapPrefs(): MapPrefs {
  if (typeof window === 'undefined') return DEFAULT_MAP_PREFS;
  return {
    location: getLocalValue(MAP_PREF_KEYS.location) !== 'false',
    nearby: getLocalValue(MAP_PREF_KEYS.nearby) !== 'false',
    weather: getLocalValue(MAP_PREF_KEYS.weather) !== 'false',
  };
}

function readMapLocationSource(): MapLocationSource {
  if (typeof window === 'undefined') return 'current';
  return getLocalValue(MAP_LOCATION_SOURCE_KEY) === 'manual' ? 'manual' : 'current';
}

function readManualMapLocation(): MapLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(getLocalValue(MAP_MANUAL_LOCATION_KEY) || 'null');
    const lat = Number(parsed?.lat);
    const lng = Number(parsed?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  } catch { }
  return null;
}

function mapLocationAccountKey(email: string, kind: 'source' | 'manual') {
  return `mm_map_location_${kind}:${email.trim().toLowerCase()}`;
}

function readMapLocationSourceForAccount(email?: string | null): MapLocationSource {
  if (typeof window === 'undefined') return 'current';
  if (!email) return 'current';
  const accountSource = getLocalValue(mapLocationAccountKey(email, 'source'));
  if (accountSource === 'current' || accountSource === 'manual') return accountSource;
  const globalSource = readMapLocationSource();
  if (globalSource === 'current' || globalSource === 'manual') return globalSource;
  return 'current';
}

function readManualMapLocationForAccount(email?: string | null): MapLocation | null {
  if (typeof window === 'undefined' || !email) return null;
  try {
    const parsed = JSON.parse(getLocalValue(mapLocationAccountKey(email, 'manual')) || 'null');
    const lat = Number(parsed?.lat);
    const lng = Number(parsed?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  } catch { }
  return null;
}

const MOBILE_TOOL_LABELS: Record<string, {
  currentLocation: string;
  nearby: string;
  weather: string;
  newMuseums: string;
  category: string;
  categories: string;
  locationError: string;
  close: string;
}> = {
  ko: { currentLocation: '내 위치', nearby: '주변', weather: '오늘 날씨', newMuseums: '새로 추가된 곳', category: '카테고리', categories: '카테고리', locationError: '현재 위치를 불러오지 못했어요', close: '닫기' },
  en: { currentLocation: 'My location', nearby: 'Nearby', weather: "Today's weather", newMuseums: 'Newly Added', category: 'Category', categories: 'Categories', locationError: 'Unable to get your location', close: 'Close' },
  ja: { currentLocation: '現在地', nearby: '周辺', weather: '今日の天気', newMuseums: '新しく追加', category: 'カテゴリ', categories: 'カテゴリ', locationError: '現在地を取得できませんでした', close: '閉じる' },
  de: { currentLocation: 'Mein Standort', nearby: 'In der Nähe', weather: 'Wetter heute', newMuseums: 'Neu hinzugefügt', category: 'Kategorie', categories: 'Kategorien', locationError: 'Standort konnte nicht abgerufen werden', close: 'Schließen' },
  fr: { currentLocation: 'Ma position', nearby: 'À proximité', weather: "Météo du jour", newMuseums: 'Nouveautés', category: 'Catégorie', categories: 'Catégories', locationError: 'Impossible de récupérer votre position', close: 'Fermer' },
  es: { currentLocation: 'Mi ubicación', nearby: 'Cerca', weather: 'Tiempo de hoy', newMuseums: 'Recién añadidos', category: 'Categoría', categories: 'Categorías', locationError: 'No se pudo obtener tu ubicación', close: 'Cerrar' },
  pt: { currentLocation: 'Minha localização', nearby: 'Perto', weather: 'Tempo de hoje', newMuseums: 'Recém-adicionados', category: 'Categoria', categories: 'Categorias', locationError: 'Não foi possível obter sua localização', close: 'Fechar' },
  'zh-CN': { currentLocation: '当前位置', nearby: '附近', weather: '今日天气', newMuseums: '新增地点', category: '分类', categories: '分类', locationError: '无法获取当前位置', close: '关闭' },
  'zh-TW': { currentLocation: '目前位置', nearby: '附近', weather: '今日天氣', newMuseums: '新增地點', category: '分類', categories: '分類', locationError: '無法取得目前位置', close: '關閉' },
  da: { currentLocation: 'Min placering', nearby: 'I nærheden', weather: 'Dagens vejr', newMuseums: 'Nyt', category: 'Kategori', categories: 'Kategorier', locationError: 'Kunne ikke hente din placering', close: 'Luk' },
  fi: { currentLocation: 'Sijaintini', nearby: 'Lähellä', weather: 'Tämän päivän sää', newMuseums: 'Uudet', category: 'Kategoria', categories: 'Kategoriat', locationError: 'Sijaintiasi ei voitu hakea', close: 'Sulje' },
  sv: { currentLocation: 'Min plats', nearby: 'Nära', weather: 'Dagens väder', newMuseums: 'Nya platser', category: 'Kategori', categories: 'Kategorier', locationError: 'Det gick inte att hämta din plats', close: 'Stäng' },
  et: { currentLocation: 'Minu asukoht', nearby: 'Lähedal', weather: 'Tänane ilm', newMuseums: 'Uued kohad', category: 'Kategooria', categories: 'Kategooriad', locationError: 'Asukohta ei õnnestunud laadida', close: 'Sulge' },
};

const MAP_LOCATION_LABELS: Record<string, {
  pickPrompt: string;
  pickCancel: string;
  pickIntroTitle: string;
  pickIntroBody: string;
  pickIntroCancel: string;
  pickIntroConfirm: string;
  manualSaved: string;
  switchTitle: string;
  switchBody: string;
  switchCancel: string;
  switchConfirm: string;
  pickButton: string;
}> = {
  ko: { pickPrompt: '지도에서 기준 위치를 선택해 주세요', pickCancel: '취소', pickIntroTitle: '원하는 위치를 선택하세요', pickIntroBody: '지도를 누르면 날씨와 주변 박물관을 계산할 기준 위치로 저장돼요.', pickIntroCancel: '나중에', pickIntroConfirm: '위치 선택하기', manualSaved: '지도 기준 위치를 저장했어요', switchTitle: '현재 위치로 바꿀까요?', switchBody: '현위치 버튼을 사용하려면 위치 기준을 현재 위치로 변경해야 해요.', switchCancel: '나중에', switchConfirm: '현재 위치로 변경', pickButton: '선택위치 지정' },
  en: { pickPrompt: 'Choose your map location', pickCancel: 'Cancel', pickIntroTitle: 'Choose the location you want', pickIntroBody: 'Tap the map to save the reference location for weather and nearby museums.', pickIntroCancel: 'Not now', pickIntroConfirm: 'Choose location', manualSaved: 'Map location saved', switchTitle: 'Use current location?', switchBody: 'To use this button, switch your location setting to current location.', switchCancel: 'Not now', switchConfirm: 'Use current location', pickButton: 'Set selected place' },
  ja: { pickPrompt: '地図で基準位置を選択してください', pickCancel: 'キャンセル', pickIntroTitle: '使いたい位置を選択してください', pickIntroBody: '地図をタップすると、天気と周辺ミュージアムの基準位置として保存されます。', pickIntroCancel: '後で', pickIntroConfirm: '位置を選択', manualSaved: '地図の基準位置を保存しました', switchTitle: '現在地に変更しますか？', switchBody: 'このボタンを使うには、位置設定を現在地に変更する必要があります。', switchCancel: '後で', switchConfirm: '現在地に変更', pickButton: '選択位置を指定' },
  de: { pickPrompt: 'Wähle deinen Kartenstandort', pickCancel: 'Abbrechen', pickIntroTitle: 'Gewünschten Standort wählen', pickIntroBody: 'Tippe auf die Karte, um den Referenzstandort für Wetter und nahe Museen zu speichern.', pickIntroCancel: 'Später', pickIntroConfirm: 'Standort wählen', manualSaved: 'Kartenstandort gespeichert', switchTitle: 'Aktuellen Standort verwenden?', switchBody: 'Für diese Taste muss die Standortquelle auf aktuellen Standort wechseln.', switchCancel: 'Später', switchConfirm: 'Aktuellen Standort nutzen', pickButton: 'Gewählten Standort setzen' },
  fr: { pickPrompt: 'Choisissez la position sur la carte', pickCancel: 'Annuler', pickIntroTitle: 'Choisissez la position voulue', pickIntroBody: 'Touchez la carte pour enregistrer la position utilisée pour la météo et les musées proches.', pickIntroCancel: 'Plus tard', pickIntroConfirm: 'Choisir la position', manualSaved: 'Position de carte enregistrée', switchTitle: 'Utiliser votre position actuelle ?', switchBody: 'Pour utiliser ce bouton, passez la position sur votre position actuelle.', switchCancel: 'Plus tard', switchConfirm: 'Utiliser ma position', pickButton: 'Définir la position choisie' },
  es: { pickPrompt: 'Elige tu ubicación en el mapa', pickCancel: 'Cancelar', pickIntroTitle: 'Elige la ubicación que quieras', pickIntroBody: 'Toca el mapa para guardar la ubicación de referencia del clima y museos cercanos.', pickIntroCancel: 'Ahora no', pickIntroConfirm: 'Elegir ubicación', manualSaved: 'Ubicación del mapa guardada', switchTitle: '¿Usar ubicación actual?', switchBody: 'Para usar este botón, cambia la ubicación a tu ubicación actual.', switchCancel: 'Ahora no', switchConfirm: 'Usar ubicación actual', pickButton: 'Definir ubicación elegida' },
  pt: { pickPrompt: 'Escolha sua localização no mapa', pickCancel: 'Cancelar', pickIntroTitle: 'Escolha a localização desejada', pickIntroBody: 'Toque no mapa para salvar a localização usada em clima e museus próximos.', pickIntroCancel: 'Agora não', pickIntroConfirm: 'Escolher localização', manualSaved: 'Localização do mapa salva', switchTitle: 'Usar localização atual?', switchBody: 'Para usar este botão, altere a configuração para localização atual.', switchCancel: 'Agora não', switchConfirm: 'Usar localização atual', pickButton: 'Definir local escolhido' },
  'zh-CN': { pickPrompt: '请在地图上选择基准位置', pickCancel: '取消', pickIntroTitle: '请选择想使用的位置', pickIntroBody: '点击地图即可保存天气和附近博物馆使用的基准位置。', pickIntroCancel: '稍后', pickIntroConfirm: '选择位置', manualSaved: '地图基准位置已保存', switchTitle: '切换为当前位置？', switchBody: '要使用此按钮，需要将位置设置切换为当前位置。', switchCancel: '稍后', switchConfirm: '使用当前位置', pickButton: '设置所选位置' },
  'zh-TW': { pickPrompt: '請在地圖上選擇基準位置', pickCancel: '取消', pickIntroTitle: '請選擇想使用的位置', pickIntroBody: '點選地圖即可儲存天氣和附近博物館使用的基準位置。', pickIntroCancel: '稍後', pickIntroConfirm: '選擇位置', manualSaved: '地圖基準位置已儲存', switchTitle: '切換為目前位置？', switchBody: '要使用此按鈕，需要將位置設定切換為目前位置。', switchCancel: '稍後', switchConfirm: '使用目前位置', pickButton: '設定所選位置' },
  da: { pickPrompt: 'Vælg din kortplacering', pickCancel: 'Annuller', pickIntroTitle: 'Vælg den ønskede placering', pickIntroBody: 'Tryk på kortet for at gemme referenceplaceringen til vejr og museer i nærheden.', pickIntroCancel: 'Senere', pickIntroConfirm: 'Vælg placering', manualSaved: 'Kortplacering gemt', switchTitle: 'Brug aktuel placering?', switchBody: 'For at bruge knappen skal placering skiftes til aktuel placering.', switchCancel: 'Senere', switchConfirm: 'Brug aktuel placering', pickButton: 'Sæt valgt placering' },
  fi: { pickPrompt: 'Valitse sijainti kartalta', pickCancel: 'Peruuta', pickIntroTitle: 'Valitse haluamasi sijainti', pickIntroBody: 'Napauta karttaa tallentaaksesi säässä ja lähimuseoissa käytettävän sijainnin.', pickIntroCancel: 'Myöhemmin', pickIntroConfirm: 'Valitse sijainti', manualSaved: 'Karttasijainti tallennettu', switchTitle: 'Käytetäänkö nykyistä sijaintia?', switchBody: 'Tämän painikkeen käyttö vaatii sijaintiasetukseksi nykyisen sijainnin.', switchCancel: 'Myöhemmin', switchConfirm: 'Käytä nykyistä sijaintia', pickButton: 'Aseta valittu sijainti' },
  sv: { pickPrompt: 'Välj plats på kartan', pickCancel: 'Avbryt', pickIntroTitle: 'Välj platsen du vill använda', pickIntroBody: 'Tryck på kartan för att spara platsen för väder och museer i närheten.', pickIntroCancel: 'Senare', pickIntroConfirm: 'Välj plats', manualSaved: 'Kartplats sparad', switchTitle: 'Använd aktuell plats?', switchBody: 'För att använda knappen behöver platsinställningen bytas till aktuell plats.', switchCancel: 'Senare', switchConfirm: 'Använd aktuell plats', pickButton: 'Ange vald plats' },
  et: { pickPrompt: 'Vali asukoht kaardil', pickCancel: 'Tühista', pickIntroTitle: 'Vali soovitud asukoht', pickIntroBody: 'Puuduta kaarti, et salvestada ilma ja lähedal muuseumide lähteasukoht.', pickIntroCancel: 'Hiljem', pickIntroConfirm: 'Vali asukoht', manualSaved: 'Kaardi asukoht salvestatud', switchTitle: 'Kas kasutada praegust asukohta?', switchBody: 'Selle nupu kasutamiseks tuleb asukoha seade muuta praeguseks asukohaks.', switchCancel: 'Hiljem', switchConfirm: 'Kasuta praegust asukohta', pickButton: 'Määra valitud asukoht' },
};
const MOBILE_FILTERS: string[] = [...MUSEUM_CATEGORY_FILTERS];
function readMapCategoryFilter() {
  if (typeof window === 'undefined') return 'All';
  const saved = getLocalValue(MAP_CATEGORY_FILTER_KEY);
  return saved && MOBILE_FILTERS.includes(saved) ? saved : 'All';
}

const TRIP_REORDER_LABELS: Record<Locale, { title: string; message: string; saved: string; failed: string }> = {
  ko: { title: '여행 순서를 바꿀까요?', message: '변경한 순서를 내 여행에도 저장할게요.', saved: '여행 순서를 저장했어요', failed: '여행 순서를 저장하지 못했어요' },
  en: { title: 'Update trip order?', message: 'The new order will also be saved to My Trips.', saved: 'Trip order saved', failed: 'Failed to save trip order' },
  ja: { title: '旅行の順序を変更しますか？', message: '変更した順序をマイトリップにも保存します。', saved: '旅行順序を保存しました', failed: '旅行順序を保存できませんでした' },
  de: { title: 'Reihenfolge ändern?', message: 'Die neue Reihenfolge wird auch in Meine Reisen gespeichert.', saved: 'Reihenfolge gespeichert', failed: 'Reihenfolge konnte nicht gespeichert werden' },
  fr: { title: 'Modifier l’ordre du voyage ?', message: 'Le nouvel ordre sera aussi enregistré dans Mes voyages.', saved: 'Ordre du voyage enregistré', failed: 'Impossible d’enregistrer l’ordre' },
  es: { title: '¿Actualizar el orden?', message: 'El nuevo orden también se guardará en Mis viajes.', saved: 'Orden guardado', failed: 'No se pudo guardar el orden' },
  pt: { title: 'Atualizar ordem da viagem?', message: 'A nova ordem também será salva em Minhas viagens.', saved: 'Ordem salva', failed: 'Não foi possível salvar a ordem' },
  'zh-CN': { title: '更新旅行顺序？', message: '新的顺序也会保存到我的旅行。', saved: '旅行顺序已保存', failed: '无法保存旅行顺序' },
  'zh-TW': { title: '更新旅行順序？', message: '新的順序也會儲存到我的旅行。', saved: '旅行順序已儲存', failed: '無法儲存旅行順序' },
  da: { title: 'Opdater rækkefølge?', message: 'Den nye rækkefølge gemmes også i Mine rejser.', saved: 'Rækkefølge gemt', failed: 'Kunne ikke gemme rækkefølgen' },
  fi: { title: 'Päivitetäänkö järjestys?', message: 'Uusi järjestys tallennetaan myös Omiin matkoihin.', saved: 'Järjestys tallennettu', failed: 'Järjestystä ei voitu tallentaa' },
  sv: { title: 'Uppdatera ordningen?', message: 'Den nya ordningen sparas också i Mina resor.', saved: 'Reseordning sparad', failed: 'Kunde inte spara ordningen' },
  et: { title: 'Kas muuta järjekorda?', message: 'Uus järjekord salvestatakse ka Minu reisidesse.', saved: 'Reisi järjekord salvestatud', failed: 'Järjekorda ei saanud salvestada' },
};

type CurrentWeather = { temp: number; code: number; cityName?: string };

function WeatherChipSvg({ code }: { code?: number | null }) {
  const isClear = code === 0;
  const isRain = code != null && [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code);
  const isSnow = code != null && [71, 73, 75, 77, 85, 86].includes(code);
  const isFog = code != null && [45, 48].includes(code);

  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {isClear ? (
        <>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.8v2.1M12 19.1v2.1M4.2 4.2l1.5 1.5M18.3 18.3l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.2 19.8l1.5-1.5M18.3 5.7l1.5-1.5" />
        </>
      ) : (
        <>
          <path d="M7.4 17.2h9.1a4.1 4.1 0 0 0 .5-8.2 5.8 5.8 0 0 0-11.1 1.8A3.5 3.5 0 0 0 7.4 17.2Z" />
          {!isRain && !isSnow && !isFog && <path d="M5.8 7.6a4.5 4.5 0 0 1 5.9-4.2" />}
        </>
      )}
      {isRain && (
        <>
          <path d="M8.5 20.7l1-2" />
          <path d="M13 20.7l1-2" />
          <path d="M17.5 20.7l1-2" />
        </>
      )}
      {isSnow && (
        <>
          <path d="M9 19.6h.01" />
          <path d="M13 20.6h.01" />
          <path d="M17 19.6h.01" />
        </>
      )}
      {isFog && (
        <>
          <path d="M5.5 19h13" />
          <path d="M7.5 21h9" />
        </>
      )}
    </svg>
  );
}

const mm2 = {
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 'max(12px, env(safe-area-inset-top, 0px))',
    zIndex: 80,
    padding: '8px 18px 22px',
    overflow: 'visible',
    pointerEvents: 'none',
  } satisfies CSSProperties,
  searchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    overflow: 'visible',
  } satisfies CSSProperties,
  search: {
    flex: '1 1 auto',
    minWidth: 0,
    height: 58,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 18px',
    borderRadius: 999,
    color: '#0f172a',
    background: 'rgba(255,255,255,.96)',
    border: '1px solid rgba(226,232,240,.8)',
    boxShadow: '0 8px 18px rgba(15,23,42,.12), 0 2px 5px rgba(15,23,42,.07), inset 0 1px 0 rgba(255,255,255,.82)',
    WebkitBackdropFilter: 'blur(18px) saturate(160%)',
    backdropFilter: 'blur(18px) saturate(160%)',
    pointerEvents: 'auto',
  } satisfies CSSProperties,
  searchInput: {
    flex: '1 1 auto',
    minWidth: 0,
    display: 'block',
    border: 0,
    outline: 0,
    background: 'transparent',
    color: '#0f172a',
    fontSize: 15,
    fontWeight: 400,
    lineHeight: 1,
  } satisfies CSSProperties,
  iconPill: {
    flex: '0 0 54px',
    width: 54,
    height: 54,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(203,213,225,.9)',
    borderRadius: 999,
    color: '#334155',
    background: 'rgba(255,255,255,.96)',
    boxShadow: 'none',
    pointerEvents: 'auto',
  } satisfies CSSProperties,
  activePill: {
    color: '#fff',
    background: '#2563eb',
  } satisfies CSSProperties,
  pillRow: {
    display: 'grid',
    gridTemplateColumns: '54px',
    position: 'absolute',
    top: 74,
    right: 18,
    width: 54,
    alignItems: 'start',
    justifyContent: 'stretch',
    gap: 8,
    marginTop: 0,
    marginLeft: 0,
    marginRight: 0,
    padding: '0 0 8px',
    overflow: 'visible',
    scrollbarWidth: 'none',
  } satisfies CSSProperties,
  toolPill: {
    flex: '0 0 auto',
    height: 46,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: '0 15px',
    border: '1px solid rgba(203,213,225,.9)',
    borderRadius: 999,
    color: '#0f172a',
    background: 'rgba(255,255,255,.96)',
    boxShadow: 'none',
    fontSize: 14,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    pointerEvents: 'auto',
  } satisfies CSSProperties,
  floatingList: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 'calc(max(12px, env(safe-area-inset-top, 0px)) + 64px)',
    zIndex: 120,
    maxHeight: 290,
    overflowY: 'auto',
    borderRadius: 24,
    background: 'rgba(255,255,255,.98)',
    border: '1px solid rgba(226,232,240,.82)',
    boxShadow: '0 26px 60px rgba(15,23,42,.18)',
    pointerEvents: 'auto',
  } satisfies CSSProperties,
  categoryMenu: {
    position: 'absolute',
    left: 'auto',
    right: 80,
    top: 'calc(max(12px, env(safe-area-inset-top, 0px)) + 134px)',
    width: 'min(300px, calc(100vw - 104px))',
    zIndex: 120,
    display: 'block',
    padding: 0,
    maxHeight: 'min(360px, calc(100dvh - 250px))',
    overflow: 'hidden',
    borderRadius: 24,
    background: 'rgba(255,255,255,.98)',
    border: '1px solid rgba(226,232,240,.82)',
    boxShadow: '0 18px 42px rgba(15,23,42,.14)',
    pointerEvents: 'auto',
  } satisfies CSSProperties,
  categoryButton: {
    minWidth: 0,
    padding: '12px 11px',
    border: 0,
    borderRadius: 16,
    color: '#475569',
    background: '#f8fafc',
    fontSize: 13,
    fontWeight: 600,
    textAlign: 'left',
  } satisfies CSSProperties,
  categoryButtonActive: {
    color: '#fff',
    background: '#2563eb',
    boxShadow: '0 10px 24px rgba(37, 99, 235, 0.22)',
  } satisfies CSSProperties,
  floatActions: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 222,
    zIndex: 62,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    pointerEvents: 'none',
  } satisfies CSSProperties,
  floatBtn: {
    width: 54,
    height: 54,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 0,
    borderRadius: 999,
    color: '#334155',
    background: 'rgba(255,255,255,.96)',
    boxShadow: '0 16px 34px rgba(15,23,42,.16), inset 0 1px 0 rgba(255,255,255,.9)',
    pointerEvents: 'auto',
  } satisfies CSSProperties,
  placeSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 'calc(78px + env(safe-area-inset-bottom, 0px))',
    zIndex: 70,
    minHeight: 124,
    padding: '10px 18px 16px',
    borderRadius: '30px 30px 0 0',
    color: '#0f172a',
    background: 'rgba(255,255,255,.97)',
    borderTop: '1px solid rgba(226,232,240,.78)',
    boxShadow: '0 -22px 56px rgba(15,23,42,.14), inset 0 1px 0 rgba(255,255,255,.95)',
    pointerEvents: 'auto',
  } satisfies CSSProperties,
  placeSheetExpanded: {
    minHeight: 'min(520px, calc(100dvh - 158px))',
  } satisfies CSSProperties,
  sheetHandle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 18,
    border: 0,
    background: 'transparent',
    padding: 0,
  } satisfies CSSProperties,
  sheetHandleBar: {
    display: 'block',
    width: 44,
    height: 5,
    borderRadius: 999,
    background: '#cbd5e1',
  } satisfies CSSProperties,
  previewCard: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '10px 0 2px',
    border: 0,
    background: 'transparent',
    textAlign: 'left',
    color: '#0f172a',
  } satisfies CSSProperties,
  previewImage: {
    width: 112,
    height: 82,
    flex: '0 0 112px',
    overflow: 'hidden',
    borderRadius: 18,
    background: '#eaf2ff',
  } satisfies CSSProperties,
  fullImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  } satisfies CSSProperties,
  previewTitle: {
    margin: '0 0 8px',
    color: '#0f172a',
    fontSize: 18,
    fontWeight: 1000,
    lineHeight: 1.12,
  } satisfies CSSProperties,
  previewMeta: {
    display: 'flex',
    minWidth: 0,
    alignItems: 'center',
    gap: 8,
    color: '#64748b',
    fontSize: 13,
    fontWeight: 850,
  } satisfies CSSProperties,
  bookmark: {
    width: 48,
    height: 48,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 48px',
    borderRadius: 999,
    color: '#2563eb',
    background: 'rgba(255,255,255,.84)',
    boxShadow: '0 8px 24px rgba(15,23,42,.08)',
  } satisfies CSSProperties,
  listPanel: {
    display: 'flex',
    flexDirection: 'column',
    height: 'min(460px, calc(100dvh - 206px))',
    paddingTop: 2,
  } satisfies CSSProperties,
  listHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '8px 0 12px',
  } satisfies CSSProperties,
  listTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: 1000,
  } satisfies CSSProperties,
  listSubtitle: {
    display: 'block',
    marginTop: 3,
    color: '#64748b',
    fontSize: 12,
    fontWeight: 850,
  } satisfies CSSProperties,
  closeBtn: {
    width: 38,
    height: 38,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 38px',
    border: 0,
    borderRadius: 999,
    color: '#475569',
    background: '#f1f5f9',
  } satisfies CSSProperties,
  scrollList: {
    minHeight: 0,
    flex: '1 1 auto',
    overflowY: 'auto',
    padding: '0 0 12px',
  } satisfies CSSProperties,
  listItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 0',
    border: 0,
    borderBottom: '1px solid rgba(226,232,240,.72)',
    background: 'transparent',
    textAlign: 'left',
  } satisfies CSSProperties,
  listImage: {
    width: 68,
    height: 58,
    flex: '0 0 68px',
    overflow: 'hidden',
    borderRadius: 16,
    background: '#eaf2ff',
  } satisfies CSSProperties,
  listItemTitle: {
    display: 'block',
    overflow: 'hidden',
    color: '#0f172a',
    fontSize: 14,
    fontWeight: 950,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } satisfies CSSProperties,
  listItemMeta: {
    display: 'block',
    marginTop: 4,
    overflow: 'hidden',
    color: '#64748b',
    fontSize: 12,
    fontWeight: 800,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } satisfies CSSProperties,
};

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
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-blue-600 shrink-0">
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

function SearchResultButton({ result, locale, onMuseumSelect }: {
  result: { kind: 'museum'; museum: any };
  locale: Locale;
  onMuseumSelect: (museum: any) => void;
}) {
  const item = result.museum;
  const image = getMuseumImageSrc(item);
  const title = getLocalizedMuseumName(item, locale);
  const subtitle = [getLocalizedCityName(item, locale) || item.city, (() => {
      try { return new Intl.DisplayNames([locale], { type: 'region' }).of(item.country); } catch { return item.country; }
    })()].filter(Boolean).join(', ');

  return (
    <button
      className="mm-map2-search-result w-full text-left px-4 py-3 transition-colors border-b last:border-0 flex items-center gap-3"
      onClick={() => onMuseumSelect(item)}
    >
      <div className="mm-map2-search-result-thumb w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
        {image ? (
          <img src={image} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.parentElement?.querySelector('.sf') as HTMLElement; if (fb) fb.style.display = 'flex'; }} />
        ) : null}
        <div className={`sf w-full h-full items-center justify-center ${image ? 'hidden' : 'flex'}`}>
          <img src="/logo.svg" alt="" className="w-5 h-5 opacity-20 dark:invert dark:opacity-60" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="mm-map2-search-result-title truncate">{title}</span>
        </div>
        <div className="mm-map2-search-result-subtitle truncate">{subtitle}</div>
      </div>
    </button>
  );
}

function MuseumNewIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20h16M5.5 18V9.5L12 5l6.5 4.5V18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 18v-5h7v5M9.5 10.5h5M10.5 13.5h3" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NewMuseumListItem({ museum, locale, onSelect }: { museum: any; locale: Locale; onSelect: (museum: any) => void }) {
  const imageSrc = getMuseumImageSrc(museum);
  return (
    <button
      key={museum.id}
      type="button"
      className="mm-map2-new-museum-item"
      onClick={() => onSelect(museum)}
    >
      <div className="mm-map2-new-museum-thumb">
        {imageSrc ? (
          <img src={imageSrc} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.parentElement?.querySelector('.sf') as HTMLElement; if (fb) fb.style.display = 'flex'; }} />
        ) : null}
        <div className={`sf ${imageSrc ? 'hidden' : 'flex'}`}>
          <img src="/logo.svg" alt="" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mm-map2-new-museum-title-row">
          <span className="mm-map2-new-museum-title">{getLocalizedMuseumName(museum, locale)}</span>
          <span className="mm-map2-new-museum-new">N</span>
        </div>
        <div className="mm-map2-new-museum-meta">{getLocalizedCityName(museum, locale) || museum.city || translateCategory(museum.type || '', locale)}</div>
      </div>
      <span className="mm-map2-new-museum-date">
        {(() => {
          const d = new Date(museum.createdAt);
          return Number.isFinite(d.getTime()) ? `${d.getMonth() + 1}/${d.getDate()}` : '';
        })()}
      </span>
    </button>
  );
}

export default function MainPage() {
  const { compareIds: compareIdsArr } = useCompare();
  const { savedIds: savedMuseumIds, refresh: refreshSavedIds } = useAccountSaves({
    initialFetch: 'idle',
    idleTimeout: 3500,
  });
  const compareIdsSet = useMemo(() => new Set(compareIdsArr), [compareIdsArr]);
  const [museums, setMuseums] = useState<any[]>([]);
  const [selectedMuseum, setSelectedMuseum] = useState<any | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>(readMapCategoryFilter);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categoryDropdownClosing, setCategoryDropdownClosing] = useState(false);
  const categoryCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nearbyOpenRef = useRef(false);
  const weatherOpenRef = useRef(false);
  const [mapSideMenuOpen, setMapSideMenuOpen] = useState(false);
  const { locale, darkMode } = useApp();
  const { showAlert, showConfirm } = useModal();
  const [searchParams, setSearchParams] = useState<URLSearchParams | null>(null);
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [isViewingActiveRoute, setIsViewingActiveRoute] = useState(false);
  const [tripExiting, setTripExiting] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [navToolbarReady, setNavToolbarReady] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showTripActivatedNotif, setShowTripActivatedNotif] = useState(false);
  const { data: session, status } = useSession();
  const [showConsentGate, setShowConsentGate] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentSubmitting, setConsentSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncSearchParams = () => setSearchParams(new URLSearchParams(window.location.search));
    syncSearchParams();
    window.addEventListener('popstate', syncSearchParams);
    return () => window.removeEventListener('popstate', syncSearchParams);
  }, []);

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
    if (categoryCloseTimerRef.current) {
      clearTimeout(categoryCloseTimerRef.current);
      categoryCloseTimerRef.current = null;
    }
    setCategoryDropdownClosing(true);
    categoryCloseTimerRef.current = setTimeout(() => {
      setCategoryDropdownOpen(false);
      setCategoryDropdownClosing(false);
      categoryCloseTimerRef.current = null;
    }, 220);
  }, [categoryDropdownOpen]);
  const [chipOpen, setChipOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMuseumsOpen, setNewMuseumsOpen] = useState(false);
  const [newMuseumsClosing, setNewMuseumsClosing] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [returnFromDetail, setReturnFromDetail] = useState(false);
  const skipTransition = false;
  const [detailPanelEntered, setDetailPanelEntered] = useState(false);
  const [detailPanelClosing, setDetailPanelClosing] = useState(false);

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
        if (categoryCloseTimerRef.current) {
          clearTimeout(categoryCloseTimerRef.current);
          categoryCloseTimerRef.current = null;
        }
        setCategoryDropdownClosing(true);
        categoryCloseTimerRef.current = setTimeout(() => {
          setCategoryDropdownOpen(false);
          setCategoryDropdownClosing(false);
          categoryCloseTimerRef.current = null;
        }, 220);
      }
    }
    if (except !== 'chip') setChipOpen(false);
    if (except !== 'ai') { setAiOpen(false); setAiResults([]); setAiQuery(''); }
    if (except !== 'nearby' && nearbyOpenRef.current) {
      setNearbyClosing(true);
      setTimeout(() => {
        nearbyOpenRef.current = false;
        setNearbyOpen(false);
        setNearbyClosing(false);
        setNearbyPopupTriggerRef(null);
      }, 180);
    }
    if (except !== 'weather' && weatherOpenRef.current) {
      setWeatherClosing(true);
      setTimeout(() => {
        weatherOpenRef.current = false;
        setWeatherOpen(false);
        setWeatherClosing(false);
        setWeatherPopupTriggerRef(null);
      }, 180);
    }
    if (except !== 'sideMenu') setMapSideMenuOpen(false);
  }, [categoryDropdownOpen, newMuseumsOpen]);
  const openCategoryDropdown = useCallback(() => {
    if (categoryCloseTimerRef.current) {
      clearTimeout(categoryCloseTimerRef.current);
      categoryCloseTimerRef.current = null;
    }
    setCategoryDropdownClosing(false);
    closeAllPopups('category');
    setCategoryDropdownOpen(true);
  }, [closeAllPopups]);
  const prevSelectedRef = useRef<any>(null);
  const selectedMuseumRef = useRef<any>(null);
  const isHandlingPopState = useRef(false);
  const detailPanelCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep ref in sync with state for stable popstate access
  useEffect(() => { selectedMuseumRef.current = selectedMuseum; }, [selectedMuseum]);

  const closeMuseumPanel = useCallback((syncHistory = true) => {
    if (!selectedMuseumRef.current && !selectedMuseum) return;
    if (detailPanelCloseTimerRef.current) {
      clearTimeout(detailPanelCloseTimerRef.current);
      detailPanelCloseTimerRef.current = null;
    }

    setDetailPanelClosing(true);
    setDetailPanelEntered(false);
    setHighlightedMuseumId(null);
    selectedMuseumRef.current = null;

    if (syncHistory && typeof window !== 'undefined' && window.history.state?.museumPanel) {
      isHandlingPopState.current = true;
      window.history.back();
      setTimeout(() => {
        isHandlingPopState.current = false;
      }, 600);
    }

    detailPanelCloseTimerRef.current = setTimeout(() => {
      setSelectedMuseum(null);
      setDetailPanelClosing(false);
      detailPanelCloseTimerRef.current = null;
    }, 320);
  }, [selectedMuseum]);

  const openMuseumPanel = useCallback((museum: any) => {
    if (detailPanelCloseTimerRef.current) {
      clearTimeout(detailPanelCloseTimerRef.current);
      detailPanelCloseTimerRef.current = null;
    }
    selectedMuseumRef.current = museum;
    setDetailPanelClosing(false);
    setSelectedMuseum(museum);

    if (typeof window === 'undefined') return;
    if (window.history.state?.museumPanel) {
      window.history.replaceState({ museumPanel: true }, '');
    } else {
      window.history.pushState({ museumPanel: true }, '');
    }
  }, []);

  const moveToSelectedMuseumLocation = useCallback(() => {
    const museum = selectedMuseumRef.current || selectedMuseum;
    if (!museum?.latitude || !museum?.longitude) return;
    const lat = Number(museum.latitude);
    const lng = Number(museum.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const targetMuseumId = String(museum.id);
    const pulseTarget = () => {
      setHighlightedMuseumId(targetMuseumId);
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          setHighlightedMuseumId((current) => current === targetMuseumId ? null : current);
        }, 3200);
      }
    };

    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1181px)').matches) {
      pulseTarget();
      setMapFlyTo({
        lat,
        lng,
        zoom: 15,
        offset: [-Math.min(240, Math.round(window.innerWidth * 0.14)), 0],
        key: Date.now(),
      });
      return;
    }

    closeMuseumPanel(true);
    pulseTarget();
    setMapFlyTo({ lat, lng, zoom: 15, key: Date.now() });
  }, [closeMuseumPanel, selectedMuseum]);

  useEffect(() => {
    return () => {
      if (detailPanelCloseTimerRef.current) {
        clearTimeout(detailPanelCloseTimerRef.current);
      }
    };
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

  // New museums — only those created within last 7 days
  const newMuseums = useMemo(() => {
    const CACHE_KEY = 'newMuseums_cache_v3_7d';
    const CACHE_TTL = 60 * 60 * 1000; // 1h cache (check recency more often)
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    if (museums.length === 0) return [];
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, ts, total } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL && total === museums.length) return data;
      }
    } catch { }
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const recent = [...museums]
      .filter(m => {
        const created = m.createdAt ? new Date(m.createdAt).getTime() : NaN;
        return Number.isFinite(created) && created > cutoff;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: recent, ts: Date.now(), total: museums.length })); } catch { }
    return recent;
  }, [museums]);

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
    let cancelled = false;
    let retries = 0;
    const maxRetries = 5;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelCacheWrite: (() => void) | undefined;
    const museumsCacheKey = getMuseumsCacheKey(locale);

    // Parse cached map data outside the main thread so mobile taps stay responsive.
    try {
      const cached = sessionStorage.getItem(museumsCacheKey);
      if (cached) {
        parseJsonOffMainThread<any>(cached)
          .then(data => {
            if (cancelled) return;
            if (isUsableMuseumsCache(data)) {
              setMuseums(data);
            } else {
              try { sessionStorage.removeItem(museumsCacheKey); } catch { }
            }
          })
          .catch(() => {
            try { sessionStorage.removeItem(museumsCacheKey); } catch { }
          });
      }
    } catch { }

    const fetchMuseums = () => {
      fetch(`/api/museums?limit=5000&view=map&locale=${encodeURIComponent(locale)}`)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        })
        .then(text => parseJsonOffMainThread<any>(text))
        .then(res => {
          if (cancelled) return;
          const data = res?.data?.data || res?.data || [];
          if (Array.isArray(data) && data.length > 0) {
            setMuseums(data);
            if (isUsableMuseumsCache(data)) {
              cancelCacheWrite?.();
              cancelCacheWrite = scheduleSessionJsonCache(museumsCacheKey, data);
            }
            return;
          }
          if (retries < maxRetries) {
            retries++;
            timer = setTimeout(fetchMuseums, 2000 * retries);
          }
        })
        .catch(() => {
          if (cancelled) return;
          if (retries < maxRetries) {
            retries++;
            timer = setTimeout(fetchMuseums, 2000 * retries);
          }
        });
    };

    fetchMuseums();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      cancelCacheWrite?.();
    };
  }, [locale]);

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
      openMuseumPanel(museum);
    }
    setInitialMuseumId(null);
  }, [initialMuseumId, museums, openMuseumPanel]);

  // 외부 상세 페이지의 '위치 이동하기' — /?flyTo=lat,lng&flyToId=<id>
  useEffect(() => {
    const flyToParam = searchParams?.get('flyTo');
    if (!flyToParam) return;
    const [latStr, lngStr] = flyToParam.split(',');
    const lat = Number(latStr);
    const lng = Number(lngStr);
    const fid = searchParams?.get('flyToId');
    window.history.replaceState({}, '', '/');
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setMapFlyTo({ lat, lng, zoom: 15, key: Date.now() });
    if (fid) {
      setHighlightedMuseumId(fid);
      window.setTimeout(() => {
        setHighlightedMuseumId((current) => current === fid ? null : current);
      }, 3200);
    }
  }, [searchParams]);

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

  const refreshActiveTrip = useCallback(() => {
    const parsed = getActiveTripForAccount(session?.user?.email);
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
  }, [session?.user?.email]);

  // Check for active trip
  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      setActiveTrip(null);
      setIsViewingActiveRoute(false);
      return;
    }
    refreshActiveTrip();
    window.addEventListener(ACTIVE_TRIP_CHANGE_EVENT, refreshActiveTrip);
    window.addEventListener('storage', refreshActiveTrip);
    window.addEventListener('focus', refreshActiveTrip);
    return () => {
      window.removeEventListener(ACTIVE_TRIP_CHANGE_EVENT, refreshActiveTrip);
      window.removeEventListener('storage', refreshActiveTrip);
      window.removeEventListener('focus', refreshActiveTrip);
    };
  }, [status, refreshActiveTrip]);

  useEffect(() => {
    if (searchParams?.get('trip') !== 'active' || !activeTrip || activeTrip.pending) return;
    setSelectedMuseum(null);
    setIsViewingActiveRoute(true);
  }, [searchParams, activeTrip]);

  const handleMuseumClick = async (id: string) => {
    const museum = museums.find(m => m.id === id);
    if (museum) {
      openMuseumPanel(museum);
    } else {
      window.location.assign(`/museums/${id}`);
    }
  };

  // Listen for browser back (swipe/button) to close panel instead of navigating away
  // NOTE: No dependency on selectedMuseum — uses ref to avoid stale closure & handler recreation
  useEffect(() => {
    const handlePopState = () => {
      // Guard against rapid double-fire
      if (isHandlingPopState.current) return;
      // If we're back to museumPanel state (e.g. photo zoom just closed), keep detail open
      if (window.history.state?.museumPanel) return;
      if (selectedMuseumRef.current) {
        isHandlingPopState.current = true;
        closeMuseumPanel(false);
        setTimeout(() => { isHandlingPopState.current = false; }, 600);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [closeMuseumPanel]);

  // Map museums: filtered by category only (search should NOT hide markers)
  const mapMuseums = useMemo(
    () => museums.filter(m => activeFilter === 'All' || m.type === activeFilter),
    [museums, activeFilter],
  );
  const normalizedSearchQuery = searchQuery.toLowerCase().trim();

  // Search results: museums only. Map markers are still filtered only by category.
  const museumSearchResults = useMemo(() => {
    if (!normalizedSearchQuery) return mapMuseums;
    return mapMuseums.filter(m => {
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
      return values.some(value => String(value || '').toLowerCase().includes(normalizedSearchQuery));
    });
  }, [mapMuseums, normalizedSearchQuery, locale]);
  const searchResults = useMemo(
    () => museumSearchResults.slice(0, 8).map(museum => ({ kind: 'museum' as const, museum })),
    [museumSearchResults],
  );

  // Alias for category counts and total display
  const filteredMuseums = mapMuseums;
  const mobileListMuseums = useMemo(() => mapMuseums.slice(0, 120), [mapMuseums]);
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const museum of filteredMuseums) {
      const type = museum.type || 'OTHER';
      if (type === 'Aquarium') continue;
      const translated = translateCategory(type, locale);
      counts[translated] = (counts[translated] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredMuseums, locale]);
  const mobileToolLabels = MOBILE_TOOL_LABELS[locale] || MOBILE_TOOL_LABELS.en;
  const mapLocationLabels = MAP_LOCATION_LABELS[locale] || MAP_LOCATION_LABELS.en;
  const mapZoomLabels = MAP_ZOOM_LABELS[locale] || MAP_ZOOM_LABELS.en;
  const accountLocationEmail = status === 'authenticated' && session?.user?.email && !session?.user?.name?.startsWith('guest_')
    ? session.user.email
    : null;

  const isDarkMode = darkMode;
  const [mapFlyTo, setMapFlyTo] = useState<{ lat: number; lng: number; zoom?: number; offset?: [number, number]; key?: number } | null>(null);
  const [mapZoom, setMapZoom] = useState(3);
  const [mapZoomCommand, setMapZoomCommand] = useState<{ zoom: number; key: number } | null>(null);
  const [highlightedMuseumId, setHighlightedMuseumId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<MapLocation | null>(null);
  const [manualLocation, setManualLocation] = useState<MapLocation | null>(null);
  const [locationSource, setLocationSource] = useState<MapLocationSource>('current');
  const [locationPickMode, setLocationPickMode] = useState(false);
  const [locationPickIntroOpen, setLocationPickIntroOpen] = useState(false);
  const [locationSwitchOpen, setLocationSwitchOpen] = useState(false);


  const [tripSheetOpen, setTripSheetOpen] = useState(true);
  const [tripStopsLocal, setTripStopsLocal] = useState<any[]>([]);
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [nearbyClosing, setNearbyClosing] = useState(false);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [weatherClosing, setWeatherClosing] = useState(false);
  const [currentWeather, setCurrentWeather] = useState<CurrentWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [mapPrefs, setMapPrefs] = useState<MapPrefs>(DEFAULT_MAP_PREFS);
  const nearbyBtnRefMobile = useRef<HTMLButtonElement>(null);
  const weatherBtnRefMobile = useRef<HTMLButtonElement>(null);
  const nearbyBtnRefPC = useRef<HTMLButtonElement>(null);
  const weatherBtnRefPC = useRef<HTMLButtonElement>(null);
  const [nearbyPopupTriggerRef, setNearbyPopupTriggerRef] = useState<RefObject<HTMLButtonElement | null> | null>(null);
  const [weatherPopupTriggerRef, setWeatherPopupTriggerRef] = useState<RefObject<HTMLButtonElement | null> | null>(null);
  // Track active viewport so we render a single popup tied to the visible trigger.
  // Rendering popups at both locations would double up via body portal.
  const [isLgViewport, setIsLgViewport] = useState(false);
  const setCategoryFilter = useCallback((filter: string) => {
    const nextFilter = MOBILE_FILTERS.includes(filter) ? filter : 'All';
    setActiveFilter(nextFilter);
    setLocalValue(MAP_CATEGORY_FILTER_KEY, nextFilter);
  }, []);
  const closeNearbyPopup = useCallback(() => {
    if (!nearbyOpenRef.current && !nearbyOpen) return;
    setNearbyClosing(true);
    setTimeout(() => {
      nearbyOpenRef.current = false;
      setNearbyOpen(false);
      setNearbyClosing(false);
      setNearbyPopupTriggerRef(null);
    }, 180);
  }, [nearbyOpen]);
  const closeWeatherPopup = useCallback(() => {
    if (!weatherOpenRef.current && !weatherOpen) return;
    setWeatherClosing(true);
    setTimeout(() => {
      weatherOpenRef.current = false;
      setWeatherOpen(false);
      setWeatherClosing(false);
      setWeatherPopupTriggerRef(null);
    }, 180);
  }, [weatherOpen]);
  useEffect(() => { nearbyOpenRef.current = nearbyOpen; }, [nearbyOpen]);
  useEffect(() => { weatherOpenRef.current = weatherOpen; }, [weatherOpen]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsLgViewport(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncPrefs = () => {
      const next = readMapPrefs();
      setMapPrefs(next);
      if (!next.nearby) closeNearbyPopup();
      if (!next.weather) closeWeatherPopup();
    };
    syncPrefs();
    window.addEventListener('storage', syncPrefs);
    window.addEventListener('mm-map-prefs-change', syncPrefs as EventListener);
    return () => {
      window.removeEventListener('storage', syncPrefs);
      window.removeEventListener('mm-map-prefs-change', syncPrefs as EventListener);
    };
  }, [closeNearbyPopup, closeWeatherPopup]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncLocationSource = () => {
      const nextSource = readMapLocationSourceForAccount(accountLocationEmail);
      const nextManual = readManualMapLocationForAccount(accountLocationEmail) || readManualMapLocation();
      setLocationSource(nextSource);
      setManualLocation(nextManual);
      if (nextSource === 'manual' && nextManual) {
        setUserLocation(nextManual);
      }
    };
    syncLocationSource();
    const shouldPickFromUrl = hasSelectLocationQuery();
    const shouldPickFromSession = getSessionValue(MAP_LOCATION_PICK_MODE_KEY) === '1';
    if ((shouldPickFromUrl || shouldPickFromSession) && !locationPickMode && !locationPickIntroOpen) {
      if (accountLocationEmail) {
        setLocalValue(mapLocationAccountKey(accountLocationEmail, 'source'), 'manual');
      }
      setLocalValue(MAP_LOCATION_SOURCE_KEY, 'manual');
      removeSessionValue(MAP_LOCATION_PICK_MODE_KEY);
      window.dispatchEvent(new CustomEvent('mm-map-location-source-change', { detail: { source: 'manual' } }));
      setLocationSource('manual');
      setLocationPickIntroOpen(true);
      closeAllPopups();
    }
    window.addEventListener('storage', syncLocationSource);
    window.addEventListener('mm-map-location-source-change', syncLocationSource as EventListener);
    return () => {
      window.removeEventListener('storage', syncLocationSource);
      window.removeEventListener('mm-map-location-source-change', syncLocationSource as EventListener);
    };
  }, [accountLocationEmail, closeAllPopups, locationPickIntroOpen, locationPickMode]);

  const persistLocationSource = useCallback((source: MapLocationSource) => {
    if (typeof window === 'undefined') return;
    if (accountLocationEmail) {
      setLocalValue(mapLocationAccountKey(accountLocationEmail, 'source'), source);
    }
    setLocalValue(MAP_LOCATION_SOURCE_KEY, source);
    window.dispatchEvent(new CustomEvent('mm-map-location-source-change', { detail: { source } }));
    setLocationSource(source);
  }, [accountLocationEmail]);

  const requestCurrentLocation = useCallback((moveMap = true, showError = true) => {
    const notifyLocationError = () => {
      if (showError) showAlert(mobileToolLabels.locationError);
    };
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      notifyLocationError();
      return;
    }
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude);
          const lng = Number(pos.coords.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            notifyLocationError();
            return;
          }
          const nextLocation = { lng, lat };
          setUserLocation(nextLocation);
          if (moveMap) setMapFlyTo({ ...nextLocation, zoom: 15, key: Date.now() });
        },
        notifyLocationError,
        { enableHighAccuracy: moveMap, timeout: moveMap ? 9000 : 4500, maximumAge: moveMap ? 60_000 : 180_000 }
      );
    } catch {
      notifyLocationError();
    }
  }, [mobileToolLabels.locationError, showAlert]);

  useEffect(() => {
    if (locationSource !== 'current') return;
    setCurrentWeather(null);
    requestCurrentLocation(false, false);
  }, [locationSource, requestCurrentLocation]);

  const handleCurrentLocationPress = useCallback(() => {
    persistLocationSource('current');
    setLocationPickMode(false);
    setLocationPickIntroOpen(false);
    setLocationSwitchOpen(false);
    if (typeof window !== 'undefined') {
      removeSessionValue(MAP_LOCATION_PICK_MODE_KEY);
      clearSelectLocationQuery();
    }
    if (userLocation) {
      setMapFlyTo({ ...userLocation, zoom: 15, key: Date.now() });
    }
    requestCurrentLocation();
  }, [persistLocationSource, requestCurrentLocation, userLocation]);

  const confirmUseCurrentLocation = useCallback(() => {
    persistLocationSource('current');
    setCurrentWeather(null);
    setLocationPickMode(false);
    setLocationPickIntroOpen(false);
    if (typeof window !== 'undefined') {
      removeSessionValue(MAP_LOCATION_PICK_MODE_KEY);
      clearSelectLocationQuery();
    }
    setLocationSwitchOpen(false);
    requestCurrentLocation();
  }, [persistLocationSource, requestCurrentLocation]);

  const cancelLocationPickMode = useCallback(() => {
    setLocationPickMode(false);
    setLocationPickIntroOpen(false);
    if (typeof window !== 'undefined') {
      removeSessionValue(MAP_LOCATION_PICK_MODE_KEY);
      clearSelectLocationQuery();
    }
  }, []);

  const startManualLocationPick = useCallback(() => {
    if (locationPickMode) {
      cancelLocationPickMode();
      return;
    }
    closeAllPopups();
    setLocationSwitchOpen(false);
    setLocationPickIntroOpen(false);
    persistLocationSource('manual');
    setLocationPickMode(true);
    if (typeof window !== 'undefined') {
      setSessionValue(MAP_LOCATION_PICK_MODE_KEY, '1');
    }
  }, [cancelLocationPickMode, closeAllPopups, locationPickMode, persistLocationSource]);

  const dismissLocationPickIntro = useCallback(() => {
    setLocationPickIntroOpen(false);
    if (typeof window !== 'undefined') {
      removeSessionValue(MAP_LOCATION_PICK_MODE_KEY);
      clearSelectLocationQuery();
    }
  }, []);

  const confirmLocationPickIntro = useCallback(() => {
    setLocationPickIntroOpen(false);
    closeAllPopups();
    setLocationSwitchOpen(false);
    persistLocationSource('manual');
    setLocationPickMode(true);
    if (typeof window !== 'undefined') {
      setSessionValue(MAP_LOCATION_PICK_MODE_KEY, '1');
      clearSelectLocationQuery();
    }
  }, [closeAllPopups, persistLocationSource]);

  const handleManualLocationSelect = useCallback((location: MapLocation) => {
    if (typeof window === 'undefined') return;
    const lat = Number(location.lat);
    const lng = Number(location.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      showAlert(mobileToolLabels.locationError);
      return;
    }
    const validLocation = { lat, lng };
    const next = { ...validLocation, updatedAt: new Date().toISOString() };
    if (accountLocationEmail) {
      setLocalValue(mapLocationAccountKey(accountLocationEmail, 'manual'), JSON.stringify(next));
      setLocalValue(mapLocationAccountKey(accountLocationEmail, 'source'), 'manual');
    }
    setLocalValue(MAP_MANUAL_LOCATION_KEY, JSON.stringify(next));
    setLocalValue(MAP_LOCATION_SOURCE_KEY, 'manual');
    removeSessionValue(MAP_LOCATION_PICK_MODE_KEY);
    window.dispatchEvent(new CustomEvent('mm-map-location-source-change', { detail: { source: 'manual', location: validLocation } }));
    clearSelectLocationQuery();
    setLocationSource('manual');
    setManualLocation(validLocation);
    setUserLocation(validLocation);
    setMapFlyTo({ ...validLocation, zoom: 13, key: Date.now() });
    setLocationPickMode(false);
    showAlert(mapLocationLabels.manualSaved);
  }, [accountLocationEmail, mapLocationLabels.manualSaved, mobileToolLabels.locationError, showAlert]);

  useEffect(() => {
    if (!selectedMuseum?.id || typeof window === 'undefined') {
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

  const activeNearbyRef = nearbyPopupTriggerRef || (isLgViewport ? nearbyBtnRefPC : nearbyBtnRefMobile);
  const activeWeatherRef = weatherPopupTriggerRef || (isLgViewport ? weatherBtnRefPC : weatherBtnRefMobile);
  const effectiveLocation = locationSource === 'manual' && manualLocation ? manualLocation : userLocation;
  const mapZoomLevelIndex = getNearestMapZoomLevelIndex(mapZoom);
  const [mapZoomSliderIndex, setMapZoomSliderIndex] = useState(mapZoomLevelIndex);
  const mapZoomSliderActiveRef = useRef(false);
  const mapZoomCommandActiveRef = useRef(false);
  const zoomDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomCommandReleaseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestMapZoom = useCallback((zoom: number, immediate = false) => {
    const nextZoomIndex = getNearestMapZoomLevelIndex(zoom);
    const nextZoom = MAP_ZOOM_LEVELS[nextZoomIndex] ?? snapMapZoom(zoom);
    setMapZoomSliderIndex(nextZoomIndex);
    setMapZoom(nextZoom);
    if (zoomDebounceRef.current) {
      clearTimeout(zoomDebounceRef.current);
      zoomDebounceRef.current = null;
    }
    const sendZoom = () => {
      mapZoomCommandActiveRef.current = true;
      if (zoomCommandReleaseRef.current) clearTimeout(zoomCommandReleaseRef.current);
      setMapZoomCommand({ zoom: nextZoom, key: Date.now() });
      zoomCommandReleaseRef.current = setTimeout(() => {
        mapZoomCommandActiveRef.current = false;
      }, 320);
    };
    if (immediate) {
      sendZoom();
      return;
    }
    zoomDebounceRef.current = setTimeout(sendZoom, 90);
  }, []);
  useEffect(() => {
    if (!mapZoomSliderActiveRef.current && !mapZoomCommandActiveRef.current) setMapZoomSliderIndex(mapZoomLevelIndex);
  }, [mapZoomLevelIndex]);
  useEffect(() => () => {
    if (zoomDebounceRef.current) clearTimeout(zoomDebounceRef.current);
    if (zoomCommandReleaseRef.current) clearTimeout(zoomCommandReleaseRef.current);
  }, []);
  const handleMapZoomIn = useCallback(() => {
    requestMapZoom(MAP_ZOOM_LEVELS[Math.min(MAP_ZOOM_LEVELS.length - 1, mapZoomSliderIndex + 1)], true);
  }, [mapZoomSliderIndex, requestMapZoom]);
  const handleMapZoomOut = useCallback(() => {
    requestMapZoom(MAP_ZOOM_LEVELS[Math.max(0, mapZoomSliderIndex - 1)], true);
  }, [mapZoomSliderIndex, requestMapZoom]);
  const handleMapZoomSliderChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    mapZoomSliderActiveRef.current = true;
    const nextIndex = Number(event.target.value);
    setMapZoomSliderIndex(nextIndex);
    requestMapZoom(MAP_ZOOM_LEVELS[nextIndex] ?? MAP_ZOOM_LEVELS[0]);
  }, [requestMapZoom]);
  const handleMapZoomSliderCommit = useCallback((event: SyntheticEvent<HTMLInputElement>) => {
    mapZoomSliderActiveRef.current = false;
    const nextIndex = Number(event.currentTarget.value);
    setMapZoomSliderIndex(nextIndex);
    requestMapZoom(MAP_ZOOM_LEVELS[nextIndex] ?? MAP_ZOOM_LEVELS[0], true);
  }, [requestMapZoom]);
  const handleMapZoomSliderStart = useCallback(() => {
    mapZoomSliderActiveRef.current = true;
  }, []);
  const renderMapZoomControl = useCallback((variant: 'mobile' | 'pc') => (
    <div className={`mm-map2-zoom-control mm-map2-zoom-control-${variant}`} aria-label={mapZoomLabels.control}>
      <button type="button" onClick={handleMapZoomIn} aria-label={mapZoomLabels.zoomIn}>+</button>
      <input
        type="range"
        min={0}
        max={MAP_ZOOM_LEVELS.length - 1}
        step={1}
        value={mapZoomSliderIndex}
        onMouseDown={handleMapZoomSliderStart}
        onTouchStart={handleMapZoomSliderStart}
        onChange={handleMapZoomSliderChange}
        onMouseUp={handleMapZoomSliderCommit}
        onTouchEnd={handleMapZoomSliderCommit}
        onKeyUp={handleMapZoomSliderCommit}
        onBlur={handleMapZoomSliderCommit}
        aria-label={mapZoomLabels.control}
      />
      <button type="button" onClick={handleMapZoomOut} aria-label={mapZoomLabels.zoomOut}>−</button>
    </div>
  ), [handleMapZoomIn, handleMapZoomOut, handleMapZoomSliderChange, handleMapZoomSliderCommit, handleMapZoomSliderStart, mapZoomSliderIndex, mapZoomLabels]);

  const fetchCurrentWeather = useCallback(async () => {
    const fetchByLocation = async (location: MapLocation) => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&current=temperature_2m,weather_code&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('weather fetch failed');
      const json = await res.json();
      let cityName = '';
      try {
        cityName = (await fetchLocationLabel(location, locale)).display;
      } catch {}
      setCurrentWeather({
        temp: Number(json.current.temperature_2m),
        code: Number(json.current.weather_code),
        cityName,
      });
    };
    if (locationSource === 'manual' && manualLocation) {
      setWeatherLoading(true);
      try {
        await fetchByLocation(manualLocation);
      } catch {
        // Keep the chip usable even if the real-time feed fails.
      } finally {
        setWeatherLoading(false);
      }
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setWeatherLoading(true);
    try {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            await fetchByLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          } catch {
            // Keep the chip usable even if the real-time feed fails.
          } finally {
            setWeatherLoading(false);
          }
        },
        () => setWeatherLoading(false),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 180_000 }
      );
    } catch {
      setWeatherLoading(false);
    }
  }, [locationSource, manualLocation, locale]);

  const openNearbyPopup = useCallback((triggerRef?: RefObject<HTMLButtonElement | null>) => {
    if (triggerRef) setNearbyPopupTriggerRef(triggerRef);
    closeAllPopups('nearby');
    setNearbyClosing(false);
    nearbyOpenRef.current = true;
    setNearbyOpen(true);
  }, [closeAllPopups]);

  const openWeatherPopup = useCallback((triggerRef?: RefObject<HTMLButtonElement | null>) => {
    if (triggerRef) setWeatherPopupTriggerRef(triggerRef);
    closeAllPopups('weather');
    fetchCurrentWeather();
    setWeatherClosing(false);
    weatherOpenRef.current = true;
    setWeatherOpen(true);
  }, [closeAllPopups, fetchCurrentWeather]);

  useEffect(() => {
    if (isLgViewport) return;
    fetchCurrentWeather();
  }, [fetchCurrentWeather, isLgViewport]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const shouldLockSearchScroll = !isLgViewport && !isPanelOpen && (searchFocused || searchQuery.trim().length > 0);
    if (!shouldLockSearchScroll) return;

    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
    };

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';

    return () => {
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.left = previous.bodyLeft;
      body.style.right = previous.bodyRight;
      body.style.width = previous.bodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [isLgViewport, isPanelOpen, searchFocused, searchQuery]);

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
      const labels = TRIP_REORDER_LABELS[locale] || TRIP_REORDER_LABELS.en;
      showConfirm(labels.message, async () => {
        setTripStopsLocal(reordered);
        setActiveTrip((prev: any) => prev ? { ...prev, stops: reordered } : prev);
        if (typeof window !== 'undefined') {
          const parsed = getActiveTripForAccount();
          if (parsed) setActiveTripForAccount({ ...parsed, stops: reordered });
        }
        if (activeTrip?.planId) {
          try {
            const res = await fetch(`/api/plans/${activeTrip.planId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stops: reordered.map((s: any) => ({ id: s.id, museumId: s.museumId, order: s.order })) }),
            });
            if (!res.ok) throw new Error('Failed to save trip order');
            showAlert(labels.saved);
          } catch {
            showAlert(labels.failed);
          }
        }
      }, labels.title);
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
      <div className="mm-active-trip-view2" style={{ animation: tripExiting ? 'slideToRight 0.35s cubic-bezier(0.32, 0.72, 0, 1) forwards' : 'slideFromRight 0.4s cubic-bezier(0.32, 0.72, 0, 1)' }}>
        {/* Desktop: side-by-side */}
        <div className="hidden sm:flex sm:flex-row h-[calc(100vh-3.5rem)]">
          <div className="mm-active-trip-panel2 flex flex-col w-96 shrink-0">
            <div className="p-6 pb-0 flex flex-col shrink-0">
              <button onClick={() => { setTripExiting(true); setTimeout(() => { setTripExiting(false); setIsViewingActiveRoute(false); setReturnFromDetail(true); setTimeout(() => setReturnFromDetail(false), 500); }, 300); }} className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded-full mb-4 transition-colors shadow-sm active:scale-95 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              {isPendingTrip ? (
                /* 대기(Pending) 상태: blue 톤 + D-day + 캘린더 */
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <p className="text-xs font-bold tracking-widest text-blue-600 dark:text-blue-400 uppercase">{locale === 'ko' ? '여행 준비 중' : 'UPCOMING TRIP'}</p>
                    {dDayText && <span className="ml-auto text-lg font-black text-blue-500 dark:text-blue-400 animate-pulse">{dDayText}</span>}
                  </div>
                  <h1 className="text-4xl font-extrabold dark:text-white mb-2">{activeTrip.title}</h1>
                  {tripDateRange && <p className="text-sm text-blue-600/70 dark:text-blue-400/70 font-medium mb-4">📅 {tripDateRange}</p>}
                </>
              ) : (
                /* 진행 중(Active) 상태: 블루 + 실시간 느낌 */
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-blue-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                    </div>
                    <p className="text-xs font-bold tracking-widest text-blue-600 dark:text-blue-400 uppercase">{t('plans.viewActiveRoute', locale)}</p>
                    <span className="ml-auto flex items-center gap-1 text-xs text-green-500"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>{locale === 'ko' ? '여행 중' : 'LIVE'}</span>
                  </div>
                  <h1 className="text-4xl font-extrabold dark:text-white mb-2">{activeTrip.title}</h1>
                  {tripDateRange && <p className="text-sm text-gray-400 dark:text-gray-500 font-medium mb-4">📅 {tripDateRange}</p>}
                </>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-4">
              <div className="space-y-3 relative">
                <div className="absolute left-[27px] top-2 bottom-2 w-0.5 z-0 bg-blue-100 dark:bg-blue-900/30"></div>
                {tripStops.map((stop: any, i: number) => {
                  const isBeingDragged = tripDragIndex === i;
                  const isDropTarget = tripOverIndex === i && tripDragIndex !== i;
                  return (
                    <div key={stop.museumId + '-' + i}
                      data-drag-index={i}
                      data-drag-scope="active-trip-stops"
                      className={`mm-active-trip-stop2 relative z-10 flex gap-4 p-3 rounded-xl border transition-all select-none cursor-pointer touch-none
                        ${isBeingDragged ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 shadow-lg scale-[1.02] opacity-80'
                          : isDropTarget ? 'bg-green-50 dark:bg-green-900/20 border-green-300 border-dashed'
                            : 'border shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800'}`} style={!isBeingDragged && !isDropTarget ? { background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' } : undefined}
                      onPointerDown={(e) => tripDrag.onPointerDown(i, e)}
                      onPointerMove={tripDrag.onPointerMove}
                      onPointerCancel={tripDrag.cancelPress}
                      onPointerLeave={tripDrag.cancelPress}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isBeingDragged ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-500 text-white shadow-sm'}`}>{i + 1}</div>
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
            <div className="mm-active-trip-footer2 p-4 border-t space-y-2 shrink-0">
              {isPendingTrip && dDayText && (
                <div className="text-center py-2 mb-1">
                  <span className="text-4xl font-black text-blue-500 dark:text-blue-400">{dDayText}</span>
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
          <div className={`mm-active-trip-drawer2 absolute left-0 right-0 top-0 z-30 rounded-b-3xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] flex flex-col transition-[max-height] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden ${tripSheetOpen ? 'max-h-[55vh]' : 'max-h-[56px]'}`}>
            {/* Scrollable stop list */}
            <div className={`px-4 pt-3 overflow-y-auto flex-1 min-h-0 transition-opacity duration-300 ${tripSheetOpen ? 'opacity-100' : 'opacity-0 h-0'}`}>
              <div className="space-y-2.5 relative">
                <div className="absolute left-[23px] top-2 bottom-2 w-0.5 bg-blue-100 dark:bg-blue-900/30 z-0"></div>
                {tripStops.map((stop: any, i: number) => {
                  const isBeingDragged = tripDragIndex === i;
                  const isDropTarget = tripOverIndex === i && tripDragIndex !== i;
                  return (
                    <div key={stop.museumId + '-' + i}
                      data-drag-index={i}
                      data-drag-scope="active-trip-stops"
                      className={`mm-active-trip-stop2 relative z-10 flex gap-3 p-2.5 rounded-xl border transition-all select-none cursor-pointer touch-none
                        ${isBeingDragged ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 shadow-lg scale-[1.02] opacity-80'
                          : isDropTarget ? 'bg-green-50 dark:bg-green-900/20 border-green-300 border-dashed'
                            : 'border shadow-sm'}`} style={!isBeingDragged && !isDropTarget ? { background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' } : undefined}
                      onPointerDown={(e) => tripDrag.onPointerDown(i, e)}
                      onPointerMove={tripDrag.onPointerMove}
                      onPointerCancel={tripDrag.cancelPress}
                      onPointerLeave={tripDrag.cancelPress}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${isBeingDragged ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'}`}>{i + 1}</div>
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
              <span className="text-xs font-bold mb-1.5 text-blue-600 dark:text-blue-400">
                {isPendingTrip && dDayText ? `${dDayText} • ` : ''}{activeTrip.title} • {tripStops.length} {t('plans.stops', locale)}{tripDateRange ? ` • 📅 ${tripDateRange}` : ''}
              </span>
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-neutral-600" />
            </button>
          </div>
          {/* Floating back button — via portal to stay fixed */}
          {typeof document !== 'undefined' && createPortal(
            <div className="md:hidden fixed bottom-8 right-8 z-[9998] flex flex-col gap-2">
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
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
        <div className="mm-consent-modal2 glass-popup gradient-border rounded-3xl p-6 sm:p-8 w-full max-w-md" style={{ boxShadow: 'var(--glass-shadow-lg)' }}>
          <h2 className="text-lg font-black dark:text-white mb-1">{cl.title}</h2>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mb-5">{session?.user?.email}</p>

          {/* Agree All */}
          <button onClick={() => { setConsentTerms(true); setConsentPrivacy(true); }} className="mm-consent-modal2-all mb-4 w-full py-3 rounded-2xl border border-blue-300/50 dark:border-blue-700/50 text-blue-600 dark:text-blue-400 text-sm font-bold hover:bg-blue-50/50 dark:hover:bg-blue-900/20 active:scale-[0.98] transition-all" style={{ background: 'var(--gradient-blue-orange-soft)' }}>
            {cl.agreeAll}
          </button>

          {/* Terms */}
          <div onClick={() => setConsentTerms(v => !v)} className={`mm-consent-modal2-item rounded-2xl border p-4 cursor-pointer transition-all mb-3 active:scale-[0.98] ${consentTerms ? 'is-active border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10' : 'border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${consentTerms ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-neutral-600'}`}>
                {consentTerms && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold dark:text-white">{cl.termsName} <span className="text-blue-500 text-xs">{cl.required}</span></p>
                <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{cl.termsSummary}</p>
              </div>
            </div>
          </div>

          {/* Privacy */}
          <div onClick={() => setConsentPrivacy(v => !v)} className={`mm-consent-modal2-item rounded-2xl border p-4 cursor-pointer transition-all mb-5 active:scale-[0.98] ${consentPrivacy ? 'is-active border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10' : 'border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${consentPrivacy ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-neutral-600'}`}>
                {consentPrivacy && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold dark:text-white">{cl.privacyName} <span className="text-blue-500 text-xs">{cl.required}</span></p>
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
          <button onClick={() => { clearClientAccountStateForLogout(); try { sessionStorage.setItem('mm-logout-done', '1'); } catch { } import('next-auth/react').then(m => m.signOut({ callbackUrl: '/login' })); }} className="mt-3 w-full py-2.5 text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            {cl.cancel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mm-map-shell relative w-full flex overflow-hidden"
      style={{
        position: 'relative',
        display: 'flex',
        width: '100%',
        maxWidth: '100vw',
        height: 'var(--mm-viewport-height, 100dvh)',
        minHeight: 'var(--mm-viewport-height, 100dvh)',
        overflow: 'hidden',
        background: '#eef6ff',
      }}
    >
      {/* PC Click-outside Overlay */}
      {selectedMuseum && isLgViewport && (
        <div
          className="hidden md:block absolute inset-0 z-30 cursor-pointer"
          onClick={() => closeMuseumPanel()}
          aria-label="Close detail panel"
        />
      )}

      {selectedMuseum && isLgViewport && (
        <button
          type="button"
          className="mm-floating-back-button mm-floating-back-button--pc-only"
          onClick={() => closeMuseumPanel()}
          aria-label={locale === 'ko' ? '뒤로가기' : 'Back'}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Mobile Map Discovery 2.0 */}
      {!isViewingActiveRoute && (
        <>
          <div className={`mm-map2-top md:hidden ${isPanelOpen ? 'hidden' : ''} ${returnFromDetail ? 'is-restoring' : ''}`} style={{ ...mm2.top, ...(isPanelOpen ? { display: 'none' } : null) }}>
            <div className="mm-map2-search-row" style={mm2.searchRow}>
              <div className={`mm-map2-search ${searchFocused ? 'is-focused' : ''}`} style={{ ...mm2.search, ...(searchFocused ? { borderColor: 'rgba(37,99,235,.34)', boxShadow: '0 16px 36px rgba(37,99,235,.16), inset 0 1px 0 rgba(255,255,255,.9)' } : null) }}>
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  style={mm2.searchInput}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => { setSearchFocused(true); closeCategoryDropdown(); closeNewMuseums(); setMapSideMenuOpen(false); }}
                  onBlur={() => setSearchFocused(false)}
                  placeholder={t('map.search', locale)}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
              <button
                type="button"
                className="mm-map2-icon-pill"
                style={mm2.iconPill}
                onClick={() => {
                  closeAllPopups();
                  try {
                    sessionStorage.setItem('mm_settings_return_to', '/');
                  } catch {}
                  window.location.assign('/settings');
                }}
                aria-label={locale === 'ko' ? '설정' : 'Settings'}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>

            {newMuseums.length > 0 && (
              <div className={`mm-map2-new-museums-mobile ${activeTrip ? 'has-trip' : ''}`}>
                <button
                  type="button"
                  className={`mm-map2-new-museums-chip ${newMuseumsOpen ? 'is-active' : ''}`}
                  onClick={() => {
                    if (newMuseumsOpen) closeNewMuseums();
                    else {
                      closeAllPopups('newMuseums');
                      setNewMuseumsOpen(true);
                    }
                  }}
                  aria-label={mobileToolLabels.newMuseums}
                  aria-expanded={newMuseumsOpen}
                >
                  <span className="mm-map2-new-museums-icon">
                    <MuseumNewIcon />
                    <span>N</span>
                  </span>
                </button>
                {(newMuseumsOpen || newMuseumsClosing) && (
                  <div className={`mm-map2-new-museums-popover mm-map-popover-motion ${newMuseumsClosing ? 'is-closing' : ''}`} role="dialog" aria-label={mobileToolLabels.newMuseums}>
                    <div className="mm-map2-new-museums-head">
                      <h3><MuseumNewIcon className="w-4 h-4" />{mobileToolLabels.newMuseums}</h3>
                      <button type="button" onClick={closeNewMuseums} aria-label={mobileToolLabels.close}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="mm-map2-new-museums-list">
                      {newMuseums.map((m: any) => (
                        <NewMuseumListItem
                          key={m.id}
                          museum={m}
                          locale={locale}
                          onSelect={(museum) => {
                            setNewMuseumsOpen(false);
                            openMuseumPanel(museum);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {searchQuery.trim().length > 0 && searchResults.length > 0 && (
              <div className="mm-map2-floating-list" style={mm2.floatingList}>
                {searchResults.map(result => (
                  <SearchResultButton
                    key={`museum-${result.museum.id}`}
                    result={result}
                    locale={locale}
                    onMuseumSelect={(m) => {
                      setSearchQuery('');
                      openMuseumPanel(m);
                    }}
                  />
                ))}
              </div>
            )}

            {activeTrip && (
              <div className="mm-map2-trip-anchor">
                <button
                  type="button"
                  onClick={() => setIsViewingActiveRoute(true)}
                  className={`mm-map2-tool-pill mm-map2-trip-pill ${activeTrip.pending ? 'is-pending' : 'is-on-trip'}`}
                  style={mm2.toolPill}
                  aria-label={locale === 'ko' ? '여행 경로 보기' : 'View trip route'}
                >
                  {activeTrip.pending ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6A3.75 3.75 0 0 1 12 2.25 3.75 3.75 0 0 1 15.75 6v1.5M5.25 7.5h13.5A2.25 2.25 0 0 1 21 9.75v8.25A2.25 2.25 0 0 1 18.75 20.25H5.25A2.25 2.25 0 0 1 3 18V9.75A2.25 2.25 0 0 1 5.25 7.5Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 12h.008M15.75 12h.008" />
                    </svg>
                  )}
                  <span>{activeTrip.pending ? (locale === 'ko' ? '여행 준비 중' : 'Trip pending') : (locale === 'ko' ? '여행 중' : 'On trip')}</span>
                </button>
              </div>
            )}

            <div className="mm-map2-pill-row" style={mm2.pillRow}>
              <div className="mm-map2-tool-stack">
                {mapPrefs.weather && (
                  <button
                    ref={weatherBtnRefMobile}
	                    type="button"
	                    onClick={() => {
	                      if (weatherOpen) closeWeatherPopup();
	                      else openWeatherPopup(weatherBtnRefMobile);
	                    }}
                    className={`mm-map2-tool-pill mm-map2-tool-pill-icon mm-map2-weather-icon ${weatherOpen ? 'is-active' : ''}`}
                    style={{ ...mm2.toolPill, ...(weatherOpen ? mm2.activePill : null) }}
                    aria-label={mobileToolLabels.weather}
                    aria-expanded={weatherOpen}
                  >
                    <strong>{weatherLoading && !currentWeather ? '...' : currentWeather ? `${Math.round(currentWeather.temp)}°` : '--°'}</strong>
                  </button>
                )}

                <button
                  type="button"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (categoryDropdownOpen) closeCategoryDropdown();
                    else openCategoryDropdown();
                  }}
	                  className={`mm-map2-tool-pill mm-map2-tool-pill-icon ${categoryDropdownOpen || activeFilter !== 'All' ? 'is-active' : ''}`}
	                  style={{ ...mm2.toolPill, ...((categoryDropdownOpen || activeFilter !== 'All') ? mm2.activePill : null) }}
                  aria-label={mobileToolLabels.category}
                  aria-expanded={categoryDropdownOpen}
                >
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.55}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
                  </svg>
                </button>

                {mapPrefs.nearby && (
                  <button
                    ref={nearbyBtnRefMobile}
                    type="button"
	                    onClick={() => { if (nearbyOpen) closeNearbyPopup(); else openNearbyPopup(nearbyBtnRefMobile); }}
                    className={`mm-map2-tool-pill mm-map2-tool-pill-icon ${nearbyOpen ? 'is-active' : ''}`}
                    style={{ ...mm2.toolPill, ...(nearbyOpen ? mm2.activePill : null) }}
                    aria-label={mobileToolLabels.nearby}
                    aria-expanded={nearbyOpen}
                  >
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657 13.414 20.9a2 2 0 0 1-2.828 0l-4.243-4.243a8 8 0 1 1 11.314 0Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  </button>
                )}

                {mapPrefs.location && (
                  <>
                    <button
                      type="button"
                      onClick={locationSource === 'manual' ? startManualLocationPick : handleCurrentLocationPress}
                      className={`mm-map2-tool-pill mm-map2-tool-pill-icon ${locationPickMode ? 'is-active' : ''}`}
                      style={{ ...mm2.toolPill, ...(locationPickMode ? mm2.activePill : null) }}
                      aria-label={locationSource === 'manual' ? mapLocationLabels.pickButton : mobileToolLabels.currentLocation}
                    >
                      {locationSource === 'manual' ? (
                        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s6-5.1 6-10a6 6 0 1 0-12 0c0 4.9 6 10 6 10Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 11h4.5M12 8.75v4.5" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2m10-10h-2M4 12H2" />
                        </svg>
                      )}
                    </button>
                    {renderMapZoomControl('mobile')}
                  </>
                )}
              </div>
            </div>
          </div>

          {mapSideMenuOpen && !isPanelOpen && (
            <div className="mm-map2-side-layer md:hidden">
              <button
                type="button"
                className="mm-map2-side-backdrop"
                aria-label={locale === 'ko' ? '지도 메뉴 닫기' : 'Close map menu'}
                onClick={() => setMapSideMenuOpen(false)}
              />
              <aside className="mm-map2-side-menu" role="dialog" aria-label={locale === 'ko' ? '지도 메뉴' : 'Map menu'}>
                <div className="mm-map2-side-head">
                  <div>
                    <span>{locale === 'ko' ? 'Museum Map' : 'Museum Map'}</span>
                    <strong>{locale === 'ko' ? '지도 메뉴' : 'Map menu'}</strong>
                  </div>
                  <button type="button" onClick={() => setMapSideMenuOpen(false)} aria-label={locale === 'ko' ? '닫기' : 'Close'}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="mm-map2-side-actions">
                  {session && !session.user?.name?.startsWith('guest_') && (
                    <button
                      type="button"
                      onClick={() => {
                        setMapSideMenuOpen(false);
                        window.location.assign('/login');
                      }}
                    >
                      <span className="h-6 w-6 overflow-hidden rounded-full bg-blue-100 text-xs font-semibold text-blue-700 flex items-center justify-center">
                        {session.user?.image ? <img src={session.user.image} alt="" className="h-full w-full object-cover" /> : (session.user?.name?.charAt(0).toUpperCase() || 'U')}
                      </span>
                      <span className="truncate">{session.user?.name || (locale === 'ko' ? '프로필' : 'Profile')}</span>
                    </button>
                  )}
                  {(session?.user as any)?.role === 'ADMIN' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMapSideMenuOpen(false);
                        window.location.assign('/admin');
                      }}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-semibold text-white">A</span>
                      Admin
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMapSideMenuOpen(false);
                      try {
                        sessionStorage.setItem('mm_settings_return_to', '/');
                      } catch {}
                      window.location.assign('/settings');
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {locale === 'ko' ? '설정' : 'Settings'}
                  </button>
                </div>
                <div className="mm-map2-side-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setMapSideMenuOpen(false);
                      closeAllPopups('chip');
                      setChipOpen(true);
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    {locale === 'ko' ? '장소 목록' : 'Place list'}
                  </button>
                  <button
                    type="button"
	                    onClick={() => {
	                      setMapSideMenuOpen(false);
	                      openWeatherPopup();
	                    }}
                  >
                    <span><WeatherChipSvg code={currentWeather?.code} /></span>
                    {currentWeather ? `${Math.round(currentWeather.temp)}°` : mobileToolLabels.weather}
                  </button>
                </div>
                <div className="mm-map2-side-section">
                  <span>{mobileToolLabels.categories}</span>
                  <div className="mm-map2-side-grid">
                    {MOBILE_FILTERS.map(f => (
                      <button
                        key={f}
                        type="button"
                        className={activeFilter === f ? 'is-active' : ''}
                        onClick={() => {
	                          setCategoryFilter(f);
                          setChipOpen(false);
                          setMapSideMenuOpen(false);
                          setAiOpen(false);
                          setAiResults([]);
                          gtag.event('filter_museums', { category: 'filter', label: f, value: 1 });
                        }}
                      >
                        <img className="mm-map2-category-icon" src={getMuseumCategoryIconSrc(f)} alt="" aria-hidden="true" />
                        {translateCategory(f, locale)}
                      </button>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          )}

          {(categoryDropdownOpen || categoryDropdownClosing) && !isPanelOpen && (
            <div
              className={`mm-map2-category-menu mm-map-popover-motion md:hidden ${categoryDropdownClosing ? 'is-closing' : ''}`}
              style={mm2.categoryMenu}
              role="dialog"
              aria-label={mobileToolLabels.categories}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mm-map2-category-menu-head">
                <h3>
                  <span className="mm-map2-category-menu-head-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" rx="1.5" />
                      <rect x="14" y="3" width="7" height="7" rx="1.5" />
                      <rect x="3" y="14" width="7" height="7" rx="1.5" />
                      <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    </svg>
                  </span>
                  {mobileToolLabels.categories}
                </h3>
                <button type="button" className="mm-map2-category-menu-close" onClick={closeCategoryDropdown} aria-label={mobileToolLabels.close}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mm-map2-category-menu-grid">
                {MOBILE_FILTERS.map(f => (
                  <button
                    key={f}
                    type="button"
                    className={activeFilter === f ? 'is-active' : ''}
                    style={{ ...mm2.categoryButton, ...(activeFilter === f ? mm2.categoryButtonActive : null) }}
                    onClick={() => {
	                      setCategoryFilter(f);
                      setChipOpen(false);
                      closeCategoryDropdown();
                      setAiOpen(false);
                      setAiResults([]);
                      gtag.event('filter_museums', { category: 'filter', label: f, value: 1 });
                    }}
                  >
                    <img className="mm-map2-category-icon" src={getMuseumCategoryIconSrc(f)} alt="" aria-hidden="true" />
                    {translateCategory(f, locale)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Map */}
      <div className="mm-map-canvas-wrap relative flex-1 min-h-0" style={{ position: 'relative', flex: '1 1 auto', minWidth: 0, minHeight: 0, height: '100%', overflow: 'hidden' }}>
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
            zoomCommand={mapZoomCommand}
            onZoomChange={(zoom) => {
              if (!mapZoomSliderActiveRef.current && !mapZoomCommandActiveRef.current) setMapZoom(clampMapZoom(zoom));
            }}
            highlightMuseumId={highlightedMuseumId}
            userLocation={effectiveLocation}
            savedIds={savedMuseumIds}
            compareIds={compareIdsSet}
            selectionMode={locationPickMode}
            onMapPointSelect={locationPickMode ? handleManualLocationSelect : undefined}
          />
        )}

        {locationPickMode && !isPanelOpen && (
          <div className="mm-map-location-pick-banner" role="status">
            <span>{mapLocationLabels.pickPrompt}</span>
            <button type="button" onClick={cancelLocationPickMode}>{mapLocationLabels.pickCancel}</button>
          </div>
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

        {!isViewingActiveRoute && !isPanelOpen && !isLgViewport && (
          <div className="md:hidden" style={{ display: 'block' }}>
            {false && chipOpen && (
            <div className="mm-map2-place-sheet is-expanded" style={{ ...mm2.placeSheet, ...mm2.placeSheetExpanded }}>
              <button
                type="button"
                className="mm-map2-sheet-handle"
                style={mm2.sheetHandle}
                onClick={() => setChipOpen(false)}
                aria-expanded={chipOpen}
                aria-label={locale === 'ko' ? '장소 목록 닫기' : 'Close place list'}
              >
                <span style={mm2.sheetHandleBar} />
              </button>

                <div className="mm-map2-list-panel" style={mm2.listPanel}>
                  <div className="mm-map2-list-header" style={mm2.listHeader}>
                    <div>
                      <strong style={mm2.listTitle}>{filteredMuseums.length.toLocaleString()}{locale === 'ko' ? '곳의 미술관 및 박물관' : ' museums and galleries'}</strong>
                      <span style={mm2.listSubtitle}>{activeFilter === 'All' ? (locale === 'ko' ? '전체 보기' : 'All places') : translateCategory(activeFilter, locale)}</span>
                    </div>
                    <button type="button" onClick={() => setChipOpen(false)} aria-label="Close list" style={mm2.closeBtn}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="mm-map2-scroll-list" style={mm2.scrollList}>
                    {mobileListMuseums.map((m: any) => {
                      const imageSrc = getMuseumImageSrc(m);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className="mm-map2-list-item"
                          style={mm2.listItem}
                          onClick={() => {
                            setChipOpen(false);
                            openMuseumPanel(m);
                          }}
                        >
                          <span className="mm-map2-list-image" style={mm2.listImage}>
                            {imageSrc ? <img src={imageSrc} alt="" style={mm2.fullImage} /> : <img src="/logo.svg" alt="" className="object-contain p-5 opacity-20" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <strong style={mm2.listItemTitle}>{getLocalizedMuseumName(m, locale)}</strong>
                            <small style={mm2.listItemMeta}>
                              {m.googleRating ? `★ ${m.googleRating} · ` : ''}
                              {getLocalizedCityName(m, locale) || m.city || translateCategory(m.type || '', locale)}
                            </small>
                          </span>
                          <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                </div>
            </div>
            )}
          </div>
        )}

        {/* Filters overlay — PC only (hidden on mobile, shown in header instead) */}
        {!isViewingActiveRoute && (
          <div className={`mm-map2-pc-overlay ${isPanelOpen ? 'is-panel-open' : 'is-panel-closed'} hidden md:flex absolute top-4 left-4 z-20 flex-col gap-2 sm:gap-3 pointer-events-none transition-all duration-500 ${isPanelOpen ? 'md:right-[700px]' : 'right-4'}`}>
            {/* Search Bar */}
            <div className="mm-map2-pc-search-wrap pointer-events-auto">
              <div className="relative">
                <div className={`mm-map2-pc-search relative rounded-2xl shadow-lg border-2 transition-colors duration-300 ${searchFocused ? 'border-blue-500' : 'border-gray-300 dark:border-neutral-600'}`}>
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
                      className="mm-map2-pc-search-input w-full pl-8 pr-4 py-3 backdrop-blur-xl rounded-[14px] text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 outline-none transition-all"
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
                        key={`museum-${result.museum.id}`}
                        result={result}
                        locale={locale}
                        onMuseumSelect={(m) => {
                          setSearchQuery('');
                          openMuseumPanel(m);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {activeTrip && !isPanelOpen && (
              <div className="mm-map2-pc-trip-anchor pointer-events-auto">
                {newMuseums.length > 0 && (
                  <div className="mm-map2-pc-trip-new-museums relative">
                    <button
                      type="button"
                      onClick={() => { if (newMuseumsOpen) { closeNewMuseums(); } else { closeAllPopups('newMuseums'); setNewMuseumsOpen(true); } }}
                      className={`mm-map2-pc-control mm-map2-new-museums-pc-action flex items-center justify-center bg-white/92 dark:bg-neutral-900/92 backdrop-blur-xl rounded-2xl shadow-lg border transition-all active:scale-95 ${newMuseumsOpen
                        ? 'border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/30'
                        : 'border-gray-100/50 dark:border-neutral-800/50 hover:border-blue-200 dark:hover:border-blue-800'
                        }`}
                      aria-label={mobileToolLabels.newMuseums}
                      aria-expanded={newMuseumsOpen}
                      title={mobileToolLabels.newMuseums}
                    >
                      <span className="mm-map2-new-museums-icon" aria-hidden="true">
                        <MuseumNewIcon className="w-4 h-4" />
                        <span>N</span>
                      </span>
                    </button>

                    {(newMuseumsOpen || newMuseumsClosing) && (
                      <div className={`mm-map2-new-museums-popover mm-map2-new-museums-popover-pc mm-map-popover-motion ${newMuseumsClosing ? 'is-closing' : ''}`}>
                        {newMuseums.map((m: any) => (
                          <NewMuseumListItem
                            key={m.id}
                            museum={m}
                            locale={locale}
                            onSelect={(museum) => {
                              setNewMuseumsOpen(false);
                              openMuseumPanel(museum);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsViewingActiveRoute(true)}
                  className={`mm-map2-tool-pill mm-map2-trip-pill ${activeTrip.pending ? 'is-pending' : 'is-on-trip'}`}
                  style={mm2.toolPill}
                  aria-label={locale === 'ko' ? '여행 경로 보기' : 'View trip route'}
                >
                  {activeTrip.pending ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6A3.75 3.75 0 0 1 12 2.25 3.75 3.75 0 0 1 15.75 6v1.5M5.25 7.5h13.5A2.25 2.25 0 0 1 21 9.75v8.25A2.25 2.25 0 0 1 18.75 20.25H5.25A2.25 2.25 0 0 1 3 18V9.75A2.25 2.25 0 0 1 5.25 7.5Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 12h.008M15.75 12h.008" />
                    </svg>
                  )}
                  <span>{activeTrip.pending ? (locale === 'ko' ? '여행 준비 중' : 'Trip pending') : (locale === 'ko' ? '여행 중' : 'On trip')}</span>
                </button>
              </div>
            )}

            {/* New Museums + Category Dropdown row */}
            <div className="mm-map2-pc-tools flex items-center gap-2 pointer-events-auto w-full">
              {/* New Museums Button */}
              {newMuseums.length > 0 && (!activeTrip || isPanelOpen) && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { if (newMuseumsOpen) { closeNewMuseums(); } else { closeAllPopups('newMuseums'); setNewMuseumsOpen(true); } }}
                    className={`mm-map2-pc-control mm-map2-new-museums-pc-action flex items-center justify-center bg-white/92 dark:bg-neutral-900/92 backdrop-blur-xl rounded-2xl shadow-lg border transition-all active:scale-95 ${newMuseumsOpen
                      ? 'border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/30'
                      : 'border-gray-100/50 dark:border-neutral-800/50 hover:border-blue-200 dark:hover:border-blue-800'
                      }`}
                    aria-label={mobileToolLabels.newMuseums}
                    aria-expanded={newMuseumsOpen}
                    title={mobileToolLabels.newMuseums}
                  >
                    <span className="mm-map2-new-museums-icon" aria-hidden="true">
                      <MuseumNewIcon className="w-4 h-4" />
                      <span>N</span>
                    </span>
                  </button>

                  {/* Expandable List */}
                  {(newMuseumsOpen || newMuseumsClosing) && (
                    <div className={`mm-map2-new-museums-popover mm-map2-new-museums-popover-pc mm-map-popover-motion ${newMuseumsClosing ? 'is-closing' : ''}`}>
                      {newMuseums.map((m: any) => (
                        <NewMuseumListItem
                          key={m.id}
                          museum={m}
                          locale={locale}
                          onSelect={(museum) => {
                            setNewMuseumsOpen(false);
                            openMuseumPanel(museum);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Category Dropdown */}
              <div className="mm-map2-pc-category-anchor relative ml-auto">
                <button
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (categoryDropdownOpen) closeCategoryDropdown();
                    else openCategoryDropdown();
                  }}
                  className={`mm-map2-pc-control mm-map2-pc-control-wide flex items-center gap-2 px-4 py-2.5 bg-white/92 dark:bg-neutral-900/92 backdrop-blur-xl rounded-2xl shadow-lg border transition-all active:scale-95 ${categoryDropdownOpen && !categoryDropdownClosing
                    ? 'border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/30'
                    : 'border-gray-100/50 dark:border-neutral-800/50 hover:border-blue-200 dark:hover:border-blue-800'
                    }`}
                  aria-expanded={categoryDropdownOpen && !categoryDropdownClosing}
                >
                  <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                  </svg>
                  <span className="text-sm font-bold text-gray-800 dark:text-white">
                    {activeFilter === 'All' ? (({ ko: '카테고리', en: 'Category', ja: 'カテゴリ', de: 'Kategorie', fr: 'Catégorie', es: 'Categoría', pt: 'Categoria', 'zh-CN': '分类', 'zh-TW': '分類' } as Record<string, string>)[locale] || 'Category') : translateCategory(activeFilter, locale)}
                  </span>
                  <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-300 ${categoryDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {(categoryDropdownOpen || categoryDropdownClosing) && (
                  <div
                    className={`mm-map2-category-menu mm-map2-category-menu-pc mm-map-popover-motion ${categoryDropdownClosing ? 'is-closing' : ''}`}
                    role="dialog"
                    aria-label={mobileToolLabels.categories}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="mm-map2-category-menu-head">
                      <h3>
                        <span className="mm-map2-category-menu-head-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="7" height="7" rx="1.5" />
                            <rect x="14" y="3" width="7" height="7" rx="1.5" />
                            <rect x="3" y="14" width="7" height="7" rx="1.5" />
                            <rect x="14" y="14" width="7" height="7" rx="1.5" />
                          </svg>
                        </span>
                        {mobileToolLabels.categories}
                      </h3>
                      <button type="button" className="mm-map2-category-menu-close" onClick={closeCategoryDropdown} aria-label={mobileToolLabels.close}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="mm-map2-category-menu-grid">
                      {MOBILE_FILTERS.map(f => (
                        <button
                          key={f}
                          type="button"
                          className={activeFilter === f ? 'is-active' : ''}
                          style={{ ...mm2.categoryButton, ...(activeFilter === f ? mm2.categoryButtonActive : null) }}
                          onClick={() => {
                            setCategoryFilter(f);
                            closeCategoryDropdown();
                            setAiOpen(false);
                            setAiResults([]);
                            gtag.event('filter_museums', { category: 'filter', label: f, value: 1 });
                          }}
                        >
                          <img className="mm-map2-category-icon" src={getMuseumCategoryIconSrc(f)} alt="" aria-hidden="true" />
                          {translateCategory(f, locale)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* My Location — Mobile */}
              {mapPrefs.location && (
                <>
                  <button
                    onClick={locationSource === 'manual' ? startManualLocationPick : handleCurrentLocationPress}
                    className={`mm-map2-pc-control mm-map2-pc-location-control w-10 h-10 flex items-center justify-center rounded-2xl shadow-lg border transition-all active:scale-95 shrink-0 ${locationPickMode ? 'is-active bg-blue-600 text-white border-blue-600' : 'bg-white/92 dark:bg-neutral-900/92 backdrop-blur-xl border-gray-100/50 dark:border-neutral-800/50 text-blue-500'}`}
                    aria-label={locationSource === 'manual' ? mapLocationLabels.pickButton : mobileToolLabels.currentLocation}
                  >
                    {locationSource === 'manual' ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s6-5.1 6-10a6 6 0 1 0-12 0c0 4.9 6 10 6 10Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 11h4.5M12 8.75v4.5" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2m10-10h-2M4 12H2" />
                      </svg>
                    )}
                  </button>
                  {renderMapZoomControl('pc')}
                </>
              )}

              {/* Nearby Museums (PC filter overlay) */}
              {mapPrefs.nearby && <div className="mm-map2-pc-nearby-anchor relative shrink-0">
                <button
                  ref={nearbyBtnRefPC}
                  onClick={() => { if (nearbyOpen) closeNearbyPopup(); else openNearbyPopup(nearbyBtnRefPC); }}
                  aria-label={locale === 'ko' ? '내 주변' : 'Nearby museums'}
                  aria-expanded={nearbyOpen}
                  className={`mm-map2-pc-control w-10 h-10 flex items-center justify-center rounded-2xl shadow-lg border transition-all active:scale-95 ${nearbyOpen ? 'is-active bg-blue-600 text-white border-blue-600' : 'bg-white/92 dark:bg-neutral-900/92 backdrop-blur-xl border-gray-100/50 dark:border-neutral-800/50 text-blue-500'}`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>}

              {/* Weather (PC filter overlay) */}
              {mapPrefs.weather && <div className="mm-map2-pc-weather-anchor relative shrink-0">
                <button
                  ref={weatherBtnRefPC}
	                  onClick={() => { if (weatherOpen) closeWeatherPopup(); else openWeatherPopup(weatherBtnRefPC); }}
                  aria-label={locale === 'ko' ? '오늘 날씨' : "Today's weather"}
                  aria-expanded={weatherOpen}
                  className={`mm-map2-pc-control w-10 h-10 flex items-center justify-center rounded-2xl shadow-lg border transition-all active:scale-95 ${weatherOpen ? 'is-active bg-blue-600 text-white border-blue-600' : 'bg-white/92 dark:bg-neutral-900/92 backdrop-blur-xl border-gray-100/50 dark:border-neutral-800/50 text-blue-500'}`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                </button>
              </div>}
            </div>
          </div>
        )}

        {/* Active Route Button + AI results — stacked */}
        {!isViewingActiveRoute && !isPanelOpen && isLgViewport && (
          <>
            {/* Desktop: absolute positioned over map */}
            <div className="hidden md:block absolute bottom-4 left-4 right-4 z-[51] pointer-events-none">
              <div className="pointer-events-auto flex flex-col-reverse gap-2 max-w-3xl">
                {aiOpen && (
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleAiRecommend(); }}
                    className={`flex items-center gap-2 p-2 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200 dark:border-neutral-700 focus-within:border-blue-400 dark:focus-within:border-blue-600 transition-colors ${aiClosing ? 'animate-fadeOutDown' : 'animate-fadeInUp'}`}
                  >
                    <input type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder={translateCategory('ai.placeholder', locale)} className="flex-1 min-w-0 px-4 py-2 bg-gray-50 dark:bg-neutral-800 rounded-xl text-sm text-gray-800 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-700 transition-all" />
                    <button type="submit" disabled={aiLoading} className="w-10 h-10 flex items-center justify-center gradient-btn text-white rounded-xl text-sm font-bold active:scale-95 transition-all disabled:opacity-50 shrink-0">
                      {aiLoading ? '…' : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}
                    </button>
                    <button type="button" onClick={closeAi} className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-neutral-800 rounded-xl text-gray-500 hover:text-gray-800 dark:hover:text-white text-sm font-bold active:scale-95 transition-all shrink-0">✕</button>
                  </form>
                )}
                {activeTrip && !aiOpen && (
                  <div>
                    <button onClick={() => setIsViewingActiveRoute(true)} className={`px-4 py-2.5 rounded-2xl font-bold text-sm shadow-[0_2px_8px_rgba(0,0,0,0.15)] active:scale-95 transition-all flex items-center gap-2 ${activeTrip.pending ? 'bg-blue-200 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'gradient-btn text-white'}`}>
                      <span className={activeTrip.pending ? '' : 'animate-pulse'}>{activeTrip.pending ? (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>) : (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>)}</span>
                      {activeTrip.pending ? (locale === 'ko' ? '여행 준비 중' : 'Trip Pending') : t('plans.viewActiveRoute', locale)}
                      <span className={`px-2 py-0.5 rounded-full text-xs ${activeTrip.pending ? 'bg-blue-300/30 dark:bg-blue-800/30' : 'bg-white/20'}`}>{activeTrip.title}</span>
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
                {aiOpen && aiLoading && (<div className="flex items-center gap-2 px-4 py-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-xl shadow-lg animate-fadeInUp"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /><span className="text-xs text-gray-500 dark:text-gray-400">{translateCategory('ai.loading', locale)}</span></div>)}
                {aiOpen && !aiLoading && aiResults.length === 0 && aiQuery && (<div className="px-4 py-2 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-xl shadow-lg animate-fadeInUp"><span className="text-xs text-gray-400">{translateCategory('ai.hint', locale)}</span></div>)}
              </div>
            </div>
            {/* Desktop: count badge */}
            {!aiOpen && !selectedMuseum && isLgViewport && (
              <div className="hidden md:block absolute bottom-4 right-4 z-[51]">
                {chipOpen && (
                  <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-md rounded-2xl shadow-xl p-3 min-w-[160px] animate-fadeInUp">
                    <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">{locale === 'ko' ? '카테고리별' : 'By Category'}</div>
                    {categoryCounts.map(([name, count]) => (
                      <div key={name} className="flex justify-between items-center py-1">
                        <span className="text-[11px] text-white/80">{name}</span>
                        <span className="text-[11px] font-bold text-white ml-4">{count}</span>
                      </div>
                    ))}
                    <div className="border-t border-white/10 mt-1.5 pt-1.5 flex justify-between items-center"><span className="text-[11px] font-bold text-white/60">{locale === 'ko' ? '전체' : 'Total'}</span><span className="text-sm font-black text-white">{filteredMuseums.length.toLocaleString()}</span></div>
                  </div>
                )}
                <button onClick={() => { closeAllPopups('chip'); setChipOpen(!chipOpen); }} className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all active:scale-95 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-lg border border-gray-200/50 dark:border-neutral-700/50">
                  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{locale === 'ko' ? '미술관 및 박물관' : 'Museums'}</span>
                  <span className="font-bold text-xs text-blue-600 dark:text-blue-400">{filteredMuseums.length.toLocaleString()}</span>
                </button>
              </div>
            )}
            {/* Mobile: portal into nav toolbar */}
            {false && navToolbarReady && typeof document !== 'undefined' && document.getElementById('nav-toolbar') && createPortal(
              <div className={`md:hidden px-3 pb-2 pt-1 ${returnFromDetail ? 'animate-fadeInUp' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {!aiOpen ? (
                      <>
                        {activeTrip && (
                          <button onClick={() => setIsViewingActiveRoute(true)} className={`px-3 py-2 rounded-xl font-bold text-xs active:scale-95 transition-all flex items-center gap-1.5 ${activeTrip.pending ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300' : 'gradient-btn text-white'}`}>
                            <span className={activeTrip.pending ? '' : 'animate-pulse'}><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg></span>
                            {activeTrip.pending ? (locale === 'ko' ? '대기' : 'Pending') : t('plans.viewActiveRoute', locale)}
                          </button>
                        )}
                      </>
                    ) : (
                      <form onSubmit={(e) => { e.preventDefault(); handleAiRecommend(); }} className={`flex items-center gap-2 flex-1 ${aiClosing ? 'animate-fadeOutDown' : 'animate-fadeInUp'}`}>
                        <input type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder={translateCategory('ai.placeholder', locale)} className="flex-1 min-w-0 px-3 py-2 bg-gray-100 dark:bg-neutral-800 rounded-xl text-sm text-gray-800 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-700" />
                        <button type="submit" disabled={aiLoading} className="w-9 h-9 flex items-center justify-center gradient-btn text-white rounded-xl text-sm font-bold active:scale-95 disabled:opacity-50 shrink-0">{aiLoading ? '…' : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}</button>
                        <button type="button" onClick={closeAi} className="w-9 h-9 flex items-center justify-center bg-gray-100 dark:bg-neutral-800 rounded-xl text-gray-500 text-sm font-bold active:scale-95 shrink-0">✕</button>
                      </form>
                    )}
                  </div>
                  {!aiOpen && !selectedMuseum && (
                    <button onClick={() => { closeAllPopups('chip'); setChipOpen(!chipOpen); }} className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all active:scale-95 shrink-0 relative">
                      <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{locale === 'ko' ? '미술관 및 박물관' : 'Museums'}</span>
                      <span className="font-bold text-xs text-blue-600 dark:text-blue-400">{filteredMuseums.length.toLocaleString()}</span>
                      {chipOpen && (
                        <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-md rounded-2xl shadow-xl p-3 min-w-[160px] animate-fadeInUp">
                          <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">{locale === 'ko' ? '카테고리별' : 'By Category'}</div>
                          {categoryCounts.map(([name, count]) => (
                            <div key={name} className="flex justify-between items-center py-1">
                              <span className="text-[11px] text-white/80">{name}</span>
                              <span className="text-[11px] font-bold text-white ml-4">{count}</span>
                            </div>
                          ))}
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
                {aiOpen && aiLoading && (<div className="flex items-center gap-2 px-2 py-2 animate-fadeInUp"><div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /><span className="text-xs text-gray-400">{translateCategory('ai.loading', locale)}</span></div>)}
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
          className={`museum-detail-panel mm-detail-shell fixed left-0 right-0 bottom-0 top-0 lg:absolute lg:right-0 lg:left-auto lg:top-0 lg:h-full w-full lg:w-[700px] max-w-full
            lg:!bg-white/10 lg:dark:!bg-neutral-950/10
            shadow-2xl lg:shadow-none ${skipTransition ? '' : 'transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]'} z-50
            overflow-y-auto hide-scrollbar lg:pt-4 lg:px-8 lg:pb-2
            border-l border-gray-200 dark:border-neutral-800 lg:border-none
            bg-white dark:bg-neutral-950 translate-x-0 pointer-events-auto`}
          style={{
            overscrollBehavior: 'none',
            transform: detailPanelClosing || !detailPanelEntered ? 'translateX(100%)' : 'translateX(0)',
            transition: skipTransition ? 'none' : isLgViewport ? 'transform 420ms cubic-bezier(0.16, 1, 0.3, 1)' : 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)',
            ...(isLgViewport ? {
              backgroundColor: 'transparent',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
            } : {}),
          }}
        >
          <div className="w-full flex flex-col pb-4 lg:pb-1">
            <MuseumDetailCard
              key={selectedMuseum.id}
              museumId={selectedMuseum.id}
              onClose={closeMuseumPanel}
              isMapContext={true}
              onMoveToLocation={moveToSelectedMuseumLocation}
              onSaveChange={() => { void refreshSavedIds({ force: true }); }}
            />
          </div>
        </div>
      )}

      {/* Trip activated notification toast */}
      {showTripActivatedNotif && (
        <div className="mm-trip-start-toast fixed top-6 left-1/2 -translate-x-1/2 z-[9999] animate-fadeInUp">
          <div className="gradient-btn text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-sm">
            <span className="text-lg">🎉</span>
            {locale === 'ko' ? '여행이 시작됐어요!' : 'Your trip has started!'}
          </div>
        </div>
      )}

      {/* Single instance of each popup, tied to whichever trigger is currently visible */}
      <NearbyPopup
        isOpen={nearbyOpen || nearbyClosing}
        closing={nearbyClosing}
        onClose={closeNearbyPopup}
        museums={museums}
        onMuseumClick={handleMuseumClick}
        mode="popover"
        anchor="before"
        triggerRef={activeNearbyRef}
        locationOverride={locationSource === 'manual' ? manualLocation : null}
      />
      <WeatherPopup
        isOpen={weatherOpen || weatherClosing}
        closing={weatherClosing}
        onClose={closeWeatherPopup}
        mode="popover"
        anchor="before"
        triggerRef={activeWeatherRef}
        initialWeather={currentWeather}
        onWeatherLoaded={setCurrentWeather}
        locationOverride={locationSource === 'manual' ? manualLocation : null}
      />
      {locationPickIntroOpen && typeof document !== 'undefined' && createPortal(
        <div className="mm-map-location-confirm-layer" role="dialog" aria-modal="true" aria-label={mapLocationLabels.pickIntroTitle}>
          <button type="button" className="mm-map-location-confirm-backdrop" onClick={dismissLocationPickIntro} aria-label={mapLocationLabels.pickIntroCancel} />
          <div className="mm-map-location-confirm-card">
            <div className="mm-map-location-confirm-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s6-5.1 6-10a6 6 0 1 0-12 0c0 4.9 6 10 6 10Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 11h4.5M12 8.75v4.5" />
              </svg>
            </div>
            <h3>{mapLocationLabels.pickIntroTitle}</h3>
            <p>{mapLocationLabels.pickIntroBody}</p>
            <div>
              <button type="button" onClick={dismissLocationPickIntro}>{mapLocationLabels.pickIntroCancel}</button>
              <button type="button" onClick={confirmLocationPickIntro}>{mapLocationLabels.pickIntroConfirm}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {locationSwitchOpen && typeof document !== 'undefined' && createPortal(
        <div className="mm-map-location-confirm-layer" role="dialog" aria-modal="true" aria-label={mapLocationLabels.switchTitle}>
          <button type="button" className="mm-map-location-confirm-backdrop" onClick={() => setLocationSwitchOpen(false)} aria-label={mapLocationLabels.switchCancel} />
          <div className="mm-map-location-confirm-card">
            <div className="mm-map-location-confirm-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3m0 14v3m10-10h-3M5 12H2" />
              </svg>
            </div>
            <h3>{mapLocationLabels.switchTitle}</h3>
            <p>{mapLocationLabels.switchBody}</p>
            <div>
              <button type="button" onClick={() => setLocationSwitchOpen(false)}>{mapLocationLabels.switchCancel}</button>
              <button type="button" onClick={confirmUseCurrentLocation}>{mapLocationLabels.switchConfirm}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
