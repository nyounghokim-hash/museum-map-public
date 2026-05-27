const STORY_TITLE_SEPARATOR = /\s+(?:—|–|-|:|：)\s+/;
const MUSEUM_TITLE_HINT =
    /(박물관|미술관|뮤지엄|전시관|기념관|아트센터|아트스페이스|갤러리|Museum|Museo|Museu|Musée|Gallery|Galler|Kunstmuseum|Art Museum|Art Gallery)/i;

function normalizeTitlePart(value: string) {
    return value
        .replace(/\s+/g, ' ')
        .replace(/[《》"'“”‘’.,，、]/g, '')
        .trim()
        .toLowerCase();
}

function getMuseumNames(museums?: any[]) {
    if (!Array.isArray(museums)) return [];
    return museums
        .flatMap((item) => {
            const museum = item?.museum || item;
            const translations = museum?.nameTranslations && typeof museum.nameTranslations === 'object'
                ? Object.values(museum.nameTranslations)
                : [];
            return [museum?.nameKo, museum?.name, museum?.nameEn, ...translations];
        })
        .filter((name): name is string => typeof name === 'string' && name.trim().length > 0);
}

function looksLikeMuseumPrefix(prefix: string, museums?: any[]) {
    if (MUSEUM_TITLE_HINT.test(prefix)) return true;

    const normalizedPrefix = normalizeTitlePart(prefix);
    return getMuseumNames(museums).some((name) => {
        const normalizedName = normalizeTitlePart(name);
        return normalizedName && (
            normalizedPrefix === normalizedName ||
            normalizedPrefix.includes(normalizedName) ||
            normalizedName.includes(normalizedPrefix)
        );
    });
}

export function getDisplayStoryTitle(title: string | null | undefined, museums?: any[]) {
    if (!title) return '';

    const parts = title.split(STORY_TITLE_SEPARATOR);
    if (parts.length < 2) return title.trim();

    const prefix = parts[0]?.trim();
    const subtitle = parts.slice(1).join(' — ').trim();
    if (!prefix || !subtitle) return title.trim();

    return looksLikeMuseumPrefix(prefix, museums) ? subtitle : title.trim();
}
