'use client';
import { useEffect, useRef, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type Museum } from '@/generated_v2/client';
import { translateCategory, type Locale } from '@/lib/i18n';
import { createRoot } from 'react-dom/client';
import { getMuseumImageSrc } from '@/lib/getMuseumImage';

// Category → SVG icon path (each visually distinct)
const CATEGORY_ICONS: Record<string, string> = {
  // Contemporary Art — abstract star burst / geometric
  'Contemporary Art': 'M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.4 5.6 21.2 8 14 2 9.2h7.6L12 2z',
  // Modern Art — palette with brush
  'Modern Art': 'M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c.55 0 1-.45 1-1v-.68c0-.5-.42-.91-.91-1.03C9.73 18.65 8 16.5 8 14c0-3.31 2.69-6 6-6 2.97 0 5.43 2.16 5.9 5h.1c.55 0 1-.45 1-1 0-5.51-4.49-10-10-10zm-5 10c0 .83.67 1.5 1.5 1.5S10 12.83 10 12s-.67-1.5-1.5-1.5S7 11.17 7 12zm3-4c0 .83.67 1.5 1.5 1.5S13 8.83 13 8s-.67-1.5-1.5-1.5S10 7.17 10 8zm5 0c0 .83.67 1.5 1.5 1.5S18 8.83 18 8s-.67-1.5-1.5-1.5S15 7.17 15 8z',
  // Fine Arts — paintbrush
  'Fine Arts': 'M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 00-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 000-1.41z',
  // Art Gallery — framed picture
  'Art Gallery': 'M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4l2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z',
  // General Museum — classical building with columns
  'General Museum': 'M1 11v10h6v-5h2v5h6V11L8 6l-7 5zm12 8h-2v-5H5v5H3v-7l5-3.5 5 3.5v7zm4-12h2v2h-2zm0 4h2v2h-2zm0 4h2v2h-2zm0 4h2v2h-2zm-4-16v2H7V3h10c1.1 0 2 .9 2 2v16h-2V5h-4z',
  // Cultural Center — theater/stage
  'Cultural Center': 'M2 16.5C2 19.54 4.46 22 7.5 22s5.5-2.46 5.5-5.5V2H2v14.5zm2-12.5h7v3H4V4zm7 12.5c0 1.93-1.57 3.5-3.5 3.5S4 18.43 4 16.5V9h7v7.5zm3-12.5h7v14.5c0 1.93-1.57 3.5-3.5 3.5S14 18.43 14 16.5V4zm2 3V4h3v3h-3z',
  // History Museum — pen/quill
  'History Museum': 'M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83a.996.996 0 000-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z',
  // Natural History — leaf
  'Natural History': 'M17.12 2.12c-5.69 5.69-3.73 11.32-1.21 14.59L4.93 21.17l1.42 1.42 4.47-10.99c3.26 2.52 8.89 4.49 14.59-1.21L17.12 2.12zM7.27 10.73l1.41-1.42 2.84 2.84-1.42 1.41-2.83-2.83z',
  // Science Museum — microscope
  'Science Museum': 'M13 11.33L18 18H6l5-6.67V6.83c-.86-.46-1.5-1.38-1.5-2.46 0-1.54 1.26-2.83 2.83-2.83h.09c1.56.05 2.79 1.33 2.79 2.9 0 1.05-.6 1.95-1.5 2.4v4.49zM3 20v2h18v-2H3z',
  // Maritime Museum — whale
  'Maritime Museum': 'M12 3C7.03 3 2 6.58 2 12c0 3.31 2.69 6 6 6h2.5l2.5-3 2.5 3H18c3.31 0 6-2.69 6-6 0-5.42-5.03-9-12-9zm-4 11c-.83 0-1.5-.67-1.5-1.5S7.17 11 8 11s1.5.67 1.5 1.5S8.83 14 8 14zm8 0c-.83 0-1.5-.67-1.5-1.5S15.17 11 16 11s1.5.67 1.5 1.5S16.83 14 16 14z',
  // Archaeological Museum — magnifying glass
  'Archaeological Museum': 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  // Photography Museum — camera
  'Photography Museum': 'M12 10.8a2.4 2.4 0 100 4.8 2.4 2.4 0 000-4.8zm6-3.6h-1.75l-1.58-1.68A1.2 1.2 0 0013.8 5h-3.6a1.2 1.2 0 00-.87.52L7.75 7.2H6C4.34 7.2 3 8.54 3 10.2v7.2c0 1.66 1.34 3 3 3h12c1.66 0 3-1.34 3-3v-7.2c0-1.66-1.34-3-3-3zM12 17.4a4.2 4.2 0 110-8.4 4.2 4.2 0 010 8.4z',
  // Design Museum — computer/monitor
  'Design Museum': 'M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7l-2 3v1h8v-1l-2-3h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 12H3V4h18v10z',
};

