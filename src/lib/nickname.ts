/**
 * IP-based Nickname Generator
 * Generates deterministic nicknames in the format: Color + Animal + Number(2 digits)
 * Same IP always produces the same nickname.
 */

const COLORS = [
    'Red', 'Blue', 'Green', 'Gold', 'Pink', 'Violet', 'Coral',
    'Amber', 'Teal', 'Lime', 'Ivory', 'Azure', 'Jade', 'Ruby',
    'Aqua', 'Peach', 'Mint', 'Rose', 'Sky', 'Sunny',
];

const ANIMALS = [
    'Fox', 'Owl', 'Bear', 'Wolf', 'Deer', 'Panda', 'Koala',
    'Otter', 'Whale', 'Crane', 'Eagle', 'Tiger', 'Bunny', 'Seal',
    'Swan', 'Hawk', 'Robin', 'Cat', 'Dog', 'Penguin',
];

/**
 * Simple hash function for strings → deterministic number
 */
function hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash);
}

/**
 * Generate a deterministic nickname from an IP address
 * Format: ColorAnimalNN (e.g. "GoldFox42", "TealOwl07")
 */
export function generateNickname(ipAddress: string): string {
    const hash = hashString(ipAddress);
    const color = COLORS[hash % COLORS.length];
    const animal = ANIMALS[Math.floor(hash / COLORS.length) % ANIMALS.length];
    const number = String(hash % 100).padStart(2, '0');
    return `${color}${animal}${number}`;
}

/**
 * Country code to flag emoji
 */
export function countryToFlag(countryCode: string): string {
    if (!countryCode || countryCode.length !== 2) return '🌍';
    const offset = 0x1f1e6;
    const a = countryCode.toUpperCase().charCodeAt(0) - 65 + offset;
    const b = countryCode.toUpperCase().charCodeAt(1) - 65 + offset;
    return String.fromCodePoint(a) + String.fromCodePoint(b);
}
