'use client';
import { useCallback, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type Museum } from '@/generated_v2/client';
import { translateCategory, type Locale } from '@/lib/i18n';
import { createRoot } from 'react-dom/client';
import { getMuseumImageSrc } from '@/lib/getMuseumImage';

// Category → SVG icon path (each visually distinct)
const CATEGORY_ICONS: Record<string, string> = {
  // Contemporary Art — abstract sparkle
  'Contemporary Art': 'M11 2h2l.7 5.3 4.3-3.2 1.4 1.4-3.1 4.3 5.2.7v2l-5.2.7 3.1 4.3-1.4 1.4-4.3-3.2L13 22h-2l-.7-5.3-4.3 3.2-1.4-1.4 3.1-4.3-5.2-.7v-2l5.2-.7-3.1-4.3 1.4-1.4 4.3 3.2L11 2z',
  // Modern Art — palette with brush
  'Modern Art': 'M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c.55 0 1-.45 1-1v-.68c0-.5-.42-.91-.91-1.03C9.73 18.65 8 16.5 8 14c0-3.31 2.69-6 6-6 2.97 0 5.43 2.16 5.9 5h.1c.55 0 1-.45 1-1 0-5.51-4.49-10-10-10zm-5 10c0 .83.67 1.5 1.5 1.5S10 12.83 10 12s-.67-1.5-1.5-1.5S7 11.17 7 12zm3-4c0 .83.67 1.5 1.5 1.5S13 8.83 13 8s-.67-1.5-1.5-1.5S10 7.17 10 8zm5 0c0 .83.67 1.5 1.5 1.5S18 8.83 18 8s-.67-1.5-1.5-1.5S15 7.17 15 8z',
  // Fine Arts — paintbrush
  'Fine Arts': 'M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 00-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 000-1.41z',
  // Art Gallery — framed picture
  'Art Gallery': 'M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4l2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z',
  // General Museum — classical building with columns
  'General Museum': 'M12 3L3 8v2h18V8l-9-5zM5 11v7H3v2h18v-2h-2v-7h-2v7h-3v-7h-4v7H7v-7H5z',
  // Cultural Center — theater/stage
  'Cultural Center': 'M2 16.5C2 19.54 4.46 22 7.5 22s5.5-2.46 5.5-5.5V2H2v14.5zm2-12.5h7v3H4V4zm7 12.5c0 1.93-1.57 3.5-3.5 3.5S4 18.43 4 16.5V9h7v7.5zm3-12.5h7v14.5c0 1.93-1.57 3.5-3.5 3.5S14 18.43 14 16.5V4zm2 3V4h3v3h-3z',
  // History Museum — pen/quill
  'History Museum': 'M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83a.996.996 0 000-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z',
  // Natural History — leaf
  'Natural History': 'M17.12 2.12c-5.69 5.69-3.73 11.32-1.21 14.59L4.93 21.17l1.42 1.42 4.47-10.99c3.26 2.52 8.89 4.49 14.59-1.21L17.12 2.12zM7.27 10.73l1.41-1.42 2.84 2.84-1.42 1.41-2.83-2.83z',
  // Science Museum — microscope
  'Science Museum': 'M13 11.33L18 18H6l5-6.67V6.83c-.86-.46-1.5-1.38-1.5-2.46 0-1.54 1.26-2.83 2.83-2.83h.09c1.56.05 2.79 1.33 2.79 2.9 0 1.05-.6 1.95-1.5 2.4v4.49zM3 20v2h18v-2H3z',
  // Maritime Museum — anchor
  'Maritime Museum': 'M12 2a2 2 0 012 2c0 .74-.4 1.38-1 1.73V8h4V6h2v6h-2v-2h-4v7.1c1.94-.44 3.5-1.78 4.18-3.56l1.86.7C17.96 17.12 15.22 19 12 19s-5.96-1.88-7.04-4.76l1.86-.7A5.52 5.52 0 0011 17.1V10H7v2H5V6h2v2h4V5.73A2 2 0 1112 2zm0 1.5a.5.5 0 100 1 .5.5 0 000-1z',
  // Archaeological Museum — magnifying glass
  'Archaeological Museum': 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  // Photography Museum — camera
  'Photography Museum': 'M12 10.8a2.4 2.4 0 100 4.8 2.4 2.4 0 000-4.8zm6-3.6h-1.75l-1.58-1.68A1.2 1.2 0 0013.8 5h-3.6a1.2 1.2 0 00-.87.52L7.75 7.2H6C4.34 7.2 3 8.54 3 10.2v7.2c0 1.66 1.34 3 3 3h12c1.66 0 3-1.34 3-3v-7.2c0-1.66-1.34-3-3-3zM12 17.4a4.2 4.2 0 110-8.4 4.2 4.2 0 010 8.4z',
  // Design Museum — computer/monitor
  'Design Museum': 'M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7l-2 3v1h8v-1l-2-3h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 12H3V4h18v10z',
  // Architecture Museum — classical plan/building
  'Architecture Museum': 'M12 2.5L3 7.5v2h18v-2l-9-5zM5 11h3v7H5v-7zm5 0h4v7h-4v-7zm6 0h3v7h-3v-7zM4 19h16v2H4v-2z',
  // Unusual Museum — curiosity/spark
  'Unusual Museum': 'M12 2l1.15 4.15L17 7.3l-3.85 1.15L12 12l-1.15-3.55L7 7.3l3.85-1.15L12 2zm6.5 8l.8 2.7L22 13.5l-2.7.8-.8 2.7-.8-2.7-2.7-.8 2.7-.8.8-2.7zM6 12l1 3.2 3.2 1L7 17.2 6 20.4 5 17.2l-3.2-1 3.2-1L6 12z',
};

const DEFAULT_ICON = 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z';

const CATEGORY_ICON_ALIASES: Record<string, string> = {
  Museum: 'General Museum',
  Museums: 'General Museum',
  'Art Museum': 'Fine Arts',
  'Art Gallery': 'Art Gallery',
  Gallery: 'Art Gallery',
  Art: 'Fine Arts',
  'Arts': 'Fine Arts',
  'Fine Art': 'Fine Arts',
  'Fine Arts': 'Fine Arts',
  'Contemporary': 'Contemporary Art',
  'Contemporary Art': 'Contemporary Art',
  'Modern': 'Modern Art',
  'Modern Art': 'Modern Art',
  'Specialty Museum': 'General Museum',
  'Unusual Museum': 'Unusual Museum',
  'Creative Complex': 'Cultural Center',
  'Art Space': 'Art Gallery',
  'Media Art': 'Contemporary Art',
  'Digital Art': 'Contemporary Art',
  'Architecture Museum': 'Architecture Museum',
  Architecture: 'Architecture Museum',
  'Art Pavilion': 'Contemporary Art',
  'History': 'History Museum',
  'War Museum': 'History Museum',
  'Military Museum': 'History Museum',
  'Children Museum': 'Science Museum',
  'Children\'s Museum': 'Science Museum',
  'Natural History': 'Natural History',
  'Natural History Museum': 'Natural History',
  'Science': 'Science Museum',
  'Maritime': 'Maritime Museum',
  'Maritime Museum': 'Maritime Museum',
  'Archaeology': 'Archaeological Museum',
  'Archaeology Museum': 'Archaeological Museum',
  'Archaeological Museum': 'Archaeological Museum',
  'Photography': 'Photography Museum',
  'Photography Museum': 'Photography Museum',
  'Design': 'Design Museum',
  'Design Museum': 'Design Museum',
  'Culture': 'Cultural Center',
  'Cultural Center': 'Cultural Center',
  미술관: 'Fine Arts',
  박물관: 'General Museum',
  현대미술: 'Contemporary Art',
  근대미술: 'Modern Art',
  순수미술: 'Fine Arts',
  아트갤러리: 'Art Gallery',
  '종합 박물관': 'General Museum',
  문화센터: 'Cultural Center',
  역사: 'History Museum',
  자연사: 'Natural History',
  과학: 'Science Museum',
  해양: 'Maritime Museum',
  고고학: 'Archaeological Museum',
  사진: 'Photography Museum',
  디자인: 'Design Museum',
  건축: 'Architecture Museum',
  건축박물관: 'Architecture Museum',
  '특이 박물관': 'Unusual Museum',
};