const DEFAULT_ICON = 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z';

function createSvgImage(pathD: string, color: string, size: number = 32): HTMLImageElement {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}"><path d="${pathD}"/></svg>`;
  const img = new Image(size, size);
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return img;
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

function museumsToGeoJSON(museums: Museum[], savedIds?: Set<string>, compareIds?: Set<string>): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (museums || []).map(m => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [m.longitude, m.latitude] },
      properties: { id: m.id, name: m.name, nameKo: (m as any).nameKo || '', nameEn: (m as any).nameEn || '', nameTranslations: JSON.stringify((m as any).nameTranslations || {}), type: m.type, city: m.city || '', cityKo: (m as any).cityKo || '', cityTranslations: JSON.stringify((m as any).cityTranslations || {}), country: m.country || '', saved: savedIds?.has(m.id) ? 1 : 0, inCompare: compareIds?.has(m.id) ? 1 : 0, googleRating: (m as any).googleRating || 0, imageSrc: getMuseumImageSrc(m as any) || '' }
    }))
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
function getLocalizedTextField(locale: string): any {
  // Map app locale to OpenMapTiles name:XX field
  const LOCALE_NAME_MAP: Record<string, string> = {
    'ko': 'name:ko', 'ja': 'name:ja', 'de': 'name:de', 'fr': 'name:fr',
    'es': 'name:es', 'pt': 'name:pt', 'zh-CN': 'name:zh', 'zh-TW': 'name:zh',
    'da': 'name:da', 'fi': 'name:fi', 'sv': 'name:sv', 'et': 'name:et',
    'en': 'name_en',
  };
  const nameField = LOCALE_NAME_MAP[locale] || 'name_en';
  // Fallback chain: localized name → name_en → name
  return ['coalesce', ['get', nameField], ['get', 'name_en'], ['get', 'name']];
}

function applyMapLocale(map: maplibregl.Map, locale: string) {
  const textField = getLocalizedTextField(locale);
  const style = map.getStyle();
  if (!style?.layers) return;
  for (const layer of style.layers) {
    if (layer.type === 'symbol' && (layer as any).layout?.['text-field']) {
      // Skip our own museum layers
      if (layer.id === 'cluster-count') continue;
      try {
        map.setLayoutProperty(layer.id, 'text-field', textField);
      } catch { /* some layers may not support this */ }
    }
  }
}
/** Hide North Korea (DPRK) country name + all place labels within its bounds */
function hideNorthKoreaLabels(map: maplibregl.Map) {
  // North Korea names across all languages
  const nkNames = [
    'North Korea', 'NORTH KOREA', '조선민주주의인민공화국', '북한', '朝鮮民主主義人民共和国',
    '朝鲜', '朝鮮', 'Nordkorea', 'Corée du Nord', 'Corea del Norte', 'Coreia do Norte',
    'DPRK', "Democratic People's Republic of Korea", 'Põhja-Korea',
  ];

  const allLayers = [
    'place_country_1', 'place_country_2',
    'place_city_r6', 'place_city_r5', 'place_city_dot_r7', 'place_city_dot_r4',
    'place_city_dot_r2', 'place_city_dot_z7', 'place_capital_dot_z7',
    'place_town', 'place_villages', 'place_suburbs', 'place_hamlet', 'place_state',
  ];

  // Build legacy-style filter: ["all", ["!=", "name", "North Korea"], ["!=", "name", "북한"], ...]
  const nameFilters: any[] = ['all', ...nkNames.map(n => ['!=', 'name', n])];

  for (const layerId of allLayers) {
    if (!map.getLayer(layerId)) continue;
    try {
      map.setFilter(layerId, nameFilters as any);
    } catch { }
  }
}

