import type { Locale } from '@/lib/i18n';

type LocationLabel = {
  region: string;
  coordinates: string;
  display: string;
};

const FALLBACK_LABEL_BY_LOCALE: Record<string, string> = {
  ko: '선택한 위치',
  en: 'Selected location',
  ja: '選択した位置',
  de: 'Ausgewählter Standort',
  fr: 'Emplacement sélectionné',
  es: 'Ubicación seleccionada',
  pt: 'Local selecionado',
  'zh-CN': '已选位置',
  'zh-TW': '已選位置',
  da: 'Valgt placering',
  fi: 'Valittu sijainti',
  sv: 'Vald plats',
  et: 'Valitud asukoht',
};

const LANGUAGE_BY_LOCALE: Record<string, string> = {
  ko: 'ko',
  en: 'en',
  ja: 'ja',
  de: 'de',
  fr: 'fr',
  es: 'es',
  pt: 'pt',
  'zh-CN': 'zh',
  'zh-TW': 'zh',
  da: 'da',
  fi: 'fi',
  sv: 'sv',
  et: 'en',
};

function compactCoordinate(value: number) {
  return Number.isFinite(value) ? value.toFixed(3) : '';
}

function buildRegion(parts: Array<unknown>) {
  return parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .filter((part, index, arr) => arr.indexOf(part) === index)
    .join(', ');
}

function buildCountryRegion(country: unknown, region: unknown, locality?: unknown) {
  return buildRegion([country, region || locality]);
}

function normalizeLocaleForAcceptLanguage(locale: Locale | string) {
  if (locale === 'zh-CN') return 'zh-CN,zh,en';
  if (locale === 'zh-TW') return 'zh-TW,zh,en';
  return `${LANGUAGE_BY_LOCALE[locale] || 'en'},en`;
}

async function fetchOpenMeteoRegion(location: { lat: number; lng: number }, language: string) {
  const params = new URLSearchParams({
    latitude: String(location.lat),
    longitude: String(location.lng),
    count: '1',
    language,
    format: 'json',
  });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?${params.toString()}`);
  if (!res.ok) throw new Error('location reverse geocoding failed');
  const json = await res.json();
  const item = Array.isArray(json?.results) ? json.results[0] : null;
  return buildCountryRegion(item?.country, item?.admin1 || item?.admin2, item?.name);
}

async function fetchOsmRegion(location: { lat: number; lng: number }, locale: Locale | string) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(location.lat),
    lon: String(location.lng),
    zoom: '10',
    addressdetails: '1',
    'accept-language': normalizeLocaleForAcceptLanguage(locale),
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`);
  if (!res.ok) throw new Error('osm reverse geocoding failed');
  const json = await res.json();
  const address = json?.address || {};
  const locality = address.city || address.town || address.village || address.municipality || address.county || address.suburb || address.neighbourhood;
  const region = address.state || address.province || address.region || address.county;
  return buildCountryRegion(address.country, region, locality);
}

export function formatCoordinatePair(location: { lat: number; lng: number }) {
  return `${compactCoordinate(location.lat)}, ${compactCoordinate(location.lng)}`;
}

export async function fetchLocationLabel(
  location: { lat: number; lng: number },
  locale: Locale | string,
): Promise<LocationLabel> {
  const coordinates = formatCoordinatePair(location);
  const language = LANGUAGE_BY_LOCALE[locale] || 'en';
  const fallbackLabel = '';

  try {
    const region = await fetchOpenMeteoRegion(location, language);
    const safeRegion = region || await fetchOsmRegion(location, locale) || fallbackLabel;
    return { region: safeRegion, coordinates, display: safeRegion };
  } catch {
    try {
      const region = await fetchOsmRegion(location, locale);
      const safeRegion = region || fallbackLabel;
      return { region: safeRegion, coordinates, display: safeRegion };
    } catch {
      return {
        region: fallbackLabel,
        coordinates,
        display: fallbackLabel,
      };
    }
  }
}