// match expression labels must be unique — duplicates invalidate the whole expression
const CATEGORY_ICON_MATCH_PAIRS: string[] = (() => {
  const pairs = new Map<string, string>();
  for (const category of Object.keys(CATEGORY_ICONS)) pairs.set(category, `icon-${category}`);
  for (const [alias, category] of Object.entries(CATEGORY_ICON_ALIASES)) {
    if (!pairs.has(alias)) pairs.set(alias, `icon-${category}`);
  }
  return Array.from(pairs.entries()).flat();
})();

function createCategoryIconImageData(pathD: string, color: string, size: number = 48): { width: number; height: number; data: Uint8Array } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  try {
    const path = new Path2D(pathD);
    ctx.fill(path);
    ctx.stroke(path);
  } catch {
    ctx.beginPath();
    ctx.arc(12, 9, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  const imageData = ctx.getImageData(0, 0, size, size);
  return { width: size, height: size, data: new Uint8Array(imageData.data) };
}

async function registerCategoryIconImages(map: maplibregl.Map, color: string) {
  const entries = [...Object.entries(CATEGORY_ICONS), ['_default', DEFAULT_ICON] as const];
  for (const [key, pathD] of entries) {
    const imageId = `icon-${key}`;
    try {
      if (map.hasImage(imageId)) map.removeImage(imageId);
      map.addImage(imageId, createCategoryIconImageData(pathD, color), { pixelRatio: 1 });
    } catch (error) {
      console.warn(`[map] marker icon skipped: ${imageId}`, error);
    }
  }
}

/** Canvas-rendered gradient circle for cluster markers */
function createGradientCircle(size: number, darkMode: boolean, variant: 'blue' | 'orange' = 'blue'): ImageData {
  const r = size * 2; // retina
  const canvas = document.createElement('canvas');
  canvas.width = r; canvas.height = r;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, r, r);
  if (variant === 'orange') {
    if (darkMode) {
      grad.addColorStop(0, '#1D4ED8');
      grad.addColorStop(0.5, '#3B82F6');
      grad.addColorStop(1, '#93C5FD');
    } else {
      grad.addColorStop(0, '#1E40AF');
      grad.addColorStop(0.5, '#2563EB');
      grad.addColorStop(1, '#60A5FA');
    }
  } else {
    if (darkMode) {
      grad.addColorStop(0, '#1D4ED8');
      grad.addColorStop(0.5, '#3B82F6');
      grad.addColorStop(1, '#93C5FD');
    } else {
      grad.addColorStop(0, '#1E40AF');
      grad.addColorStop(0.5, '#2563EB');
      grad.addColorStop(1, '#60A5FA');
    }
  }

  // Outer glow
  ctx.beginPath();
  ctx.arc(r / 2, r / 2, r / 2, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.globalAlpha = 0.15;
  ctx.fill();

  // Main circle
  ctx.beginPath();
  ctx.arc(r / 2, r / 2, r * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.globalAlpha = 0.9;
  ctx.fill();

  return ctx.getImageData(0, 0, r, r);
}

/** Soft glow ring for cluster pulse animation */
function createGlowCircle(size: number, darkMode: boolean, variant: 'blue' | 'orange' = 'blue'): ImageData {
  const r = size * 2;
  const canvas = document.createElement('canvas');
  canvas.width = r; canvas.height = r;
  const ctx = canvas.getContext('2d')!;

  const color = variant === 'orange'
    ? (darkMode ? 'rgba(96,165,250,' : 'rgba(37,99,235,')
    : (darkMode ? 'rgba(96,165,250,' : 'rgba(37,99,235,');

  // Soft radial glow
  const grad = ctx.createRadialGradient(r / 2, r / 2, r * 0.2, r / 2, r / 2, r / 2);
  grad.addColorStop(0, color + '0.25)');
  grad.addColorStop(0.6, color + '0.12)');
  grad.addColorStop(1, color + '0)');

  ctx.beginPath();
  ctx.arc(r / 2, r / 2, r / 2, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  return ctx.getImageData(0, 0, r, r);
}

type MuseumFeatureBaseProperties = {
  id: string;
  displayName: string;
  type: string | null;
  displayCity: string;
  country: string;
  googleRating: number;
  imageSrc: string;
};

const museumFeatureBaseCache = new WeakMap<object, Map<string, MuseumFeatureBaseProperties>>();
const museumListKeyCache = new WeakMap<Museum[], string>();

function getMuseumListKey(museums: Museum[]) {
  const cached = museumListKeyCache.get(museums);
  if (cached) return cached;
  const key = `${museums.length}:${museums.map(museum => museum.id).join('|')}`;
  museumListKeyCache.set(museums, key);
  return key;
}

function getIdSetKey(ids?: Set<string>) {
  if (!ids || ids.size === 0) return '';
  return Array.from(ids).sort().join('|');
}

function getMuseumSourceSignature(museums: Museum[], savedIds: Set<string> | undefined, locale: string) {
  return `${locale || 'ko'}::${getMuseumListKey(museums || [])}::saved=${getIdSetKey(savedIds)}`;
}

function getMuseumFeatureBaseProperties(museum: Museum, locale: string): MuseumFeatureBaseProperties {
  const cacheKey = locale || 'ko';
  let cachedByLocale = museumFeatureBaseCache.get(museum as object);
  const cached = cachedByLocale?.get(cacheKey);
  if (cached) return cached;

  const typedMuseum = museum as any;
  const nameTranslations = typedMuseum.nameTranslations || {};
  const cityTranslations = typedMuseum.cityTranslations || {};
  const properties = {
    id: museum.id,
    displayName: cacheKey === 'ko'
      ? (typedMuseum.nameKo || museum.name)
      : cacheKey === 'en'
        ? (typedMuseum.nameEn || museum.name)
        : (nameTranslations[cacheKey] || typedMuseum.nameEn || museum.name),
    type: museum.type,
    displayCity: cacheKey === 'ko'
      ? (typedMuseum.cityKo || museum.city || '')
      : cacheKey === 'en'
        ? (museum.city || '')
        : (cityTranslations[cacheKey] || museum.city || ''),
    country: museum.country || '',
    googleRating: typedMuseum.googleRating || 0,
    imageSrc: getMuseumImageSrc(typedMuseum) || '',
  };

  if (!cachedByLocale) {
    cachedByLocale = new Map();
    museumFeatureBaseCache.set(museum as object, cachedByLocale);
  }
  cachedByLocale.set(cacheKey, properties);
  return properties;
}

function museumsToGeoJSON(museums: Museum[], savedIds?: Set<string>, locale: string = 'ko'): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const museum of museums || []) {
    if (!Number.isFinite(museum.longitude) || !Number.isFinite(museum.latitude)) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [museum.longitude, museum.latitude] },
      properties: {
        ...getMuseumFeatureBaseProperties(museum, locale),
        saved: savedIds?.has(museum.id) ? 1 : 0,
      },
    });
  }
  return {
    type: 'FeatureCollection',
    features,
  };
}

type UserLocation = { lat: number; lng: number };

