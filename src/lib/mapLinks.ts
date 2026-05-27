export type TravelMode = "walking" | "driving" | "transit";

interface MapTarget {
    name: string;
    lat: number;
    lng: number;
}

export function buildMapLinks(museum: MapTarget, mode: TravelMode = "walking") {
    const q = encodeURIComponent(museum.name);
    const ll = `${museum.lat},${museum.lng}`;

    const dirFlag = mode === "walking" ? "w" : mode === "driving" ? "d" : "r";

    return {
        applePlace: `https://maps.apple.com/?q=${q}&ll=${ll}`,
        appleDirections: `https://maps.apple.com/?q=${q}&ll=${ll}&z=16`,
        googlePlace: `https://www.google.com/maps/search/?api=1&query=${ll}`,
        googleDirections: `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=${mode}`,
    };
}

/**
 * Detect if the user is on iOS/macOS (prefers Apple Maps) or other (prefers Google Maps)
 */
export function isAppleDevice(): boolean {
    if (typeof navigator === "undefined") return false;
    return /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
}

/**
 * Returns the best default map link for the user's platform.
 */
export function getDefaultDirections(museum: MapTarget, mode: TravelMode = "walking"): string {
    const links = buildMapLinks(museum, mode);
    return isAppleDevice() ? links.appleDirections : links.googleDirections;
}
