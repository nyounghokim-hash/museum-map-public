export type TravelMode = "walking" | "driving" | "transit";

interface MapTarget {
    name: string;
    lat: number;
    lng: number;
}

function encodePathPart(value: string) {
    return encodeURIComponent(value);
}

function naverRouteMode(mode: TravelMode) {
    if (mode === "driving") return "car";
    if (mode === "transit") return "public";
    return "walk";
}

export function buildMapLinks(museum: MapTarget, mode: TravelMode = "walking") {
    const q = encodeURIComponent(museum.name);
    const pathName = encodePathPart(museum.name);
    const ll = `${museum.lat},${museum.lng}`;
    const appName = encodeURIComponent("museummap.app");
    const naverMode = naverRouteMode(mode);
    const naverRouteQuery = `dlat=${museum.lat}&dlng=${museum.lng}&dname=${q}&appname=${appName}`;

    return {
        applePlace: `https://maps.apple.com/?q=${q}&ll=${ll}`,
        appleDirections: `https://maps.apple.com/?q=${q}&ll=${ll}&z=16`,
        googlePlace: `https://www.google.com/maps/search/?api=1&query=${ll}`,
        googleDirections: `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=${mode}`,
        kakaoPlace: `https://map.kakao.com/link/map/${pathName},${museum.lat},${museum.lng}`,
        kakaoDirections: `https://map.kakao.com/link/to/${pathName},${museum.lat},${museum.lng}`,
        naverPlace: `nmap://place?lat=${museum.lat}&lng=${museum.lng}&name=${q}&appname=${appName}`,
        naverDirections: `nmap://route/${naverMode}?${naverRouteQuery}`,
        naverDirectionsIntent: `intent://route/${naverMode}?${naverRouteQuery}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end`,
    };
}

export function isKoreanMapTarget(country: unknown): boolean {
    const normalized = String(country || '').trim().toLowerCase();
    return normalized === 'kr'
        || normalized === 'kor'
        || normalized === 'korea'
        || normalized === 'south korea'
        || normalized === 'republic of korea'
        || normalized === '대한민국'
        || normalized === '한국';
}

/**
 * Detect if the user is on iOS/macOS (prefers Apple Maps) or other (prefers Google Maps)
 */
export function isAppleDevice(): boolean {
    if (typeof navigator === "undefined") return false;
    return /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
}

export function isAndroidDevice(): boolean {
    if (typeof navigator === "undefined") return false;
    return /Android/i.test(navigator.userAgent);
}

/**
 * Returns the best default map link for the user's platform.
 */
export function getDefaultDirections(museum: MapTarget, mode: TravelMode = "walking"): string {
    const links = buildMapLinks(museum, mode);
    return isAppleDevice() ? links.appleDirections : links.googleDirections;
}