function userLocationToGeoJSON(location?: UserLocation | null): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: location ? [{
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [location.lng, location.lat] },
      properties: {},
    }] : [],
  };
}

function addUserLocationLayers(map: maplibregl.Map, darkMode: boolean, location?: UserLocation | null) {
  if (!map.getSource('user-location')) {
    map.addSource('user-location', {
      type: 'geojson',
      data: userLocationToGeoJSON(location),
    });
  }

  if (!map.getLayer('user-location-ring')) {
    map.addLayer({
      id: 'user-location-ring',
      type: 'circle',
      source: 'user-location',
      paint: {
        'circle-radius': 9,
        'circle-color': darkMode ? 'rgba(96, 165, 250, 0.18)' : 'rgba(37, 99, 235, 0.16)',
        'circle-stroke-width': 2,
        'circle-stroke-color': darkMode ? 'rgba(147, 197, 253, 0.75)' : 'rgba(37, 99, 235, 0.55)',
      },
    }, getFirstExistingLayer(map, ['cluster-glow', 'clusters', 'cluster-count', 'unclustered-bg', 'unclustered-icon']));
  }

  if (!map.getLayer('user-location-dot')) {
    map.addLayer({
      id: 'user-location-dot',
      type: 'circle',
      source: 'user-location',
      paint: {
        'circle-radius': 4.5,
        'circle-color': darkMode ? '#60A5FA' : '#2563EB',
        'circle-stroke-width': 2,
        'circle-stroke-color': darkMode ? '#111827' : '#FFFFFF',
      },
    }, getFirstExistingLayer(map, ['cluster-glow', 'clusters', 'cluster-count', 'unclustered-bg', 'unclustered-icon']));
  }
}

// ── Locale → OpenMapTiles name field mapping ──
function getLocalizedTextField(locale: string): unknown[] {
  // Map app locale to OpenMapTiles name:XX field
  const LOCALE_NAME_MAP: Record<string, string> = {
    'ko': 'name:ko', 'ja': 'name:ja', 'de': 'name:de', 'fr': 'name:fr',
    'es': 'name:es', 'pt': 'name:pt', 'zh-CN': 'name:zh', 'zh-TW': 'name:zh',
    'da': 'name:da', 'fi': 'name:fi', 'sv': 'name:sv', 'et': 'name:et',
    'en': 'name:en',
  };
  const nameField = LOCALE_NAME_MAP[locale] || 'name:en';
  const underscoreField = nameField.replace(':', '_');
  // Fallback chain: localized name → localized underscore variant → English → default.
  return ['coalesce', ['get', nameField], ['get', underscoreField], ['get', 'name:en'], ['get', 'name_en'], ['get', 'name']];
}

const NORTH_KOREA_LABEL_CLIP: GeoJSON.Feature<GeoJSON.Polygon> = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [124.1, 37.72],
      [124.1, 43.08],
      [130.92, 43.08],
      [130.92, 42.28],
      [130.4, 41.92],
      [129.72, 41.45],
      [129.46, 40.72],
      [128.82, 39.5],
      [128.34, 38.56],
      [127.88, 38.36],
      [127.08, 38.3],
      [126.28, 37.82],
      [125.45, 37.72],
      [124.7, 37.84],
      [124.1, 37.72],
    ]],
  },
};

function shouldHideNorthKoreaLabels(locale: string) {
  return locale === 'ko';
}

function getNorthKoreaHiddenTextField(textField: unknown[]): unknown[] {
  return [
    'case',
    ['any', ['==', ['get', 'iso_a2'], 'KP'], ['within', NORTH_KOREA_LABEL_CLIP]],
    '',
    textField,
  ];
}

function applyMapLocale(map: maplibregl.Map, locale: string) {
  const textField = getLocalizedTextField(locale);
  const style = map.getStyle();
  if (!style?.layers) return;
  for (const layer of style.layers) {
    const layout = (layer as { layout?: Record<string, unknown> }).layout;
    if (layer.type === 'symbol' && layout?.['text-field']) {
      // Skip our own museum layers
      if (layer.id === 'cluster-count') continue;
      const sourceLayer = (layer as { 'source-layer'?: string })['source-layer'];
      const nextTextField = sourceLayer === 'place' && shouldHideNorthKoreaLabels(locale)
        ? getNorthKoreaHiddenTextField(textField)
        : textField;
      try {
        map.setLayoutProperty(layer.id, 'text-field', nextTextField);
      } catch { /* some layers may not support this */ }
    }
  }
}
const LIGHT_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const LIGHT_COLOR = '#2563EB'; // Museum Map 2.0 primary blue
const DARK_COLOR = '#60A5FA';  // Museum Map 2.0 dark-mode blue
export type MapBounds = { minLng: number; minLat: number; maxLng: number; maxLat: number };

const MUSEUM_LAYER_IDS = ['unclustered-icon', 'unclustered-bg'];
const MUSEUM_TAP_RADIUS = 15;

// map.resize() internally calls stop(), killing in-flight camera animations —
// only resize when the canvas no longer matches the container size.
function resizeIfNeeded(map: maplibregl.Map) {
  const container = map.getContainer();
  const canvas = map.getCanvas();
  const dpr = window.devicePixelRatio || 1;
  if (Math.abs(container.clientWidth - canvas.width / dpr) < 1 &&
    Math.abs(container.clientHeight - canvas.height / dpr) < 1) return;
  map.resize();
  map.triggerRepaint();
}

function getFirstExistingLayer(map: maplibregl.Map, layerIds: string[]) {
  return layerIds.find(layerId => !!map.getLayer(layerId));
}

function getMuseumLayerIds(map: maplibregl.Map) {
  return MUSEUM_LAYER_IDS.filter(layerId => !!map.getLayer(layerId));
}

function getClusterVisualRadius(feature: any) {
  const count = Number(feature?.properties?.point_count) || 0;
  if (count >= 50) return 42;
  if (count >= 10) return 32;
  return 22;
}

function isPointInsideClusterCircle(map: maplibregl.Map, feature: any, point: { x: number; y: number }) {
  if (!feature?.geometry || feature.geometry.type !== 'Point') return false;
  const center = map.project(feature.geometry.coordinates as [number, number]);
  return Math.hypot(point.x - center.x, point.y - center.y) <= getClusterVisualRadius(feature);
}

function getClusterFeatureAtPoint(map: maplibregl.Map, point: { x: number; y: number }, eventFeature?: any) {
  if (eventFeature?.properties?.cluster_id != null && isPointInsideClusterCircle(map, eventFeature, point)) {
    return eventFeature;
  }

  if (!map.getSource('museums')) return null;
  let candidates: any[] = [];
  try {
    candidates = map.querySourceFeatures('museums' as any).filter((feature: any) => (
      feature.properties?.cluster_id != null && isPointInsideClusterCircle(map, feature, point)
    ));
  } catch {
    return null;
  }
  if (candidates.length === 0) return null;
  return candidates
    .map(feature => {
      const center = map.project(feature.geometry.coordinates as [number, number]);
      return { feature, distance: Math.hypot(point.x - center.x, point.y - center.y) };
    })
    .sort((a, b) => a.distance - b.distance)[0]?.feature || null;
}

function getMuseumFeatureAtPoint(map: maplibregl.Map, point: { x: number; y: number }, eventFeature?: any) {
  const isInsideMarker = (feature: any) => {
    if (!feature?.properties?.id || feature.properties?.cluster_id != null) return false;
    if (!feature?.geometry || feature.geometry.type !== 'Point') return false;
    const center = map.project(feature.geometry.coordinates as [number, number]);
    return Math.hypot(point.x - center.x, point.y - center.y) <= MUSEUM_TAP_RADIUS;
  };

  if (isInsideMarker(eventFeature)) return eventFeature;

  const layers = getMuseumLayerIds(map);
  if (layers.length === 0) return null;

  try {
    const direct = map.queryRenderedFeatures(point as any, { layers });
    return direct.find(isInsideMarker) || null;
  } catch (error) {
    console.warn('[map] museum hit test skipped:', error);
    return null;
  }
}

