/**
 * Europeana Search API v2 Client
 * 
 * 상업적 사용이 안전한 작품만 필터링 (reusability=open)
 * - CC0, Public Domain Mark, CC-BY, CC-BY-SA만 허용
 * 
 * API 문서: https://pro.europeana.eu/page/search
 * API Key 발급: https://pro.europeana.eu/pages/get-api
 */

const EUROPEANA_BASE_URL = 'https://api.europeana.eu/record/v2';

// ── 상업적 사용 가능한 라이선스만 허용 ──
const COMMERCIAL_SAFE_LICENSES = [
  'http://creativecommons.org/publicdomain/zero/1.0/',
  'http://creativecommons.org/publicdomain/mark/1.0/',
  'http://creativecommons.org/licenses/by/1.0/',
  'http://creativecommons.org/licenses/by/2.0/',
  'http://creativecommons.org/licenses/by/2.5/',
  'http://creativecommons.org/licenses/by/3.0/',
  'http://creativecommons.org/licenses/by/4.0/',
  'http://creativecommons.org/licenses/by-sa/1.0/',
  'http://creativecommons.org/licenses/by-sa/2.0/',
  'http://creativecommons.org/licenses/by-sa/2.5/',
  'http://creativecommons.org/licenses/by-sa/3.0/',
  'http://creativecommons.org/licenses/by-sa/4.0/',
];

// ── 라이선스 → 사람이 읽기 좋은 라벨 ──
function getLicenseLabel(rightsUrl: string): string {
  if (!rightsUrl) return 'Unknown';
  if (rightsUrl.includes('/publicdomain/zero')) return 'CC0';
  if (rightsUrl.includes('/publicdomain/mark')) return 'Public Domain';
  if (rightsUrl.includes('/by-sa/')) return `CC BY-SA ${(rightsUrl.match(/\/(\d\.\d)\/?$/) || [])[1] || ''}`.trim();
  if (rightsUrl.includes('/by/')) return `CC BY ${(rightsUrl.match(/\/(\d\.\d)\/?$/) || [])[1] || ''}`.trim();
  return rightsUrl;
}

// ── 상업적 사용 가능 여부 확인 ──
function isCommercialSafe(rightsUrl: string): boolean {
  if (!rightsUrl) return false;
  return COMMERCIAL_SAFE_LICENSES.some(safe => rightsUrl.startsWith(safe));
}

// ── 타입 정의 ──
export interface EuropeanaArtwork {
  europeanaId: string;       // ex: "/9200365/BibliographicResource_3000135662072"
  title: string;
  artist: string | null;
  year: string | null;
  imageUrl: string | null;   // 직접 접근 가능한 이미지 URL
  thumbnailUrl: string | null;
  rights: string;            // 라이선스 URL
  license: string;           // 사람이 읽기 좋은 라벨 (CC0, CC BY 4.0 등)
  isCommercialSafe: boolean;
  provider: string | null;   // 제공 기관
  country: string | null;
  sourceUrl: string;         // Europeana 상세 페이지 URL
}

export interface EuropeanaSearchOptions {
  rows?: number;            // 결과 개수 (기본 12, 최대 100)
  start?: number;           // 페이지네이션 시작점
  type?: 'IMAGE' | 'TEXT' | 'SOUND' | 'VIDEO' | '3D';
  country?: string;         // 국가 코드 (ex: 'france')
  provider?: string;        // 제공 기관 필터
  onlyWithImage?: boolean;  // 이미지가 있는 것만 (기본 true)
  sort?: string;            // 정렬 기준
}

// ── 검색 응답 파싱 ──
function parseItem(item: any): EuropeanaArtwork {
  // 제목 추출
  const title = item.title?.[0] || item.dcTitleLangAware?.en?.[0] || 'Untitled';

  // 작가 추출
  const artist = item.dcCreator?.[0] 
    || item.dcCreatorLangAware?.en?.[0] 
    || item.dcCreatorLangAware?.def?.[0] 
    || null;

  // 연도 추출
  const year = item.year?.[0] || null;

  // 이미지 URL 추출 (우선순위: edmIsShownBy > edmObject > edmPreview)
  const imageUrl = item.edmIsShownBy?.[0] || item.edmObject?.[0] || null;
  const thumbnailUrl = item.edmPreview?.[0] || null;

  // 라이선스
  const rights = item.rights?.[0] || '';

  // 제공 기관
  const provider = item.dataProvider?.[0] || item.provider?.[0] || null;

  // 국가
  const country = item.country?.[0] || null;

  return {
    europeanaId: item.id || '',
    title,
    artist,
    year,
    imageUrl,
    thumbnailUrl,
    rights,
    license: getLicenseLabel(rights),
    isCommercialSafe: isCommercialSafe(rights),
    provider,
    country,
    sourceUrl: `https://www.europeana.eu/item${item.id}`,
  };
}

