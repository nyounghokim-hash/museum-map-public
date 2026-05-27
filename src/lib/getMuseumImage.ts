/**
 * Google Places 런타임 호출 금지. Supabase 캐시된 이미지만 허용.
 * Google 원본 URL은 브라우저에서 직접 로드 불가(API key 필요)·Next Image 거부.
 */
export function isGoogleOriginUrl(u: string | null | undefined): boolean {
    if (!u) return false;
    return u.includes('places.googleapis.com')
        || u.includes('lh3.googleusercontent.com/place-photos')
        || u.includes('lh3.googleusercontent.com/places/')
        || u.startsWith('places/');
}

/**
 * URL이 실제로 렌더 가능한지 판정.
 *   - 절대 URL(http/https) 또는 상대 경로(/로 시작)여야 함
 *   - Google 원본 URL(인증 필요) 제외
 *   - 빈 문자열·참조 문자열(places/XXX/photos/YYY)·nullish 제외
 */
export function isRenderableUrl(u: string | null | undefined): boolean {
    if (typeof u !== 'string' || u.length === 0) return false;
    if (!u.startsWith('http') && !u.startsWith('/')) return false;
    return !isGoogleOriginUrl(u);
}

/**
 * Resolve the best available image URL for a museum — "사진 1번".
 * 정책: Supabase 캐시 우선. Google 원본 URL은 절대 반환하지 않음.
 * Priority:
 *   1) cachedPhotoUrls[0] — Supabase Storage
 *   2) imageUrl — non-Google (Wikipedia / Wikimedia / CDN)
 *   3) placePhotos 중 non-Google 항목
 *   null 이면 클라이언트가 로고 placeholder 표시
 */
export function getMuseumImageSrc(museum: { imageUrl?: string | null; cachedPhotoUrls?: any; placePhotos?: any }): string | null {
    const parseArr = (v: any): string[] => {
        if (Array.isArray(v)) return v;
        if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
        return [];
    };
    const cached = parseArr(museum.cachedPhotoUrls);
    if (cached[0]) return cached[0];
    if (museum.imageUrl && !isGoogleOriginUrl(museum.imageUrl)) return museum.imageUrl;
    const place = parseArr(museum.placePhotos);
    for (const p of place) if (isRenderableUrl(p)) return p;
    return null;
}

/**
 * Get a fallback src for onError — tries the next best source after the primary failed.
 */
export function getMuseumImageFallback(museum: { imageUrl?: string | null; cachedPhotoUrls?: any; placePhotos?: any }): string | null {
    const parseArr = (v: any): string[] => {
        if (Array.isArray(v)) return v;
        if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
        return [];
    };
    const place = parseArr(museum.placePhotos);
    const cached = parseArr(museum.cachedPhotoUrls);
    const primary = place[0] || cached[0];
    if (place[0] && cached[0] && place[0] !== cached[0]) return cached[0];
    return primary && museum.imageUrl && museum.imageUrl !== primary ? museum.imageUrl : null;
}
