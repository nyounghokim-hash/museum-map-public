/**
 * Google Places Photo URL → Proxy URL 변환 유틸리티
 * 
 * DB에 저장된 Google Places photo URL을 서버 프록시 URL로 변환하여
 * 클라이언트가 직접 Google API를 호출하지 않도록 합니다.
 * 
 * Before: https://places.googleapis.com/v1/places/XXX/photos/YYY/media?maxWidthPx=800&key=API_KEY
 * After:  /api/photos/place?ref=places/XXX/photos/YYY&w=800
 */

const GOOGLE_PLACES_PATTERN = /^https:\/\/places\.googleapis\.com\/v1\/(.+?)\/media\?.*$/;

function parsePhotoArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((url): url is string => typeof url === 'string');
    if (typeof value !== 'string') return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((url): url is string => typeof url === 'string') : [];
    } catch {
        return [];
    }
}

function isGooglePhotoOrigin(url: string): boolean {
    return GOOGLE_PLACES_PATTERN.test(url)
        || url.includes('lh3.googleusercontent.com/place-photos')
        || url.includes('lh3.googleusercontent.com/places/')
        || url.startsWith('places/');
}

function isRenderablePhotoUrl(url: string): boolean {
    return (url.startsWith('http') || url.startsWith('/')) && !isGooglePhotoOrigin(url);
}

/**
 * Google Places photo URL에서 photo reference를 추출
 */
function extractPhotoRef(url: string): { ref: string; width: number } | null {
    const match = url.match(GOOGLE_PLACES_PATTERN);
    if (!match) return null;
    const ref = match[1];
    const widthMatch = url.match(/maxWidthPx=(\d+)/);
    const width = widthMatch ? parseInt(widthMatch[1], 10) : 800;
    return { ref, width };
}

/**
 * 단일 사진 URL을 프록시 URL로 변환.
 * Google Places URL만 변환, Wikimedia/기타 URL은 그대로 반환.
 */
export function toProxyUrl(url: string): string {
    const extracted = extractPhotoRef(url);
    if (!extracted) return url; // Non-Google URL: return as-is
    return `/api/photos/place?ref=${encodeURIComponent(extracted.ref)}&w=${extracted.width}`;
}

/**
 * Museum 객체의 photo URL들을 프록시 URL로 변환.
 * 원본 객체를 수정하지 않고 새 객체를 반환합니다.
 */
export function transformMuseumPhotos(museum: any): any {
    const result = { ...museum };
    const cachedPhotoUrls = parsePhotoArray(result.cachedPhotoUrls).filter(isRenderablePhotoUrl);

    // Supabase Storage 캐시가 있으면 Google 프록시 대신 직접 사용
    if (cachedPhotoUrls.length > 0) {
        result.cachedPhotoUrls = cachedPhotoUrls;
        result.placePhotos = cachedPhotoUrls;
        result.imageUrl = cachedPhotoUrls[0];
        return result;
    }

    // 캐시 없으면 Google 원본/참조 사진 비표시 (Google API 비용 및 깨진 이미지 방지)
    result.placePhotos = parsePhotoArray(result.placePhotos).filter(isRenderablePhotoUrl);

    // imageUrl이 Google 원본/참조 URL이면 제거
    if (typeof result.imageUrl === 'string' && !isRenderablePhotoUrl(result.imageUrl)) {
        result.imageUrl = '';
    }

    return result;
}

/**
 * 중첩된 museum 객체의 imageUrl을 재귀적으로 변환.
 * saves, collections, plans, blog 등에서 사용.
 * 예: { museum: { imageUrl: "..." } } → 변환
 *     { stops: [{ museum: { imageUrl: "..." } }] } → 변환
 */
export function transformNestedPhotos(data: any): any {
    if (data === null || data === undefined || typeof data !== 'object') return data;

    if (Array.isArray(data)) {
        return data.map(item => transformNestedPhotos(item));
    }

    const obj = { ...data };

    // Museum-shaped objects are normalized in one place so nested APIs cannot
    // accidentally emit Google photo origins or disabled proxy URLs.
    if ('cachedPhotoUrls' in obj || 'placePhotos' in obj) {
        Object.assign(obj, transformMuseumPhotos(obj));
    }

    // Nested museum object
    if (obj.museum && typeof obj.museum === 'object') {
        obj.museum = transformMuseumPhotos(obj.museum);
    }

    // Nested arrays (stops, items, etc.)
    for (const key of ['stops', 'items', 'saves', 'museums']) {
        if (Array.isArray(obj[key])) {
            obj[key] = obj[key].map((item: any) => transformNestedPhotos(item));
        }
    }

    return obj;
}