function getEventPoint(e: any) {
  if (e.point) return e.point;
  if (e.points?.[0]) return e.points[0];
  if (e.lngLat && mapRefFromEvent(e)) return mapRefFromEvent(e)!.project(e.lngLat);
  return null;
}

function mapRefFromEvent(e: any): maplibregl.Map | null {
  return e?.target && typeof e.target.project === 'function' ? e.target : null;
}

export default function MapLibreViewer({
  museums,
  onMuseumClick,
  onBoundsChange,
  darkMode = false,
  locale = 'ko',
  flyTo,
  zoomCommand,
  onZoomChange,
  highlightMuseumId,
  userLocation,
  savedIds,
  selectionMode = false,
  onMapPointSelect,
  onMapInteraction,
  popupDismissKey,
}: {
  museums: Museum[],
  onMuseumClick: (id: string) => void,
  onBoundsChange?: (bounds: MapBounds) => void,
  darkMode?: boolean,
  locale?: string,
  flyTo?: { lat: number; lng: number; zoom?: number; offset?: [number, number]; key?: number } | null,
  zoomCommand?: { zoom: number; key?: number } | null,
  onZoomChange?: (zoom: number) => void,
  highlightMuseumId?: string | null,
  userLocation?: UserLocation | null,
  savedIds?: Set<string>,
  compareIds?: Set<string>,
  selectionMode?: boolean,
  onMapPointSelect?: (location: UserLocation) => void,
  onMapInteraction?: () => void,
  popupDismissKey?: number,
}) {
  const localeRef = useRef(locale);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapLoaded = useRef(false);
  const onMuseumClickRef = useRef(onMuseumClick);
  const pendingData = useRef<Museum[] | null>(null);
  const museumsRef = useRef(museums);
  const darkModeRef = useRef(darkMode);
  const highlightMuseumIdRef = useRef(highlightMuseumId);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onZoomChangeRef = useRef(onZoomChange);
  const savedIdsRef = useRef(savedIds);
  const lastMuseumSourceSignatureRef = useRef('');
  const userLocationRef = useRef(userLocation);
  const onMapPointSelectRef = useRef(onMapPointSelect);
  const onMapInteractionRef = useRef(onMapInteraction);
  const activePopupRef = useRef<{ remove: () => void } | null>(null);
  const suppressMapClickUntilRef = useRef(0);
  const clusterTouchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const mapTouchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const clusterTouchHandlerAttachedRef = useRef(false);
  const scheduleMapResize = useCallback(() => {
    window.requestAnimationFrame(() => {
      if (!mapRef.current) return;
      resizeIfNeeded(mapRef.current);
    });
  }, []);
  const emitMapPointSelect = (lngLat?: { lat?: number; lng?: number }) => {
    const lat = Number(lngLat?.lat);
    const lng = Number(lngLat?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    onMapPointSelectRef.current?.({ lat, lng });
  };

  const syncMuseumSourceData = useCallback(() => {
    if (!mapRef.current || !mapLoaded.current) return;
    const source = mapRef.current.getSource('museums') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const nextMuseums = museumsRef.current || [];
    const signature = getMuseumSourceSignature(nextMuseums, savedIdsRef.current, localeRef.current);
    if (signature === lastMuseumSourceSignatureRef.current) return;

    if (activePopupRef.current) {
      activePopupRef.current.remove();
      activePopupRef.current = null;
    }
    source.setData(museumsToGeoJSON(nextMuseums, savedIdsRef.current, localeRef.current));
    lastMuseumSourceSignatureRef.current = signature;
    scheduleMapResize();
    mapRef.current.triggerRepaint();
  }, [scheduleMapResize]);

  useEffect(() => { highlightMuseumIdRef.current = highlightMuseumId; }, [highlightMuseumId]);
  useEffect(() => { onMapPointSelectRef.current = onMapPointSelect; }, [onMapPointSelect]);
  useEffect(() => { onMapInteractionRef.current = onMapInteraction; }, [onMapInteraction]);
  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);
  useEffect(() => {
    if (popupDismissKey === undefined) return;
    if (!activePopupRef.current) return;
    activePopupRef.current.remove();
    activePopupRef.current = null;
  }, [popupDismissKey]);
  useEffect(() => {
    const handleOverlayDismiss = () => {
      if (!activePopupRef.current) return;
      activePopupRef.current.remove();
      activePopupRef.current = null;
    };
    window.addEventListener('mm:map-overlays-dismiss', handleOverlayDismiss);
    return () => window.removeEventListener('mm:map-overlays-dismiss', handleOverlayDismiss);
  }, []);
  useEffect(() => {
    savedIdsRef.current = savedIds;
    syncMuseumSourceData();
  }, [savedIds, syncMuseumSourceData]);
  useEffect(() => {
    museumsRef.current = museums;
    if (!mapLoaded.current) pendingData.current = museums;
    syncMuseumSourceData();
  }, [museums, syncMuseumSourceData]);

  useEffect(() => { onMuseumClickRef.current = onMuseumClick; }, [onMuseumClick]);
  useEffect(() => { onBoundsChangeRef.current = onBoundsChange; }, [onBoundsChange]);
  useEffect(() => { onZoomChangeRef.current = onZoomChange; }, [onZoomChange]);
  useEffect(() => {
    localeRef.current = locale;
    // Update map labels when locale changes
    if (mapRef.current && mapLoaded.current) {
      applyMapLocale(mapRef.current, locale);
      syncMuseumSourceData();
    }
  }, [locale, syncMuseumSourceData]);

  const mountClusterPopup = (
    map: maplibregl.Map,
    coordinates: [number, number],
    popupNode: HTMLElement,
    root: ReturnType<typeof createRoot>
  ) => {
    if (activePopupRef.current) {
      activePopupRef.current.remove();
      activePopupRef.current = null;
    }

    let cleaned = false;
    const cleanup = (after?: () => void) => {
      if (cleaned) return;
      cleaned = true;
      try {
        root.unmount();
      } catch { }
      after?.();
    };

    if (window.matchMedia('(max-width: 1023px)').matches) {
      const shell = document.createElement('div');
      shell.className = 'mm-cluster-popup-mobile-shell';
      shell.addEventListener('click', (event) => event.stopPropagation());
      shell.appendChild(popupNode);
      document.body.appendChild(shell);
      activePopupRef.current = {
        remove: () => {
          cleanup(() => shell.remove());
        },
      };
      return;
    }

    const popup = new maplibregl.Popup({ closeButton: false, maxWidth: '340px', offset: [0, 10], anchor: 'top', className: 'mm-cluster-popup-shell' })
      .setLngLat(coordinates)
      .setDOMContent(popupNode)
      .addTo(map);
    popup.on('close', () => {
      cleanup();
      activePopupRef.current = null;
    });
    activePopupRef.current = {
      remove: () => {
        cleanup(() => popup.remove());
      },
    };
  };

  // Initialize map ONCE
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const color = darkMode ? DARK_COLOR : LIGHT_COLOR;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: darkMode ? DARK_STYLE : LIGHT_STYLE,
      center: [126.97, 37.57], // Default: Seoul, Korea
      zoom: 3,
      pitch: 0,
      minZoom: 2,
      fadeDuration: 80,
    });

    let resizeFrame = 0;
    const resizeMap = () => {
      if (resizeFrame) return;
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = 0;
        resizeIfNeeded(map);
      });
    };
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resizeMap) : null;
    if (mapContainer.current && resizeObserver) resizeObserver.observe(mapContainer.current);
    window.addEventListener('resize', resizeMap, { passive: true });
    window.visualViewport?.addEventListener('resize', resizeMap, { passive: true });
    const initialResizeTimers = [
      window.setTimeout(resizeMap, 50),
      window.setTimeout(resizeMap, 250),
      window.setTimeout(resizeMap, 800),
    ];

    // Restore saved position. Camera movement is user-initiated only.
    try {
      const saved = localStorage.getItem('mapPosition') || sessionStorage.getItem('mapPosition');
      if (saved) {
        const { lng, lat, zoom } = JSON.parse(saved);
        map.jumpTo({ center: [lng, lat], zoom });
      }
    } catch { }

    // Emit bounds on moveend + save position for tab persistence
    map.on('moveend', () => {
      // Save position for tab switch persistence
      try {
        const c = map.getCenter();
        const nextPosition = JSON.stringify({ lng: c.lng, lat: c.lat, zoom: map.getZoom() });
        sessionStorage.setItem('mapPosition', nextPosition);
        localStorage.setItem('mapPosition', nextPosition);
      } catch { }
      if (onBoundsChangeRef.current) {
        const b = map.getBounds();
        onBoundsChangeRef.current({
          minLng: b.getWest(),
          minLat: b.getSouth(),
          maxLng: b.getEast(),
          maxLat: b.getNorth(),
        });
      }
      onZoomChangeRef.current?.(map.getZoom());
    });

    map.on('load', async () => {
      mapLoaded.current = true;
      resizeMap();

      // Emit initial bounds
      if (onBoundsChangeRef.current) {
        const b = map.getBounds();
        onBoundsChangeRef.current({
          minLng: b.getWest(),
          minLat: b.getSouth(),
          maxLng: b.getEast(),
          maxLat: b.getNorth(),
        });
      }

      // Remove ocean/sea water name labels
      const waterLabelIds = ['watername_ocean', 'watername_sea'];
      for (const id of waterLabelIds) {
        if (map.getLayer(id)) try { map.removeLayer(id); } catch { }
      }

      // Apply locale to map labels
      applyMapLocale(map, localeRef.current);

      // Register category marker SVGs before adding symbol layers.
      await registerCategoryIconImages(map, color);

      const data = pendingData.current || museums;
      const sourceData = museumsToGeoJSON(data, savedIdsRef.current, localeRef.current);
      map.addSource('museums', {
        type: 'geojson',
        data: sourceData,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });
      lastMuseumSourceSignatureRef.current = getMuseumSourceSignature(data, savedIdsRef.current, localeRef.current);

      // Register gradient circle images for clusters (3 sizes × 2 variants)
      const clusterSizes = [{ name: 'sm', px: 40 }, { name: 'md', px: 60 }, { name: 'lg', px: 80 }];
      for (const cs of clusterSizes) {
        for (const variant of ['blue', 'orange'] as const) {
          const key = `cluster-${variant}-${cs.name}`;
          const imgData = createGradientCircle(cs.px, darkMode, variant);
          if (!map.hasImage(key)) map.addImage(key, imgData, { pixelRatio: 2 });
          // Glow variant
          const glowKey = `glow-${variant}-${cs.name}`;
          const glowData = createGlowCircle(cs.px + 16, darkMode, variant);
          if (!map.hasImage(glowKey)) map.addImage(glowKey, glowData, { pixelRatio: 2 });
        }
      }

      // Cluster glow pulse layer (behind main clusters)
      map.addLayer({
        id: 'cluster-glow',
        type: 'symbol',
        source: 'museums',
        filter: ['has', 'point_count'],
        layout: {
          'icon-image': ['step', ['get', 'point_count'], 'glow-blue-sm', 10, 'glow-blue-md', 50, 'glow-blue-lg'] as any,
          'icon-allow-overlap': true,
          'icon-size': 1.08,
        },
        paint: { 'icon-opacity': 0.64 },
      });

      // Cluster gradient circles
      map.addLayer({
        id: 'clusters',
        type: 'symbol',
        source: 'museums',
        filter: ['has', 'point_count'],
        layout: {
          'icon-image': ['step', ['get', 'point_count'], 'cluster-blue-sm', 10, 'cluster-blue-md', 50, 'cluster-blue-lg'] as any,
          'icon-allow-overlap': true,
        },
      });

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'museums',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 13,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#ffffff' }
      });

      // Unclustered: use category icon images
      // First, add a circle background for the icon
      map.addLayer({
        id: 'unclustered-bg',
        type: 'circle',
        source: 'museums',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'case',
            ['==', ['get', 'saved'], 1], darkMode ? '#172554' : '#eff6ff',
            darkMode ? '#172554' : '#eff6ff',
          ] as any,
          'circle-radius': 16.5,
          'circle-stroke-width': 2,
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'saved'], 1], color,
            color,
          ] as any,
          'circle-opacity': 0.9,
        }
      });

      map.addLayer({
        id: 'target-pulse',
        type: 'circle',
        source: 'museums',
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], highlightMuseumIdRef.current || '__none__']],
        paint: {
          'circle-color': darkMode ? 'rgba(96, 165, 250, 0.18)' : 'rgba(37, 99, 235, 0.14)',
          'circle-radius': 22,
          'circle-opacity': 0,
          'circle-stroke-width': 3,
          'circle-stroke-color': darkMode ? '#93c5fd' : '#2563eb',
          'circle-stroke-opacity': 0,
        },
      });

      // Category icon layer
      map.addLayer({
        id: 'unclustered-icon',
        type: 'symbol',
        source: 'museums',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['match', ['to-string', ['get', 'type']], ...CATEGORY_ICON_MATCH_PAIRS, 'icon-_default'] as any,
          'icon-size': 0.38,
          'icon-allow-overlap': true,
          'icon-anchor': 'center',
        },
      });

      addUserLocationLayers(map, darkMode, userLocationRef.current);

      // Click/touch handlers
      let lastMuseumClickTime = 0;
      const handleMuseumTap = (e: any) => {
        onMapInteractionRef.current?.();
        const now = Date.now();
        if (now < suppressMapClickUntilRef.current) return;
        if (now - lastMuseumClickTime < 250) return;
        const point = getEventPoint(e);
        if (!point) return;
        if (activePopupRef.current) {
          e.preventDefault?.();
          e.originalEvent?.preventDefault?.();
          suppressMapClickUntilRef.current = Date.now() + 500;
          activePopupRef.current.remove();
          activePopupRef.current = null;
          return;
        }
        const feature = getMuseumFeatureAtPoint(map, point, e.features?.[0]);
        const id = feature?.properties?.id;
        if (!id) return;
        lastMuseumClickTime = now;
        onMuseumClickRef.current(String(id));
      };
      map.on('click', 'unclustered-bg', handleMuseumTap);
      map.on('click', 'unclustered-icon', handleMuseumTap);
      // Cluster click handler — shared across clusters, cluster-count, cluster-glow
      // Deduplicate: multiple overlapping layers fire click simultaneously
      let lastClusterClickTime = 0;
      const handleClusterClick = (e: any) => {
        const retryCount = e.__retryCount || 0;
        const now = Date.now();
        if (now - lastClusterClickTime < 300) return;

        // Primary: use event's own features.
        // Fallback: queryRenderedFeatures under the click point across all cluster layers
        // — handles timing edge cases where the event originated from cluster-glow (icon image)
        //   but features weren't populated, or when layers were just re-added after a style reload.
        const point = getEventPoint(e);
        if (!point) return;
        onMapInteractionRef.current?.();

        if (map.isMoving() && retryCount < 2) {
          map.stop();
          window.setTimeout(() => handleClusterClick({ point, features: [], __retryCount: retryCount + 1 }), 80);
          return;
        }
        if (!map.isSourceLoaded('museums') && retryCount < 3) {
          window.setTimeout(() => handleClusterClick({ point, features: [], __retryCount: retryCount + 1 }), 120);
          return;
        }

        const feature = getClusterFeatureAtPoint(map, point, e.features?.[0]);
        if (!feature) {
          if (retryCount < 2) {
            window.setTimeout(() => handleClusterClick({ point, features: [], __retryCount: retryCount + 1 }), 80);
            return;
          }
          console.warn('[cluster] no feature at point', e.point);
          return;
        }

        const clusterId = feature.properties?.cluster_id;
        if (clusterId == null) { console.warn('[cluster] no cluster_id'); return; }

        const source = map.getSource('museums') as maplibregl.GeoJSONSource;
        if (!source) { console.warn('[cluster] no museums source'); return; }

        const geometry = feature.geometry;
        lastClusterClickTime = Date.now();

        source.getClusterLeaves(clusterId, 100, 0).then((leaves) => {
          if (!leaves || leaves.length === 0) { console.warn('[cluster] no leaves for cluster', clusterId); return; }

          const popupNode = document.createElement('div');
          const root = createRoot(popupNode);

          const sortedLeaves = [...leaves].sort((a: any, b: any) => (Number(b.properties?.googleRating) || 0) - (Number(a.properties?.googleRating) || 0));

          const listItems = sortedLeaves.map((lf: any, idx: number) => {
            const p = lf.properties;
            return (
              <button
                type="button"
                key={idx}
                className="mm-cluster-popup2-item"
                style={{ animation: `fadeInUp 0.25s ease-out ${idx * 0.04}s both` }}
                onClick={() => {
                  // Keep the cluster list popup open so it is still there after the
                  // user opens a museum detail and presses back. (Replaced by a new
                  // cluster click / map-overlay dismiss as usual.)
                  onMapInteractionRef.current?.();
                  if (p?.id) onMuseumClickRef.current(p.id);
                }}
              >
                <div className="mm-cluster-popup2-thumb">
                  {p?.imageSrc ? (
                    <img
                      src={p.imageSrc}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.src = '/logo.svg';
                        event.currentTarget.className = 'mm-cluster-popup2-logo';
                      }}
                    />
                  ) : (
                    <img src="/logo.svg" alt="" className="mm-cluster-popup2-logo" />
                  )}
                </div>
                <div className="mm-cluster-popup2-copy">
                  <div className="mm-cluster-popup2-title-row">
                    <strong>{p?.displayName || ''}</strong>
                    {p?.googleRating > 0 && <span>★ {Number(p.googleRating).toFixed(1)}</span>}
                  </div>
                  <small>
                    {p?.displayCity || ''}{p?.country ? `, ${(() => { try { return new Intl.DisplayNames([localeRef.current], { type: 'region' }).of(p.country); } catch { return p.country; } })()}` : ''}
                    {p?.type ? ` · ${translateCategory(p.type, localeRef.current as Locale)}` : ''}
                  </small>
                </div>
              </button>
            );
          });

          root.render(
            <div className="mm-cluster-popup2" style={{ overscrollBehavior: 'contain' }}>
              <div className="mm-cluster-popup2-head">
                <span>{(() => { const l = localeRef.current; return l === 'ko' ? '박물관 및 미술관' : l === 'ja' ? '美術館' : l === 'zh-CN' ? '博物馆' : l === 'zh-TW' ? '博物館' : l === 'de' ? 'Museen' : l === 'fr' ? 'musées' : l === 'es' ? 'museos' : l === 'pt' ? 'museus' : 'Museums'; })()}</span>
                <em>{leaves.length}</em>
              </div>
              {listItems}
            </div>
          );

          if (geometry.type === 'Point') {
            mountClusterPopup(map, geometry.coordinates as [number, number], popupNode, root);
          }
        }).catch((err) => {
          if (retryCount < 2) {
            window.setTimeout(() => handleClusterClick({ point, features: [], __retryCount: retryCount + 1 }), 120);
            return;
          }
          console.error('[cluster] getClusterLeaves error:', err);
        });
      };
      map.on('click', (e: any) => {
        if (Date.now() < suppressMapClickUntilRef.current) return;
        const point = getEventPoint(e);
        if (!point) return;
        onMapInteractionRef.current?.();
        if (activePopupRef.current) {
          e.preventDefault?.();
          e.originalEvent?.preventDefault?.();
          suppressMapClickUntilRef.current = Date.now() + 500;
          activePopupRef.current.remove();
          activePopupRef.current = null;
          return;
        }
        const clusterFeature = getClusterFeatureAtPoint(map, point);
        if (clusterFeature) {
          handleClusterClick({ point, features: [clusterFeature] });
          return;
        }
        if (getMuseumFeatureAtPoint(map, point)) return;
        if (onMapPointSelectRef.current) {
          e.preventDefault?.();
          e.originalEvent?.preventDefault?.();
          emitMapPointSelect(e.lngLat);
        }
      });
      if (!clusterTouchHandlerAttachedRef.current) {
        clusterTouchHandlerAttachedRef.current = true;
        map.on('touchstart', (e: any) => {
          if ((e.points?.length || 0) > 1) { clusterTouchStartRef.current = null; return; }
          const point = getEventPoint(e);
          clusterTouchStartRef.current = point ? { x: point.x, y: point.y, time: Date.now() } : null;
          mapTouchStartRef.current = point ? { x: point.x, y: point.y, time: Date.now() } : null;
        });
        map.on('touchend', (e: any) => {
          if (Date.now() < suppressMapClickUntilRef.current) return;
          const start = mapTouchStartRef.current || clusterTouchStartRef.current;
          mapTouchStartRef.current = null;
          clusterTouchStartRef.current = null;
          const point = getEventPoint(e);
          if (!start || !point) return;
          const dx = point.x - start.x;
          const dy = point.y - start.y;
          if (Math.hypot(dx, dy) > 28 || Date.now() - start.time > 900) return;
          const startPoint = { x: start.x, y: start.y };
          if (activePopupRef.current) {
            e.preventDefault?.();
            e.originalEvent?.preventDefault?.();
            suppressMapClickUntilRef.current = Date.now() + 600;
            activePopupRef.current.remove();
            activePopupRef.current = null;
            return;
          }
          const clusterFeature = getClusterFeatureAtPoint(map, point) || getClusterFeatureAtPoint(map, startPoint);
          if (clusterFeature) {
            onMapInteractionRef.current?.();
            e.preventDefault?.();
            e.originalEvent?.preventDefault?.();
            handleClusterClick({ point, features: [clusterFeature] });
            return;
          }
          if (getMuseumFeatureAtPoint(map, point) || getMuseumFeatureAtPoint(map, startPoint)) return;
          if (onMapPointSelectRef.current && e.lngLat) {
            e.preventDefault?.();
            e.originalEvent?.preventDefault?.();
            emitMapPointSelect(e.lngLat);
          }
        });
      }

      // Cursor styles for interactive layers
      for (const layer of ['unclustered-bg', 'unclustered-icon']) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
      }

      pendingData.current = null;
      resizeMap();
    });

    mapRef.current = map;
    darkModeRef.current = darkMode;
    return () => {
      initialResizeTimers.forEach(timer => window.clearTimeout(timer));
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resizeMap);
      window.visualViewport?.removeEventListener('resize', resizeMap);
      mapLoaded.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dark mode style swap
  useEffect(() => {
    if (!mapRef.current || darkModeRef.current === darkMode) return;
    darkModeRef.current = darkMode;

    const map = mapRef.current;
    const newStyle = darkMode ? DARK_STYLE : LIGHT_STYLE;
    const color = darkMode ? DARK_COLOR : LIGHT_COLOR;

    // Save current center/zoom
    const center = map.getCenter();
    const zoom = map.getZoom();

    map.setStyle(newStyle);

    map.once('style.load', async () => {
      // Remove ocean/sea water name labels
      const waterLabelIds = ['watername_ocean', 'watername_sea'];
      for (const id of waterLabelIds) {
        if (map.getLayer(id)) try { map.removeLayer(id); } catch { }
      }

      // Apply locale to map labels
      applyMapLocale(map, localeRef.current);
      // Re-register category marker SVGs before adding symbol layers.
      await registerCategoryIconImages(map, color);

      // Re-add source & layers
      const data = pendingData.current || museums;
      const sourceData = museumsToGeoJSON(data, savedIdsRef.current, localeRef.current);
      map.addSource('museums', {
        type: 'geojson',
        data: sourceData,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });
      lastMuseumSourceSignatureRef.current = getMuseumSourceSignature(data, savedIdsRef.current, localeRef.current);

      // Register gradient circle images for clusters (3 sizes × 2 variants)
      const clusterSizes = [{ name: 'sm', px: 40 }, { name: 'md', px: 60 }, { name: 'lg', px: 80 }];
      for (const cs of clusterSizes) {
        for (const variant of ['blue', 'orange'] as const) {
          const key = `cluster-${variant}-${cs.name}`;
          const imgData = createGradientCircle(cs.px, darkMode, variant);
          if (!map.hasImage(key)) map.addImage(key, imgData, { pixelRatio: 2 });
          const glowKey = `glow-${variant}-${cs.name}`;
          const glowData = createGlowCircle(cs.px + 16, darkMode, variant);
          if (!map.hasImage(glowKey)) map.addImage(glowKey, glowData, { pixelRatio: 2 });
        }
      }

      // Glow pulse layer
      map.addLayer({
        id: 'cluster-glow', type: 'symbol', source: 'museums', filter: ['has', 'point_count'],
        layout: {
          'icon-image': ['step', ['get', 'point_count'], 'glow-blue-sm', 10, 'glow-blue-md', 50, 'glow-blue-lg'] as any,
          'icon-allow-overlap': true, 'icon-size': 1.08,
        },
        paint: { 'icon-opacity': 0.64 },
      });

      map.addLayer({
        id: 'clusters', type: 'symbol', source: 'museums', filter: ['has', 'point_count'],
        layout: {
          'icon-image': ['step', ['get', 'point_count'], 'cluster-blue-sm', 10, 'cluster-blue-md', 50, 'cluster-blue-lg'] as any,
          'icon-allow-overlap': true,
        },
      });

      map.addLayer({
        id: 'cluster-count', type: 'symbol', source: 'museums', filter: ['has', 'point_count'],
        layout: { 'text-field': '{point_count_abbreviated}', 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 13, 'text-allow-overlap': true },
        paint: { 'text-color': '#ffffff' },
      });
      map.addLayer({
        id: 'unclustered-bg', type: 'circle', source: 'museums', filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'case',
            ['==', ['get', 'saved'], 1], darkMode ? '#172554' : '#eff6ff',
            darkMode ? '#172554' : '#eff6ff',
          ] as any,
          'circle-radius': 16.5,
          'circle-stroke-width': 2,
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'saved'], 1], color,
            color,
          ] as any,
          'circle-opacity': 0.9,
        },
      });
      map.addLayer({
        id: 'target-pulse',
        type: 'circle',
        source: 'museums',
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], highlightMuseumIdRef.current || '__none__']],
        paint: {
          'circle-color': darkMode ? 'rgba(96, 165, 250, 0.18)' : 'rgba(37, 99, 235, 0.14)',
          'circle-radius': 22,
          'circle-opacity': 0,
          'circle-stroke-width': 3,
          'circle-stroke-color': darkMode ? '#93c5fd' : '#2563eb',
          'circle-stroke-opacity': 0,
        },
      });
      map.addLayer({
        id: 'unclustered-icon', type: 'symbol', source: 'museums', filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['match', ['to-string', ['get', 'type']], ...CATEGORY_ICON_MATCH_PAIRS, 'icon-_default'] as any,
          'icon-size': 0.38, 'icon-allow-overlap': true, 'icon-anchor': 'center',
        },
      });

      addUserLocationLayers(map, darkMode, userLocationRef.current);

      // Re-register click handlers
      let darkLastMuseumClick = 0;
      const darkHandleMuseumTap = (e: any) => {
        onMapInteractionRef.current?.();
        const now = Date.now();
        if (now < suppressMapClickUntilRef.current) return;
        if (now - darkLastMuseumClick < 250) return;
        const point = getEventPoint(e);
        if (!point) return;
        if (activePopupRef.current) {
          e.preventDefault?.();
          e.originalEvent?.preventDefault?.();
          suppressMapClickUntilRef.current = Date.now() + 500;
          activePopupRef.current.remove();
          activePopupRef.current = null;
          return;
        }
        const feature = getMuseumFeatureAtPoint(map, point, e.features?.[0]);
        const id = feature?.properties?.id;
        if (!id) return;
        darkLastMuseumClick = now;
        onMuseumClickRef.current(String(id));
      };
      map.on('click', 'unclustered-bg', darkHandleMuseumTap);
      map.on('click', 'unclustered-icon', darkHandleMuseumTap);

      // Cluster click handler with deduplication (multiple layers overlap)
      let darkLastClusterClick = 0;
      const darkHandleClusterClick = (e: any) => {
        const retryCount = e.__retryCount || 0;
        const now = Date.now();
        if (now - darkLastClusterClick < 300) return;

        const point = getEventPoint(e);
        if (!point) return;
        onMapInteractionRef.current?.();
        if (map.isMoving() && retryCount < 2) {
          map.stop();
          window.setTimeout(() => darkHandleClusterClick({ point, features: [], __retryCount: retryCount + 1 }), 80);
          return;
        }
        if (!map.isSourceLoaded('museums') && retryCount < 3) {
          window.setTimeout(() => darkHandleClusterClick({ point, features: [], __retryCount: retryCount + 1 }), 120);
          return;
        }
        const feature = getClusterFeatureAtPoint(map, point, e.features?.[0]);
        if (!feature) {
          if (retryCount < 2) {
            window.setTimeout(() => darkHandleClusterClick({ point, features: [], __retryCount: retryCount + 1 }), 80);
            return;
          }
          console.warn('[cluster-dark] no feature at point', e.point);
          return;
        }

        const clusterId = feature.properties?.cluster_id;
        if (clusterId == null) { console.warn('[cluster-dark] no cluster_id'); return; }
        const source = map.getSource('museums') as maplibregl.GeoJSONSource;
        if (!source) { console.warn('[cluster-dark] no museums source'); return; }
        const geometry = feature.geometry;
        darkLastClusterClick = Date.now();

        source.getClusterLeaves(clusterId, 100, 0).then((leaves) => {
          if (!leaves || leaves.length === 0) { console.warn('[cluster-dark] no leaves for cluster', clusterId); return; }

          const popupNode = document.createElement('div');
          const root = createRoot(popupNode);

          const sortedLeaves = [...leaves].sort((a: any, b: any) => (Number(b.properties?.googleRating) || 0) - (Number(a.properties?.googleRating) || 0));

          const listItems = sortedLeaves.map((lf: any, idx: number) => {
            const p = lf.properties;
            return (
              <button
                type="button"
                key={idx}
                className="mm-cluster-popup2-item"
                style={{ animation: `fadeInUp 0.25s ease-out ${idx * 0.04}s both` }}
                onClick={() => {
                  // Keep the cluster list popup open so it is still there after the
                  // user opens a museum detail and presses back. (Replaced by a new
                  // cluster click / map-overlay dismiss as usual.)
                  onMapInteractionRef.current?.();
                  if (p?.id) onMuseumClickRef.current(p.id);
                }}
              >
                <div className="mm-cluster-popup2-thumb">
                  {p?.imageSrc ? (
                    <img
                      src={p.imageSrc}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.src = '/logo.svg';
                        event.currentTarget.className = 'mm-cluster-popup2-logo';
                      }}
                    />
                  ) : (
                    <img src="/logo.svg" alt="" className="mm-cluster-popup2-logo" />
                  )}
                </div>
                <div className="mm-cluster-popup2-copy">
                  <div className="mm-cluster-popup2-title-row">
                    <strong>{p?.displayName || ''}</strong>
                    {p?.googleRating > 0 && <span>★ {Number(p.googleRating).toFixed(1)}</span>}
                  </div>
                  <small>
                    {p?.displayCity || ''}{p?.country ? `, ${(() => { try { return new Intl.DisplayNames([localeRef.current], { type: 'region' }).of(p.country); } catch { return p.country; } })()}` : ''}
                    {p?.type ? ` · ${translateCategory(p.type, localeRef.current as Locale)}` : ''}
                  </small>
                </div>
              </button>
            );
          });

          root.render(
            <div className="mm-cluster-popup2" style={{ overscrollBehavior: 'contain' }}>
              <div className="mm-cluster-popup2-head">
                <span>{(() => { const l = localeRef.current; return l === 'ko' ? '박물관 및 미술관' : l === 'ja' ? '美術館' : l === 'zh-CN' ? '博物馆' : l === 'zh-TW' ? '博物館' : l === 'de' ? 'Museen' : l === 'fr' ? 'musées' : l === 'es' ? 'museos' : l === 'pt' ? 'museus' : 'Museums'; })()}</span>
                <em>{leaves.length}</em>
              </div>
              {listItems}
            </div>
          );

          if (geometry.type === 'Point') {
            mountClusterPopup(map, geometry.coordinates as [number, number], popupNode, root);
          }
        }).catch((err) => {
          if (retryCount < 2) {
            window.setTimeout(() => darkHandleClusterClick({ point, features: [], __retryCount: retryCount + 1 }), 120);
            return;
          }
          console.error('[cluster-dark] getClusterLeaves error:', err);
        });
      };
      map.on('click', (e: any) => {
        if (Date.now() < suppressMapClickUntilRef.current) return;
        const point = getEventPoint(e);
        if (!point) return;
        onMapInteractionRef.current?.();
        if (activePopupRef.current) {
          e.preventDefault?.();
          e.originalEvent?.preventDefault?.();
          suppressMapClickUntilRef.current = Date.now() + 500;
          activePopupRef.current.remove();
          activePopupRef.current = null;
          return;
        }
        const clusterFeature = getClusterFeatureAtPoint(map, point);
        if (clusterFeature) {
          darkHandleClusterClick({ point, features: [clusterFeature] });
          return;
        }
        if (getMuseumFeatureAtPoint(map, point)) return;
        if (onMapPointSelectRef.current) {
          e.preventDefault?.();
          e.originalEvent?.preventDefault?.();
          emitMapPointSelect(e.lngLat);
        }
      });
      for (const layer of ['unclustered-bg', 'unclustered-icon']) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
      }


      // Restore position
      map.jumpTo({ center, zoom });
    });
  }, [darkMode, museums]);

  // Update current user location marker when geolocation succeeds.
  useEffect(() => {
    if (!mapRef.current || !mapLoaded.current) return;
    const source = mapRef.current.getSource('user-location') as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(userLocationToGeoJSON(userLocation));
    } else {
      addUserLocationLayers(mapRef.current, darkModeRef.current, userLocation);
    }
  }, [userLocation]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded.current) return;
    const map = mapRef.current;
    const targetId = highlightMuseumId || '__none__';
    let frame = 0;

    const applyTarget = () => {
      if (!map.getLayer('target-pulse')) return false;
      try {
        map.setFilter('target-pulse', ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], targetId]]);
        return true;
      } catch {
        return false;
      }
    };

    if (!applyTarget() || !highlightMuseumId) return;

    const startedAt = performance.now();
    const TOTAL_MS = 5000;
    const CYCLE_MS = 1000;
    const animate = (now: number) => {
      if (!map.getLayer('target-pulse')) return;
      const elapsed = now - startedAt;
      try {
        if (elapsed >= TOTAL_MS) {
          map.setPaintProperty('target-pulse', 'circle-opacity', 0);
          map.setPaintProperty('target-pulse', 'circle-stroke-opacity', 0);
          return;
        }
        // Gradient outline: brightens then shrinks each cycle (blur gives the gradient falloff)
        const phase = (elapsed % CYCLE_MS) / CYCLE_MS;
        map.setPaintProperty('target-pulse', 'circle-blur', 0.6);
        map.setPaintProperty('target-pulse', 'circle-radius', 38 - phase * 20);
        map.setPaintProperty('target-pulse', 'circle-opacity', 0.3 * (1 - phase));
        map.setPaintProperty('target-pulse', 'circle-stroke-opacity', 0.95 * (1 - phase * 0.85));
      } catch {
        return;
      }
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      if (!map.getLayer('target-pulse')) return;
      try {
        map.setPaintProperty('target-pulse', 'circle-opacity', 0);
        map.setPaintProperty('target-pulse', 'circle-stroke-opacity', 0);
      } catch { }
    };
  }, [highlightMuseumId]);

  // FlyTo when prop changes
  useEffect(() => {
    if (!flyTo || !mapRef.current) return;
    const lat = Number(flyTo.lat);
    const lng = Number(flyTo.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const map = mapRef.current;
    // Camera moves don't require style/tiles to be loaded — never gate on map.loaded(),
    // which stays false during tile loads and the 'load' event only fires once.
    try {
      resizeIfNeeded(map);
      map.stop();
      map.easeTo({
        center: [lng, lat],
        zoom: flyTo.zoom ?? map.getZoom(),
        // explicit `offset: undefined` overrides maplibre's [0,0] default and crashes easeTo
        ...(flyTo.offset ? { offset: flyTo.offset } : {}),
        duration: 1500,
        essential: true,
      });
    } catch (error) {
      console.warn('[map] flyTo skipped', error);
    }
  }, [flyTo]);

  // External zoom control from the 2.0 map toolbar.
  useEffect(() => {
    if (!zoomCommand || !mapRef.current) return;
    const nextZoom = Number(zoomCommand.zoom);
    if (!Number.isFinite(nextZoom)) return;
    const map = mapRef.current;
    try {
      map.stop();
      map.easeTo({
        zoom: Math.max(2, Math.min(18, nextZoom)),
        duration: 140,
        easing: (t) => 1 - Math.pow(1 - t, 3),
        essential: true,
      });
    } catch (error) {
      console.warn('[map] zoom skipped', error);
    }
  }, [zoomCommand]);

  return (
    <div
      ref={mapContainer}
      className={`mm-maplibre-container w-full h-full ${selectionMode ? 'mm-map-select-mode' : ''}`}
      style={{ width: '100%', height: '100%', minHeight: 320 }}
    />
  );
}