// ── API Key 가져오기 ──
function getApiKey(): string {
  const key = process.env.EUROPEANA_API_KEY;
  if (!key) {
    throw new Error(
      '❌ EUROPEANA_API_KEY 환경변수가 설정되지 않았습니다.\n' +
      '   https://pro.europeana.eu/pages/get-api 에서 무료 발급 후 .env에 추가하세요.'
    );
  }
  return key;
}

/**
 * Europeana에서 작품 검색
 * - reusability=open 필터로 상업적 사용 가능 작품만 검색
 * - 결과를 다시 화이트리스트로 이중 검증
 */
export async function searchArtworks(
  query: string,
  options: EuropeanaSearchOptions = {}
): Promise<{ artworks: EuropeanaArtwork[]; totalResults: number }> {
  const apiKey = getApiKey();
  const {
    rows = 20,
    start = 1,
    type = 'IMAGE',
    country,
    provider,
    onlyWithImage = true,
    sort,
  } = options;

  const params = new URLSearchParams({
    wskey: apiKey,
    query,
    reusability: 'open',          // ← 핵심: 상업적 사용 가능만
    rows: String(Math.min(rows, 100)),
    start: String(start),
    profile: 'standard',
  });

  // 타입 필터
  if (type) params.append('qf', `TYPE:${type}`);
  // 이미지 있는 것만
  if (onlyWithImage) params.append('media', 'true');
  // 국가 필터
  if (country) params.append('qf', `COUNTRY:${country}`);
  // 제공 기관 필터
  if (provider) params.append('qf', `DATA_PROVIDER:"${provider}"`);
  // 정렬
  if (sort) params.append('sort', sort);

  const url = `${EUROPEANA_BASE_URL}/search.json?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Europeana API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();

  if (!data.success) {
    throw new Error(`Europeana API returned unsuccessful: ${data.error || 'Unknown error'}`);
  }

  const items = data.items || [];
  const parsed = items.map(parseItem);

  // 이중 검증: 화이트리스트에 없는 라이선스 제거
  const safeArtworks = parsed.filter((a: EuropeanaArtwork) => a.isCommercialSafe);

  return {
    artworks: safeArtworks,
    totalResults: data.totalResults || 0,
  };
}

/**
 * Europeana 개별 레코드 상세 조회
 */
export async function getRecord(europeanaId: string): Promise<EuropeanaArtwork | null> {
  const apiKey = getApiKey();

  // europeanaId는 /로 시작하는 경로 형태 (ex: "/9200365/...")
  const id = europeanaId.startsWith('/') ? europeanaId : `/${europeanaId}`;
  const url = `${EUROPEANA_BASE_URL}${id}.json?wskey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  if (!data.success || !data.object) return null;

  const obj = data.object;
  const proxy = obj.proxies?.[0] || {};
  const agg = obj.aggregations?.[0] || {};
  const euroAgg = obj.europeanaAggregation || {};

  const title = proxy.dcTitle?.def?.[0] || proxy.dcTitle?.en?.[0] || 'Untitled';
  const artist = proxy.dcCreator?.def?.[0] || proxy.dcCreator?.en?.[0] || null;
  const year = proxy.dctermsCreated?.def?.[0] || proxy.dcDate?.def?.[0] || null;
  const imageUrl = agg.edmIsShownBy || agg.edmObject || null;
  const thumbnailUrl = euroAgg.edmPreview || null;
  const rights = agg.edmRights?.def?.[0] || '';

  return {
    europeanaId: id,
    title,
    artist,
    year,
    imageUrl,
    thumbnailUrl,
    rights,
    license: getLicenseLabel(rights),
    isCommercialSafe: isCommercialSafe(rights),
    provider: agg.edmDataProvider?.def?.[0] || null,
    country: null,
    sourceUrl: `https://www.europeana.eu/item${id}`,
  };
}

/**
 * 미술관 이름으로 소장 작품 검색
 */
export async function searchByMuseum(
  museumName: string,
  options: Omit<EuropeanaSearchOptions, 'provider'> = {}
): Promise<{ artworks: EuropeanaArtwork[]; totalResults: number }> {
  return searchArtworks(`*`, {
    ...options,
    provider: museumName,
  });
}

/**
 * 작가 이름으로 작품 검색
 */
export async function searchByArtist(
  artistName: string,
  options: EuropeanaSearchOptions = {}
): Promise<{ artworks: EuropeanaArtwork[]; totalResults: number }> {
  return searchArtworks(`who:${artistName}`, options);
}

// ── 유틸리티 exports ──
export { isCommercialSafe, getLicenseLabel, COMMERCIAL_SAFE_LICENSES };