const LIGHT_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const LIGHT_COLOR = '#2563EB'; // Museum Map 2.0 primary blue
const DARK_COLOR = '#60A5FA';  // Museum Map 2.0 dark-mode blue
const SAVED_COLOR = '#2563EB';
const SAVED_DARK_COLOR = '#60A5FA';

export type MapBounds = { minLng: number; minLat: number; maxLng: number; maxLat: number };

const CLUSTER_LAYER_IDS = ['clusters', 'cluster-count', 'cluster-glow'];
const CLUSTER_TOUCH_TOLERANCE = 28;

function getFirstExistingLayer(map: maplibregl.Map, layerIds: string[]) {
  return layerIds.find(layerId => !!map.getLayer(layerId));
}

function getClusterLayerIds(map: maplibregl.Map) {
  return CLUSTER_LAYER_IDS.filter(layerId => !!map.getLayer(layerId));
}

function getClusterFeatureAtPoint(map: maplibregl.Map, point: { x: number; y: number }, eventFeature?: any) {
  if (eventFeature?.properties?.cluster_id != null) return eventFeature;

  const layers = getClusterLayerIds(map);
  if (layers.length === 0) return null;

  const direct = map.queryRenderedFeatures(point as any, { layers });
  const directFeature = direct.find((feature: any) => feature.properties?.cluster_id != null);
  if (directFeature) return directFeature;

  const r = CLUSTER_TOUCH_TOLERANCE;
  const nearby = map.queryRenderedFeatures([
    [point.x - r, point.y - r],
    [point.x + r, point.y + r],
  ] as any, { layers });
  return nearby.find((feature: any) => feature.properties?.cluster_id != null) || null;
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
  userLocation,
  savedIds,
  compareIds,
}: {
  museums: Museum[],
  onMuseumClick: (id: string) => void,
  onBoundsChange?: (bounds: MapBounds) => void,
  darkMode?: boolean,
  locale?: string,
  flyTo?: { lat: number; lng: number; zoom?: number } | null,
  userLocation?: UserLocation | null,
  savedIds?: Set<string>,
  compareIds?: Set<string>,
}) {
  const localeRef = useRef(locale);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapLoaded = useRef(false);
  const onMuseumClickRef = useRef(onMuseumClick);
  const pendingData = useRef<Museum[] | null>(null);
  const darkModeRef = useRef(darkMode);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const savedIdsRef = useRef(savedIds);
  const compareIdsRef = useRef(compareIds);
  const userLocationRef = useRef(userLocation);
  const activePopupRef = useRef<maplibregl.Popup | null>(null);
  const pulseAnimRef = useRef<number | null>(null);
  const clusterTouchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const clusterTouchHandlerAttachedRef = useRef(false);
  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);
  useEffect(() => { savedIdsRef.current = savedIds; }, [savedIds]);
  useEffect(() => {
    compareIdsRef.current = compareIds;
    if (mapRef.current && mapLoaded.current) {
      const src = mapRef.current.getSource('museums') as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(museumsToGeoJSON(museums, savedIdsRef.current, compareIdsRef.current));
    }
  }, [compareIds, museums]);

  useEffect(() => { onMuseumClickRef.current = onMuseumClick; }, [onMuseumClick]);
  useEffect(() => { onBoundsChangeRef.current = onBoundsChange; }, [onBoundsChange]);
  useEffect(() => {
    localeRef.current = locale;
    // Update map labels when locale changes
    if (mapRef.current && mapLoaded.current) {
      applyMapLocale(mapRef.current, locale);
    }
  }, [locale]);

  const scheduleMapResize = () => {
    window.requestAnimationFrame(() => {
      if (!mapRef.current) return;
      mapRef.current.resize();
      mapRef.current.triggerRepaint();
    });
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
    });

    const resizeMap = () => {
      window.requestAnimationFrame(() => {
        map.resize();
        map.triggerRepaint();
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

    // Restore saved position (from tab switches) or geolocate on first visit
    try {
      const saved = sessionStorage.getItem('mapPosition');
      if (saved) {
        const { lng, lat, zoom } = JSON.parse(saved);
        map.jumpTo({ center: [lng, lat], zoom });
      } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 7, duration: 1500 });
          },
          () => { /* Keep default (Korea) on error */ },
          { timeout: 5000, maximumAge: 300000 }
        );
      }
    } catch { }

    // Emit bounds on moveend + save position for tab persistence
    map.on('moveend', () => {
      // Save position for tab switch persistence
      try {
        const c = map.getCenter();
        sessionStorage.setItem('mapPosition', JSON.stringify({ lng: c.lng, lat: c.lat, zoom: map.getZoom() }));
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
    });

    map.on('load', () => {
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

      // Hide North Korea labels (country name + place names within DPRK bounds)
      // hideNorthKoreaLabels(map);

      // Apply locale to map labels
      applyMapLocale(map, localeRef.current);

      // Register all category icon images (blue + orange for saved)
      const categories = Object.keys(CATEGORY_ICONS);
      const savedColor = '#ffffff'; // white icons on orange filled background

      for (const cat of categories) {
        const img = createSvgImage(CATEGORY_ICONS[cat], color);
        img.onload = () => { if (!map.hasImage(`icon-${cat}`)) map.addImage(`icon-${cat}`, img); };
        // Orange version for saved museums
        const savedImg = createSvgImage(CATEGORY_ICONS[cat], savedColor);
        savedImg.onload = () => { if (!map.hasImage(`saved-icon-${cat}`)) map.addImage(`saved-icon-${cat}`, savedImg); };
      }
      // Default icon (blue + orange)
      const defImg = createSvgImage(DEFAULT_ICON, color);
      defImg.onload = () => { if (!map.hasImage('icon-_default')) map.addImage('icon-_default', defImg); };
      const savedDefImg = createSvgImage(DEFAULT_ICON, savedColor);
      savedDefImg.onload = () => { if (!map.hasImage('saved-icon-_default')) map.addImage('saved-icon-_default', savedDefImg); };

      const data = pendingData.current || museums;
      map.addSource('museums', {
        type: 'geojson',
        data: museumsToGeoJSON(data, savedIdsRef.current, compareIdsRef.current),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
        clusterProperties: { hasSaved: ['+', ['get', 'saved']] }
      });

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
          'icon-image': [
            'case', ['>', ['get', 'hasSaved'], 0],
            ['step', ['get', 'point_count'], 'glow-orange-sm', 10, 'glow-orange-md', 50, 'glow-orange-lg'],
            ['step', ['get', 'point_count'], 'glow-blue-sm', 10, 'glow-blue-md', 50, 'glow-blue-lg'],
          ] as any,
          'icon-allow-overlap': true,
          'icon-size': 1.0,
        },
      });

      // Cluster gradient circles — blue (default) or orange (contains saved museums)
      map.addLayer({
        id: 'clusters',
        type: 'symbol',
        source: 'museums',
        filter: ['has', 'point_count'],
        layout: {
          'icon-image': [
            'case', ['>', ['get', 'hasSaved'], 0],
            ['step', ['get', 'point_count'], 'cluster-orange-sm', 10, 'cluster-orange-md', 50, 'cluster-orange-lg'],
            ['step', ['get', 'point_count'], 'cluster-blue-sm', 10, 'cluster-blue-md', 50, 'cluster-blue-lg'],
          ] as any,
          'icon-allow-overlap': true,
        },
      });

      // Start cluster glow pulse animation
      const startPulse = () => {
        const animate = () => {
          if (!mapRef.current || !mapLoaded.current) return;
          const t = (Date.now() % 3000) / 3000; // 3s cycle
          const scale = 1.0 + 0.25 * Math.sin(t * Math.PI * 2); // 1.0 → 1.25
          const opacity = 0.6 + 0.4 * Math.cos(t * Math.PI * 2); // 0.2 → 1.0
          try {
            if (map.getLayer('cluster-glow')) {
              map.setLayoutProperty('cluster-glow', 'icon-size', scale);
              map.setPaintProperty('cluster-glow', 'icon-opacity', opacity);
            }
          } catch { }
          pulseAnimRef.current = requestAnimationFrame(animate);
        };
        pulseAnimRef.current = requestAnimationFrame(animate);
      };
      startPulse();
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
            ['==', ['get', 'saved'], 1], darkMode ? SAVED_DARK_COLOR : SAVED_COLOR,
            darkMode ? '#172554' : '#eff6ff',
          ] as any,
          'circle-radius': 18,
          'circle-stroke-width': 2,
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'saved'], 1], darkMode ? '#fdba74' : '#ea580c',
            color,
          ] as any,
          'circle-opacity': 0.9,
        }
      });

      // Category icon layer
      map.addLayer({
        id: 'unclustered-icon',
        type: 'symbol',
        source: 'museums',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': [
            'case',
            ['==', ['get', 'saved'], 1],
            ['match', ['get', 'type'], ...categories.flatMap(cat => [cat, `saved-icon-${cat}`]), 'saved-icon-_default'],
            ['match', ['get', 'type'], ...categories.flatMap(cat => [cat, `icon-${cat}`]), 'icon-_default']
          ] as any,
          'icon-size': 0.6,
          'icon-allow-overlap': true,
          'icon-anchor': 'center',
        },
      });

      addUserLocationLayers(map, darkMode, userLocationRef.current);

      // Click handlers
      map.on('click', 'unclustered-bg', (e: any) => {
        if (!e.features || e.features.length === 0) return;
        const props = e.features[0].properties;
        if (props?.id) onMuseumClickRef.current(props.id);
      });
      map.on('click', 'unclustered-icon', (e: any) => {
        if (!e.features || e.features.length === 0) return;
        const props = e.features[0].properties;
        if (props?.id) onMuseumClickRef.current(props.id);
      });
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
                  if (activePopupRef.current) { activePopupRef.current.remove(); activePopupRef.current = null; }
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
                    <strong>{(() => { const loc = localeRef.current; if (loc === 'ko') return p?.nameKo || p?.name; if (loc === 'en') return p?.nameEn || p?.name; try { const t = JSON.parse(p?.nameTranslations || '{}'); return t[loc] || p?.nameEn || p?.name; } catch { return p?.nameEn || p?.name; } })()}</strong>
                    {p?.googleRating > 0 && <span>★ {Number(p.googleRating).toFixed(1)}</span>}
                  </div>
                  <small>
                    {(() => { const loc = localeRef.current; if (loc === 'ko') return p?.cityKo || p?.city; if (loc === 'en') return p?.city; try { const t = JSON.parse(p?.cityTranslations || '{}'); return t[loc] || p?.city; } catch { return p?.city; } })()}{p?.country ? `, ${(() => { try { return new Intl.DisplayNames([localeRef.current], { type: 'region' }).of(p.country); } catch { return p.country; } })()}` : ''}
                    {p?.type ? ` · ${translateCategory(p.type, localeRef.current as Locale)}` : ''}
                  </small>
                </div>
              </button>
            );
          });

          root.render(
            <div className="mm-cluster-popup2" style={{ overscrollBehavior: 'contain' }}>
              <div className="mm-cluster-popup2-head">
                {leaves.length} {(() => { const l = localeRef.current; return l === 'ko' ? '미술관' : l === 'ja' ? '美術館' : l === 'zh-CN' ? '博物馆' : l === 'zh-TW' ? '博物館' : l === 'de' ? 'Museen' : l === 'fr' ? 'musées' : l === 'es' ? 'museos' : l === 'pt' ? 'museus' : 'Museums'; })()}
              </div>
              {listItems}
            </div>
          );

          if (geometry.type === 'Point') {
            // Close previous popup if open
            if (activePopupRef.current) { activePopupRef.current.remove(); activePopupRef.current = null; }
            const popup = new maplibregl.Popup({ closeButton: false, maxWidth: '340px', offset: [0, 10], anchor: 'top' })
              .setLngLat(geometry.coordinates as [number, number])
              .setDOMContent(popupNode)
              .addTo(map);
            popup.on('close', () => { activePopupRef.current = null; });
            activePopupRef.current = popup;
          }
        }).catch((err) => {
          if (retryCount < 2) {
            window.setTimeout(() => handleClusterClick({ point, features: [], __retryCount: retryCount + 1 }), 120);
            return;
          }
          console.error('[cluster] getClusterLeaves error:', err);
        });
      };
      map.on('click', 'clusters', handleClusterClick);
      map.on('click', 'cluster-count', handleClusterClick);
      map.on('click', 'cluster-glow', handleClusterClick);
      map.on('click', (e: any) => {
        const point = getEventPoint(e);
        if (!point) return;
        if (!getClusterFeatureAtPoint(map, point)) {
          if (activePopupRef.current) { activePopupRef.current.remove(); activePopupRef.current = null; }
          return;
        }
        handleClusterClick({ point, features: [] });
      });
      if (!clusterTouchHandlerAttachedRef.current) {
        clusterTouchHandlerAttachedRef.current = true;
        map.on('touchstart', (e: any) => {
          if ((e.points?.length || 0) > 1) { clusterTouchStartRef.current = null; return; }
          const point = getEventPoint(e);
          clusterTouchStartRef.current = point ? { x: point.x, y: point.y, time: Date.now() } : null;
        });
        map.on('touchend', (e: any) => {
          const start = clusterTouchStartRef.current;
          clusterTouchStartRef.current = null;
          const point = getEventPoint(e);
          if (!start || !point) return;
          const dx = point.x - start.x;
          const dy = point.y - start.y;
          if (Math.hypot(dx, dy) > 14 || Date.now() - start.time > 700) return;
          if (!getClusterFeatureAtPoint(map, point)) return;
          handleClusterClick({ point, features: [] });
        });
      }

      // Cursor styles for interactive layers
      for (const layer of ['clusters', 'cluster-count', 'cluster-glow', 'unclustered-bg']) {
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
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resizeMap);
      window.visualViewport?.removeEventListener('resize', resizeMap);
      if (pulseAnimRef.current) cancelAnimationFrame(pulseAnimRef.current);
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

    map.once('style.load', () => {
      // Remove ocean/sea water name labels
      const waterLabelIds = ['watername_ocean', 'watername_sea'];
      for (const id of waterLabelIds) {
        if (map.getLayer(id)) try { map.removeLayer(id); } catch { }
      }

      // Hide North Korea labels
      // hideNorthKoreaLabels(map);

      // Apply locale to map labels
      applyMapLocale(map, localeRef.current);
      // Re-register icons with new color
      const categories = Object.keys(CATEGORY_ICONS);
      for (const cat of categories) {
        const img = createSvgImage(CATEGORY_ICONS[cat], color);
        img.onload = () => { if (!map.hasImage(`icon-${cat}`)) map.addImage(`icon-${cat}`, img); };
      }
      const defImg = createSvgImage(DEFAULT_ICON, color);
      defImg.onload = () => { if (!map.hasImage('icon-_default')) map.addImage('icon-_default', defImg); };

      // Re-add source & layers
      map.addSource('museums', {
        type: 'geojson',
        data: museumsToGeoJSON(pendingData.current || museums, savedIdsRef.current, compareIdsRef.current),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
        clusterProperties: { hasSaved: ['+', ['get', 'saved']] },
      });

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
          'icon-image': [
            'case', ['>', ['get', 'hasSaved'], 0],
            ['step', ['get', 'point_count'], 'glow-orange-sm', 10, 'glow-orange-md', 50, 'glow-orange-lg'],
            ['step', ['get', 'point_count'], 'glow-blue-sm', 10, 'glow-blue-md', 50, 'glow-blue-lg'],
          ] as any,
          'icon-allow-overlap': true, 'icon-size': 1.0,
        },
      });

      map.addLayer({
        id: 'clusters', type: 'symbol', source: 'museums', filter: ['has', 'point_count'],
        layout: {
          'icon-image': [
            'case', ['>', ['get', 'hasSaved'], 0],
            ['step', ['get', 'point_count'], 'cluster-orange-sm', 10, 'cluster-orange-md', 50, 'cluster-orange-lg'],
            ['step', ['get', 'point_count'], 'cluster-blue-sm', 10, 'cluster-blue-md', 50, 'cluster-blue-lg'],
          ] as any,
          'icon-allow-overlap': true,
        },
      });

      // Restart pulse animation
      if (pulseAnimRef.current) cancelAnimationFrame(pulseAnimRef.current);
      const animatePulse = () => {
        if (!mapRef.current || !mapLoaded.current) return;
        const t = (Date.now() % 3000) / 3000;
        const scale = 1.0 + 0.25 * Math.sin(t * Math.PI * 2);
        const opacity = 0.6 + 0.4 * Math.cos(t * Math.PI * 2);
        try {
          if (map.getLayer('cluster-glow')) {
            map.setLayoutProperty('cluster-glow', 'icon-size', scale);
            map.setPaintProperty('cluster-glow', 'icon-opacity', opacity);
          }
        } catch { }
        pulseAnimRef.current = requestAnimationFrame(animatePulse);
      };
      pulseAnimRef.current = requestAnimationFrame(animatePulse);
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
            ['==', ['get', 'saved'], 1], darkMode ? '#431407' : '#fff7ed',
            darkMode ? '#172554' : '#eff6ff',
          ] as any,
          'circle-radius': 18,
          'circle-stroke-width': 2,
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'saved'], 1], darkMode ? SAVED_DARK_COLOR : SAVED_COLOR,
            color,
          ] as any,
          'circle-opacity': 0.9,
        },
      });
      map.addLayer({
        id: 'unclustered-icon', type: 'symbol', source: 'museums', filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['match', ['get', 'type'], ...categories.flatMap(cat => [cat, `icon-${cat}`]), 'icon-_default'] as any,
          'icon-size': 0.6, 'icon-allow-overlap': true, 'icon-anchor': 'center',
        },
      });

      addUserLocationLayers(map, darkMode, userLocationRef.current);

      // Re-register click handlers
      map.on('click', 'unclustered-bg', (e: any) => { if (e.features?.[0]?.properties?.id) onMuseumClickRef.current(e.features[0].properties.id); });
      map.on('click', 'unclustered-icon', (e: any) => { if (e.features?.[0]?.properties?.id) onMuseumClickRef.current(e.features[0].properties.id); });

      // Cluster click handler with deduplication (multiple layers overlap)
      let darkLastClusterClick = 0;
      const darkHandleClusterClick = (e: any) => {
        const retryCount = e.__retryCount || 0;
        const now = Date.now();
        if (now - darkLastClusterClick < 300) return;

        const point = getEventPoint(e);
        if (!point) return;
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
                  if (activePopupRef.current) { activePopupRef.current.remove(); activePopupRef.current = null; }
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
                    <strong>{(() => { const loc = localeRef.current; if (loc === 'ko') return p?.nameKo || p?.name; if (loc === 'en') return p?.nameEn || p?.name; try { const t = JSON.parse(p?.nameTranslations || '{}'); return t[loc] || p?.nameEn || p?.name; } catch { return p?.nameEn || p?.name; } })()}</strong>
                    {p?.googleRating > 0 && <span>★ {Number(p.googleRating).toFixed(1)}</span>}
                  </div>
                  <small>
                    {(() => { const loc = localeRef.current; if (loc === 'ko') return p?.cityKo || p?.city; if (loc === 'en') return p?.city; try { const t = JSON.parse(p?.cityTranslations || '{}'); return t[loc] || p?.city; } catch { return p?.city; } })()}{p?.country ? `, ${(() => { try { return new Intl.DisplayNames([localeRef.current], { type: 'region' }).of(p.country); } catch { return p.country; } })()}` : ''}
                    {p?.type ? ` · ${translateCategory(p.type, localeRef.current as Locale)}` : ''}
                  </small>
                </div>
              </button>
            );
          });

          root.render(
            <div className="mm-cluster-popup2" style={{ overscrollBehavior: 'contain' }}>
              <div className="mm-cluster-popup2-head">
                {leaves.length} {(() => { const l = localeRef.current; return l === 'ko' ? '미술관' : l === 'ja' ? '美術館' : l === 'zh-CN' ? '博物馆' : l === 'zh-TW' ? '博物館' : l === 'de' ? 'Museen' : l === 'fr' ? 'musées' : l === 'es' ? 'museos' : l === 'pt' ? 'museus' : 'Museums'; })()}
              </div>
              {listItems}
            </div>
          );

          if (geometry.type === 'Point') {
            if (activePopupRef.current) { activePopupRef.current.remove(); activePopupRef.current = null; }
            const popup = new maplibregl.Popup({ closeButton: false, maxWidth: '340px', offset: [0, 10], anchor: 'top' })
              .setLngLat(geometry.coordinates as [number, number])
              .setDOMContent(popupNode)
              .addTo(map);
            popup.on('close', () => { activePopupRef.current = null; });
            activePopupRef.current = popup;
          }
        }).catch((err) => {
          if (retryCount < 2) {
            window.setTimeout(() => darkHandleClusterClick({ point, features: [], __retryCount: retryCount + 1 }), 120);
            return;
          }
          console.error('[cluster-dark] getClusterLeaves error:', err);
        });
      };
      map.on('click', 'clusters', darkHandleClusterClick);
      map.on('click', 'cluster-count', darkHandleClusterClick);
      map.on('click', 'cluster-glow', darkHandleClusterClick);
      map.on('click', (e: any) => {
        const point = getEventPoint(e);
        if (!point) return;
        if (!getClusterFeatureAtPoint(map, point)) {
          if (activePopupRef.current) { activePopupRef.current.remove(); activePopupRef.current = null; }
          return;
        }
        darkHandleClusterClick({ point, features: [] });
      });
      for (const layer of ['clusters', 'cluster-count', 'cluster-glow', 'unclustered-bg']) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
      }


      // Restore position
      map.jumpTo({ center, zoom });
    });
  }, [darkMode, museums]);

  // Update data when museums change
  useEffect(() => {
    if (!mapRef.current || !mapLoaded.current) {
      pendingData.current = museums;
      return;
    }
    const source = mapRef.current.getSource('museums') as maplibregl.GeoJSONSource | undefined;
    if (source) {
      // Close cluster popup when data changes (category/chip/search/new museums)
      if (activePopupRef.current) { activePopupRef.current.remove(); activePopupRef.current = null; }
      source.setData(museumsToGeoJSON(museums, savedIdsRef.current, compareIdsRef.current));
      scheduleMapResize();
      mapRef.current.triggerRepaint();
    }
  }, [museums, savedIds]);

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

  // FlyTo when prop changes
  useEffect(() => {
    if (!flyTo || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: flyTo.zoom ?? mapRef.current.getZoom(),
      duration: 1500
    });
  }, [flyTo]);

  return <div ref={mapContainer} className="w-full h-full" />;
}
